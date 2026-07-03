const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/friends/search?q=... — Tìm user theo name/email, loại trừ chính mình + bạn đã có quan hệ
// Nếu q rỗng → trả về danh sách gợi ý (tối đa 20 user mới nhất chưa kết nối)
router.get('/search', protect, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const myId = req.user._id;

    // Lấy danh sách userId đã có quan hệ (pending/accepted/blocked)
    const existing = await Friendship.find({
      $or: [{ requester: myId }, { recipient: myId }]
    }).select('requester recipient status');

    const relatedIds = new Set();
    for (const f of existing) {
      relatedIds.add(f.requester.toString());
      relatedIds.add(f.recipient.toString());
    }
    relatedIds.add(myId.toString());

    const baseFilter = {
      _id: { $nin: Array.from(relatedIds).map(id => new mongoose.Types.ObjectId(id)) },
    };

    let users;
    if (q.length >= 2) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      users = await User.find({
        ...baseFilter,
        $or: [{ name: regex }, { email: regex }]
      }).select('name email avatar').limit(20);
    } else {
      // Gợi ý: user mới nhất chưa kết nối
      users = await User.find(baseFilter)
        .select('name email avatar')
        .sort({ createdAt: -1 })
        .limit(20);
    }

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/friends — Danh sách bạn (status=accepted)
router.get('/', protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const friendships = await Friendship.find({
      status: 'accepted',
      $or: [{ requester: myId }, { recipient: myId }]
    })
      .populate('requester', 'name email avatar')
      .populate('recipient', 'name email avatar')
      .sort({ updatedAt: -1 });

    const friends = friendships.map(f => {
      const friend = f.requester._id.toString() === myId.toString() ? f.recipient : f.requester;
      return {
        friendshipId: f._id,
        _id: friend._id,
        name: friend.name,
        email: friend.email,
        avatar: friend.avatar,
        since: f.updatedAt
      };
    });

    res.json({ success: true, data: friends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/friends/requests — Lời mời pending (đến + đi)
router.get('/requests', protect, async (req, res) => {
  try {
    const myId = req.user._id;

    const incoming = await Friendship.find({ recipient: myId, status: 'pending' })
      .populate('requester', 'name email avatar')
      .sort({ createdAt: -1 });

    const outgoing = await Friendship.find({ requester: myId, status: 'pending' })
      .populate('recipient', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        incoming: incoming.map(f => ({
          friendshipId: f._id,
          _id: f.requester._id,
          name: f.requester.name,
          email: f.requester.email,
          avatar: f.requester.avatar,
          createdAt: f.createdAt
        })),
        outgoing: outgoing.map(f => ({
          friendshipId: f._id,
          _id: f.recipient._id,
          name: f.recipient.name,
          email: f.recipient.email,
          avatar: f.recipient.avatar,
          createdAt: f.createdAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/friends/request — Gửi lời mời
router.post('/request', protect, async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Thiếu recipientId' });
    }
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Không thể tự gửi lời mời cho chính mình' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    const existing = await Friendship.findOne({
      $or: [
        { requester: req.user._id, recipient: recipientId },
        { requester: recipientId, recipient: req.user._id }
      ]
    });

    if (existing) {
      const msg = existing.status === 'accepted'
        ? 'Hai bạn đã là bạn bè'
        : existing.status === 'pending'
        ? 'Đã có lời mời đang chờ phản hồi'
        : 'Đã có quan hệ trước đó';
      return res.status(400).json({ success: false, message: msg });
    }

    const friendship = await Friendship.create({
      requester: req.user._id,
      recipient: recipientId,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: friendship });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/friends/respond — Chấp nhận / từ chối
router.put('/respond', protect, async (req, res) => {
  try {
    const { friendshipId, action } = req.body;
    if (!friendshipId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Thiếu friendshipId hoặc action không hợp lệ' });
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời' });
    }

    if (friendship.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền phản hồi lời mời này' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Lời mời đã được xử lý' });
    }

    friendship.status = action === 'accept' ? 'accepted' : 'rejected';
    await friendship.save();

    res.json({ success: true, data: friendship });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/friends/:friendshipId — Huỷ kết bạn / huỷ lời mời đi
router.delete('/:friendshipId', protect, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.friendshipId);
    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    }

    const myId = req.user._id.toString();
    if (friendship.requester.toString() !== myId && friendship.recipient.toString() !== myId) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await Friendship.deleteOne({ _id: friendship._id });
    res.json({ success: true, message: 'Đã xoá' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
