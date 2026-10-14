const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const env = require('./config/env');
const HttpError = require('./utils/httpError');
const errorHandler = require('./middlewares/errorHandler.middleware');

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || (env.CORS_ORIGINS && env.CORS_ORIGINS.includes(origin))) {
      return callback(null, true);
    }
    return callback(new HttpError(403, 'Origen no permitido por la política CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Paz & Salvo Digital Uniautónoma — API REST',
    version: '1.0.0',
    description: 'Especificación oficial de endpoints REST (/api/v1/) para el trámite institucional de paz y salvo y entrega de cargo (formato GTH-07).',
    contact: {
      name: 'Corporación Universitaria Autónoma del Cauca',
      email: 'soporte.dti@uniautonoma.edu.co',
    },
  },
  servers: [
    { url: '/api/v1', description: 'Servidor API v1' },
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'Inicio de sesión institucional (correo y contraseña o Google Workspace SSO)',
        responses: {
          '200': { description: 'Token JWT y datos del usuario emitidos con éxito' },
          '401': { description: 'Acceso restringido a personal institucional (@uniautonoma.edu.co)' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Obtiene el perfil del usuario autenticado, roles y dependencias asignadas',
        responses: { '200': { description: 'Datos del usuario' } },
      },
    },
    '/paz-y-salvo/mi-estado': {
      get: {
        summary: 'Consulta de estado global (AL_DIA/EN_PROCESO) y detalle de las 8 dependencias evaluadoras',
        responses: { '200': { description: 'Resumen consolidado' } },
      },
    },
    '/bloqueos': {
      get: {
        summary: 'Lista bloqueos registrados con filtros (?dependencia, ?estado, ?categoria, ?q)',
        responses: { '200': { description: 'Lista paginada de bloqueos' } },
      },
      post: {
        summary: 'Registra un nuevo bloqueo asociando categoría obligatoria y motivo (RN-003, RN-009)',
        responses: { '201': { description: 'Bloqueo registrado' } },
      },
    },
    '/bloqueos/{id}': {
      get: { summary: 'Detalle de un bloqueo por ID', responses: { '200': { description: 'OK' } } },
      put: { summary: 'Levanta bloqueo (RESUELTO) o edita observación sin borrar historial (RF-003)', responses: { '200': { description: 'OK' } } },
      delete: { summary: 'Anula bloqueo registrado por error', responses: { '200': { description: 'OK' } } },
    },
    '/desarrollo-profesoral/docentes/{id}': {
      get: { summary: 'Consulta evaluación de los 3 entregables docentes', responses: { '200': { description: 'OK' } } },
      put: { summary: 'Registra los 3 booleanos de entregables: planes_aula, innovaciones, informes (RN-007, RF-008)', responses: { '200': { description: 'OK' } } },
    },
    '/tramites/pendientes-aprobacion': {
      get: { summary: 'Solicitudes con 0 bloqueos e informe completo listas para revisión final de Comunidad Universitaria (RF-005)', responses: { '200': { description: 'OK' } } },
    },
    '/tramites/{id}/aprobar': {
      post: { summary: 'Aprobación final o rechazo motivado del trámite (RN-002, RN-005, RN-010)', responses: { '200': { description: 'OK' } } },
    },
    '/tramites/habilitar': {
      post: { summary: 'Habilitación de autoservicio del trámite por el propio trabajador (RF-009)', responses: { '201': { description: 'OK' } } },
    },
    '/tramites/{id}/informe-entrega-cargo': {
      get: { summary: 'Obtiene las 8 secciones del informe de entrega de cargo', responses: { '200': { description: 'OK' } } },
      put: { summary: 'Guarda borrador o finaliza el informe de entrega de cargo (RF-010)', responses: { '200': { description: 'OK' } } },
    },
    '/certificados': {
      post: { summary: 'Genera certificado PDF con código QR verificable (RN-006, RF-006)', responses: { '201': { description: 'OK' } } },
    },
    '/certificados/verificar/{token}': {
      get: { summary: 'Verificación pública de autenticidad del certificado mediante escaneo QR (sin autenticación)', responses: { '200': { description: 'OK' } } },
    },
    '/certificados/{token}/pdf': {
      get: { summary: 'Descarga directa del archivo PDF del certificado generado', responses: { '200': { description: 'PDF stream' } } },
    },
    '/dependencias': {
      get: { summary: 'Catálogo de dependencias institucionales', responses: { '200': { description: 'OK' } } },
    },
    '/cargos': {
      get: { summary: 'Catálogo de cargos', responses: { '200': { description: 'OK' } } },
    },
    '/cargos/{id}': {
      put: { summary: 'Renombra un cargo del catálogo (solo Administrador DTI, RN-011)', responses: { '200': { description: 'OK' } } },
    },
    '/usuarios': {
      get: { summary: 'Búsqueda de usuarios por cédula, nombre o correo (?q, ?conTramite=true)', responses: { '200': { description: 'OK' } } },
    },
    '/usuarios/{id}': {
      put: { summary: 'Actualización de cargo por Administrador DTI (RN-011)', responses: { '200': { description: 'OK' } } },
    },
  },
};

app.get('/api/docs', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Documentación API — Paz & Salvo Digital Uniautónoma</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0A2540; font-family: Inter, system-ui, sans-serif; }
    .topbar { background: #0A2540; padding: 12px 24px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #D97706; }
    .topbar h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .topbar span { font-size: 0.85rem; color: #D97706; }
    #swagger-ui { background: #FFFFFF; max-width: 1200px; margin: 20px auto; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 10px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Paz & Salvo Digital Uniautónoma · Documentación OpenAPI</h1>
    <span>Versión 1.0.0 (GTH-07)</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        spec: ${JSON.stringify(swaggerDocument)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`);
});

app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use('/api/v1', routes);

app.use(errorHandler);

module.exports = app;
