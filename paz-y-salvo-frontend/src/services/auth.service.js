import api from './api.js';

// Inicio de sesión con Google Workspace (ID token de Google Identity Services)
export async function login(googleToken) {
  const { data } = await api.post('/auth/login', { googleToken });
  return data;
}

// Inicio de sesión con correo institucional y contraseña
export async function loginWithPassword(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data;
}
