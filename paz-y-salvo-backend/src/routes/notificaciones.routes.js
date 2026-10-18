// ============================================================================
// RUTAS DE NOTIFICACIONES (cada usuario ve solo las suyas)
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const notificationService = require('../services/notification.service');

const router = express.Router();

router.use(authMiddleware);

// GET /notificaciones?soloNoLeidas=true&limit=30
router.get('/', async (req, res, next) => {
  try {
    const result = await notificationService.list(req.user, req.query);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});

// PUT /notificaciones/leer-todas
router.put('/leer-todas', async (req, res, next) => {
  try {
    return res.json(await notificationService.markAllRead(req.user));
  } catch (error) {
    return next(error);
  }
});

// PUT /notificaciones/:id/leida
router.put('/:id/leida', async (req, res, next) => {
  try {
    return res.json(await notificationService.markRead(req.user, req.params.id));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
