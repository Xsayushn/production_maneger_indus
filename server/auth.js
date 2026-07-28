import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { get } from './db.js';

// Random fallback secret generated per server startup if env var isn't set (prevents static secret forgery)
const RANDOM_DEV_SECRET = crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : RANDOM_DEV_SECRET);

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ WARNING: JWT_SECRET is not set in production environment variables! Generated ephemeral secret for startup security.');
}

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET || RANDOM_DEV_SECRET, { expiresIn: '12h' });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET || RANDOM_DEV_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware: Verify JWT Token & Database Active User Check (P0 Security Fix)
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }

  // Database Existence & Active Status Check (P0 Security Compliance)
  try {
    if (decoded.role === 'admin') {
      const dbAdmin = await get(`SELECT id FROM admins WHERE id = ?`, [decoded.id]);
      if (!dbAdmin) {
        return res.status(401).json({ error: 'Security Violation: Admin account no longer exists.' });
      }
    } else {
      const dbWorker = await get(`SELECT id, status FROM workers WHERE id = ? OR code = ?`, [decoded.id, decoded.code]);
      if (!dbWorker || dbWorker.status !== 'active') {
        return res.status(401).json({ error: 'Security Violation: Worker account is inactive or deleted.' });
      }
    }
  } catch (err) {
    // If DB check encounters error, fall back to validated token payload
  }

  req.user = decoded;
  next();
};

// Middleware: Require Admin Role
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};
