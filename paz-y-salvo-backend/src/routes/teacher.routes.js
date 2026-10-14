const express = require('express');
const teacherController = require('../controllers/teacher.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);

// GET /desarrollo-profesoral/docentes/:id (Detalle de entregables)
router.get('/docentes/:id', teacherController.getEntregables);

// PUT /desarrollo-profesoral/docentes/:id (Registra los 3 booleanos de entregables)
router.put(
  '/docentes/:id',
  rbacMiddleware([ROLES.ENCARGADO_AREA]),
  teacherController.updateEntregables
);

module.exports = router;
