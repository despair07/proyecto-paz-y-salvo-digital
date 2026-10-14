# Herramientas del Proyecto

Trabajar desde `paz-y-salvo-backend` (API) o `paz-y-salvo-frontend` (UI).

## Comandos

| Acción | Comando |
|---|---|
| Desarrollo | `npm run dev` (en cada app) |
| Build | `npm run build` (frontend) |
| Lint | no configurado (PYS-T01) |
| Tests | `npm test` (backend) |

Backend: `npm start`, `npm run seed`, `npm run setup-db` (sube `database/ddl.sql` y seeds a Supabase). Frontend: `npm run preview`.

## Librerías clave

- axios — cliente HTTP; react-router-dom — rutas por rol.
- zod — validación de DTOs; jsonwebtoken/bcryptjs — sesión; google-auth-library — SSO.
- pdf-lib + qrcode — certificado PDF con QR; pg — PostgreSQL/Supabase.
- jest + supertest — pruebas del backend.

## Variables de entorno

Backend: `PORT`, `DB_HOST/PORT/NAME/USER/PASSWORD/SSL`, `DB_POOL_MAX`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`, `API_PUBLIC_URL`, `FRONTEND_PUBLIC_URL`, . Frontend: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ENABLE_DEMO_LOGIN`.

## Hosting / despliegue

no definido aún (PENDIENTE: PYS-T04)
