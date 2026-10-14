// ============================================================================
// SERVICIO DE AUTENTICACIÓN
// Correo institucional + contraseña (bcrypt contra usuarios.password_hash) o Google Workspace SSO.
// ============================================================================

const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// Hash válido para igualar el tiempo de respuesta cuando el correo no existe.
const DUMMY_HASH = '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6';

const INVALID_CREDENTIALS = 'Credenciales institucionales incorrectas';

class AuthService {
  assertJwtSecret() {
    if (!env.JWT.SECRET || Buffer.byteLength(env.JWT.SECRET, 'utf8') < 32) {
      throw new HttpError(500, 'JWT_SECRET debe tener al menos 32 bytes');
    }
  }

  toProfile(row) {
    return {
      id: row.id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      nombre_completo: `${row.nombres} ${row.apellidos}`.trim(),
      correo_institucional: row.correo_institucional,
      numero_documento: row.numero_documento,
      tipo_vinculacion: row.tipo_vinculacion,
      cargo: row.cargo || null,
      dependencia: row.dependencia || null,
      dependencia_id: row.dependencia_id || null,
      roles: Array.isArray(row.roles) ? row.roles : JSON.parse(row.roles || '[]'),
      estado: row.estado,
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

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.endsWith('@uniautonoma.edu.co')) {
      throw new HttpError(401, 'Acceso restringido a personal institucional');
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

  async loginWithGoogle(googleToken) {
    this.assertJwtSecret();
    if (!env.GOOGLE_CLIENT_ID) {
      throw new HttpError(503, 'El acceso con Google Workspace no está configurado');
    }

    let email;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email_verified) {
        throw new HttpError(401, 'El correo de Google no está verificado');
      }
      email = payload.email?.toLowerCase();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, 'Token de Google inválido o expirado');
    }

    if (!email || !email.endsWith('@uniautonoma.edu.co')) {
      throw new HttpError(401, 'Acceso restringido a personal institucional');
    }

    const row = await userRepository.findByEmail(email);
    if (!row) {
      throw new HttpError(404, 'Correo institucional no registrado. Contacte al Administrador DTI.');
    }
    this.assertActive(row);
    return this.issueToken(row);
  }

  async getProfile(currentUser) {
    const row = await userRepository.findById(currentUser.id);
    if (!row) {
      throw new HttpError(401, 'La sesión pertenece a un usuario que ya no existe');
    }
    this.assertActive(row);
    return this.toProfile(row);
  }
}

module.exports = new AuthService();
