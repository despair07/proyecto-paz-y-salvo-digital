import api from './api.js';

export async function getLocks(solicitudId) {
  const { data } = await api.get('/locks', { params: solicitudId ? { solicitudId } : {} });
  return data;
}

export async function createLock(payload) {
  const { data } = await api.post('/locks', payload);
  return data;
}

export async function resolveLock(id, observacion) {
  const { data } = await api.patch(`/locks/${id}/resolve`, { observacion });
  return data;
}
