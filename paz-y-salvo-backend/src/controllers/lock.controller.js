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

  async create(req, res, next) {
    try {
      const data = await lockService.create(req.body || {}, req.user);
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const data = await lockService.update(req.params.id, req.body || {}, req.user);
      return res.json({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await lockService.remove(req.params.id, req.user);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = lockController;
