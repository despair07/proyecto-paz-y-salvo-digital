// Mensaje legible de un error de Axios: el del backend si lo hay, o uno claro si no hubo respuesta
export function mensajeError(err, fallback = 'Ocurrió un error. Intenta de nuevo.') {
  if (err?.response?.data?.mensaje) return err.response.data.mensaje;
  if (err?.response) return `${fallback} (código ${err.response.status})`;
  if (err?.request) return 'No se pudo comunicar con el servidor. Verifica tu conexión.';
  return fallback;
}

export function formatearFecha(valor, { hora = false } = {}) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-CO', hora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

// Los campos de fecha de la API vienen como ISO; los <input type="date"> necesitan AAAA-MM-DD
export function aInputFecha(valor) {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}
