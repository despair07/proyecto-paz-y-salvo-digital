const HttpError = require('../utils/httpError');

const CONNECTION_ERRORS = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', '57P01', '08006', '08001']);

// Las reglas de negocio de la base (RN-xxx) se lanzan con RAISE EXCEPTION y llevan un mensaje
// pensado para el usuario; los errores genéricos de PostgreSQL no se exponen.
function isBusinessRuleError(error) {
  return error.routine === 'exec_stmt_raise' && typeof error.message === 'string';
}

function normalizeError(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      details: error.details,
    };
  }

  if (CONNECTION_ERRORS.has(error.code) || /timeout exceeded when trying to connect/i.test(error.message || '')) {
    return { status: 503, message: 'La base de datos no está disponible. Intente nuevamente en unos minutos.', details: [] };
  }

  switch (error.code) {
    case '42501':
      return {
        status: 403,
        message: isBusinessRuleError(error) ? error.message : 'No tiene permisos para esta acción.',
        details: [],
      };
    case '23505':
      return { status: 409, message: 'El registro ya existe.', details: [] };
    case '23503':
      return { status: 409, message: 'El registro está relacionado con otros datos.', details: [] };
    case '23514':
      return {
        status: 409,
        message: isBusinessRuleError(error) ? error.message : 'La operación incumple una regla del trámite.',
        details: [],
      };
    case '22P02':
      return { status: 400, message: 'Uno o más identificadores no son válidos.', details: [] };
    default:
      return {
        status: Number.isInteger(error.status) ? error.status : 500,
        message: Number.isInteger(error.status) && error.status < 500
          ? error.message
          : 'Error interno del servidor.',
        details: error.details || [],
      };
  }
}

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const normalized = normalizeError(error);
  if (normalized.status >= 500) {
    console.error('Request failed', error.code || error.name || 'Error', error.message || '');
  }
  return res.status(normalized.status).json({
    error: true,
    codigo: normalized.status,
    mensaje: normalized.message,
    detalles: normalized.details,
  });
};

module.exports = errorHandler;
