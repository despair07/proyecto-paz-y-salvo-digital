# Sistema de Diseño — Paz & Salvo Digital Uniautónoma

## Dirección visual

Estilo: **institucional sobrio (azul noche + ámbar)**.

Sobrio, confiable, claro y administrativo. Los tokens vienen del diseño Figma aprobado por el cliente (Sección 8.1); no proponer otra identidad. Estados con `StatusBadge` y clases `badge-*` de `index.css` (bloqueado, aprobado, etc.), siempre con texto además de color.

## Layout

Solo web responsive; no hay app móvil nativa.

### Web
- Navbar: marca a la izquierda, navegación clara, estado activo visible (H1).
- Contenedor con ancho máximo consistente.
- Secciones con una idea o acción principal cada una (H8).

### Vista móvil
- `Layout` con `Sidebar` y `Header`; una acción principal por pantalla.
- Modales siempre con forma visible de cerrarlos (H3).

### Cards / listas
- Fondo, borde, radio y sombra desde los tokens.
- Hover (web) o pressed state (móvil) sutil.

## Tipografía

- Títulos: Inter.
- Texto: Inter.
- Jerarquía clara: no usar bloques largos sin subtítulos ni listas.

## Interacciones

- Transiciones de 160–300 ms (ver `tailwind-css-patterns/references/motion-system.md` o `animation-creator`).
- El resultado de una acción aparece cerca de la acción que lo genera.
- Las acciones destructivas piden confirmación y ofrecen deshacer cuando sea posible (H3, H5).

## Evitar

- Estéticas genéricas ajenas a la marca.
- Decoración que no comunica (H8).
- Animaciones que distraen de la tarea.
