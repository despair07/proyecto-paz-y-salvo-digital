# Instrucciones de Frontend — Paz & Salvo Digital Uniautónoma

## Stack

React 19 + Vite 8 + Tailwind 3 + React Router 7 + Axios (frontend, JavaScript); Express 5 + JWT + Zod + pdf-lib/qrcode sobre PostgreSQL/Supabase (backend, Node 20, CommonJS); Jest + Supertest

## Reglas generales

- Respetar la estructura de carpetas de `architecture/rules.md`.
- Usar los tokens de `paz-y-salvo-frontend/tailwind.config.js` + `paz-y-salvo-frontend/src/assets/styles/index.css` antes de crear colores, sombras o radios nuevos.
- Evitar dependencias nuevas si una solución simple encaja con el stack actual.
- Estilos solo con clases de Tailwind 3 y tokens de `tailwind.config.js`; CSS propio únicamente en `index.css` para componentes repetidos (`badge-*`).
- Visibilidad por rol: usar `ProtectedRoute` y `useAuth`; nunca confiar solo en ocultar botones (el backend valida).
- Estados de trámite y bloqueo con `StatusBadge`.

## Componentes

- Nombres claros y orientados al dominio.
- Una responsabilidad por componente; extraer helpers y hooks cuando la lógica crezca.
- Todo componente con datos tiene sus estados: vacío, cargando, error y éxito (H1, H9).

## Contenido visible

- Idioma y tono: formal e institucional, español de Colombia.
- Labels y CTA accionables (verbo + objeto: "Guardar cambios", "Crear cuenta").
- Mensajes de error que digan qué pasó y cómo corregirlo, sin culpar al usuario (H9).

## Validación

```bash
cd paz-y-salvo-frontend
npm run build   # lint aún no configurado (PYS-T01)
```

Para cambios visuales, revisar manualmente desktop y móvil.
