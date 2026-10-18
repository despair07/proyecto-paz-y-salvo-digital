// ============================================================================
// SERVICIO DE BLOQUEOS (solo consulta: historial de lo que observó cada dependencia)
// Los bloqueos se registran al bloquear una solicitud (review.service) y se resuelven solos cuando la
// dependencia aprueba. RN-004: cada rol ve lo suyo. RN-011: el Administrador DTI no los consulta.
// ============================================================================

const database = require('../config/database');
const lockRepository = require('../repositories/lock.repository');
const userRepository = require('../repositories/user.repository');
const { ROLES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const AREA_ROLES = [ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO];

class LockService {
  // Alcance de lectura según el rol
  async resolveScope(client, currentUser) {
    if (hasRole(currentUser.roles, [ROLES.APROBADOR])) return {};
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
}

module.exports = new LockService();
