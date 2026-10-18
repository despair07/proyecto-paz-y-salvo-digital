const lockService = require('../services/lock.service');

const lockController = {
  async list(req, res, next) {
    try {
      const result = await lockService.list(req.query || {}, req.user);
      return res.json({
        ok: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const data = await lockService.getById(req.params.id, req.user);
      return res.json({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = lockController;
