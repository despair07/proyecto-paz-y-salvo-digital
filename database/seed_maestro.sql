-- ============================================================================
-- PAZ & SALVO DIGITAL UNIAUTÓNOMA — SEED MAESTRO (catálogos institucionales)
-- Datos de referencia que el sistema necesita para funcionar en cualquier
-- ambiente: roles RBAC, dependencias del formato GTH-07, catálogo de cargos y
-- periodo académico activo. Es idempotente (se puede re-ejecutar).
-- Ejecutar DESPUÉS de ddl.sql y ANTES de seed_demo.sql.
-- ============================================================================

-- 1. ROLES RBAC (7) ----------------------------------------------------------
INSERT INTO roles (id, nombre_rol, descripcion) VALUES
  ('d3b8e741-8b8d-4cb1-bbb0-22229a3d99d1', 'Docente',                           'Docente universitario solicitante de paz y salvo'),
  ('74f93db3-6104-4a9f-9b08-35ef78f5ea4d', 'Administrativo',                    'Personal administrativo solicitante'),
  ('5d479d99-1a7d-4ec5-9c2f-d89d0c3d5a31', 'Contratista',                       'Personal bajo contrato de prestación de servicios'),
  ('2898d218-3d58-442d-9697-31979a7367ef', 'Jefe Inmediato',                    'Superior que valida el informe de entrega de cargo'),
  ('7d4f4e68-5818-4c0a-a41b-9d7dbeb0793c', 'Encargado de Área',                 'Funcionario de dependencia habilitado para gestionar bloqueos de su área'),
  ('9a76e493-9dc9-4cfe-a8db-107f6f68f012', 'Aprobador Comunidad Universitaria', 'Autoridad con potestad de aprobación final y emisión del certificado'),
  ('4d5a0d20-17df-47e1-b0e9-c4efb4e9549c', 'Administrador DTI',                 'Administrador técnico del sistema (solo edita el nombre del cargo, RN-011)')
ON CONFLICT (nombre_rol) DO UPDATE
  SET descripcion = EXCLUDED.descripcion;

-- 2. DEPENDENCIAS (formato GTH-07) -------------------------------------------
-- etapa: 1 = Jefe Inmediato · 2 = Áreas de gestión (en paralelo) · 3 = Comunidad Universitaria (RN-008)
INSERT INTO dependencias (id, nombre, descripcion, etapa, orden, solo_docentes, es_aprobadora_final) VALUES
  ('6513e4af-9d27-4d7e-9eb4-111111111111', 'Jefe Inmediato',
     'Validación del informe por entrega de cargo, archivos físicos y digitales, e informe de gestión', 1, 1, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-222222222222', 'División de Tecnologías de la Información (DTI)',
     'Devolución de equipos de cómputo, accesos a sistemas, licencias y correo institucional', 2, 2, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-333333333333', 'Medios Educativos',
     'Devolución de material bibliográfico, equipos audiovisuales y recursos de laboratorio', 2, 3, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-444444444444', 'Almacén',
     'Devolución de elementos de inventario físico, herramientas y activos fijos asignados', 2, 4, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-555555555555', 'Archivo y Correspondencia',
     'Entrega de libros de archivo, expedientes documentales e inventario de correspondencia', 2, 5, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-666666666666', 'División Contable y Financiera',
     'Saldos deudores, préstamos, anticipos pendientes de descuento o cuentas por pagar', 2, 6, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-777777777777', 'Seguridad y Salud en el Trabajo (SST)',
     'Realización y radicación del examen médico obligatorio de retiro', 2, 7, FALSE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-888888888888', 'Centro de Desarrollo Profesoral',
     'Evaluación de los 3 entregables docentes: planes de aula, innovaciones educativas e informes de ejecución', 2, 8, TRUE, FALSE),
  ('6513e4af-9d27-4d7e-9eb4-999999999999', 'División de Comunidad Universitaria',
     'Aprobación institucional final y cierre definitivo del paz y salvo', 3, 9, FALSE, TRUE)
ON CONFLICT (nombre) DO UPDATE
  SET descripcion         = EXCLUDED.descripcion,
      etapa               = EXCLUDED.etapa,
      orden               = EXCLUDED.orden,
      solo_docentes       = EXCLUDED.solo_docentes,
      es_aprobadora_final = EXCLUDED.es_aprobadora_final;

-- 3. CATÁLOGO DE CARGOS ------------------------------------------------------
INSERT INTO catalogo_cargos (nombre, tipo_vinculacion) VALUES
  ('Docente de Planta',                    'Docente'),
  ('Docente de Cátedra',                   'Docente'),
  ('Docente Tiempo Completo',              'Docente'),
  ('Director de Programa',                 'Docente'),
  ('Coordinador de Investigación',         'Docente'),
  ('Auxiliar Administrativo',              'Administrativo'),
  ('Secretaria Ejecutiva',                 'Administrativo'),
  ('Profesional Universitario',            'Administrativo'),
  ('Analista de Sistemas',                 'Administrativo'),
  ('Auxiliar Contable',                    'Administrativo'),
  ('Auxiliar de Biblioteca',               'Administrativo'),
  ('Técnico de Laboratorio',               'Administrativo'),
  ('Coordinador Administrativo',           'Administrativo'),
  ('Jefe de División',                     'Administrativo'),
  ('Contratista de Apoyo a la Gestión',    'Contratista'),
  ('Contratista Profesional',              'Contratista'),
  ('Contratista de Servicios Generales',   'Contratista')
ON CONFLICT (nombre) DO NOTHING;

-- 4. PERIODO ACADÉMICO ACTIVO -----------------------------------------------
-- Solo puede haber uno activo (índice único parcial uq_periodos_activo).
INSERT INTO periodos_academicos (id, nombre_periodo, activo, fecha_inicio, fecha_fin) VALUES
  ('77777777-7777-4777-8777-777777777777', '2026-2', TRUE, '2026-07-01', '2026-12-31')
ON CONFLICT (nombre_periodo) DO UPDATE
  SET activo = EXCLUDED.activo, fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin;
