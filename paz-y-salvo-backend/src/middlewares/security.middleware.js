// ============================================================================
// SEGURIDAD BÁSICA DE LA API (sin dependencias externas)
//  · Cabeceras de seguridad en todas las respuestas.
//  · Límite de peticiones por IP en memoria (suficiente para una sola instancia; si se escala a
//    varias réplicas, mover el contador a un almacén compartido).
// ============================================================================

const HttpError = require('../utils/httpError');

// La API solo devuelve JSON (y el PDF del certificado): nada debe incrustarse ni interpretarse como HTML
function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// rateLimit({ windowMs, max, mensaje }): responde 429 al pasar `max` peticiones por IP en la ventana
function rateLimit({ windowMs, max, mensaje = 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' }) {
  const hits = new Map();

  // Limpieza periódica para que el mapa no crezca sin límite
  const timer = setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, key) => { if (entry.reset <= now) hits.delete(key); });
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_IN_TESTS) return next();
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'desconocida';
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return next(new HttpError(429, mensaje));
    }
    return next();
  };
}

module.exports = { securityHeaders, rateLimit };
