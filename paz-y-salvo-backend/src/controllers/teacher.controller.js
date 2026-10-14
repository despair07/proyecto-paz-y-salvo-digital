const teacherService = require('../services/teacher.service');

const teacherController = {
  async getEntregables(req, res, next) {
    try {
      const data = await teacherService.getByDocenteId(req.params.id, req.user);
      return res.json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  async updateEntregables(req, res, next) {
    try {
      const result = await teacherService.updateEntregables(req.params.id, req.body || {}, req.user);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = teacherController;
