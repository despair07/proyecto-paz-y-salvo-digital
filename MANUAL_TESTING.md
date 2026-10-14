# Prueba manual de Paz y Salvo Digital

## 1. Preparar un entorno de pruebas

Usa un proyecto Supabase/PostgreSQL aislado. No ejecutes semillas ni SQL de instalación contra producción. El esquema vigente es `db.txt`; no uses `database/ddl.sql` ni `database/seed_demo.sql`, que corresponden a un modelo anterior. `db.txt` solo se ejecuta una vez sobre un esquema `public` vacío. Si el proyecto ya tiene tablas, detente y prepara una migración incremental.

En el backend, instala las dependencias y crea `.env` solo si todavía no existe:

```powershell
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edita `.env` con la conexión de la base de pruebas. En Supabase usa `DB_SSL=true` y agrega o confirma:

```env
API_PUBLIC_URL=http://localhost:3000/api/v1
FRONTEND_PUBLIC_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

Genera un secreto JWT local de al menos 32 bytes y colócalo en `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Configura el mismo OAuth Web Client ID en backend `GOOGLE_CLIENT_ID` y frontend `VITE_GOOGLE_CLIENT_ID`. En Google Cloud autoriza el origen JavaScript `http://localhost:5173`. La cuenta usada para iniciar sesión debe tener correo verificado `@uniautonoma.edu.co` y existir en `public.usuarios` con sus roles.

En otro terminal instala el frontend y crea su `.env` solo si falta:

```powershell
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-frontend"
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Confirma estas variables del frontend:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_GOOGLE_CLIENT_ID=el_mismo_client_id_de_google
VITE_ENABLE_TEST_ACCOUNTS=true
```

No compartas ni publiques ninguno de los archivos `.env`.

## 2. Preparar cuentas de prueba

En una base de pruebas recién creada, reemplaza las cinco direcciones de ejemplo por correos reales de prueba (cada uno debe iniciar sesión por Google) y ejecuta este SQL una sola vez en el SQL Editor. Crea una cuenta docente, una de jefatura, un encargado asignado a las ocho dependencias, un aprobador y un administrador. Es una semilla de pruebas: nunca la ejecutes en producción.

```sql
BEGIN;
SELECT set_config('app.user_id', '10000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.audit_reason', 'Provisionamiento de cuentas de prueba', true);

INSERT INTO public.usuarios
	(id, nombres, apellidos, tipo_documento, numero_documento,
	 correo_institucional, tipo_vinculacion, estado)
VALUES
	('10000000-0000-4000-8000-000000000001', 'Prueba', 'Docente', 'CC', '900000001', 'prueba.docente@uniautonoma.edu.co', 'Docente', 'ACTIVO'),
	('10000000-0000-4000-8000-000000000002', 'Prueba', 'Jefatura', 'CC', '900000002', 'prueba.jefatura@uniautonoma.edu.co', 'Administrativo', 'ACTIVO'),
	('10000000-0000-4000-8000-000000000003', 'Prueba', 'Encargado', 'CC', '900000003', 'prueba.encargado@uniautonoma.edu.co', 'Administrativo', 'ACTIVO'),
	('10000000-0000-4000-8000-000000000004', 'Prueba', 'Aprobador', 'CC', '900000004', 'prueba.aprobador@uniautonoma.edu.co', 'Administrativo', 'ACTIVO'),
	('10000000-0000-4000-8000-000000000005', 'Prueba', 'Administrador', 'CC', '900000005', 'prueba.admin@uniautonoma.edu.co', 'Administrativo', 'ACTIVO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuario_roles (usuario_id, rol_id)
SELECT v.usuario_id, r.id
FROM (VALUES
	('10000000-0000-4000-8000-000000000001'::uuid, 'Docente'),
	('10000000-0000-4000-8000-000000000002'::uuid, 'Jefe Inmediato'),
	('10000000-0000-4000-8000-000000000003'::uuid, 'Encargado de Área'),
	('10000000-0000-4000-8000-000000000004'::uuid, 'Aprobador Comunidad Universitaria'),
	('10000000-0000-4000-8000-000000000005'::uuid, 'Administrador DTI')
) AS v(usuario_id, nombre_rol)
JOIN public.roles r ON r.nombre_rol = v.nombre_rol
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

INSERT INTO public.encargados_dependencia (usuario_id, dependencia_id)
SELECT '10000000-0000-4000-8000-000000000002'::uuid, d.id
FROM public.dependencias d
WHERE d.nombre_dependencia = 'Jefe Inmediato'
ON CONFLICT (usuario_id, dependencia_id) DO NOTHING;

INSERT INTO public.encargados_dependencia (usuario_id, dependencia_id)
SELECT '10000000-0000-4000-8000-000000000003'::uuid, d.id
FROM public.dependencias d
WHERE d.nombre_dependencia IN (
	'Jefe Inmediato',
	'División de Tecnologías de la Información y Transformación Digital (DTI)',
	'Medios Educativos', 'Almacén', 'Archivo y Correspondencia',
	'División Contable y Financiera',
	'Seguridad y Salud en el Trabajo (SST)',
	'Centro de Desarrollo Profesoral'
)
ON CONFLICT (usuario_id, dependencia_id) DO NOTHING;

COMMIT;
```

La tabla `usuarios` exige documento único, correo institucional y tipo de vinculación. El SQL de semilla presupone `public` creado desde `db.txt`, tablas sin usuarios preexistentes y ejecución como administrador del proyecto de pruebas. Las escrituras auditadas requieren `app.user_id` y `app.audit_reason`; la transacción los establece. No asignes roles administrativos a cuentas reales sin autorización institucional.

Roles mínimos para recorrer todo el flujo:

- Solicitante docente: rol `Docente`.
- Jefe inmediato: rol `Jefe Inmediato`, asignado a la dependencia del mismo nombre.
- Encargado: rol `Encargado de Área` y asignaciones a las dependencias que va a revisar. Para una prueba rápida se puede asignar un único usuario de prueba a las ocho áreas no aprobadoras.
- Aprobador: rol `Aprobador Comunidad Universitaria`.
- DTI: rol `Administrador DTI`.

## 3. Iniciar y comprobar servicios

Abre dos terminales de PowerShell y déjalos activos:

```powershell
# Terminal 1
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"
npm run dev
```

```powershell
# Terminal 2
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-frontend"
npm run dev
```

Abre `http://localhost:5173`. Comprueba que el backend responde y que la documentación está disponible:

```powershell
Invoke-RestMethod http://localhost:3000/api/openapi.json
```

## 4. Probar con las cuentas de prueba

En el login (con `VITE_ENABLE_TEST_ACCOUNTS=true`) usa el panel **Acceso rápido por rol** o escribe el correo y la contraseña `Demo2026*`. Todos los usuarios y trámites viven en Supabase: confirma el panel y la navegación según el rol, y cierra sesión entre perfiles. Lo que hagas (bloqueos, informes, aprobaciones) se guarda en la base y queda en la tabla `auditoria`. Para volver a los datos iniciales ejecuta `npm run setup-db -- --reset`.

## 5. Recorrer el flujo persistente, rol por rol

1. **Solicitante docente:** inicia sesión con Google. En “Mi Paz y Salvo”, habilita una solicitud de retiro o cambio de dependencia, indica cargo y lugar de expedición. Verifica que la solicitud aparezca en estado `EN_PROCESO`.
2. **Informe de entrega:** completa las secciones I a VIII. Guarda primero un borrador y verifica que sobreviva a una recarga. Después envía el informe completo. El backend rechaza el envío si alguna sección está vacía.
3. **Jefe inmediato:** inicia sesión con el usuario asignado a esa dependencia. Busca/selecciona la solicitud. Para probar bloqueos, registra uno con categoría y descripción; confirma que aparece activo. Escribe observación de resolución y resuélvelo. La dependencia debe quedar al día. Repite en cada área necesaria.
4. **Encargados de área:** cada usuario solo debe ver y modificar sus dependencias asignadas. Revisa DTI, Medios Educativos, Almacén, Archivo y Correspondencia, División Contable y Financiera y SST. Marca al día después de una revisión o registra/resuelve un bloqueo para probar ambos resultados. Un encargado no asignado debe recibir `403`.
5. **Desarrollo Profesoral:** en una solicitud docente, evalúa por separado Planes de aula, Innovaciones educativas e Informes de ejecución. Escribe observación en cada uno. La solicitud no puede pasar a aprobación final hasta que los tres estén aprobados. Esta sección no se crea para administrativo o contratista.
6. **Solicitante:** vuelve a cargar el panel. Confirma los estados por dependencia. Si hay algún bloqueo o validación pendiente, el estado global no debe ser `AL_DIA`.
7. **Aprobador de Comunidad Universitaria:** inicia sesión con el rol aprobador. La bandeja solo debe mostrar solicitudes elegibles: todas las validaciones al día, entregables docentes aprobados cuando apliquen e informe completo. Escribe una observación y elige aprobar o rechazar. Prueba primero con bloqueos pendientes: no debe permitir decidir.
8. **Certificado:** al aprobar, confirma el mensaje de emisión. En el panel del solicitante recarga la página y descarga el PDF. El PDF incluye el código QR.
9. **Verificación QR:** escanea el QR o abre la URL `urlVerificacion` devuelta al aprobar. Debe indicar `AUTENTICO` y mostrar el resumen público. Cambia un carácter del token: debe responder `404` como certificado no encontrado/inválido. El enlace público solo verifica; la descarga del PDF requiere autenticación.
10. **Administrador DTI:** inicia sesión con el rol DTI. Confirma que puede consultar usuarios/roles y editar nombres del catálogo de cargos. Las políticas actuales no permiten desde la UI crear usuarios, asignar roles ni editar periodos; esos cambios requieren un flujo administrativo autorizado aparte.

## 6. Pruebas automatizadas

Desde la raíz del workspace:

```powershell
cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-backend"
npm test -- --runInBand

cd "C:\Users\felip\OneDrive\Desktop\paz y salvo\paz-y-salvo-frontend"
npm run build
```

El QR abre `FRONTEND_PUBLIC_URL/verificar/:token`, y la página consulta `API_PUBLIC_URL`. Desde otro teléfono configura ambas direcciones con IPs accesibles desde ese teléfono, no `localhost`. Para una prueba en la misma red, permite los puertos en el firewall y autoriza el origen frontend en CORS y Google Cloud. En producción, usa HTTPS y desactiva `DEMO_MODE` y `DEMO_AUTH_ENABLED`.
