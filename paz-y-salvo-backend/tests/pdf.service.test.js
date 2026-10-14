const { PDFDocument } = require('pdf-lib');
const pdfService = require('../src/services/pdf.service');

describe('pdfService', () => {
  it('generates a one-page certificate with an embedded QR image', async () => {
    const pdf = await pdfService.generateCertificate({
      codigo_qr_token: 'a'.repeat(64),
      fecha_emision: '2026-10-13T12:00:00.000Z',
      nombres: 'Ana',
      apellidos: 'Gomez',
      tipo_documento: 'CC',
      numero_documento: '900000001',
      tipo_vinculacion: 'Docente',
      cargo_desempenado: 'Docente de prueba',
      tipo_novedad: 'RETIRO',
      nombre_periodo: '2026-2',
    }, 'http://localhost:3000/api/v1/certificados/verificar/token');

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  });
});
