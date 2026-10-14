-- ============================================================================
-- PAZ & SALVO DIGITAL UNIAUTÓNOMA — DDL CANÓNICO v2.0
-- Corporación Universitaria Autónoma del Cauca · PostgreSQL 15+ (Supabase)
--
-- ÚNICA fuente de verdad de la estructura de la base de datos.
-- Orden de ejecución:  1) ddl.sql   2) seed_maestro.sql   3) seed_demo.sql
--
-- ⚠ ESTE ARCHIVO ES DESTRUCTIVO: la sección 0 elimina las tablas del sistema
--   (incluidas las de la v1.0) y las vuelve a crear vacías. Úsalo para dejar
--   la base limpia y consistente. No lo ejecutes sobre datos que quieras
--   conservar sin respaldarlos antes.
--
-- Cambios respecto a v1.0
--   · Se eliminan columnas duplicadas (nombre/nombre_dependencia, motivo/
--     motivo_descripcion, observacion/observacion_resolucion, planes_aula/
--     planes_aula_aprobado, evaluador_id/evaluado_por, activo/estado_activo,
--     codigo_qr_token/token_verificacion, url_pdf_storage/archivo_url).
--   · Resuelve TODO-BD-01: el informe de entrega de cargo vive en
--     informes_entrega_cargo (8 secciones en JSONB).
--   · Resuelve TODO-BD-02: solicitudes_paz_y_salvo.etapa_actual (RN-008).
--   · Nuevas tablas: catalogo_cargos, informes_entrega_cargo, auditoria.
--   · Reglas de negocio protegidas desde la propia BD (RN-001, 002, 004, 005,
--     006, 007, 009, 010) además de las validaciones del backend.
--   · RLS activado en todas las tablas: la API REST de Supabase (anon /
--     authenticated) no puede leer ni escribir; solo el backend (rol postgres).
-- ============================================================================


-- ============================================================================
-- 0. LIMPIEZA (idempotente)
-- ============================================================================
DROP VIEW  IF EXISTS v_estado_dependencias_solicitud CASCADE;
DROP VIEW  IF EXISTS v_resumen_paz_y_salvo CASCADE;

DROP TABLE IF EXISTS auditoria                CASCADE;
DROP TABLE IF EXISTS certificados_digitales   CASCADE;
DROP TABLE IF EXISTS entregables_profesorales CASCADE;
DROP TABLE IF EXISTS bloqueos_dependencia     CASCADE;
DROP TABLE IF EXISTS informes_entrega_cargo   CASCADE;
DROP TABLE IF EXISTS solicitudes_paz_y_salvo  CASCADE;
DROP TABLE IF EXISTS catalogo_cargos          CASCADE;
DROP TABLE IF EXISTS periodos_academicos      CASCADE;
DROP TABLE IF EXISTS encargados_dependencia   CASCADE;
DROP TABLE IF EXISTS dependencias             CASCADE;
DROP TABLE IF EXISTS usuario_roles            CASCADE;
DROP TABLE IF EXISTS usuarios                 CASCADE;
DROP TABLE IF EXISTS roles                    CASCADE;

DROP FUNCTION IF EXISTS fn_actualizar_estado_global_solicitud() CASCADE;
DROP FUNCTION IF EXISTS fn_recalcular_estado_solicitud(UUID)    CASCADE;
DROP FUNCTION IF EXISTS fn_trg_bloqueos_recalcular()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_bloqueos_validar()               CASCADE;
DROP FUNCTION IF EXISTS fn_trg_solicitudes_validar()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_solicitudes_inicializar()        CASCADE;
DROP FUNCTION IF EXISTS fn_trg_informes_sincronizar()           CASCADE;
DROP FUNCTION IF EXISTS fn_trg_entregables_validar()            CASCADE;
DROP FUNCTION IF EXISTS fn_trg_entregables_recalcular()         CASCADE;
DROP FUNCTION IF EXISTS fn_trg_certificados_validar()           CASCADE;
DROP FUNCTION IF EXISTS fn_trg_auditar()                        CASCADE;
DROP FUNCTION IF EXISTS fn_trg_touch_updated_at()               CASCADE;


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
  numero_documento     VARCHAR(40)  NOT NULL UNIQUE,
  correo_institucional VARCHAR(255) NOT NULL UNIQUE,
  tipo_vinculacion     VARCHAR(30)  NOT NULL,
  estado               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
  cargo                VARCHAR(150),              -- cargo actual; lo edita el Admin DTI (RN-011)
  password_hash        TEXT,                      -- bcrypt; NULL = solo SSO Google
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_usuarios_tipo_doc   CHECK (tipo_documento IN ('CC', 'CE', 'PA', 'TI')),
  CONSTRAINT ck_usuarios_vinculacion CHECK (tipo_vinculacion IN ('Docente', 'Administrativo', 'Contratista')),
  CONSTRAINT ck_usuarios_estado     CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  CONSTRAINT ck_usuarios_correo     CHECK (
    correo_institucional = LOWER(correo_institucional)
    AND correo_institucional LIKE '%@uniautonoma.edu.co'
  )
);
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt. Nunca exponer en respuestas de la API.';

-- 1.3 usuario_roles (N:M)
CREATE TABLE usuario_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id     UUID NOT NULL REFERENCES roles(id)    ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, rol_id)
);

-- 1.4 dependencias (7 evaluadoras + Jefe Inmediato + 1 aprobadora final)
CREATE TABLE dependencias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(180) NOT NULL UNIQUE,
  descripcion         TEXT,
  etapa               SMALLINT     NOT NULL DEFAULT 2,       -- RN-008: 1 Jefe · 2 Áreas · 3 Comunidad
  orden               SMALLINT     NOT NULL DEFAULT 0,       -- orden de aparición en el formato GTH-07
  solo_docentes       BOOLEAN      NOT NULL DEFAULT FALSE,   -- RN-007
  es_aprobadora_final BOOLEAN      NOT NULL DEFAULT FALSE,   -- RN-002
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


-- ============================================================================
-- 2. NÚCLEO DEL TRÁMITE
-- ============================================================================

-- 2.1 solicitudes_paz_y_salvo
CREATE TABLE solicitudes_paz_y_salvo (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id                 UUID         NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  periodo_academico_id       UUID         NOT NULL REFERENCES periodos_academicos(id),
  jefe_inmediato_id          UUID         REFERENCES usuarios(id),
  tipo_novedad               VARCHAR(30)  NOT NULL,
  cargo_desempenado          VARCHAR(180) NOT NULL,
  lugar_expedicion_documento VARCHAR(180),
  fecha_retiro               DATE         NOT NULL,
  fecha_solicitud            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  estado_global              VARCHAR(30)  NOT NULL DEFAULT 'EN_PROCESO',   -- RN-001
  etapa_actual               VARCHAR(30)  NOT NULL DEFAULT 'JEFE_INMEDIATO', -- RN-008
  informe_entrega_cargo      BOOLEAN      NOT NULL DEFAULT FALSE,           -- sincronizado desde informes_entrega_cargo
  aprobado_final             BOOLEAN      NOT NULL DEFAULT FALSE,
  aprobador_final_id         UUID         REFERENCES usuarios(id),
  fecha_aprobacion_final     TIMESTAMPTZ,
  observaciones_aprobacion   TEXT,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_solicitud_usuario_periodo UNIQUE (usuario_id, periodo_academico_id),
  CONSTRAINT ck_solicitud_novedad CHECK (tipo_novedad IN ('RETIRO', 'CAMBIO_DEPENDENCIA')),
  CONSTRAINT ck_solicitud_estado  CHECK (estado_global IN ('EN_PROCESO', 'AL_DIA', 'APROBADO_FINAL', 'RECHAZADO')),
  CONSTRAINT ck_solicitud_etapa   CHECK (etapa_actual IN ('JEFE_INMEDIATO', 'AREAS_GESTION', 'COMUNIDAD_UNIVERSITARIA', 'FINALIZADO')),
  CONSTRAINT ck_solicitud_aprobacion CHECK (
    (aprobado_final = (estado_global = 'APROBADO_FINAL'))
    AND (NOT aprobado_final OR (aprobador_final_id IS NOT NULL AND fecha_aprobacion_final IS NOT NULL))
  ),
  CONSTRAINT ck_solicitud_rechazo CHECK (
    estado_global <> 'RECHAZADO' OR NULLIF(BTRIM(observaciones_aprobacion), '') IS NOT NULL
  ),
  CONSTRAINT ck_solicitud_finalizada CHECK (
    (etapa_actual = 'FINALIZADO') = (estado_global IN ('APROBADO_FINAL', 'RECHAZADO'))
  )
);
COMMENT ON COLUMN solicitudes_paz_y_salvo.estado_global IS
  'RN-001: AL_DIA solo con 0 bloqueos activos. Lo recalcula fn_recalcular_estado_solicitud().';
COMMENT ON COLUMN solicitudes_paz_y_salvo.etapa_actual IS
  'RN-008: JEFE_INMEDIATO → AREAS_GESTION → COMUNIDAD_UNIVERSITARIA → FINALIZADO. La avanza el backend.';

-- 2.2 informes_entrega_cargo (RF-010, 8 secciones del formato)
CREATE TABLE informes_entrega_cargo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id      UUID        NOT NULL UNIQUE REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  estado            VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  secciones         JSONB       NOT NULL DEFAULT '{
    "I_datos_generales": {}, "II_informe_gestion": {}, "III_procedimientos": {},
    "IV_formatos": {}, "V_informes_presentados": {}, "VI_estado_recursos": {},
    "VII_anexos": {}, "VIII_contacto_verificacion": {}
  }'::jsonb,
  fecha_completado  TIMESTAMPTZ,
  validado_por_id   UUID        REFERENCES usuarios(id),   -- Jefe Inmediato
  fecha_validacion  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_informe_estado    CHECK (estado IN ('BORRADOR', 'COMPLETO')),
  CONSTRAINT ck_informe_secciones CHECK (jsonb_typeof(secciones) = 'object'),
  CONSTRAINT ck_informe_completo  CHECK (estado <> 'COMPLETO' OR fecha_completado IS NOT NULL),
  CONSTRAINT ck_informe_validacion CHECK (
    (validado_por_id IS NULL) = (fecha_validacion IS NULL)
    AND (validado_por_id IS NULL OR estado = 'COMPLETO')
  )
);

-- 2.3 bloqueos_dependencia (core operativo)
CREATE TABLE bloqueos_dependencia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id           UUID         NOT NULL REFERENCES solicitudes_paz_y_salvo(id) ON DELETE CASCADE,
  dependencia_id         UUID         NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
  registrado_por_id      UUID         NOT NULL REFERENCES usuarios(id),
  categoria              VARCHAR(40)  NOT NULL,                              -- RN-003
  motivo_descripcion     TEXT         NOT NULL,                              -- RN-009
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

-- 2.4 entregables_profesorales (RN-007, solo docentes)
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

-- 2.5 certificados_digitales (RN-006)
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

-- 2.6 auditoria (trazabilidad de cambios)
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


-- ============================================================================
-- 3. ÍNDICES (todas las FK usadas en filtros y joins)
-- ============================================================================
CREATE INDEX idx_usuario_roles_rol          ON usuario_roles (rol_id);
CREATE INDEX idx_encargados_dependencia     ON encargados_dependencia (dependencia_id);
CREATE INDEX idx_solicitudes_periodo        ON solicitudes_paz_y_salvo (periodo_academico_id);
CREATE INDEX idx_solicitudes_estado         ON solicitudes_paz_y_salvo (estado_global, etapa_actual);
CREATE INDEX idx_solicitudes_jefe           ON solicitudes_paz_y_salvo (jefe_inmediato_id);
CREATE INDEX idx_bloqueos_solicitud_estado  ON bloqueos_dependencia (solicitud_id, estado);
CREATE INDEX idx_bloqueos_dependencia_estado ON bloqueos_dependencia (dependencia_id, estado);
CREATE INDEX idx_bloqueos_registrado_por    ON bloqueos_dependencia (registrado_por_id);
CREATE INDEX idx_entregables_evaluador      ON entregables_profesorales (evaluador_id);
CREATE INDEX idx_certificados_emitido_por   ON certificados_digitales (emitido_por);
CREATE INDEX idx_auditoria_registro         ON auditoria (tabla, registro_id);
CREATE INDEX idx_auditoria_fecha            ON auditoria (fecha DESC);


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
CREATE TRIGGER trg_entregables_updated   BEFORE UPDATE ON entregables_profesorales FOR EACH ROW EXECUTE FUNCTION fn_trg_touch_updated_at();

-- 4.2 RN-001 / RN-008 · estado global y etapa se recalculan solos
--   estado_global: AL_DIA solo con 0 bloqueos activos.
--   etapa_actual : JEFE_INMEDIATO (sin informe) → AREAS_GESTION (bloqueos o entregables
--                  docentes pendientes) → COMUNIDAD_UNIVERSITARIA (listo para aprobar).
CREATE FUNCTION fn_recalcular_estado_solicitud(p_solicitud_id UUID) RETURNS VOID
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sol            solicitudes_paz_y_salvo%ROWTYPE;
  v_bloqueos       BOOLEAN;
  v_docente_pend   BOOLEAN;
  v_estado         VARCHAR(30);
  v_etapa          VARCHAR(30);
BEGIN
  SELECT * INTO v_sol FROM solicitudes_paz_y_salvo WHERE id = p_solicitud_id;
  IF NOT FOUND OR v_sol.estado_global IN ('APROBADO_FINAL', 'RECHAZADO') THEN
    RETURN;
  END IF;

  v_bloqueos := EXISTS (
    SELECT 1 FROM bloqueos_dependencia b
     WHERE b.solicitud_id = p_solicitud_id AND b.estado = 'BLOQUEADO');

  v_docente_pend := EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = v_sol.usuario_id AND u.tipo_vinculacion = 'Docente')
    AND NOT EXISTS (
      SELECT 1 FROM entregables_profesorales e WHERE e.solicitud_id = p_solicitud_id AND e.completo);

  v_estado := CASE WHEN v_bloqueos THEN 'EN_PROCESO' ELSE 'AL_DIA' END;
  v_etapa  := CASE
                WHEN NOT v_sol.informe_entrega_cargo THEN 'JEFE_INMEDIATO'
                WHEN v_bloqueos OR v_docente_pend    THEN 'AREAS_GESTION'
                ELSE 'COMUNIDAD_UNIVERSITARIA'
              END;

  UPDATE solicitudes_paz_y_salvo
     SET estado_global = v_estado, etapa_actual = v_etapa
   WHERE id = p_solicitud_id
     AND (estado_global IS DISTINCT FROM v_estado OR etapa_actual IS DISTINCT FROM v_etapa);
END;
$$;

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

-- 4.3 RN-003/004/007 · validación de bloqueos
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

    IF v_estado_solicitud IN ('APROBADO_FINAL', 'RECHAZADO') THEN
      RAISE EXCEPTION 'El trámite ya está cerrado (%) y no admite nuevos bloqueos', v_estado_solicitud
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
    IF NOT EXISTS (
      SELECT 1 FROM encargados_dependencia e
       WHERE e.usuario_id = NEW.registrado_por_id AND e.dependencia_id = NEW.dependencia_id
    ) THEN
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
      RAISE EXCEPTION 'Un bloqueo resuelto no se reabre; registra uno nuevo'
        USING ERRCODE = 'check_violation';
    END IF;
    -- RN-004 al levantar el bloqueo
    IF OLD.estado = 'BLOQUEADO' AND NEW.estado = 'RESUELTO' AND NOT EXISTS (
      SELECT 1 FROM encargados_dependencia e
       WHERE e.usuario_id = NEW.resuelto_por_id AND e.dependencia_id = NEW.dependencia_id
    ) THEN
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

-- 4.4 RN-002/005/010 · validación de la aprobación final
CREATE FUNCTION fn_trg_solicitudes_validar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_nueva_aprobacion BOOLEAN;
BEGIN
  v_nueva_aprobacion := NEW.aprobado_final;
  IF TG_OP = 'UPDATE' THEN
    v_nueva_aprobacion := NEW.aprobado_final AND NOT OLD.aprobado_final;
  END IF;

  IF v_nueva_aprobacion THEN
    -- RN-002: solo el rol Aprobador Comunidad Universitaria
    IF NOT EXISTS (
      SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = NEW.aprobador_final_id
         AND r.nombre_rol = 'Aprobador Comunidad Universitaria'
    ) THEN
      RAISE EXCEPTION 'RN-002: la aprobación final es exclusiva de Comunidad Universitaria'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- RN-005: sin bloqueos activos
    IF EXISTS (SELECT 1 FROM bloqueos_dependencia b
                WHERE b.solicitud_id = NEW.id AND b.estado = 'BLOQUEADO') THEN
      RAISE EXCEPTION 'RN-005: no se puede aprobar con bloqueos activos'
        USING ERRCODE = 'check_violation';
    END IF;
    -- RN-010: informe de entrega de cargo completo
    IF NOT NEW.informe_entrega_cargo THEN
      RAISE EXCEPTION 'RN-010: se requiere el informe de entrega de cargo completo'
        USING ERRCODE = 'check_violation';
    END IF;
    -- RN-007: el docente necesita sus 3 entregables aprobados
    IF EXISTS (SELECT 1 FROM usuarios u WHERE u.id = NEW.usuario_id AND u.tipo_vinculacion = 'Docente')
       AND NOT EXISTS (SELECT 1 FROM entregables_profesorales e WHERE e.solicitud_id = NEW.id AND e.completo) THEN
      RAISE EXCEPTION 'RN-007: el docente debe tener los 3 entregables aprobados por Desarrollo Profesoral'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.estado_global := 'APROBADO_FINAL';
    NEW.etapa_actual  := 'FINALIZADO';
  END IF;

  -- Un trámite cerrado no se reabre
  IF TG_OP = 'UPDATE' THEN
    IF OLD.estado_global IN ('APROBADO_FINAL', 'RECHAZADO')
       AND NEW.estado_global <> OLD.estado_global THEN
      RAISE EXCEPTION 'El trámite ya está cerrado (%)', OLD.estado_global
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_solicitudes_validar
BEFORE INSERT OR UPDATE ON solicitudes_paz_y_salvo
FOR EACH ROW EXECUTE FUNCTION fn_trg_solicitudes_validar();

-- Un trámite nuevo nace con su estado y etapa ya calculados (RN-001, RN-008)
CREATE FUNCTION fn_trg_solicitudes_inicializar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  PERFORM fn_recalcular_estado_solicitud(NEW.id);
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_solicitudes_inicializar
AFTER INSERT ON solicitudes_paz_y_salvo
FOR EACH ROW EXECUTE FUNCTION fn_trg_solicitudes_inicializar();

-- 4.5 Mantiene solicitudes.informe_entrega_cargo en sincronía con el informe
CREATE FUNCTION fn_trg_informes_sincronizar() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE solicitudes_paz_y_salvo
     SET informe_entrega_cargo = (NEW.estado = 'COMPLETO')
   WHERE id = NEW.solicitud_id
     AND informe_entrega_cargo IS DISTINCT FROM (NEW.estado = 'COMPLETO');
  PERFORM fn_recalcular_estado_solicitud(NEW.solicitud_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_informes_sincronizar
AFTER INSERT OR UPDATE OF estado ON informes_entrega_cargo
FOR EACH ROW EXECUTE FUNCTION fn_trg_informes_sincronizar();

-- 4.6 RN-007 · entregables solo para docentes
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

-- 4.7 RN-006 · certificado solo tras la aprobación final
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

-- 4.8 Auditoría genérica (usa app.user_id / app.audit_reason del backend)
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

  IF TG_OP <> 'INSERT' THEN v_antes   := to_jsonb(OLD) - 'password_hash'; END IF;
  IF TG_OP <> 'DELETE' THEN v_despues := to_jsonb(NEW) - 'password_hash'; END IF;

  -- Un UPDATE que solo toca updated_at no es un cambio real
  IF TG_OP = 'UPDATE' AND (v_antes - 'updated_at') = (v_despues - 'updated_at') THEN
    RETURN NULL;
  END IF;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, motivo, datos_anteriores, datos_nuevos)
  VALUES (TG_TABLE_NAME,
          COALESCE(v_despues ->> 'id', v_antes ->> 'id')::UUID,
          TG_OP, v_usuario, v_motivo, v_antes, v_despues);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_aud_usuarios      AFTER INSERT OR UPDATE OR DELETE ON usuarios                 FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_solicitudes   AFTER INSERT OR UPDATE OR DELETE ON solicitudes_paz_y_salvo  FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_informes      AFTER INSERT OR UPDATE OR DELETE ON informes_entrega_cargo   FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_bloqueos      AFTER INSERT OR UPDATE OR DELETE ON bloqueos_dependencia     FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_entregables   AFTER INSERT OR UPDATE OR DELETE ON entregables_profesorales FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_certificados  AFTER INSERT OR UPDATE OR DELETE ON certificados_digitales   FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();
CREATE TRIGGER trg_aud_catalogo      AFTER INSERT OR UPDATE OR DELETE ON catalogo_cargos          FOR EACH ROW EXECUTE FUNCTION fn_trg_auditar();


-- ============================================================================
-- 5. VISTAS
-- ============================================================================

-- 5.1 Resumen por trámite
CREATE VIEW v_resumen_paz_y_salvo WITH (security_invoker = TRUE) AS
SELECT
  s.id AS solicitud_id,
  s.usuario_id,
  u.nombres,
  u.apellidos,
  u.tipo_documento,
  u.numero_documento,
  u.correo_institucional,
  u.tipo_vinculacion,
  s.cargo_desempenado,
  s.tipo_novedad,
  s.fecha_retiro,
  s.fecha_solicitud,
  s.estado_global,
  s.etapa_actual,
  s.informe_entrega_cargo,
  s.aprobado_final,
  s.fecha_aprobacion_final,
  s.observaciones_aprobacion,
  s.jefe_inmediato_id,
  p.nombre_periodo,
  (SELECT COUNT(*) FROM bloqueos_dependencia b WHERE b.solicitud_id = s.id AND b.estado = 'BLOQUEADO') AS bloqueos_activos,
  (SELECT COUNT(*) FROM bloqueos_dependencia b WHERE b.solicitud_id = s.id AND b.estado = 'RESUELTO')  AS bloqueos_resueltos
FROM solicitudes_paz_y_salvo s
JOIN usuarios u            ON u.id = s.usuario_id
JOIN periodos_academicos p ON p.id = s.periodo_academico_id;

-- 5.2 Estado de cada dependencia evaluadora por trámite (grid del trabajador)
CREATE VIEW v_estado_dependencias_solicitud WITH (security_invoker = TRUE) AS
SELECT
  s.id AS solicitud_id,
  d.id AS dependencia_id,
  d.nombre AS dependencia,
  d.etapa,
  d.orden,
  CASE
    WHEN d.solo_docentes AND u.tipo_vinculacion <> 'Docente' THEN 'NO_APLICA'
    WHEN act.n > 0 THEN 'BLOQUEADO'
    ELSE 'AL_DIA'
  END AS estado,
  COALESCE(act.n, 0) AS bloqueos_activos,
  act.motivo AS motivo_bloqueo
FROM solicitudes_paz_y_salvo s
JOIN usuarios u ON u.id = s.usuario_id
JOIN dependencias d ON NOT d.es_aprobadora_final
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS n,
         (ARRAY_AGG(b.motivo_descripcion ORDER BY b.fecha_registro DESC))[1] AS motivo
    FROM bloqueos_dependencia b
   WHERE b.solicitud_id = s.id AND b.dependencia_id = d.id AND b.estado = 'BLOQUEADO'
) act ON TRUE;


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
ALTER TABLE solicitudes_paz_y_salvo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_entrega_cargo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_dependencia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregables_profesorales ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados_digitales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria                ENABLE ROW LEVEL SECURITY;

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
