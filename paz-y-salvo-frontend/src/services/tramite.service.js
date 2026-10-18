import api from './api.js';

const data = (res) => res.data;

// ---- Trabajador
export const getMiEstado = () => api.get('/paz-y-salvo/mi-estado').then((r) => r.data.data);
export const habilitarTramite = (payload = {}) => api.post('/tramites/habilitar', payload).then(data);
export const listJefes = () => api.get('/tramites/jefes-inmediatos').then((r) => r.data.data);
export const updateDatosGenerales = (id, payload) => api.put(`/tramites/${id}/datos-generales`, payload).then(data);
export const solicitarAprobacion = (id, dependenciaId, payload = {}) =>
  api.post(`/tramites/${id}/dependencias/${dependenciaId}/solicitar`, payload).then(data);
export const updateCierre = (id, payload) => api.put(`/tramites/${id}/cierre`, payload).then(data);
export const solicitarAprobacionFinal = (id) => api.post(`/tramites/${id}/solicitar-aprobacion-final`).then(data);
export const reiniciarTramite = (id) => api.post(`/tramites/${id}/reiniciar`).then(data);
export const getCargos = () => api.get('/cargos').then((r) => r.data.data);

// ---- Informe por entrega de cargo
export const getInforme = (id) => api.get(`/tramites/${id}/informe-entrega-cargo`).then((r) => r.data.data);
export const saveInforme = (id, estado, secciones) =>
  api.put(`/tramites/${id}/informe-entrega-cargo`, { estado, secciones }).then(data);

// ---- Dependencias (bandeja de revisión)
export const listRevisiones = (params = {}) => api.get('/revisiones', { params }).then(data);
export const getRevision = (id) => api.get(`/revisiones/${id}`).then((r) => r.data.data);
export const aprobarRevision = (id, recibi) => api.post(`/revisiones/${id}/aprobar`, { recibi }).then(data);
export const bloquearRevision = (id, payload) => api.post(`/revisiones/${id}/bloquear`, payload).then(data);
export const saveEntregables = (solicitudId, payload) =>
  api.put(`/desarrollo-profesoral/docentes/${solicitudId}`, payload).then(data);

// ---- Comunidad Universitaria
export const listPendientes = () => api.get('/tramites/pendientes-aprobacion').then((r) => r.data.data);
export const getRevisionFinal = (id) => api.get(`/tramites/${id}/revision-final`).then((r) => r.data.data);
export const resolverFinal = (id, payload) => api.post(`/tramites/${id}/aprobar`, payload).then(data);

// ---- Firma personal
export const getFirma = () => api.get('/firma').then(data);
export const saveFirma = (imagen) => api.put('/firma', { imagen }).then(data);
export const deleteFirma = () => api.delete('/firma').then(data);
