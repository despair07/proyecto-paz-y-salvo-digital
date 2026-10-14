const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const database = require('../config/database');
const { ROLES } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const data = await database.withUserContext(req.user, 'Consulta del catálogo de cargos', async (client) => {
      const result = await client.query(
        'SELECT id, nombre FROM public.catalogo_cargos ORDER BY nombre'
      );
      return result.rows;
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', rbacMiddleware([ROLES.ADMIN_DTI]), async (req, res, next) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre || nombre.length > 150) {
    return next(new HttpError(400, 'El nombre del cargo es obligatorio y admite hasta 150 caracteres'));
  }
  try {
    const data = await database.withUserContext(req.user, `Actualización de cargo: ${nombre}`, async (client) => {
      const result = await client.query(
        `UPDATE public.catalogo_cargos SET nombre = $2 WHERE id = $1
         RETURNING id, nombre`,
        [req.params.id, nombre]
      );
      if (!result.rows.length) throw new HttpError(404, 'Cargo no encontrado');
      return result.rows[0];
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;