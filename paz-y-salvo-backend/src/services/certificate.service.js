// ============================================================================
// SERVICIO DE CERTIFICADOS DIGITALES (RN-006, RF-006)
// ============================================================================

const { randomBytes, createHash } = require('node:crypto');
const database = require('../config/database');
const requestRepository = require('../repositories/request.repository');
const pdfService = require('./pdf.service');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,255}$/;

class CertificateService {
  // Emite el certificado de un trámite aprobado dentro de la transacción recibida (idempotente).
  async generateCertificateForRequest(client, solicitud, currentUser) {
    // RN-006: solo se emite con la aprobación final registrada
    if (!solicitud.aprobado_final) {
      throw new HttpError(409, 'RN-006: el certificado solo se emite cuando el trámite cuenta con aprobación final');
    }

    const existing = await requestRepository.findCertificateBySolicitud(client, solicitud.id);
    if (existing) return existing;

    const token = randomBytes(32).toString('hex');
    return requestRepository.insertCertificate(client, {
      solicitudId: solicitud.id,
      token,
      hash: createHash('sha256').update(token).digest('hex'),
      archivoUrl: `${env.API_PUBLIC_URL}/certificados/${token}/pdf`,
      emitidoPor: currentUser.id,
    });
  }

  // POST /certificados
  async createCertificate(payload, currentUser) {
    const { solicitudId } = payload || {};
    if (!solicitudId) {
      throw new HttpError(400, 'Identificador de solicitud requerido');
    }

    return database.withUserContext(currentUser, 'Emitir certificado', async (client) => {
      const solicitud = await requestRepository.findById(client, solicitudId);
      if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
      return this.generateCertificateForRequest(client, solicitud, currentUser);
    });
  }

  async findByToken(token) {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
      throw new HttpError(404, 'Certificado no encontrado o token inválido');
    }
    const certificate = await database.withClient((client) => requestRepository.findCertificateByToken(client, token));
    if (!certificate) {
      throw new HttpError(404, 'Certificado no encontrado o inválido');
    }
    return certificate;
  }

  // GET /certificados/verificar/:token (público)
  async verify(token) {
    const cert = await this.findByToken(token);
    return {
      autentico: true,
      valido: true,
      estado: 'AUTÉNTICO Y VIGENTE',
      token,
      solicitante: cert.nombre_completo || `${cert.nombres} ${cert.apellidos}`,
      documento: `${cert.tipo_documento} ${cert.numero_documento}`,
      tipoVinculacion: cert.tipo_vinculacion,
      cargo: cert.cargo_desempenado,
      novedad: cert.tipo_novedad,
      periodo: cert.nombre_periodo,
      fechaEmision: cert.fecha_emision,
      entidadEmisora: 'División de Comunidad Universitaria — Corporación Universitaria Autónoma del Cauca',
      politica: 'Cero Papel - Formato GTH-07 Digital',
    };
  }

  // GET /certificados/:token/pdf: PDF con el QR embebido
  async getPdfBuffer(token) {
    const cert = await this.findByToken(token);
    const verificationUrl = `${env.FRONTEND_PUBLIC_URL}/verificar/${token}`;
    return pdfService.generateCertificate(cert, verificationUrl);
  }
}

module.exports = new CertificateService();
