# Especialización de Agentes — Paz & Salvo Digital Uniautónoma

Plantilla. `project-setup` ajusta las rutas reales y elimina los roles que no apliquen.

## Frontend UI Agent
Componentes, responsive, accesibilidad y consistencia visual.
- Revisa: `paz-y-salvo-frontend/src/pages/` (por rol), `src/components/`, `tailwind.config.js`, `src/assets/styles/index.css`, `.agents/skills/frontend/`
- Skills: `frontend-design`, `ux-heuristicas`, `animation-creator`

## Responsive Agent
Vista móvil del trabajador y de la verificación pública por QR (no hay app nativa).
- Revisa: `src/components/layout/`, breakpoints de Tailwind
- Skills: `ux-heuristicas` (ítems 📱), `testing`

## Logic / Data Agent
Servicios, estado, integraciones y reglas de negocio.
- Revisa: frontend `src/services/`, `src/context/`, `src/hooks/`; backend `src/{routes,controllers,services,repositories,dtos,middlewares}/`; reglas RN en `context/project-context.md`
- Skills: `desarrollo`, `seguridad`, `supabase`, `supabase-postgres-best-practices`

## QA Agent
Pruebas, evaluación heurística y verificación antes de cerrar tareas.
- Skills: `testing`, `ux-heuristicas`

## Deploy Agent
Build, variables de entorno y publicación (no definido aún (PENDIENTE: PYS-T04)).
- Revisa: `package.json` de ambas apps, `.env.example` de ambas, `database/ddl.sql`, `scripts/setup-db.js`
- Skills: `seguridad`, `testing`
