require('dotenv').config();

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  PORT: positiveInteger(process.env.PORT, 3000),
  DB: {
    HOST: process.env.DB_HOST,
    PORT: positiveInteger(process.env.DB_PORT, 5432),
    NAME: process.env.DB_NAME || 'postgres',
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    SSL: process.env.DB_SSL !== 'false',
    POOL_MAX: positiveInteger(process.env.DB_POOL_MAX, 8),
    CONNECTION_TIMEOUT_MS: positiveInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 5000),
    IDLE_TIMEOUT_MS: positiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 10000),
  },
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  },
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  API_PUBLIC_URL: (process.env.API_PUBLIC_URL || `http://localhost:${positiveInteger(process.env.PORT, 3000)}/api/v1`).replace(/\/$/, ''),
  FRONTEND_PUBLIC_URL: (process.env.FRONTEND_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
