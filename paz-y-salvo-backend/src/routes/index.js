const express = require('express');
const authRoutes = require('./auth.routes');
const statusRoutes = require('./status.routes');
const bloqueosRoutes = require('./bloqueos.routes');
const teacherRoutes = require('./teacher.routes');
const tramitesRoutes = require('./tramites.routes');
const certificadosRoutes = require('./certificados.routes');
const dependenciasRoutes = require('./dependencias.routes');
const usuariosRoutes = require('./usuarios.routes');
const cargosRoutes = require('./cargos.routes');
const periodosRoutes = require('./periodos.routes');
const notificacionesRoutes = require('./notificaciones.routes');
const revisionesRoutes = require('./revisiones.routes');
const firmaRoutes = require('./firma.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/paz-y-salvo', statusRoutes);
router.use('/bloqueos', bloqueosRoutes);
router.use('/desarrollo-profesoral', teacherRoutes);
router.use('/tramites', tramitesRoutes);
router.use('/certificados', certificadosRoutes);
router.use('/dependencias', dependenciasRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/cargos', cargosRoutes);
router.use('/periodos', periodosRoutes);
router.use('/notificaciones', notificacionesRoutes);
router.use('/revisiones', revisionesRoutes);
router.use('/firma', firmaRoutes);
router.use('/admin', adminRoutes);

// Alias de retrocompatibilidad
router.use('/requests', tramitesRoutes);
router.use('/docentes', teacherRoutes);

module.exports = router;
