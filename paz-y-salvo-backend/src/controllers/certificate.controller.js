const certificateService = require('../services/certificate.service');

const certificateController = {
  async create(req, res, next) {
    try {
      const data = await certificateService.createCertificate(req.body || {}, req.user);
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  async verify(req, res, next) {
    try {
      const data = await certificateService.verify(req.params.token);
      return res.json({ ok: true, data });
    } catch (error) {
      return next(error);
    }
  },

  async downloadPdf(req, res, next) {
    try {
      const pdf = await certificateService.getPdfBuffer(req.params.token);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Certificado-Paz-y-Salvo-Uniautonoma.pdf"',
        'Content-Length': pdf.length,
        'Cache-Control': 'private, no-store',
      });
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = certificateController;