import api from './api.js';

export async function login(correo, password) {
  const { data } = await api.post('/auth/login', { correo, password });
  return data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data;
}
