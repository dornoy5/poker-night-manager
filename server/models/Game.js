const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  totalIn: { type: Number, default: 0 },
  rebuys: [
    {
      amount: Number,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  cashOut: { type: Number, default: null },
  cashOutChips: { type: Number, default: null },
  isActive: { type: Boolean, default: true },
});

const gameSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      enum: ['setup', 'active', 'cashout', 'settled'],
      default: 'setup',
    },
    buyIn: { type: Number, required: true },
    chipsPerBuyIn: { type: Number, required: true },
    currency: { type: String, default: '₪' },
    players: [playerSchema],
    gameStartedAt: { type: Date, default: null },
    settlements: [
      {
        from: String,
        to: String,
        amount: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);