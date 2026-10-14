// ============================================================================
// SERVICIO DE DESARROLLO PROFESORAL (RN-007, RF-008)
// El Centro de Desarrollo Profesoral evalúa los 3 entregables del docente. Al aprobar los tres
// se levanta su bloqueo; si falta alguno se mantiene o se registra un bloqueo (RN-001 lo propaga).
// ============================================================================

const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const lockRepository = require('../repositories/lock.repository');
const { ROLES, SOLICITANTES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const PENDING_REASON = 'Pendiente entrega o corrección de entregables docentes (RN-007)';
const APPROVED_REASON = 'Los 3 entregables docentes fueron aprobados a satisfacción (RN-007)';

function toResponse(solicitudId, ep) {
  return {
    solicitudId,
    planes_aula: Boolean(ep?.planes_aula),
    innovaciones_educativas: Boolean(ep?.innovaciones_educativas),
    informes_ejecucion: Boolean(ep?.informes_ejecucion),
    aprobado_total: Boolean(ep?.completo),
    fecha_evaluacion: ep?.fecha_evaluacion || null,
    observaciones: ep?.observaciones || '',
  };
}

class TeacherService {
  async getByDocenteId(docenteOrSolicitudId, currentUser) {
    return database.withClient(async (client) => {
      const solicitud = await requestRepository.findByIdOrUser(client, docenteOrSolicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud docente no encontrada');

      if (hasRole(currentUser.roles, SOLICITANTES) && solicitud.usuario_id !== currentUser.id) {
        throw new HttpError(403, 'Solo puede consultar sus propios entregables');
      }

      const ep = await requestRepository.findEntregables(client, solicitud.id);
      return toResponse(solicitud.id, ep);
    });
  }

  async updateEntregables(docenteOrSolicitudId, payload, currentUser) {
    if (!hasRole(currentUser.roles, [ROLES.ENCARGADO_AREA])) {
      throw new HttpError(403, 'Solo el Centro de Desarrollo Profesoral puede evaluar entregables');
    }

    const { planes_aula, innovaciones_educativas, informes_ejecucion, observaciones } = payload || {};
    const flags = [planes_aula, innovaciones_educativas, informes_ejecucion];
    if (flags.some((value) => value !== undefined && typeof value !== 'boolean')) {
      throw new HttpError(400, 'Los entregables deben enviarse como valores verdadero o falso');
    }

    return database.withUserContext(currentUser, 'Evaluar entregables profesorales', async (client) => {
      // RN-004: solo el encargado del Centro de Desarrollo Profesoral
      const { rows: [profesoral] } = await client.query(
        `SELECT d.id FROM dependencias d
           JOIN encargados_dependencia ed ON ed.dependencia_id = d.id
          WHERE d.solo_docentes AND ed.usuario_id = $1 LIMIT 1`,
        [currentUser.id]
      );
      if (!profesoral) {
        throw new HttpError(403, 'RN-004: solo el encargado del Centro de Desarrollo Profesoral evalúa los entregables');
      }

      const solicitud = await requestRepository.findByIdOrUser(client, docenteOrSolicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud docente no encontrada');
      if (solicitud.tipo_vinculacion !== 'Docente') {
        throw new HttpError(409, 'RN-007: los entregables profesorales aplican solo a personal docente');
      }
      if (['APROBADO_FINAL', 'RECHAZADO'].includes(solicitud.estado_global)) {
        throw new HttpError(409, 'El trámite ya está cerrado y los entregables no se pueden modificar');
      }

      const ep = await requestRepository.upsertEntregables(client, {
        solicitudId: solicitud.id,
        planesAula: planes_aula ?? null,
        innovaciones: innovaciones_educativas ?? null,
        informes: informes_ejecucion ?? null,
        evaluadorId: currentUser.id,
        observaciones: typeof observaciones === 'string' ? observaciones.trim() : null,
      });

      const active = await lockRepository.findActiveByArea(client, solicitud.id, profesoral.id);
      if (ep.completo && active) {
        await lockRepository.resolve(client, {
          id: active.id,
          resueltoPorId: currentUser.id,
          observacion: APPROVED_REASON,
        });
      } else if (!ep.completo && !active) {
        await lockRepository.create(client, {
          solicitudId: solicitud.id,
          dependenciaId: profesoral.id,
          registradoPorId: currentUser.id,
          categoria: 'ACADEMICO_PROFESORAL',
          motivo: PENDING_REASON,
        });
      }

      return {
        ok: true,
        mensaje: ep.completo
          ? 'Los 3 entregables fueron aprobados: área en Paz y Salvo'
          : 'Entregables actualizados. Área permanece con pendientes (RN-007)',
        data: toResponse(solicitud.id, ep),
      };
    });
  }
}

module.exports = new TeacherService();
