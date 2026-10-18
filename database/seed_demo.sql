-- ============================================================================
-- PAZ & SALVO DIGITAL UNIAUTÓNOMA — DATOS FICTICIOS INICIALES
-- Personas, trámites y revisiones de ejemplo para operar y probar el sistema completo con la
-- base de datos real. Todo es ficticio. Los trámites se arman con el mismo flujo del sistema
-- (solicitar, aprobar, bloquear), de modo que los triggers validan cada paso.
-- Ejecutar DESPUÉS de ddl.sql y seed_maestro.sql.
--
-- Contraseña de TODAS las cuentas (solo desarrollo, AUTH_PASSWORD_ENABLED): Demo2026*
-- Para cambiarla: node -e "console.log(require('bcryptjs').hashSync('NuevaClave',10))"
-- y reemplaza el hash en la sección 1.
--
-- Escenarios (periodo 2026-2, un trámite por trabajador):
--   Laura Ortiz       Docente         EN_PROCESO · 5 de 8 dependencias aprobaron; Medios, Contable y
--                                     Desarrollo Profesoral la bloquearon
--   Carlos Muñoz      Administrativo  EN_PROCESO · cambio de dependencia (SST y Profesoral no aplican);
--                                     Almacén bloqueó, Archivo en revisión, Contable sin solicitar
--   Sofía Cárdenas    Contratista     PENDIENTE_APROBACION · todo aprobado, espera a Comunidad Universitaria
--   Mateo Gómez       Administrativo  APROBADO_FINAL · certificado emitido (QR verificable)
--   Valentina Narváez Docente         BORRADOR · datos generales e informe a medias
-- ============================================================================

-- Todo lo que se cree aquí queda en auditoria con este motivo
SELECT set_config('app.audit_reason', 'Carga inicial de datos ficticios', TRUE);

-- 1. USUARIOS ----------------------------------------------------------------
-- El personal de áreas (jefe, encargados, aprobador, DTI) no tiene tipo de vinculación: no gestiona
-- paz y salvo propio hasta que elija un tipo en su perfil. Laura, Carlos, Sofía, Mateo y Valentina
-- (trabajadores) ya tienen su tipo definido.
INSERT INTO usuarios (id, nombres, apellidos, tipo_documento, numero_documento, correo_institucional, tipo_vinculacion, estado, cargo, password_hash) VALUES
  -- Trabajadores
  ('11111111-1111-4111-8111-111111111111', 'Laura Marcela',     'Ortiz Peña',       'CC', '1.061.700.101', 'laura.ortiz@uniautonoma.edu.co',            'Docente',        'ACTIVO', 'Docente de Planta', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-222222222222', 'Carlos Andrés',     'Muñoz Ruiz',       'CC', '1.061.700.102', 'carlos.munoz@uniautonoma.edu.co',           'Administrativo', 'ACTIVO', 'Auxiliar Administrativo', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-333333333333', 'Sofía Valentina',   'Cárdenas Lozano',  'CC', '1.061.700.103', 'sofia.cardenas@uniautonoma.edu.co',         'Contratista',    'ACTIVO', 'Contratista de Apoyo a la Gestión', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-eeeeeeeeeeee', 'Mateo Andrés',      'Gómez Zúñiga',     'CC', '1.061.700.114', 'mateo.gomez@uniautonoma.edu.co',            'Administrativo', 'ACTIVO', 'Profesional Universitario', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-ffffffffffff', 'Valentina Isabel',  'Narváez Mosquera', 'CC', '1.061.700.115', 'valentina.narvaez@uniautonoma.edu.co',     'Docente',        'ACTIVO', 'Docente de Cátedra', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  -- Jefe inmediato, encargados de área, aprobador y administrador
  ('11111111-1111-4111-8111-444444444444', 'Martha Lucía',      'Quintero',         'CC', '1.061.700.104', 'jefe.inmediato@uniautonoma.edu.co',         NULL, 'ACTIVO', 'Coordinador Administrativo', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-555555555555', 'Andrés Felipe',     'Valencia',         'CC', '1.061.700.105', 'encargado.dti@uniautonoma.edu.co',          NULL, 'ACTIVO', 'Analista de Sistemas', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-666666666666', 'Juliana',           'Restrepo Gómez',   'CC', '1.061.700.106', 'encargado.medios@uniautonoma.edu.co',       NULL, 'ACTIVO', 'Auxiliar de Biblioteca', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-777777777777', 'Héctor Fabio',      'Mosquera',         'CC', '1.061.700.107', 'encargado.almacen@uniautonoma.edu.co',      NULL, 'ACTIVO', 'Coordinador Administrativo', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-888888888888', 'Diana Carolina',    'Bolaños',          'CC', '1.061.700.108', 'encargado.archivo@uniautonoma.edu.co',      NULL, 'ACTIVO', 'Auxiliar Administrativo', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-999999999999', 'Ricardo Alonso',    'Paz',              'CC', '1.061.700.109', 'encargado.financiera@uniautonoma.edu.co',   NULL, 'ACTIVO', 'Auxiliar Contable', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-aaaaaaaaaaaa', 'Natalia Andrea',    'Ramírez',          'CC', '1.061.700.110', 'encargado.sst@uniautonoma.edu.co',          NULL, 'ACTIVO', 'Profesional Universitario', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-bbbbbbbbbbbb', 'Camilo Ernesto',    'Vidal',            'CC', '1.061.700.111', 'encargado.profesoral@uniautonoma.edu.co',   NULL, 'ACTIVO', 'Profesional Universitario', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-cccccccccccc', 'Patricia Elena',    'Lasso',            'CC', '1.061.700.112', 'aprobador.comunidad@uniautonoma.edu.co',    NULL, 'ACTIVO', 'Jefe de División', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6'),
  ('11111111-1111-4111-8111-dddddddddddd', 'Sebastián Iván',    'Mera',             'CC', '1.061.700.113', 'admin.dti@uniautonoma.edu.co',              NULL, 'ACTIVO', 'Analista de Sistemas', '$2b$10$WqkYeU652pSim.FgFUP5aO3CPRbr8FhD9rHEjPgT0.LwA9YIT2Zc6')
ON CONFLICT (correo_institucional) DO UPDATE
  SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos,
      numero_documento = EXCLUDED.numero_documento,
      tipo_vinculacion = EXCLUDED.tipo_vinculacion,
      cargo = EXCLUDED.cargo,
      password_hash = EXCLUDED.password_hash;

-- 2. ROLES DE CADA USUARIO ---------------------------------------------------
INSERT INTO usuario_roles (usuario_id, rol_id)
SELECT v.usuario_id::UUID, r.id
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111', 'Docente'),
  ('11111111-1111-4111-8111-222222222222', 'Administrativo'),
  ('11111111-1111-4111-8111-333333333333', 'Contratista'),
  ('11111111-1111-4111-8111-eeeeeeeeeeee', 'Administrativo'),
  ('11111111-1111-4111-8111-ffffffffffff', 'Docente'),
  ('11111111-1111-4111-8111-444444444444', 'Jefe Inmediato'),
  ('11111111-1111-4111-8111-555555555555', 'Encargado de Área'),
  ('11111111-1111-4111-8111-666666666666', 'Encargado de Área'),
  ('11111111-1111-4111-8111-777777777777', 'Encargado de Área'),
  ('11111111-1111-4111-8111-888888888888', 'Encargado de Área'),
  ('11111111-1111-4111-8111-999999999999', 'Encargado de Área'),
  ('11111111-1111-4111-8111-aaaaaaaaaaaa', 'Encargado de Área'),
  ('11111111-1111-4111-8111-bbbbbbbbbbbb', 'Encargado de Área'),
  ('11111111-1111-4111-8111-cccccccccccc', 'Aprobador Comunidad Universitaria'),
  ('11111111-1111-4111-8111-dddddddddddd', 'Administrador DTI')
) AS v(usuario_id, nombre_rol)
JOIN roles r ON r.nombre_rol = v.nombre_rol
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

-- 3. ENCARGADOS POR DEPENDENCIA (RN-004) -------------------------------------
INSERT INTO encargados_dependencia (usuario_id, dependencia_id, es_jefe_inmediato) VALUES
  ('11111111-1111-4111-8111-444444444444', '6513e4af-9d27-4d7e-9eb4-111111111111', TRUE),   -- Jefe Inmediato
  ('11111111-1111-4111-8111-555555555555', '6513e4af-9d27-4d7e-9eb4-222222222222', FALSE),  -- DTI
  ('11111111-1111-4111-8111-666666666666', '6513e4af-9d27-4d7e-9eb4-333333333333', FALSE),  -- Medios Educativos
  ('11111111-1111-4111-8111-777777777777', '6513e4af-9d27-4d7e-9eb4-444444444444', FALSE),  -- Almacén
  ('11111111-1111-4111-8111-888888888888', '6513e4af-9d27-4d7e-9eb4-555555555555', FALSE),  -- Archivo y Correspondencia
  ('11111111-1111-4111-8111-999999999999', '6513e4af-9d27-4d7e-9eb4-666666666666', FALSE),  -- Contable y Financiera
  ('11111111-1111-4111-8111-aaaaaaaaaaaa', '6513e4af-9d27-4d7e-9eb4-777777777777', FALSE),  -- SST
  ('11111111-1111-4111-8111-bbbbbbbbbbbb', '6513e4af-9d27-4d7e-9eb4-888888888888', FALSE),  -- Desarrollo Profesoral
  ('11111111-1111-4111-8111-cccccccccccc', '6513e4af-9d27-4d7e-9eb4-999999999999', FALSE)   -- Comunidad Universitaria
ON CONFLICT (usuario_id, dependencia_id) DO NOTHING;

-- 3b. FIRMAS (imagen de ejemplo; cada persona dibuja la suya en su perfil) -------
INSERT INTO firmas_usuario (usuario_id, imagen)
SELECT id, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANwAAABGCAYAAACnp/qkAAABmElEQVR42u3cS27DMAwFQK97j94j979UuuqiQIGktWU9kjOAdwkQSXyy5E+OAwAAAAAAAAAAAAAAAAAAAAAAAAAAgB8+Ph/P70NvwOKQCRzbCq574QkaMSHrXIyCRkTQznxW0OCNgrvju9XbzsVLp4n9MKlwBS10jyJsvYrYWS2wk7sPysq2JfebsIUXV/ercZMKW9CKdHKngbq7HSl9J2wFO7nT5e8pxW4JWXyQO1z+nrJ3ErQmM2q1QZy4j2oXttSG7BjQyZNP2tmu7RIysUE7lyzCtjcY7fdq6bPm5Imn0pLqbFBGPayQujdwtq+9z3z120c/jpd2j8XZpPbti8mvB5Urdku4Pn8FIGSBg2wf2TNsBA526myXcPFG4ARu1GzuiQpaha7a5W5ho2yheaNY2LipCCoW112PMKk8oVv26v70/hA2lhZFh+Ja9Wc9Ku33fhl509zb1te1pVqhnAnAjmN86Lp2yH8Ge9UDvo6mq4S/NHJChyhywYktMgEQABS34kewBABhEwBwXwQAAAAAAAAAACDfFw+LGZP70VVQAAAAAElFTkSuQmCC'
FROM usuarios
ON CONFLICT (usuario_id) DO NOTHING;

-- 4. FUNCIONES AUXILIARES DE LA CARGA (temporales: desaparecen al cerrar la sesión) ---------
-- El trabajador solicita la aprobación de una dependencia
CREATE OR REPLACE FUNCTION pg_temp.solicitar(p_sol UUID, p_dep UUID, p_cuando TIMESTAMPTZ, p_enlace TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO revisiones_area (solicitud_id, dependencia_id, enlace) VALUES (p_sol, p_dep, p_enlace);
  UPDATE revisiones_area SET solicitada_el = p_cuando WHERE solicitud_id = p_sol AND dependencia_id = p_dep;
END;
$$;

-- La dependencia aprueba con su "Recibí" y su firma
CREATE OR REPLACE FUNCTION pg_temp.aprobar(p_sol UUID, p_dep UUID, p_revisor UUID, p_cuando TIMESTAMPTZ, p_recibi TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE revisiones_area
     SET estado = 'APROBADA', revisor_id = p_revisor, fecha_revision = p_cuando, recibi = p_recibi,
         firma_snapshot = (SELECT imagen FROM firmas_usuario WHERE usuario_id = p_revisor)
   WHERE solicitud_id = p_sol AND dependencia_id = p_dep;
END;
$$;

-- La dependencia bloquea: registra categoría y motivo y marca la revisión
CREATE OR REPLACE FUNCTION pg_temp.bloquear(p_sol UUID, p_dep UUID, p_revisor UUID, p_cuando TIMESTAMPTZ, p_categoria TEXT, p_motivo TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO bloqueos_dependencia (solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion, fecha_registro)
  VALUES (p_sol, p_dep, p_revisor, p_categoria, p_motivo, p_cuando);
  UPDATE revisiones_area SET estado = 'BLOQUEADA', revisor_id = p_revisor, fecha_revision = p_cuando
   WHERE solicitud_id = p_sol AND dependencia_id = p_dep;
END;
$$;

-- El trabajador vuelve a solicitar una dependencia que lo bloqueó
CREATE OR REPLACE FUNCTION pg_temp.resolicitar(p_sol UUID, p_dep UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE revisiones_area SET estado = 'SOLICITADA' WHERE solicitud_id = p_sol AND dependencia_id = p_dep;
END;
$$;

-- Informe por entrega de cargo completo (estructura de las secciones I a VIII); los textos
-- se personalizan con los datos de cada persona.
CREATE OR REPLACE FUNCTION pg_temp.informe(p_nombre TEXT, p_documento TEXT, p_cargo TEXT, p_dependencia TEXT,
                                p_jefe TEXT, p_jefe_cargo TEXT, p_correo TEXT, p_telefono TEXT,
                                p_inicio TEXT, p_fin TEXT, p_presentacion TEXT) RETURNS JSONB
LANGUAGE sql AS $$
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    $j$
{
  "fecha_presentacion": "@PRESENTACION@",
  "I_datos_generales": {
    "nombres_completos": "@NOMBRE@", "tipo_identificacion": "CC", "otro_tipo": "",
    "numero_identificacion": "@DOCUMENTO@", "ciudad_pais_expedicion": "Popayán, Colombia",
    "cargo_nombre": "@CARGO@", "dependencia_nombre": "@DEPENDENCIA@",
    "superior_nombre": "@JEFE@", "superior_cargo": "@JEFECARGO@",
    "periodo_inicio": "@INICIO@", "periodo_fin": "@FIN@"
  },
  "II_informe_gestion": {
    "propositos": { "no_aplica": false, "justificacion": "", "filas": [
      { "objetivo": "Cumplir las funciones propias del cargo", "estado": "Cumplido", "descripcion": "Actividades del cargo ejecutadas durante todo el periodo, con soportes archivados." },
      { "objetivo": "Entregar informes de gestión periódicos", "estado": "Cumplido", "descripcion": "Informes semestrales presentados a la jefatura en las fechas establecidas." }
    ] },
    "proyectos": { "no_aplica": false, "justificacion": "", "filas": [
      { "proyecto": "Actualización de procesos del área", "acciones_concluidas": "Revisión y ajuste de los procedimientos vigentes.", "acciones_pendientes": "Socializar los cambios con el equipo que continúa." }
    ] },
    "contactos": { "no_aplica": false, "justificacion": "", "filas": [
      { "nombre": "Oficina de Contratación", "institucion": "Proveedor de servicios", "datos_contacto": "contacto@proveedor.example", "razones": "Seguimiento de solicitudes de servicio." }
    ] }
  },
  "III_procedimientos": { "no_aplica": false, "justificacion": "", "filas": [
    { "descripcion": "Procedimientos y manuales del área disponibles en la carpeta compartida institucional." }
  ] },
  "IV_formatos": { "no_aplica": false, "justificacion": "", "filas": [
    { "descripcion": "Formatos de seguimiento y control actualizados según el Sistema Integrado de Gestión." }
  ] },
  "V_informes": { "no_aplica": false, "justificacion": "", "filas": [
    { "nombre": "Informe de gestión", "presentado_a": "Superior inmediato y Talento Humano", "periodicidad": "Semestral", "fecha": "30/06 y 30/11", "papel": "Elaboración y envío" }
  ] },
  "VI_recursos": {
    "infraestructura": { "no_aplica": false, "justificacion": "", "filas": [ { "espacio": "Puesto de trabajo asignado", "estado": "Buen estado" } ] },
    "muebles": { "no_aplica": false, "justificacion": "", "filas": [ { "elemento": "Escritorio y silla", "numero": "2", "estado": "Buen estado" } ] },
    "equipos": { "no_aplica": false, "justificacion": "", "filas": [ { "equipo": "Equipo de cómputo institucional", "estado": "Buen estado" } ] },
    "archivos_fisicos": { "no_aplica": false, "justificacion": "", "filas": [ { "nombre": "Carpetas de gestión", "descripcion": "Documentos del periodo", "localizacion": "Archivador del puesto de trabajo" } ] },
    "archivos_equipos": { "no_aplica": false, "justificacion": "", "filas": [ { "nombre": "Documentos de trabajo", "ruta": "D:/Documentos/Gestion" } ] },
    "software": { "no_aplica": false, "justificacion": "", "filas": [ { "identificacion": "Correo y herramientas institucionales", "usos": "Gestión diaria", "papel": "Usuario", "acceso_localizacion": "Cuenta institucional", "estado_credencial": "RESTABLECIDA_POR_TI" } ] },
    "correos": { "no_aplica": false, "justificacion": "", "filas": [ { "correo": "@CORREO@", "estado_credencial": "RESTABLECIDA_POR_TI" } ] },
    "snies": { "no_aplica": true, "justificacion": "El cargo no administra información del SNIES." },
    "otros": { "no_aplica": true, "justificacion": "No tengo otros recursos a cargo." }
  },
  "VII_anexos": {
    "anexos": { "no_aplica": false, "justificacion": "", "filas": [ { "identificacion": "Acta de entrega del puesto de trabajo", "medio": "Físico", "descripcion": "Acta firmada por el superior inmediato." } ] },
    "observaciones": "Sin observaciones adicionales."
  },
  "VIII_contacto": { "correo": "@CORREO@", "telefono": "@TELEFONO@", "direccion": "Popayán, Cauca" }
}
    $j$,
    '@PRESENTACION@', p_presentacion), '@NOMBRE@', p_nombre), '@DOCUMENTO@', p_documento), '@CARGO@', p_cargo),
    '@DEPENDENCIA@', p_dependencia), '@JEFECARGO@', p_jefe_cargo), '@JEFE@', p_jefe), '@INICIO@', p_inicio),
    '@FIN@', p_fin), '@CORREO@', p_correo), '@TELEFONO@', p_telefono)::JSONB
$$;

-- 5. SOLICITUDES DE PAZ Y SALVO -----------------------------------------------------------
-- Todas nacen en BORRADOR; el estado cambia solo con las revisiones (RN-001).
INSERT INTO solicitudes_paz_y_salvo (
  id, usuario_id, periodo_academico_id, jefe_inmediato_id, nombre_completo, tipo_documento, numero_documento,
  lugar_expedicion_documento, cargo_desempenado, tipo_novedad, fecha_retiro, fecha_solicitud
) VALUES
  ('aaaa1111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'Laura Marcela Ortiz Peña', 'CC', '1.061.700.101',
   'Popayán, Cauca', 'Docente de Planta', 'RETIRO', '2026-11-30', '2026-10-01 08:30:00-05'),
  ('bbbb2222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'Carlos Andrés Muñoz Ruiz', 'CC', '1.061.700.102',
   'Popayán, Cauca', 'Auxiliar Administrativo', 'CAMBIO_DEPENDENCIA', NULL, '2026-10-02 09:15:00-05'),
  ('cccc3333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-333333333333', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'Sofía Valentina Cárdenas Lozano', 'CC', '1.061.700.103',
   'Popayán, Cauca', 'Contratista de Apoyo a la Gestión', 'RETIRO', '2026-11-30', '2026-10-03 10:00:00-05'),
  ('dddd4444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-eeeeeeeeeeee', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'Mateo Andrés Gómez Zúñiga', 'CC', '1.061.700.114',
   'Santander de Quilichao, Cauca', 'Profesional Universitario', 'RETIRO', '2026-10-15', '2026-09-14 08:00:00-05'),
  ('eeee5555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-ffffffffffff', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'Valentina Isabel Narváez Mosquera', 'CC', NULL,
   NULL, 'Docente de Cátedra', 'RETIRO', NULL, '2026-10-12 14:20:00-05')
ON CONFLICT DO NOTHING;

-- 6. INFORMES POR ENTREGA DE CARGO ------------------------------------------------------------
INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones, fecha_completado)
SELECT v.sid, 'COMPLETO', v.secciones, v.completado FROM (VALUES
  ('aaaa1111-1111-4111-8111-111111111111'::UUID,
   pg_temp.informe('Laura Marcela Ortiz Peña', '1.061.700.101', 'Docente de Planta', 'Programa de Ingeniería de Sistemas',
                   'Martha Lucía Quintero', 'Coordinador Administrativo', 'laura.ortiz@uniautonoma.edu.co', '3104567812',
                   '2019-02-01', '2026-11-30', '2026-10-01'), TIMESTAMPTZ '2026-10-01 16:40:00-05'),
  ('bbbb2222-2222-4222-8222-222222222222'::UUID,
   pg_temp.informe('Carlos Andrés Muñoz Ruiz', '1.061.700.102', 'Auxiliar Administrativo', 'Oficina de Correspondencia',
                   'Martha Lucía Quintero', 'Coordinador Administrativo', 'carlos.munoz@uniautonoma.edu.co', '3157890123',
                   '2022-03-15', '2026-11-15', '2026-10-02'), TIMESTAMPTZ '2026-10-02 15:30:00-05'),
  ('cccc3333-3333-4333-8333-333333333333'::UUID,
   pg_temp.informe('Sofía Valentina Cárdenas Lozano', '1.061.700.103', 'Contratista de Apoyo a la Gestión', 'Gestión Documental',
                   'Martha Lucía Quintero', 'Coordinador Administrativo', 'sofia.cardenas@uniautonoma.edu.co', '3189988776',
                   '2025-02-01', '2026-11-30', '2026-10-03'), TIMESTAMPTZ '2026-10-03 11:20:00-05'),
  ('dddd4444-4444-4444-8444-444444444444'::UUID,
   pg_temp.informe('Mateo Andrés Gómez Zúñiga', '1.061.700.114', 'Profesional Universitario', 'Oficina de Planeación',
                   'Martha Lucía Quintero', 'Coordinador Administrativo', 'mateo.gomez@uniautonoma.edu.co', '3122345678',
                   '2021-01-18', '2026-10-15', '2026-09-14'), TIMESTAMPTZ '2026-09-14 17:00:00-05')
) AS v(sid, secciones, completado)
WHERE NOT EXISTS (SELECT 1 FROM informes_entrega_cargo i WHERE i.solicitud_id = v.sid);

-- Valentina: borrador (solo empezó la sección I)
INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones)
SELECT 'eeee5555-5555-4555-8555-555555555555', 'BORRADOR', '{
     "I_datos_generales": { "nombres_completos": "Valentina Isabel Narváez Mosquera", "tipo_identificacion": "CC",
                            "cargo_nombre": "Docente de Cátedra", "dependencia_nombre": "Programa de Derecho" }
   }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM informes_entrega_cargo WHERE solicitud_id = 'eeee5555-5555-4555-8555-555555555555');

-- 7. REVISIONES POR DEPENDENCIA ------------------------------------------------------------------
-- Ids de dependencias (seed_maestro): 111 Jefe · 222 TI · 333 Medios · 444 Almacén · 555 Archivo ·
--   666 Contable · 777 SST · 888 Desarrollo Profesoral
-- Ids de encargados: 444 Martha (jefe) · 555 Andrés (TI) · 666 Juliana (Medios) · 777 Héctor (Almacén) ·
--   888 Diana (Archivo) · 999 Ricardo (Contable) · aaa Natalia (SST) · bbb Camilo (Profesoral)

-- 7.1 Laura (docente, retiro): 5 de 8 aprobadas, 3 bloqueos
DO $seed$
DECLARE
  s UUID := 'aaaa1111-1111-4111-8111-111111111111';
  d TEXT := '6513e4af-9d27-4d7e-9eb4-';
  u TEXT := '11111111-1111-4111-8111-';
BEGIN
  IF EXISTS (SELECT 1 FROM revisiones_area WHERE solicitud_id = s) THEN RETURN; END IF;

  PERFORM pg_temp.solicitar(s, (d || '111111111111')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.aprobar(s, (d || '111111111111')::UUID, (u || '444444444444')::UUID, '2026-10-02 10:15:00-05',
    'Recibí el informe por entrega de cargo, los archivos y los productos elaborados por la docente.');

  PERFORM pg_temp.solicitar(s, (d || '222222222222')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.aprobar(s, (d || '222222222222')::UUID, (u || '555555555555')::UUID, '2026-10-03 09:40:00-05',
    'Recibí equipo de cómputo y accesos; cuenta institucional restablecida.');

  PERFORM pg_temp.solicitar(s, (d || '333333333333')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.bloquear(s, (d || '333333333333')::UUID, (u || '666666666666')::UUID, '2026-10-04 11:00:00-05',
    'INVENTARIO_ELEMENTOS', 'Material bibliográfico sin devolver: 2 libros de ingeniería de software en la biblioteca central');

  PERFORM pg_temp.solicitar(s, (d || '444444444444')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.aprobar(s, (d || '444444444444')::UUID, (u || '777777777777')::UUID, '2026-10-03 15:00:00-05',
    'Recibí los elementos asignados por inventario: llaves de oficina y portátil.');

  PERFORM pg_temp.solicitar(s, (d || '555555555555')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.aprobar(s, (d || '555555555555')::UUID, (u || '888888888888')::UUID, '2026-10-04 10:30:00-05',
    'Revisé la entrega de expedientes y carpetas a su cargo; el inventario documental coincide.');

  PERFORM pg_temp.solicitar(s, (d || '666666666666')::UUID, '2026-10-02 09:00:00-05');
  PERFORM pg_temp.bloquear(s, (d || '666666666666')::UUID, (u || '999999999999')::UUID, '2026-10-04 11:30:00-05',
    'FINANCIERO', 'Anticipo pendiente de descuento correspondiente a viáticos del seminario 2026-1');

  PERFORM pg_temp.solicitar(s, (d || '777777777777')::UUID, '2026-10-02 09:00:00-05',
    'https://formacion.uniautonoma.edu.co/certificados/laura-ortiz-sst');
  PERFORM pg_temp.aprobar(s, (d || '777777777777')::UUID, (u || 'aaaaaaaaaaaa')::UUID, '2026-10-05 09:20:00-05',
    'Examen médico de retiro realizado y certificado de horas validado en el enlace.');

  -- Desarrollo Profesoral: 2 de 3 entregables → bloqueo
  PERFORM pg_temp.solicitar(s, (d || '888888888888')::UUID, '2026-10-02 09:00:00-05');
  INSERT INTO entregables_profesorales (solicitud_id, planes_aula_aprobado, innovaciones_educativas_aprobado,
    informes_ejecucion_aprobado, evaluador_id, fecha_evaluacion, observaciones)
  VALUES (s, TRUE, TRUE, FALSE, (u || 'bbbbbbbbbbbb')::UUID, '2026-10-05 14:00:00-05',
    'Planes de aula e innovaciones educativas validados; pendiente el informe de ejecución de tutorías y clubes académicos.');
  PERFORM pg_temp.bloquear(s, (d || '888888888888')::UUID, (u || 'bbbbbbbbbbbb')::UUID, '2026-10-05 14:05:00-05',
    'ACADEMICO_PROFESORAL', 'Informes de ejecución académica no entregados (RN-007)');
END
$seed$;

-- 7.2 Carlos (cambio de dependencia): el bloqueo de TI ya se resolvió; Almacén bloquea; Archivo en revisión
DO $seed$
DECLARE
  s UUID := 'bbbb2222-2222-4222-8222-222222222222';
  d TEXT := '6513e4af-9d27-4d7e-9eb4-';
  u TEXT := '11111111-1111-4111-8111-';
BEGIN
  IF EXISTS (SELECT 1 FROM revisiones_area WHERE solicitud_id = s) THEN RETURN; END IF;

  PERFORM pg_temp.solicitar(s, (d || '111111111111')::UUID, '2026-10-03 08:30:00-05');
  PERFORM pg_temp.aprobar(s, (d || '111111111111')::UUID, (u || '444444444444')::UUID, '2026-10-03 09:00:00-05',
    'Recibí el informe, los archivos y los productos elaborados por el funcionario.');

  PERFORM pg_temp.solicitar(s, (d || '222222222222')::UUID, '2026-10-03 08:30:00-05');
  PERFORM pg_temp.bloquear(s, (d || '222222222222')::UUID, (u || '555555555555')::UUID, '2026-10-03 10:00:00-05',
    'DOCUMENTAL_ENTREGABLES', 'Revisión y desvinculación de cuentas institucionales y software');
  PERFORM pg_temp.resolicitar(s, (d || '222222222222')::UUID);
  PERFORM pg_temp.aprobar(s, (d || '222222222222')::UUID, (u || '555555555555')::UUID, '2026-10-03 11:30:00-05',
    'Credenciales revocadas y accesos reasignados a la nueva dependencia.');

  PERFORM pg_temp.solicitar(s, (d || '333333333333')::UUID, '2026-10-03 08:30:00-05');
  PERFORM pg_temp.aprobar(s, (d || '333333333333')::UUID, (u || '666666666666')::UUID, '2026-10-04 09:10:00-05',
    'Sin material bibliográfico ni recursos de laboratorio pendientes.');

  PERFORM pg_temp.solicitar(s, (d || '444444444444')::UUID, '2026-10-03 08:30:00-05');
  PERFORM pg_temp.bloquear(s, (d || '444444444444')::UUID, (u || '777777777777')::UUID, '2026-10-03 16:20:00-05',
    'INVENTARIO_ELEMENTOS', 'Portátil corporativo asignado sin devolver (placa de inventario #44921)');

  PERFORM pg_temp.solicitar(s, (d || '555555555555')::UUID, '2026-10-05 10:00:00-05');
  -- Contable (666): todavía sin solicitar
END
$seed$;

-- 7.3 Sofía y Mateo (retiro, contratista y administrativo): las 7 dependencias que les aplican
DO $seed$
DECLARE
  d TEXT := '6513e4af-9d27-4d7e-9eb4-';
  u TEXT := '11111111-1111-4111-8111-';
  s UUID;
  base TIMESTAMPTZ;
  dep TEXT;
  rev TEXT;
  notas TEXT[] := ARRAY[
    'Recibí el informe, los archivos y los productos elaborados.',
    'Equipos y accesos entregados; cuenta institucional restablecida.',
    'Sin material bibliográfico ni recursos de laboratorio pendientes.',
    'Recibí los elementos asignados por inventario; no registra activos a cargo.',
    'Revisé la entrega de expedientes y carpetas; el inventario documental coincide.',
    'Revisé contablemente: no presenta saldos ni obligaciones por descontar.',
    'Examen médico de retiro realizado y certificado de horas validado en el enlace.'];
  deps TEXT[] := ARRAY['111111111111','222222222222','333333333333','444444444444','555555555555','666666666666','777777777777'];
  revs TEXT[] := ARRAY['444444444444','555555555555','666666666666','777777777777','888888888888','999999999999','aaaaaaaaaaaa'];
  i INT;
BEGIN
  FOREACH s IN ARRAY ARRAY['cccc3333-3333-4333-8333-333333333333', 'dddd4444-4444-4444-8444-444444444444']::UUID[] LOOP
    IF EXISTS (SELECT 1 FROM revisiones_area WHERE solicitud_id = s) THEN CONTINUE; END IF;
    base := CASE WHEN s = 'dddd4444-4444-4444-8444-444444444444'::UUID THEN '2026-09-15 09:00:00-05' ELSE '2026-10-03 11:30:00-05' END;
    FOR i IN 1..7 LOOP
      PERFORM pg_temp.solicitar(s, (d || deps[i])::UUID, base,
        CASE WHEN deps[i] = '777777777777' THEN 'https://formacion.uniautonoma.edu.co/certificados/sst-' || substr(s::TEXT, 1, 4) END);
      PERFORM pg_temp.aprobar(s, (d || deps[i])::UUID, (u || revs[i])::UUID, base + (i || ' days')::INTERVAL, notas[i]);
    END LOOP;
  END LOOP;
END
$seed$;

-- 8. SOLICITUD FINAL, APROBACIÓN Y CERTIFICADO ---------------------------------------------------------
-- Sofía y Mateo aceptan la cláusula, firman y piden la aprobación final (RN-016)
UPDATE solicitudes_paz_y_salvo
   SET observaciones_trabajador = 'Sin observaciones.',
       clausula_aceptada = TRUE,
       fecha_clausula = CASE id WHEN 'dddd4444-4444-4444-8444-444444444444' THEN TIMESTAMPTZ '2026-09-22 10:00:00-05'
                                ELSE TIMESTAMPTZ '2026-10-10 09:00:00-05' END,
       firma_trabajador = (SELECT imagen FROM firmas_usuario WHERE usuario_id = solicitudes_paz_y_salvo.usuario_id)
 WHERE id IN ('cccc3333-3333-4333-8333-333333333333', 'dddd4444-4444-4444-8444-444444444444')
   AND estado_global = 'AL_DIA';

UPDATE solicitudes_paz_y_salvo SET estado_global = 'PENDIENTE_APROBACION'
 WHERE id IN ('cccc3333-3333-4333-8333-333333333333', 'dddd4444-4444-4444-8444-444444444444')
   AND estado_global = 'AL_DIA';

-- Comunidad Universitaria aprueba el de Mateo (RN-002, RN-005, RN-010)
UPDATE solicitudes_paz_y_salvo
   SET estado_global = 'APROBADO_FINAL',
       aprobador_final_id = '11111111-1111-4111-8111-cccccccccccc',
       fecha_aprobacion_final = '2026-10-09 10:45:00-05',
       observaciones_aprobacion = 'Trámite verificado. Sin pendientes en ninguna dependencia.',
       firma_aprobador = (SELECT imagen FROM firmas_usuario WHERE usuario_id = '11111111-1111-4111-8111-cccccccccccc')
 WHERE id = 'dddd4444-4444-4444-8444-444444444444' AND estado_global = 'PENDIENTE_APROBACION';

-- Token de verificación del QR (verificable en /verificar/<token>)
INSERT INTO certificados_digitales (solicitud_id, token_verificacion, hash_verificacion, archivo_url, emitido_por, fecha_emision) VALUES
  ('dddd4444-4444-4444-8444-444444444444',
   'c561aa6b48f8e19d511a2819a903f1b5b6d385e9aef3766953182a8346ba3cd2',
   'f212cbc347bfa9bfdda2eeb1acfb7c2f04bdf5881e4a4a6b768f5a6e1e2456ac',
   '/certificados/c561aa6b48f8e19d511a2819a903f1b5b6d385e9aef3766953182a8346ba3cd2/pdf',
   '11111111-1111-4111-8111-cccccccccccc', '2026-10-09 10:50:00-05')
ON CONFLICT (solicitud_id) DO NOTHING;
