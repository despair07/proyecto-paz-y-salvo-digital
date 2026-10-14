const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');

async function generateCertificate(certificate, verificationUrl) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Certificado de Paz y Salvo Digital');
  pdf.setSubject('Certificado institucional verificable mediante QR');
  pdf.setCreator('Paz y Salvo Digital - Uniautónoma');

  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.02, 0.05, 0.17);
  const blue = rgb(0.11, 0.31, 0.84);
  const gray = rgb(0.35, 0.39, 0.46);
  const draw = (text, x, y, size = 12, font = regular, color = dark) => {
    page.drawText(String(text || '').replace(/[\u2013\u2014\u2022]/g, '-'), {
      x, y, size, font, color, maxWidth: 440,
    });
  };

  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 768, width: 612, height: 24, color: blue });
  draw('UNIAUTONOMA DEL CAUCA', 54, 720, 12, bold, blue);
  draw('CERTIFICADO DE PAZ Y SALVO', 54, 674, 22, bold);
  draw('GTH-07 | Documento digital verificable', 54, 650, 11, regular, gray);
  page.drawLine({ start: { x: 54, y: 630 }, end: { x: 558, y: 630 }, thickness: 1, color: rgb(0.82, 0.85, 0.9) });

  draw('Se certifica que', 54, 592, 12, regular, gray);
  draw(`${certificate.nombres} ${certificate.apellidos}`, 54, 562, 20, bold);
  draw(`${certificate.tipo_documento || 'Documento'}: ${certificate.numero_documento}`, 54, 536, 12);
  draw(`Vinculacion: ${certificate.tipo_vinculacion}`, 54, 510, 12);
  draw(`Cargo: ${certificate.cargo_desempenado}`, 54, 484, 12);
  draw(`Novedad: ${certificate.tipo_novedad}`, 54, 458, 12);
  draw(`Periodo: ${certificate.nombre_periodo}`, 54, 432, 12);
  draw(`Fecha de emision: ${new Date(certificate.fecha_emision).toLocaleDateString('es-CO')}`, 54, 406, 12);
  draw('Estado: APROBADO FINAL', 54, 380, 12, bold, blue);

  const qrPng = await QRCode.toBuffer(verificationUrl, {
    type: 'png', width: 240, margin: 1, errorCorrectionLevel: 'M',
  });
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, { x: 412, y: 190, width: 130, height: 130 });
  draw('Escanee para validar', 414, 174, 9, regular, gray);
  draw(`Codigo: ${certificate.codigo_qr_token.slice(0, 16)}`, 54, 230, 9, regular, gray);
  draw('La validez de este documento se confirma consultando el QR institucional.', 54, 198, 9, regular, gray);
  page.drawLine({ start: { x: 54, y: 120 }, end: { x: 558, y: 120 }, thickness: 1, color: rgb(0.82, 0.85, 0.9) });
  draw('Certificado emitido digitalmente por el Sistema de Paz y Salvo.', 54, 96, 9, regular, gray);

  return Buffer.from(await pdf.save());
}

module.exports = { generateCertificate };
