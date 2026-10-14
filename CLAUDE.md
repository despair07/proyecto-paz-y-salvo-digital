# Paz & Salvo Digital Uniautónoma

Sistema web del paz y salvo de retiro (formato GTH-07) de la Corporación Universitaria Autónoma del Cauca. Frontend React 19 + Vite + Tailwind 3 (`paz-y-salvo-frontend/`), backend Express 5 + JWT + Supabase PostgreSQL (`paz-y-salvo-backend/`), SQL en `database/`.

## Antes de tocar código

1. Lee `.agents/skills/context/project-context.md` (producto, roles, rutas, reglas RN-001…RN-011) y `.agents/skills/architecture/rules.md`.
2. Usa las skills de `.claude/skills/` según la tarea: `desarrollo`, `testing`, `seguridad`, `git`, `ux-heuristicas`, `supabase`, etc. La copia fuente y el contexto viven en `.agents/skills/`.
3. Tailwind es **v3** (no v4); JavaScript, no TypeScript; commits en español con `PYS-XXX`.

## Comandos

- Backend: `cd paz-y-salvo-backend && npm run dev` (puerto 3000) · `npm test`
- Frontend: `cd paz-y-salvo-frontend && npm run dev` (puerto 5173) · `npm run build`
- Lint: no configurado (PYS-T01)

## Reglas duras

- Las reglas de negocio viven en `src/services/` del backend y cada una tiene test.
- Todo dato vive en Supabase (no hay modo demo). `seed_demo.sql` solo en desarrollo; nunca subir `.env`.
- Los tokens de color vienen del Figma aprobado por el cliente (`tailwind.config.js`).
