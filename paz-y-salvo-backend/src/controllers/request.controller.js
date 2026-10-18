const requestService = require('../services/request.service');

// Ejecuta un caso de uso y responde; cualquier error pasa al manejador central
const handle = (action, { status = 200, wrap = false } = {}) => async (req, res, next) => {
  try {
    const result = await action(req);
    return res.status(status).json(wrap ? { ok: true, data: result } : result);
  } catch (error) {
    return next(error);
  }
};

const requestController = {
  // GET /paz-y-salvo/mi-estado
  getMyStatus: handle((req) => requestService.getMyStatus(req.user), { wrap: true }),

  // POST /tramites/habilitar (RF-009)
  habilitarTramite: handle((req) => requestService.habilitarTramite(req.user, req.body || {}), { status: 201 }),

  // GET /tramites/jefes-inmediatos
  listJefes: handle((req) => requestService.listJefes(req.user), { wrap: true }),

  // PUT /tramites/:id/datos-generales
  updateDatosGenerales: handle((req) => requestService.updateDatosGenerales(req.user, req.params.id, req.body || {})),

  // POST /tramites/:id/dependencias/:dependenciaId/solicitar
  solicitarAprobacion: handle((req) => requestService.solicitarAprobacion(
    req.user, req.params.id, req.params.dependenciaId, req.body || {}
  ), { status: 201 }),

  // PUT /tramites/:id/cierre
  updateCierre: handle((req) => requestService.updateCierre(req.user, req.params.id, req.body || {})),

  // POST /tramites/:id/solicitar-aprobacion-final
  solicitarAprobacionFinal: handle((req) => requestService.solicitarAprobacionFinal(req.user, req.params.id)),

  // POST /tramites/:id/reiniciar
  reiniciar: handle((req) => requestService.reiniciar(req.user, req.params.id), { status: 201 }),

  // GET /tramites/:id/informe-entrega-cargo (RF-010)
  getInforme: handle((req) => requestService.getInforme(req.user, req.params.id), { wrap: true }),

  // PUT /tramites/:id/informe-entrega-cargo (RF-010)
  saveInforme: handle((req) => requestService.saveInforme(req.user, req.params.id, req.body || {})),

  // GET /tramites/pendientes-aprobacion (RF-005)
  listPendingApproval: handle((req) => requestService.listPendingApproval(req.user), { wrap: true }),

  // GET /tramites/:id/revision-final
  getRevisionFinal: handle((req) => requestService.getRevisionFinal(req.user, req.params.id), { wrap: true }),

  // POST /tramites/:id/aprobar (RF-005, RN-002, RN-005, RN-010)
  approveOrReject: handle((req) => requestService.approveOrReject(req.user, req.params.id, req.body || {})),
};

module.exports = requestController;
