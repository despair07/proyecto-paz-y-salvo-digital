# Paleta de Colores — Paz & Salvo Digital Uniautónoma

Fuente oficial: `paz-y-salvo-frontend/tailwind.config.js` + `paz-y-salvo-frontend/src/assets/styles/index.css`.

## Tokens

Tokens de `tailwind.config.js` (clases `primary`, `secondary`, `app`, `status`; los alias `uni-*` son de compatibilidad, no usarlos en código nuevo) y variables CSS en `index.css`.

| Token | Valor | Uso |
|---|---:|---|
| `primary` (`--primary`) | `#0A2540` | Acciones secundarias, links, estados activos |
| `secondary` (`--secondary`) | `#D97706` | CTA principal, puntos de atención |
| `app-bg` (`--bg-app`) | `#F8FAFC` | Fondo principal |
| texto (`slate-800`) | `#1E293B` | Texto principal |
| texto secundario | `slate-500` | Texto secundario |
| borde | `slate-200` | Bordes suaves |
| `status-success` | `#16A34A` | Éxito (verde por convención, H4) |
| `status-warning` | `#EA580C` | Advertencias |
| `status-danger` | `#DC2626` | Errores y acciones destructivas (rojo por convención, H4) |

## Reglas de contraste

- Texto normal: contraste mínimo 4.5:1 (WCAG AA); texto grande: 3:1.
- Verificar el texto sobre el color de acento: elegir texto claro u oscuro según el contraste real.
- Si hay modo oscuro, definir cada token también para el modo oscuro.

## No hacer

- No crear colores nuevos si un token existente cubre el caso.
- No usar el color de acento para texto largo ni fondos grandes.
- No comunicar estados solo con color (acompañar con texto o icono).
