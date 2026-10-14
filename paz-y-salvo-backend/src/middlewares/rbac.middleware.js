const { hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

function rbacMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'No autenticado'));
    }
    if (!hasRole(req.user.roles, allowedRoles)) {
      return next(new HttpError(403, 'No tiene permisos para esta acción'));
    }
    return next();
  };
}

module.exports = rbacMiddleware;
