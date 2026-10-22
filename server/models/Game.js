const mongoose = require('mongoose');
const { Schema } = mongoose;

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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
  // Cashed out before the end of the night
  leftEarly: { type: Boolean, default: false },
  // Share of missing (or extra) chip money added to cashOut when the count didn't match
  adjustment: { type: Number, default: 0 },
});

const gameSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      enum: ['setup', 'active', 'cashout', 'reviewing', 'settled'],
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    // Bumped on every save; lets the server refuse an update based on stale data
    rev: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);