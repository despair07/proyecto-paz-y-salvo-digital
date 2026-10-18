// ============================================================================
// VALIDACIÓN DE CONFIGURACIÓN PARA PRODUCCIÓN
// En producción el servidor no arranca con una configuración insegura o incompleta.
// ============================================================================

const LOCAL = /localhost|127\.0\.0\.1|\[::1\]/i;

function problemasDeProduccion(config, source = process.env) {
  const problemas = [];
  const faltan = (nombre, valor) => { if (!valor) problemas.push(`Falta ${nombre}`); };

  faltan('DB_HOST', config.DB.HOST);
  faltan('DB_USER', config.DB.USER);
  faltan('DB_PASSWORD', config.DB.PASSWORD);
  faltan('GOOGLE_CLIENT_ID', config.GOOGLE_CLIENT_ID);

  if (!config.JWT.SECRET || Buffer.byteLength(config.JWT.SECRET, 'utf8') < 32) {
    problemas.push('JWT_SECRET debe ser un valor aleatorio de al menos 32 bytes');
  }
  if (source.AUTH_PASSWORD_ENABLED === 'true') {
    problemas.push('AUTH_PASSWORD_ENABLED debe estar en false (el acceso con contraseña es solo para desarrollo)');
  }
  if (!config.DB.SSL) problemas.push('DB_SSL no debe desactivarse en producción');
  if (!source.CORS_ORIGINS || config.CORS_ORIGINS.every((o) => LOCAL.test(o))) {
    problemas.push('CORS_ORIGINS debe listar el dominio público del frontend');
  }
  if (!source.FRONTEND_PUBLIC_URL || LOCAL.test(config.FRONTEND_PUBLIC_URL)) {
    problemas.push('FRONTEND_PUBLIC_URL debe ser la URL pública del frontend (se usa en el QR del certificado)');
  }
  if (!source.API_PUBLIC_URL || LOCAL.test(config.API_PUBLIC_URL)) {
    problemas.push('API_PUBLIC_URL debe ser la URL pública de la API');
  }
  return problemas;
}

module.exports = { problemasDeProduccion };
