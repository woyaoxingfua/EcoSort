const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_trash_sorting_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT Token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 验证JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// 认证中间件（可选认证 - 不强制）
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.userType = decoded.userType;
    }
  }
  next();
};

// 认证中间件（强制认证）
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  req.userId = decoded.userId;
  req.userType = decoded.userType;
  next();
};

// 企业认证中间件
const requireEnterprise = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }
  const decoded = verifyToken(token);
  if (!decoded || decoded.userType !== 'enterprise') {
    return res.status(403).json({ error: '无权限访问' });
  }
  req.enterpriseId = decoded.enterpriseId;
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  optionalAuth,
  requireAuth,
  requireEnterprise
};
