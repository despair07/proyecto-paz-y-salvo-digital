---
name: testing
description: Estrategia, comandos y criterio de "verificado" de Paz & Salvo Digital Uniautónoma. Úsala para comprobar que una tarea está lista antes de cerrarla.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Testing — Paz & Salvo Digital Uniautónoma

## Estado actual

- Backend: Jest 30 + Supertest (`paz-y-salvo-backend/tests/`: acceptance, auth, lock, request, certificate, pdf, areaScope, rutas).
- Frontend: no configurado (tarea PYS-T02: Vitest + Testing Library). Lint no configurado en ninguno (PYS-T01).

## Verificación mínima obligatoria

```bash
cd paz-y-salvo-backend && npm test              # reglas de negocio y rutas
cd ../paz-y-salvo-frontend && npm run build    # lint aún no configurado (PYS-T01)
```

Resultado esperado: ambos sin errores. Sin ejecución real no hay verificación.

## Verificación adicional

- Revisar manualmente la ruta o pantalla modificada con `npm run dev`.
- Sin errores en la consola del navegador / en el log del dispositivo.
- Web: probar en un ancho de móvil (~375 px) y en desktop.
- UI nueva o rediseñada: checklist mínimo de `ux-heuristicas` (H1, H3, H5, H9).

## Estrategia objetivo

- **Unitario**: funciones puras, helpers y reglas de negocio.
- **Componente**: render y comportamiento de componentes.
- **Integración**: flujos de navegación y llamadas a servicios (con mocks).
- **E2E**: flujos críticos (Playwright en web; Detox/Maestro en móvil).
- **Usabilidad**: pruebas con usuarios y métricas de `ux-heuristicas/references/metricas-usabilidad.md`.

## Cobertura esperada

Reglas de negocio RN-001…RN-011 cubiertas al 100 % en backend (ya hay tests por regla); frontend: mínimo flujos de login y redirección por rol.
