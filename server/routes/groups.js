const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Game = require('../models/Game');
const { auth, isMemberOf, isManagerOf } = require('../middleware/auth');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const POPULATE_FIELDS = 'name email picture';

// Create a group
router.post('/', auth, async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 60) return res.status(400).json({ error: 'Group name must be 1-60 characters' });
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
    if (typeof code !== 'string') return res.status(400).json({ error: 'Code is required' });
    const group = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (isMemberOf(group, req.userId)) {
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
    if (!isMemberOf(group, req.userId)) return res.status(403).json({ error: 'Not a member of this group' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a group and all its games (the group's creator only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.manager.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only the group creator can delete this group' });
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
    if (group.manager.toString() === req.params.memberId) {
      return res.status(400).json({ error: 'The group creator cannot be removed' });
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
    if (group.manager.toString() === req.params.memberId) {
      return res.status(400).json({ error: 'The group creator is always a manager' });
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
