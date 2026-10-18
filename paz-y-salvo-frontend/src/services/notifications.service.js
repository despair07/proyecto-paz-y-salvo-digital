import api from './api.js';

export async function getNotifications({ soloNoLeidas = false, limit = 30 } = {}) {
  const { data } = await api.get('/notificaciones', { params: { soloNoLeidas, limit } });
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.put(`/notificaciones/${id}/leida`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.put('/notificaciones/leer-todas');
  return data;
}
