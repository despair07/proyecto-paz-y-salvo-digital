import api from './api.js';

// Inicio de sesión con Google Workspace (ID token de Google Identity Services)
export async function login(googleToken) {
  const { data } = await api.post('/auth/login', { googleToken });
  return data;
}

// Solo desarrollo (VITE_ENABLE_PASSWORD_LOGIN): correo y contraseña de los usuarios del seed
export async function loginWithPassword(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Elegir (primera vez) o cambiar el tipo de vinculación. Cambiarlo exige confirmar=true.
export async function updateTipoVinculacion(tipo, confirmar = false) {
  const { data } = await api.put('/auth/tipo-vinculacion', { tipo, confirmar });
  return data;
}
