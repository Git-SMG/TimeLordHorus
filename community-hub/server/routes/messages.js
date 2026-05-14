'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { canMessage } = require('../middleware/roles');

const router = express.Router();

// GET /api/messages/conversations  — list conversation threads for current user
router.get('/conversations', requireAuth, (req, res) => {
  // Get latest message per conversation partner
  const rows = db.prepare(`
    SELECT
      m.id,
      m.body,
      m.created_at,
      m.is_read,
      m.sender_id,
      m.recipient_id,
      CASE
        WHEN m.sender_id = ? THEN m.recipient_id
        ELSE m.sender_id
      END AS partner_id,
      u.username AS partner_username,
      u.display_name AS partner_display,
      u.role AS partner_role,
      (
        SELECT COUNT(*) FROM messages
        WHERE sender_id = partner_id AND recipient_id = ? AND is_read = 0
      ) AS unread_count
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
    WHERE (m.sender_id = ? OR m.recipient_id = ?)
    GROUP BY partner_id
    HAVING m.id = MAX(m.id)
    ORDER BY m.created_at DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  res.json(rows);
});

// GET /api/messages/:partnerId  — message thread with a user
router.get('/:partnerId', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.partnerId);
  const partner = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(partnerId);
  if (!partner) return res.status(404).json({ error: 'User not found' });

  // Check messaging permission
  if (!canMessage(req.user.role, partner.role)) {
    return res.status(403).json({ error: 'You are not permitted to message this user' });
  }

  const { page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * 50;

  const messages = db.prepare(`
    SELECT m.*, u.username AS sender_username, u.display_name AS sender_display
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.recipient_id = ?)
       OR (m.sender_id = ? AND m.recipient_id = ?)
    ORDER BY m.created_at DESC
    LIMIT 50 OFFSET ?
  `).all(req.user.id, partnerId, partnerId, req.user.id, offset);

  // Mark incoming messages as read
  db.prepare(`
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
  `).run(partnerId, req.user.id);

  res.json({ messages: messages.reverse(), partner });
});

// POST /api/messages/:partnerId  — send a message
router.post('/:partnerId', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.partnerId);
  const { body } = req.body;

  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });
  if (partnerId === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });

  const partner = db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(partnerId);
  if (!partner || !partner.is_active) return res.status(404).json({ error: 'User not found' });

  if (!canMessage(req.user.role, partner.role)) {
    return res.status(403).json({ error: 'You are not permitted to message this user' });
  }

  const result = db.prepare(`
    INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)
  `).run(req.user.id, partnerId, body.trim());

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(message);
});

// POST /api/messages/:id/report
router.post('/:id/report', requireAuth, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (msg.sender_id !== req.user.id && msg.recipient_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('UPDATE messages SET is_reported = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Message reported' });
});

// GET /api/messages/reported  — admin/mod view reported messages
router.get('/admin/reported', requireAuth, (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const rows = db.prepare(`
    SELECT m.*,
      s.username AS sender_username,
      r.username AS recipient_username
    FROM messages m
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.recipient_id = r.id
    WHERE m.is_reported = 1
    ORDER BY m.created_at DESC
  `).all();

  res.json(rows);
});

// GET /api/messages/unread/count
router.get('/unread/count', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE recipient_id = ? AND is_read = 0
  `).get(req.user.id);
  res.json({ count: row.count });
});

module.exports = router;
