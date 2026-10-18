// ============================================================================
// REPOSITORIO DE TRÁMITES: solicitudes, revisiones por dependencia, informe, entregables,
// aprobación final, certificados y catálogos. Todas las funciones reciben el `client` de
// database.withClient (lecturas) o database.withUserContext (escrituras auditadas).
// Las imágenes de firmas nunca viajan en las consultas generales (solo donde se piden).
// ============================================================================

const SOLICITUD_SELECT = `
  SELECT
    s.id, s.usuario_id, s.periodo_academico_id, s.solicitud_anterior_id, s.jefe_inmediato_id,
    s.nombre_completo, s.tipo_documento, s.numero_documento, s.lugar_expedicion_documento,
    s.cargo_desempenado, s.tipo_novedad, s.fecha_retiro, s.fecha_solicitud,
    s.estado_global, s.informe_entrega_cargo,
    s.observaciones_trabajador, s.clausula_aceptada, s.fecha_clausula,
    (s.firma_trabajador IS NOT NULL) AS tiene_firma_trabajador, s.fecha_solicitud_final,
    s.aprobado_final, s.aprobador_final_id, s.fecha_aprobacion_final, s.observaciones_aprobacion,
    (s.firma_aprobador IS NOT NULL) AS tiene_firma_aprobador,
    u.nombres, u.apellidos, u.correo_institucional, u.tipo_vinculacion, u.verificado,
    p.nombre_periodo,
    CASE WHEN j.id IS NULL THEN NULL ELSE j.nombres || ' ' || j.apellidos END AS jefe_nombre,
    j.cargo AS jefe_cargo, j.correo_institucional AS jefe_correo,
    CASE WHEN ap.id IS NULL THEN NULL ELSE ap.nombres || ' ' || ap.apellidos END AS aprobador_nombre
  FROM solicitudes_paz_y_salvo s
  JOIN usuarios u ON u.id = s.usuario_id
  JOIN periodos_academicos p ON p.id = s.periodo_academico_id
  LEFT JOIN usuarios j ON j.id = s.jefe_inmediato_id
  LEFT JOIN usuarios ap ON ap.id = s.aprobador_final_id`;

// Campos de los datos generales que el trabajador puede editar (API → columna)
const DATOS_COLUMNS = {
  nombre_completo: 'nombre_completo',
  tipo_documento: 'tipo_documento',
  numero_documento: 'numero_documento',
  lugar_expedicion_documento: 'lugar_expedicion_documento',
  cargo_desempenado: 'cargo_desempenado',
  tipo_novedad: 'tipo_novedad',
  fecha_retiro: 'fecha_retiro',
  jefe_inmediato_id: 'jefe_inmediato_id',
};

// ---------------------------------------------------------------- Solicitudes
async function findActivePeriod(client) {
  const { rows } = await client.query(
    `SELECT id, nombre_periodo, fecha_inicio, fecha_fin
       FROM periodos_academicos WHERE activo = TRUE LIMIT 1`
  );
  return rows[0] || null;
}

async function findLatestByUser(client, usuarioId) {
  const { rows } = await client.query(
    `${SOLICITUD_SELECT} WHERE s.usuario_id = $1 ORDER BY s.fecha_solicitud DESC LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

async function findById(client, id, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `${SOLICITUD_SELECT} WHERE s.id = $1::uuid ${forUpdate ? 'FOR UPDATE OF s' : ''}`,
    [id]
  );
  return rows[0] || null;
}

async function findByIdOrUser(client, idOrUserId) {
  const { rows } = await client.query(
    `${SOLICITUD_SELECT}
      WHERE s.id = $1::uuid OR s.usuario_id = $1::uuid
      ORDER BY (s.id = $1::uuid) DESC, s.fecha_solicitud DESC LIMIT 1`,
    [idOrUserId]
  );
  return rows[0] || null;
}

async function createBorrador(client, {
  usuarioId, periodoId, nombreCompleto, tipoDocumento, numeroDocumento, lugarExpedicion,
  cargo, tipoNovedad, fechaRetiro, jefeInmediatoId, solicitudAnteriorId,
}) {
  const { rows } = await client.query(
    `INSERT INTO solicitudes_paz_y_salvo
       (usuario_id, periodo_academico_id, solicitud_anterior_id, nombre_completo, tipo_documento,
        numero_documento, lugar_expedicion_documento, cargo_desempenado, tipo_novedad, fecha_retiro,
        jefe_inmediato_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [usuarioId, periodoId, solicitudAnteriorId || null, nombreCompleto, tipoDocumento || 'CC',
      numeroDocumento || null, lugarExpedicion || null, cargo || null, tipoNovedad || 'RETIRO',
      fechaRetiro || null, jefeInmediatoId || null]
  );
  return findById(client, rows[0].id);
}

// Actualiza solo los campos recibidos de los datos generales
async function updateDatos(client, id, campos) {
  const sets = [];
  const params = [id];
  for (const [campo, valor] of Object.entries(campos)) {
    if (!DATOS_COLUMNS[campo]) continue;
    params.push(valor);
    sets.push(`${DATOS_COLUMNS[campo]} = $${params.length}`);
  }
  if (sets.length) {
    await client.query(`UPDATE solicitudes_paz_y_salvo SET ${sets.join(', ')} WHERE id = $1`, params);
  }
  return findById(client, id);
}

async function updateObservaciones(client, id, observaciones) {
  await client.query(
    'UPDATE solicitudes_paz_y_salvo SET observaciones_trabajador = $2 WHERE id = $1',
    [id, observaciones]
  );
}

// Cláusula de confidencialidad aceptada + firma del trabajador (o se retiran ambas)
async function setClausula(client, id, { aceptada, firma }) {
  await client.query(
    `UPDATE solicitudes_paz_y_salvo
        SET clausula_aceptada = $2::boolean,
            fecha_clausula = CASE WHEN $2::boolean THEN NOW() END,
            firma_trabajador = CASE WHEN $2::boolean THEN $3::text END
      WHERE id = $1`,
    [id, aceptada, firma || null]
  );
}

async function requestFinal(client, id) {
  await client.query(
    "UPDATE solicitudes_paz_y_salvo SET estado_global = 'PENDIENTE_APROBACION' WHERE id = $1",
    [id]
  );
  return findById(client, id);
}

async function approve(client, { id, approverId, observacion, firma }) {
  await client.query(
    `UPDATE solicitudes_paz_y_salvo
        SET estado_global = 'APROBADO_FINAL', aprobador_final_id = $2, observaciones_aprobacion = $3,
            firma_aprobador = $4
      WHERE id = $1`,
    [id, approverId, observacion, firma]
  );
  return findById(client, id);
}

async function reject(client, { id, approverId, observacion }) {
  await client.query(
    `UPDATE solicitudes_paz_y_salvo
        SET estado_global = 'RECHAZADO', aprobador_final_id = $2, observaciones_aprobacion = $3
      WHERE id = $1`,
    [id, approverId, observacion]
  );
  return findById(client, id);
}

// ------------------------------------------------- Estado por dependencia (vista del trabajador)
async function listAreaStates(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT
       v.dependencia_id AS id, v.dependencia AS nombre, v.seccion, v.aspecto, v.etapa, v.orden,
       v.solo_docentes, v.requiere_enlace, v.etiqueta_enlace, v.estado, v.revision_id,
       v.solicitada_el, v.intentos, v.enlace, v.revisor, v.fecha_revision, v.recibi,
       v.bloqueos_activos, v.motivo_bloqueo, v.categoria_bloqueo,
       (SELECT MAX(b.fecha_registro) FROM bloqueos_dependencia b
         WHERE b.solicitud_id = v.solicitud_id AND b.dependencia_id = v.dependencia_id
           AND b.estado = 'BLOQUEADO') AS fecha_bloqueo,
       COALESCE((
         SELECT json_agg(json_build_object(
                  'id', b.id, 'categoria', b.categoria, 'motivo', b.motivo_descripcion,
                  'fecha_registro', b.fecha_registro, 'fecha_resolucion', b.fecha_resolucion,
                  'observacion', b.observacion_resolucion) ORDER BY b.fecha_resolucion DESC)
           FROM bloqueos_dependencia b
          WHERE b.solicitud_id = v.solicitud_id AND b.dependencia_id = v.dependencia_id
            AND b.estado = 'RESUELTO'), '[]'::json) AS resueltos,
       (SELECT json_build_object('nombre', eu.nombres || ' ' || eu.apellidos,
                                 'correo', eu.correo_institucional, 'cargo', eu.cargo)
          FROM encargados_dependencia ed JOIN usuarios eu ON eu.id = ed.usuario_id
         WHERE ed.dependencia_id = v.dependencia_id ORDER BY ed.created_at LIMIT 1) AS contacto
     FROM v_estado_dependencias_solicitud v
     WHERE v.solicitud_id = $1
     ORDER BY v.orden`,
    [solicitudId]
  );
  return rows;
}

// ---------------------------------------------------------------- Revisiones por dependencia
async function findRevision(client, solicitudId, dependenciaId, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT id, solicitud_id, dependencia_id, estado, intentos, enlace
       FROM revisiones_area WHERE solicitud_id = $1 AND dependencia_id = $2 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [solicitudId, dependenciaId]
  );
  return rows[0] || null;
}

async function insertRevision(client, { solicitudId, dependenciaId, enlace }) {
  const { rows } = await client.query(
    'INSERT INTO revisiones_area (solicitud_id, dependencia_id, enlace) VALUES ($1, $2, $3) RETURNING id',
    [solicitudId, dependenciaId, enlace || null]
  );
  return rows[0].id;
}

// El trabajador vuelve a solicitar una dependencia que lo bloqueó
async function resubmitRevision(client, id, enlace) {
  await client.query(
    "UPDATE revisiones_area SET estado = 'SOLICITADA', enlace = COALESCE($2, enlace) WHERE id = $1",
    [id, enlace || null]
  );
}

async function decideRevision(client, { id, estado, revisorId, recibi, firma }) {
  await client.query(
    `UPDATE revisiones_area
        SET estado = $2, revisor_id = $3, fecha_revision = NOW(), recibi = $4, firma_snapshot = $5
      WHERE id = $1`,
    [id, estado, revisorId, recibi || null, firma || null]
  );
}

const REVISION_SELECT = `
  SELECT
    r.id, r.estado, r.solicitada_el, r.intentos, r.enlace, r.fecha_revision, r.recibi,
    (r.firma_snapshot IS NOT NULL) AS tiene_firma, r.revisor_id,
    d.id AS dependencia_id, d.nombre AS dependencia, d.aspecto, d.etapa, d.solo_docentes,
    d.requiere_enlace, d.etiqueta_enlace,
    s.id AS solicitud_id, s.usuario_id, s.nombre_completo, s.tipo_documento, s.numero_documento,
    s.lugar_expedicion_documento, s.cargo_desempenado, s.tipo_novedad, s.fecha_retiro,
    s.informe_entrega_cargo, s.estado_global, s.jefe_inmediato_id,
    u.correo_institucional, u.tipo_vinculacion, u.verificado,
    act.motivo AS motivo_bloqueo, act.categoria AS categoria_bloqueo
  FROM revisiones_area r
  JOIN dependencias d ON d.id = r.dependencia_id
  JOIN solicitudes_paz_y_salvo s ON s.id = r.solicitud_id
  JOIN usuarios u ON u.id = s.usuario_id
  LEFT JOIN LATERAL (
    SELECT b.motivo_descripcion AS motivo, b.categoria
      FROM bloqueos_dependencia b
     WHERE b.solicitud_id = r.solicitud_id AND b.dependencia_id = r.dependencia_id AND b.estado = 'BLOQUEADO'
     LIMIT 1
  ) act ON TRUE`;

async function findRevisionById(client, id, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `${REVISION_SELECT} WHERE r.id = $1::uuid ${forUpdate ? 'FOR UPDATE OF r' : ''}`,
    [id]
  );
  return rows[0] || null;
}

// Bandeja de una persona que revisa: sus dependencias (y, para el jefe inmediato, solo los
// trámites donde fue elegido).
async function listInbox(client, { dependencyIds, userId, estado, q, limit, offset }) {
  if (!dependencyIds.length) return { rows: [], total: 0 };
  const params = [dependencyIds, userId];
  const where = ['r.dependencia_id = ANY($1::uuid[])', '(d.etapa <> 1 OR s.jefe_inmediato_id = $2)'];
  if (estado) {
    params.push(estado);
    where.push(`r.estado = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(s.nombre_completo ILIKE $${params.length} OR s.numero_documento ILIKE $${params.length}
      OR u.correo_institucional ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');
  const total = await client.query(
    `SELECT COUNT(*)::int AS n FROM revisiones_area r
       JOIN dependencias d ON d.id = r.dependencia_id
       JOIN solicitudes_paz_y_salvo s ON s.id = r.solicitud_id
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE ${whereSql}`,
    params
  );
  params.push(limit, offset);
  const { rows } = await client.query(
    `${REVISION_SELECT} WHERE ${whereSql}
      ORDER BY (r.estado = 'SOLICITADA') DESC, r.solicitada_el
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total: total.rows[0].n };
}

async function listBloqueosDeDependencia(client, solicitudId, dependenciaId) {
  const { rows } = await client.query(
    `SELECT b.id, b.categoria, b.motivo_descripcion AS motivo, b.estado, b.fecha_registro,
            b.fecha_resolucion, b.observacion_resolucion AS observacion
       FROM bloqueos_dependencia b
      WHERE b.solicitud_id = $1 AND b.dependencia_id = $2
      ORDER BY b.fecha_registro DESC`,
    [solicitudId, dependenciaId]
  );
  return rows;
}

// ------------------------------------------------------------------- Informe
async function findInforme(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT solicitud_id, estado, secciones, fecha_completado, updated_at
       FROM informes_entrega_cargo WHERE solicitud_id = $1`,
    [solicitudId]
  );
  return rows[0] || null;
}

async function upsertInforme(client, { solicitudId, estado, secciones }) {
  const { rows } = await client.query(
    `INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones, fecha_completado)
     VALUES ($1, $2::varchar, $3::jsonb, CASE WHEN $2::varchar = 'COMPLETO' THEN NOW() END)
     ON CONFLICT (solicitud_id) DO UPDATE
        SET estado = EXCLUDED.estado,
            secciones = EXCLUDED.secciones,
            fecha_completado = CASE WHEN EXCLUDED.estado = 'COMPLETO'
                                    THEN COALESCE(informes_entrega_cargo.fecha_completado, NOW()) END
     RETURNING solicitud_id, estado, secciones, fecha_completado, updated_at`,
    [solicitudId, estado, JSON.stringify(secciones || {})]
  );
  return rows[0];
}

// El informe de un trámite rechazado se copia (como borrador) al trámite nuevo
async function copyInforme(client, desdeId, haciaId) {
  await client.query(
    `INSERT INTO informes_entrega_cargo (solicitud_id, estado, secciones)
     SELECT $2, 'BORRADOR', secciones FROM informes_entrega_cargo WHERE solicitud_id = $1
     ON CONFLICT (solicitud_id) DO NOTHING`,
    [desdeId, haciaId]
  );
}

// --------------------------------------------------------------- Entregables
async function findEntregables(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT solicitud_id, planes_aula_aprobado AS planes_aula,
            innovaciones_educativas_aprobado AS innovaciones_educativas,
            informes_ejecucion_aprobado AS informes_ejecucion, completo,
            evaluador_id, fecha_evaluacion, observaciones
       FROM entregables_profesorales WHERE solicitud_id = $1`,
    [solicitudId]
  );
  return rows[0] || null;
}

async function upsertEntregables(client, {
  solicitudId, planesAula, innovaciones, informes, evaluadorId, observaciones,
}) {
  await client.query(
    `INSERT INTO entregables_profesorales
       (solicitud_id, planes_aula_aprobado, innovaciones_educativas_aprobado,
        informes_ejecucion_aprobado, evaluador_id, fecha_evaluacion, observaciones)
     VALUES ($1, COALESCE($2, FALSE), COALESCE($3, FALSE), COALESCE($4, FALSE), $5, NOW(), $6)
     ON CONFLICT (solicitud_id) DO UPDATE
        SET planes_aula_aprobado = COALESCE($2, entregables_profesorales.planes_aula_aprobado),
            innovaciones_educativas_aprobado = COALESCE($3, entregables_profesorales.innovaciones_educativas_aprobado),
            informes_ejecucion_aprobado = COALESCE($4, entregables_profesorales.informes_ejecucion_aprobado),
            evaluador_id = $5,
            fecha_evaluacion = NOW(),
            observaciones = COALESCE($6, entregables_profesorales.observaciones)`,
    [solicitudId, planesAula, innovaciones, informes, evaluadorId, observaciones]
  );
  return findEntregables(client, solicitudId);
}

// ---------------------------------------------------------------- Aprobación final
async function listPendingFinal(client) {
  const { rows } = await client.query(
    `${SOLICITUD_SELECT} WHERE s.estado_global = 'PENDIENTE_APROBACION' ORDER BY s.fecha_solicitud_final`
  );
  return rows;
}

// Lista de verificación para Comunidad Universitaria: cada dependencia con quién aprobó, cuándo,
// el "Recibí" y la firma (imagen) de esa aprobación.
async function listChecklist(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT v.dependencia_id AS id, v.dependencia AS nombre, v.seccion, v.aspecto, v.etapa, v.orden,
            v.solo_docentes, v.estado, v.enlace, v.etiqueta_enlace, v.revisor, v.fecha_revision, v.recibi,
            r.firma_snapshot AS firma
       FROM v_estado_dependencias_solicitud v
       LEFT JOIN revisiones_area r ON r.id = v.revision_id
      WHERE v.solicitud_id = $1 AND v.estado <> 'NO_APLICA'
      ORDER BY v.orden`,
    [solicitudId]
  );
  return rows;
}

async function findFirmas(client, solicitudId) {
  const { rows } = await client.query(
    'SELECT firma_trabajador AS trabajador, firma_aprobador AS aprobador FROM solicitudes_paz_y_salvo WHERE id = $1',
    [solicitudId]
  );
  return rows[0] || {};
}

// --------------------------------------------------------------- Certificados
const CERT_SELECT = `
  SELECT c.id, c.solicitud_id, c.token_verificacion, c.token_verificacion AS codigo_qr_token,
         c.hash_verificacion, c.archivo_url, c.emitido_por, c.fecha_emision, c.activo,
         s.cargo_desempenado, s.tipo_novedad, s.usuario_id,
         COALESCE(s.nombre_completo, u.nombres || ' ' || u.apellidos) AS nombre_completo,
         u.nombres, u.apellidos, COALESCE(s.tipo_documento, u.tipo_documento) AS tipo_documento,
         COALESCE(s.numero_documento, u.numero_documento) AS numero_documento, u.tipo_vinculacion,
         p.nombre_periodo
  FROM certificados_digitales c
  JOIN solicitudes_paz_y_salvo s ON s.id = c.solicitud_id
  JOIN usuarios u ON u.id = s.usuario_id
  JOIN periodos_academicos p ON p.id = s.periodo_academico_id`;

async function findCertificateBySolicitud(client, solicitudId) {
  const { rows } = await client.query(`${CERT_SELECT} WHERE c.solicitud_id = $1`, [solicitudId]);
  return rows[0] || null;
}

async function findCertificateByToken(client, token) {
  const { rows } = await client.query(
    `${CERT_SELECT} WHERE c.token_verificacion = $1 AND c.activo = TRUE`,
    [token]
  );
  return rows[0] || null;
}

async function insertCertificate(client, { solicitudId, token, hash, archivoUrl, emitidoPor }) {
  await client.query(
    `INSERT INTO certificados_digitales
       (solicitud_id, token_verificacion, hash_verificacion, archivo_url, emitido_por)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (solicitud_id) DO NOTHING`,
    [solicitudId, token, hash, archivoUrl, emitidoPor]
  );
  return findCertificateBySolicitud(client, solicitudId);
}

// ------------------------------------------------------------------ Catálogos
async function listDependencias(client) {
  const { rows } = await client.query(
    `SELECT id, nombre, nombre AS nombre_dependencia, descripcion, aspecto, etapa, orden,
            solo_docentes, aplica_cambio_dependencia, requiere_enlace, etiqueta_enlace,
            es_aprobadora_final
       FROM dependencias ORDER BY orden`
  );
  return rows;
}

async function findDependencia(client, id) {
  const { rows } = await client.query('SELECT * FROM dependencias WHERE id = $1::uuid', [id]);
  return rows[0] || null;
}

// Usuarios que atienden una dependencia (para notificarles)
async function listEncargadoIds(client, dependenciaId) {
  const { rows } = await client.query(
    `SELECT e.usuario_id FROM encargados_dependencia e
       JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.dependencia_id = $1 AND u.estado = 'ACTIVO'`,
    [dependenciaId]
  );
  return rows.map((row) => row.usuario_id);
}

module.exports = {
  findActivePeriod,
  findLatestByUser,
  findById,
  findByIdOrUser,
  createBorrador,
  updateDatos,
  updateObservaciones,
  setClausula,
  requestFinal,
  approve,
  reject,
  listAreaStates,
  findRevision,
  insertRevision,
  resubmitRevision,
  decideRevision,
  findRevisionById,
  listInbox,
  listBloqueosDeDependencia,
  findInforme,
  upsertInforme,
  copyInforme,
  findEntregables,
  upsertEntregables,
  listPendingFinal,
  listChecklist,
  findFirmas,
  findCertificateBySolicitud,
  findCertificateByToken,
  insertCertificate,
  listDependencias,
  findDependencia,
  listEncargadoIds,
};
