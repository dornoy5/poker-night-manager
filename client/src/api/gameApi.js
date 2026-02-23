const API_URL = 'http://localhost:5000/api';

export async function createGame(gameData) {
  const res = await fetch(`${API_URL}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData),
  });
  return res.json();
}

export async function updateGame(id, gameData) {
  const res = await fetch(`${API_URL}/games/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData),
  });
  return res.json();
}

export async function getGame(id) {
  const res = await fetch(`${API_URL}/games/${id}`);
  return res.json();
}

export async function getAllGames() {
  const res = await fetch(`${API_URL}/games`);
  return res.json();
}

export async function deleteGame(id) {
  const res = await fetch(`${API_URL}/games/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function getPlayerStats() {
  const res = await fetch(`${API_URL}/players`);
  return res.json();
}