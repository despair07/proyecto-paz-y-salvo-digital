// ============================================================================
// REPOSITORIO DE BLOQUEOS (bloqueos_dependencia)
// Los alias `motivo` y `observacion` mantienen el contrato que consume el frontend.
// ============================================================================

const SELECT_LOCK = `
  SELECT
    b.id, b.solicitud_id, b.dependencia_id, b.registrado_por_id, b.categoria,
    b.motivo_descripcion, b.motivo_descripcion AS motivo, b.estado, b.fecha_registro,
    b.resuelto_por_id, b.fecha_resolucion,
    b.observacion_resolucion, b.observacion_resolucion AS observacion,
    d.nombre AS dependencia_nombre,
    CONCAT(u.nombres, ' ', u.apellidos) AS trabajador_nombre,
    u.numero_documento, u.correo_institucional, u.tipo_vinculacion,
    s.usuario_id, s.tipo_novedad, s.cargo_desempenado, s.estado_global
  FROM bloqueos_dependencia b
  JOIN dependencias d ON d.id = b.dependencia_id
  JOIN solicitudes_paz_y_salvo s ON s.id = b.solicitud_id
  JOIN usuarios u ON u.id = s.usuario_id`;

// scope: { dependencyIds: uuid[] | null, usuarioId: uuid | null } (null = sin restricción)
async function list(client, { scope = {}, filters = {}, limit, offset }) {
  const params = [];
  const where = [];

  if (scope.dependencyIds) {
    params.push(scope.dependencyIds);
    where.push(`b.dependencia_id = ANY($${params.length}::uuid[])`);
  }
  if (scope.usuarioId) {
    params.push(scope.usuarioId);
    where.push(`s.usuario_id = $${params.length}`);
  }
  if (filters.dependencia) {
    params.push(filters.dependencia);
    where.push(`b.dependencia_id = $${params.length}::uuid`);
  }
  if (filters.solicitudId) {
    params.push(filters.solicitudId);
    where.push(`b.solicitud_id = $${params.length}::uuid`);
  }
  if (filters.estado) {
    params.push(filters.estado);
    where.push(`b.estado = $${params.length}`);
  }
  if (filters.categoria) {
    params.push(filters.categoria);
    where.push(`b.categoria = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`((u.nombres || ' ' || u.apellidos) ILIKE $${params.length}
      OR u.numero_documento ILIKE $${params.length}
      OR u.correo_institucional ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM bloqueos_dependencia b
     JOIN solicitudes_paz_y_salvo s ON s.id = b.solicitud_id
     JOIN usuarios u ON u.id = s.usuario_id
     ${whereSql}`,
    params
  );

  params.push(limit, offset);
  const rows = await client.query(
    `${SELECT_LOCK} ${whereSql}
     ORDER BY (b.estado = 'BLOQUEADO') DESC, b.fecha_registro DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows: rows.rows, total: total.rows[0].total };
}

async function findById(client, id) {
  const { rows } = await client.query(`${SELECT_LOCK} WHERE b.id = $1::uuid`, [id]);
  return rows[0] || null;
}

async function create(client, { solicitudId, dependenciaId, registradoPorId, categoria, motivo }) {
  const { rows } = await client.query(
    `INSERT INTO bloqueos_dependencia
       (solicitud_id, dependencia_id, registrado_por_id, categoria, motivo_descripcion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [solicitudId, dependenciaId, registradoPorId, categoria, motivo]
  );
  return findById(client, rows[0].id);
}

async function resolve(client, { id, resueltoPorId, observacion }) {
  await client.query(
    `UPDATE bloqueos_dependencia
        SET estado = 'RESUELTO', resuelto_por_id = $2, fecha_resolucion = NOW(),
            observacion_resolucion = COALESCE($3, observacion_resolucion)
      WHERE id = $1 AND estado = 'BLOQUEADO'`,
    [id, resueltoPorId, observacion || null]
  );
  return findById(client, id);
}

async function updateText(client, { id, motivo, observacion }) {
  await client.query(
    `UPDATE bloqueos_dependencia
        SET motivo_descripcion = COALESCE($2, motivo_descripcion),
            observacion_resolucion = COALESCE($3, observacion_resolucion)
      WHERE id = $1`,
    [id, motivo || null, observacion || null]
  );
  return findById(client, id);
}

async function remove(client, id) {
  await client.query('DELETE FROM bloqueos_dependencia WHERE id = $1', [id]);
}

async function findActiveByArea(client, solicitudId, dependenciaId) {
  const { rows } = await client.query(
    `SELECT id FROM bloqueos_dependencia
      WHERE solicitud_id = $1 AND dependencia_id = $2 AND estado = 'BLOQUEADO' LIMIT 1`,
    [solicitudId, dependenciaId]
  );
  return rows[0] || null;
}

module.exports = { list, findById, create, resolve, updateText, remove, findActiveByArea };
