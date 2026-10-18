# Contexto del Proyecto

## Producto

**Paz & Salvo Digital Uniautónoma** (formato GTH-07 digital): sistema web institucional de la Corporación Universitaria Autónoma del Cauca que reemplaza el trámite físico de paz y salvo de retiro / entrega de cargo por un flujo 100 % digital, auditable y centralizado.

- **Problema:** el formato GTH-07 en papel obliga al trabajador saliente a recorrer 8 dependencias recogiendo firmas, sin trazabilidad.
- **Flujo:** el trabajador habilita el trámite → diligencia el informe de entrega de cargo (8 secciones) → Jefe Inmediato valida → 7 áreas registran o levantan bloqueos → Comunidad Universitaria aprueba → se emite certificado PDF con QR verificable públicamente.
- **Alcance actual:** práctica profesional 2026, 3 sprints (28-sep-2026 → 15-nov-2026). Sprint 1 cerrado (commit "Primer sprint").
- **Equipo:** Duván Felipe David Jaramillo (liderazgo técnico) y Daniel Francisco Reina Medina (liderazgo de calidad).
- **Cliente:** División de Bienestar Universitario, DTI y Comunidad Universitaria.
- **Repositorio:** https://github.com/despair07/proyecto-paz-y-salvo-digital
- **Especificación maestra:** `guia-tecnica.txt` (raíz). Instrucciones de uso: `README.md` y `MANUAL_TESTING.md`.

## Usuarios

Personal institucional de Uniautónoma, por rol RBAC:

| Rol | Qué hace |
|---|---|
| Docente / Administrativo / Contratista | Trabajador saliente: consulta su estado, diligencia el informe y descarga el certificado |
| Jefe Inmediato | Valida el informe de entrega de cargo |
| Encargado de Área (DTI, Medios Educativos, Almacén, Archivo, Financiera, SST, Desarrollo Profesoral) | Registra y levanta bloqueos **solo de su dependencia** |
| Aprobador Comunidad Universitaria | Aprobación final y emisión del certificado |
| Administrador DTI | Administración del catálogo (solo editar nombre de cargo) |
| Público | Verifica un certificado por QR sin login |

Tono de comunicación: formal e institucional, en español de Colombia, claro y sin tecnicismos para el trabajador.

## Plataforma

Web responsive (desktop prioritario para encargados y aprobador; móvil para consulta del trabajador y verificación QR).

## Stack actual

**Frontend** (`paz-y-salvo-frontend/`, JavaScript/JSX, ES modules)
- React 19.3 + React DOM, React Router DOM 7.18
- Vite 8.3 (`@vitejs/plugin-react` 6.1)
- Tailwind CSS 3.4 (+ PostCSS, Autoprefixer) — **v3**, con `tailwind.config.js`
- Axios 1.20 (cliente en `src/services/api.js`)
- Sin linter ni tests configurados

**Backend** (`paz-y-salvo-backend/`, Node 20, CommonJS)
- Express 5.2, `pg` 8.23 contra Supabase PostgreSQL
- JWT (`jsonwebtoken`), `bcryptjs`, Google SSO (`google-auth-library`)
- Zod 4 (DTOs), `pdf-lib` + `qrcode` (certificado)
- Jest 30 + Supertest (tests)

**Base de datos** (`database/`): DDL canónico de 10 tablas en 3FN + seeds. Skills de Supabase ya instaladas (`supabase`, `supabase-postgres-best-practices`).

## Ubicación

- API: `paz-y-salvo-backend/` → http://localhost:3000/api/v1 (Swagger en `/api/docs`)
- UI: `paz-y-salvo-frontend/` → http://localhost:5173
- SQL: `database/`
- Skills: `.agents/skills/`

## Rutas / pantallas

| Ruta | Propósito | Roles |
|---|---|---|
| `/login` | Login con Google Workspace (contraseña solo en desarrollo) | Todos |
| `/perfil` | Elegir o cambiar el tipo de vinculación (RN-012), datos de la cuenta | Cualquier sesión |
| `/dashboard/usuario` | Estado global + grid de dependencias + informe de entrega | Docente, Administrativo, Contratista |
| `/dashboard/encargado` | Gestión de bloqueos del área / validación del informe | Encargado de Área, Jefe Inmediato |
| `/dashboard/aprobador` | Trámites pendientes de aprobación final | Aprobador Comunidad Universitaria |
| `/dashboard/admin` | Catálogo de dependencias y cargos | Administrador DTI |
| `/verificar/:token` | Verificación pública del certificado por QR | Público |

## Dominio

Tablas: `roles`, `usuarios`, `usuario_roles`, `dependencias`, `encargados_dependencia`, `periodos_academicos`, `solicitudes_paz_y_salvo`, `bloqueos_dependencia`, `entregables_profesorales`, `certificados_digitales`.

Reglas de negocio (detalle en `README.md` y `guia-tecnica.txt`):

- **RN-001** Estado `AL_DIA` solo con 0 bloqueos activos.
- **RN-002** Aprobación final exclusiva de Comunidad Universitaria.
- **RN-003** Categorías de bloqueo: `FINANCIERO`, `INVENTARIO_ELEMENTOS`, `DOCUMENTAL_ENTREGABLES`, `ACADEMICO_PROFESORAL`.
- **RN-004** Cada encargado solo gestiona bloqueos de su dependencia (`areaScope.middleware.js`).
- **RN-005** No se aprueba con bloqueos activos.
- **RN-006** Certificado PDF + QR solo tras aprobación final.
- **RN-007** Docentes: 3 entregables (planes de aula, innovaciones educativas, informes de ejecución) evaluados por Desarrollo Profesoral.
- **RN-008** Flujo jerárquico: Jefe Inmediato → 7 áreas → Comunidad Universitaria.
- **RN-009** Motivo obligatorio en todo veredicto de bloqueo.
- **RN-010** Informe de entrega de cargo (8 secciones) requerido para aprobar.
- **RN-011** Admin DTI solo edita el nombre del cargo.

Todo se persiste en Supabase (no hay modo demo). Las reglas RN las valida el backend y las hace cumplir la BD (triggers/CHECK); cada escritura queda en `auditoria`.

## Identidad visual

- Marca: Uniautónoma — tokens Figma aprobados por el cliente (Sección 8.1 de la guía).
- Estilo: institucional sobrio, limpio y confiable (azul noche + ámbar).
- Paleta: primario `#0A2540`, acento `#D97706`, fondo `#F8FAFC`, texto `#1E293B`.
- Fuentes: Inter (títulos y texto).
- Guía detallada: `../frontend/`

## Activos

`paz-y-salvo-frontend/public/` (estáticos) y `paz-y-salvo-frontend/src/assets/` (estilos).
