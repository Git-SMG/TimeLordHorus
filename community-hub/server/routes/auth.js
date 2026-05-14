'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password, role, display_name, bio, phone, organization } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  const allowedRoles = ['public_resource', 'individual', 'caregiver'];
  const userRole = allowedRoles.includes(role) ? role : 'individual';

  // Check uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, email, password, role, display_name, bio, phone, organization)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(username, email, hash, userRole, display_name || null, bio || null, phone || null, organization || null);

  // Create wallet
  db.prepare('INSERT INTO wallets (user_id) VALUES (?)').run(result.lastInsertRowid);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username, role: userRole },
    SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ token, user: { id: result.lastInsertRowid, username, role: userRole, display_name } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, role, display_name, bio, phone, organization, avatar_url, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id);
  res.json({ ...user, wallet_balance: wallet ? wallet.balance : 0 });
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, (req, res) => {
  const { display_name, bio, phone, organization, avatar_url } = req.body;
  db.prepare(`
    UPDATE users SET display_name = ?, bio = ?, phone = ?, organization = ?, avatar_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(display_name || null, bio || null, phone || null, organization || null, avatar_url || null, req.user.id);

  res.json({ message: 'Profile updated' });
});

// PATCH /api/auth/password
router.patch('/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

// GET /api/auth/users  (admin only)
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const users = db.prepare(
    'SELECT id, username, email, role, display_name, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

// PATCH /api/auth/users/:id/role  (admin only)
router.patch('/users/:id/role', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { role } = req.body;
  const allowed = ['admin', 'moderator', 'public_resource', 'individual', 'caregiver'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

// PATCH /api/auth/users/:id/status  (admin only)
router.patch('/users/:id/status', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { is_active } = req.body;
  db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(is_active ? 1 : 0, req.params.id);
  res.json({ message: 'User status updated' });
});

module.exports = router;
