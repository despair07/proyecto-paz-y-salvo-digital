// ============================================================================
// SERVICIO DE TRÁMITES Y ESTADO DE PAZ Y SALVO
// RN-001, RN-002, RN-005, RN-007, RN-008, RN-010 · RF-004, RF-005, RF-009, RF-010
// ============================================================================

const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const userRepository = require('../repositories/user.repository');
const certificateService = require('./certificate.service');
const { ROLES, SOLICITANTES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const CLOSED_STATES = ['APROBADO_FINAL', 'RECHAZADO'];
const NOVEDADES = ['RETIRO', 'CAMBIO_DEPENDENCIA'];
const INFORME_SECCIONES = [
  'I_datos_generales', 'II_informe_gestion', 'III_procedimientos', 'IV_formatos',
  'V_informes_presentados', 'VI_estado_recursos', 'VII_anexos', 'VIII_contacto_verificacion',
];
const DEFAULT_CONTACT = {
  nombre: 'Encargado Institucional',
  correo: 'contacto@uniautonoma.edu.co',
  cargo: 'Atención de dependencia',
};

class RequestService {
  // Quién puede ver el trámite de un trabajador.
  assertCanRead(solicitud, currentUser) {
    if (solicitud.usuario_id === currentUser.id) return;
    if (hasRole(currentUser.roles, [ROLES.JEFE_INMEDIATO, ROLES.ENCARGADO_AREA, ROLES.APROBADOR, ROLES.ADMIN_DTI])) return;
    throw new HttpError(403, 'No tiene permisos para consultar este trámite');
  }

  // RF-004: estado global y de cada dependencia evaluadora
  async getMyStatus(currentUser) {
    return database.withClient(async (client) => {
      const solicitud = await requestRepository.findLatestByUser(client, currentUser.id);

      if (!solicitud) {
        return {
          habilitado: false,
          mensaje: 'No tiene un trámite de paz y salvo activo en el periodo actual. Presione Habilitar paz y salvo para iniciar.',
          estadoGlobal: 'NO_INICIADO',
          dependencias: [],
        };
      }

      const isDocente = solicitud.tipo_vinculacion === 'Docente';
      const [areas, entregables, certificado] = await Promise.all([
        requestRepository.listAreaStates(client, solicitud.id),
        isDocente ? requestRepository.findEntregables(client, solicitud.id) : null,
        solicitud.aprobado_final ? requestRepository.findCertificateBySolicitud(client, solicitud.id) : null,
      ]);

      let areasLiberadas = 0;
      let totalAreasRequeridas = 0;

      const dependencias = areas.map((area) => {
        if (area.estado === 'NO_APLICA') {
          return {
            id: area.id,
            nombre: area.nombre,
            descripcion: area.descripcion,
            aplica: false,
            estado: 'NO_APLICA',
            bloqueosActivos: 0,
            motivo: null,
            bloqueos: [],
          };
        }

        totalAreasRequeridas += 1;
        let estado = area.estado;
        let motivo = area.motivo_bloqueo;
        let entregablesProfesorales = null;

        // RN-007: el Centro de Desarrollo Profesoral depende de los 3 entregables del docente
        if (area.solo_docentes && isDocente) {
          entregablesProfesorales = entregables
            ? {
                planes_aula: entregables.planes_aula,
                innovaciones_educativas: entregables.innovaciones_educativas,
                informes_ejecucion: entregables.informes_ejecucion,
                observaciones: entregables.observaciones,
              }
            : { planes_aula: false, innovaciones_educativas: false, informes_ejecucion: false, observaciones: null };

          if (!entregables?.completo) {
            estado = 'BLOQUEADO';
            motivo = motivo || (entregables
              ? 'Pendiente aprobación de los 3 entregables docentes (RN-007)'
              : 'Pendiente de evaluación de entregables profesorales');
          }
        }

        if (estado === 'AL_DIA') areasLiberadas += 1;

        return {
          id: area.id,
          nombre: area.nombre,
          descripcion: area.descripcion,
          aplica: true,
          estado,
          motivo,
          fechaRegistro: area.fecha_bloqueo || area.resueltos[0]?.fecha_resolucion || null,
          bloqueosActivos: area.bloqueos_activos,
          bloqueosResueltos: area.resueltos.map((r) => ({
            ...r,
            motivo_descripcion: r.motivo,
            observacion_resolucion: r.observacion,
          })),
          contacto: area.contacto || DEFAULT_CONTACT,
          entregablesProfesorales,
        };
      });

      const porcentaje = totalAreasRequeridas > 0
        ? Math.round((areasLiberadas / totalAreasRequeridas) * 100)
        : 100;

      return {
        habilitado: true,
        solicitudId: solicitud.id,
        usuarioId: solicitud.usuario_id,
        nombreTrabajador: `${solicitud.nombres} ${solicitud.apellidos}`,
        documento: solicitud.numero_documento,
        correo: solicitud.correo_institucional,
        tipoVinculacion: solicitud.tipo_vinculacion,
        cargoDesempenado: solicitud.cargo_desempenado,
        tipoNovedad: solicitud.tipo_novedad,
        fechaRetiro: solicitud.fecha_retiro,
        fechaSolicitud: solicitud.fecha_solicitud,
        periodo: solicitud.nombre_periodo,
        estadoGlobal: solicitud.estado_global,
        etapaActual: solicitud.etapa_actual,
        aprobacionFinal: solicitud.aprobado_final
          ? 'APROBADO'
          : solicitud.estado_global === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE',
        observacionesAprobacion: solicitud.observaciones_aprobacion,
        informeEntregaCargo: Boolean(solicitud.informe_entrega_cargo),
        areasLiberadas,
        totalAreasRequeridas,
        resumenProgreso: `${areasLiberadas}/${totalAreasRequeridas} áreas liberadas`,
        porcentajeCompletado: porcentaje,
        puedeDescargarCertificado: solicitud.aprobado_final && solicitud.estado_global === 'APROBADO_FINAL',
        certificado,
        dependencias,
      };
    });
  }

  // RF-009: habilitación del trámite por el propio trabajador
  async habilitarTramite(currentUser, payload = {}) {
    if (!hasRole(currentUser.roles, SOLICITANTES)) {
      throw new HttpError(403, 'Solo el personal docente, administrativo o contratista habilita su paz y salvo');
    }

    const tipoNovedad = payload.tipo_novedad || 'RETIRO';
    if (!NOVEDADES.includes(tipoNovedad)) {
      throw new HttpError(400, `El tipo de novedad debe ser: ${NOVEDADES.join(' o ')}`);
    }
    if (payload.fecha_retiro && !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha_retiro)) {
      throw new HttpError(400, 'La fecha de retiro debe tener el formato AAAA-MM-DD');
    }

    return database.withUserContext(currentUser, 'Habilitar paz y salvo', async (client) => {
      const periodo = await requestRepository.findActivePeriod(client);
      if (!periodo) throw new HttpError(409, 'No hay un periodo académico activo');

      const existing = await requestRepository.findLatestByUser(client, currentUser.id);
      if (existing && existing.periodo_academico_id === periodo.id) {
        return { ok: true, mensaje: 'El trámite ya se encuentra activo', solicitud: existing };
      }

      const user = await userRepository.findById(currentUser.id);
      const cargo = String(payload.cargo_desempenado || user?.cargo || '').trim();
      if (!cargo) {
        throw new HttpError(400, 'Indique el cargo desempeñado para habilitar el trámite');
      }

      const solicitud = await requestRepository.create(client, {
        usuarioId: currentUser.id,
        periodoId: periodo.id,
        jefeInmediatoId: await requestRepository.findDefaultJefeInmediatoId(client),
        tipoNovedad,
        cargo,
        lugarExpedicion: String(payload.lugar_expedicion_documento || 'Popayán, Cauca').trim(),
        fechaRetiro: payload.fecha_retiro || new Date().toISOString().slice(0, 10),
      });

      return {
        ok: true,
        mensaje: 'Trámite habilitado exitosamente en Etapa 1 (Jefe Inmediato)',
        solicitud,
      };
    });
  }

  // RF-010: consulta del informe de entrega de cargo
  async getInforme(currentUser, solicitudId) {
    return database.withClient(async (client) => {
      const solicitud = await requestRepository.findById(client, solicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
      this.assertCanRead(solicitud, currentUser);

      const informe = await requestRepository.findInforme(client, solicitudId);
      return {
        solicitudId,
        estado: informe?.estado || 'BORRADOR',
        secciones: informe?.secciones
          || Object.fromEntries(INFORME_SECCIONES.map((key) => [key, {}])),
        validadoPor: informe?.validado_por_id || null,
        fechaValidacion: informe?.fecha_validacion || null,
      };
    });
  }

  // RF-010: guardar borrador o finalizar el informe
  async saveInforme(currentUser, solicitudId, payload) {
    const { estado = 'BORRADOR', secciones } = payload || {};
    if (!['BORRADOR', 'COMPLETO'].includes(estado)) {
      throw new HttpError(400, "El estado debe ser 'BORRADOR' o 'COMPLETO'");
    }
    if (secciones !== undefined && (typeof secciones !== 'object' || secciones === null || Array.isArray(secciones))) {
      throw new HttpError(400, 'Las secciones del informe deben enviarse como un objeto');
    }

    return database.withUserContext(currentUser, 'Guardar informe de entrega de cargo', async (client) => {
      const solicitud = await requestRepository.findById(client, solicitudId, { forUpdate: true });
      if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
      if (solicitud.usuario_id !== currentUser.id) {
        throw new HttpError(403, 'Solo el trabajador puede diligenciar su informe de entrega de cargo');
      }
      if (CLOSED_STATES.includes(solicitud.estado_global)) {
        throw new HttpError(409, 'El trámite ya está cerrado y el informe no se puede modificar');
      }

      const informe = await requestRepository.upsertInforme(client, {
        solicitudId,
        estado,
        secciones: secciones || {},
      });

      return {
        ok: true,
        mensaje: estado === 'COMPLETO'
          ? 'Informe de entrega de cargo completado con éxito'
          : 'Borrador guardado',
        informe: {
          estado: informe.estado,
          secciones: informe.secciones,
          actualizado_en: informe.updated_at,
        },
      };
    });
  }

  // RF-005: trámites listos para la aprobación final
  async listPendingApproval(currentUser) {
    if (!hasRole(currentUser.roles, [ROLES.APROBADOR, ROLES.ADMIN_DTI])) {
      throw new HttpError(403, 'Acceso restringido a la División de Comunidad Universitaria');
    }

    return database.withClient(async (client) => {
      const solicitudes = await requestRepository.listPendingApproval(client);
      const verdicts = await requestRepository.listVerdicts(client, solicitudes.map((s) => s.id));

      return solicitudes.map((s) => ({
        id: s.id,
        solicitudId: s.id,
        usuarioId: s.usuario_id,
        nombre: `${s.nombres} ${s.apellidos}`,
        documento: s.numero_documento,
        correo: s.correo_institucional,
        vinculacion: s.tipo_vinculacion,
        cargo: s.cargo_desempenado,
        novedad: s.tipo_novedad,
        fechaSolicitud: s.fecha_solicitud,
        informeEntregaCargo: true,
        estadoGlobal: s.estado_global,
        areasVerificadas: verdicts
          .filter((v) => v.solicitud_id === s.id)
          .map((v) => ({
            dependencia: v.dependencia,
            estado: 'PAZ_Y_SALVO',
            motivo: v.observacion || v.motivo || 'Sin novedades registradas',
            responsable: v.responsable || 'Sistema Institucional',
            fecha: v.fecha_resolucion || s.fecha_solicitud,
          })),
      }));
    });
  }

  // RF-005: aprobación final o rechazo motivado (RN-002: solo Comunidad Universitaria)
  async approveOrReject(currentUser, solicitudId, payload) {
    if (!hasRole(currentUser.roles, [ROLES.APROBADOR])) {
      throw new HttpError(403, 'RN-002: solo la División de Comunidad Universitaria puede otorgar la aprobación final');
    }

    const { decision, observacion, aprobado } = payload || {};
    const isApproved = decision === 'APROBADO' || aprobado === true;
    const note = String(observacion || '').trim();

    if (!isApproved && !note) {
      throw new HttpError(400, 'Para rechazar una solicitud se debe ingresar una observación obligatoria');
    }

    return database.withUserContext(
      currentUser,
      isApproved ? 'Aprobación final del paz y salvo' : 'Rechazo del paz y salvo',
      async (client) => {
        const solicitud = await requestRepository.findById(client, solicitudId, { forUpdate: true });
        if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
        if (CLOSED_STATES.includes(solicitud.estado_global)) {
          throw new HttpError(409, `El trámite ya está cerrado (${solicitud.estado_global})`);
        }

        if (!isApproved) {
          const rechazada = await requestRepository.reject(client, {
            id: solicitudId,
            approverId: currentUser.id,
            observacion: note,
          });
          return {
            ok: true,
            mensaje: 'Solicitud rechazada con observación motivada',
            estado: 'RECHAZADO',
            solicitud: rechazada,
          };
        }

        // Mensajes claros antes de que la base de datos rechace la operación (RN-005, RN-010, RN-007)
        const { rows: [active] } = await client.query(
          `SELECT COUNT(*)::int AS n FROM bloqueos_dependencia
            WHERE solicitud_id = $1 AND estado = 'BLOQUEADO'`,
          [solicitudId]
        );
        if (active.n > 0) {
          throw new HttpError(409, 'RN-005: no se puede otorgar la aprobación final mientras existan bloqueos activos');
        }
        if (!solicitud.informe_entrega_cargo) {
          throw new HttpError(409, 'RN-010: el informe de entrega de cargo debe estar completo para la aprobación final');
        }
        if (solicitud.tipo_vinculacion === 'Docente') {
          const entregables = await requestRepository.findEntregables(client, solicitudId);
          if (!entregables?.completo) {
            throw new HttpError(409, 'RN-007: el docente debe tener los 3 entregables aprobados por Desarrollo Profesoral');
          }
        }

        const aprobada = await requestRepository.approve(client, {
          id: solicitudId,
          approverId: currentUser.id,
          observacion: note || 'Aprobado a entera satisfacción por Comunidad Universitaria',
        });

        // RN-006 / RF-006: el certificado se emite en la misma transacción
        const certificado = await certificateService.generateCertificateForRequest(client, aprobada, currentUser);

        return {
          ok: true,
          mensaje: 'Paz y salvo definitivo autorizado y certificado digital generado con éxito',
          estado: 'APROBADO_FINAL',
          solicitud: aprobada,
          certificado,
        };
      }
    );
  }
}

module.exports = new RequestService();
