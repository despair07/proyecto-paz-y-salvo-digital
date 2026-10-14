# Decisiones de diseño de la base de datos

Historial de las decisiones tomadas en el DDL v2.0 (`ddl.sql`). Las propuestas pendientes de la v1.0 quedaron resueltas.

## Resueltas en v2.0

| Tema | Decisión | Motivo |
|------|----------|--------|
| Informe de entrega de cargo (RF-010, antes TODO-BD-01) | Tabla `informes_entrega_cargo` con `secciones JSONB`, `estado` BORRADOR/COMPLETO y validación del Jefe Inmediato | El backend ya maneja `{estado, secciones}`; las 8 secciones tienen campos heterogéneos. `solicitudes.informe_entrega_cargo` se sincroniza por trigger |
| Etapas jerárquicas (RN-008, antes TODO-BD-02) | Columna `solicitudes_paz_y_salvo.etapa_actual` con CHECK (JEFE_INMEDIATO → AREAS_GESTION → COMUNIDAD_UNIVERSITARIA → FINALIZADO) y `dependencias.etapa` | Evita derivar la etapa en cada consulta. Lo avanza el backend |
| Columnas duplicadas | Se eliminan `nombre_dependencia`, `motivo`, `observacion`, `planes_aula`, `informes_ejecucion`, `innovaciones_educativas`, `evaluado_por`, `estado_activo`, `codigo_qr_token`, `url_pdf_storage` y `bloqueos.usuario_id` | Una sola columna por dato; dejaban la BD inconsistente |
| Valores válidos | CHECK en estados, categorías (RN-003), novedad, vinculación y formato de correo | Los datos inválidos no entran aunque falle el backend |
| Reglas en BD | Triggers para RN-001, 002, 004, 005, 006, 007 y 010; índice único de un bloqueo activo por área | Defensa en profundidad |
| Auditoría | Tabla `auditoria` alimentada por triggers con `app.user_id` y `app.audit_reason` (los fija `withUserContext`) | Trazabilidad institucional |
| Seguridad | RLS activo en todas las tablas sin políticas para `anon`/`authenticated`; el backend usa el rol `postgres` | La API REST de Supabase no debe exponer datos de personal |
| Catálogo de cargos | Tabla `catalogo_cargos` (la usan `/cargos` y RN-011) | Existía en el código pero no en el DDL |

## Pendientes

- **TODO-ADMIN-01**: definir si el Admin DTI podrá crear usuarios y asignar roles desde la UI.
- **Política de rechazo**: `RECHAZADO` exige `observaciones_aprobacion` y `etapa_actual = 'FINALIZADO'`.
