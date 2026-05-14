'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { SECRET } = require('./middleware/auth');
const { canMessage } = require('./middleware/roles');

// Map: userId → Set of socket IDs
const userSockets = new Map();

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // JWT authentication for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      socket.user = jwt.verify(token, SECRET);
      next();
    } catch (_) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;

    // Track socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });

    // send_message event
    socket.on('send_message', ({ recipientId, body }, callback) => {
      if (!body || !body.trim()) {
        return callback && callback({ error: 'Empty message' });
      }
      if (recipientId === userId) {
        return callback && callback({ error: 'Cannot message yourself' });
      }

      const recipient = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(recipientId);
      if (!recipient || !recipient.is_active) {
        return callback && callback({ error: 'User not found' });
      }

      if (!canMessage(socket.user.role, recipient.role)) {
        return callback && callback({ error: 'Not permitted to message this user' });
      }

      const result = db.prepare(
        'INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)'
      ).run(userId, recipientId, body.trim());

      const message = db.prepare(`
        SELECT m.*, u.username AS sender_username, u.display_name AS sender_display
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

      // Deliver to recipient's room (all their sockets)
      io.to(`user:${recipientId}`).emit('new_message', message);

      // Echo back to sender
      io.to(`user:${userId}`).emit('new_message', message);

      callback && callback({ ok: true, message });
    });

    // mark_read event
    socket.on('mark_read', ({ partnerId }) => {
      db.prepare(`
        UPDATE messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
      `).run(partnerId, userId);

      // Notify partner that messages were read
      io.to(`user:${partnerId}`).emit('messages_read', { by: userId });
    });

    // typing indicator
    socket.on('typing', ({ recipientId, isTyping }) => {
      io.to(`user:${recipientId}`).emit('typing', { from: userId, isTyping });
    });
  });

  return io;
}

module.exports = { setupSocket };
