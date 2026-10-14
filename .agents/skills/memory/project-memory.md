# Memoria del Proyecto — Paz & Salvo Digital Uniautónoma

Memoria viva: decisiones, riesgos y aprendizajes que deben sobrevivir entre sesiones.

## Estado actual

- Sprint 1 cerrado (commit `0662681 Primer sprint`). Sprints 2 y 3 hasta el 15-nov-2026.
- Backend Express en `paz-y-salvo-backend/` (capas routes → controllers → services → repositories, DTOs Zod, middlewares de auth/RBAC/ámbito de área).
- Frontend React + Vite + Tailwind v3 en `paz-y-salvo-frontend/` (páginas por rol en `src/pages/`).
- DDL y seeds en `database/`; propuestas de cambio en `database/PROPUESTAS_CAMBIO_BD.md`.
- Modo demo en memoria (`demoStore.js`) habilitado por defecto en local.

## Decisiones tomadas

- 2026-10-14 — Los tokens Figma aprobados por el cliente (Sección 8.1) prevalecen sobre la paleta anterior `uni-*` (que se conserva como alias). Motivo: aprobación del cliente.
- 2026-10-14 — Se mantiene Tailwind v3; no migrar a v4 sin decisión explícita.
- 2026-10-14 — Prefijo de tareas `PYS`; commits en español con Conventional Commits; una sola rama `main` (equipo de 2).

## Riesgos conocidos

- Token JWT en `localStorage` (`pys_token`) — expuesto ante XSS — evaluar cookie httpOnly (PYS-T03).
- Backend sin `helmet` ni rate limiting en login — superficie de ataque — PYS-T03.
- `DEMO_MODE`/`DEMO_AUTH_ENABLED` deben quedar en `false` en producción (TODO-PROD-01).
- RLS de Supabase aún no habilitado (TODO-RLS-01).
- Proyecto Supabase gratuito se pausa tras 7 días sin uso.

## Pendientes del setup de skills

- PYS-T01 — Configurar ESLint en frontend y backend (hoy no hay script `lint`).
- PYS-T02 — Configurar tests de frontend (Vitest + Testing Library); hoy solo hay tests en backend.
- PYS-T03 — Endurecer seguridad: `helmet`, CSP, rate limit en `/auth/login`, revisar almacenamiento del token.
- PYS-T04 — Definir hosting y despliegue de API y UI.

## Próximos candidatos de mejora

- Resolver TODO-BD-01 / TODO-BD-02 (informe en JSONB vs tabla; `etapa_actual`).

## Registro

- Kit de skills adaptado con `project-setup` (fecha: 2026-10-14).
