const crypto = require('crypto');

// Turn what people type ("050-123 4567", "+972 50...", "00972...") into one form: +972501234567.
// Numbers starting with a single 0 are taken as Israeli local numbers.
function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^0\d{8,9}$/.test(s)) s = '+972' + s.slice(1);
  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}

function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPin(pin, stored) {
  if (!stored || !pin) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// After 5 wrong PINs the account waits 15 minutes; from 10 in a row, a full day.
// That keeps guessing a 4-digit PIN impractical.
function lockAfterFailure(user) {
  user.pinFailures = (user.pinFailures || 0) + 1;
  if (user.pinFailures >= 10) {
    user.pinLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (user.pinFailures % 5 === 0) {
    user.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
}

// Simple per-IP limit for the phone sign-in endpoints (in memory, per server instance)
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 30;

function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  }
  next();
}

module.exports = { normalizePhone, isValidPin, hashPin, checkPin, lockAfterFailure, rateLimit };
