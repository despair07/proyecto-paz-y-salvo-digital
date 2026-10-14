const requestService = require('../services/request.service');

const requestController = {
  // GET /paz-y-salvo/mi-estado
  async getMyStatus(req, res, next) {
    try {
      const data = await requestService.getMyStatus(req.user);
      return res.json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  // POST /tramites/habilitar (RF-009)
  async habilitarTramite(req, res, next) {
    try {
      const data = await requestService.habilitarTramite(req.user, req.body || {});
      return res.status(201).json(data);
    } catch (error) {
      return next(error);
    }
  },

  // GET /tramites/:id/informe-entrega-cargo (RF-010)
  async getInforme(req, res, next) {
    try {
      const data = await requestService.getInforme(req.user, req.params.id);
      return res.json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  // PUT /tramites/:id/informe-entrega-cargo (RF-010)
  async saveInforme(req, res, next) {
    try {
      const data = await requestService.saveInforme(req.user, req.params.id, req.body || {});
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  // GET /tramites/pendientes-aprobacion (RF-005)
  async listPendingApproval(req, res, next) {
    try {
      const data = await requestService.listPendingApproval(req.user);
      return res.json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  // POST /tramites/:id/aprobar (RF-005, RN-002, RN-005, RN-010)
  async approveOrReject(req, res, next) {
    try {
      const data = await requestService.approveOrReject(req.user, req.params.id, req.body || {});
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = requestController;
