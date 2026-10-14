// ============================================================================
// RUTAS DE DEPENDENCIAS (catálogo de solo lectura)
// RN-011: el Administrador DTI no crea ni renombra dependencias; solo edita el nombre del cargo.
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');

const router = express.Router();

router.use(authMiddleware);

// GET /dependencias
router.get('/', async (req, res, next) => {
  try {
    const data = await database.withClient((client) => requestRepository.listDependencias(client));
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
