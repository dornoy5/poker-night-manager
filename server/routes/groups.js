const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Group = require('../models/Group');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'poker-night-secret-key';

// Middleware to verify token
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

// Generate a random group code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a group
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    let code = generateCode();

    // Make sure code is unique
    while (await Group.findOne({ code })) {
      code = generateCode();
    }

    const group = new Group({
      name,
      code,
      manager: req.userId,
      members: [req.userId],
    });

    await group.save();
    await group.populate('manager members', 'name email picture');

    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all groups for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('manager', 'name email picture')
      .populate('members', 'name email picture')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a group by code
router.post('/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    const group = await Group.findOne({ code: code.toUpperCase() });

    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.members.includes(req.userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    group.members.push(req.userId);
    await group.save();
    await group.populate('manager members', 'name email picture');

    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single group
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('manager', 'name email picture')
      .populate('members', 'name email picture');

    if (!group) return res.status(404).json({ error: 'Group not found' });

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a member (manager only)
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.manager.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only the manager can remove members' });
    }
    if (req.params.memberId === req.userId) {
      return res.status(400).json({ error: 'Manager cannot remove themselves' });
    }

    group.members = group.members.filter(
      (m) => m.toString() !== req.params.memberId
    );
    await group.save();
    await group.populate('manager members', 'name email picture');

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;