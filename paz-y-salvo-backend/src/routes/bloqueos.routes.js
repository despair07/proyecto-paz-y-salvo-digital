const express = require('express');
const lockController = require('../controllers/lock.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const { ROLES, SOLICITANTES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);

// Historial de bloqueos (consulta). Se registran al bloquear una solicitud (POST /revisiones/:id/bloquear)
// y se resuelven solos cuando la dependencia aprueba. Cada rol ve lo suyo; el Administrador DTI no accede.
router.get(
  '/',
  rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO, ROLES.APROBADOR, ...SOLICITANTES]),
  lockController.list
);
router.get(
  '/:id',
  rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO, ROLES.APROBADOR, ...SOLICITANTES]),
  lockController.getById
);

module.exports = router;
