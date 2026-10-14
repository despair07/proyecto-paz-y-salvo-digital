const database = require('../config/database');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function areaScopeMiddleware({ requestedDependencyId } = {}) {
  return async (req, res, next) => {
    try {
      const requestedId = requestedDependencyId ? requestedDependencyId(req) : null;
      if (requestedId && !UUID_PATTERN.test(requestedId)) {
        throw new HttpError(400, 'El identificador de dependencia no es válido');
      }

      const dependencyIds = await database.withUserContext(
        req.user,
        'Consulta de asignaciones de dependencia',
        (client) => userRepository.listAssignedDependencyIds(client, req.user.id)
      );
      if (!dependencyIds.length) {
        throw new HttpError(403, 'No tiene dependencias asignadas para gestionar');
      }
      if (requestedId && !dependencyIds.includes(requestedId)) {
        throw new HttpError(403, 'No tiene asignada la dependencia indicada');
      }

      req.areaDependencias = dependencyIds;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = areaScopeMiddleware;
