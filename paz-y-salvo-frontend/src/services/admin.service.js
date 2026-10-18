import api from './api.js';

const data = (res) => res.data;

// Panel de Administración DTI: solicitantes y personal de las dependencias (RN-011)
export const getResumenAdmin = () => api.get('/admin/resumen').then((r) => r.data.data);
export const listSolicitantes = (params = {}) => api.get('/admin/solicitantes', { params }).then(data);
export const listPersonal = (params = {}) => api.get('/admin/personal', { params }).then(data);
export const registrarPersonal = (payload) => api.post('/admin/personal', payload).then(data);
export const actualizarUsuario = (id, payload) => api.put(`/admin/usuarios/${id}`, payload).then(data);
export const verificarUsuario = (id, decision) => api.put(`/admin/usuarios/${id}/verificacion`, { decision }).then(data);
export const cambiarEstadoUsuario = (id, estado) => api.put(`/admin/usuarios/${id}/estado`, { estado }).then(data);
export const asignarDependencia = (id, dependenciaId) =>
  api.put(`/admin/personal/${id}/dependencia`, { dependencia_id: dependenciaId }).then(data);
export const quitarPersonal = (id) => api.delete(`/admin/personal/${id}`).then(data);
