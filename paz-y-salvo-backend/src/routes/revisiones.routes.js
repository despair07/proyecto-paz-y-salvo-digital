// ============================================================================
// RUTAS DE REVISIONES (bandeja del jefe inmediato y de las dependencias)
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const reviewService = require('../services/review.service');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);
router.use(rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO]));

const handle = (action, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json(await action(req));
  } catch (error) {
    return next(error);
  }
};

// GET /revisiones?estado=SOLICITADA&q=...&page=1
router.get('/', handle(async (req) => ({ ok: true, ...(await reviewService.listInbox(req.user, req.query)) })));

// GET /revisiones/:id
router.get('/:id', handle(async (req) => ({ ok: true, data: await reviewService.getDetail(req.user, req.params.id) })));

// POST /revisiones/:id/aprobar  { recibi }
router.post('/:id/aprobar', handle((req) => reviewService.aprobar(req.user, req.params.id, req.body)));

// POST /revisiones/:id/bloquear  { categoria, motivo }
router.post('/:id/bloquear', handle((req) => reviewService.bloquear(req.user, req.params.id, req.body)));

module.exports = router;
