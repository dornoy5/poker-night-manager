import { getAuthHeaders } from './authApi';

const API_URL = import.meta.env.PROD
  ? 'https://poker-night-api.onrender.com/api'
  : 'http://localhost:5000/api';

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function createGame(gameData) {
  const res = await fetch(`${API_URL}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(gameData),
  });
  return handleResponse(res);
}

export async function updateGame(id, gameData) {
  const res = await fetch(`${API_URL}/games/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(gameData),
  });
  return handleResponse(res);
}

export async function getGame(id) {
  const res = await fetch(`${API_URL}/games/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function getAllGames() {
  const res = await fetch(`${API_URL}/games`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function getGroupGames(groupId) {
  const res = await fetch(`${API_URL}/games?groupId=${groupId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function deleteGame(id) {
  const res = await fetch(`${API_URL}/games/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function getPlayerStats() {
  const res = await fetch(`${API_URL}/players`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}
