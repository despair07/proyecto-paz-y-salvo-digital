const express = require('express');
const lockController = require('../controllers/lock.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);

// GET /bloqueos - cada rol ve lo suyo (RN-004): encargado su dependencia, trabajador sus bloqueos
router.get(
  '/',
  rbacMiddleware([
    ROLES.ENCARGADO_AREA,
    ROLES.JEFE_INMEDIATO,
    ROLES.APROBADOR,
    ROLES.ADMIN_DTI,
    ROLES.DOCENTE,
    ROLES.ADMINISTRATIVO,
    ROLES.CONTRATISTA,
  ]),
  lockController.list
);

// GET /bloqueos/:id - Detalle de un bloqueo
router.get('/:id', lockController.getById);

// POST /bloqueos - Registra bloqueo (categoría y motivo obligatorio)
router.post(
  '/',
  rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO]),
  lockController.create
);

// PUT /bloqueos/:id - Levanta (RESUELTO) o edita observación
router.put(
  '/:id',
  rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO]),
  lockController.update
);

// DELETE /bloqueos/:id - Anula bloqueo registrado por error
router.delete(
  '/:id',
  rbacMiddleware([ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO]),
  lockController.remove
);

module.exports = router;
