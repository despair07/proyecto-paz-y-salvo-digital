import api from './api.js';

export async function getCatalog() {
  const { data } = await api.get('/requests/catalog');
  return data;
}

export async function getMine() {
  const { data } = await api.get('/requests/mine');
  return data;
}

export async function createMine() {
  const { data } = await api.post('/requests/mine');
  return data;
}

export async function getAllRequests() {
  const { data } = await api.get('/requests');
  return data;
}

export async function getRequest(id) {
  const { data } = await api.get(`/requests/${id}`);
  return data;
}

export async function approveRequest(id, observaciones) {
  const { data } = await api.patch(`/requests/${id}/approve`, { observaciones });
  return data;
}

export async function getUsers() {
  const { data } = await api.get('/admin/users');
  return data;
}
