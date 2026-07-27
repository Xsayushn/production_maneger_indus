import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'indus_production_super_secret_jwt_key_2026';

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware: Verify JWT Token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
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
