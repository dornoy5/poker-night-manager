const API_URL = import.meta.env.PROD
  ? 'https://poker-night-api.onrender.com/api'
  : 'http://localhost:5000/api';

export function getToken() {
  return localStorage.getItem('poker-token');
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function googleLogin(credential) {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  // googleLogin returns { token, user } on success or { error } on failure
  // Don't throw — let the caller check data.token
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function getGroups() {
  const res = await fetch(`${API_URL}/groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function createGroup(name) {
  const res = await fetch(`${API_URL}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ name }),
  });
  return handleResponse(res);
}

export async function joinGroup(code) {
  const res = await fetch(`${API_URL}/groups/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ code }),
  });
  // Return raw so callers can check group._id vs error
  return res.json();
}

export async function getGroup(id) {
  const res = await fetch(`${API_URL}/groups/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}