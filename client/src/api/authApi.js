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

// Phone sign-in: both return { token, user } on success or { error } on failure
export async function phoneRegister(name, phone, pin) {
  const res = await fetch(`${API_URL}/auth/phone/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, pin }),
  });
  return res.json();
}

export async function phoneLogin(phone, pin) {
  const res = await fetch(`${API_URL}/auth/phone/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin }),
  });
  return res.json();
}

export async function resetMemberPin(groupId, memberId) {
  const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}/reset-pin`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function updateProfile(firstName, lastName) {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ firstName, lastName }),
  });
  return handleResponse(res);
}

export async function changePin(currentPin, newPin) {
  const res = await fetch(`${API_URL}/auth/me/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ currentPin, newPin }),
  });
  return handleResponse(res);
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

export async function leaveGroup(id) {
  const res = await fetch(`${API_URL}/groups/${id}/leave`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function deleteGroup(id) {
  const res = await fetch(`${API_URL}/groups/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function promoteToManager(groupId, memberId) {
  const res = await fetch(`${API_URL}/groups/${groupId}/managers/${memberId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function demoteManager(groupId, memberId) {
  const res = await fetch(`${API_URL}/groups/${groupId}/managers/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function removeMember(groupId, memberId) {
  const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}