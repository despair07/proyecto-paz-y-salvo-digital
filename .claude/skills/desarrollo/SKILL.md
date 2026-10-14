---
name: desarrollo
description: Convenciones de código, stack, estructura y criterio de commits de Paz & Salvo Digital Uniautónoma. Úsala antes de escribir o revisar código en este repo.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Desarrollo — Paz & Salvo Digital Uniautónoma

## Stack

React 19 + Vite 8 + Tailwind 3 + React Router 7 + Axios (frontend, JavaScript); Express 5 + JWT + Zod + pdf-lib/qrcode sobre PostgreSQL/Supabase (backend, Node 20, CommonJS); Jest + Supertest

- Frontend: React 19, React Router 7, Vite 8, Tailwind 3.4, Axios; JavaScript/JSX (ES modules). Sin linter ni tests.
- Backend: Node 20, Express 5, `pg`, Zod 4, `jsonwebtoken`, `bcryptjs`, `pdf-lib`, `qrcode`; CommonJS. Tests con Jest 30 + Supertest.

## Scripts

Trabajar dentro de `paz-y-salvo-backend` (API) o `paz-y-salvo-frontend` (UI) según el cambio:

```bash
npm run dev      # ambas apps: desarrollo
npm run build    # frontend: build de producción
npm test         # backend: tests (Jest)
# lint: no configurado (PYS-T01)
```

## Estructura de carpetas

Ver árbol completo en `architecture/rules.md`.

> No muevas archivos existentes sin una tarea explícita.

## Convenciones

- Componentes en PascalCase; utilidades y hooks en camelCase.
- Usar los tokens de `paz-y-salvo-frontend/tailwind.config.js` + `paz-y-salvo-frontend/src/assets/styles/index.css` antes de inventar valores.
- Secretos solo en variables de entorno; recordar que las variables públicas del cliente (`VITE_*`, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) quedan expuestas en el bundle.
- Nombres de dominio en español (`bloqueos`, `tramites`, `dependencias`); API en `/api/v1` con rutas en español.
- Roles exactos como en `src/utils/roles.js` (p. ej. `Encargado de Área`); no escribir strings de rol sueltos.
- Toda regla RN nueva o modificada lleva su test en `paz-y-salvo-backend/tests/`.
- Validar entradas con DTOs Zod en backend; nunca confiar en la validación del cliente.

## Patrones permitidos

- Controllers delgados, lógica en services, SQL solo en repositories.
- Autorización con `rbac.middleware` + `areaScope.middleware` (RN-004).
- Estado de sesión vía `AuthContext`/`useAuth`; rutas protegidas con `ProtectedRoute allowedRoles`.

## Patrones prohibidos

- No usar `eval()` ni `new Function()` con datos del usuario.
- No guardar secretos en el repositorio.
- No aprobar ni emitir certificado sin pasar por las validaciones RN-005, RN-006 y RN-010.
- No consultar la BD fuera de `repositories/`.
- No activar `DEMO_MODE` ni `DEMO_AUTH_ENABLED` en producción.

## Criterio de commits

Ver la skill `git` (ramas, formato `<tipo>(<módulo>): <descripción> (PYS-XXX)` y mensajes prohibidos).

## Antes de entregar

- [ ] Lint: no configurado aún (PYS-T01); revisar a mano estilo y imports.
- [ ] `npm test` (backend) pasa (o está documentado por qué no aplica).
- [ ] `npm run build` (frontend) termina correctamente.
- [ ] No se agregaron dependencias sin justificar.
- [ ] Si se tocó UI: verificación visual en desktop y móvil + checklist mínimo de `ux-heuristicas`.
