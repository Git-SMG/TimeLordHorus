'use strict';

require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const resourceRoutes  = require('./routes/resources');
const boardRoutes     = require('./routes/board');
const messageRoutes   = require('./routes/messages');
const bazaarRoutes    = require('./routes/bazaar');
const { setupSocket } = require('./socket');

// Initialize DB (runs schema + seed on first start)
require('./db');

const app = express();
const server = http.createServer(app);

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Strict limiter for authentication endpoints (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// General API limiter — protects all other routes from bulk scraping/DoS
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN;
const corsOptions = ALLOWED_ORIGIN
  ? { origin: ALLOWED_ORIGIN, methods: ['GET','POST','PATCH','DELETE','OPTIONS'] }
  : { origin: false };  // Same-origin only when no CORS_ORIGIN env var is set

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/resources', apiLimiter,  resourceRoutes);
app.use('/api/board',     apiLimiter,  boardRoutes);
app.use('/api/messages',  apiLimiter,  messageRoutes);
app.use('/api/bazaar',    apiLimiter,  bazaarRoutes);

// ─── Stale resource check (runs once at startup, then every 24h) ──────────────
const db = require('./db');
function flagStaleResources() {
  const result = db.prepare(`
    UPDATE resources
    SET status = 'needs_review', updated_at = datetime('now')
    WHERE status = 'active'
      AND (last_verified IS NULL OR last_verified < datetime('now', '-90 days'))
  `).run();
  if (result.changes > 0) {
    console.log(`[stale-check] Flagged ${result.changes} resource(s) for review`);
  }
}
flagStaleResources();
setInterval(flagStaleResources, 24 * 60 * 60 * 1000);

// ─── Serve static frontend ────────────────────────────────────────────────────
const CLIENT_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(CLIENT_DIR));

// SPA fallback: any non-API GET returns index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// ─── 404 / Error handlers ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
setupSocket(server);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3737;
server.listen(PORT, () => {
  console.log(`Community Hub running on http://localhost:${PORT}`);
});

module.exports = { app, server };
