'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const PLATFORM_FEE_RATE = 0.02; // 2%

// GET /api/bazaar  — browse listings
router.get('/', optionalAuth, (req, res) => {
  const { category, search, seller_id, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
  const pageSize = Math.min(50, parseInt(limit) || 20);

  let where = ["l.status = 'available'"];
  const params = [];

  if (category)  { where.push('l.category = ?');            params.push(category); }
  if (seller_id) { where.push('l.seller_id = ?');           params.push(seller_id); }
  if (search)    {
    where.push('(l.title LIKE ? OR l.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const countParams = [...params];

  const rows = db.prepare(`
    SELECT l.*, u.username AS seller_name, u.display_name AS seller_display
    FROM listings l
    JOIN users u ON l.seller_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM listings l JOIN users u ON l.seller_id = u.id WHERE ${where.join(' AND ')}`
  ).get(...countParams);

  res.json({ total: total.cnt, page: parseInt(page), limit: pageSize, listings: rows });
});

// GET /api/bazaar/my/listings  — seller's own listings (all statuses)
router.get('/my/listings', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.* FROM listings l WHERE l.seller_id = ? ORDER BY l.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// GET /api/bazaar/my/purchases  — buyer's transactions
router.get('/my/purchases', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, l.title AS listing_title, l.image_url, u.username AS seller_name
    FROM transactions t
    JOIN listings l ON t.listing_id = l.id
    JOIN users u ON t.seller_id = u.id
    WHERE t.buyer_id = ?
    ORDER BY t.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// GET /api/bazaar/my/sales  — seller's sales
router.get('/my/sales', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, l.title AS listing_title, u.username AS buyer_name
    FROM transactions t
    JOIN listings l ON t.listing_id = l.id
    JOIN users u ON t.buyer_id = u.id
    WHERE t.seller_id = ?
    ORDER BY t.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// GET /api/bazaar/:id
router.get('/:id', optionalAuth, (req, res) => {
  const listing = db.prepare(`
    SELECT l.*, u.username AS seller_name, u.display_name AS seller_display
    FROM listings l JOIN users u ON l.seller_id = u.id
    WHERE l.id = ?
  `).get(req.params.id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json(listing);
});

// POST /api/bazaar  — create listing
router.post('/', requireAuth, (req, res) => {
  const { title, description, category, price, image_url } = req.body;

  if (!title || price === undefined || price === null) {
    return res.status(400).json({ error: 'title and price are required' });
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number' });
  }

  const result = db.prepare(`
    INSERT INTO listings (seller_id, title, description, category, price, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || null, category || null, numPrice, image_url || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/bazaar/:id  — update own listing
router.patch('/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const isAdmin = ['admin','moderator'].includes(req.user.role);
  if (listing.seller_id !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: 'You do not own this listing' });
  }
  if (listing.status === 'sold') {
    return res.status(400).json({ error: 'Cannot edit a sold listing' });
  }

  const { title, description, category, price, image_url, status } = req.body;
  const newStatus = isAdmin && status ? status : listing.status;

  db.prepare(`
    UPDATE listings SET title=?, description=?, category=?, price=?, image_url=?, status=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title || listing.title,
    description !== undefined ? description : listing.description,
    category !== undefined ? category : listing.category,
    price !== undefined ? parseFloat(price) : listing.price,
    image_url !== undefined ? image_url : listing.image_url,
    newStatus,
    req.params.id
  );

  res.json({ message: 'Listing updated' });
});

// DELETE /api/bazaar/:id  — remove own listing
router.delete('/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const isAdmin = ['admin','moderator'].includes(req.user.role);
  if (listing.seller_id !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: 'You do not own this listing' });
  }
  if (listing.status === 'sold') {
    return res.status(400).json({ error: 'Cannot remove a sold listing' });
  }

  db.prepare("UPDATE listings SET status='removed', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ message: 'Listing removed' });
});

// POST /api/bazaar/:id/buy  — purchase a listing
router.post('/:id/buy', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'available') return res.status(400).json({ error: 'Listing is not available' });
  if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot buy your own listing' });

  const amount = listing.price;
  const fee = parseFloat((amount * PLATFORM_FEE_RATE).toFixed(2));
  const sellerPayout = parseFloat((amount - fee).toFixed(2));

  // Transactional wallet operation
  const doTransaction = db.transaction(() => {
    const buyerWallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id);
    if (!buyerWallet || buyerWallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Deduct from buyer
    db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?")
      .run(amount, req.user.id);

    // Credit seller (minus fee)
    db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?")
      .run(sellerPayout, listing.seller_id);

    // Mark listing sold
    db.prepare("UPDATE listings SET status='sold', updated_at=datetime('now') WHERE id=?").run(listing.id);

    // Record transaction
    const txResult = db.prepare(`
      INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, fee, seller_payout)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(listing.id, req.user.id, listing.seller_id, amount, fee, sellerPayout);

    return txResult.lastInsertRowid;
  });

  try {
    const txId = doTransaction();
    res.status(201).json({
      transaction_id: txId,
      amount,
      fee,
      seller_payout: sellerPayout,
      message: 'Purchase successful',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/bazaar/wallet/balance
router.get('/wallet/balance', requireAuth, (req, res) => {
  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id);
  res.json({ balance: wallet ? wallet.balance : 0 });
});

// POST /api/bazaar/wallet/deposit  — add funds (in-app, no external payment)
router.post('/wallet/deposit', requireAuth, (req, res) => {
  const { amount } = req.body;
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ error: 'Valid positive amount required' });
  if (num > 10000) return res.status(400).json({ error: 'Maximum single deposit is $10,000' });

  db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?")
    .run(num, req.user.id);

  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id);
  res.json({ balance: wallet.balance, deposited: num });
});

module.exports = router;
