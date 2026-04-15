const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Group = require('../models/Group');
const Game = require('../models/Game');

const JWT_SECRET = process.env.JWT_SECRET || 'poker-night-secret-key';

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

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function isManagerOf(group, userId) {
  const inManagers = (group.managers || []).some((m) => m.toString() === userId);
  const isOriginal = group.manager.toString() === userId;
  return inManagers || isOriginal;
}

const POPULATE_FIELDS = 'name email picture';

// Create a group
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    let code = generateCode();
    while (await Group.findOne({ code })) code = generateCode();

    const group = new Group({
      name,
      code,
      manager: req.userId,
      managers: [req.userId],
      members: [req.userId],
    });

    await group.save();
    await group.populate('manager managers members', POPULATE_FIELDS);
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all groups for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('manager managers members', POPULATE_FIELDS)
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
    await group.populate('manager managers members', POPULATE_FIELDS);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single group
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('manager managers members', POPULATE_FIELDS);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a group (any manager)
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isManagerOf(group, req.userId)) {
      return res.status(403).json({ error: 'Only managers can delete this group' });
    }
    await Game.deleteMany({ groupId: group._id });
    await group.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a group (any member including managers)
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.map((m) => m.toString()).includes(req.userId);
    if (!isMember) return res.status(400).json({ error: 'Not a member' });

    group.members = group.members.filter((m) => m.toString() !== req.userId);
    group.managers = (group.managers || []).filter((m) => m.toString() !== req.userId);
    await group.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a member (any manager)
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isManagerOf(group, req.userId)) {
      return res.status(403).json({ error: 'Only managers can remove members' });
    }
    group.members = group.members.filter((m) => m.toString() !== req.params.memberId);
    group.managers = (group.managers || []).filter((m) => m.toString() !== req.params.memberId);
    await group.save();
    await group.populate('manager managers members', POPULATE_FIELDS);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promote a member to manager (any manager)
router.post('/:id/managers/:memberId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isManagerOf(group, req.userId)) {
      return res.status(403).json({ error: 'Only managers can promote members' });
    }

    const isMember = group.members.map((m) => m.toString()).includes(req.params.memberId);
    if (!isMember) return res.status(400).json({ error: 'User is not a member' });

    const alreadyManager = (group.managers || []).map((m) => m.toString()).includes(req.params.memberId);
    if (alreadyManager) return res.status(400).json({ error: 'Already a manager' });

    group.managers = [...(group.managers || []), req.params.memberId];
    await group.save();
    await group.populate('manager managers members', POPULATE_FIELDS);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demote a manager (any manager)
router.delete('/:id/managers/:memberId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isManagerOf(group, req.userId)) {
      return res.status(403).json({ error: 'Only managers can demote others' });
    }
    group.managers = (group.managers || []).filter((m) => m.toString() !== req.params.memberId);
    await group.save();
    await group.populate('manager managers members', POPULATE_FIELDS);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
