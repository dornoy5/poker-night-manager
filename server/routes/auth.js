const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Game = require('../models/Game');
const { JWT_SECRET, auth } = require('../middleware/auth');
const { normalizePhone, isValidPin, hashPin, checkPin, lockAfterFailure, rateLimit } = require('../utils/phoneAuth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Accounts made before first/last names existed only have one name: split it at the first space
function splitName(name) {
  const clean = (name || '').trim();
  if (!clean || clean.includes('@')) return { firstName: '', lastName: '' };
  const [firstName, ...rest] = clean.split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

function cleanPart(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function publicUser(user) {
  const parts = user.firstName ? { firstName: user.firstName, lastName: user.lastName || '' } : splitName(user.name);
  return {
    _id: user._id,
    name: user.name,
    firstName: parts.firstName,
    lastName: parts.lastName,
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
    const { sub: googleId, email, picture } = payload;
    const firstName = cleanPart(payload.given_name).slice(0, 30);
    const lastName = cleanPart(payload.family_name).slice(0, 30);
    // Some Google accounts have no name, only an email: fall back to the part of the
    // email before the @ (the app then asks for a real name)
    const name = ([firstName, lastName].filter(Boolean).join(' ') || cleanPart(payload.name) || (email || '').split('@')[0] || 'Player').slice(0, 61);

    // Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      user = new User({ googleId, name, firstName, lastName, email, picture, authType: 'google' });
      await user.save();
    } else {
      // The name is the user's own choice (profile), so Google never overwrites it,
      // except an email address saved as the name by old sign-ins when Google now has a real one
      user.picture = picture;
      await user.save();
      if (user.name.includes('@') && firstName) {
        await renameUser(req, user, firstName, lastName); // a clash leaves it; the app then asks
      }
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

    const user = await User.create({ name, ...splitName(name), phoneNumber, pinHash: hashPin(pin), authType: 'phone' });
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

// Change your own name. It shows everywhere you appear: groups, running games, history, stats.
router.patch('/me', auth, async (req, res) => {
  try {
    const firstName = cleanPart(req.body.firstName);
    const lastName = cleanPart(req.body.lastName);
    if (!firstName || firstName.length > 30) return res.status(400).json({ error: 'Your first name must be 1 to 30 letters.' });
    if (lastName.length > 30) return res.status(400).json({ error: 'Your last name can be up to 30 letters.' });
    if ((firstName + lastName).includes('@')) return res.status(400).json({ error: 'That looks like an email. Use your name instead.' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = await renameUser(req, user, firstName, lastName);
    if (result.clash) return res.status(409).json({ error: 'Someone in your running game already has that name. Add your last name or pick another one.' });
    res.json(publicUser(user));
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Could not save your name. Try again.' });
  }
});

// Saves a new first/last name and carries the full name into every game the user played,
// so history, stats and who-pays-whom stay in one place
async function renameUser(req, user, firstName, lastName) {
  const oldName = user.name;
  const name = [firstName, lastName].filter(Boolean).join(' ');

  // Names identify players in a game's money split, so two players in one running game can't share a name
  const games = name === oldName ? [] : await Game.find({ 'players.userId': user._id });
  const clash = games.find((g) => g.phase !== 'settled' && g.players.some(
    (p) => p.name.toLowerCase() === name.toLowerCase() && String(p.userId) !== String(user._id)
  ));
  if (clash) return { clash: true };

  user.name = name;
  user.firstName = firstName;
  user.lastName = lastName;
  await user.save();

  const io = req.app.get('io');
  for (const game of games) {
    game.players.forEach((p) => {
      if (String(p.userId) === String(user._id)) p.name = name;
    });
    (game.settlements || []).forEach((s) => {
      if (s.from === oldName) s.from = name;
      if (s.to === oldName) s.to = name;
    });
    if (game.phase !== 'settled') game.rev = (game.rev || 0) + 1;
    await game.save();
    if (io && game.phase !== 'settled') io.to(String(game._id)).emit('game-updated', game);
  }
  return { clash: false };
}

// Change your PIN (phone accounts): needs the current PIN
router.post('/me/pin', auth, rateLimit, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    const user = await User.findById(req.userId);
    if (!user || user.authType !== 'phone') return res.status(400).json({ error: 'Only phone accounts have a PIN.' });
    if (!isValidPin(newPin)) return res.status(400).json({ error: 'The new PIN must be exactly 4 digits.' });
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      return res.status(429).json({ error: 'Too many wrong PINs. Try again later.' });
    }
    if (!checkPin(currentPin, user.pinHash)) {
      lockAfterFailure(user);
      await user.save();
      return res.status(401).json({ error: 'Your current PIN is wrong.' });
    }
    user.pinHash = hashPin(newPin);
    user.pinFailures = 0;
    user.pinLockedUntil = null;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('PIN change error:', err);
    res.status(500).json({ error: 'Could not change your PIN. Try again.' });
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
