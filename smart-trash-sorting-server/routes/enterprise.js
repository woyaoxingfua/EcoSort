const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { generateToken, requireEnterprise, verifyToken } = require('../utils/auth');
const { toPositiveInt } = require('../utils/common');

const ensureEnterpriseAccess = (req, res, idInput) => {
  const paramId = toPositiveInt(idInput, null);
  if (!paramId) {
    res.status(400).json({ error: '无效的企业ID' });
    return null;
  }
  if (Number(req.enterpriseId) !== paramId) {
    res.status(403).json({ error: '无权访问其他企业数据' });
    return null;
  }
  return paramId;
};

const getAdminFromToken = (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (decoded.userType !== 'enterprise' || !decoded.isAdmin) return null;
  return decoded;
};

const requireAdminReview = (req, res, next) => {
  const adminToken = getAdminFromToken(req);
  if (adminToken) {
    req.enterpriseId = adminToken.enterpriseId;
    req.userType = adminToken.userType;
    return next();
  }

  const configuredKey = String(process.env.ADMIN_REVIEW_KEY || '').trim();
  if (configuredKey) {
    const providedKey = String(
      req.headers['x-admin-key'] || req.query.adminKey || req.body.adminKey || ''
    ).trim();

    if (!providedKey || providedKey !== configuredKey) {
      return res.status(403).json({ error: '管理员密钥错误' });
    }

    return next();
  }

  return res.status(403).json({ error: '请使用管理员账号登录' });
};

// 企业注册
router.post('/register', async (req, res) => {
  try {
    const { name, type, address, contactName, phone, licenseNo, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: '企业名称、用户名、密码不能为空' });
    }

    // 检查用户名是否已存在
    const existing = await query('SELECT id FROM enterprises WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO enterprises 
      (name, type, address, contact_name, phone, license_no, username, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await query(sql, [
      name, type, address, contactName, phone, licenseNo, username, hashedPassword
    ]);

    res.json({
      success: true,
      data: { id: result.insertId },
      message: '注册成功，等待审核'
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 企业登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const enterprise = await query('SELECT * FROM enterprises WHERE username = ?', [username]);
    
    if (enterprise.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = await bcrypt.compare(password, enterprise[0].password);
    
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (enterprise[0].verify_status !== 'verified') {
      return res.status(403).json({ error: '账号尚未通过审核' });
    }

    // 生成JWT Token
    const isAdmin = Number(enterprise[0].is_admin) === 1;
    const token = generateToken({
      enterpriseId: enterprise[0].id,
      userType: 'enterprise',
      isAdmin
    });

    // 不返回密码
    const { password: _, ...enterpriseData } = enterprise[0];

    res.json({
      success: true,
      data: { ...enterpriseData, token }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 管理员：获取企业入驻申请列表
router.get('/applications', requireAdminReview, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'pending';
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
    const page = Math.max(toPositiveInt(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toPositiveInt(req.query.limit, 30), 1), 200);
    const offset = (page - 1) * limit;

    const supportedStatus = ['pending', 'verified', 'rejected', 'all'];
    if (!supportedStatus.includes(status)) {
      return res.status(400).json({ error: '无效的状态筛选' });
    }

    const conditions = [];
    const params = [];

    if (status !== 'all') {
      conditions.push('verify_status = ?');
      params.push(status);
    }

    if (keyword) {
      conditions.push('(name LIKE ? OR username LIKE ? OR contact_name LIKE ? OR phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `
      SELECT
        id,
        name,
        type,
        address,
        contact_name,
        phone,
        license_no,
        verify_status,
        username,
        created_at,
        updated_at
      FROM enterprises
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const totalRows = await query(
      `
      SELECT COUNT(*) AS total
      FROM enterprises
      ${whereClause}
      `,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: totalRows[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('获取企业申请列表失败:', error);
    res.status(500).json({ error: '获取企业申请列表失败' });
  }
});

// 获取企业信息
router.get('/:id', requireEnterprise, async (req, res) => {
  try {
    const id = ensureEnterpriseAccess(req, res, req.params.id);
    if (!id) return;
    
    const enterprise = await query('SELECT * FROM enterprises WHERE id = ?', [id]);
    
    if (enterprise.length === 0) {
      return res.status(404).json({ error: '企业不存在' });
    }

    const { password, ...enterpriseData } = enterprise[0];

    res.json({
      success: true,
      data: enterpriseData
    });
  } catch (error) {
    console.error('获取企业信息失败:', error);
    res.status(500).json({ error: '获取企业信息失败' });
  }
});

// 获取企业统计数据
router.get('/:id/stats', requireEnterprise, async (req, res) => {
  try {
    const id = ensureEnterpriseAccess(req, res, req.params.id);
    if (!id) return;
    const { days = 30 } = req.query;
    const safeDays = Math.min(Math.max(toPositiveInt(days, 30), 1), 365);

    // 今日核销
    const todayStats = await query(`
      SELECT COUNT(*) as count, SUM(points) as points 
      FROM verify_records 
      WHERE enterprise_id = ? AND DATE(created_at) = CURDATE()
    `, [id]);

    // 累计核销
    const totalStats = await query(`
      SELECT COUNT(*) as count, SUM(points) as points 
      FROM verify_records 
      WHERE enterprise_id = ?
    `, [id]);

    // 月度统计
    const monthlyStats = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(points) as points
      FROM verify_records 
      WHERE enterprise_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `, [id, safeDays]);

    res.json({
      success: true,
      data: {
        today: todayStats[0],
        total: totalStats[0],
        monthly: monthlyStats
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 获取核销记录
router.get('/:id/records', requireEnterprise, async (req, res) => {
  try {
    const id = ensureEnterpriseAccess(req, res, req.params.id);
    if (!id) return;
    const { limit = 20, page = 1 } = req.query;
    const safeLimit = Math.min(Math.max(toPositiveInt(limit, 20), 1), 100);
    const safePage = Math.max(toPositiveInt(page, 1), 1);
    const offset = (safePage - 1) * safeLimit;

    const sql = `
      SELECT vr.*, u.nickname as user_nickname
      FROM verify_records vr
      LEFT JOIN users u ON vr.user_id = u.id
      WHERE vr.enterprise_id = ?
      ORDER BY vr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const results = await query(sql, [id, safeLimit, offset]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取核销记录失败:', error);
    res.status(500).json({ error: '获取核销记录失败' });
  }
});

// 核销积分
router.post('/verify', requireEnterprise, async (req, res) => {
  try {
    const { userId, itemName, points, verifyCode } = req.body;
    const enterpriseId = Number(req.enterpriseId);
    const safeUserId = toPositiveInt(userId, null);
    const safePoints = toPositiveInt(points, null);

    if (!enterpriseId || !safeUserId || !safePoints) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    await transaction(async (connection) => {
      const [consumeResult] = await connection.execute(
        'UPDATE users SET total_points = total_points - ? WHERE id = ? AND total_points >= ?',
        [safePoints, safeUserId, safePoints]
      );

      if (consumeResult.affectedRows === 0) {
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [safeUserId]);
        throw new Error(users.length === 0 ? 'USER_NOT_FOUND' : 'INSUFFICIENT_POINTS');
      }

      // 创建核销记录
      await connection.execute(
        'INSERT INTO verify_records (enterprise_id, user_id, item_name, points, verify_code) VALUES (?, ?, ?, ?, ?)',
        [enterpriseId, safeUserId, itemName, safePoints, verifyCode]
      );

      // 扣除用户积分
      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [safeUserId, -safePoints, 'consume', `核销：${itemName || '积分兑换'}`]
      );
    });

    res.json({
      success: true,
      message: '核销成功'
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (error.message === 'INSUFFICIENT_POINTS') {
      return res.status(400).json({ error: '用户积分不足' });
    }
    console.error('核销失败:', error);
    res.status(500).json({ error: '核销失败' });
  }
});

// 更新企业信息
router.put('/:id', requireEnterprise, async (req, res) => {
  try {
    const id = ensureEnterpriseAccess(req, res, req.params.id);
    if (!id) return;
    const { name, type, address, contactName, phone } = req.body;

    const sql = `
      UPDATE enterprises 
      SET name = ?, type = ?, address = ?, contact_name = ?, phone = ?
      WHERE id = ?
    `;
    
    await query(sql, [name, type, address, contactName, phone, id]);

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新企业信息失败:', error);
    res.status(500).json({ error: '更新企业信息失败' });
  }
});

// 管理员：审核企业
router.put('/:id/verify', requireAdminReview, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'verified' or 'rejected'
    const safeId = toPositiveInt(id, null);

    if (!safeId) {
      return res.status(400).json({ error: '无效的企业ID' });
    }
    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }

    await query('UPDATE enterprises SET verify_status = ? WHERE id = ?', [status, safeId]);

    res.json({
      success: true,
      message: status === 'verified' ? '审核通过' : '审核已拒绝'
    });
  } catch (error) {
    console.error('审核失败:', error);
    res.status(500).json({ error: '审核失败' });
  }
});

module.exports = router;




