// ============================================================================
// RUTAS DE PERIODOS ACADÉMICOS (catálogo de solo lectura)
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const database = require('../config/database');

const router = express.Router();

router.use(authMiddleware);

// GET /periodos
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await database.withClient((client) => client.query(
      `SELECT id, nombre_periodo, activo, fecha_inicio, fecha_fin
         FROM periodos_academicos ORDER BY fecha_inicio DESC`
    ));
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
