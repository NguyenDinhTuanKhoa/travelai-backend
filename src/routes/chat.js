const express = require('express');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const Itinerary = require('../models/Itinerary');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getIO } = require('../socket');
const router = express.Router();

// Helper: kiểm tra user có phải participant
const isParticipant = (conv, userId) =>
  conv.participants.some(p => p.toString() === userId.toString());

// GET /api/chat/conversations — List hội thoại của user, kèm unreadCount
router.get('/conversations', protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const conversations = await Conversation.find({ participants: myId })
      .populate('participants', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name avatar' }
      })
      .sort({ lastActivity: -1 });

    // Tính unread cho từng conv (message chưa có myId trong readBy & không phải mình gửi)
    const unreadCounts = await Promise.all(
      conversations.map(c =>
        Message.countDocuments({
          conversation: c._id,
          sender: { $ne: myId },
          readBy: { $ne: myId },
        })
      )
    );

    const enriched = conversations.map((c, i) => {
      const obj = c.toObject();
      obj.unreadCount = unreadCounts[i];
      return obj;
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/chat/conversations — Tạo hội thoại mới (direct hoặc group)
router.post('/conversations', protect, async (req, res) => {
  try {
    const { participantIds = [], type = 'direct', name = '' } = req.body;

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu participantIds' });
    }

    const myId = req.user._id.toString();
    const allIds = Array.from(new Set([myId, ...participantIds.map(id => id.toString())]));

    if (type === 'direct') {
      if (allIds.length !== 2) {
        return res.status(400).json({ success: false, message: 'Direct conversation cần đúng 2 người' });
      }

      // Tìm conversation direct đã tồn tại giữa 2 người
      const existing = await Conversation.findOne({
        type: 'direct',
        participants: { $all: allIds, $size: 2 }
      })
        .populate('participants', 'name email avatar')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } });

      if (existing) {
        return res.json({ success: true, data: existing, existed: true });
      }
    } else if (type === 'group') {
      if (allIds.length < 3) {
        return res.status(400).json({ success: false, message: 'Group cần ít nhất 3 người' });
      }
      if (allIds.length > 100) {
        return res.status(400).json({ success: false, message: 'Nhóm tối đa 100 thành viên' });
      }
    }

    const conv = await Conversation.create({
      participants: allIds,
      type,
      name: type === 'group' ? (name || 'Nhóm mới') : '',
      createdBy: req.user._id,
      lastActivity: new Date()
    });

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.status(201).json({ success: true, data: populated, existed: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/chat/conversations/:id/messages?before=<msgId>&limit=30 — Cursor pagination
router.get('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const before = req.query.before;

    const filter = { conversation: conv._id };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const messages = await Message.find(filter)
      .populate('sender', 'name avatar')
      .populate({
        path: 'itineraryId',
        select: 'title description startDate endDate destinations',
        populate: { path: 'destinations.destination', select: 'name images location' }
      })
      .sort({ _id: -1 })
      .limit(limit + 1); // +1 để biết hasMore

    const hasMore = messages.length > limit;
    const slice = hasMore ? messages.slice(0, limit) : messages;
    // Reverse để client nhận theo thứ tự cũ → mới
    const ordered = slice.reverse();

    res.json({ success: true, data: { messages: ordered, hasMore } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/chat/conversations/:id/messages — Gửi message
router.post('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const { type = 'text', content = '', itineraryId } = req.body;

    const conv = await Conversation.findById(req.params.id);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi' });
    }

    if (type === 'text') {
      if (!content.trim()) {
        return res.status(400).json({ success: false, message: 'Nội dung trống' });
      }
    } else if (type === 'image') {
      if (!content || !content.startsWith('data:image/')) {
        return res.status(400).json({ success: false, message: 'Ảnh không hợp lệ' });
      }
      // Giới hạn ~1.5MB base64 (~1.1MB ảnh thật)
      if (content.length > 1_500_000) {
        return res.status(400).json({ success: false, message: 'Ảnh quá lớn (tối đa ~1MB)' });
      }
    } else if (type === 'itinerary_share') {
      if (!itineraryId) {
        return res.status(400).json({ success: false, message: 'Thiếu itineraryId' });
      }
      const itin = await Itinerary.findById(itineraryId);
      if (!itin) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
      }
      if (itin.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Chỉ chia sẻ được lịch trình của mình' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'type không hợp lệ' });
    }

    let savedContent = '';
    if (type === 'text') savedContent = content.trim();
    else if (type === 'image') savedContent = content;

    const message = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      type,
      content: savedContent,
      itineraryId: type === 'itinerary_share' ? itineraryId : undefined,
      readBy: [req.user._id]
    });

    conv.lastMessage = message._id;
    conv.lastActivity = new Date();
    await conv.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate({
        path: 'itineraryId',
        select: 'title description startDate endDate destinations',
        populate: { path: 'destinations.destination', select: 'name images location' }
      });

    // Emit qua socket cho mọi participant
    try {
      const io = getIO();
      if (io) {
        io.to(`conv:${conv._id}`).emit('message_received', populated);
        // Cũng emit conversation_updated để sidebar update lastMessage
        conv.participants.forEach(uid => {
          io.to(`user:${uid}`).emit('conversation_updated', {
            conversationId: conv._id,
            lastMessage: populated,
            lastActivity: conv.lastActivity
          });
        });
      }
    } catch (sockErr) {
      console.warn('[chat] socket emit failed:', sockErr.message);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/chat/conversations/:id/read — Đánh dấu đã đọc toàn bộ messages
router.post('/conversations/:id/read', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await Message.updateMany(
      { conversation: conv._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    try {
      const io = getIO();
      if (io) {
        io.to(`user:${req.user._id}`).emit('conversation_read', {
          conversationId: conv._id.toString(),
        });
      }
    } catch {}

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/chat/conversations/get-or-create-direct — Tiện cho share itinerary
router.post('/conversations/get-or-create-direct', protect, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ success: false, message: 'Thiếu friendId' });
    }

    // Verify they are friends
    const friendship = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requester: req.user._id, recipient: friendId },
        { requester: friendId, recipient: req.user._id }
      ]
    });
    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Hai bạn chưa phải bạn bè' });
    }

    const ids = [req.user._id.toString(), friendId.toString()];
    let conv = await Conversation.findOne({
      type: 'direct',
      participants: { $all: ids, $size: 2 }
    }).populate('participants', 'name email avatar');

    if (!conv) {
      conv = await Conversation.create({
        participants: ids,
        type: 'direct',
        lastActivity: new Date()
      });
      conv = await Conversation.findById(conv._id).populate('participants', 'name email avatar').populate('createdBy', 'name email avatar');
    }

    res.json({ success: true, data: conv });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GROUP MANAGEMENT ──────────────────────────────────────────────────────

// Helper emit cập nhật conversation cho mọi participant
const emitConvUpdate = (conv, populated) => {
  try {
    const io = getIO();
    if (!io) return;
    const payload = { conversationId: conv._id, conversation: populated };
    conv.participants.forEach(uid => {
      io.to(`user:${uid}`).emit('conversation_meta_updated', payload);
    });
  } catch (e) {
    console.warn('[chat] emitConvUpdate failed:', e.message);
  }
};

// PUT /api/chat/conversations/:id — Đổi tên nhóm
router.put('/conversations/:id', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    if (conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Chỉ đổi tên được cho nhóm' });
    }
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const trimmed = (name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'Tên nhóm không được để trống' });
    }

    conv.name = trimmed.substring(0, 80);
    await conv.save();

    const populated = await Conversation.findById(conv._id).populate('participants', 'name email avatar').populate('createdBy', 'name email avatar');
    emitConvUpdate(conv, populated);
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/chat/conversations/:id/members — Thêm thành viên (chỉ group)
router.post('/conversations/:id/members', protect, async (req, res) => {
  try {
    const { userIds = [] } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu userIds' });
    }

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Chỉ thêm được cho nhóm' });
    }
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    // Chỉ cần userId là user thật trong hệ thống và chưa có trong nhóm
    const existingIds = new Set(conv.participants.map(p => p.toString()));
    const candidateIds = userIds.map(id => id.toString()).filter(id => !existingIds.has(id));

    if (candidateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có ai hợp lệ để thêm' });
    }

    const validUsers = await User.find({ _id: { $in: candidateIds } }).select('_id');
    const toAdd = validUsers.map(u => u._id.toString());

    if (toAdd.length === 0) {
      return res.status(400).json({ success: false, message: 'User không tồn tại' });
    }

    if (conv.participants.length + toAdd.length > 100) {
      const remaining = Math.max(0, 100 - conv.participants.length);
      return res.status(400).json({
        success: false,
        message: `Nhóm tối đa 100 thành viên (còn ${remaining} chỗ)`
      });
    }

    conv.participants.push(...toAdd);
    await conv.save();

    const populated = await Conversation.findById(conv._id).populate('participants', 'name email avatar').populate('createdBy', 'name email avatar');
    emitConvUpdate(conv, populated);
    res.json({ success: true, data: populated, added: toAdd.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/chat/conversations/:id/members/:userId — Kick thành viên hoặc tự rời
router.delete('/conversations/:id/members/:userId', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho nhóm' });
    }
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const targetId = req.params.userId.toString();
    const myId = req.user._id.toString();

    // Ai cũng có thể kick (đơn giản) hoặc tự rời. Có thể siết admin sau.
    if (!conv.participants.some(p => p.toString() === targetId)) {
      return res.status(404).json({ success: false, message: 'User không trong nhóm' });
    }

    conv.participants = conv.participants.filter(p => p.toString() !== targetId);

    // Nếu nhóm còn dưới 2 → xoá luôn
    if (conv.participants.length < 2) {
      await Conversation.deleteOne({ _id: conv._id });
      await Message.deleteMany({ conversation: conv._id });
      try {
        const io = getIO();
        if (io) io.to(`conv:${conv._id}`).emit('conversation_deleted', { conversationId: conv._id });
      } catch {}
      return res.json({ success: true, deleted: true });
    }

    await conv.save();
    const populated = await Conversation.findById(conv._id).populate('participants', 'name email avatar').populate('createdBy', 'name email avatar');
    emitConvUpdate(conv, populated);

    // Báo cho người bị kick biết
    try {
      const io = getIO();
      if (io) io.to(`user:${targetId}`).emit('removed_from_conversation', { conversationId: conv._id });
    } catch {}

    res.json({ success: true, data: populated, self: targetId === myId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/chat/conversations/:id/search-users?q= — Tìm user để thêm vào nhóm
router.get('/conversations/:id/search-users', protect, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const excludeIds = [
      req.user._id,
      ...conv.participants.map(p => p.toString()),
    ];

    const baseFilter = { _id: { $nin: excludeIds } };
    let users;
    if (q.length >= 2) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      users = await User.find({ ...baseFilter, $or: [{ name: regex }, { email: regex }] })
        .select('name email avatar')
        .limit(20);
    } else {
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

// GET /api/chat/conversations/:id/media — Danh sách ảnh đã gửi trong nhóm/hội thoại
router.get('/conversations/:id/media', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 60, 200);
    const messages = await Message.find({ conversation: conv._id, type: 'image' })
      .populate('sender', 'name avatar')
      .sort({ _id: -1 })
      .limit(limit);

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/chat/conversations/:id/shared-itineraries — Lịch trình đã chia sẻ
router.get('/conversations/:id/shared-itineraries', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const messages = await Message.find({ conversation: conv._id, type: 'itinerary_share' })
      .populate('sender', 'name avatar')
      .populate({
        path: 'itineraryId',
        select: 'title description startDate endDate destinations',
        populate: { path: 'destinations.destination', select: 'name images location' }
      })
      .sort({ _id: -1 })
      .limit(50);

    // Lọc message có itineraryId vẫn tồn tại
    const valid = messages.filter(m => m.itineraryId);
    res.json({ success: true, data: valid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/chat/conversations/:id/messages — Xoá toàn bộ lịch sử trò chuyện
router.delete('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await Message.deleteMany({ conversation: conv._id });
    conv.lastMessage = undefined;
    conv.lastActivity = new Date();
    await conv.save();

    try {
      const io = getIO();
      if (io) {
        io.to(`conv:${conv._id}`).emit('conversation_cleared', { conversationId: conv._id.toString() });
        conv.participants.forEach(uid => {
          io.to(`user:${uid}`).emit('conversation_cleared', { conversationId: conv._id.toString() });
        });
      }
    } catch {}

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
