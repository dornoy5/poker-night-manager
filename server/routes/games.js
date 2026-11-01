const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth, isMemberOf, isManagerOf } = require('../middleware/auth');

// The only fields a client may set on a game. Everything else (createdBy, groupId, rev) is server-owned.
const EDITABLE_FIELDS = ['phase', 'buyIn', 'chipsPerBuyIn', 'currency', 'players', 'gameStartedAt', 'settlements'];
const MAX_PLAYERS = 50;

function pickEditable(body) {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function validate(fields) {
  if (fields.players !== undefined) {
    if (!Array.isArray(fields.players)) return 'Players must be a list';
    if (fields.players.length > MAX_PLAYERS) return `At most ${MAX_PLAYERS} players`;
  }
  if (fields.buyIn !== undefined && !(Number(fields.buyIn) > 0)) return 'Buy-in must be above 0';
  if (fields.chipsPerBuyIn !== undefined && !(Number(fields.chipsPerBuyIn) > 0)) return 'Chips per buy-in must be above 0';
  return null;
}

// Tell every linked player (except whoever started it) that the game is on, so their phone opens it
async function notifyGameStarted(req, game) {
  const io = req.app.get('io');
  const userSocketMap = req.app.get('userSocketMap');
  if (!io) return;

  const group = await Group.findById(game.groupId).select('name');
  const payload = {
    gameId: game._id.toString(),
    groupId: game.groupId.toString(),
    groupName: group ? group.name : '',
  };
  (game.players || [])
    .filter((p) => p.userId && p.userId.toString() !== req.userId)
    .forEach((p) => {
      const sockets = userSocketMap.get(p.userId.toString());
      if (sockets) sockets.forEach((socketId) => io.to(socketId).emit('game-started', payload));
    });
}

// A player linked to an account always shows that account's current name, so a phone
// still holding an old name can't put it back into the game. Who-pays-whom uses names
// too, so those follow the same renames.
async function useProfileNames(fields) {
  const players = fields.players;
  if (!Array.isArray(players)) return;
  const ids = players.filter((p) => p && p.userId).map((p) => String(p.userId));
  if (!ids.length) return;
  const users = await User.find({ _id: { $in: ids } }).select('name');
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  const renamed = new Map();
  players.forEach((p) => {
    const current = p && p.userId && names.get(String(p.userId));
    if (current && current !== p.name) {
      renamed.set(p.name, current);
      p.name = current;
    }
  });
  if (renamed.size && Array.isArray(fields.settlements)) {
    fields.settlements.forEach((s) => {
      if (renamed.has(s.from)) s.from = renamed.get(s.from);
      if (renamed.has(s.to)) s.to = renamed.get(s.to);
    });
  }
}

function isCreator(game, userId) {
  return game.createdBy && game.createdBy.toString() === userId;
}

// Can see a game: its creator or any member of its group
async function canView(game, userId) {
  if (isCreator(game, userId)) return true;
  if (!game.groupId) return false;
  const group = await Group.findById(game.groupId);
  return !!group && isMemberOf(group, userId);
}

// Can change a game: its creator or any manager of its group
async function canEdit(game, userId) {
  if (isCreator(game, userId)) return true;
  if (!game.groupId) return false;
  const group = await Group.findById(game.groupId);
  return !!group && isManagerOf(group, userId);
}

// Create a new game (any member of the group)
router.post('/', auth, async (req, res) => {
  try {
    const group = req.body.groupId ? await Group.findById(req.body.groupId) : null;
    if (!group) return res.status(400).json({ error: 'A valid group is required' });
    if (!isMemberOf(group, req.userId)) return res.status(403).json({ error: 'Not a member of this group' });

    const fields = pickEditable(req.body);
    const invalid = validate(fields);
    if (invalid) return res.status(400).json({ error: invalid });
    await useProfileNames(fields);

    const game = new Game({ ...fields, groupId: group._id, createdBy: req.userId, rev: 0 });
    const saved = await game.save();
    if (saved.phase === 'active') await notifyGameStarted(req, saved);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get games: filter by groupId if provided, otherwise all games the user created
router.get('/', auth, async (req, res) => {
  try {
    if (req.query.groupId) {
      const group = await Group.findById(req.query.groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (!isMemberOf(group, req.userId)) return res.status(403).json({ error: 'Not authorized' });
    }

    const filter = req.query.groupId
      ? { groupId: req.query.groupId }
      : { createdBy: req.userId };
    const games = await Game.find(filter).sort({ createdAt: -1 });
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single game (creator or group members)
router.get('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!(await canView(game, req.userId))) return res.status(403).json({ error: 'Not authorized' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update game state (creator or group managers).
// The client sends the `rev` it last saw; if someone else saved in between we answer 409
// with the current game, so two managers never silently overwrite each other.
router.put('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!(await canEdit(game, req.userId))) return res.status(403).json({ error: 'Not authorized' });
    if (game.phase === 'settled') return res.status(409).json({ error: 'This game is already finished', game });

    const fields = pickEditable(req.body);
    const invalid = validate(fields);
    if (invalid) return res.status(400).json({ error: invalid });
    await useProfileNames(fields);

    const currentRev = game.rev || 0;
    if (req.body.rev !== undefined && Number(req.body.rev) !== currentRev) {
      return res.status(409).json({ error: 'Someone else changed this game', game });
    }

    const revFilter = currentRev === 0 ? { $in: [0, null] } : currentRev;
    const updated = await Game.findOneAndUpdate(
      { _id: game._id, rev: revFilter },
      { $set: { ...fields, rev: currentRev + 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      const latest = await Game.findById(game._id);
      return res.status(409).json({ error: 'Someone else changed this game', game: latest });
    }

    // Broadcast updated game state to all clients in this game's room
    const io = req.app.get('io');
    if (io) io.to(req.params.id).emit('game-updated', updated);
    if (fields.phase === 'active' && game.phase === 'setup') await notifyGameStarted(req, updated);

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a game (creator or group managers)
router.delete('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!(await canEdit(game, req.userId))) return res.status(403).json({ error: 'Not authorized' });
    await Game.findByIdAndDelete(req.params.id);
    res.json({ message: 'Game deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
