const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Google sign-in users have googleId + email; phone users have phoneNumber + pinHash.
    // sparse: many users may lack one of them without clashing on the unique index.
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    name: { type: String, required: true }, // what the group sees: first + last name
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    picture: { type: String, default: '' },
    phone: { type: String, default: '' },

    authType: { type: String, enum: ['google', 'phone'], default: 'google' },
    phoneNumber: { type: String, unique: true, sparse: true }, // normalized, e.g. +972501234567
    pinHash: { type: String, default: null },
    pinFailures: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
    // A group manager reset the PIN: the next sign-in with this number sets a new one
    pinResetUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
