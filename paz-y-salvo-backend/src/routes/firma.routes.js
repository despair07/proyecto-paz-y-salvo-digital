// ============================================================================
// RUTAS DE LA FIRMA PERSONAL (cada persona solo accede a la suya)
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const firmaService = require('../services/firma.service');

const router = express.Router();

router.use(authMiddleware);

// GET /firma
router.get('/', async (req, res, next) => {
  try {
    return res.json({ ok: true, ...(await firmaService.obtener(req.user)) });
  } catch (error) {
    return next(error);
  }
});

// PUT /firma  { imagen: "data:image/png;base64,..." }
router.put('/', async (req, res, next) => {
  try {
    return res.json(await firmaService.guardar(req.user, req.body?.imagen));
  } catch (error) {
    return next(error);
  }
});

// DELETE /firma
router.delete('/', async (req, res, next) => {
  try {
    return res.json(await firmaService.eliminar(req.user));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
