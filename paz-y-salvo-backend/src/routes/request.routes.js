const express = require('express');
const requestController = require('../controllers/request.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/catalog', requestController.catalog);
router.get('/mine', requestController.listMine);
router.post('/mine', requestController.createMine);
router.get('/:solicitudId/informe', requestController.getReport);
router.put('/:solicitudId/informe', requestController.saveReport);
router.post('/', requestController.createMine);
router.get('/pendientes-aprobacion', requestController.pendingApproval);
router.post('/:id/aprobar', requestController.approveRequest);

module.exports = router;
