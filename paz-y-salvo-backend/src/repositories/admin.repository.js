// ============================================================================
// REPOSITORIO DE ADMINISTRACIÓN DTI
// Personas (solicitantes) y personal de las dependencias. No toca datos de los trámites (RN-011).
// ============================================================================

const PERSONAL_ROLES = ['Jefe Inmediato', 'Encargado de Área', 'Aprobador Comunidad Universitaria'];
const WORKER_ROLES = ['Docente', 'Administrativo', 'Contratista'];
const ESTADOS_ABIERTOS = `('EN_PROCESO', 'AL_DIA', 'PENDIENTE_APROBACION')`;

// Personal de las dependencias o de TI: no son solicitantes
const ES_PERSONAL = `EXISTS (
  SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
   WHERE ur.usuario_id = u.id
     AND r.nombre_rol IN ('Jefe Inmediato', 'Encargado de Área', 'Aprobador Comunidad Universitaria', 'Administrador DTI'))`;

const TRAMITE_EN_CURSO = `EXISTS (
  SELECT 1 FROM solicitudes_paz_y_salvo s WHERE s.usuario_id = u.id AND s.estado_global IN ${ESTADOS_ABIERTOS})`;

function buscar(search, params) {
  if (!search) return '';
  params.push(`%${search}%`);
  return `AND (u.correo_institucional ILIKE $${params.length} OR (u.nombres || ' ' || u.apellidos) ILIKE $${params.length})`;
}

// ---------------------------------------------------------------- solicitantes
const FILTROS_SOLICITANTES = {
  pendientes: `AND NOT u.verificado AND u.estado = 'ACTIVO'`,
  verificados: `AND u.verificado AND u.estado = 'ACTIVO'`,
  inactivos: `AND u.estado = 'INACTIVO'`,
  todos: '',
};

async function listSolicitantes(client, { search, filtro, limit, offset }) {
  const params = [];
  const busqueda = buscar(search, params);
  params.push(limit, offset);
  const { rows } = await client.query(
    `SELECT u.id, u.nombres, u.apellidos, u.correo_institucional, u.tipo_vinculacion, u.cargo,
            u.estado, u.origen, u.verificado, u.fecha_verificacion, u.created_at, u.ultimo_acceso,
            ${TRAMITE_EN_CURSO} AS tramite_en_curso,
            COUNT(*) OVER() AS total_records
       FROM usuarios u
      WHERE NOT ${ES_PERSONAL} ${FILTROS_SOLICITANTES[filtro] ?? ''} ${busqueda}
      ORDER BY u.verificado ASC, u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    rows: rows.map(({ total_records, ...row }) => row),
    total: rows.length ? Number(rows[0].total_records) : 0,
  };
}

async function contarSolicitantes(client) {
  const { rows: [c] } = await client.query(
    `SELECT COUNT(*) FILTER (WHERE NOT u.verificado AND u.estado = 'ACTIVO') AS pendientes,
            COUNT(*) FILTER (WHERE u.verificado AND u.estado = 'ACTIVO') AS verificados,
            COUNT(*) FILTER (WHERE u.estado = 'INACTIVO') AS inactivos,
            COUNT(*) AS todos
       FROM usuarios u WHERE NOT ${ES_PERSONAL}`
  );
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

// ---------------------------------------------------------------- personal de dependencias
async function listPersonal(client, { search, dependenciaId, limit, offset }) {
  const params = [PERSONAL_ROLES];
  const busqueda = buscar(search, params);
  let porDependencia = '';
  if (dependenciaId) {
    params.push(dependenciaId);
    porDependencia = `AND EXISTS (SELECT 1 FROM encargados_dependencia e WHERE e.usuario_id = u.id AND e.dependencia_id = $${params.length})`;
  }
  params.push(limit, offset);
  const { rows } = await client.query(
    `SELECT u.id, u.nombres, u.apellidos, u.correo_institucional, u.cargo, u.estado, u.origen,
            u.ultimo_acceso, u.google_sub IS NOT NULL AS ha_ingresado,
            (SELECT COALESCE(json_agg(r.nombre_rol ORDER BY r.nombre_rol), '[]'::json)
               FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id) AS roles,
            (SELECT COALESCE(json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'etapa', d.etapa) ORDER BY d.orden), '[]'::json)
               FROM encargados_dependencia e JOIN dependencias d ON d.id = e.dependencia_id WHERE e.usuario_id = u.id) AS dependencias,
            COUNT(*) OVER() AS total_records
       FROM usuarios u
      WHERE EXISTS (SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
                     WHERE ur.usuario_id = u.id AND r.nombre_rol = ANY($1::text[]))
        ${busqueda} ${porDependencia}
      ORDER BY u.apellidos, u.nombres
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    rows: rows.map(({ total_records, ...row }) => row),
    total: rows.length ? Number(rows[0].total_records) : 0,
  };
}

async function contarPersonal(client) {
  const { rows: [c] } = await client.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM encargados_dependencia e WHERE e.usuario_id = u.id)) AS sin_dependencia
       FROM usuarios u
      WHERE EXISTS (SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
                     WHERE ur.usuario_id = u.id AND r.nombre_rol = ANY($1::text[]))`,
    [PERSONAL_ROLES]
  );
  return { total: Number(c.total), sinDependencia: Number(c.sin_dependencia) };
}

// ---------------------------------------------------------------- usuario
async function findUsuario(client, id, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT u.id, u.nombres, u.apellidos, u.correo_institucional, u.cargo, u.estado, u.origen, u.verificado,
            u.google_sub, ${ES_PERSONAL} AS es_personal, ${TRAMITE_EN_CURSO} AS tramite_en_curso,
            (SELECT COALESCE(array_agg(r.nombre_rol), '{}') FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
              WHERE ur.usuario_id = u.id) AS roles
       FROM usuarios u WHERE u.id = $1 ${forUpdate ? 'FOR UPDATE OF u' : ''}`,
    [id]
  );
  return rows[0] || null;
}

async function findByCorreo(client, correo) {
  const { rows } = await client.query('SELECT id FROM usuarios WHERE correo_institucional = $1', [correo]);
  return rows[0] || null;
}

// Si cambia el correo se suelta la cuenta de Google enlazada: la nueva cuenta se enlaza en su primer ingreso
async function updateDatos(client, id, { nombres, apellidos, correo, cargo }) {
  const { rows } = await client.query(
    `UPDATE usuarios
        SET nombres = $2, apellidos = $3, cargo = $5,
            google_sub = CASE WHEN correo_institucional IS DISTINCT FROM $4 THEN NULL ELSE google_sub END,
            correo_institucional = $4
      WHERE id = $1
      RETURNING id, nombres, apellidos, correo_institucional, cargo`,
    [id, nombres, apellidos, correo, cargo]
  );
  return rows[0] || null;
}

async function setVerificado(client, id, { verificado, porId }) {
  await client.query(
    `UPDATE usuarios SET verificado = $2, verificado_por = $3, fecha_verificacion = NOW(), estado = 'ACTIVO' WHERE id = $1`,
    [id, verificado, porId]
  );
}

async function setEstado(client, id, estado) {
  await client.query('UPDATE usuarios SET estado = $2 WHERE id = $1', [id, estado]);
}

async function crearPersonal(client, { nombres, apellidos, correo, cargo }) {
  const { rows } = await client.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_institucional, cargo, origen, verificado)
     VALUES ($1, $2, $3, $4, 'REGISTRADO_TI', TRUE) RETURNING id`,
    [nombres, apellidos, correo, cargo]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------- dependencias del personal
async function findDependencia(client, id) {
  const { rows } = await client.query(
    'SELECT id, nombre, etapa, solo_docentes FROM dependencias WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function listDependenciasConEncargados(client) {
  const { rows } = await client.query(
    `SELECT d.id, d.nombre, d.etapa, d.orden, d.solo_docentes,
            (SELECT COUNT(*) FROM encargados_dependencia e WHERE e.dependencia_id = d.id) AS personas
       FROM dependencias d ORDER BY d.orden`
  );
  return rows.map((r) => ({ ...r, personas: Number(r.personas) }));
}

// Revisiones en curso que dejarían de tener quién las atienda si esta persona sale de la dependencia
async function revisionesPendientesDe(client, usuarioId) {
  const { rows } = await client.query(
    `SELECT d.nombre, COUNT(*) AS pendientes
       FROM encargados_dependencia e
       JOIN dependencias d ON d.id = e.dependencia_id
       JOIN revisiones_area r ON r.dependencia_id = d.id AND r.estado = 'SOLICITADA'
       JOIN solicitudes_paz_y_salvo s ON s.id = r.solicitud_id AND s.estado_global = 'EN_PROCESO'
      WHERE e.usuario_id = $1
        AND (d.etapa <> 1 OR s.jefe_inmediato_id = $1)
        AND (d.etapa = 1 OR (SELECT COUNT(*) FROM encargados_dependencia o WHERE o.dependencia_id = d.id) = 1)
      GROUP BY d.nombre`,
    [usuarioId]
  );
  return rows;
}

// Trámites abiertos que eligieron a esta persona como jefe inmediato
async function tramitesConJefe(client, usuarioId) {
  const { rows: [c] } = await client.query(
    `SELECT COUNT(*) AS total FROM solicitudes_paz_y_salvo
      WHERE jefe_inmediato_id = $1 AND estado_global IN ${ESTADOS_ABIERTOS}`,
    [usuarioId]
  );
  return Number(c.total);
}

// Reemplaza roles y dependencia del personal (la persona deja de ser solicitante)
async function asignarPersonal(client, usuarioId, dependencia, rol) {
  await client.query('DELETE FROM encargados_dependencia WHERE usuario_id = $1', [usuarioId]);
  await client.query(
    'DELETE FROM usuario_roles WHERE usuario_id = $1 AND rol_id IN (SELECT id FROM roles WHERE nombre_rol = ANY($2::text[]))',
    [usuarioId, [...PERSONAL_ROLES, ...WORKER_ROLES]]
  );
  await client.query(
    'INSERT INTO usuario_roles (usuario_id, rol_id) SELECT $1, id FROM roles WHERE nombre_rol = $2',
    [usuarioId, rol]
  );
  await client.query(
    'INSERT INTO encargados_dependencia (usuario_id, dependencia_id, es_jefe_inmediato) VALUES ($1, $2, $3)',
    [usuarioId, dependencia.id, dependencia.etapa === 1]
  );
}

async function quitarPersonal(client, usuarioId) {
  await client.query('DELETE FROM encargados_dependencia WHERE usuario_id = $1', [usuarioId]);
  await client.query(
    'DELETE FROM usuario_roles WHERE usuario_id = $1 AND rol_id IN (SELECT id FROM roles WHERE nombre_rol = ANY($2::text[]))',
    [usuarioId, PERSONAL_ROLES]
  );
}

module.exports = {
  PERSONAL_ROLES,
  WORKER_ROLES,
  listSolicitantes,
  contarSolicitantes,
  listPersonal,
  contarPersonal,
  findUsuario,
  findByCorreo,
  updateDatos,
  setVerificado,
  setEstado,
  crearPersonal,
  findDependencia,
  listDependenciasConEncargados,
  revisionesPendientesDe,
  tramitesConJefe,
  asignarPersonal,
  quitarPersonal,
};
