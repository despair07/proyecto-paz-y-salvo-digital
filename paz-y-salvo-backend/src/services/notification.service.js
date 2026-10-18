// ============================================================================
// SERVICIO DE NOTIFICACIONES
// Avisos dentro del sistema. `notify` se usa dentro de la transacción de quien genera el aviso;
// el envío por correo se puede agregar aquí más adelante sin tocar a los demás servicios.
// ============================================================================

const database = require('../config/database');
const notificationRepository = require('../repositories/notification.repository');
const HttpError = require('../utils/httpError');

class NotificationService {
  async notify(client, usuarioIds, payload) {
    const ids = [...new Set([].concat(usuarioIds).filter(Boolean))];
    await notificationRepository.createForMany(client, ids, payload);
  }

  async list(currentUser, query = {}) {
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 30));
    return database.withClient(async (client) => ({
      data: await notificationRepository.listByUser(client, currentUser.id, {
        soloNoLeidas: query.soloNoLeidas === 'true',
        limit,
      }),
      noLeidas: await notificationRepository.countUnread(client, currentUser.id),
    }));
  }

  async markRead(currentUser, id) {
    const updated = await database.withClient((client) => notificationRepository.markRead(client, id, currentUser.id));
    if (!updated) throw new HttpError(404, 'Notificación no encontrada');
    return { ok: true };
  }

  async markAllRead(currentUser) {
    const total = await database.withClient((client) => notificationRepository.markAllRead(client, currentUser.id));
    return { ok: true, marcadas: total };
  }
}

module.exports = new NotificationService();
