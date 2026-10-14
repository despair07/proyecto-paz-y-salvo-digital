# Skills del proyecto — Paz & Salvo Digital Uniautónoma

Kit de skills adaptado a este repo. Las skills viven en `.agents/skills/` (y se exponen a Claude Code en `.claude/skills/`).

## Proyecto

**Paz & Salvo Digital Uniautónoma** — trámite digital del paz y salvo de retiro / entrega de cargo (formato GTH-07) de la Corporación Universitaria Autónoma del Cauca, con revisión por dependencias, aprobación final y certificado PDF verificable por QR.
Plataforma: web responsive · Stack: React 19 + Vite 8 + Tailwind 3 (UI) · Express 5 + JWT + PostgreSQL/Supabase (API)

## Estructura

| Carpeta | Tipo | Qué es |
|---|---|---|
| `project-setup/` | skill | Adaptación del kit (ya ejecutada) |
| `ux-heuristicas/` | skill | Heurísticas de Nielsen, checklists y métricas de usabilidad |
| `project-manager/` | skill | Tablero de tareas, specs (`ia_contexto/`) e historial |
| `git/` | skill | Ramas, Conventional Commits con `PYS-XXX`, PR y reversión |
| `desarrollo/`, `testing/`, `seguridad/` | skill | Convenciones, verificación y seguridad del proyecto |
| `supabase/`, `supabase-postgres-best-practices/` | skill | Supabase y PostgreSQL |
| `frontend-design/`, `frontend-aesthetics/` | skill | Dirección estética y calidad visual |
| `animation-creator/`, `css-inspector/` | skill | Animaciones CSS y depuración de cascada |
| `tailwind-css-patterns/` | skill | Patrones Tailwind (escrita para v4; el proyecto usa v3) |
| `typescript-advanced-types/` | skill | Diferida (el proyecto es JavaScript) |
| `context/`, `memory/`, `architecture/`, `agents/`, `tools/`, `workflows/`, `prompts/`, `frontend/` | contexto | Contexto vivo del proyecto |

## Prioridades para agentes

- Leer `context/project-context.md` y `architecture/rules.md` antes de tocar código.
- Respetar las reglas de negocio RN-001…RN-011 (`context/project-context.md`) y su cobertura en `paz-y-salvo-backend/tests/`.
- Diseñar y revisar la UI con `frontend/` + `ux-heuristicas`, usando los tokens de `tailwind.config.js`.
- Validar con `npm test` (backend) y `npm run build` (frontend). Lint aún no configurado (PYS-T01).
- No agregar dependencias, frameworks ni servicios sin una decisión explícita registrada en `memory/`.

## Mantenimiento

Si una instrucción, decisión, patrón o corrección se repite más de una vez, se documenta en el archivo correspondiente (ver `workflows/skill-maintenance.md`). Las próximas sesiones no deben depender de recordar conversaciones anteriores.
