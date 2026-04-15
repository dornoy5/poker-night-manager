const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Game = require('../models/Game');
const Group = require('../models/Group');

const JWT_SECRET = process.env.JWT_SECRET || 'poker-night-secret-key';

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Create a new game
router.post('/', auth, async (req, res) => {
  try {
    const game = new Game({ ...req.body, createdBy: req.userId });
    const saved = await game.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get games — filter by groupId if provided, otherwise all games for the user
router.get('/', auth, async (req, res) => {
  try {
    if (req.query.groupId) {
      // Verify the requesting user is a member of that group
      const group = await Group.findById(req.query.groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const isMember = group.members.some((m) => m.toString() === req.userId);
      if (!isMember) return res.status(403).json({ error: 'Not authorized' });
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

// Get single game (auth required, no ownership check — allows sharing a game link)
router.get('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update game state (owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.createdBy && game.createdBy.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const updated = await Game.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');

    if (io) {
      // Broadcast updated game state to all clients in this game's room
      io.to(req.params.id).emit('game-updated', updated);

      // If game just transitioned to active, notify selected players
      if (req.body.phase === 'active' && game.phase !== 'active') {
        const playerUserIds = (req.body.players || [])
          .filter((p) => p.userId && p.userId.toString() !== req.userId)
          .map((p) => p.userId.toString());

        // Fetch group name for the notification payload
        const Group = require('../models/Group');
        const group = await Group.findById(updated.groupId).select('name');
        const groupName = group ? group.name : '';

        playerUserIds.forEach((userId) => {
          const sockets = userSocketMap.get(userId);
          if (sockets) {
            sockets.forEach((socketId) => {
              io.to(socketId).emit('game-started', {
                gameId: updated._id.toString(),
                groupId: updated.groupId.toString(),
                groupName,
              });
            });
          }
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a game (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.createdBy && game.createdBy.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await Game.findByIdAndDelete(req.params.id);
    res.json({ message: 'Game deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
