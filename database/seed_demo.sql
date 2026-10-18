-- ============================================================================
-- PAZ & SALVO DIGITAL UNIAUTÓNOMA — DATOS FICTICIOS INICIALES
-- Personas, trámites y bloqueos de ejemplo para operar y probar el sistema
-- completo con la base de datos real. Todo es ficticio.
-- Ejecutar DESPUÉS de ddl.sql y seed_maestro.sql.
--
-- Contraseña de TODAS las cuentas: Demo2026*   (hash bcrypt de abajo)
-- Para cambiarla: node -e "console.log(require('bcryptjs').hashSync('NuevaClave',10))"
-- y reemplaza el hash en la sección 1.
--
-- Escenarios cubiertos (periodo 2026-2, una solicitud por trabajador):
--   Laura Ortiz     Docente         EN_PROCESO · 3 bloqueos activos · entregables 2/3
--   Carlos Muñoz    Administrativo  EN_PROCESO · 1 bloqueo activo (Almacén), DTI resuelto
--   Sofía Cárdenas  Contratista     AL_DIA     · lista para aprobación final
--   Mateo Gómez     Administrativo  APROBADO_FINAL · certificado emitido (QR verificable)
--   Valentina Narváez Docente       AL_DIA · informe en borrador, etapa Jefe Inmediato
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

-- 4. SOLICITUDES DE PAZ Y SALVO ----------------------------------------------
-- estado_global se recalcula solo (RN-001) al insertar bloqueos.
INSERT INTO solicitudes_paz_y_salvo (
  id, usuario_id, periodo_academico_id, jefe_inmediato_id, tipo_novedad, cargo_desempenado,
  lugar_expedicion_documento, fecha_retiro, fecha_solicitud, estado_global, etapa_actual
) VALUES
  ('aaaa1111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'RETIRO', 'Docente de Planta',
   'Popayán, Cauca', '2026-11-30', '2026-10-01 08:30:00-05', 'EN_PROCESO', 'AREAS_GESTION'),
  ('bbbb2222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'CAMBIO_DEPENDENCIA', 'Auxiliar Administrativo',
   'Popayán, Cauca', '2026-11-15', '2026-10-02 09:15:00-05', 'EN_PROCESO', 'AREAS_GESTION'),
  ('cccc3333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-333333333333', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'RETIRO', 'Contratista de Apoyo a la Gestión',
   'Popayán, Cauca', '2026-11-30', '2026-10-03 10:00:00-05', 'AL_DIA', 'COMUNIDAD_UNIVERSITARIA'),
  ('dddd4444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-eeeeeeeeeeee', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'RETIRO', 'Profesional Universitario',
   'Santander de Quilichao, Cauca', '2026-10-15', '2026-09-14 08:00:00-05', 'AL_DIA', 'COMUNIDAD_UNIVERSITARIA'),
  ('eeee5555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-ffffffffffff', '77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-444444444444', 'RETIRO', 'Docente de Cátedra',
   'Popayán, Cauca', '2026-12-15', '2026-10-12 14:20:00-05', 'EN_PROCESO', 'JEFE_INMEDIATO')
ON CONFLICT (usuario_id, periodo_academico_id) DO NOTHING;

-- 5. INFORMES DE ENTREGA DE CARGO (RF-010) -----------------------------------
INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones, fecha_completado, validado_por_id, fecha_validacion) VALUES
  ('aaaa1111-1111-4111-8111-111111111111', 'COMPLETO', '{
     "I_datos_generales":          {"completado": true, "observaciones": "Docente de planta del programa de Ingeniería de Sistemas"},
     "II_informe_gestion":         {"completado": true, "actividades": "Cuatro asignaturas del plan de estudios y dirección de dos trabajos de grado"},
     "III_procedimientos":         {"completado": true, "detalle": "Guías de laboratorio y rúbricas de evaluación entregadas al coordinador"},
     "IV_formatos":                {"completado": true, "detalle": "Formatos de seguimiento académico actualizados"},
     "V_informes_presentados":     {"completado": true, "detalle": "Informe de semestre 2026-1 radicado en decanatura"},
     "VI_estado_recursos":         {"completado": true, "detalle": "Equipo de cómputo y llaves de oficina por entregar"},
     "VII_anexos":                 {"completado": true, "detalle": "Acta de entrega de material didáctico"},
     "VIII_contacto_verificacion": {"completado": true, "telefono": "3104567812", "correoPersonal": "laura.ortiz.p@gmail.com"}
   }'::jsonb, '2026-10-01 16:40:00-05', '11111111-1111-4111-8111-444444444444', '2026-10-02 10:15:00-05'),
  ('bbbb2222-2222-4222-8222-222222222222', 'COMPLETO', '{
     "I_datos_generales":          {"completado": true, "observaciones": "Datos de auxiliar administrativo diligenciados"},
     "II_informe_gestion":         {"completado": true, "actividades": "Procesos de correspondencia y radicación al día"},
     "III_procedimientos":         {"completado": true, "detalle": "Manuales de archivo y atención al usuario vigentes"},
     "IV_formatos":                {"completado": true, "detalle": "Formatos institucionales actualizados según SIG"},
     "V_informes_presentados":     {"completado": true, "detalle": "Informes semestrales radicados en vicerrectoría"},
     "VI_estado_recursos":         {"completado": true, "detalle": "Escritorio y estación de trabajo física entregados"},
     "VII_anexos":                 {"completado": true, "detalle": "Actas de entrega física adjuntas"},
     "VIII_contacto_verificacion": {"completado": true, "telefono": "3157890123", "correoPersonal": "carlos.munoz.r@gmail.com"}
   }'::jsonb, '2026-10-02 15:30:00-05', '11111111-1111-4111-8111-444444444444', '2026-10-03 09:00:00-05'),
  ('cccc3333-3333-4333-8333-333333333333', 'COMPLETO', '{
     "I_datos_generales":          {"completado": true, "observaciones": "Contrato de prestación de servicios No. 2026-089"},
     "II_informe_gestion":         {"completado": true, "actividades": "Obligaciones contractuales ejecutadas al 100 %"},
     "III_procedimientos":         {"completado": true, "detalle": "Procedimientos de gestión documental entregados"},
     "IV_formatos":                {"completado": true, "detalle": "Formatos de entrega de evidencias validados"},
     "V_informes_presentados":     {"completado": true, "detalle": "Informe final de actividades aprobado por el supervisor"},
     "VI_estado_recursos":         {"completado": true, "detalle": "No se le asignaron bienes devolutivos"},
     "VII_anexos":                 {"completado": true, "detalle": "Bitácora de gestión y constancia del supervisor"},
     "VIII_contacto_verificacion": {"completado": true, "telefono": "3189988776", "correoPersonal": "sofia.cardenas.l@gmail.com"}
   }'::jsonb, '2026-10-03 11:20:00-05', '11111111-1111-4111-8111-444444444444', '2026-10-03 14:00:00-05'),
  ('dddd4444-4444-4444-8444-444444444444', 'COMPLETO', '{
     "I_datos_generales":          {"completado": true, "observaciones": "Profesional universitario de la oficina de Planeación"},
     "II_informe_gestion":         {"completado": true, "actividades": "Consolidación de indicadores institucionales 2026-1"},
     "III_procedimientos":         {"completado": true, "detalle": "Procedimiento de reporte SNIES documentado"},
     "IV_formatos":                {"completado": true, "detalle": "Plantillas de reporte entregadas al sucesor"},
     "V_informes_presentados":     {"completado": true, "detalle": "Informe de gestión trimestral aprobado"},
     "VI_estado_recursos":         {"completado": true, "detalle": "Portátil institucional y token de acceso devueltos"},
     "VII_anexos":                 {"completado": true, "detalle": "Acta de empalme firmada con el sucesor"},
     "VIII_contacto_verificacion": {"completado": true, "telefono": "3122345678", "correoPersonal": "mateo.gomez.z@gmail.com"}
   }'::jsonb, '2026-09-14 17:00:00-05', '11111111-1111-4111-8111-444444444444', '2026-09-15 09:30:00-05')
ON CONFLICT (solicitud_id) DO NOTHING;

-- Valentina: borrador (solo las dos primeras secciones diligenciadas)
INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones) VALUES
  ('eeee5555-5555-4555-8555-555555555555', 'BORRADOR', '{
     "I_datos_generales":          {"completado": true, "observaciones": "Docente de cátedra, programa de Derecho"},
     "II_informe_gestion":         {"completado": false, "actividades": "En redacción"},
     "III_procedimientos":         {},
     "IV_formatos":                {},
     "V_informes_presentados":     {},
     "VI_estado_recursos":         {},
     "VII_anexos":                 {},
     "VIII_contacto_verificacion": {}
   }'::jsonb)
ON CONFLICT (solicitud_id) DO NOTHING;

-- 6. ENTREGABLES PROFESORALES (RN-007, solo docentes) ------------------------
INSERT INTO entregables_profesorales (
  solicitud_id, planes_aula_aprobado, innovaciones_educativas_aprobado, informes_ejecucion_aprobado,
  evaluador_id, fecha_evaluacion, observaciones
) VALUES
  ('aaaa1111-1111-4111-8111-111111111111', TRUE, TRUE, FALSE,
   '11111111-1111-4111-8111-bbbbbbbbbbbb', '2026-10-05 14:00:00-05',
   'Planes de aula e innovaciones educativas validados; pendiente el informe de ejecución de tutorías y clubes académicos.'),
  ('eeee5555-5555-4555-8555-555555555555', FALSE, FALSE, FALSE, NULL, NULL, NULL)
ON CONFLICT (solicitud_id) DO NOTHING;

-- 7. BLOQUEOS (RN-003, RN-004, RN-009) ---------------------------------------
-- 7.1 Laura Ortiz — 3 bloqueos activos
INSERT INTO bloqueos_dependencia (id, solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion, estado, fecha_registro) VALUES
  ('b1111111-1111-4111-8111-111111111111', 'aaaa1111-1111-4111-8111-111111111111', '6513e4af-9d27-4d7e-9eb4-333333333333',
   '11111111-1111-4111-8111-666666666666', 'INVENTARIO_ELEMENTOS',
   'Material bibliográfico sin devolver: 2 libros de ingeniería de software en la biblioteca central', 'BLOQUEADO', '2026-10-04 11:00:00-05'),
  ('b2222222-2222-4222-8222-222222222222', 'aaaa1111-1111-4111-8111-111111111111', '6513e4af-9d27-4d7e-9eb4-666666666666',
   '11111111-1111-4111-8111-999999999999', 'FINANCIERO',
   'Anticipo pendiente de descuento correspondiente a viáticos del seminario 2026-1', 'BLOQUEADO', '2026-10-04 11:30:00-05'),
  ('b3333333-3333-4333-8333-333333333333', 'aaaa1111-1111-4111-8111-111111111111', '6513e4af-9d27-4d7e-9eb4-888888888888',
   '11111111-1111-4111-8111-bbbbbbbbbbbb', 'ACADEMICO_PROFESORAL',
   'Informes de ejecución académica no entregados (RN-007)', 'BLOQUEADO', '2026-10-05 14:05:00-05')
ON CONFLICT (id) DO NOTHING;

-- 7.2 Carlos Muñoz — Almacén activo, DTI ya resuelto
INSERT INTO bloqueos_dependencia (
  id, solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion, estado, fecha_registro,
  resuelto_por_id, fecha_resolucion, observacion_resolucion
) VALUES
  ('b4444444-4444-4444-8444-444444444444', 'bbbb2222-2222-4222-8222-222222222222', '6513e4af-9d27-4d7e-9eb4-444444444444',
   '11111111-1111-4111-8111-777777777777', 'INVENTARIO_ELEMENTOS',
   'Portátil corporativo asignado sin devolver (placa de inventario #44921)', 'BLOQUEADO', '2026-10-03 16:20:00-05',
   NULL, NULL, NULL),
  ('b5555555-5555-4555-8555-555555555555', 'bbbb2222-2222-4222-8222-222222222222', '6513e4af-9d27-4d7e-9eb4-222222222222',
   '11111111-1111-4111-8111-555555555555', 'DOCUMENTAL_ENTREGABLES',
   'Revisión y desvinculación de cuentas institucionales y software', 'RESUELTO', '2026-10-02 10:00:00-05',
   '11111111-1111-4111-8111-555555555555', '2026-10-02 11:30:00-05',
   'Credenciales revocadas y accesos reasignados a la nueva dependencia')
ON CONFLICT (id) DO NOTHING;

-- 7.3 Sofía Cárdenas — historial resuelto, cero bloqueos activos
INSERT INTO bloqueos_dependencia (
  id, solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion, estado, fecha_registro,
  resuelto_por_id, fecha_resolucion, observacion_resolucion
) VALUES
  ('b6666666-6666-4666-8666-666666666666', 'cccc3333-3333-4333-8333-333333333333', '6513e4af-9d27-4d7e-9eb4-444444444444',
   '11111111-1111-4111-8111-777777777777', 'INVENTARIO_ELEMENTOS',
   'Verificación de elementos devolutivos de apoyo a la gestión', 'RESUELTO', '2026-10-03 11:00:00-05',
   '11111111-1111-4111-8111-777777777777', '2026-10-03 15:45:00-05',
   'Paz y salvo de inventario verificado. No registra activos a cargo.'),
  ('b7777777-7777-4777-8777-777777777777', 'cccc3333-3333-4333-8333-333333333333', '6513e4af-9d27-4d7e-9eb4-555555555555',
   '11111111-1111-4111-8111-888888888888', 'DOCUMENTAL_ENTREGABLES',
   'Verificación de entrega de expedientes contractuales físicos', 'RESUELTO', '2026-10-03 14:00:00-05',
   '11111111-1111-4111-8111-888888888888', '2026-10-04 09:30:00-05',
   'Expedientes y carpetas de archivo de gestión recibidos a entera satisfacción.')
ON CONFLICT (id) DO NOTHING;

-- 7.4 Mateo Gómez — historial completo resuelto antes de la aprobación final
-- (DO + IF NOT EXISTS: el trámite ya aprobado rechazaría nuevos bloqueos al re-ejecutar el seed)
DO $seed$
BEGIN
IF NOT EXISTS (SELECT 1 FROM bloqueos_dependencia WHERE id = 'b8888888-8888-4888-8888-888888888888') THEN
INSERT INTO bloqueos_dependencia (
  id, solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion, estado, fecha_registro,
  resuelto_por_id, fecha_resolucion, observacion_resolucion
) VALUES
  ('b8888888-8888-4888-8888-888888888888', 'dddd4444-4444-4444-8444-444444444444', '6513e4af-9d27-4d7e-9eb4-222222222222',
   '11111111-1111-4111-8111-555555555555', 'INVENTARIO_ELEMENTOS',
   'Portátil institucional y token de acceso pendientes de devolución', 'RESUELTO', '2026-09-16 10:00:00-05',
   '11111111-1111-4111-8111-555555555555', '2026-09-18 15:20:00-05',
   'Equipos recibidos y verificados; cuentas desactivadas.'),
  ('b9999999-9999-4999-8999-999999999999', 'dddd4444-4444-4444-8444-444444444444', '6513e4af-9d27-4d7e-9eb4-666666666666',
   '11111111-1111-4111-8111-999999999999', 'FINANCIERO',
   'Libranza vigente pendiente de cancelación', 'RESUELTO', '2026-09-16 11:00:00-05',
   '11111111-1111-4111-8111-999999999999', '2026-09-22 09:10:00-05',
   'Libranza cancelada; sin saldos pendientes con la institución.'),
  ('b0000000-0000-4000-8000-000000000000', 'dddd4444-4444-4444-8444-444444444444', '6513e4af-9d27-4d7e-9eb4-777777777777',
   '11111111-1111-4111-8111-aaaaaaaaaaaa', 'DOCUMENTAL_ENTREGABLES',
   'Examen médico ocupacional de retiro sin radicar', 'RESUELTO', '2026-09-17 08:30:00-05',
   '11111111-1111-4111-8111-aaaaaaaaaaaa', '2026-09-30 16:00:00-05',
   'Examen médico de retiro radicado y archivado en la historia ocupacional.')
;
END IF;
END
$seed$;

-- 8. APROBACIÓN FINAL Y CERTIFICADO (RN-002, RN-005, RN-006, RN-010) ---------
-- El trigger valida: rol del aprobador, 0 bloqueos activos e informe completo.
UPDATE solicitudes_paz_y_salvo
   SET aprobado_final           = TRUE,
       aprobador_final_id       = '11111111-1111-4111-8111-cccccccccccc',
       fecha_aprobacion_final   = '2026-10-09 10:45:00-05',
       observaciones_aprobacion = 'Trámite verificado. Sin pendientes en ninguna dependencia.'
 WHERE id = 'dddd4444-4444-4444-8444-444444444444'
   AND NOT aprobado_final;

-- Token de verificación del QR (verificable en /verificar/<token>)
INSERT INTO certificados_digitales (solicitud_id, token_verificacion, hash_verificacion, archivo_url, emitido_por, fecha_emision) VALUES
  ('dddd4444-4444-4444-8444-444444444444',
   'c561aa6b48f8e19d511a2819a903f1b5b6d385e9aef3766953182a8346ba3cd2',
   'f212cbc347bfa9bfdda2eeb1acfb7c2f04bdf5881e4a4a6b768f5a6e1e2456ac',
   '/certificados/c561aa6b48f8e19d511a2819a903f1b5b6d385e9aef3766953182a8346ba3cd2/pdf',
   '11111111-1111-4111-8111-cccccccccccc', '2026-10-09 10:50:00-05')
ON CONFLICT (solicitud_id) DO NOTHING;
