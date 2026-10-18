// ============================================================================
// SERVICIO DE AUTENTICACIÓN Y PERFIL
// · Inicio de sesión con Google Workspace (@uniautonoma.edu.co). Quien no esté en la base se
//   registra solo, sin verificar y sin rol, y elige su tipo de vinculación (RN-012).
// · Los roles de área (encargado, jefe, aprobador, DTI) los asigna únicamente TI.
// · Correo y contraseña existe solo para desarrollo (AUTH_PASSWORD_ENABLED).
// ============================================================================

const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../config/database');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { ROLES, SOLICITANTES } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// Hash válido para igualar el tiempo de respuesta cuando el correo no existe.
const DUMMY_HASH = '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6';

const INVALID_CREDENTIALS = 'Credenciales institucionales incorrectas';
const RESTRICTED_ACCESS = 'Acceso restringido a cuentas @uniautonoma.edu.co';

function splitName(payload) {
  const given = String(payload.given_name || '').trim();
  const family = String(payload.family_name || '').trim();
  if (given && family) return { nombres: given, apellidos: family };

  const parts = String(payload.name || payload.email.split('@')[0]).trim().split(/\s+/);
  const half = Math.max(1, Math.ceil(parts.length / 2));
  return {
    nombres: parts.slice(0, half).join(' '),
    apellidos: parts.slice(half).join(' ') || '(sin apellido)',
  };
}

class AuthService {
  assertJwtSecret() {
    if (!env.JWT.SECRET || Buffer.byteLength(env.JWT.SECRET, 'utf8') < 32) {
      throw new HttpError(500, 'JWT_SECRET debe tener al menos 32 bytes');
    }
  }

  toProfile(row) {
    const roles = Array.isArray(row.roles) ? row.roles : JSON.parse(row.roles || '[]');
    return {
      id: row.id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      nombre_completo: `${row.nombres} ${row.apellidos}`.trim(),
      correo_institucional: row.correo_institucional,
      numero_documento: row.numero_documento,
      tipo_vinculacion: row.tipo_vinculacion || null,
      cargo: row.cargo || null,
      dependencia: row.dependencia || null,
      dependencia_id: row.dependencia_id || null,
      roles,
      estado: row.estado,
      verificado: row.verificado !== false,
      origen: row.origen,
      // Sin ningún rol la persona todavía debe elegir su tipo de vinculación
      requiere_tipo_vinculacion: roles.length === 0,
    };
  }

  issueToken(row, expiresIn = env.JWT.EXPIRES_IN || '24h') {
    this.assertJwtSecret();
    const usuario = this.toProfile(row);
    const token = jwt.sign(
      {
        id: usuario.id,
        correo_institucional: usuario.correo_institucional,
        roles: usuario.roles,
        nombre_completo: usuario.nombre_completo,
        dependencia_id: usuario.dependencia_id,
      },
      env.JWT.SECRET,
      {
        algorithm: 'HS256',
        issuer: 'paz-y-salvo-digital',
        audience: 'paz-y-salvo-web',
        expiresIn,
      }
    );
    return { ok: true, token, user: usuario };
  }

  assertActive(row) {
    if (row.estado !== 'ACTIVO') {
      throw new HttpError(403, 'La cuenta institucional está inactiva. Contacte al Administrador DTI.');
    }
  }

  async login({ googleToken, email, password } = {}) {
    if (googleToken) {
      return this.loginWithGoogle(googleToken);
    }
    return this.loginWithPassword(email, password);
  }

  // Solo desarrollo: usuarios del seed con contraseña
  async loginWithPassword(email, password) {
    if (!env.AUTH_PASSWORD_ENABLED) {
      throw new HttpError(403, 'El inicio de sesión con contraseña está deshabilitado. Use Google Workspace.');
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.endsWith('@uniautonoma.edu.co')) {
      throw new HttpError(401, RESTRICTED_ACCESS);
    }
    if (!password) {
      throw new HttpError(400, 'La contraseña es requerida');
    }

    const row = await userRepository.findByEmail(normalizedEmail);
    // Se compara siempre contra un hash para no revelar si el correo existe por el tiempo de respuesta.
    const matches = await bcrypt.compare(String(password), row?.password_hash || DUMMY_HASH);
    if (!row || !row.password_hash || !matches) {
      throw new HttpError(401, INVALID_CREDENTIALS);
    }
    this.assertActive(row);
    return this.issueToken(row);
  }

  async verifyGoogleToken(googleToken) {
    this.assertJwtSecret();
    if (!env.GOOGLE_CLIENT_ID) {
      throw new HttpError(503, 'El acceso con Google Workspace no está configurado');
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw new HttpError(401, 'Token de Google inválido o expirado');
    }

    const email = String(payload?.email || '').toLowerCase();
    if (!payload?.email_verified) {
      throw new HttpError(401, 'El correo de Google no está verificado');
    }
    // `hd` solo viene en cuentas de Google Workspace del dominio; un correo @uniautonoma.edu.co
    // verificado en una cuenta personal de Google no lo trae.
    if (payload.hd !== env.GOOGLE_HOSTED_DOMAIN || !email.endsWith(`@${env.GOOGLE_HOSTED_DOMAIN}`)) {
      throw new HttpError(401, RESTRICTED_ACCESS);
    }
    return { ...payload, email };
  }

  async loginWithGoogle(googleToken) {
    const google = await this.verifyGoogleToken(googleToken);
    let row = await userRepository.findByEmail(google.email);

    if (!row) {
      row = await this.selfRegister(google);
    } else {
      this.assertActive(row);
      if (row.google_sub && row.google_sub !== google.sub) {
        throw new HttpError(401, 'La cuenta de Google no coincide con la registrada para este correo');
      }
      await userRepository.touchLogin(row.id, google.sub);
    }
    return this.issueToken(row);
  }

  // Primer ingreso: queda registrado sin verificar y se avisa a TI para que lo confirme.
  async selfRegister(google) {
    const { nombres, apellidos } = splitName(google);
    try {
      await database.withSystemContext('Autoregistro con Google', async (client) => {
        const id = await userRepository.createSelfRegistered(client, {
          nombres,
          apellidos,
          correo: google.email,
          googleSub: google.sub,
        });
        const admins = await userRepository.listIdsByRole(client, ROLES.ADMIN_DTI);
        await notificationService.notify(client, admins, {
          tipo: 'NUEVO_USUARIO_SIN_VERIFICAR',
          titulo: 'Nuevo usuario sin verificar',
          mensaje: `${nombres} ${apellidos} (${google.email}) ingresó por primera vez con Google. Verifique su vinculación con la universidad.`,
          referencia: { usuarioId: id },
        });
      });
    } catch (error) {
      // Dos primeros ingresos simultáneos del mismo correo: gana el primero
      if (error.code !== '23505') throw error;
    }
    return userRepository.findByEmail(google.email);
  }

  async getProfile(currentUser) {
    const row = await userRepository.findById(currentUser.id);
    if (!row) {
      throw new HttpError(401, 'La sesión pertenece a un usuario que ya no existe');
    }
    this.assertActive(row);
    return this.toProfile(row);
  }

  // Elegir (primera vez) o cambiar el tipo de vinculación. Cambiar exige confirmación explícita,
  // no se permite con un trámite en curso (RN-012) y se notifica a la persona y a TI.
  async updateTipoVinculacion(currentUser, { tipo, confirmar }) {
    if (!SOLICITANTES.includes(tipo)) {
      throw new HttpError(400, `El tipo de vinculación debe ser: ${SOLICITANTES.join(', ')}`);
    }

    await database.withUserContext(currentUser, 'Cambio de tipo de vinculación', async (client) => {
      const actual = await userRepository.lockForTipoChange(client, currentUser.id);
      if (!actual) throw new HttpError(401, 'La sesión pertenece a un usuario que ya no existe');
      if (actual.tipo_vinculacion === tipo) return;

      const isChange = Boolean(actual.tipo_vinculacion);
      if (isChange && confirmar !== true) {
        throw new HttpError(400, 'Debe confirmar el cambio de tipo de vinculación');
      }

      await userRepository.setTipoVinculacion(client, currentUser.id, tipo);

      const nombre = `${actual.nombres} ${actual.apellidos}`;
      if (isChange) {
        await notificationService.notify(client, currentUser.id, {
          tipo: 'CAMBIO_TIPO_VINCULACION',
          titulo: 'Cambiaste tu tipo de vinculación',
          mensaje: `Tu tipo de vinculación pasó de ${actual.tipo_vinculacion} a ${tipo}.`,
          referencia: { anterior: actual.tipo_vinculacion, nuevo: tipo },
        });
        const admins = await userRepository.listIdsByRole(client, ROLES.ADMIN_DTI);
        await notificationService.notify(client, admins, {
          tipo: 'CAMBIO_TIPO_VINCULACION',
          titulo: 'Cambio de tipo de vinculación',
          mensaje: `${nombre} (${actual.correo_institucional}) pasó de ${actual.tipo_vinculacion} a ${tipo}.`,
          referencia: { usuarioId: currentUser.id, anterior: actual.tipo_vinculacion, nuevo: tipo },
        });
      } else {
        await notificationService.notify(client, currentUser.id, {
          tipo: 'TIPO_VINCULACION_DEFINIDO',
          titulo: 'Perfil configurado',
          mensaje: `Quedaste registrado como ${tipo}. Ya puedes gestionar tu paz y salvo.`,
          referencia: { nuevo: tipo },
        });
      }
    });

    // Los roles viajan en el token: se emite uno nuevo con el tipo actualizado
    return this.issueToken(await userRepository.findById(currentUser.id));
  }
}

module.exports = new AuthService();
