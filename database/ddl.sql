-- ============================================================================
-- PAZ & SALVO DIGITAL UNIAUTÓNOMA — DDL CANÓNICO v3.0
-- Corporación Universitaria Autónoma del Cauca · PostgreSQL 15+ (Supabase)
--
-- ÚNICA fuente de verdad de la estructura de la base de datos.
-- Orden de ejecución:  1) ddl.sql   2) seed_maestro.sql   3) seed_demo.sql
--
-- ⚠ ESTE ARCHIVO ES DESTRUCTIVO: la sección 0 elimina las tablas del sistema y las
--   vuelve a crear vacías. No lo ejecutes sobre datos que quieras conservar sin respaldarlos.
--
-- Qué modela (formato GTH-07 v2 + informe final por entrega de cargo)
--   · El trabajador diligencia su trámite: datos generales → solicitud de aprobación a cada
--     dependencia (jefe inmediato y áreas en paralelo) → informe por entrega de cargo →
--     cláusula y firma → solicitud de aprobación final.
--   · Cada dependencia aprueba (con su "Recibí" y su firma) o bloquea (con categoría y motivo).
--   · Comunidad Universitaria aprueba o rechaza; un rechazo se reinicia con los datos copiados.
--
-- Estados de la solicitud (estado_global)
--   BORRADOR → EN_PROCESO → AL_DIA → PENDIENTE_APROBACION → APROBADO_FINAL | RECHAZADO
--   Los tres primeros se recalculan solos según las revisiones por dependencia (RN-001).
--
-- Reglas protegidas por la propia base de datos
--   RN-001 estado automático · RN-002 aprobación solo del aprobador · RN-003 categorías ·
--   RN-004 solo el encargado de la dependencia revisa · RN-005 sin bloqueos activos ·
--   RN-006 certificado tras la aprobación · RN-007 entregables docentes · RN-009 motivo ·
--   RN-010 informe completo · RN-012 tipo de vinculación · RN-013 nadie revisa su propio
--   trámite · RN-014 aprobar exige "Recibí" y firma · RN-015 enlace obligatorio (SST) ·
--   RN-016 cláusula aceptada y firma del trabajador para la solicitud final.
--
-- RLS activado en todas las tablas: la API REST de Supabase (anon / authenticated) no puede
-- leer ni escribir; solo el backend (rol postgres).
-- ============================================================================


-- ============================================================================
-- 0. LIMPIEZA (idempotente)
-- ============================================================================
DROP VIEW  IF EXISTS v_estado_dependencias_solicitud CASCADE;
DROP VIEW  IF EXISTS v_resumen_paz_y_salvo CASCADE;

DROP TABLE IF EXISTS notificaciones            CASCADE;
DROP TABLE IF EXISTS auditoria                CASCADE;
DROP TABLE IF EXISTS certificados_digitales   CASCADE;
DROP TABLE IF EXISTS entregables_profesorales CASCADE;
DROP TABLE IF EXISTS bloqueos_dependencia     CASCADE;
DROP TABLE IF EXISTS revisiones_area          CASCADE;
DROP TABLE IF EXISTS informes_entrega_cargo   CASCADE;
DROP TABLE IF EXISTS solicitudes_paz_y_salvo  CASCADE;
DROP TABLE IF EXISTS firmas_usuario           CASCADE;
DROP TABLE IF EXISTS catalogo_cargos          CASCADE;
DROP TABLE IF EXISTS periodos_academicos      CASCADE;
DROP TABLE IF EXISTS encargados_dependencia   CASCADE;
DROP TABLE IF EXISTS dependencias             CASCADE;
DROP TABLE IF EXISTS usuario_roles            CASCADE;
DROP TABLE IF EXISTS usuarios                 CASCADE;
DROP TABLE IF EXISTS roles                    CASCADE;

DROP FUNCTION IF EXISTS fn_actualizar_estado_global_solicitud() CASCADE;
DROP FUNCTION IF EXISTS fn_recalcular_estado_solicitud(UUID)    CASCADE;
DROP FUNCTION IF EXISTS fn_dependencias_aplicables(UUID)        CASCADE;
DROP FUNCTION IF EXISTS fn_datos_generales_completos(UUID)      CASCADE;
DROP FUNCTION IF EXISTS fn_es_encargado(UUID, UUID)             CASCADE;
DROP FUNCTION IF EXISTS fn_trg_bloqueos_recalcular()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_bloqueos_validar()               CASCADE;
DROP FUNCTION IF EXISTS fn_trg_revisiones_validar()             CASCADE;
DROP FUNCTION IF EXISTS fn_trg_revisiones_propagar()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_solicitudes_validar()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_solicitudes_inicializar()        CASCADE;
DROP FUNCTION IF EXISTS fn_trg_informes_validar()               CASCADE;
DROP FUNCTION IF EXISTS fn_trg_informes_sincronizar()           CASCADE;
DROP FUNCTION IF EXISTS fn_trg_entregables_validar()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_entregables_recalcular()         CASCADE;
DROP FUNCTION IF EXISTS fn_trg_certificados_validar()           CASCADE;
DROP FUNCTION IF EXISTS fn_trg_auditar()                        CASCADE;
DROP FUNCTION IF EXISTS fn_trg_touch_updated_at()               CASCADE;
DROP FUNCTION IF EXISTS fn_trg_usuarios_tipo_vinculacion()      CASCADE;


-- ============================================================================
-- 1. CATÁLOGOS Y SEGURIDAD
-- ============================================================================

-- 1.1 roles (RBAC)
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_rol  VARCHAR(80)  NOT NULL UNIQUE,
  descripcion TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_roles_nombre CHECK (nombre_rol IN (
    'Docente', 'Administrativo', 'Contratista', 'Jefe Inmediato',
    'Encargado de Área', 'Aprobador Comunidad Universitaria', 'Administrador DTI'
  ))
);
COMMENT ON TABLE roles IS 'Los 7 roles RBAC institucionales.';

-- 1.2 usuarios
CREATE TABLE usuarios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres              VARCHAR(120) NOT NULL,
  apellidos            VARCHAR(160) NOT NULL,
  tipo_documento       VARCHAR(10)  NOT NULL DEFAULT 'CC',
  numero_documento     VARCHAR(40)  UNIQUE,         -- NULL hasta que el trabajador lo diligencia
  correo_institucional VARCHAR(255) NOT NULL UNIQUE,
  tipo_vinculacion     VARCHAR(30),                 -- NULL hasta que la persona lo elige (RN-012)
  estado               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
  cargo                VARCHAR(150),                -- cargo actual; lo edita el Admin DTI (RN-011)
  origen               VARCHAR(20)  NOT NULL DEFAULT 'REGISTRADO_TI',
  verificado           BOOLEAN      NOT NULL DEFAULT TRUE,
  verificado_por       UUID         REFERENCES usuarios(id),
  fecha_verificacion   TIMESTAMPTZ,
  google_sub           VARCHAR(64)  UNIQUE,         -- identificador estable de la cuenta de Google
  ultimo_acceso        TIMESTAMPTZ,
  password_hash        TEXT,                        -- bcrypt; solo para desarrollo (AUTH_PASSWORD_ENABLED)
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_usuarios_tipo_doc   CHECK (tipo_documento IN ('CC', 'CE', 'PA', 'TI')),
  CONSTRAINT ck_usuarios_vinculacion CHECK (tipo_vinculacion IN ('Docente', 'Administrativo', 'Contratista')),
  CONSTRAINT ck_usuarios_estado     CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  CONSTRAINT ck_usuarios_origen     CHECK (origen IN ('REGISTRADO_TI', 'AUTOREGISTRO')),
  -- Lo que registra TI nace verificado; solo el autoregistro puede estar sin verificar
  CONSTRAINT ck_usuarios_verificado CHECK (verificado OR origen = 'AUTOREGISTRO'),
  CONSTRAINT ck_usuarios_correo     CHECK (
    correo_institucional = LOWER(correo_institucional)
    AND correo_institucional LIKE '%@uniautonoma.edu.co'
  )
);
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt. Nunca exponer en respuestas de la API.';
COMMENT ON COLUMN usuarios.verificado IS 'Autoregistro nace FALSE hasta que TI o Talento Humano confirma la vinculación.';

-- 1.3 usuario_roles (N:M)
CREATE TABLE usuario_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id     UUID NOT NULL REFERENCES roles(id)    ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, rol_id)
);

-- 1.4 dependencias (Jefe Inmediato + 7 áreas + 1 aprobadora final)
CREATE TABLE dependencias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(180) NOT NULL UNIQUE,
  descripcion         TEXT,                                      -- sección del formato a la que pertenece
  aspecto             TEXT,                                      -- "Aspecto sobre el que se da paz y salvo" (GTH-07)
  etapa               SMALLINT     NOT NULL DEFAULT 2,           -- 1 Jefe · 2 Áreas · 3 Comunidad
  orden               SMALLINT     NOT NULL DEFAULT 0,           -- orden de aparición en el formato
  solo_docentes       BOOLEAN      NOT NULL DEFAULT FALSE,       -- RN-007
  aplica_cambio_dependencia BOOLEAN NOT NULL DEFAULT TRUE,       -- ¿firma también en un cambio de dependencia?
  requiere_enlace     BOOLEAN      NOT NULL DEFAULT FALSE,       -- RN-015: el trabajador adjunta un enlace al solicitar
  etiqueta_enlace     VARCHAR(160),
  es_aprobadora_final BOOLEAN      NOT NULL DEFAULT FALSE,       -- RN-002
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dependencias_etapa CHECK (etapa IN (1, 2, 3)),
  CONSTRAINT ck_dependencias_final CHECK (es_aprobadora_final = (etapa = 3))
);
-- Solo puede existir una dependencia aprobadora final
CREATE UNIQUE INDEX uq_dependencias_aprobadora_final ON dependencias ((TRUE)) WHERE es_aprobadora_final;

-- 1.5 encargados_dependencia
CREATE TABLE encargados_dependencia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID    NOT NULL REFERENCES usuarios(id)     ON DELETE CASCADE,
  dependencia_id    UUID    NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
  es_jefe_inmediato BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, dependencia_id)
);

-- 1.6 periodos_academicos
CREATE TABLE periodos_academicos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_periodo VARCHAR(20) NOT NULL UNIQUE,
  activo         BOOLEAN     NOT NULL DEFAULT FALSE,
  fecha_inicio   DATE        NOT NULL,
  fecha_fin      DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_periodos_fechas CHECK (fecha_fin > fecha_inicio)
);
-- Solo un periodo activo a la vez
CREATE UNIQUE INDEX uq_periodos_activo ON periodos_academicos ((TRUE)) WHERE activo;

-- 1.7 catalogo_cargos (RN-011: el Admin DTI solo edita el nombre)
CREATE TABLE catalogo_cargos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           VARCHAR(150) NOT NULL UNIQUE,
  tipo_vinculacion VARCHAR(30),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_cargos_vinculacion CHECK (tipo_vinculacion IS NULL
    OR tipo_vinculacion IN ('Docente', 'Administrativo', 'Contratista'))
);

-- 1.8 firmas_usuario: firma dibujada por la persona (PNG en data URL), reutilizada al firmar
CREATE TABLE firmas_usuario (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  imagen     TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_firma_formato CHECK (imagen LIKE 'data:image/png;base64,%'),
  CONSTRAINT ck_firma_tamano  CHECK (LENGTH(imagen) <= 300000)
);
COMMENT ON TABLE firmas_usuario IS 'Dato sensible: solo la ve su dueño; al firmar se copia como evidencia del documento.';


-- ============================================================================
-- 2. NÚCLEO DEL TRÁMITE
-- ============================================================================

-- 2.1 solicitudes_paz_y_salvo (un trámite por persona y periodo; tras un rechazo se abre otro)
CREATE TABLE solicitudes_paz_y_salvo (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id                 UUID         NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  periodo_academico_id       UUID         NOT NULL REFERENCES periodos_academicos(id),
  solicitud_anterior_id      UUID         REFERENCES solicitudes_paz_y_salvo(id),   -- trámite rechazado del que se copió
  -- 1. Datos generales del trabajador o contratista (copia editable mientras es BORRADOR)
  nombre_completo            VARCHAR(300),
  tipo_documento             VARCHAR(10)  NOT NULL DEFAULT 'CC',
  numero_documento           VARCHAR(40),
  lugar_expedicion_documento VARCHAR(180),
  cargo_desempenado          VARCHAR(180),
  tipo_novedad               VARCHAR(30)  NOT NULL DEFAULT 'RETIRO',
  fecha_retiro               DATE,
  jefe_inmediato_id          UUID         REFERENCES usuarios(id),
  -- Estado
  fecha_solicitud            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  estado_global              VARCHAR(30)  NOT NULL DEFAULT 'BORRADOR',
  informe_entrega_cargo      BOOLEAN      NOT NULL DEFAULT FALSE,   -- sincronizado desde informes_entrega_cargo
  -- Cierre del trabajador: observaciones, cláusula de confidencialidad y firma
  observaciones_trabajador   TEXT,
  clausula_aceptada          BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_clausula             TIMESTAMPTZ,
  firma_trabajador           TEXT,
  fecha_solicitud_final      TIMESTAMPTZ,
  -- Resolución de Comunidad Universitaria
  aprobado_final             BOOLEAN      NOT NULL DEFAULT FALSE,
  aprobador_final_id         UUID         REFERENCES usuarios(id),
  fecha_aprobacion_final     TIMESTAMPTZ,
  observaciones_aprobacion   TEXT,
  firma_aprobador            TEXT,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_solicitud_tipo_doc CHECK (tipo_documento IN ('CC', 'CE', 'PA', 'TI')),
  CONSTRAINT ck_solicitud_novedad CHECK (tipo_novedad IN ('RETIRO', 'CAMBIO_DEPENDENCIA')),
  CONSTRAINT ck_solicitud_estado  CHECK (estado_global IN
    ('BORRADOR', 'EN_PROCESO', 'AL_DIA', 'PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO')),
  -- Salvo en borrador, los datos generales son obligatorios
  CONSTRAINT ck_solicitud_datos CHECK (
    estado_global = 'BORRADOR' OR (
      NULLIF(BTRIM(nombre_completo), '') IS NOT NULL
      AND NULLIF(BTRIM(numero_documento), '') IS NOT NULL
      AND NULLIF(BTRIM(lugar_expedicion_documento), '') IS NOT NULL
      AND NULLIF(BTRIM(cargo_desempenado), '') IS NOT NULL
      AND (tipo_novedad <> 'RETIRO' OR fecha_retiro IS NOT NULL)
    )
  ),
  CONSTRAINT ck_solicitud_firmas CHECK (
    (firma_trabajador IS NULL OR (firma_trabajador LIKE 'data:image/png;base64,%' AND LENGTH(firma_trabajador) <= 300000))
    AND (firma_aprobador IS NULL OR (firma_aprobador LIKE 'data:image/png;base64,%' AND LENGTH(firma_aprobador) <= 300000))
  ),
  CONSTRAINT ck_solicitud_clausula CHECK (clausula_aceptada = (fecha_clausula IS NOT NULL)),
  -- RN-016: para pedir la aprobación final hay cláusula aceptada y firma del trabajador
  CONSTRAINT ck_solicitud_pendiente CHECK (
    estado_global NOT IN ('PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO')
    OR (clausula_aceptada AND firma_trabajador IS NOT NULL AND fecha_solicitud_final IS NOT NULL)
  ),
  CONSTRAINT ck_solicitud_aprobacion CHECK (
    (aprobado_final = (estado_global = 'APROBADO_FINAL'))
    AND (NOT aprobado_final OR (aprobador_final_id IS NOT NULL AND fecha_aprobacion_final IS NOT NULL
                                AND firma_aprobador IS NOT NULL))
  ),
  CONSTRAINT ck_solicitud_rechazo CHECK (
    estado_global <> 'RECHAZADO'
    OR (NULLIF(BTRIM(observaciones_aprobacion), '') IS NOT NULL AND aprobador_final_id IS NOT NULL)
  )
);
-- Una persona tiene un solo trámite vigente por periodo; los rechazados quedan como historial
CREATE UNIQUE INDEX uq_solicitud_vigente
  ON solicitudes_paz_y_salvo (usuario_id, periodo_academico_id) WHERE estado_global <> 'RECHAZADO';
COMMENT ON COLUMN solicitudes_paz_y_salvo.estado_global IS
  'BORRADOR (nada solicitado) · EN_PROCESO · AL_DIA (todas las dependencias aprobaron, RN-001) · PENDIENTE_APROBACION · APROBADO_FINAL · RECHAZADO.';

-- 2.2 informes_entrega_cargo (formato "Informe final por entrega de cargo", secciones I a VIII)
CREATE TABLE informes_entrega_cargo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id      UUID        NOT NULL UNIQUE REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  estado            VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  secciones         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  fecha_completado  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_informe_estado    CHECK (estado IN ('BORRADOR', 'COMPLETO')),
  CONSTRAINT ck_informe_secciones CHECK (jsonb_typeof(secciones) = 'object'),
  CONSTRAINT ck_informe_completo  CHECK (estado <> 'COMPLETO' OR fecha_completado IS NOT NULL)
);

-- 2.3 revisiones_area: la solicitud del trabajador a cada dependencia y su decisión.
--     Solo existe la fila de una dependencia cuando el trabajador ya la solicitó.
CREATE TABLE revisiones_area (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id    UUID        NOT NULL REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  dependencia_id  UUID        NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
  estado          VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA',
  solicitada_el   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intentos        SMALLINT    NOT NULL DEFAULT 1,
  enlace          TEXT,                         -- RN-015 (p. ej. certificado de horas de SST)
  revisor_id      UUID        REFERENCES usuarios(id),
  fecha_revision  TIMESTAMPTZ,
  recibi          TEXT,                         -- "Recibí / Revisé…": lo que el área verificó (RN-014)
  firma_snapshot  TEXT,                         -- firma del revisor al aprobar (evidencia)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (solicitud_id, dependencia_id),
  CONSTRAINT ck_revision_estado CHECK (estado IN ('SOLICITADA', 'APROBADA', 'BLOQUEADA')),
  CONSTRAINT ck_revision_decision CHECK (
    (estado = 'SOLICITADA' AND revisor_id IS NULL AND fecha_revision IS NULL AND recibi IS NULL AND firma_snapshot IS NULL)
    OR (estado = 'BLOQUEADA' AND revisor_id IS NOT NULL AND fecha_revision IS NOT NULL)
    OR (estado = 'APROBADA' AND revisor_id IS NOT NULL AND fecha_revision IS NOT NULL
        AND NULLIF(BTRIM(recibi), '') IS NOT NULL AND firma_snapshot IS NOT NULL)
  ),
  CONSTRAINT ck_revision_firma CHECK (
    firma_snapshot IS NULL OR (firma_snapshot LIKE 'data:image/png;base64,%' AND LENGTH(firma_snapshot) <= 300000)
  ),
  CONSTRAINT ck_revision_enlace CHECK (enlace IS NULL OR (enlace ~* '^https://[^[:space:]]+$' AND LENGTH(enlace) <= 500))
);

-- 2.4 bloqueos_dependencia: historial de lo que una dependencia observó (RN-003, RN-009)
CREATE TABLE bloqueos_dependencia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id           UUID         NOT NULL REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  dependencia_id         UUID         NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
  registrado_por_id      UUID         NOT NULL REFERENCES usuarios(id),
  categoria              VARCHAR(40)  NOT NULL,
  motivo_descripcion     TEXT         NOT NULL,
  estado                 VARCHAR(20)  NOT NULL DEFAULT 'BLOQUEADO',
  fecha_registro         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resuelto_por_id        UUID         REFERENCES usuarios(id),
  fecha_resolucion       TIMESTAMPTZ,
  observacion_resolucion TEXT,
  CONSTRAINT ck_bloqueo_categoria CHECK (categoria IN (
    'FINANCIERO', 'INVENTARIO_ELEMENTOS', 'DOCUMENTAL_ENTREGABLES', 'ACADEMICO_PROFESORAL'
  )),
  CONSTRAINT ck_bloqueo_estado  CHECK (estado IN ('BLOQUEADO', 'RESUELTO')),
  CONSTRAINT ck_bloqueo_motivo  CHECK (NULLIF(BTRIM(motivo_descripcion), '') IS NOT NULL),
  CONSTRAINT ck_bloqueo_resolucion CHECK (
    (estado = 'RESUELTO') = (resuelto_por_id IS NOT NULL AND fecha_resolucion IS NOT NULL)
  )
);
-- Un solo bloqueo activo por dependencia y trámite
CREATE UNIQUE INDEX uq_bloqueo_activo_por_area
  ON bloqueos_dependencia (solicitud_id, dependencia_id) WHERE estado = 'BLOQUEADO';

-- 2.5 entregables_profesorales (RN-007, solo docentes)
CREATE TABLE entregables_profesorales (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id                     UUID    NOT NULL UNIQUE REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  planes_aula_aprobado             BOOLEAN NOT NULL DEFAULT FALSE,
  innovaciones_educativas_aprobado BOOLEAN NOT NULL DEFAULT FALSE,
  informes_ejecucion_aprobado      BOOLEAN NOT NULL DEFAULT FALSE,
  completo                         BOOLEAN GENERATED ALWAYS AS (
    planes_aula_aprobado AND innovaciones_educativas_aprobado AND informes_ejecucion_aprobado
  ) STORED,
  evaluador_id                     UUID    REFERENCES usuarios(id),
  fecha_evaluacion                 TIMESTAMPTZ,
  observaciones                    TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 certificados_digitales (RN-006)
CREATE TABLE certificados_digitales (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id       UUID         NOT NULL UNIQUE REFERENCES solicitudes_paz_y_salvo(id) ON DELETE RESTRICT,
  token_verificacion VARCHAR(255) NOT NULL UNIQUE,   -- va dentro del código QR
  hash_verificacion  CHAR(64)     NOT NULL,          -- SHA-256 hexadecimal
  archivo_url        TEXT         NOT NULL,
  emitido_por        UUID         NOT NULL REFERENCES usuarios(id),
  fecha_emision      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_cert_token CHECK (LENGTH(token_verificacion) >= 32),
  CONSTRAINT ck_cert_hash  CHECK (hash_verificacion ~ '^[0-9a-f]{64}$')
);

-- 2.7 auditoria (trazabilidad de cambios)
CREATE TABLE auditoria (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla            VARCHAR(63) NOT NULL,
  registro_id      UUID,
  accion           VARCHAR(10) NOT NULL,
  usuario_id       UUID,                    -- app.user_id (set por el backend)
  motivo           TEXT,                    -- app.audit_reason
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_auditoria_accion CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- 2.8 notificaciones (avisos dentro del sistema)
CREATE TABLE notificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo          VARCHAR(40)  NOT NULL,
  titulo        VARCHAR(160) NOT NULL,
  mensaje       TEXT         NOT NULL,
  referencia    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  leida         BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_lectura TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_notificaciones_lectura CHECK (leida = (fecha_lectura IS NOT NULL))
);


-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE INDEX idx_usuario_roles_rol          ON usuario_roles (rol_id);
CREATE INDEX idx_encargados_dependencia     ON encargados_dependencia (dependencia_id);
CREATE INDEX idx_solicitudes_periodo        ON solicitudes_paz_y_salvo (periodo_academico_id);
CREATE INDEX idx_solicitudes_estado         ON solicitudes_paz_y_salvo (estado_global);
CREATE INDEX idx_solicitudes_jefe           ON solicitudes_paz_y_salvo (jefe_inmediato_id);
CREATE INDEX idx_solicitudes_usuario        ON solicitudes_paz_y_salvo (usuario_id, fecha_solicitud DESC);
CREATE INDEX idx_revisiones_dependencia     ON revisiones_area (dependencia_id, estado);
CREATE INDEX idx_revisiones_revisor         ON revisiones_area (revisor_id);
CREATE INDEX idx_bloqueos_solicitud_estado  ON bloqueos_dependencia (solicitud_id, estado);
CREATE INDEX idx_bloqueos_dependencia_estado ON bloqueos_dependencia (dependencia_id, estado);
CREATE INDEX idx_bloqueos_registrado_por    ON bloqueos_dependencia (registrado_por_id);
CREATE INDEX idx_entregables_evaluador      ON entregables_profesorales (evaluador_id);
CREATE INDEX idx_certificados_emitido_por   ON certificados_digitales (emitido_por);
CREATE INDEX idx_auditoria_registro         ON auditoria (tabla, registro_id);
CREATE INDEX idx_auditoria_fecha            ON auditoria (fecha DESC);
CREATE INDEX idx_notificaciones_usuario     ON notificaciones (usuario_id, leida, created_at DESC);
CREATE INDEX idx_usuarios_verificado        ON usuarios (verificado) WHERE NOT verificado;


-- ============================================================================
-- 4. FUNCIONES Y TRIGGERS — REGLAS DE NEGOCIO EN BASE DE DATOS
-- ============================================================================

-- 4.1 updated_at automático
CREATE FUNCTION fn_trg_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_updated      BEFORE UPDATE ON usuarios                 FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();
CREATE TRIGGER trg_solicitudes_updated   BEFORE UPDATE ON solicitudes_paz_y_salvo  FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();
CREATE TRIGGER trg_informes_updated      BEFORE UPDATE ON informes_entrega_cargo   FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();
CREATE TRIGGER trg_revisiones_updated    BEFORE UPDATE ON revisiones_area          FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();
CREATE TRIGGER trg_entregables_updated   BEFORE UPDATE ON entregables_profesorales FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();
CREATE TRIGGER trg_firmas_updated        BEFORE UPDATE ON firmas_usuario           FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();

-- 4.2 Funciones de apoyo
-- Dependencias que debe firmar un trámite: sin la aprobadora final, solo docentes para docentes
-- y, en un cambio de dependencia, solo las que aplican en ese caso.
CREATE FUNCTION fn_dependencias_aplicables(p_solicitud_id UUID) RETURNS SETOF dependencias
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT d.*
    FROM dependencias d
    JOIN solicitudes_paz_y_salvo s ON s.id = p_solicitud_id
    JOIN usuarios u ON u.id = s.usuario_id
   WHERE NOT d.es_aprobadora_final
     AND (NOT d.solo_docentes OR u.tipo_vinculacion = 'Docente')
     AND (s.tipo_novedad = 'RETIRO' OR d.aplica_cambio_dependencia)
$$;

CREATE FUNCTION fn_datos_generales_completos(p_solicitud_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE((
    SELECT NULLIF(BTRIM(s.nombre_completo), '') IS NOT NULL
       AND NULLIF(BTRIM(s.numero_documento), '') IS NOT NULL
       AND NULLIF(BTRIM(s.lugar_expedicion_documento), '') IS NOT NULL
       AND NULLIF(BTRIM(s.cargo_desempenado), '') IS NOT NULL
       AND (s.tipo_novedad <> 'RETIRO' OR s.fecha_retiro IS NOT NULL)
      FROM solicitudes_paz_y_salvo s WHERE s.id = p_solicitud_id
  ), FALSE)
$$;

CREATE FUNCTION fn_es_encargado(p_usuario_id UUID, p_dependencia_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM encargados_dependencia e
                  WHERE e.usuario_id = p_usuario_id AND e.dependencia_id = p_dependencia_id)
$$;

-- 4.3 RN-012 · el tipo de vinculación no cambia con un trámite en curso (el borrador sí permite)
CREATE FUNCTION fn_trg_usuarios_tipo_vinculacion() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.tipo_vinculacion IS NOT NULL
     AND NEW.tipo_vinculacion IS DISTINCT FROM OLD.tipo_vinculacion
     AND EXISTS (SELECT 1 FROM solicitudes_paz_y_salvo s
                  WHERE s.usuario_id = NEW.id
                    AND s.estado_global IN ('EN_PROCESO', 'AL_DIA', 'PENDIENTE_APROBACION')) THEN
    RAISE EXCEPTION 'RN-012: no puede cambiar su tipo de vinculación mientras tenga un trámite de paz y salvo en curso'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_tipo_vinculacion
BEFORE UPDATE OF tipo_vinculacion ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_trg_usuarios_tipo_vinculacion();

-- 4.4 RN-001 · estado del trámite según las revisiones por dependencia
--   BORRADOR: no se ha solicitado nada · AL_DIA: todas las dependencias aplicables aprobaron y no hay
--   bloqueos activos · EN_PROCESO: el resto. No toca los estados de la aprobación final.
CREATE FUNCTION fn_recalcular_estado_solicitud(p_solicitud_id UUID) RETURNS VOID
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sol        solicitudes_paz_y_salvo%ROWTYPE;
  v_aplicables INT;
  v_aprobadas  INT;
  v_solicitadas INT;
  v_bloqueos   BOOLEAN;
  v_estado     VARCHAR(30);
BEGIN
  SELECT * INTO v_sol FROM solicitudes_paz_y_salvo WHERE id = p_solicitud_id;
  IF NOT FOUND OR v_sol.estado_global IN ('PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_aplicables FROM fn_dependencias_aplicables(p_solicitud_id);
  SELECT COUNT(*) FILTER (WHERE r.estado = 'APROBADA'), COUNT(*)
    INTO v_aprobadas, v_solicitadas
    FROM revisiones_area r
   WHERE r.solicitud_id = p_solicitud_id
     AND r.dependencia_id IN (SELECT a.id FROM fn_dependencias_aplicables(p_solicitud_id) a);
  v_bloqueos := EXISTS (SELECT 1 FROM bloqueos_dependencia b
                         WHERE b.solicitud_id = p_solicitud_id AND b.estado = 'BLOQUEADO');

  v_estado := CASE
                WHEN v_solicitadas = 0 AND NOT v_bloqueos THEN 'BORRADOR'
                WHEN v_aplicables > 0 AND v_aprobadas = v_aplicables AND NOT v_bloqueos THEN 'AL_DIA'
                ELSE 'EN_PROCESO'
              END;

  UPDATE solicitudes_paz_y_salvo SET estado_global = v_estado
   WHERE id = p_solicitud_id AND estado_global IS DISTINCT FROM v_estado;
END;
$$;

-- 4.5 Bloqueos: validación (RN-003/004/007) y recálculo del estado
CREATE FUNCTION fn_trg_bloqueos_recalcular() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fn_recalcular_estado_solicitud(OLD.solicitud_id);
    RETURN OLD;
  END IF;
  PERFORM fn_recalcular_estado_solicitud(NEW.solicitud_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloqueos_recalcular
AFTER INSERT OR DELETE OR UPDATE OF estado ON bloqueos_dependencia
FOR EACH ROW EXECUTE FUNCTION fn_trg_bloqueos_recalcular();

CREATE FUNCTION fn_trg_bloqueos_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_estado_solicitud VARCHAR(30);
  v_vinculacion      VARCHAR(30);
  v_dep              dependencias%ROWTYPE;
BEGIN
  SELECT * INTO v_dep FROM dependencias WHERE id = NEW.dependencia_id;

  IF TG_OP = 'INSERT' THEN
    SELECT s.estado_global, u.tipo_vinculacion
      INTO v_estado_solicitud, v_vinculacion
      FROM solicitudes_paz_y_salvo s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.id = NEW.solicitud_id;

    IF v_estado_solicitud IN ('PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO') THEN
      RAISE EXCEPTION 'El trámite ya está en aprobación final o cerrado (%) y no admite nuevos bloqueos', v_estado_solicitud
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_dep.es_aprobadora_final THEN
      RAISE EXCEPTION 'RN-002: la dependencia aprobadora final no registra bloqueos'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_dep.solo_docentes AND v_vinculacion <> 'Docente' THEN
      RAISE EXCEPTION 'RN-007: % solo evalúa a personal docente', v_dep.nombre
        USING ERRCODE = 'check_violation';
    END IF;
    -- RN-004: solo un encargado de la propia dependencia registra bloqueos
    IF NOT fn_es_encargado(NEW.registrado_por_id, NEW.dependencia_id) THEN
      RAISE EXCEPTION 'RN-004: el usuario no es encargado de la dependencia %', v_dep.nombre
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.solicitud_id <> OLD.solicitud_id OR NEW.dependencia_id <> OLD.dependencia_id THEN
      RAISE EXCEPTION 'No se puede cambiar el trámite ni la dependencia de un bloqueo'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.estado = 'RESUELTO' AND NEW.estado = 'BLOQUEADO' THEN
      RAISE EXCEPTION 'Un bloqueo resuelto no se reabre; la dependencia registra uno nuevo'
        USING ERRCODE = 'check_violation';
    END IF;
    -- RN-004 al levantar el bloqueo
    IF OLD.estado = 'BLOQUEADO' AND NEW.estado = 'RESUELTO'
       AND NOT fn_es_encargado(NEW.resuelto_por_id, NEW.dependencia_id) THEN
      RAISE EXCEPTION 'RN-004: el usuario no es encargado de la dependencia %', v_dep.nombre
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloqueos_validar
BEFORE INSERT OR UPDATE ON bloqueos_dependencia
FOR EACH ROW EXECUTE FUNCTION fn_trg_bloqueos_validar();

-- 4.6 Revisiones por dependencia: la solicitud del trabajador y la decisión del área
CREATE FUNCTION fn_trg_revisiones_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sol     solicitudes_paz_y_salvo%ROWTYPE;
  v_dep     dependencias%ROWTYPE;
  v_request BOOLEAN;
BEGIN
  SELECT * INTO v_sol FROM solicitudes_paz_y_salvo WHERE id = NEW.solicitud_id;
  SELECT * INTO v_dep FROM dependencias WHERE id = NEW.dependencia_id;

  IF v_sol.estado_global NOT IN ('BORRADOR', 'EN_PROCESO') THEN
    RAISE EXCEPTION 'El trámite está en estado % y no admite cambios en las revisiones de las dependencias', v_sol.estado_global
      USING ERRCODE = 'check_violation';
  END IF;

  -- Solicitud nueva o nueva solicitud tras un bloqueo (OLD no existe en un INSERT)
  v_request := (TG_OP = 'INSERT');
  IF TG_OP = 'UPDATE' THEN
    v_request := (OLD.estado = 'BLOQUEADA' AND NEW.estado = 'SOLICITADA');
  END IF;

  IF v_request THEN
    IF NOT EXISTS (SELECT 1 FROM fn_dependencias_aplicables(NEW.solicitud_id) a WHERE a.id = NEW.dependencia_id) THEN
      RAISE EXCEPTION '% no aplica para este trámite', v_dep.nombre USING ERRCODE = 'check_violation';
    END IF;
    IF NOT fn_datos_generales_completos(NEW.solicitud_id) THEN
      RAISE EXCEPTION 'Complete los datos generales antes de solicitar la aprobación de una dependencia'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_dep.etapa = 1 THEN
      IF v_sol.jefe_inmediato_id IS NULL THEN
        RAISE EXCEPTION 'Seleccione su jefe inmediato antes de solicitar su paz y salvo'
          USING ERRCODE = 'check_violation';
      END IF;
      IF NOT v_sol.informe_entrega_cargo THEN
        RAISE EXCEPTION 'RN-010: el informe por entrega de cargo debe estar completo antes de pedir el paz y salvo del jefe inmediato'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF v_dep.requiere_enlace AND NEW.enlace IS NULL THEN
      RAISE EXCEPTION 'RN-015: % requiere un enlace (%)', v_dep.nombre, COALESCE(v_dep.etiqueta_enlace, 'adjunto')
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.estado := 'SOLICITADA';
    NEW.solicitada_el := NOW();
    NEW.revisor_id := NULL;
    NEW.fecha_revision := NULL;
    NEW.recibi := NULL;
    NEW.firma_snapshot := NULL;
    IF TG_OP = 'UPDATE' THEN NEW.intentos := OLD.intentos + 1; END IF;
    RETURN NEW;
  END IF;

  -- Decisión del área sobre una revisión solicitada
  IF OLD.estado = 'SOLICITADA' AND NEW.estado IN ('APROBADA', 'BLOQUEADA') THEN
    -- RN-013: nadie revisa su propio trámite
    IF NEW.revisor_id = v_sol.usuario_id THEN
      RAISE EXCEPTION 'RN-013: no puede revisar su propio trámite' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- RN-004: solo un encargado de la dependencia (el jefe inmediato elegido, en su caso)
    IF NOT fn_es_encargado(NEW.revisor_id, NEW.dependencia_id)
       OR (v_dep.etapa = 1 AND NEW.revisor_id IS DISTINCT FROM v_sol.jefe_inmediato_id) THEN
      RAISE EXCEPTION 'RN-004: el usuario no puede revisar este trámite en %', v_dep.nombre
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.estado = 'APROBADA' THEN
      -- RN-007: Desarrollo Profesoral exige los 3 entregables
      IF v_dep.solo_docentes AND NOT EXISTS (
        SELECT 1 FROM entregables_profesorales e WHERE e.solicitud_id = NEW.solicitud_id AND e.completo) THEN
        RAISE EXCEPTION 'RN-007: el docente debe tener los 3 entregables aprobados por Desarrollo Profesoral'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      -- RN-009: bloquear exige haber registrado el motivo
      IF NOT EXISTS (SELECT 1 FROM bloqueos_dependencia b
                      WHERE b.solicitud_id = NEW.solicitud_id AND b.dependencia_id = NEW.dependencia_id
                        AND b.estado = 'BLOQUEADO') THEN
        RAISE EXCEPTION 'RN-009: registre la categoría y el motivo del bloqueo' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    NEW.fecha_revision := COALESCE(NEW.fecha_revision, NOW());
    RETURN NEW;
  END IF;

  IF OLD.estado = 'APROBADA' THEN
    RAISE EXCEPTION 'Una aprobación registrada no se modifica' USING ERRCODE = 'check_violation';
  END IF;

  -- Cambios menores sobre una revisión solicitada (p. ej. el enlace)
  IF OLD.estado = 'SOLICITADA' AND NEW.estado = 'SOLICITADA' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de la revisión no permitida (% → %)', OLD.estado, NEW.estado
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER trg_revisiones_validar
BEFORE INSERT OR UPDATE ON revisiones_area
FOR EACH ROW EXECUTE FUNCTION fn_trg_revisiones_validar();

-- Al aprobar una dependencia se levanta su bloqueo activo; luego se recalcula el estado
CREATE FUNCTION fn_trg_revisiones_propagar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'APROBADA' THEN
    UPDATE bloqueos_dependencia
       SET estado = 'RESUELTO', resuelto_por_id = NEW.revisor_id, fecha_resolucion = NOW(),
           observacion_resolucion = NEW.recibi
     WHERE solicitud_id = NEW.solicitud_id AND dependencia_id = NEW.dependencia_id AND estado = 'BLOQUEADO';
  END IF;
  PERFORM fn_recalcular_estado_solicitud(NEW.solicitud_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_revisiones_propagar
AFTER INSERT OR UPDATE ON revisiones_area
FOR EACH ROW EXECUTE FUNCTION fn_trg_revisiones_propagar();

-- 4.7 Solicitud: transiciones del trámite (RN-001/002/005/010/016) y datos congelados
CREATE FUNCTION fn_trg_solicitudes_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_aplicables INT;
  v_aprobadas  INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado_global <> 'BORRADOR' THEN
      RAISE EXCEPTION 'Un trámite nuevo siempre comienza en BORRADOR' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Los datos generales solo se editan mientras no se haya solicitado nada (BORRADOR)
  IF OLD.estado_global <> 'BORRADOR' AND (
       NEW.nombre_completo IS DISTINCT FROM OLD.nombre_completo
    OR NEW.tipo_documento IS DISTINCT FROM OLD.tipo_documento
    OR NEW.numero_documento IS DISTINCT FROM OLD.numero_documento
    OR NEW.lugar_expedicion_documento IS DISTINCT FROM OLD.lugar_expedicion_documento
    OR NEW.cargo_desempenado IS DISTINCT FROM OLD.cargo_desempenado
    OR NEW.tipo_novedad IS DISTINCT FROM OLD.tipo_novedad
    OR NEW.fecha_retiro IS DISTINCT FROM OLD.fecha_retiro
    OR NEW.jefe_inmediato_id IS DISTINCT FROM OLD.jefe_inmediato_id) THEN
    RAISE EXCEPTION 'Los datos generales ya no se pueden modificar: se solicitó la aprobación de alguna dependencia'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Con la solicitud final enviada o el trámite cerrado, nada del trabajador cambia
  IF OLD.estado_global IN ('PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO') AND (
       NEW.observaciones_trabajador IS DISTINCT FROM OLD.observaciones_trabajador
    OR NEW.clausula_aceptada IS DISTINCT FROM OLD.clausula_aceptada
    OR NEW.firma_trabajador IS DISTINCT FROM OLD.firma_trabajador) THEN
    RAISE EXCEPTION 'El trámite ya está en aprobación final o cerrado y no se puede modificar'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado_global IS DISTINCT FROM OLD.estado_global THEN
    IF OLD.estado_global IN ('APROBADO_FINAL', 'RECHAZADO') THEN
      RAISE EXCEPTION 'El trámite ya está cerrado (%)', OLD.estado_global USING ERRCODE = 'check_violation';
    END IF;

    -- El trabajador pide la aprobación final
    IF NEW.estado_global = 'PENDIENTE_APROBACION' THEN
      IF OLD.estado_global <> 'AL_DIA' THEN
        RAISE EXCEPTION 'RN-001: todas las dependencias deben haber aprobado antes de pedir la aprobación final'
          USING ERRCODE = 'check_violation';
      END IF;
      SELECT COUNT(*) INTO v_aplicables FROM fn_dependencias_aplicables(NEW.id);
      SELECT COUNT(*) INTO v_aprobadas FROM revisiones_area r
       WHERE r.solicitud_id = NEW.id AND r.estado = 'APROBADA'
         AND r.dependencia_id IN (SELECT a.id FROM fn_dependencias_aplicables(NEW.id) a);
      IF v_aprobadas <> v_aplicables THEN
        RAISE EXCEPTION 'RN-001: faltan dependencias por aprobar' USING ERRCODE = 'check_violation';
      END IF;
      IF NOT NEW.informe_entrega_cargo THEN
        RAISE EXCEPTION 'RN-010: el informe por entrega de cargo debe estar completo' USING ERRCODE = 'check_violation';
      END IF;
      IF NOT NEW.clausula_aceptada OR NEW.firma_trabajador IS NULL THEN
        RAISE EXCEPTION 'RN-016: acepte la cláusula y firme antes de pedir la aprobación final'
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.fecha_solicitud_final := COALESCE(NEW.fecha_solicitud_final, NOW());

    -- Comunidad Universitaria resuelve
    ELSIF NEW.estado_global IN ('APROBADO_FINAL', 'RECHAZADO') THEN
      IF OLD.estado_global <> 'PENDIENTE_APROBACION' THEN
        RAISE EXCEPTION 'Solo se resuelven los trámites que están pendientes de aprobación final'
          USING ERRCODE = 'check_violation';
      END IF;
      -- RN-002: solo el rol Aprobador Comunidad Universitaria
      IF NOT EXISTS (
        SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
         WHERE ur.usuario_id = NEW.aprobador_final_id AND r.nombre_rol = 'Aprobador Comunidad Universitaria'
      ) THEN
        RAISE EXCEPTION 'RN-002: la aprobación final es exclusiva de Comunidad Universitaria'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      IF NEW.aprobador_final_id = NEW.usuario_id THEN
        RAISE EXCEPTION 'RN-013: no puede resolver su propio trámite' USING ERRCODE = 'insufficient_privilege';
      END IF;
      NEW.fecha_aprobacion_final := COALESCE(NEW.fecha_aprobacion_final, NOW());
      IF NEW.estado_global = 'APROBADO_FINAL' THEN
        -- RN-005: sin bloqueos activos
        IF EXISTS (SELECT 1 FROM bloqueos_dependencia b WHERE b.solicitud_id = NEW.id AND b.estado = 'BLOQUEADO') THEN
          RAISE EXCEPTION 'RN-005: no se puede aprobar con bloqueos activos' USING ERRCODE = 'check_violation';
        END IF;
        IF NOT NEW.informe_entrega_cargo THEN
          RAISE EXCEPTION 'RN-010: se requiere el informe de entrega de cargo completo' USING ERRCODE = 'check_violation';
        END IF;
        NEW.aprobado_final := TRUE;
      END IF;

    -- Estados automáticos (recalculados por las revisiones); no se sale de la aprobación final
    ELSIF OLD.estado_global = 'PENDIENTE_APROBACION' THEN
      RAISE EXCEPTION 'El trámite está en aprobación final y no puede volver a revisión'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_solicitudes_validar
BEFORE INSERT OR UPDATE ON solicitudes_paz_y_salvo
FOR EACH ROW EXECUTE FUNCTION fn_trg_solicitudes_validar();

-- Un trámite nuevo nace con su estado ya calculado
CREATE FUNCTION fn_trg_solicitudes_inicializar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM fn_recalcular_estado_solicitud(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_solicitudes_inicializar
AFTER INSERT ON solicitudes_paz_y_salvo
FOR EACH ROW EXECUTE FUNCTION fn_trg_solicitudes_inicializar();

-- 4.8 Informe: no se modifica tras la solicitud final; mantiene la bandera de la solicitud
CREATE FUNCTION fn_trg_informes_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_estado VARCHAR(30);
BEGIN
  SELECT estado_global INTO v_estado FROM solicitudes_paz_y_salvo WHERE id = NEW.solicitud_id;
  IF v_estado IN ('PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO') THEN
    RAISE EXCEPTION 'El trámite ya está en aprobación final o cerrado y el informe no se puede modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_informes_validar
BEFORE INSERT OR UPDATE ON informes_entrega_cargo
FOR EACH ROW EXECUTE FUNCTION fn_trg_informes_validar();

CREATE FUNCTION fn_trg_informes_sincronizar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE solicitudes_paz_y_salvo
     SET informe_entrega_cargo = (NEW.estado = 'COMPLETO')
   WHERE id = NEW.solicitud_id
     AND informe_entrega_cargo IS DISTINCT FROM (NEW.estado = 'COMPLETO');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_informes_sincronizar
AFTER INSERT OR UPDATE OF estado ON informes_entrega_cargo
FOR EACH ROW EXECUTE FUNCTION fn_trg_informes_sincronizar();

-- 4.9 RN-007 · entregables solo para docentes
CREATE FUNCTION fn_trg_entregables_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM solicitudes_paz_y_salvo s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.id = NEW.solicitud_id AND u.tipo_vinculacion = 'Docente'
  ) THEN
    RAISE EXCEPTION 'RN-007: los entregables profesorales aplican solo a personal docente'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_entregables_validar
BEFORE INSERT ON entregables_profesorales
FOR EACH ROW EXECUTE FUNCTION fn_trg_entregables_validar();

CREATE FUNCTION fn_trg_entregables_recalcular() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM fn_recalcular_estado_solicitud(NEW.solicitud_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_entregables_recalcular
AFTER INSERT OR UPDATE OF planes_aula_aprobado, innovaciones_educativas_aprobado, informes_ejecucion_aprobado
ON entregables_profesorales
FOR EACH ROW EXECUTE FUNCTION fn_trg_entregables_recalcular();

-- 4.10 RN-006 · certificado solo tras la aprobación final
CREATE FUNCTION fn_trg_certificados_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM solicitudes_paz_y_salvo s WHERE s.id = NEW.solicitud_id AND s.aprobado_final
  ) THEN
    RAISE EXCEPTION 'RN-006: el certificado solo se emite con la aprobación final registrada'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificados_validar
BEFORE INSERT ON certificados_digitales
FOR EACH ROW EXECUTE FUNCTION fn_trg_certificados_validar();

-- 4.11 Auditoría genérica (usa app.user_id / app.audit_reason del backend).
--      Nunca guarda hashes de contraseña ni imágenes de firmas.
CREATE FUNCTION fn_trg_auditar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_usuario UUID;
  v_motivo  TEXT := NULLIF(current_setting('app.audit_reason', TRUE), '');
  v_antes   JSONB;
  v_despues JSONB;
BEGIN
  BEGIN
    v_usuario := NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_usuario := NULL;
  END;

  IF TG_OP <> 'INSERT' THEN
    v_antes := to_jsonb(OLD) - 'password_hash' - 'imagen' - 'firma_snapshot' - 'firma_trabajador' - 'firma_aprobador';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_despues := to_jsonb(NEW) - 'password_hash' - 'imagen' - 'firma_snapshot' - 'firma_trabajador' - 'firma_aprobador';
  END IF;

  -- Un UPDATE que solo toca updated_at no es un cambio real
  IF TG_OP = 'UPDATE' AND (v_antes - 'updated_at') = (v_despues - 'updated_at') THEN
    RETURN NULL;
  END IF;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, motivo, datos_anteriores, datos_nuevos)
  VALUES (TG_TABLE_NAME,
          COALESCE(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'usuario_id', v_antes ->> 'usuario_id')::UUID,
          TG_OP, v_usuario, v_motivo, v_antes, v_despues);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_aud_usuarios      AFTER INSERT OR UPDATE OR DELETE ON usuarios                 FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_solicitudes   AFTER INSERT OR UPDATE OR DELETE ON solicitudes_paz_y_salvo  FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_informes      AFTER INSERT OR UPDATE OR DELETE ON informes_entrega_cargo   FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_revisiones    AFTER INSERT OR UPDATE OR DELETE ON revisiones_area          FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_bloqueos      AFTER INSERT OR UPDATE OR DELETE ON bloqueos_dependencia     FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_entregables   AFTER INSERT OR UPDATE OR DELETE ON entregables_profesorales FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_certificados  AFTER INSERT OR UPDATE OR DELETE ON certificados_digitales   FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_catalogo      AFTER INSERT OR UPDATE OR DELETE ON catalogo_cargos          FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_firmas        AFTER INSERT OR UPDATE OR DELETE ON firmas_usuario           FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();


-- ============================================================================
-- 5. VISTAS
-- ============================================================================

-- 5.1 Estado de cada dependencia evaluadora para cada trámite (con su revisión, si ya se solicitó)
CREATE VIEW v_estado_dependencias_solicitud WITH (security_invoker = TRUE) AS
SELECT
  s.id AS solicitud_id,
  d.id AS dependencia_id,
  d.nombre AS dependencia,
  d.descripcion AS seccion,
  d.aspecto,
  d.etapa,
  d.orden,
  d.solo_docentes,
  d.requiere_enlace,
  d.etiqueta_enlace,
  CASE
    WHEN (d.solo_docentes AND u.tipo_vinculacion IS DISTINCT FROM 'Docente')
      OR (s.tipo_novedad = 'CAMBIO_DEPENDENCIA' AND NOT d.aplica_cambio_dependencia) THEN 'NO_APLICA'
    WHEN r.id IS NULL THEN 'SIN_SOLICITAR'
    ELSE r.estado
  END AS estado,
  r.id AS revision_id,
  r.solicitada_el,
  r.intentos,
  r.enlace,
  r.revisor_id,
  CASE WHEN rv.id IS NULL THEN NULL ELSE rv.nombres || ' ' || rv.apellidos END AS revisor,
  r.fecha_revision,
  r.recibi,
  COALESCE(act.n, 0) AS bloqueos_activos,
  act.motivo AS motivo_bloqueo,
  act.categoria AS categoria_bloqueo
FROM solicitudes_paz_y_salvo s
JOIN usuarios u ON u.id = s.usuario_id
JOIN dependencias d ON NOT d.es_aprobadora_final
LEFT JOIN revisiones_area r ON r.solicitud_id = s.id AND r.dependencia_id = d.id
LEFT JOIN usuarios rv ON rv.id = r.revisor_id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS n,
         (ARRAY_AGG(b.motivo_descripcion ORDER BY b.fecha_registro DESC))[1] AS motivo,
         (ARRAY_AGG(b.categoria ORDER BY b.fecha_registro DESC))[1] AS categoria
    FROM bloqueos_dependencia b
   WHERE b.solicitud_id = s.id AND b.dependencia_id = d.id AND b.estado = 'BLOQUEADO'
) act ON TRUE;

-- 5.2 Resumen por trámite
CREATE VIEW v_resumen_paz_y_salvo WITH (security_invoker = TRUE) AS
SELECT
  s.id AS solicitud_id,
  s.usuario_id,
  COALESCE(s.nombre_completo, u.nombres || ' ' || u.apellidos) AS nombre_completo,
  u.nombres,
  u.apellidos,
  COALESCE(s.tipo_documento, u.tipo_documento) AS tipo_documento,
  COALESCE(s.numero_documento, u.numero_documento) AS numero_documento,
  u.correo_institucional,
  u.tipo_vinculacion,
  u.verificado,
  s.cargo_desempenado,
  s.tipo_novedad,
  s.fecha_retiro,
  s.fecha_solicitud,
  s.estado_global,
  s.informe_entrega_cargo,
  s.aprobado_final,
  s.fecha_solicitud_final,
  s.fecha_aprobacion_final,
  s.observaciones_aprobacion,
  s.jefe_inmediato_id,
  p.nombre_periodo,
  (SELECT COUNT(*) FROM v_estado_dependencias_solicitud v WHERE v.solicitud_id = s.id AND v.estado = 'APROBADA')  AS dependencias_aprobadas,
  (SELECT COUNT(*) FROM v_estado_dependencias_solicitud v WHERE v.solicitud_id = s.id AND v.estado <> 'NO_APLICA') AS dependencias_aplicables,
  (SELECT COUNT(*) FROM bloqueos_dependencia b WHERE b.solicitud_id = s.id AND b.estado = 'BLOQUEADO') AS bloqueos_activos,
  (SELECT COUNT(*) FROM bloqueos_dependencia b WHERE b.solicitud_id = s.id AND b.estado = 'RESUELTO')  AS bloqueos_resueltos
FROM solicitudes_paz_y_salvo s
JOIN usuarios u            ON u.id = s.usuario_id
JOIN periodos_academicos p ON p.id = s.periodo_academico_id;


-- ============================================================================
-- 6. SEGURIDAD · RLS
-- El backend se conecta con el rol postgres (BYPASSRLS). Al activar RLS sin
-- políticas, la API REST de Supabase (anon / authenticated) queda sin acceso.
-- ============================================================================
ALTER TABLE roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE encargados_dependencia   ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_academicos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_cargos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE firmas_usuario           ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_paz_y_salvo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_entrega_cargo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisiones_area          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_dependencia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregables_profesorales ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados_digitales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones           ENABLE ROW LEVEL SECURITY;

-- En Supabase los roles anon/authenticated reciben permisos por defecto: se retiran.
DO $$
DECLARE
  v_rol TEXT;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', v_rol);
    END IF;
  END LOOP;
END;
$$;
