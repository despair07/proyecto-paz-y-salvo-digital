// Cabeceras de seguridad, límite de peticiones y validación de la configuración de producción
process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';

const express = require('express');
const request = require('supertest');
const { securityHeaders, rateLimit } = require('../src/middlewares/security.middleware');
const errorHandler = require('../src/middlewares/errorHandler.middleware');
const { problemasDeProduccion } = require('../src/config/validateEnv');

function appConLimite(max) {
  const app = express();
  app.use(securityHeaders);
  app.use(rateLimit({ windowMs: 60000, max }));
  app.get('/ping', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('Cabeceras de seguridad y límite de peticiones', () => {
  const previo = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = 'development'; });
  afterAll(() => { process.env.NODE_ENV = previo; });

  it('agrega las cabeceras y no anuncia Express', async () => {
    const res = await request(appConLimite(10)).get('/ping');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
    const https = await request(appConLimite(10)).get('/ping').set('X-Forwarded-Proto', 'https');
    expect(https.headers['strict-transport-security']).toMatch(/max-age/);
  });

  it('responde 429 con Retry-After al pasar el límite', async () => {
    const app = appConLimite(2);
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    const res = await request(app).get('/ping');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body.mensaje).toMatch(/Demasiadas solicitudes/);
  });
});

describe('Validación de la configuración de producción', () => {
  const buena = {
    DB: { HOST: 'db.example.com', USER: 'app', PASSWORD: 'x', SSL: true },
    JWT: { SECRET: 'a'.repeat(40) },
    GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
    CORS_ORIGINS: ['https://pazysalvo.uniautonoma.edu.co'],
    FRONTEND_PUBLIC_URL: 'https://pazysalvo.uniautonoma.edu.co',
    API_PUBLIC_URL: 'https://api.pazysalvo.uniautonoma.edu.co/api/v1',
  };
  const fuente = { CORS_ORIGINS: 'x', FRONTEND_PUBLIC_URL: 'x', API_PUBLIC_URL: 'x' };

  it('acepta una configuración completa', () => {
    expect(problemasDeProduccion(buena, fuente)).toEqual([]);
  });

  it('detecta secretos débiles, contraseñas habilitadas y URLs locales', () => {
    const mala = {
      ...buena,
      JWT: { SECRET: 'corto' },
      CORS_ORIGINS: ['http://localhost:5173'],
      FRONTEND_PUBLIC_URL: 'http://localhost:5173',
      API_PUBLIC_URL: 'http://localhost:3000/api/v1',
      DB: { ...buena.DB, SSL: false },
    };
    const problemas = problemasDeProduccion(mala, { ...fuente, AUTH_PASSWORD_ENABLED: 'true' });
    expect(problemas.join(' ')).toMatch(/JWT_SECRET/);
    expect(problemas.join(' ')).toMatch(/AUTH_PASSWORD_ENABLED/);
    expect(problemas.join(' ')).toMatch(/CORS_ORIGINS/);
    expect(problemas.join(' ')).toMatch(/FRONTEND_PUBLIC_URL/);
    expect(problemas.join(' ')).toMatch(/API_PUBLIC_URL/);
    expect(problemas.join(' ')).toMatch(/DB_SSL/);
  });
});
