# Reglas de Arquitectura — Paz & Salvo Digital Uniautónoma

## Principios

- Mantener la arquitectura actual (React 19 + Vite 8 + Tailwind 3 + React Router 7 + Axios (frontend, JavaScript); Express 5 + JWT + Zod + pdf-lib/qrcode sobre PostgreSQL/Supabase (backend, Node 20, CommonJS); Jest + Supertest) mientras no haya una necesidad real de cambiarla; los cambios grandes se registran en `memory/`.
- Una responsabilidad por módulo/componente. Si un archivo mezcla UI, lógica de negocio y acceso a datos, extraer progresivamente.
- Si una regla, patrón o instrucción se vuelve repetitiva, documentarla en `.agents/skills/`.

## Estructura de carpetas

```
paz y salvo/
├── database/                 DDL, seeds y propuestas de cambio de BD
├── paz-y-salvo-backend/
│   ├── server.js             arranque
│   ├── src/app.js            Express, CORS, rutas
│   ├── src/routes/           definición de endpoints (/api/v1)
│   ├── src/controllers/      HTTP: leer request, responder
│   ├── src/services/         reglas de negocio (RN-001…RN-011), PDF, certificados
│   ├── src/repositories/     acceso a datos (pg / demoStore)
│   ├── src/dtos/             validación Zod y mapeo de entrada/salida
│   ├── src/middlewares/      auth JWT, RBAC, ámbito por dependencia, errores
│   ├── src/config/           env, base de datos, credenciales demo
│   ├── src/data/             demoStore en memoria (DEMO_MODE)
│   └── tests/                Jest + Supertest
└── paz-y-salvo-frontend/src/
    ├── pages/                una carpeta por rol (user, area-manager, approver, admin, auth, certificates)
    ├── components/           common/ y layout/
    ├── context/ + hooks/     AuthContext, LockContext, useAuth, useLocks, usePDF
    ├── services/             api.js (axios) y servicios por dominio
    └── routes/               AppRoutes y ProtectedRoute (por rol)
```

Flujo backend: `route → middlewares (auth, rbac, areaScope) → controller → service → repository`. Las reglas de negocio viven **solo en services**.

## Datos y servicios

- Frontend → `src/services/api.js` (axios con `VITE_API_URL`, agrega el JWT) → API REST `/api/v1`.
- Backend → `repositories/` es el único lugar con SQL; con `DEMO_MODE=true` usan `demoStore` en memoria, con `false` Supabase PostgreSQL.
- Errores con `utils/httpError.js` y `errorHandler.middleware.js`; el frontend muestra estados vacío/cargando/error en cada dashboard.

## Seguridad

- Ver la skill `seguridad`.
- Ningún secreto en el código del cliente. Las claves de APIs de pago van detrás de un backend/proxy.

## UI

- Seguir `frontend/` y la skill `ux-heuristicas`.
- Usar los tokens de `paz-y-salvo-frontend/tailwind.config.js` + `paz-y-salvo-frontend/src/assets/styles/index.css` antes de crear colores, sombras o radios nuevos.
- Accesibilidad: contraste, labels, foco visible, texto alternativo y navegación por teclado/lector de pantalla.

## Calidad

- Lint aún no configurado (PYS-T01); `npm test` en el backend antes de cerrar cambios de lógica.
- `npm run build` en el frontend cuando se toquen rutas, imports, configuración o dependencias.
- Revisión manual de las pantallas afectadas en desktop y móvil.
