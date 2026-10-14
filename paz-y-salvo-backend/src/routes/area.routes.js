const express = require('express');
const requestController = require('../controllers/request.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const areaScopeMiddleware = require('../middlewares/areaScope.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();
const areaRoles = [ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO];

router.use(authMiddleware, rbacMiddleware(areaRoles));
router.get('/', areaScopeMiddleware(), requestController.listAreaQueue);
router.get(
  '/solicitudes/:solicitudId',
  areaScopeMiddleware(),
  requestController.getAreaRequest
);
router.put(
  '/solicitudes/:solicitudId/veredicto',
  areaScopeMiddleware({ requestedDependencyId: (req) => req.body?.dependenciaId }),
  requestController.setAreaVerdict
);

module.exports = router;
