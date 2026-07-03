const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');

let io = null;

function initSocket(httpServer) {
  // CORS allowlist từ env CLIENT_URL (phân cách bằng dấu phẩy), đồng nhất với server.js.
  // Chưa set → fallback localhost cho dev.
  const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0
        ? allowedOrigins
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true
    }
  });

  // JWT handshake middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name');
      if (!user) return next(new Error('User not found'));
      socket.userId = user._id.toString();
      socket.userName = user.name;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    // Auto join user room (for targeted push)
    socket.join(`user:${socket.userId}`);

    socket.on('join_conversation', async (conversationId) => {
      try {
        if (!conversationId) return;
        const conv = await Conversation.findById(conversationId).select('participants');
        if (!conv) return;
        const isMember = conv.participants.some(p => p.toString() === socket.userId);
        if (!isMember) return;
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        console.warn('[socket] join_conversation error:', err.message);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });

    socket.on('disconnect', () => {
      // Rooms cleanup auto
    });
  });

  console.log('[socket] Socket.io initialized');
  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
