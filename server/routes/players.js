const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Get all players with lifetime stats
router.get('/', async (req, res) => {
  try {
    const games = await Game.find({ phase: 'settled' });

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