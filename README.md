# 🎓 Paz & Salvo Digital Uniautónoma
**Formato GTH-07 Digital — Corporación Universitaria Autónoma del Cauca**

Sistema institucional para tramitar la liquidación de personal (paz y salvo) de forma 100 % digital: revisión por dependencias, informe de entrega de cargo, aprobación final y certificado PDF verificable por código QR.

---

## 📦 Estructura del proyecto

```
paz y salvo/
├── database/
│   ├── ddl.sql               ← DDL canónico v2.1: 14 tablas, triggers de reglas, vistas, RLS
│   ├── seed_maestro.sql      ← catálogos: 7 roles, 9 dependencias, 17 cargos, periodo 2026-2
│   ├── seed_demo.sql         ← 15 usuarios y 5 trámites ficticios en distintos estados
│   └── PROPUESTAS_CAMBIO_BD.md ← historial de decisiones de diseño de la BD
├── paz-y-salvo-backend/      ← API Express + JWT + Supabase/PostgreSQL
└── paz-y-salvo-frontend/     ← React 18 + Vite + Tailwind CSS
```

---

## ⚡ Inicio rápido — 3 pasos

### 1. Activar el proyecto en Supabase
> ⚠️ **Los proyectos gratuitos de Supabase se pausan tras 7 días de inactividad.**
>
> 1. Ve a 👉 [https://supabase.com/dashboard](https://supabase.com/dashboard)
> 2. Abre tu proyecto `tlgkuvqqkbnvdfrpqkjh`
> 3. Si ves un botón **"Restore project"**, haz clic. Espera 2-3 minutos.
> 4. Una vez activo, sigue los pasos siguientes.

### 2. Instalar y configurar el Backend

Abre una terminal **PowerShell** y ejecuta:

```powershell
# Entrar a la carpeta del backend
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"

# Instalar dependencias (solo la primera vez)
npm install

# Subir DDL y semillas a Supabase automáticamente
npm run setup-db
```

Si el script `setup-db` termina con ✅, la base de datos está lista.

Luego **arrancar el servidor**:

```powershell
npm run dev
```

El backend quedará en: **http://localhost:3000**
Documentación Swagger: **http://localhost:3000/api/docs**

### 3. Iniciar el Frontend

Abre una **segunda terminal PowerShell** y ejecuta:

```powershell
# Entrar a la carpeta del frontend
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-frontend"

# Instalar dependencias (solo la primera vez)
npm install

# Iniciar en modo desarrollo
npm run dev
```

La interfaz quedará en: **http://localhost:5173**

---

## 🔐 Inicio de sesión

El acceso es **solo con Google Workspace** (cuentas `@uniautonoma.edu.co`; el backend exige el claim `hd` del dominio):

- **Docentes, administrativos y contratistas** entran libremente. Al primer ingreso quedan registrados *sin verificar* y sin rol, y eligen su **tipo de vinculación** en `/perfil`. Pueden cambiarlo después con confirmación, notificación a la persona y a TI, y solo sin un trámite en curso (RN-012).
- **Jefe inmediato, encargados de área, aprobador y administrador DTI** deben estar registrados por TI. Hasta que exista el panel de TI se dan de alta con:

  ```powershell
  cd paz-y-salvo-backend
  npm run registrar-usuario -- ana.perez@uniautonoma.edu.co "Ana Pérez" admin
  npm run registrar-usuario -- luis.diaz@uniautonoma.edu.co "Luis Díaz" encargado almacen
  ```

  (roles: `jefe`, `encargado`, `aprobador`, `admin`).
- Las notificaciones (campana del encabezado) son dentro del sistema.
- Para que el botón de Google funcione en local, el origen `http://localhost:5173` debe estar autorizado en el cliente OAuth de Google Cloud.

## 🔑 Credenciales de prueba (solo desarrollo)

Con `AUTH_PASSWORD_ENABLED=true` (backend) y `VITE_ENABLE_PASSWORD_LOGIN=true` (frontend) se puede entrar con los usuarios ficticios del seed. Nunca en producción.

> Contraseña única para todos: **`Demo2026*`**

| Rol | Correo | Descripción |
|-----|--------|-------------|
| **Docente** | `laura.ortiz@uniautonoma.edu.co` | Estado EN_PROCESO, bloqueos activos en múltiples áreas |
| **Administrativo** | `carlos.munoz@uniautonoma.edu.co` | Portátil pendiente en Almacén |
| **Contratista** | `sofia.cardenas@uniautonoma.edu.co` | Estado AL_DÍA, lista para aprobación final |
| **Jefe Inmediato** | `jefe.inmediato@uniautonoma.edu.co` | Valida informe de entrega de cargo |
| **Encargado DTI** | `encargado.dti@uniautonoma.edu.co` | Gestiona bloqueos de DTI |
| **Encargado Almacén** | `encargado.almacen@uniautonoma.edu.co` | Gestiona bloqueos de Almacén |
| **Encargado Financiero** | `encargado.financiera@uniautonoma.edu.co` | Gestiona bloqueos Financieros |
| **Aprobador** | `aprobador.comunidad@uniautonoma.edu.co` | Aprobación final + genera certificado PDF+QR |
| **Admin DTI** | `admin.dti@uniautonoma.edu.co` | Administración del sistema (solo lectura/nombre cargo) |

En la pantalla de login encontrarás tarjetas de **acceso rápido por rol** para seleccionar directamente sin escribir las credenciales.

---

## 🌐 Endpoints principales (API v1)

Base URL: `http://localhost:3000/api/v1`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Login con correo/contraseña o Google SSO |
| `GET` | `/auth/me` | Perfil del usuario autenticado |
| `GET` | `/paz-y-salvo/mi-estado` | Estado global del trabajador + grid de 8 dependencias |
| `POST` | `/tramites/habilitar` | Habilitar trámite (RF-009) |
| `PUT` | `/tramites/:id/informe-entrega-cargo` | Guardar informe de entrega en 8 secciones (RF-010) |
| `GET` | `/tramites/pendientes-aprobacion` | Lista para Comunidad Universitaria (RF-005) |
| `POST` | `/tramites/:id/aprobar` | Aprobación/rechazo final (RN-002, RN-005, RN-010) |
| `POST` | `/bloqueos` | Registrar bloqueo en área (RF-002, RN-003, RN-004, RN-009) |
| `PUT` | `/bloqueos/:id` | Levantar bloqueo como RESUELTO (RF-003) |
| `GET` | `/desarrollo-profesoral/docentes/:id` | Estado 3 entregables docentes (RN-007) |
| `PUT` | `/desarrollo-profesoral/docentes/:id` | Evaluar entregables docentes (RF-008) |
| `GET` | `/certificados/verificar/:token` | Verificación pública QR sin login (RN-006, RF-006) |
| `GET` | `/certificados/:token/pdf` | Descarga PDF del certificado (RN-006) |

Documentación completa en: `http://localhost:3000/api/docs` (Swagger UI)

---

## 🏗️ Arquitectura

```
Frontend (React 19 / Vite)          Backend (Express 5 / Node 20)
───────────────────────────         ──────────────────────────────
src/pages/auth/Login.jsx        →   POST /api/v1/auth/login
src/pages/user/DashboardUser    →   GET  /api/v1/paz-y-salvo/mi-estado
src/pages/area-manager/Dashboard →  POST /api/v1/bloqueos
src/pages/approver/Dashboard    →   POST /api/v1/tramites/:id/aprobar
src/pages/admin/DashboardAdmin  →   GET  /api/v1/usuarios · PUT /usuarios/:id
src/pages/certificates/Verify   →   GET  /api/v1/certificados/verificar/:token
                                              ↓
                          routes → controllers → services → repositories
                                              ↓
                              Supabase PostgreSQL (ddl.sql v2.0)
```

Todo se persiste en Supabase: no hay modo demo ni datos en memoria. Las reglas de negocio las valida el backend y las hace cumplir la propia base (triggers y CHECK). Las pantallas muestran datos reales; los datos ficticios iniciales vienen de `database/seed_demo.sql`.

---

## 🗄️ Base de datos

### 14 tablas (DDL v2.1 — 3FN)

| # | Tabla | Propósito |
|---|-------|-----------|
| 1 | `roles` | 7 roles RBAC institucionales |
| 2 | `usuarios` | Personal institucional (hash bcrypt, CHECK de correo @uniautonoma.edu.co) |
| 3 | `usuario_roles` | Relación N:M usuario–rol |
| 4 | `dependencias` | Jefe Inmediato + 7 áreas + Comunidad Universitaria; `etapa`, `orden`, `solo_docentes` |
| 5 | `encargados_dependencia` | Asignación de funcionarios a dependencias (base de RN-004) |
| 6 | `periodos_academicos` | Periodos semestrales; un solo periodo activo |
| 7 | `catalogo_cargos` | Catálogo de cargos (RN-011) |
| 8 | `solicitudes_paz_y_salvo` | Trámite por trabajador y periodo; `estado_global` y `etapa_actual` (RN-001, RN-008) |
| 9 | `informes_entrega_cargo` | Informe de 8 secciones en JSONB + validación del jefe (RF-010) |
| 10 | `bloqueos_dependencia` | Bloqueos/liberaciones por área (core) |
| 11 | `entregables_profesorales` | 3 criterios docentes (RN-007) |
| 12 | `certificados_digitales` | Token QR + hash SHA-256 (RN-006) |
| 13 | `auditoria` | Historial de cambios (quién, cuándo, por qué, antes/después) |
| 14 | `notificaciones` | Avisos dentro del sistema (por usuario, leída / no leída) |

Vistas: `v_resumen_paz_y_salvo` (resumen por trámite) y `v_estado_dependencias_solicitud` (grid de dependencias).

**Reglas que la propia BD hace cumplir** (además del backend): RN-001 (estado se recalcula solo), RN-002, RN-003, RN-004 (solo el encargado de la dependencia bloquea/libera), RN-005, RN-006, RN-007, RN-009 (motivo obligatorio) y RN-010. Todas las tablas tienen RLS activo: la API REST de Supabase no puede leer ni escribir, solo el backend.

### Subir la BD a Supabase (automático)

```powershell
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"

npm run setup-db                    # solo seeds (idempotente, no borra nada)
npm run setup-db -- --reset         # ⚠ BORRA y recrea todo: ddl.sql + seeds
npm run setup-db -- --solo-maestro  # solo catálogos, sin datos ficticios
```

### Subir la BD a Supabase (manual, desde el Editor SQL de Supabase)

1. Ve a **https://supabase.com/dashboard** → tu proyecto → **SQL Editor**
2. Ejecuta en orden (cada uno es un script completo):
   - `database/ddl.sql` → ⚠ **elimina y recrea** las 14 tablas, triggers, vistas y RLS
   - `database/seed_maestro.sql` → roles, dependencias, cargos y periodo activo
   - `database/seed_demo.sql` → usuarios y trámites ficticios (contraseña `Demo2026*`)

---

## 🔒 Variables de entorno

Archivo: `paz-y-salvo-backend/.env`

```env
# Base de datos Supabase
DB_HOST=db.tlgkuvqqkbnvdfrpqkjh.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<tu_contraseña_supabase>
DB_SSL=true              # OBLIGATORIO para Supabase

# JWT (cambiar en producción por valor aleatorio ≥ 32 bytes)
JWT_SECRET=super_secret_jwt_key_for_development
JWT_EXPIRES_IN=24h

# Google OAuth (mismo Web Client ID que el frontend)
GOOGLE_CLIENT_ID=<tu_client_id>
GOOGLE_HOSTED_DOMAIN=uniautonoma.edu.co

# Solo desarrollo (login con contraseña de los usuarios del seed). En producción: false
AUTH_PASSWORD_ENABLED=false

# URLs
API_PUBLIC_URL=http://localhost:3000/api/v1
FRONTEND_PUBLIC_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

```

---

## ✅ Pruebas automatizadas

```powershell
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"
npm test
```

### Suite de pruebas incluidas

| Archivo | Cubre |
|---------|-------|
| `tests/api.integration.test.js` | 40+ casos sobre PostgreSQL real (PGlite con `ddl.sql` y los seeds): login, estado, bloqueos, RN-001…RN-011, informe, aprobación, certificado QR, catálogos |
| `tests/auth.google.test.js` | Login con Google (claim `hd`), autoregistro, tipo de vinculación (RN-012) y notificaciones |
| `tests/auth.middleware.test.js` | JWT válido, inválido y sin token |
| `tests/areaScope.middleware.test.js` | RN-004 aislamiento por dependencia |
| `tests/pdf.service.test.js` | Generación PDF con `pdf-lib` y QR embebido |
| `tests/request.controller.test.js` | Validación de payload, respuestas HTTP |

Las pruebas no necesitan Supabase ni red: levantan la base en memoria con el mismo esquema.

---

## 🧑‍💼 Reglas de negocio implementadas

| ID | Regla |
|----|-------|
| **RN-001** | Estado AL_DIA solo con 0 bloqueos activos |
| **RN-002** | Aprobación final exclusiva de Comunidad Universitaria |
| **RN-003** | Categorías válidas: FINANCIERO, INVENTARIO_ELEMENTOS, DOCUMENTAL_ENTREGABLES, ACADEMICO_PROFESORAL |
| **RN-004** | Cada encargado solo gestiona bloqueos de su propia dependencia |
| **RN-005** | Prohibido aprobar con bloqueos activos |
| **RN-006** | Certificado PDF + QR solo se emite tras aprobación final |
| **RN-007** | 3 entregables docentes se evalúan independientemente (Centro de Desarrollo Profesoral) |
| **RN-008** | Flujo jerárquico: Jefe Inmediato → 7 Áreas → Comunidad Universitaria |
| **RN-009** | Motivo obligatorio en todo veredicto de bloqueo |
| **RN-010** | Informe de entrega de cargo (8 secciones) requerido para aprobar |
| **RN-011** | Admin DTI solo puede editar el nombre del cargo en el catálogo |
| **RN-012** | El tipo de vinculación (docente / administrativo / contratista) no se cambia con un trámite en curso; el cambio se confirma y se notifica |

---

## 🖥️ Pantallas del sistema

| Pantalla | Ruta Frontend | Rol |
|----------|---------------|-----|
| Login institucional | `/login` | Todos |
| Dashboard trabajador | `/dashboard` | Docente, Administrativo, Contratista |
| Panel encargado área | `/area` | Encargado de Área, Jefe Inmediato |
| Panel aprobador | `/aprobador` | Aprobador Comunidad Universitaria |
| Administración DTI | `/admin` | Administrador DTI |
| Verificación pública QR | `/verificar/:token` | Público (sin login) |

---

## 🚧 TODOs abiertos (confirmar con el cliente)

| ID | Descripción |
|----|-------------|
| `TODO-ADMIN-01` | ¿El Admin DTI puede crear nuevos usuarios o asignar roles desde la UI? (Actualmente: no permitido, solo lectura + edición de nombre cargo) |
| `TODO-SSO-01` | Configurar dominios autorizados en Google Cloud Console (`uniautonoma.edu.co`) para producción |
| `TODO-PROD-01` | Ejecutar `npm run setup-db -- --solo-maestro` (sin datos ficticios) y cambiar la contraseña de los usuarios de prueba |
| `TODO-RLS-01` | Habilitar Row Level Security en Supabase para aislamiento multi-tenant real |

---

## 🔄 Pasar a producción (checklist)

- [ ] Crear nuevo proyecto Supabase de producción
- [ ] Cambiar `DB_*` en `.env` con credenciales de producción
- [ ] No cargar `seed_demo.sql` en producción (usar `--solo-maestro`) y crear los usuarios reales
- [ ] Cambiar `JWT_SECRET` por un valor aleatorio seguro (`openssl rand -hex 32`)
- [ ] Configurar `GOOGLE_CLIENT_ID` con el proyecto OAuth de producción
- [ ] Habilitar RLS en todas las tablas en Supabase
- [ ] Configurar `CORS_ORIGINS` con el dominio de producción
- [ ] Ejecutar `npm run setup-db` contra la base de producción

---

## 📄 Licencia

Corporación Universitaria Autónoma del Cauca — Uso interno institucional.
