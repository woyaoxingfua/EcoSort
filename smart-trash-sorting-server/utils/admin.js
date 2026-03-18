const { verifyToken } = require('./auth');

const getAdminFromToken = (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (decoded.userType !== 'enterprise' || !decoded.isAdmin) return null;

  return {
    enterpriseId: decoded.enterpriseId,
    userType: decoded.userType
  };
};

const readAdminKey = (req) => {
  const bodyAdminKey = req.body && typeof req.body === 'object' ? req.body.adminKey : '';
  return String(
    req.headers['x-admin-key'] || req.query.adminKey || bodyAdminKey || ''
  ).trim();
};

const requireAdminAccess = (req, res, next) => {
  const adminFromToken = getAdminFromToken(req);
  if (adminFromToken) {
    req.enterpriseId = adminFromToken.enterpriseId;
    req.userType = adminFromToken.userType;
    req.adminSource = 'token';
    return next();
  }

  const configuredKey = String(process.env.ADMIN_REVIEW_KEY || '').trim();
  if (configuredKey) {
    const providedKey = readAdminKey(req);
    if (!providedKey || providedKey !== configuredKey) {
      return res.status(403).json({ error: '管理员密钥错误' });
    }
    req.adminSource = 'key';
    return next();
  }

  return res.status(403).json({ error: '请使用管理员账号登录' });
};

module.exports = {
  requireAdminAccess,
  getAdminFromToken
};
