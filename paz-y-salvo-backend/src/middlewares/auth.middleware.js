const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ROLES } = require('../utils/roles');

const VALID_ROLES = new Set(Object.values(ROLES));

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      codigo: 401,
      mensaje: 'No autorizado. Token requerido.',
      detalles: [],
    });
  }

  if (!env.JWT.SECRET || Buffer.byteLength(env.JWT.SECRET, 'utf8') < 32) {
    return next(new Error('La configuración JWT del servidor no es válida'));
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        error: true,
        codigo: 401,
        mensaje: 'No autorizado. Token requerido.',
        detalles: [],
      });
    }

    const decoded = jwt.verify(token, env.JWT.SECRET, {
      algorithms: ['HS256'],
      issuer: 'paz-y-salvo-digital',
      audience: 'paz-y-salvo-web',
    });

    if (
      typeof decoded.id !== 'string'
      || !Array.isArray(decoded.roles)
      || !decoded.roles.every((role) => typeof role === 'string' && VALID_ROLES.has(role))
    ) {
      return res.status(401).json({
        error: true,
        codigo: 401,
        mensaje: 'La sesión no contiene un perfil válido.',
        detalles: [],
      });
    }

    req.user = {
      id: decoded.id,
      correo_institucional: decoded.correo_institucional,
      roles: decoded.roles,
      nombre_completo: decoded.nombre_completo || null,
      dependencia_id: decoded.dependencia_id || null,
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      error: true,
      codigo: 401,
      mensaje: 'Token inválido o expirado.',
      detalles: [],
    });
  }
};

module.exports = authMiddleware;
