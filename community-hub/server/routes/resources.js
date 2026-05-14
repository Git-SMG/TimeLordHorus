'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/resources  — public list with filters
router.get('/', optionalAuth, (req, res) => {
  const { category, city, status, search, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
  const pageSize = Math.min(50, parseInt(limit) || 20);

  let where = ['1=1'];
  const params = [];

  // Non-admins/mods only see active resources
  if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
    where.push("r.status = 'active'");
  } else if (status) {
    where.push('r.status = ?');
    params.push(status);
  }

  if (category) { where.push('r.category = ?'); params.push(category); }
  if (city)     { where.push('r.city LIKE ?');    params.push(`%${city}%`); }
  if (search)   {
    where.push('(r.title LIKE ? OR r.description LIKE ? OR r.organization LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const sql = `
    SELECT r.*, u.username AS submitted_by_name
    FROM resources r
    LEFT JOIN users u ON r.submitted_by = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY r.updated_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(pageSize, offset);

  const countParams = params.slice(0, -2);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM resources r LEFT JOIN users u ON r.submitted_by = u.id WHERE ${where.join(' AND ')}`).get(...countParams);
  const rows = db.prepare(sql).all(...params);

  res.json({ total: total.cnt, page: parseInt(page), limit: pageSize, resources: rows });
});

// GET /api/resources/:id
router.get('/:id', optionalAuth, (req, res) => {
  const r = db.prepare(`
    SELECT r.*, u.username AS submitted_by_name
    FROM resources r LEFT JOIN users u ON r.submitted_by = u.id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!r) return res.status(404).json({ error: 'Resource not found' });

  // Non-staff can only see active
  if (r.status !== 'active' && (!req.user || !['admin','moderator'].includes(req.user.role))) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  res.json(r);
});

// POST /api/resources  — admin/mod add; others suggest (status=pending)
router.post('/', requireAuth, (req, res) => {
  const { title, description, category, address, city, phone, website, hours, is_free } = req.body;

  if (!title || !category) return res.status(400).json({ error: 'title and category required' });

  const validCategories = ['food','housing','medical','mental_health','legal','utilities','childcare','transportation','employment','clothing','other'];
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category' });

  const isStaff = ['admin','moderator'].includes(req.user.role);
  const status = isStaff ? 'active' : 'needs_review';
  const approved_by = isStaff ? req.user.id : null;
  const last_verified = isStaff ? new Date().toISOString() : null;

  const result = db.prepare(`
    INSERT INTO resources (title, description, category, address, city, phone, website, hours, is_free, status, submitted_by, approved_by, last_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, category, address || null, city || null, phone || null, website || null, hours || null, is_free ? 1 : 0, status, req.user.id, approved_by, last_verified);

  res.status(201).json({ id: result.lastInsertRowid, status });
});

// PATCH /api/resources/:id  — admin/mod or public_resource (own)
router.patch('/:id', requireAuth, (req, res) => {
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  const isStaff = ['admin','moderator'].includes(req.user.role);
  const isOwner = resource.submitted_by === req.user.id && req.user.role === 'public_resource';

  if (!isStaff && !isOwner) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { title, description, category, address, city, phone, website, hours, is_free, status } = req.body;

  const newStatus = isStaff && status ? status : resource.status;
  const last_verified = isStaff ? new Date().toISOString() : resource.last_verified;

  db.prepare(`
    UPDATE resources SET
      title = ?, description = ?, category = ?, address = ?, city = ?,
      phone = ?, website = ?, hours = ?, is_free = ?, status = ?,
      last_verified = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || resource.title,
    description !== undefined ? description : resource.description,
    category || resource.category,
    address !== undefined ? address : resource.address,
    city !== undefined ? city : resource.city,
    phone !== undefined ? phone : resource.phone,
    website !== undefined ? website : resource.website,
    hours !== undefined ? hours : resource.hours,
    is_free !== undefined ? (is_free ? 1 : 0) : resource.is_free,
    newStatus,
    last_verified,
    req.params.id
  );

  res.json({ message: 'Resource updated' });
});

// DELETE /api/resources/:id  — admin/mod only
router.delete('/:id', requireAuth, (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  db.prepare("UPDATE resources SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Resource archived' });
});

// POST /api/resources/review-stale  — admin cron trigger
router.post('/review-stale', requireAuth, (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const result = db.prepare(`
    UPDATE resources
    SET status = 'needs_review', updated_at = datetime('now')
    WHERE status = 'active'
      AND (last_verified IS NULL OR last_verified < datetime('now', '-90 days'))
  `).run();

  res.json({ flagged: result.changes });
});

module.exports = router;
