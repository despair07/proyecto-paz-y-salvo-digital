# Paz y Salvo Digital - Backend

API Express con autenticación Google Workspace/JWT, PostgreSQL con RLS, flujo de solicitudes, revisiones de área, entregables docentes, aprobación y certificados PDF/QR.

## Requisitos y configuración

- Node.js 20 o superior y npm.
- Esquema vigente creado desde `../db.txt` en una base PostgreSQL/Supabase de pruebas.
- Usuario PostgreSQL de backend con permiso para asumir `authenticated`.
- Variables locales configuradas en `.env`; no publiques este archivo.

Instala dependencias, copia `.env.example` a `.env` solo si no existe y completa la conexión, un `JWT_SECRET` aleatorio de al menos 32 bytes, el Google OAuth Web Client ID y `CORS_ORIGINS`. Mantén `DB_SSL=true` con Supabase; configura `API_PUBLIC_URL` para la API y `FRONTEND_PUBLIC_URL` para la página pública de validación QR. Luego ejecuta `npm run dev`; API: `http://localhost:3000/api/v1`.

Al arrancar, el servidor muestra si la base conectó y cuántas tablas, usuarios y trámites encontró. El esquema se crea con `npm run setup-db -- --reset` (`database/ddl.sql` + seeds).

## Autenticación

- `POST /auth/login`: recibe `{ "email", "password" }` (contraseña verificada con bcrypt contra `usuarios.password_hash`) o `{ "googleToken": "<Google ID token>" }` (valida audiencia, firma, correo verificado, dominio, usuario activo y roles).
- `GET /auth/me`: consulta el perfil del JWT vigente.

El cierre de sesión elimina el JWT local; los tokens emitidos siguen vigentes hasta su expiración.

## Flujo principal

- `POST /tramites/mine`, `GET /tramites/mine`: crear y listar las solicitudes propias.
- `GET/PUT /tramites/:solicitudId/informe`: guardar borrador y enviar el informe GTH-07 de ocho secciones.
- `GET /areas`, `PUT /areas/solicitudes/:solicitudId/veredicto`: bandeja y veredicto limitado a asignaciones.
- `GET/POST /bloqueos`, `PATCH /bloqueos/:id/resolve`: consultar, registrar y resolver bloqueos categorizados.
- `GET/POST /docentes/:solicitudId/entregables`: consultar/evaluar los tres requisitos de Desarrollo Profesoral.
- `GET /tramites/pendientes-aprobacion`, `POST /tramites/:id/aprobar`: bandeja elegible y decisión exclusiva de Comunidad Universitaria.
- `GET /certificados/mine`, `GET /certificados/:token/pdf`: listar/descargar certificados emitidos.
- `GET /certificados/verificar/:token`: validación pública por hash del token QR.
- `GET /usuarios`, `GET/PUT /catalogos/cargos/:id`: consultas DTI y actualización del nombre del cargo según las políticas actuales.

Las operaciones de negocio autenticadas usan transacciones con `SET LOCAL ROLE authenticated`, `app.user_id` y `app.audit_reason`. No se aceptan identificadores de usuario del cliente como autoridad.

## Pruebas

```powershell
npm test -- --runInBand
```

El recorrido manual completo, incluida la preparación de cuentas y verificación QR, está en `../MANUAL_TESTING.md`.
