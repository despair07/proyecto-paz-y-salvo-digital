// ============================================================================
// REPOSITORIO DE TRÁMITES (solicitudes, informes, entregables, aprobación,
// certificados y catálogos). Todas las funciones reciben el `client` de
// database.withUserContext para ejecutarse dentro de una transacción auditada.
// ============================================================================

const SOLICITUD_SELECT = `
  SELECT
    s.id, s.usuario_id, s.periodo_academico_id, s.jefe_inmediato_id, s.tipo_novedad,
    s.cargo_desempenado, s.lugar_expedicion_documento, s.fecha_retiro, s.fecha_solicitud,
    s.estado_global, s.etapa_actual, s.informe_entrega_cargo, s.aprobado_final,
    s.aprobador_final_id, s.fecha_aprobacion_final, s.observaciones_aprobacion,
    u.nombres, u.apellidos, u.tipo_documento, u.numero_documento,
    u.correo_institucional, u.tipo_vinculacion, p.nombre_periodo
  FROM solicitudes_paz_y_salvo s
  JOIN usuarios u ON u.id = s.usuario_id
  JOIN periodos_academicos p ON p.id = s.periodo_academico_id`;

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

async function create(client, {
  usuarioId, periodoId, jefeInmediatoId, tipoNovedad, cargo, lugarExpedicion, fechaRetiro,
}) {
  const { rows } = await client.query(
    `INSERT INTO solicitudes_paz_y_salvo
       (usuario_id, periodo_academico_id, jefe_inmediato_id, tipo_novedad, cargo_desempenado,
        lugar_expedicion_documento, fecha_retiro)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [usuarioId, periodoId, jefeInmediatoId, tipoNovedad, cargo, lugarExpedicion, fechaRetiro]
  );
  return findById(client, rows[0].id);
}

async function findDefaultJefeInmediatoId(client) {
  const { rows } = await client.query(
    `SELECT usuario_id FROM encargados_dependencia
      WHERE es_jefe_inmediato = TRUE ORDER BY created_at LIMIT 1`
  );
  return rows[0]?.usuario_id || null;
}

// Estado de cada dependencia evaluadora para un trámite, con contacto e historial resuelto.
async function listAreaStates(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT
       v.dependencia_id AS id, v.dependencia AS nombre, d.descripcion, d.solo_docentes,
       v.etapa, v.orden, v.estado, v.bloqueos_activos, v.motivo_bloqueo,
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
     JOIN dependencias d ON d.id = v.dependencia_id
     WHERE v.solicitud_id = $1
     ORDER BY v.orden`,
    [solicitudId]
  );
  return rows;
}

// ------------------------------------------------------------------- Informe
async function findInforme(client, solicitudId) {
  const { rows } = await client.query(
    `SELECT solicitud_id, estado, secciones, fecha_completado, validado_por_id, fecha_validacion, updated_at
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
                                    THEN COALESCE(informes_entrega_cargo.fecha_completado, NOW()) END,
            validado_por_id = NULL,
            fecha_validacion = NULL
     RETURNING solicitud_id, estado, secciones, fecha_completado, updated_at`,
    [solicitudId, estado, JSON.stringify(secciones || {})]
  );
  return rows[0];
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

// ---------------------------------------------------------------- Aprobación
// Solicitudes listas para la aprobación final (etapa Comunidad Universitaria).
async function listPendingApproval(client) {
  const { rows } = await client.query(
    `${SOLICITUD_SELECT}
      WHERE s.etapa_actual = 'COMUNIDAD_UNIVERSITARIA' AND NOT s.aprobado_final
      ORDER BY s.fecha_solicitud`
  );
  return rows;
}

// Veredicto por dependencia (último bloqueo resuelto) para varios trámites.
async function listVerdicts(client, solicitudIds) {
  if (!solicitudIds.length) return [];
  const { rows } = await client.query(
    `SELECT v.solicitud_id, v.dependencia, v.estado,
            lb.motivo_descripcion AS motivo, lb.observacion_resolucion AS observacion,
            lb.fecha_resolucion, ru.nombres || ' ' || ru.apellidos AS responsable
       FROM v_estado_dependencias_solicitud v
       LEFT JOIN LATERAL (
         SELECT b.motivo_descripcion, b.observacion_resolucion, b.fecha_resolucion, b.resuelto_por_id
           FROM bloqueos_dependencia b
          WHERE b.solicitud_id = v.solicitud_id AND b.dependencia_id = v.dependencia_id
            AND b.estado = 'RESUELTO'
          ORDER BY b.fecha_resolucion DESC LIMIT 1
       ) lb ON TRUE
       LEFT JOIN usuarios ru ON ru.id = lb.resuelto_por_id
      WHERE v.solicitud_id = ANY($1::uuid[]) AND v.estado <> 'NO_APLICA'
      ORDER BY v.solicitud_id, v.orden`,
    [solicitudIds]
  );
  return rows;
}

async function approve(client, { id, approverId, observacion }) {
  await client.query(
    `UPDATE solicitudes_paz_y_salvo
        SET aprobado_final = TRUE, aprobador_final_id = $2,
            fecha_aprobacion_final = NOW(), observaciones_aprobacion = $3
      WHERE id = $1`,
    [id, approverId, observacion]
  );
  return findById(client, id);
}

async function reject(client, { id, approverId, observacion }) {
  await client.query(
    `UPDATE solicitudes_paz_y_salvo
        SET estado_global = 'RECHAZADO', etapa_actual = 'FINALIZADO', aprobador_final_id = $2,
            fecha_aprobacion_final = NOW(), observaciones_aprobacion = $3
      WHERE id = $1`,
    [id, approverId, observacion]
  );
  return findById(client, id);
}

// --------------------------------------------------------------- Certificados
const CERT_SELECT = `
  SELECT c.id, c.solicitud_id, c.token_verificacion, c.token_verificacion AS codigo_qr_token,
         c.hash_verificacion, c.archivo_url, c.emitido_por, c.fecha_emision, c.activo,
         s.cargo_desempenado, s.tipo_novedad, s.usuario_id,
         u.nombres, u.apellidos, u.tipo_documento, u.numero_documento, u.tipo_vinculacion,
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
    `SELECT id, nombre, nombre AS nombre_dependencia, descripcion, etapa, orden,
            solo_docentes, es_aprobadora_final
       FROM dependencias ORDER BY orden`
  );
  return rows;
}

module.exports = {
  findActivePeriod,
  findLatestByUser,
  findById,
  findByIdOrUser,
  create,
  findDefaultJefeInmediatoId,
  listAreaStates,
  findInforme,
  upsertInforme,
  findEntregables,
  upsertEntregables,
  listPendingApproval,
  listVerdicts,
  approve,
  reject,
  findCertificateBySolicitud,
  findCertificateByToken,
  insertCertificate,
  listDependencias,
};
