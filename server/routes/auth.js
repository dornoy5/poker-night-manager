const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');
const { normalizePhone, isValidPin, hashPin, checkPin, lockAfterFailure, rateLimit } = require('../utils/phoneAuth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    phone: user.phone,
    phoneNumber: user.phoneNumber,
    authType: user.authType,
  };
}

function issueToken(user) {
  return jwt.sign(
    { userId: user._id, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Google login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, name, email, picture } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      user = new User({ googleId, name, email, picture, authType: 'google' });
      await user.save();
    } else {
      user.name = name;
      user.picture = picture;
      await user.save();
    }

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// New account with a name, phone number and 4-digit PIN (no SMS)
router.post('/phone/register', rateLimit, async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phoneNumber = normalizePhone(req.body.phone);
    const { pin } = req.body;

    if (!name || name.length > 40) return res.status(400).json({ error: 'Enter your name (up to 40 letters).' });
    if (!phoneNumber) return res.status(400).json({ error: 'Enter a valid phone number, like 050-123-4567.' });
    if (!isValidPin(pin)) return res.status(400).json({ error: 'Pick a PIN of exactly 4 digits.' });

    if (await User.findOne({ phoneNumber })) {
      return res.status(409).json({ error: 'This number already has an account. Sign in with your PIN instead.' });
    }

    const user = await User.create({ name, phoneNumber, pinHash: hashPin(pin), authType: 'phone' });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    // Only a clash on the phone number means "already registered"; a clash on email/googleId
    // means the old unique indexes were not made sparse (see syncIndexes in server.js)
    if (err.code === 11000 && err.keyPattern?.phoneNumber) {
      return res.status(409).json({ error: 'This number already has an account. Sign in with your PIN instead.' });
    }
    console.error('Phone register error:', err);
    res.status(500).json({ error: 'Could not create the account. Try again.' });
  }
});

// Sign in with phone number + PIN
router.post('/phone/login', rateLimit, async (req, res) => {
  try {
    const phoneNumber = normalizePhone(req.body.phone);
    const { pin } = req.body;
    // One message for "no such number" and "wrong PIN", so nobody can test which numbers exist
    const wrong = () => res.status(401).json({ error: 'Wrong phone number or PIN.' });

    if (!phoneNumber || !isValidPin(pin)) return wrong();
    const user = await User.findOne({ phoneNumber });
    if (!user) return wrong();

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      return res.status(429).json({ error: 'Too many wrong PINs. Try again later, or ask your group manager to reset your PIN.' });
    }

    // A manager reset this PIN: the PIN typed now becomes the new one
    if (!user.pinHash && user.pinResetUntil && user.pinResetUntil > new Date()) {
      user.pinHash = hashPin(pin);
      user.pinResetUntil = null;
      user.pinFailures = 0;
      user.pinLockedUntil = null;
      await user.save();
      return res.json({ token: issueToken(user), user: publicUser(user), pinWasReset: true });
    }

    if (!checkPin(pin, user.pinHash)) {
      lockAfterFailure(user);
      await user.save();
      return wrong();
    }

    user.pinFailures = 0;
    user.pinLockedUntil = null;
    await user.save();
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Phone login error:', err);
    res.status(500).json({ error: 'Could not sign in. Try again.' });
  }
});

// Verify token and get user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(publicUser(user));
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
