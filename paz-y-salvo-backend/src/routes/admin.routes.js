// ============================================================================
// RUTAS DE ADMINISTRACIÓN DTI (solo el rol Administrador DTI)
// Panel 1: solicitantes · Panel 2: personal de las dependencias. Sin acceso a datos de trámites (RN-011).
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const adminService = require('../services/admin.service');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);
router.use(rbacMiddleware([ROLES.ADMIN_DTI]));

const handle = (action, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json(await action(req));
  } catch (error) {
    return next(error);
  }
};

// GET /admin/resumen
router.get('/resumen', handle(async () => ({ ok: true, data: await adminService.resumen() })));

// GET /admin/solicitantes?filtro=pendientes|verificados|inactivos|todos&q=&page=
router.get('/solicitantes', handle(async (req) => ({ ok: true, ...(await adminService.listSolicitantes(req.query)) })));

// GET /admin/personal?dependenciaId=&q=&page=
router.get('/personal', handle(async (req) => ({ ok: true, ...(await adminService.listPersonal(req.query)) })));

// POST /admin/personal  { nombres, apellidos, correo_institucional, cargo, dependencia_id }
router.post('/personal', handle((req) => adminService.registrarPersonal(req.user, req.body), 201));

// PUT /admin/usuarios/:id  { nombres, apellidos, correo_institucional, cargo }
router.put('/usuarios/:id', handle((req) => adminService.actualizar(req.user, req.params.id, req.body)));

// PUT /admin/usuarios/:id/verificacion  { decision: CONFIRMAR | RECHAZAR }
router.put('/usuarios/:id/verificacion', handle((req) => adminService.verificar(req.user, req.params.id, req.body)));

// PUT /admin/usuarios/:id/estado  { estado: ACTIVO | INACTIVO }
router.put('/usuarios/:id/estado', handle((req) => adminService.cambiarEstado(req.user, req.params.id, req.body)));

// PUT /admin/personal/:id/dependencia  { dependencia_id }
router.put('/personal/:id/dependencia', handle((req) => adminService.asignarDependencia(req.user, req.params.id, req.body)));

// DELETE /admin/personal/:id
router.delete('/personal/:id', handle((req) => adminService.quitarPersonal(req.user, req.params.id)));

module.exports = router;
