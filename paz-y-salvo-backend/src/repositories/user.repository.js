// ============================================================================
// REPOSITORIO DE USUARIOS (autenticación, perfil, catálogo y cargo)
// ============================================================================

const db = require('../config/database');

const USER_SELECT = `
  SELECT
    u.id, u.nombres, u.apellidos, u.tipo_documento, u.numero_documento,
    u.correo_institucional, u.tipo_vinculacion, u.estado, u.cargo, u.password_hash,
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

module.exports = { findByEmail, findById, listAssignedDependencyIds, list, updateCargo };
