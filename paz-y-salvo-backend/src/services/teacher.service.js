// ============================================================================
// SERVICIO DE DESARROLLO PROFESORAL (RN-007, RF-008)
// El Centro de Desarrollo Profesoral evalúa los 3 entregables del docente mientras revisa su
// solicitud. Es una sola persona que revisa las tres filas de la sección 4 del formato: aquí marca
// cuáles aprobó; luego aprueba la solicitud (solo si las tres están aprobadas) o la bloquea.
// ============================================================================

const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const requestService = require('./request.service');
const { ROLES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

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
      await requestService.assertCanRead(client, solicitud, currentUser);

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
      if (solicitud.usuario_id === currentUser.id) {
        throw new HttpError(403, 'RN-013: no puede evaluar sus propios entregables');
      }
      if (solicitud.tipo_vinculacion !== 'Docente') {
        throw new HttpError(409, 'RN-007: los entregables profesorales aplican solo a personal docente');
      }
      const revision = await requestRepository.findRevision(client, solicitud.id, profesoral.id);
      if (!revision || revision.estado !== 'SOLICITADA') {
        throw new HttpError(409, 'El docente aún no ha solicitado la revisión de Desarrollo Profesoral o ya fue resuelta');
      }

      const ep = await requestRepository.upsertEntregables(client, {
        solicitudId: solicitud.id,
        planesAula: planes_aula ?? null,
        innovaciones: innovaciones_educativas ?? null,
        informes: informes_ejecucion ?? null,
        evaluadorId: currentUser.id,
        observaciones: typeof observaciones === 'string' ? observaciones.trim() : null,
      });

      return {
        ok: true,
        mensaje: ep.completo
          ? 'Los 3 entregables están aprobados: ya puedes aprobar la solicitud'
          : 'Entregables actualizados. Para aprobar deben estar los 3 aprobados; de lo contrario, bloquea la solicitud (RN-007)',
        data: toResponse(solicitud.id, ep),
      };
    });
  }
}

module.exports = new TeacherService();
