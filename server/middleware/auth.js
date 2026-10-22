const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Never fall back to a fixed secret: anyone who reads the repo could forge a login.
// Without JWT_SECRET we use a random one per boot (logins reset on every restart).
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('WARNING: JWT_SECRET is not set. Using a random secret; everyone is logged out on restart.');
}

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

function isMemberOf(group, userId) {
  return group.members.some((m) => (m._id || m).toString() === userId);
}

function isManagerOf(group, userId) {
  const inManagers = (group.managers || []).some((m) => (m._id || m).toString() === userId);
  const isOriginal = (group.manager?._id || group.manager)?.toString() === userId;
  return inManagers || isOriginal;
}

module.exports = { auth, JWT_SECRET, isMemberOf, isManagerOf };
