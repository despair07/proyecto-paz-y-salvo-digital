const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const certificateController = require('../controllers/certificate.controller');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// GET /certificados/verificar/:token (Público - sin login)
router.get('/verificar/:token', certificateController.verify);

// GET /certificados/:token/pdf (Público / enlace QR)
router.get('/:token/pdf', certificateController.downloadPdf);

// POST /certificados (Aprobador Comunidad Universitaria / Admin DTI)
router.post(
  '/',
  authMiddleware,
  rbacMiddleware([ROLES.APROBADOR]),
  certificateController.create
);

module.exports = router;
