// ============================================================================
// REPOSITORIO DE NOTIFICACIONES (avisos dentro del sistema)
// ============================================================================

async function create(client, { usuarioId, tipo, titulo, mensaje, referencia = {} }) {
  const { rows } = await client.query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, tipo, titulo, mensaje, referencia, leida, created_at`,
    [usuarioId, tipo, titulo, mensaje, JSON.stringify(referencia)]
  );
  return rows[0];
}

async function createForMany(client, usuarioIds, payload) {
  for (const usuarioId of usuarioIds) {
    await create(client, { ...payload, usuarioId });
  }
}

async function listByUser(client, usuarioId, { soloNoLeidas, limit }) {
  const { rows } = await client.query(
    `SELECT id, tipo, titulo, mensaje, referencia, leida, fecha_lectura, created_at
       FROM notificaciones
      WHERE usuario_id = $1 ${soloNoLeidas ? 'AND NOT leida' : ''}
      ORDER BY created_at DESC
      LIMIT $2`,
    [usuarioId, limit]
  );
  return rows;
}

async function countUnread(client, usuarioId) {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS n FROM notificaciones WHERE usuario_id = $1 AND NOT leida',
    [usuarioId]
  );
  return rows[0].n;
}

async function markRead(client, id, usuarioId) {
  const { rows } = await client.query(
    `UPDATE notificaciones SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, NOW())
      WHERE id = $1::uuid AND usuario_id = $2
      RETURNING id`,
    [id, usuarioId]
  );
  return rows.length > 0;
}

async function markAllRead(client, usuarioId) {
  const { rows } = await client.query(
    `UPDATE notificaciones SET leida = TRUE, fecha_lectura = NOW()
      WHERE usuario_id = $1 AND NOT leida RETURNING id`,
    [usuarioId]
  );
  return rows.length;
}

module.exports = { create, createForMany, listByUser, countUnread, markRead, markAllRead };
