// ============================================================================
// SERVICIO DE REVISIONES POR DEPENDENCIA (lado de las áreas y del jefe inmediato)
//
// Cada dependencia recibe la solicitud del trabajador con sus datos, la revisa y decide:
//   · APROBAR  → escribe qué recibió o revisó («Recibí:») y firma con la firma de su perfil.
//   · BLOQUEAR → registra la categoría y el motivo; el trabajador corrige y vuelve a solicitar.
// RN-004: solo el encargado de la dependencia (el jefe inmediato elegido, en su etapa) revisa.
// RN-013: nadie revisa su propio trámite. RN-011: el Administrador DTI no accede a estos datos.
// ============================================================================

const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const lockRepository = require('../repositories/lock.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const firmaService = require('./firma.service');
const { ROLES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const REVIEWER_ROLES = [ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO];
const CATEGORIAS = ['FINANCIERO', 'INVENTARIO_ELEMENTOS', 'DOCUMENTAL_ENTREGABLES', 'ACADEMICO_PROFESORAL'];
const ESTADOS = ['SOLICITADA', 'APROBADA', 'BLOQUEADA'];

const texto = (value) => (typeof value === 'string' ? value.trim() : '');

class ReviewService {
  // RN-004 / RN-013: quién puede revisar esta solicitud
  async assertReviewer(client, currentUser, revision) {
    if (!hasRole(currentUser.roles, REVIEWER_ROLES)) {
      throw new HttpError(403, 'Solo el personal de las dependencias revisa solicitudes de paz y salvo');
    }
    if (revision.usuario_id === currentUser.id) {
      throw new HttpError(403, 'RN-013: no puede revisar su propio trámite');
    }
    const asignadas = await userRepository.listAssignedDependencyIds(client, currentUser.id);
    if (!asignadas.includes(revision.dependencia_id)) {
      throw new HttpError(403, 'RN-004: esta solicitud pertenece a otra dependencia');
    }
    if (revision.etapa === 1 && revision.jefe_inmediato_id !== currentUser.id) {
      throw new HttpError(403, 'RN-004: el trabajador eligió a otro jefe inmediato');
    }
  }

  async loadRevision(client, id, { forUpdate = false } = {}) {
    const revision = await requestRepository.findRevisionById(client, id, { forUpdate });
    if (!revision) throw new HttpError(404, 'Solicitud de revisión no encontrada');
    return revision;
  }

  // Bandeja: las solicitudes que llegan a mis dependencias
  async listInbox(currentUser, query = {}) {
    if (!hasRole(currentUser.roles, REVIEWER_ROLES)) {
      throw new HttpError(403, 'Solo el personal de las dependencias accede a esta bandeja');
    }
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
    const estado = ESTADOS.includes(query.estado) ? query.estado : undefined;

    return database.withClient(async (client) => {
      const dependencyIds = await userRepository.listAssignedDependencyIds(client, currentUser.id);
      const scope = { dependencyIds, userId: currentUser.id };
      const { rows, total } = await requestRepository.listInbox(client, {
        ...scope, estado, q: texto(query.q), limit, offset: (page - 1) * limit,
      });
      // Conteo por estado para los filtros (sin aplicar el filtro de estado)
      const conteos = { SOLICITADA: 0, APROBADA: 0, BLOQUEADA: 0 };
      await Promise.all(ESTADOS.map(async (e) => {
        const res = await requestRepository.listInbox(client, { ...scope, estado: e, limit: 1, offset: 0 });
        conteos[e] = res.total;
      }));

      return {
        data: rows.map((r) => this.toInboxItem(r)),
        conteos,
        pagination: { page, limit, totalRecords: total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  toInboxItem(r) {
    return {
      id: r.id,
      estado: r.estado,
      solicitudId: r.solicitud_id,
      dependenciaId: r.dependencia_id,
      dependencia: r.dependencia,
      solicitadaEl: r.solicitada_el,
      intentos: r.intentos,
      fechaRevision: r.fecha_revision,
      motivoBloqueo: r.motivo_bloqueo,
      trabajador: {
        nombre: r.nombre_completo,
        documento: `${r.tipo_documento} ${r.numero_documento}`,
        cargo: r.cargo_desempenado,
        vinculacion: r.tipo_vinculacion,
        correo: r.correo_institucional,
        verificado: r.verificado,
        novedad: r.tipo_novedad,
        fechaRetiro: r.fecha_retiro,
      },
    };
  }

  // Detalle de una solicitud para decidir: datos del trabajador, informe (solo lectura) y entregables
  async getDetail(currentUser, id) {
    return database.withClient(async (client) => {
      const r = await this.loadRevision(client, id);
      await this.assertReviewer(client, currentUser, r);

      const [informe, entregables, historial, firma] = await Promise.all([
        requestRepository.findInforme(client, r.solicitud_id),
        r.solo_docentes ? requestRepository.findEntregables(client, r.solicitud_id) : null,
        requestRepository.listBloqueosDeDependencia(client, r.solicitud_id, r.dependencia_id),
        userRepository.getFirma(client, currentUser.id),
      ]);

      return {
        ...this.toInboxItem(r),
        aspecto: r.aspecto,
        etapa: r.etapa,
        soloDocentes: r.solo_docentes,
        requiereEnlace: r.requiere_enlace,
        etiquetaEnlace: r.etiqueta_enlace,
        enlace: r.enlace,
        recibi: r.recibi,
        categoriaBloqueo: r.categoria_bloqueo,
        estadoSolicitud: r.estado_global,
        trabajadorDetalle: { lugarExpedicion: r.lugar_expedicion_documento, informeCompleto: r.informe_entrega_cargo },
        informe: informe ? { estado: informe.estado, secciones: informe.secciones } : null,
        entregables,
        historial,
        tieneFirma: Boolean(firma),
        puedeDecidir: r.estado === 'SOLICITADA' && r.estado_global === 'EN_PROCESO',
      };
    });
  }

  // El área aprueba: «Recibí:» + firma de su perfil
  async aprobar(currentUser, id, payload = {}) {
    const recibi = texto(payload.recibi);
    if (recibi.length < 3) {
      throw new HttpError(400, 'RN-014: escriba lo que recibió o revisó antes de aprobar');
    }
    if (recibi.length > 1000) throw new HttpError(400, 'El texto admite hasta 1000 caracteres');

    return database.withUserContext(currentUser, 'Aprobar paz y salvo de dependencia', async (client) => {
      const r = await this.loadRevision(client, id, { forUpdate: true });
      await this.assertReviewer(client, currentUser, r);
      if (r.estado !== 'SOLICITADA') {
        throw new HttpError(409, r.estado === 'APROBADA' ? 'Esta solicitud ya fue aprobada' : 'Esta solicitud está bloqueada hasta que el trabajador la envíe de nuevo');
      }

      if (r.solo_docentes) {
        const entregables = await requestRepository.findEntregables(client, r.solicitud_id);
        if (!entregables?.completo) {
          throw new HttpError(409, 'RN-007: marque los 3 entregables del docente como aprobados antes de aprobar, o bloquee la solicitud');
        }
      }
      const firma = await firmaService.requerir(client, currentUser.id);
      await requestRepository.decideRevision(client, {
        id, estado: 'APROBADA', revisorId: currentUser.id, recibi, firma,
      });

      await notificationService.notify(client, r.usuario_id, {
        tipo: 'REVISION_APROBADA',
        titulo: `${r.dependencia} aprobó tu paz y salvo`,
        mensaje: `Recibí: ${recibi}`,
        referencia: { solicitudId: r.solicitud_id, dependenciaId: r.dependencia_id },
      });
      return { ok: true, mensaje: `Paz y salvo de ${r.dependencia} aprobado`, estado: 'APROBADA' };
    });
  }

  // El área bloquea: categoría + motivo (RN-003, RN-009); el trabajador corrige y vuelve a solicitar
  async bloquear(currentUser, id, payload = {}) {
    const categoria = payload.categoria;
    const motivo = texto(payload.motivo);
    if (!CATEGORIAS.includes(categoria)) {
      throw new HttpError(400, `RN-003: la categoría debe ser una de: ${CATEGORIAS.join(', ')}`);
    }
    if (motivo.length < 5) {
      throw new HttpError(400, 'RN-009: escriba el motivo del bloqueo para que el trabajador sepa qué corregir');
    }
    if (motivo.length > 1000) throw new HttpError(400, 'El motivo admite hasta 1000 caracteres');

    return database.withUserContext(currentUser, 'Bloquear paz y salvo de dependencia', async (client) => {
      const r = await this.loadRevision(client, id, { forUpdate: true });
      await this.assertReviewer(client, currentUser, r);
      if (r.estado !== 'SOLICITADA') {
        throw new HttpError(409, 'Solo se bloquean las solicitudes que están en revisión');
      }

      await lockRepository.create(client, {
        solicitudId: r.solicitud_id,
        dependenciaId: r.dependencia_id,
        registradoPorId: currentUser.id,
        categoria,
        motivo,
      });
      await requestRepository.decideRevision(client, { id, estado: 'BLOQUEADA', revisorId: currentUser.id });

      await notificationService.notify(client, r.usuario_id, {
        tipo: 'REVISION_BLOQUEADA',
        titulo: `${r.dependencia} bloqueó tu paz y salvo`,
        mensaje: `Motivo: ${motivo}. Corrige lo indicado y solicita de nuevo la aprobación.`,
        referencia: { solicitudId: r.solicitud_id, dependenciaId: r.dependencia_id },
      });
      return { ok: true, mensaje: `Solicitud bloqueada. Se avisó al trabajador.`, estado: 'BLOQUEADA' };
    });
  }
}

module.exports = new ReviewService();
