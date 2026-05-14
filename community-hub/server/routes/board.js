'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const PUBLIC_STATUSES = ['approved'];

// GET /api/board  — list posts
router.get('/', optionalAuth, (req, res) => {
  const { type, category, status, search, pinned, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
  const pageSize = Math.min(50, parseInt(limit) || 20);

  const isStaff = req.user && ['admin','moderator'].includes(req.user.role);

  let where = ['1=1'];
  const params = [];

  if (!isStaff) {
    where.push("p.status = 'approved'");
    // Filter out expired events
    where.push("(p.expires_at IS NULL OR p.expires_at > datetime('now'))");
  } else if (status) {
    where.push('p.status = ?');
    params.push(status);
  }

  if (type)     { where.push('p.type = ?');         params.push(type); }
  if (category) { where.push('p.category = ?');      params.push(category); }
  if (pinned === 'true') { where.push('p.is_pinned = 1'); }
  if (search)   {
    where.push('(p.title LIKE ? OR p.body LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const countParams = [...params];
  const rows = db.prepare(`
    SELECT p.*, u.username AS author_name, u.display_name AS author_display, u.role AS author_role
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.is_pinned DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM posts p JOIN users u ON p.author_id = u.id WHERE ${where.join(' AND ')}`).get(...countParams);

  res.json({ total: total.cnt, page: parseInt(page), limit: pageSize, posts: rows });
});

// GET /api/board/:id
router.get('/:id', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username AS author_name, u.display_name AS author_display, u.role AS author_role
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  const isStaff = req.user && ['admin','moderator'].includes(req.user.role);
  if (!isStaff && post.status !== 'approved') {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json(post);
});

// POST /api/board
router.post('/', requireAuth, (req, res) => {
  const { type, title, body, category, tags, expires_at } = req.body;

  if (!type || !title || !body) {
    return res.status(400).json({ error: 'type, title, and body are required' });
  }

  const validTypes = ['iso','job','event','resource_announce'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid post type' });

  const isStaff = ['admin','moderator'].includes(req.user.role);
  const status = isStaff ? 'approved' : 'pending';

  const result = db.prepare(`
    INSERT INTO posts (author_id, type, title, body, category, tags, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, title, body, category || null, tags || null, status, expires_at || null);

  res.status(201).json({ id: result.lastInsertRowid, status });
});

// PATCH /api/board/:id  — author edits own pending post, or staff moderate
router.patch('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const isStaff = ['admin','moderator'].includes(req.user.role);
  const isAuthor = post.author_id === req.user.id;

  if (!isStaff && !isAuthor) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { title, body, category, tags, status, is_pinned, expires_at } = req.body;

  // Only staff can change status/pin
  const newStatus = isStaff && status ? status : post.status;
  const newPinned = isStaff && is_pinned !== undefined ? (is_pinned ? 1 : 0) : post.is_pinned;

  db.prepare(`
    UPDATE posts SET
      title = ?, body = ?, category = ?, tags = ?,
      status = ?, is_pinned = ?, expires_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || post.title,
    body || post.body,
    category !== undefined ? category : post.category,
    tags !== undefined ? tags : post.tags,
    newStatus,
    newPinned,
    expires_at !== undefined ? expires_at : post.expires_at,
    req.params.id
  );

  res.json({ message: 'Post updated' });
});

// DELETE /api/board/:id
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const isStaff = ['admin','moderator'].includes(req.user.role);
  const isAuthor = post.author_id === req.user.id;

  if (!isStaff && !isAuthor) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  db.prepare("UPDATE posts SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Post archived' });
});

// GET /api/board/pending  — moderation queue (staff only)
router.get('/queue/pending', requireAuth, (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const posts = db.prepare(`
    SELECT p.*, u.username AS author_name, u.role AS author_role
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.status = 'pending'
    ORDER BY p.created_at ASC
  `).all();

  res.json(posts);
});

module.exports = router;
