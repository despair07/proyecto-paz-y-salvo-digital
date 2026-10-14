// ============================================================================
// RUTAS DE USUARIOS (búsqueda y administración DTI)
// RN-011: el Administrador DTI solo puede modificar el nombre del cargo.
// ============================================================================

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const database = require('../config/database');
const userRepository = require('../repositories/user.repository');
const { ROLES } = require('../utils/roles');
const HttpError = require('../utils/httpError');

const router = express.Router();

router.use(authMiddleware);

// GET /usuarios?q=&page=&limit=&conTramite=true
// conTramite=true devuelve solo trabajadores con un trámite en curso (para registrar bloqueos).
router.get(
  '/',
  rbacMiddleware([ROLES.ADMIN_DTI, ROLES.ENCARGADO_AREA, ROLES.JEFE_INMEDIATO, ROLES.APROBADOR]),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
      const search = String(req.query.q || req.query.search || '').trim();

      const { rows, total } = await database.withClient((client) => userRepository.list(client, {
        search,
        soloConTramite: req.query.conTramite === 'true',
        limit,
        offset: (page - 1) * limit,
      }));

      return res.json({
        ok: true,
        data: rows,
        pagination: { page, limit, totalRecords: total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// PUT /usuarios/:id: actualiza solo el cargo (RN-011)
router.put('/:id', rbacMiddleware([ROLES.ADMIN_DTI]), async (req, res, next) => {
  try {
    const { cargo_desempenado: cargoDesempenado, cargo } = req.body || {};
    const nuevoCargo = String(cargoDesempenado || cargo || '').trim();
    if (!nuevoCargo || nuevoCargo.length > 150) {
      throw new HttpError(400, 'El cargo es obligatorio y admite hasta 150 caracteres');
    }

    const data = await database.withUserContext(req.user, `Actualización de cargo: ${nuevoCargo}`, async (client) => {
      const updated = await userRepository.updateCargo(client, req.params.id, nuevoCargo);
      if (!updated) throw new HttpError(404, 'Usuario no encontrado');
      return updated;
    });

    return res.json({
      ok: true,
      mensaje: 'Cargo actualizado exitosamente (RN-011: solo lectura para el resto de atributos)',
      data,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
