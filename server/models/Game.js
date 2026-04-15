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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);