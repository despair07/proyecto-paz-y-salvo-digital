# Guía de despliegue — Backend en Render · Frontend en Vercel · BD en Supabase

Esta guía lleva el sistema de tu máquina a internet. Síguela **en orden**: varias variables de un servicio
necesitan la URL del otro, así que hay un "ida y vuelta" (pasos 4 → 5 → 6).

```
Navegador ──► Vercel (React/Vite, estático) ──HTTPS──► Render (Express /api/v1) ──SSL──► Supabase (PostgreSQL)
                    ▲                                         │
                    └──── Google Identity (botón de login) ───┘ (el backend valida el ID token)
```

---

## 0. Antes de empezar

Necesitas cuentas en: **GitHub** (el repo `despair07/proyecto-paz-y-salvo-digital`), **Supabase**, **Render**,
**Vercel** y acceso a **Google Cloud Console** (el proyecto donde está el cliente OAuth).

1. Sube a GitHub todo lo que quieras desplegar. Render y Vercel despliegan **desde GitHub**, no desde tu PC:
   ```bash
   git status
   ```
   Si hay cambios pendientes, haz commit y `git push` a `main`.
2. Comprueba que los `.env` **no** estén en el repo (están ignorados por `.gitignore`; nunca los subas).
3. Verifica que todo compila y pasa tests localmente:
   ```bash
   npm test
   ```
   ```bash
   npm run build
   ```

---

## 1. Base de datos de producción (Supabase)

> Recomendado: un **proyecto nuevo** de Supabase solo para producción, separado del de desarrollo
> (que tiene los datos ficticios y cuentas con contraseña conocida).

1. supabase.com/dashboard → **New project**. Región: la más cercana (p. ej. `South America (São Paulo)`).
   Guarda la **contraseña de la base** en un gestor de contraseñas.
2. Crea el esquema: **SQL Editor → New query**, pega el contenido completo de `database/ddl.sql` y **Run**.
   ⚠️ `ddl.sql` borra y recrea las tablas: hazlo solo en la base nueva y vacía.
3. Carga los catálogos: nueva query con el contenido de `database/seed_maestro.sql` → **Run**.
   **No** ejecutes `seed_demo.sql` en producción.
4. Obtén los datos de conexión: botón **Connect** (arriba) → pestaña **Connection string** → método
   **Session pooler** (puerto **5432**). Render no tiene IPv6 y la conexión directa de Supabase sí lo requiere,
   por eso se usa el *pooler*. De la cadena
   `postgresql://postgres.abcdxyz:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` sacas:

   | Variable | Valor de ejemplo |
   |---|---|
   | `DB_HOST` | `aws-0-sa-east-1.pooler.supabase.com` |
   | `DB_PORT` | `5432` |
   | `DB_NAME` | `postgres` |
   | `DB_USER` | `postgres.abcdxyz` (incluye el *project ref*) |
   | `DB_PASSWORD` | la contraseña del paso 1 |

---

## 2. Genera el secreto JWT

Debe ser aleatorio y de al menos 32 bytes (el backend no arranca en producción si es más corto). En tu PC:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copia el resultado; será `JWT_SECRET`. Usa uno **distinto** al de desarrollo.

---

## 3. Google OAuth (primera parte)

En Google Cloud Console → **APIs y servicios → Credenciales**, abre (o crea) el cliente
**OAuth 2.0 → Aplicación web**. Copia su **ID de cliente** (`xxxx.apps.googleusercontent.com`):
es el mismo valor para `GOOGLE_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (frontend).

Los orígenes autorizados se agregan en el paso 7, cuando ya tengas la URL de Vercel.

> Si la pantalla de consentimiento está en modo **Interno** (Google Workspace de la universidad), solo
> pueden entrar cuentas `@uniautonoma.edu.co`, que es lo que se busca. El backend además exige
> `GOOGLE_HOSTED_DOMAIN=uniautonoma.edu.co`.

---

## 4. Backend en Render

1. dashboard.render.com → **New + → Web Service** → conecta GitHub y elige el repo.
2. Configuración:

   | Campo | Valor |
   |---|---|
   | Name | `paz-y-salvo-api` (define la URL: `https://paz-y-salvo-api.onrender.com`) |
   | Region | `Ohio` o `Oregon` (la más cercana a tu región de Supabase que ofrezca) |
   | Branch | `main` |
   | **Root Directory** | `paz-y-salvo-backend` |
   | Runtime | `Node` |
   | **Build Command** | `npm ci` |
   | **Start Command** | `npm start` |
   | Instance Type | `Free` para pruebas; `Starter` para uso real (ver notas) |

3. **Environment → Add Environment Variable** (o *Add from .env* pegando el bloque). Por ahora pon un valor
   temporal en las URLs del frontend; las corriges en el paso 6:

   ```env
   NODE_ENV=production
   NODE_VERSION=22
   TRUST_PROXY=1

   DB_HOST=aws-0-sa-east-1.pooler.supabase.com
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres.abcdxyz
   DB_PASSWORD=la_contraseña_de_supabase
   DB_SSL=true
   DB_POOL_MAX=8
   DB_CONNECTION_TIMEOUT_MS=5000
   DB_IDLE_TIMEOUT_MS=10000

   JWT_SECRET=el_valor_generado_en_el_paso_2
   JWT_EXPIRES_IN=8h

   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_HOSTED_DOMAIN=uniautonoma.edu.co
   AUTH_PASSWORD_ENABLED=false

   API_PUBLIC_URL=https://paz-y-salvo-api.onrender.com/api/v1
   FRONTEND_PUBLIC_URL=https://pendiente.vercel.app
   CORS_ORIGINS=https://pendiente.vercel.app
   ```

   Detalles importantes:
   - **No definas `PORT`**: Render lo inyecta y el servidor ya lo lee.
   - `TRUST_PROXY=1`: Render pone un proxy delante; sin esto el límite de peticiones vería a todos los usuarios
     como una sola IP y bloquearía el login.
   - `API_PUBLIC_URL` termina en `/api/v1` y **sin** barra final. Usa el nombre exacto que te asignó Render
     (si el nombre estaba ocupado, Render agrega un sufijo, p. ej. `paz-y-salvo-api-x1y2.onrender.com`).
   - `NODE_ENV=production` activa la validación: si falta algo, el deploy falla y en **Logs** verás
     `❌ Configuración de producción no válida:` con la lista de problemas.

4. **Settings → Health Check Path**: `/api/health`.
5. **Create Web Service** y espera el primer deploy. En **Logs** debe aparecer:
   ```
   Servidor corriendo en el puerto 10000
   ✅ Base de datos conectada (… ms)
      Esquema:  14/14 tablas · 0 usuarios · 0 trámites · 0 bloqueos
   ```
6. Prueba en el navegador:
   - `https://paz-y-salvo-api.onrender.com/api/health?db=true` → `{"ok":true,…,"db":true}`
   - `https://paz-y-salvo-api.onrender.com/api/docs` → documentación de la API.

---

## 5. Frontend en Vercel

El repo ya incluye `paz-y-salvo-frontend/vercel.json`, que redirige todas las rutas a `index.html`
(sin él, recargar `/dashboard/usuario` o abrir el QR `/verificar/…` daría **404**).

1. vercel.com → **Add New… → Project** → importa el repo de GitHub.
2. Configuración:

   | Campo | Valor |
   |---|---|
   | Project Name | `paz-y-salvo-uniautonoma` (define la URL `https://paz-y-salvo-uniautonoma.vercel.app`) |
   | Framework Preset | `Vite` |
   | **Root Directory** | `paz-y-salvo-frontend` (botón *Edit*) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm ci` |

3. **Environment Variables** (marca al menos el entorno *Production*):

   ```env
   VITE_API_URL=https://paz-y-salvo-api.onrender.com/api/v1
   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   VITE_ENABLE_PASSWORD_LOGIN=false
   VITE_ENABLE_TEST_ACCOUNTS=false
   ```

   - Las variables `VITE_*` se **incrustan al compilar**: si cambias una, debes hacer **Redeploy**
     (Deployments → ⋯ → Redeploy) para que surta efecto.
   - Son públicas (cualquiera las ve en el JS del navegador): nunca pongas secretos ahí. El ID de cliente
     de Google no es secreto.
   - `VITE_API_URL` debe incluir `https://` y `/api/v1`, sin barra final.

4. **Deploy**. Anota la URL de producción definitiva (Project → *Domains*), p. ej.
   `https://paz-y-salvo-uniautonoma.vercel.app`.

---

## 6. Vuelve a Render: conecta el backend con el frontend

En Render → tu servicio → **Environment**, reemplaza los valores temporales con la URL exacta de Vercel
(con `https://`, **sin** barra final y sin ruta):

```env
FRONTEND_PUBLIC_URL=https://paz-y-salvo-uniautonoma.vercel.app
CORS_ORIGINS=https://paz-y-salvo-uniautonoma.vercel.app
```

- `CORS_ORIGINS` admite varios orígenes separados por coma, p. ej. si luego agregas un dominio propio:
  `https://paz-y-salvo-uniautonoma.vercel.app,https://pazysalvo.uniautonoma.edu.co`
- La comparación es **exacta**: `https://x.vercel.app/` (con barra) o `http://` no coinciden.
- Las URLs de *preview* de Vercel (`…-git-rama-usuario.vercel.app`) **no** están en CORS; prueba siempre en la
  URL de producción.
- `FRONTEND_PUBLIC_URL` es la que va en el QR del certificado: si cambias de dominio después, los certificados
  ya emitidos seguirán apuntando al anterior.

Guarda (**Save, rebuild and deploy**) y espera a que el servicio quede *Live*.

---

## 7. Google OAuth (segunda parte)

Google Cloud Console → Credenciales → tu cliente OAuth web → **Orígenes autorizados de JavaScript**, agrega:

```
https://paz-y-salvo-uniautonoma.vercel.app
```

(deja `http://localhost:5173` para seguir desarrollando). El login usa el botón de Google Identity Services,
que **no** necesita *URIs de redireccionamiento*. Los cambios pueden tardar unos minutos en propagarse.

---

## 8. Primer administrador

Quien entra por primera vez con Google queda registrado como trabajador sin verificar; el personal de áreas
(admin DTI, jefes, encargados, aprobador) se da de alta con `registrar-usuario`. Necesitas **al menos un
administrador DTI** para usar el panel de TI. Desde tu PC, en PowerShell, apuntando temporalmente a la base de
producción (las variables solo viven en esa ventana; no toques tu `.env`):

```powershell
cd paz-y-salvo-backend
$env:DB_HOST="aws-0-sa-east-1.pooler.supabase.com"; $env:DB_PORT="5432"; $env:DB_NAME="postgres"
$env:DB_USER="postgres.abcdxyz"; $env:DB_PASSWORD="la_contraseña_de_supabase"; $env:DB_SSL="true"
npm run registrar-usuario -- ana.perez@uniautonoma.edu.co "Ana Pérez" admin
```

Repite para cada persona (`jefe`, `encargado <dependencia>`, `aprobador`) y cierra esa ventana al terminar.
`dotenv` no sobrescribe variables ya definidas, así que estas tienen prioridad sobre tu `.env` local.

---

## 9. Verificación final

| Prueba | Resultado esperado |
|---|---|
| Abrir la URL de Vercel | Pantalla de login con el botón de Google (sin acceso con contraseña ni cuentas de prueba) |
| Entrar con la cuenta admin | Redirige a `/dashboard/admin` |
| Recargar (F5) en cualquier dashboard | No hay 404 (lo resuelve `vercel.json`) |
| DevTools → Network en una petición a la API | Va a `https://…onrender.com/api/v1/…`, estado 200, sin errores CORS |
| Entrar con una cuenta de trabajador | Queda pendiente de verificación y el admin recibe la notificación |
| Emitir un certificado y escanear su QR | Abre `https://…vercel.app/verificar/<token>` y muestra el certificado válido |
| Abrir `https://…vercel.app/cualquier-cosa` | Redirige a `/login` |

---

## 10. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Deploy de Render falla con `❌ Configuración de producción no válida` | Lee la lista en Logs: falta una variable, `JWT_SECRET` corto, o una URL quedó en `localhost`. |
| `❌ No se pudo conectar a la base de datos` | Usaste la conexión directa en vez del **Session pooler**, `DB_USER` sin el `.project_ref`, contraseña errada, o el proyecto Supabase está pausado (plan gratis tras 7 días sin uso). |
| En el navegador: `blocked by CORS policy` / 403 «Origen no permitido» | `CORS_ORIGINS` no coincide exacto con la URL de Vercel (barra final, `http`, dominio de preview). |
| Botón de Google no aparece | Falta `VITE_GOOGLE_CLIENT_ID` en Vercel o no se hizo Redeploy después de agregarlo. |
| Google: `origin_mismatch` / «The given origin is not allowed» | Falta la URL de Vercel en *Orígenes autorizados de JavaScript* (paso 7). |
| Login responde 401 de dominio | La cuenta no es `@uniautonoma.edu.co` o `GOOGLE_HOSTED_DOMAIN` está mal. |
| Las peticiones van a `localhost:3000` | `VITE_API_URL` no estaba definida al compilar: agrégala y haz Redeploy. |
| 404 al recargar una ruta | `vercel.json` no está en `paz-y-salvo-frontend/` o el *Root Directory* de Vercel es otro. |
| Muchos 429 «Demasiadas solicitudes» | Falta `TRUST_PROXY=1` en Render. |
| La primera petición tarda ~1 minuto | Plan **Free** de Render: el servicio se duerme tras 15 min sin tráfico. Usa `Starter` para producción real. |

---

## Notas de operación

- **Despliegue continuo**: cada `git push` a `main` redespliega Render y Vercel automáticamente. Si cambias solo
  variables de entorno, Render redespliega solo; en Vercel debes hacer *Redeploy*.
- **Una sola instancia en Render**: el límite de peticiones se guarda en memoria; si escalas a varias
  instancias, cada una cuenta por separado.
- **Dominio propio** (p. ej. `pazysalvo.uniautonoma.edu.co`): agrégalo en Vercel → *Domains* (DNS con CNAME a
  `cname.vercel-dns.com`), y luego actualiza `CORS_ORIGINS`, `FRONTEND_PUBLIC_URL` en Render y el origen en
  Google. Para la API igual: Render → *Custom Domains*, y actualiza `API_PUBLIC_URL` y `VITE_API_URL` (+ Redeploy).
- **Copias de seguridad**: el plan gratis de Supabase no tiene backups automáticos descargables; para datos
  reales considera el plan Pro o un `pg_dump` periódico.
- **Secretos**: si `JWT_SECRET` o `DB_PASSWORD` se filtran (chat, captura, repo), cámbialos en Supabase/Render.
  Cambiar `JWT_SECRET` cierra todas las sesiones activas.
