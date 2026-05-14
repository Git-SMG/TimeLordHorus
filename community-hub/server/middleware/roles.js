'use strict';

// Role hierarchy values (higher = more permissions)
const ROLE_LEVEL = {
  admin: 5,
  moderator: 4,
  public_resource: 3,
  caregiver: 2,
  individual: 1,
};

/**
 * Middleware factory: allow only users whose role is in the allowed list.
 * Must be used AFTER requireAuth.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware: allow only admins and moderators.
 */
function requireMod(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
}

/**
 * Middleware: allow only admins.
 */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Check if two users are allowed to message each other based on roles.
 * Allowed pairs (symmetric):
 *   individual  ↔ caregiver
 *   individual  ↔ public_resource
 *   caregiver   ↔ public_resource
 *   admin/mod   ↔ anyone
 */
function canMessage(roleA, roleB) {
  if (roleA === 'admin' || roleA === 'moderator') return true;
  if (roleB === 'admin' || roleB === 'moderator') return true;

  const pairs = [
    ['individual', 'caregiver'],
    ['individual', 'public_resource'],
    ['caregiver', 'public_resource'],
  ];
  return pairs.some(([a, b]) =>
    (roleA === a && roleB === b) || (roleA === b && roleB === a)
  );
}

module.exports = { requireRole, requireMod, requireAdmin, canMessage, ROLE_LEVEL };
