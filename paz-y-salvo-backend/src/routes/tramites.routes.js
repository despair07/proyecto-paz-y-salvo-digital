const express = require('express');
const requestController = require('../controllers/request.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const { ROLES, SOLICITANTES } = require('../utils/roles');

const router = express.Router();

router.use(authMiddleware);

// ---------------------------------------------------------------- Comunidad Universitaria
// GET /tramites/pendientes-aprobacion (RF-005)
router.get('/pendientes-aprobacion', rbacMiddleware([ROLES.APROBADOR]), requestController.listPendingApproval);

// GET /tramites/jefes-inmediatos: jefes entre los que el trabajador elige
router.get('/jefes-inmediatos', rbacMiddleware(SOLICITANTES), requestController.listJefes);

// POST /tramites/habilitar (RF-009)
router.post('/habilitar', rbacMiddleware(SOLICITANTES), requestController.habilitarTramite);

// GET /tramites/:id/revision-final: datos, lista de verificación de dependencias e informe (solo lectura)
router.get('/:id/revision-final', rbacMiddleware([ROLES.APROBADOR]), requestController.getRevisionFinal);

// POST /tramites/:id/aprobar (RF-005, RN-002, RN-005, RN-010): aprobar o rechazar
router.post('/:id/aprobar', rbacMiddleware([ROLES.APROBADOR]), requestController.approveOrReject);

// ---------------------------------------------------------------- Trabajador
router.put('/:id/datos-generales', rbacMiddleware(SOLICITANTES), requestController.updateDatosGenerales);
router.post(
  '/:id/dependencias/:dependenciaId/solicitar',
  rbacMiddleware(SOLICITANTES),
  requestController.solicitarAprobacion
);
router.put('/:id/cierre', rbacMiddleware(SOLICITANTES), requestController.updateCierre);
router.post('/:id/solicitar-aprobacion-final', rbacMiddleware(SOLICITANTES), requestController.solicitarAprobacionFinal);
router.post('/:id/reiniciar', rbacMiddleware(SOLICITANTES), requestController.reiniciar);

// ---------------------------------------------------------------- Informe (RF-010)
// El dueño lo diligencia; quienes lo revisan lo leen (el servicio valida el acceso)
router.get('/:id/informe-entrega-cargo', requestController.getInforme);
router.put('/:id/informe-entrega-cargo', rbacMiddleware(SOLICITANTES), requestController.saveInforme);

module.exports = router;
