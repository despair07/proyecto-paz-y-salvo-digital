// ============================================================================
// SERVICIO DE TRÁMITES (lado del trabajador y aprobación final)
//
// Flujo: datos generales → solicitar la aprobación de cada dependencia (jefe inmediato y áreas en
// paralelo) → informe por entrega de cargo → cláusula y firma → solicitar la aprobación final.
// Las reglas también las hace cumplir la base de datos (triggers y CHECK); aquí se anticipan
// con mensajes claros.
// ============================================================================

const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const userRepository = require('../repositories/user.repository');
const certificateService = require('./certificate.service');
const notificationService = require('./notification.service');
const firmaService = require('./firma.service');
const { validarInformeCompleto, resumenPorSeccion } = require('../utils/informe');
const { ROLES, SOLICITANTES, hasRole } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const NOVEDADES = ['RETIRO', 'CAMBIO_DEPENDENCIA'];
const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA', 'TI'];
const FINAL_STATES = ['PENDIENTE_APROBACION', 'APROBADO_FINAL', 'RECHAZADO'];
const MAX_INFORME_BYTES = 500 * 1024;
const DEFAULT_CONTACT = {
  nombre: 'Encargado Institucional',
  correo: 'contacto@uniautonoma.edu.co',
  cargo: 'Atención de dependencia',
};

const texto = (value) => (typeof value === 'string' ? value.trim() : '');

// Datos generales que faltan (la base de datos exige estos mismos para pedir cualquier revisión)
function datosFaltantes(s) {
  const faltan = [];
  if (!texto(s.nombre_completo)) faltan.push('Nombre');
  if (!texto(s.numero_documento)) faltan.push('Cédula de ciudadanía');
  if (!texto(s.lugar_expedicion_documento)) faltan.push('Lugar de expedición');
  if (!texto(s.cargo_desempenado)) faltan.push('Cargo actual');
  if (s.tipo_novedad === 'RETIRO' && !s.fecha_retiro) faltan.push('Fecha de retiro');
  return faltan;
}

function validarEnlace(valor) {
  const enlace = texto(valor);
  if (!enlace) return null;
  let url;
  try {
    url = new URL(enlace);
  } catch {
    throw new HttpError(400, 'El enlace no es una dirección válida');
  }
  if (url.protocol !== 'https:' || enlace.length > 500 || /\s/.test(enlace)) {
    throw new HttpError(400, 'El enlace debe empezar por https:// y no tener espacios (máximo 500 caracteres)');
  }
  return enlace;
}

class RequestService {
  // Quién puede ver un trámite: el trabajador, quienes tienen una revisión suya y, en la etapa final,
  // Comunidad Universitaria. El Administrador DTI no accede al contenido de los trámites (RN-011).
  async assertCanRead(client, solicitud, currentUser) {
    if (solicitud.usuario_id === currentUser.id) return;
    if (hasRole(currentUser.roles, [ROLES.APROBADOR]) && FINAL_STATES.includes(solicitud.estado_global)) return;
    if (hasRole(currentUser.roles, [ROLES.JEFE_INMEDIATO, ROLES.ENCARGADO_AREA])) {
      const dependencias = await userRepository.listAssignedDependencyIds(client, currentUser.id);
      const { rows } = await client.query(
        `SELECT 1 FROM revisiones_area r
           JOIN dependencias d ON d.id = r.dependencia_id
           JOIN solicitudes_paz_y_salvo s ON s.id = r.solicitud_id
          WHERE r.solicitud_id = $1 AND r.dependencia_id = ANY($2::uuid[])
            AND (d.etapa <> 1 OR s.jefe_inmediato_id = $3)
          LIMIT 1`,
        [solicitud.id, dependencias, currentUser.id]
      );
      if (rows.length) return;
    }
    throw new HttpError(403, 'No tiene permisos para consultar este trámite');
  }

  async loadOwned(client, currentUser, solicitudId, { forUpdate = true } = {}) {
    const solicitud = await requestRepository.findById(client, solicitudId, { forUpdate });
    if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
    if (solicitud.usuario_id !== currentUser.id) {
      throw new HttpError(403, 'Solo el trabajador puede modificar su propio trámite');
    }
    return solicitud;
  }

  // RF-004: el trámite completo del trabajador (datos, dependencias, informe, firma y estado)
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
      const [areas, entregables, informe, certificado, anterior, firmaPerfil] = await Promise.all([
        requestRepository.listAreaStates(client, solicitud.id),
        isDocente ? requestRepository.findEntregables(client, solicitud.id) : null,
        requestRepository.findInforme(client, solicitud.id),
        solicitud.aprobado_final ? requestRepository.findCertificateBySolicitud(client, solicitud.id) : null,
        solicitud.solicitud_anterior_id ? requestRepository.findById(client, solicitud.solicitud_anterior_id) : null,
        userRepository.getFirma(client, currentUser.id),
      ]);

      const faltantes = datosFaltantes(solicitud);
      const datosCompletos = faltantes.length === 0;
      const informeCompleto = Boolean(solicitud.informe_entrega_cargo);
      const editableSolicitud = ['BORRADOR', 'EN_PROCESO', 'AL_DIA'].includes(solicitud.estado_global);

      let areasLiberadas = 0;
      let totalAreasRequeridas = 0;

      const dependencias = areas.map((area) => {
        if (area.estado === 'NO_APLICA') {
          return {
            id: area.id, nombre: area.nombre, seccion: area.seccion, aspecto: area.aspecto,
            etapa: area.etapa, orden: area.orden, soloDocentes: area.solo_docentes,
            aplica: false, estado: 'NO_APLICA', bloqueosActivos: 0, motivo: null, bloqueos: [],
          };
        }

        totalAreasRequeridas += 1;
        if (area.estado === 'APROBADA') areasLiberadas += 1;

        let motivoNoPuede = null;
        if (!['SIN_SOLICITAR', 'BLOQUEADA'].includes(area.estado)) {
          motivoNoPuede = area.estado === 'SOLICITADA' ? 'Ya está en revisión' : 'Ya fue aprobada';
        } else if (!['BORRADOR', 'EN_PROCESO'].includes(solicitud.estado_global)) {
          motivoNoPuede = 'El trámite ya no admite nuevas solicitudes';
        } else if (!datosCompletos) {
          motivoNoPuede = 'Complete los datos generales primero';
        } else if (area.etapa === 1 && !solicitud.jefe_inmediato_id) {
          motivoNoPuede = 'Seleccione su jefe inmediato';
        }

        const entregablesProfesorales = area.solo_docentes
          ? {
              planes_aula: Boolean(entregables?.planes_aula),
              innovaciones_educativas: Boolean(entregables?.innovaciones_educativas),
              informes_ejecucion: Boolean(entregables?.informes_ejecucion),
              observaciones: entregables?.observaciones || null,
            }
          : null;

        return {
          id: area.id,
          nombre: area.nombre,
          seccion: area.seccion,
          aspecto: area.aspecto,
          etapa: area.etapa,
          orden: area.orden,
          soloDocentes: area.solo_docentes,
          aplica: true,
          estado: area.estado, // SIN_SOLICITAR · SOLICITADA · APROBADA · BLOQUEADA
          motivo: area.motivo_bloqueo,
          categoria: area.categoria_bloqueo,
          fechaRegistro: area.fecha_bloqueo || area.fecha_revision || null,
          fechaSolicitud: area.solicitada_el,
          intentos: area.intentos,
          requiereEnlace: area.requiere_enlace,
          etiquetaEnlace: area.etiqueta_enlace,
          enlace: area.enlace,
          recibi: area.recibi,
          revisor: area.revisor,
          fechaRevision: area.fecha_revision,
          bloqueosActivos: area.bloqueos_activos,
          bloqueosResueltos: area.resueltos.map((r) => ({
            ...r,
            motivo_descripcion: r.motivo,
            observacion_resolucion: r.observacion,
          })),
          contacto: area.contacto || DEFAULT_CONTACT,
          entregablesProfesorales,
          puedeSolicitar: motivoNoPuede === null,
          motivoNoPuede,
        };
      });

      const porcentaje = totalAreasRequeridas > 0
        ? Math.round((areasLiberadas / totalAreasRequeridas) * 100)
        : 100;

      // Qué falta para poder pedir la aprobación final
      const faltantesFinal = [];
      if (solicitud.estado_global !== 'AL_DIA') {
        if (areasLiberadas < totalAreasRequeridas) {
          faltantesFinal.push(`Faltan dependencias por aprobar (${totalAreasRequeridas - areasLiberadas})`);
        }
      }
      if (!informeCompleto) faltantesFinal.push('Completar el informe por entrega de cargo');
      // El cierre y la firma se hacen al final, cuando las dependencias ya aprobaron y el informe está completo
      const cierreHabilitado = solicitud.estado_global === 'AL_DIA' && informeCompleto;
      if (!solicitud.clausula_aceptada) faltantesFinal.push('Aceptar la cláusula y firmar');

      return {
        habilitado: true,
        solicitudId: solicitud.id,
        usuarioId: solicitud.usuario_id,
        nombreTrabajador: solicitud.nombre_completo || `${solicitud.nombres} ${solicitud.apellidos}`,
        documento: solicitud.numero_documento,
        correo: solicitud.correo_institucional,
        tipoVinculacion: solicitud.tipo_vinculacion,
        cargoDesempenado: solicitud.cargo_desempenado,
        tipoNovedad: solicitud.tipo_novedad,
        fechaRetiro: solicitud.fecha_retiro,
        fechaSolicitud: solicitud.fecha_solicitud,
        periodo: solicitud.nombre_periodo,
        estadoGlobal: solicitud.estado_global,
        aprobacionFinal: solicitud.aprobado_final
          ? 'APROBADO'
          : solicitud.estado_global === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE',
        observacionesAprobacion: solicitud.observaciones_aprobacion,
        fechaSolicitudFinal: solicitud.fecha_solicitud_final,
        datosGenerales: {
          nombre_completo: solicitud.nombre_completo,
          tipo_documento: solicitud.tipo_documento,
          numero_documento: solicitud.numero_documento,
          lugar_expedicion_documento: solicitud.lugar_expedicion_documento,
          cargo_desempenado: solicitud.cargo_desempenado,
          tipo_novedad: solicitud.tipo_novedad,
          fecha_retiro: solicitud.fecha_retiro,
          jefe_inmediato_id: solicitud.jefe_inmediato_id,
          jefe_nombre: solicitud.jefe_nombre,
        },
        datosCompletos,
        datosFaltantes: faltantes,
        editable: solicitud.estado_global === 'BORRADOR',
        informeEntregaCargo: informeCompleto,
        informe: {
          estado: informe?.estado || 'BORRADOR',
          editable: editableSolicitud,
          secciones: resumenPorSeccion(informe?.secciones || {}),
        },
        cierre: {
          observaciones: solicitud.observaciones_trabajador || '',
          clausulaAceptada: solicitud.clausula_aceptada,
          fechaClausula: solicitud.fecha_clausula,
          firmado: solicitud.tiene_firma_trabajador,
          tieneFirmaEnPerfil: Boolean(firmaPerfil),
          habilitado: cierreHabilitado,
          editable: editableSolicitud,
        },
        areasLiberadas,
        totalAreasRequeridas,
        resumenProgreso: `${areasLiberadas}/${totalAreasRequeridas} áreas liberadas`,
        porcentajeCompletado: porcentaje,
        puedeSolicitarAprobacionFinal: solicitud.estado_global === 'AL_DIA'
          && informeCompleto && solicitud.clausula_aceptada,
        faltantesAprobacionFinal: faltantesFinal,
        puedeReiniciar: solicitud.estado_global === 'RECHAZADO',
        puedeDescargarCertificado: solicitud.aprobado_final && solicitud.estado_global === 'APROBADO_FINAL',
        certificado,
        solicitudAnterior: anterior
          ? {
              estado: anterior.estado_global,
              observaciones: anterior.observaciones_aprobacion,
              fecha: anterior.fecha_aprobacion_final,
              aprobador: anterior.aprobador_nombre,
            }
          : null,
        dependencias,
      };
    });
  }

  // RF-009: el trabajador abre su trámite (borrador) con los datos de su perfil
  async habilitarTramite(currentUser, payload = {}) {
    if (!hasRole(currentUser.roles, SOLICITANTES)) {
      throw new HttpError(403, 'Solo el personal docente, administrativo o contratista habilita su paz y salvo');
    }
    const tipoNovedad = payload.tipo_novedad || 'RETIRO';
    if (!NOVEDADES.includes(tipoNovedad)) {
      throw new HttpError(400, `El tipo de novedad debe ser: ${NOVEDADES.join(' o ')}`);
    }

    return database.withUserContext(currentUser, 'Habilitar paz y salvo', async (client) => {
      const periodo = await requestRepository.findActivePeriod(client);
      if (!periodo) throw new HttpError(409, 'No hay un periodo académico activo');

      const existing = await requestRepository.findLatestByUser(client, currentUser.id);
      if (existing && existing.periodo_academico_id === periodo.id && existing.estado_global !== 'RECHAZADO') {
        return { ok: true, mensaje: 'El trámite ya se encuentra activo', solicitud: existing };
      }

      const user = await userRepository.findById(currentUser.id);
      const solicitud = await requestRepository.createBorrador(client, {
        usuarioId: currentUser.id,
        periodoId: periodo.id,
        nombreCompleto: `${user.nombres} ${user.apellidos}`.trim(),
        tipoDocumento: user.tipo_documento,
        numeroDocumento: user.numero_documento,
        cargo: user.cargo,
        tipoNovedad,
      });
      return { ok: true, mensaje: 'Trámite creado. Complete los datos generales para continuar.', solicitud };
    });
  }

  // Sección 1 · Datos generales (obligatorios y editables mientras nada se haya solicitado)
  async updateDatosGenerales(currentUser, solicitudId, payload = {}) {
    const campos = {};
    const limites = {
      nombre_completo: 300, numero_documento: 40, lugar_expedicion_documento: 180, cargo_desempenado: 180,
    };
    for (const [campo, max] of Object.entries(limites)) {
      if (payload[campo] === undefined) continue;
      const valor = texto(payload[campo]);
      if (valor.length > max) throw new HttpError(400, `«${campo}» admite hasta ${max} caracteres`);
      campos[campo] = valor || null;
    }
    if (payload.tipo_documento !== undefined) {
      if (!TIPOS_DOCUMENTO.includes(payload.tipo_documento)) {
        throw new HttpError(400, `El tipo de documento debe ser: ${TIPOS_DOCUMENTO.join(', ')}`);
      }
      campos.tipo_documento = payload.tipo_documento;
    }
    if (payload.tipo_novedad !== undefined) {
      if (!NOVEDADES.includes(payload.tipo_novedad)) {
        throw new HttpError(400, `El tipo de novedad debe ser: ${NOVEDADES.join(' o ')}`);
      }
      campos.tipo_novedad = payload.tipo_novedad;
    }
    if (payload.fecha_retiro !== undefined) {
      const fecha = texto(payload.fecha_retiro);
      if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)))) {
        throw new HttpError(400, 'La fecha de retiro debe tener el formato AAAA-MM-DD');
      }
      campos.fecha_retiro = fecha || null;
    }

    return database.withUserContext(currentUser, 'Actualizar datos generales', async (client) => {
      const solicitud = await this.loadOwned(client, currentUser, solicitudId);
      if (solicitud.estado_global !== 'BORRADOR') {
        throw new HttpError(409, 'Los datos generales ya no se pueden modificar: se solicitó la aprobación de alguna dependencia');
      }

      if (payload.jefe_inmediato_id !== undefined) {
        const jefeId = payload.jefe_inmediato_id || null;
        if (jefeId) {
          if (jefeId === currentUser.id) throw new HttpError(400, 'No puede ser su propio jefe inmediato');
          if (!(await userRepository.isJefeValido(client, jefeId))) {
            throw new HttpError(400, 'El jefe inmediato seleccionado no está registrado');
          }
        }
        campos.jefe_inmediato_id = jefeId;
      }

      const actualizada = await requestRepository.updateDatos(client, solicitudId, campos);
      const faltantes = datosFaltantes(actualizada);
      return {
        ok: true,
        datosGenerales: {
          nombre_completo: actualizada.nombre_completo,
          tipo_documento: actualizada.tipo_documento,
          numero_documento: actualizada.numero_documento,
          lugar_expedicion_documento: actualizada.lugar_expedicion_documento,
          cargo_desempenado: actualizada.cargo_desempenado,
          tipo_novedad: actualizada.tipo_novedad,
          fecha_retiro: actualizada.fecha_retiro,
          jefe_inmediato_id: actualizada.jefe_inmediato_id,
          jefe_nombre: actualizada.jefe_nombre,
        },
        datosCompletos: faltantes.length === 0,
        datosFaltantes: faltantes,
      };
    });
  }

  // Jefes inmediatos entre los que el trabajador elige (los registra TI)
  async listJefes(currentUser) {
    return database.withClient((client) => userRepository.listJefes(client, { excluirId: currentUser.id }));
  }

  // El trabajador solicita (o vuelve a solicitar tras un bloqueo) la aprobación de una dependencia
  async solicitarAprobacion(currentUser, solicitudId, dependenciaId, payload = {}) {
    const enlace = validarEnlace(payload.enlace);

    return database.withUserContext(currentUser, 'Solicitar aprobación de dependencia', async (client) => {
      const solicitud = await this.loadOwned(client, currentUser, solicitudId);
      const dependencia = await requestRepository.findDependencia(client, dependenciaId);
      if (!dependencia || dependencia.es_aprobadora_final) {
        throw new HttpError(404, 'Dependencia no encontrada');
      }
      if (dependencia.requiere_enlace && !enlace) {
        const revisionPrevia = await requestRepository.findRevision(client, solicitudId, dependenciaId);
        if (!revisionPrevia?.enlace) {
          throw new HttpError(400, `RN-015: ${dependencia.nombre} requiere un enlace (${dependencia.etiqueta_enlace || 'adjunto'})`);
        }
      }

      const existente = await requestRepository.findRevision(client, solicitudId, dependenciaId, { forUpdate: true });
      if (existente) {
        if (existente.estado === 'SOLICITADA') throw new HttpError(409, 'Esta dependencia ya tiene tu solicitud en revisión');
        if (existente.estado === 'APROBADA') throw new HttpError(409, 'Esta dependencia ya aprobó tu paz y salvo');
        await requestRepository.resubmitRevision(client, existente.id, enlace);
      } else {
        await requestRepository.insertRevision(client, { solicitudId, dependenciaId, enlace });
      }

      const destinatarios = dependencia.etapa === 1
        ? [solicitud.jefe_inmediato_id]
        : await requestRepository.listEncargadoIds(client, dependenciaId);
      await notificationService.notify(client, destinatarios, {
        tipo: 'SOLICITUD_REVISION',
        titulo: existente ? 'Nueva solicitud tras un bloqueo' : 'Nueva solicitud de paz y salvo',
        mensaje: `${solicitud.nombre_completo || solicitud.nombres} solicitó el paz y salvo de ${dependencia.nombre}.`,
        referencia: { solicitudId, dependenciaId },
      });

      return { ok: true, mensaje: `Solicitud enviada a ${dependencia.nombre}. Quedará «en proceso» hasta que la revisen.` };
    });
  }

  // Cierre del trabajador: observaciones, cláusula de confidencialidad y firma (RN-016)
  async updateCierre(currentUser, solicitudId, payload = {}) {
    return database.withUserContext(currentUser, 'Actualizar cierre del trabajador', async (client) => {
      const solicitud = await this.loadOwned(client, currentUser, solicitudId);
      if (!['BORRADOR', 'EN_PROCESO', 'AL_DIA'].includes(solicitud.estado_global)) {
        throw new HttpError(409, 'El trámite ya está en aprobación final o cerrado y no se puede modificar');
      }
      if (solicitud.estado_global !== 'AL_DIA' || !solicitud.informe_entrega_cargo) {
        throw new HttpError(409, 'El cierre y la firma se habilitan cuando todas las dependencias aprobaron y el informe está completo');
      }

      if (payload.observaciones !== undefined) {
        const observaciones = texto(payload.observaciones);
        if (observaciones.length > 2000) throw new HttpError(400, 'Las observaciones admiten hasta 2000 caracteres');
        await requestRepository.updateObservaciones(client, solicitudId, observaciones || null);
      }
      if (payload.aceptar_clausula !== undefined) {
        if (typeof payload.aceptar_clausula !== 'boolean') {
          throw new HttpError(400, 'aceptar_clausula debe ser verdadero o falso');
        }
        const firma = payload.aceptar_clausula ? await firmaService.requerir(client, currentUser.id) : null;
        await requestRepository.setClausula(client, solicitudId, { aceptada: payload.aceptar_clausula, firma });
      }
      return { ok: true };
    });
  }

  // El trabajador pide la aprobación final cuando todas las dependencias ya aprobaron
  async solicitarAprobacionFinal(currentUser, solicitudId) {
    return database.withUserContext(currentUser, 'Solicitar aprobación final', async (client) => {
      const solicitud = await this.loadOwned(client, currentUser, solicitudId);
      if (solicitud.estado_global === 'PENDIENTE_APROBACION') {
        throw new HttpError(409, 'Tu solicitud ya está en revisión de Comunidad Universitaria');
      }
      if (solicitud.estado_global !== 'AL_DIA') {
        throw new HttpError(409, 'RN-001: todas las dependencias deben aprobar antes de pedir la aprobación final');
      }
      if (!solicitud.informe_entrega_cargo) {
        throw new HttpError(409, 'RN-010: complete el informe por entrega de cargo');
      }
      if (!solicitud.clausula_aceptada || !solicitud.tiene_firma_trabajador) {
        throw new HttpError(409, 'RN-016: acepte la cláusula y firme antes de pedir la aprobación final');
      }

      const actualizada = await requestRepository.requestFinal(client, solicitudId);
      const aprobadores = await userRepository.listIdsByRole(client, ROLES.APROBADOR);
      await notificationService.notify(client, aprobadores, {
        tipo: 'SOLICITUD_APROBACION_FINAL',
        titulo: 'Nueva solicitud de aprobación final',
        mensaje: `${solicitud.nombre_completo} completó su paz y salvo y espera la aprobación final.`,
        referencia: { solicitudId },
      });
      return { ok: true, mensaje: 'Solicitud enviada a Comunidad Universitaria', estado: actualizada.estado_global };
    });
  }

  // Tras un rechazo: nuevo trámite con los datos y el informe del anterior (reinicio completo)
  async reiniciar(currentUser, solicitudId) {
    return database.withUserContext(currentUser, 'Reiniciar trámite tras rechazo', async (client) => {
      const anterior = await this.loadOwned(client, currentUser, solicitudId);
      if (anterior.estado_global !== 'RECHAZADO') {
        throw new HttpError(409, 'Solo se reinicia un trámite que fue rechazado');
      }
      const ultima = await requestRepository.findLatestByUser(client, currentUser.id);
      if (ultima.id !== anterior.id) {
        throw new HttpError(409, 'Ya iniciaste un trámite nuevo después de este rechazo');
      }

      const nueva = await requestRepository.createBorrador(client, {
        usuarioId: currentUser.id,
        periodoId: anterior.periodo_academico_id,
        nombreCompleto: anterior.nombre_completo,
        tipoDocumento: anterior.tipo_documento,
        numeroDocumento: anterior.numero_documento,
        lugarExpedicion: anterior.lugar_expedicion_documento,
        cargo: anterior.cargo_desempenado,
        tipoNovedad: anterior.tipo_novedad,
        fechaRetiro: anterior.fecha_retiro,
        jefeInmediatoId: anterior.jefe_inmediato_id,
        solicitudAnteriorId: anterior.id,
      });
      await requestRepository.copyInforme(client, anterior.id, nueva.id);
      return { ok: true, mensaje: 'Trámite reiniciado con tus datos anteriores. Revísalos y solicita de nuevo las aprobaciones.', solicitud: nueva };
    });
  }

  // RF-010: informe por entrega de cargo
  async getInforme(currentUser, solicitudId) {
    return database.withClient(async (client) => {
      const solicitud = await requestRepository.findById(client, solicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
      // El informe lo ve solo quien lo diligencia y Comunidad Universitaria en la aprobación final
      // (ni las dependencias ni el jefe inmediato lo consultan).
      const esDueno = solicitud.usuario_id === currentUser.id;
      const esAprobadorFinal = hasRole(currentUser.roles, [ROLES.APROBADOR]) && FINAL_STATES.includes(solicitud.estado_global);
      if (!esDueno && !esAprobadorFinal) {
        throw new HttpError(403, 'El informe por entrega de cargo solo lo consulta Comunidad Universitaria en la aprobación final');
      }

      const informe = await requestRepository.findInforme(client, solicitudId);
      const secciones = informe?.secciones || {};
      return {
        solicitudId,
        estado: informe?.estado || 'BORRADOR',
        editable: solicitud.usuario_id === currentUser.id
          && ['BORRADOR', 'EN_PROCESO', 'AL_DIA'].includes(solicitud.estado_global),
        secciones,
        resumen: resumenPorSeccion(secciones),
        actualizadoEn: informe?.updated_at || null,
      };
    });
  }

  async saveInforme(currentUser, solicitudId, payload) {
    const { estado = 'BORRADOR', secciones } = payload || {};
    if (!['BORRADOR', 'COMPLETO'].includes(estado)) {
      throw new HttpError(400, "El estado debe ser 'BORRADOR' o 'COMPLETO'");
    }
    if (secciones === undefined || typeof secciones !== 'object' || secciones === null || Array.isArray(secciones)) {
      throw new HttpError(400, 'Las secciones del informe deben enviarse como un objeto');
    }
    if (Buffer.byteLength(JSON.stringify(secciones), 'utf8') > MAX_INFORME_BYTES) {
      throw new HttpError(400, 'El informe es demasiado grande (máximo 500 KB)');
    }
    if (estado === 'COMPLETO') {
      const errores = validarInformeCompleto(secciones);
      if (errores.length) {
        throw new HttpError(400, `El informe está incompleto: ${errores.length} campo(s) por diligenciar`, errores);
      }
    }

    return database.withUserContext(currentUser, 'Guardar informe de entrega de cargo', async (client) => {
      const solicitud = await this.loadOwned(client, currentUser, solicitudId);
      if (!['BORRADOR', 'EN_PROCESO', 'AL_DIA'].includes(solicitud.estado_global)) {
        throw new HttpError(409, 'El trámite ya está en aprobación final o cerrado y el informe no se puede modificar');
      }

      const informe = await requestRepository.upsertInforme(client, { solicitudId, estado, secciones });

      return {
        ok: true,
        mensaje: estado === 'COMPLETO' ? 'Informe de entrega de cargo completado con éxito' : 'Borrador guardado',
        informe: { estado: informe.estado, actualizado_en: informe.updated_at },
        resumen: resumenPorSeccion(informe.secciones),
      };
    });
  }

  // RF-005: solicitudes de aprobación final pendientes
  async listPendingApproval(currentUser) {
    if (!hasRole(currentUser.roles, [ROLES.APROBADOR])) {
      throw new HttpError(403, 'Acceso restringido a la División de Comunidad Universitaria');
    }
    return database.withClient(async (client) => {
      const solicitudes = await requestRepository.listPendingFinal(client);
      return solicitudes.map((s) => ({
        id: s.id,
        solicitudId: s.id,
        usuarioId: s.usuario_id,
        nombre: s.nombre_completo,
        documento: `${s.tipo_documento} ${s.numero_documento}`,
        correo: s.correo_institucional,
        vinculacion: s.tipo_vinculacion,
        verificado: s.verificado,
        cargo: s.cargo_desempenado,
        novedad: s.tipo_novedad,
        fechaRetiro: s.fecha_retiro,
        fechaSolicitud: s.fecha_solicitud,
        fechaSolicitudFinal: s.fecha_solicitud_final,
        estadoGlobal: s.estado_global,
      }));
    });
  }

  // Lo que ve Comunidad Universitaria para decidir: datos, lista de verificación de cada dependencia
  // (con su «Recibí», fecha y firma) e informe completo. Solo lectura.
  async getRevisionFinal(currentUser, solicitudId) {
    if (!hasRole(currentUser.roles, [ROLES.APROBADOR])) {
      throw new HttpError(403, 'Acceso restringido a la División de Comunidad Universitaria');
    }
    return database.withClient(async (client) => {
      const solicitud = await requestRepository.findById(client, solicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
      if (!FINAL_STATES.includes(solicitud.estado_global)) {
        throw new HttpError(409, 'El trabajador todavía no ha pedido la aprobación final');
      }

      const [checklist, informe, firmas, entregables] = await Promise.all([
        requestRepository.listChecklist(client, solicitudId),
        requestRepository.findInforme(client, solicitudId),
        requestRepository.findFirmas(client, solicitudId),
        solicitud.tipo_vinculacion === 'Docente' ? requestRepository.findEntregables(client, solicitudId) : null,
      ]);

      return {
        solicitudId: solicitud.id,
        estadoGlobal: solicitud.estado_global,
        trabajador: {
          nombre: solicitud.nombre_completo,
          documento: `${solicitud.tipo_documento} ${solicitud.numero_documento}`,
          lugarExpedicion: solicitud.lugar_expedicion_documento,
          cargo: solicitud.cargo_desempenado,
          vinculacion: solicitud.tipo_vinculacion,
          correo: solicitud.correo_institucional,
          verificado: solicitud.verificado,
          novedad: solicitud.tipo_novedad,
          fechaRetiro: solicitud.fecha_retiro,
          jefe: solicitud.jefe_nombre,
          periodo: solicitud.nombre_periodo,
        },
        checklist,
        entregables,
        informe: informe ? { estado: informe.estado, secciones: informe.secciones } : null,
        cierre: {
          observaciones: solicitud.observaciones_trabajador,
          clausulaAceptada: solicitud.clausula_aceptada,
          fechaClausula: solicitud.fecha_clausula,
          firmaTrabajador: firmas.trabajador || null,
          fechaSolicitudFinal: solicitud.fecha_solicitud_final,
        },
        resolucion: solicitud.estado_global === 'PENDIENTE_APROBACION' ? null : {
          aprobador: solicitud.aprobador_nombre,
          fecha: solicitud.fecha_aprobacion_final,
          observaciones: solicitud.observaciones_aprobacion,
        },
      };
    });
  }

  // RF-005: aprobación final o rechazo motivado (RN-002: solo Comunidad Universitaria)
  async approveOrReject(currentUser, solicitudId, payload) {
    if (!hasRole(currentUser.roles, [ROLES.APROBADOR])) {
      throw new HttpError(403, 'RN-002: solo la División de Comunidad Universitaria puede otorgar la aprobación final');
    }

    const { decision, observacion, aprobado } = payload || {};
    const isApproved = decision === 'APROBADO' || aprobado === true;
    const note = texto(observacion);
    if (!isApproved && note.length < 10) {
      throw new HttpError(400, 'Para rechazar, explique los motivos para que el trabajador sepa qué corregir (mínimo 10 caracteres)');
    }

    return database.withUserContext(
      currentUser,
      isApproved ? 'Aprobación final del paz y salvo' : 'Rechazo del paz y salvo',
      async (client) => {
        const solicitud = await requestRepository.findById(client, solicitudId, { forUpdate: true });
        if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
        if (solicitud.estado_global !== 'PENDIENTE_APROBACION') {
          throw new HttpError(409, solicitud.estado_global === 'AL_DIA' || solicitud.estado_global === 'EN_PROCESO' || solicitud.estado_global === 'BORRADOR'
            ? 'El trabajador todavía no ha pedido la aprobación final'
            : `El trámite ya está cerrado (${solicitud.estado_global})`);
        }

        if (!isApproved) {
          const rechazada = await requestRepository.reject(client, { id: solicitudId, approverId: currentUser.id, observacion: note });
          await notificationService.notify(client, solicitud.usuario_id, {
            tipo: 'TRAMITE_RECHAZADO',
            titulo: 'Tu paz y salvo fue rechazado',
            mensaje: `Motivo: ${note}. Puedes iniciar el proceso de nuevo con tus datos anteriores.`,
            referencia: { solicitudId },
          });
          return { ok: true, mensaje: 'Solicitud rechazada con observación motivada', estado: 'RECHAZADO', solicitud: rechazada };
        }

        const firma = await firmaService.requerir(client, currentUser.id);
        const aprobada = await requestRepository.approve(client, {
          id: solicitudId,
          approverId: currentUser.id,
          observacion: note || 'Aprobado a entera satisfacción por Comunidad Universitaria',
          firma,
        });
        // RN-006 / RF-006: el certificado se emite en la misma transacción
        const certificado = await certificateService.generateCertificateForRequest(client, aprobada, currentUser);
        await notificationService.notify(client, solicitud.usuario_id, {
          tipo: 'TRAMITE_APROBADO',
          titulo: '¡Tu paz y salvo fue aprobado!',
          mensaje: 'Ya puedes descargar tu certificado con código QR.',
          referencia: { solicitudId },
        });
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
