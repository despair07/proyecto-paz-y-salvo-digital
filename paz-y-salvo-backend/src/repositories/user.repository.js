// ============================================================================
// REPOSITORIO DE USUARIOS (autenticación, perfil, catálogo y cargo)
// ============================================================================

const db = require('../config/database');

const USER_SELECT = `
  SELECT
    u.id, u.nombres, u.apellidos, u.tipo_documento, u.numero_documento,
    u.correo_institucional, u.tipo_vinculacion, u.estado, u.cargo, u.password_hash,
    u.origen, u.verificado, u.google_sub,
    COALESCE(json_agg(r.nombre_rol ORDER BY r.nombre_rol) FILTER (WHERE r.id IS NOT NULL), '[]'::json) AS roles,
    (SELECT ed.dependencia_id FROM encargados_dependencia ed
      WHERE ed.usuario_id = u.id ORDER BY ed.created_at LIMIT 1) AS dependencia_id,
    (SELECT d.nombre FROM encargados_dependencia ed JOIN dependencias d ON d.id = ed.dependencia_id
      WHERE ed.usuario_id = u.id ORDER BY ed.created_at LIMIT 1) AS dependencia
  FROM usuarios u
  LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
  LEFT JOIN roles r ON r.id = ur.rol_id`;

async function findByEmail(email) {
  const { rows } = await db.query(
    `${USER_SELECT} WHERE u.correo_institucional = $1 GROUP BY u.id`,
    [String(email).toLowerCase()]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.id = $1 GROUP BY u.id`, [id]);
  return rows[0] || null;
}

async function listAssignedDependencyIds(client, usuarioId) {
  const { rows } = await client.query(
    'SELECT dependencia_id FROM encargados_dependencia WHERE usuario_id = $1 ORDER BY created_at',
    [usuarioId]
  );
  return rows.map((row) => row.dependencia_id);
}

// Catálogo de usuarios con su dependencia, roles y último trámite.
async function list(client, { search, soloConTramite, limit, offset }) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.numero_documento ILIKE $${params.length}
      OR u.correo_institucional ILIKE $${params.length}
      OR (u.nombres || ' ' || u.apellidos) ILIKE $${params.length})`);
  }
  if (soloConTramite) {
    where.push(`s.id IS NOT NULL AND s.estado_global IN ('EN_PROCESO', 'AL_DIA')`);
  }
  params.push(limit, offset);

  const { rows } = await client.query(
    `SELECT
       u.id, u.nombres, u.apellidos, u.numero_documento, u.correo_institucional,
       u.tipo_vinculacion, u.estado,
       COALESCE(u.cargo, s.cargo_desempenado) AS cargo_desempenado,
       COALESCE(json_agg(DISTINCT r.nombre_rol) FILTER (WHERE r.id IS NOT NULL), '[]'::json) AS roles,
       d.id AS dependencia_id, d.nombre AS dependencia,
       s.id AS solicitud_id, s.estado_global,
       COUNT(*) OVER() AS total_records
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN LATERAL (
       SELECT dep.id, dep.nombre
         FROM encargados_dependencia ed JOIN dependencias dep ON dep.id = ed.dependencia_id
        WHERE ed.usuario_id = u.id ORDER BY ed.created_at LIMIT 1
     ) d ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, estado_global, cargo_desempenado
         FROM solicitudes_paz_y_salvo
        WHERE usuario_id = u.id ORDER BY fecha_solicitud DESC LIMIT 1
     ) s ON TRUE
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY u.id, d.id, d.nombre, s.id, s.estado_global, s.cargo_desempenado
     ORDER BY u.apellidos, u.nombres
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    rows: rows.map(({ total_records, ...row }) => ({
      ...row,
      nombre_completo: `${row.nombres} ${row.apellidos}`,
    })),
    total: rows.length ? Number(rows[0].total_records) : 0,
  };
}

async function updateCargo(client, id, cargo) {
  const { rows } = await client.query(
    `UPDATE usuarios SET cargo = $2 WHERE id = $1
     RETURNING id, nombres, apellidos, correo_institucional, cargo AS cargo_desempenado`,
    [id, cargo]
  );
  return rows[0] || null;
}

const WORKER_ROLES = ['Docente', 'Administrativo', 'Contratista'];

// Autoregistro con Google: la persona queda sin verificar, sin rol y sin tipo de vinculación.
async function createSelfRegistered(client, { nombres, apellidos, correo, googleSub }) {
  const { rows } = await client.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_institucional, origen, verificado, google_sub, ultimo_acceso)
     VALUES ($1, $2, $3, 'AUTOREGISTRO', FALSE, $4, NOW())
     RETURNING id`,
    [nombres, apellidos, correo, googleSub]
  );
  return rows[0].id;
}

async function touchLogin(id, googleSub) {
  await db.query(
    'UPDATE usuarios SET ultimo_acceso = NOW(), google_sub = COALESCE(google_sub, $2) WHERE id = $1',
    [id, googleSub || null]
  );
}

async function listIdsByRole(client, roleName) {
  const { rows } = await client.query(
    `SELECT DISTINCT u.id FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.nombre_rol = $1 AND u.estado = 'ACTIVO'`,
    [roleName]
  );
  return rows.map((row) => row.id);
}

async function lockForTipoChange(client, id) {
  const { rows } = await client.query(
    'SELECT id, nombres, apellidos, correo_institucional, tipo_vinculacion FROM usuarios WHERE id = $1 FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

// Fija el tipo y deja como único rol de trabajador el que corresponde (RN-012 lo valida la BD).
async function setTipoVinculacion(client, id, tipo) {
  await client.query('UPDATE usuarios SET tipo_vinculacion = $2 WHERE id = $1', [id, tipo]);
  await client.query(
    `DELETE FROM usuario_roles
      WHERE usuario_id = $1 AND rol_id IN (SELECT id FROM roles WHERE nombre_rol = ANY($2::text[]))`,
    [id, WORKER_ROLES]
  );
  await client.query(
    'INSERT INTO usuario_roles (usuario_id, rol_id) SELECT $1, id FROM roles WHERE nombre_rol = $2',
    [id, tipo]
  );
}

module.exports = {
  WORKER_ROLES,
  findByEmail,
  findById,
  listAssignedDependencyIds,
  list,
  updateCargo,
  createSelfRegistered,
  touchLogin,
  listIdsByRole,
  lockForTipoChange,
  setTipoVinculacion,
};
