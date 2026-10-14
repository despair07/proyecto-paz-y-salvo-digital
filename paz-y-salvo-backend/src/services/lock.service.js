// ============================================================================
// SERVICIO DE GESTIÓN DE BLOQUEOS (RN-001, RN-003, RN-004, RN-009, RN-011, RF-002, RF-003)
// Las reglas también las hace cumplir la base de datos (triggers y CHECK).
// ============================================================================

const database = require('../config/database');
const lockRepository = require('../repositories/lock.repository');
const requestRepository = require('../repositories/request.repository');
const userRepository = require('../repositories/user.repository');
const { ROLES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const ALLOWED_CATEGORIES = [
  'FINANCIERO',
  'INVENTARIO_ELEMENTOS',
  'DOCUMENTAL_ENTREGABLES',
  'ACADEMICO_PROFESORAL',
];

// RN-011: el Administrador DTI no registra ni levanta bloqueos.
const AREA_ROLES = [ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO];
const READ_ALL_ROLES = [ROLES.ADMIN_DTI, ROLES.APROBADOR];

class LockService {
  // Alcance de lectura según el rol (RN-004).
  async resolveScope(client, currentUser) {
    if (hasRole(currentUser.roles, READ_ALL_ROLES)) return {};
    if (hasRole(currentUser.roles, AREA_ROLES)) {
      return { dependencyIds: await userRepository.listAssignedDependencyIds(client, currentUser.id) };
    }
    return { usuarioId: currentUser.id };
  }

  canSee(lock, scope) {
    if (scope.dependencyIds) return scope.dependencyIds.includes(lock.dependencia_id);
    if (scope.usuarioId) return lock.usuario_id === scope.usuarioId;
    return true;
  }

  async assertCanManage(client, currentUser, dependenciaId) {
    if (!hasRole(currentUser.roles, AREA_ROLES)) {
      throw new HttpError(403, 'Solo los encargados de área pueden registrar, modificar o levantar bloqueos');
    }
    const assigned = await userRepository.listAssignedDependencyIds(client, currentUser.id);
    if (!assigned.includes(dependenciaId)) {
      throw new HttpError(403, 'RN-004: no tiene permisos sobre bloqueos de otra dependencia');
    }
  }

  async list(filters, currentUser) {
    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit, 10) || 20));

    return database.withClient(async (client) => {
      const scope = await this.resolveScope(client, currentUser);
      const { rows, total } = await lockRepository.list(client, {
        scope,
        filters: {
          dependencia: filters.dependencia,
          solicitudId: filters.solicitudId,
          estado: filters.estado,
          categoria: filters.categoria,
          q: typeof filters.q === 'string' ? filters.q.trim() : '',
        },
        limit,
        offset: (page - 1) * limit,
      });
      return {
        data: rows,
        pagination: { page, limit, totalRecords: total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async getById(id, currentUser) {
    return database.withClient(async (client) => {
      const lock = await lockRepository.findById(client, id);
      if (!lock) throw new HttpError(404, 'Bloqueo no encontrado');
      const scope = await this.resolveScope(client, currentUser);
      if (!this.canSee(lock, scope)) {
        throw new HttpError(403, 'No tiene permisos para ver este bloqueo');
      }
      return lock;
    });
  }

  async create(payload, currentUser) {
    const { solicitudId, dependenciaId, categoria, motivo, motivoDescripcion } = payload || {};
    const finalMotivo = String(motivo || motivoDescripcion || '').trim();

    if (!hasRole(currentUser.roles, AREA_ROLES)) {
      throw new HttpError(403, 'Solo los encargados de área pueden registrar bloqueos');
    }
    if (!solicitudId || !dependenciaId) {
      throw new HttpError(400, 'solicitudId y dependenciaId son obligatorios');
    }
    // RN-009: motivo obligatorio
    if (!finalMotivo) {
      throw new HttpError(400, 'RN-009: el motivo del bloqueo es obligatorio');
    }
    // RN-003: categoría obligatoria
    if (!ALLOWED_CATEGORIES.includes(categoria)) {
      throw new HttpError(400, `RN-003: la categoría debe ser una de: ${ALLOWED_CATEGORIES.join(', ')}`);
    }

    return database.withUserContext(currentUser, 'Registrar bloqueo', async (client) => {
      await this.assertCanManage(client, currentUser, dependenciaId);

      const solicitud = await requestRepository.findById(client, solicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud de paz y salvo no encontrada');
      if (['APROBADO_FINAL', 'RECHAZADO'].includes(solicitud.estado_global)) {
        throw new HttpError(409, 'No se pueden registrar bloqueos en una solicitud ya finalizada');
      }
      if (await lockRepository.findActiveByArea(client, solicitudId, dependenciaId)) {
        throw new HttpError(409, 'Ya existe un bloqueo activo de esta dependencia para el trabajador');
      }

      return lockRepository.create(client, {
        solicitudId,
        dependenciaId,
        registradoPorId: currentUser.id,
        categoria,
        motivo: finalMotivo,
      });
    });
  }

  async update(id, payload, currentUser) {
    const { estado, observacion, observacionResolucion, motivo, resolver } = payload || {};
    const finalObs = String(observacion || observacionResolucion || '').trim();

    return database.withUserContext(currentUser, 'Actualizar bloqueo', async (client) => {
      const lock = await lockRepository.findById(client, id);
      if (!lock) throw new HttpError(404, 'Bloqueo no encontrado');
      await this.assertCanManage(client, currentUser, lock.dependencia_id);

      // RF-003: levantar el bloqueo (RESUELTO)
      if (estado === 'RESUELTO' || resolver === true) {
        if (lock.estado === 'RESUELTO') {
          throw new HttpError(409, 'El bloqueo ya fue resuelto');
        }
        return lockRepository.resolve(client, {
          id,
          resueltoPorId: currentUser.id,
          observacion: finalObs,
        });
      }

      if (lock.estado === 'RESUELTO') {
        throw new HttpError(409, 'Un bloqueo resuelto hace parte del historial y no se edita');
      }
      return lockRepository.updateText(client, {
        id,
        motivo: typeof motivo === 'string' ? motivo.trim() : '',
        observacion: finalObs,
      });
    });
  }

  async remove(id, currentUser) {
    return database.withUserContext(currentUser, 'Anular bloqueo', async (client) => {
      const lock = await lockRepository.findById(client, id);
      if (!lock) throw new HttpError(404, 'Bloqueo no encontrado');
      await this.assertCanManage(client, currentUser, lock.dependencia_id);
      if (lock.estado !== 'BLOQUEADO') {
        throw new HttpError(409, 'Solo se pueden anular bloqueos activos; los resueltos son historial');
      }
      await lockRepository.remove(client, id);
      return { ok: true, mensaje: 'Bloqueo anulado correctamente' };
    });
  }
}

module.exports = new LockService();
