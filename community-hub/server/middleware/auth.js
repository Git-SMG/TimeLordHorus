'use strict';

const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'ch-dev-secret-change-in-production';

/**
 * Express middleware: verify JWT from Authorization header (Bearer token)
 * or from the `token` cookie. Attaches decoded payload to req.user.
 */
function requireAuth(req, res, next) {
  let token = null;

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — attaches req.user if token present, but doesn't block.
 */
function optionalAuth(req, res, next) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  else if (req.cookies && req.cookies.token) token = req.cookies.token;

  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
    } catch (_) {
      // ignore
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, SECRET };
