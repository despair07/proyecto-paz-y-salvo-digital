// ============================================================================
// FIRMA DE LA PERSONA (dibujada en su perfil)
// Se guarda como PNG (data URL) y se reutiliza al firmar: al aprobar una dependencia, al aceptar la
// cláusula del trabajador y al resolver la aprobación final. Es un dato sensible: solo la ve su
// dueño; en cada documento se copia como evidencia de esa firma.
// ============================================================================

const database = require('../config/database');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');

const PREFIX = 'data:image/png;base64,';
const MAX_BYTES = 200 * 1024;
const MAX_ANCHO = 1200;
const MAX_ALTO = 600;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Valida que sea realmente un PNG razonable (no solo un texto que lo aparenta)
function validarImagen(imagen) {
  if (typeof imagen !== 'string' || !imagen.startsWith(PREFIX)) {
    throw new HttpError(400, 'La firma debe enviarse como imagen PNG');
  }
  const base64 = imagen.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new HttpError(400, 'La firma no es una imagen válida');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_BYTES) {
    throw new HttpError(400, 'La firma es demasiado pesada (máximo 200 KB)');
  }
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_MAGIC) || bytes.subarray(12, 16).toString() !== 'IHDR') {
    throw new HttpError(400, 'La firma no es una imagen PNG válida');
  }
  const ancho = bytes.readUInt32BE(16);
  const alto = bytes.readUInt32BE(20);
  if (!ancho || !alto || ancho > MAX_ANCHO || alto > MAX_ALTO) {
    throw new HttpError(400, `La firma debe medir como máximo ${MAX_ANCHO}×${MAX_ALTO} píxeles`);
  }
}

class FirmaService {
  async obtener(currentUser) {
    const firma = await database.withClient((client) => userRepository.getFirma(client, currentUser.id));
    return { tiene: Boolean(firma), imagen: firma?.imagen || null, actualizada: firma?.updated_at || null };
  }

  async guardar(currentUser, imagen) {
    validarImagen(imagen);
    await database.withUserContext(currentUser, 'Guardar firma', (client) => userRepository.upsertFirma(client, currentUser.id, imagen));
    return { ok: true, mensaje: 'Firma guardada' };
  }

  async eliminar(currentUser) {
    await database.withUserContext(currentUser, 'Eliminar firma', (client) => userRepository.deleteFirma(client, currentUser.id));
    return { ok: true, mensaje: 'Firma eliminada' };
  }

  // Para firmar: devuelve la imagen o pide dibujarla primero
  async requerir(client, usuarioId) {
    const firma = await userRepository.getFirma(client, usuarioId);
    if (!firma) {
      throw new HttpError(409, 'Dibuja y guarda tu firma en «Mi perfil» antes de firmar');
    }
    return firma.imagen;
  }
}

module.exports = new FirmaService();
