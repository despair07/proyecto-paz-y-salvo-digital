// ============================================================================
// SERVICIO DE ADMINISTRACIÓN DTI
// Dos paneles: solicitantes (verificar su vinculación, corregir nombre y correo) y personal de las
// dependencias (registrar, cambiar nombre, correo y dependencia). RN-011: el Administrador DTI nunca
// accede a los datos de los trámites ni a las firmas.
// ============================================================================

const database = require('../config/database');
const adminRepository = require('../repositories/admin.repository');
const notificationService = require('./notification.service');
const { ROLES } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const DOMINIO = '@uniautonoma.edu.co';
const CORREO_VALIDO = /^[a-z0-9._%+-]+@uniautonoma\.edu\.co$/;
const FILTROS = ['pendientes', 'verificados', 'inactivos', 'todos'];

const texto = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

function paginar(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

// Nombre, apellidos, correo @uniautonoma.edu.co y cargo ya normalizados
function validarDatos(body = {}) {
  const nombres = texto(body.nombres);
  const apellidos = texto(body.apellidos);
  const correo = texto(body.correo_institucional ?? body.correo).toLowerCase();
  const cargo = texto(body.cargo) || null;
  if (nombres.length < 2 || nombres.length > 120) throw new HttpError(400, 'Los nombres son obligatorios (hasta 120 caracteres)');
  if (apellidos.length < 2 || apellidos.length > 160) throw new HttpError(400, 'Los apellidos son obligatorios (hasta 160 caracteres)');
  if (!CORREO_VALIDO.test(correo)) throw new HttpError(400, `El correo debe ser institucional (${DOMINIO})`);
  if (cargo && cargo.length > 150) throw new HttpError(400, 'El cargo admite hasta 150 caracteres');
  return { nombres, apellidos, correo, cargo };
}

function rolDeDependencia(dependencia) {
  if (dependencia.etapa === 1) return ROLES.JEFE_INMEDIATO;
  if (dependencia.etapa === 3) return ROLES.APROBADOR;
  return ROLES.ENCARGADO_AREA;
}

class AdminService {
  async resumen() {
    return database.withClient(async (client) => ({
      solicitantes: await adminRepository.contarSolicitantes(client),
      personal: await adminRepository.contarPersonal(client),
    }));
  }

  async listSolicitantes(query = {}) {
    const { page, limit, offset } = paginar(query);
    const filtro = FILTROS.includes(query.filtro) ? query.filtro : 'todos';
    return database.withClient(async (client) => {
      const { rows, total } = await adminRepository.listSolicitantes(client, {
        search: texto(query.q), filtro, limit, offset,
      });
      return {
        data: rows.map((u) => ({ ...u, nombre_completo: `${u.nombres} ${u.apellidos}` })),
        conteos: await adminRepository.contarSolicitantes(client),
        pagination: { page, limit, totalRecords: total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async listPersonal(query = {}) {
    const { page, limit, offset } = paginar(query);
    return database.withClient(async (client) => {
      const { rows, total } = await adminRepository.listPersonal(client, {
        search: texto(query.q), dependenciaId: query.dependenciaId || null, limit, offset,
      });
      return {
        data: rows.map((u) => ({ ...u, nombre_completo: `${u.nombres} ${u.apellidos}` })),
        dependencias: await adminRepository.listDependenciasConEncargados(client),
        conteos: await adminRepository.contarPersonal(client),
        pagination: { page, limit, totalRecords: total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async loadGestionable(client, id, { forUpdate = true } = {}) {
    const usuario = await adminRepository.findUsuario(client, id, { forUpdate });
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
    if (usuario.roles.includes(ROLES.ADMIN_DTI)) {
      throw new HttpError(403, 'RN-011: las cuentas de administración no se modifican desde este panel');
    }
    return usuario;
  }

  // Corregir nombre, correo y cargo de un solicitante o de una persona del personal
  async actualizar(currentUser, id, body) {
    const datos = validarDatos(body);
    return database.withUserContext(currentUser, 'Actualización de datos de usuario por TI', async (client) => {
      const usuario = await this.loadGestionable(client, id);
      if (datos.correo !== usuario.correo_institucional) {
        if (await adminRepository.findByCorreo(client, datos.correo)) {
          throw new HttpError(409, 'Ya existe una cuenta con ese correo');
        }
      }
      const actualizado = await adminRepository.updateDatos(client, id, datos);

      const cambioCorreo = datos.correo !== usuario.correo_institucional;
      await notificationService.notify(client, id, {
        tipo: 'DATOS_ACTUALIZADOS',
        titulo: 'TI actualizó los datos de tu cuenta',
        mensaje: cambioCorreo
          ? `Tu correo institucional ahora es ${datos.correo}. Ingresa con esa cuenta de Google.`
          : 'Se corrigieron tu nombre o tu cargo en el sistema.',
        referencia: {},
      });
      return {
        ok: true,
        mensaje: cambioCorreo
          ? 'Datos actualizados. La persona debe ingresar con el nuevo correo de Google.'
          : 'Datos actualizados',
        data: actualizado,
      };
    });
  }

  // El autoregistro llega sin verificar: TI confirma su vinculación con la universidad o lo rechaza
  async verificar(currentUser, id, { decision } = {}) {
    if (!['CONFIRMAR', 'RECHAZAR'].includes(decision)) {
      throw new HttpError(400, 'La decisión debe ser CONFIRMAR o RECHAZAR');
    }
    return database.withUserContext(
      currentUser,
      decision === 'CONFIRMAR' ? 'Verificación de vinculación por TI' : 'Rechazo de autoregistro por TI',
      async (client) => {
        const usuario = await this.loadGestionable(client, id);
        if (usuario.es_personal) throw new HttpError(409, 'El personal de las dependencias lo registra TI y ya está verificado');
        if (usuario.verificado) throw new HttpError(409, 'Esta persona ya está verificada');

        if (decision === 'CONFIRMAR') {
          await adminRepository.setVerificado(client, id, { verificado: true, porId: currentUser.id });
          await notificationService.notify(client, id, {
            tipo: 'VINCULACION_VERIFICADA',
            titulo: 'TI verificó tu vinculación',
            mensaje: 'Tu cuenta quedó verificada. Ya puedes tramitar tu paz y salvo.',
            referencia: {},
          });
          return { ok: true, mensaje: 'Vinculación confirmada', estado: 'VERIFICADO' };
        }
        await adminRepository.setEstado(client, id, 'INACTIVO');
        return { ok: true, mensaje: 'Autoregistro rechazado: la cuenta quedó inactiva', estado: 'RECHAZADO' };
      }
    );
  }

  async cambiarEstado(currentUser, id, { estado } = {}) {
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw new HttpError(400, 'El estado debe ser ACTIVO o INACTIVO');
    if (id === currentUser.id) throw new HttpError(409, 'No puedes desactivar tu propia cuenta');
    return database.withUserContext(currentUser, `Cuenta ${estado === 'ACTIVO' ? 'reactivada' : 'desactivada'} por TI`, async (client) => {
      await this.loadGestionable(client, id);
      await adminRepository.setEstado(client, id, estado);
      return { ok: true, mensaje: estado === 'ACTIVO' ? 'Cuenta reactivada' : 'Cuenta desactivada', estado };
    });
  }

  // Quien sale de una dependencia (o cambia de rol) no puede dejar solicitudes sin atender
  async assertPuedeSalir(client, usuarioId) {
    const abiertos = await adminRepository.tramitesConJefe(client, usuarioId);
    if (abiertos > 0) {
      throw new HttpError(409, `Hay ${abiertos} trámite(s) en curso que eligieron a esta persona como jefe inmediato. Espera a que terminen.`);
    }
    const pendientes = await adminRepository.revisionesPendientesDe(client, usuarioId);
    if (pendientes.length) {
      const detalle = pendientes.map((p) => `${p.nombre} (${p.pendientes})`).join(', ');
      throw new HttpError(409, `Es la única persona que atiende solicitudes en revisión: ${detalle}. Asigna antes a otra persona en esa dependencia.`);
    }
  }

  // Registrar a alguien del personal (o promover a quien ya ingresó por Google) con su dependencia
  async registrarPersonal(currentUser, body = {}) {
    const datos = validarDatos(body);
    return database.withUserContext(currentUser, 'Registro de personal de dependencia por TI', async (client) => {
      const dependencia = await this.requireDependencia(client, body.dependencia_id);
      const existente = await adminRepository.findByCorreo(client, datos.correo);

      let usuarioId;
      if (existente) {
        const usuario = await this.loadGestionable(client, existente.id);
        if (usuario.es_personal) throw new HttpError(409, 'Esa persona ya es parte del personal: edita su dependencia en la lista');
        if (usuario.tramite_en_curso) throw new HttpError(409, 'Esa persona tiene un trámite de paz y salvo en curso');
        usuarioId = usuario.id;
        await adminRepository.updateDatos(client, usuarioId, datos);
        await adminRepository.setVerificado(client, usuarioId, { verificado: true, porId: currentUser.id });
      } else {
        usuarioId = await adminRepository.crearPersonal(client, datos);
      }
      await adminRepository.asignarPersonal(client, usuarioId, dependencia, rolDeDependencia(dependencia));
      await this.avisarAsignacion(client, usuarioId, dependencia);
      return {
        ok: true,
        mensaje: `${datos.nombres} ${datos.apellidos} quedó asignado(a) a ${dependencia.nombre}. Ya puede entrar con Google.`,
        id: usuarioId,
      };
    });
  }

  async requireDependencia(client, dependenciaId) {
    if (!dependenciaId) throw new HttpError(400, 'Elige la dependencia');
    const dependencia = await adminRepository.findDependencia(client, dependenciaId);
    if (!dependencia) throw new HttpError(404, 'La dependencia no existe');
    return dependencia;
  }

  async avisarAsignacion(client, usuarioId, dependencia) {
    await notificationService.notify(client, usuarioId, {
      tipo: 'ASIGNACION_ACTUALIZADA',
      titulo: 'TI actualizó tu dependencia',
      mensaje: `Ahora atiendes las solicitudes de ${dependencia.nombre}. Cierra sesión y vuelve a ingresar para ver los cambios.`,
      referencia: { dependenciaId: dependencia.id },
    });
  }

  // Cambiar a una persona del personal de dependencia
  async asignarDependencia(currentUser, id, body = {}) {
    return database.withUserContext(currentUser, 'Cambio de dependencia del personal por TI', async (client) => {
      const usuario = await this.loadGestionable(client, id);
      if (!usuario.es_personal) throw new HttpError(409, 'Esa persona no es parte del personal: regístrala como personal primero');
      const dependencia = await this.requireDependencia(client, body.dependencia_id);

      await this.assertPuedeSalir(client, id);
      await adminRepository.asignarPersonal(client, id, dependencia, rolDeDependencia(dependencia));
      await this.avisarAsignacion(client, id, dependencia);
      return { ok: true, mensaje: `Ahora pertenece a ${dependencia.nombre}. Debe volver a iniciar sesión para ver el cambio.` };
    });
  }

  // La persona deja de ser personal de dependencia (vuelve a ser una cuenta sin rol)
  async quitarPersonal(currentUser, id) {
    return database.withUserContext(currentUser, 'Retiro de personal de dependencia por TI', async (client) => {
      const usuario = await this.loadGestionable(client, id);
      if (!usuario.es_personal) throw new HttpError(409, 'Esa persona no es parte del personal');
      await this.assertPuedeSalir(client, id);
      await adminRepository.quitarPersonal(client, id);
      return { ok: true, mensaje: 'La persona dejó de atender solicitudes de dependencias' };
    });
  }
}

module.exports = new AdminService();
