# Flujo de Desarrollo

1. Leer `context/project-context.md` y `architecture/rules.md`.
2. Si hay tablero (`ia_contexto/`), tomar la tarea con `project-manager`.
3. Crear la rama de la tarea según la skill `git`.
4. Ubicar el área afectada (`rg`/grep).
5. Si la tarea toca UI: revisar `frontend/` y aplicar `ux-heuristicas` (H1, H3, H5 y H9 como mínimo).
6. Hacer cambios pequeños y coherentes con el estilo actual.
7. Ejecutar `npm test` en `paz-y-salvo-backend` (lint aún no configurado, PYS-T01).
8. Ejecutar `npm run build` en `paz-y-salvo-frontend` si se tocaron rutas, imports, dependencias o configuración.
9. Para cambios visuales: verificar en desktop y móvil.
10. Si apareció una regla nueva o una instrucción repetida, actualizar `.agents/skills/`.
11. Commit convencional con el ID de la tarea y pull request según la skill `git`.

## Comandos

```bash
(cd paz-y-salvo-backend && npm test)
(cd paz-y-salvo-frontend && npm run build)   # lint aún no configurado (PYS-T01)
(cd paz-y-salvo-backend && npm run dev)      # API en :3000
(cd paz-y-salvo-frontend && npm run dev)     # UI en :5173
```
