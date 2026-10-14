const express = require('express');
const requestController = require('../controllers/request.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);

// GET /tramites/pendientes-aprobacion (RF-005: Comunidad Universitaria)
router.get(
  '/pendientes-aprobacion',
  rbacMiddleware([ROLES.APROBADOR, ROLES.ADMIN_DTI]),
  requestController.listPendingApproval
);

// POST /tramites/:id/aprobar (RF-005, RN-002, RN-005, RN-010: Comunidad Universitaria)
router.post(
  '/:id/aprobar',
  rbacMiddleware([ROLES.APROBADOR]),
  requestController.approveOrReject
);

// POST /tramites/habilitar (RF-009: Habilitación de autoservicio)
router.post(
  '/habilitar',
  rbacMiddleware([ROLES.DOCENTE, ROLES.ADMINISTRATIVO, ROLES.CONTRATISTA]),
  requestController.habilitarTramite
);

// GET /tramites/:id/informe-entrega-cargo (RF-010)
router.get(
  '/:id/informe-entrega-cargo',
  requestController.getInforme
);

// PUT /tramites/:id/informe-entrega-cargo (RF-010)
router.put(
  '/:id/informe-entrega-cargo',
  requestController.saveInforme
);

module.exports = router;
