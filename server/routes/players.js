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

// Get players with lifetime stats — scoped to groups the user belongs to
router.get('/', auth, async (req, res) => {
  try {
    // Only aggregate stats from groups the user is a member of
    const userGroups = await Group.find({ members: req.userId }).select('_id');
    const groupIds = userGroups.map((g) => g._id);
    const games = await Game.find({ phase: 'settled', groupId: { $in: groupIds } });

    const playerStats = {};

    games.forEach((game) => {
      game.players.forEach((player) => {
        if (!playerStats[player.name]) {
          playerStats[player.name] = {
            name: player.name,
            gamesPlayed: 0,
            totalWon: 0,
            totalLost: 0,
            totalRebuys: 0,
            bestGame: 0,
            worstGame: 0,
          };
        }

        const stats = playerStats[player.name];
        const profit = (player.cashOut || 0) - player.totalIn;

        stats.gamesPlayed += 1;

        if (profit > 0) {
          stats.totalWon += profit;
        } else {
          stats.totalLost += Math.abs(profit);
        }

        stats.totalRebuys += player.rebuys.length;

        if (profit > stats.bestGame) stats.bestGame = profit;
        if (profit < stats.worstGame) stats.worstGame = profit;
      });
    });

    const result = Object.values(playerStats).map((s) => ({
      ...s,
      netProfit: s.totalWon - s.totalLost,
    }));

    result.sort((a, b) => b.netProfit - a.netProfit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;