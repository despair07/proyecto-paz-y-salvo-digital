---
name: seguridad
description: Validación de inputs, manejo de secretos, dependencias, autenticación y headers de seguridad de Paz & Salvo Digital Uniautónoma. Úsala al tocar formularios, APIs, variables de entorno, autenticación o configuración de despliegue.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Seguridad — Paz & Salvo Digital Uniautónoma

## Secretos y variables de entorno

- Los archivos `.env` nunca se suben al repo (verificar `.gitignore`).
- Toda variable nueva se documenta en `.env.example` con un valor vacío o de ejemplo.
- **Regla crítica:** las variables públicas del cliente (`VITE_*`, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, o las que van dentro de la app móvil) las puede leer cualquiera. Las claves de APIs de pago o privilegiadas van en un backend/función serverless.
- Backend (`.env`): `DB_*`, `JWT_SECRET` (≥ 32 bytes), `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`, `DEMO_*`. Nunca exponerlas al frontend.
- Frontend: solo `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` (público por diseño) y `VITE_ENABLE_DEMO_LOGIN`.
- `DEMO_MODE`, `DEMO_AUTH_ENABLED` y `DEMO_LOGIN_*` deben estar en `false`/vacíos en producción.

## Validación de inputs

- Validar en el cliente (UX, H5) **y** en el servidor (seguridad).
- No usar `eval()`/`new Function()` con datos del usuario.
- Sanitizar todo contenido que se renderice como HTML; no usar `dangerouslySetInnerHTML`/`v-html` con datos sin sanitizar.

## Autenticación y autorización

- Login propio con JWT (`auth.service.js`, expira con `JWT_EXPIRES_IN`) y Google SSO (dominio `uniautonoma.edu.co`).
- Roles verificados en backend con `rbac.middleware`; el aislamiento por dependencia (RN-004) con `areaScope.middleware`.
- Estado actual: el token se guarda en `localStorage` (`pys_token`). Riesgo ante XSS: no renderizar HTML sin sanitizar; evaluar cookie httpOnly (PYS-T03).
- La verificación pública de certificados (`/certificados/verificar/:token`) no requiere login: no exponer más datos personales de los necesarios.

## Headers / CSP (web)

Hoy no hay CSP ni `helmet` configurados. Pendiente PYS-T03: `helmet` en `src/app.js`, CSP para el frontend y rate limit en `/auth/login`.

- No relajar la CSP ni los headers "para que funcione" sin documentar el riesgo.

## Móvil (si aplica)

- Permisos mínimos y solicitados en contexto.
- HTTPS obligatorio; nada de tráfico en texto plano.
- No registrar (log) datos sensibles.

## Dependencias

- Antes de agregar una dependencia, revisar si ya existe una que resuelva el problema, y su mantenimiento y reputación.
- Ejecutar `npm audit` (o el equivalente del stack) periódicamente.

## Acciones prohibidas

- Exponer claves de API en el bundle del cliente.
- Desactivar protecciones (StrictMode, CSP, validaciones) sin justificar y registrar el motivo.
