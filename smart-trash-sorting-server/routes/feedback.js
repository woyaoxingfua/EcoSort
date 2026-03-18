const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { requireAuth } = require('../utils/auth');
const { requireAdminAccess } = require('../utils/admin');
const { toPositiveInt } = require('../utils/common');

const VALID_FEEDBACK_TYPES = ['identify_error', 'classify_error', 'info_error', 'suggestion', 'other'];
const VALID_FEEDBACK_STATUS = ['pending', 'processing', 'resolved'];

const normalizeFeedbackType = (value) => {
  const typeAliasMap = {
    wrong_result: 'identify_error',
    wrong_category: 'classify_error'
  };
  return typeAliasMap[value] || value;
};

const ensureSelfAccess = (req, res, userId) => {
  if (Number(req.userId) !== Number(userId)) {
    res.status(403).json({ error: '无权访问其他用户反馈数据' });
    return false;
  }
  return true;
};

// 提交反馈
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, type, content, trashName, contact } = req.body;
    const requestedUserId = toPositiveInt(userId, null);
    const loginUserId = toPositiveInt(req.userId, null);

    if (!loginUserId) {
      return res.status(401).json({ error: '请先登录' });
    }

    if (requestedUserId && requestedUserId !== loginUserId) {
      return res.status(403).json({ error: '无权提交其他用户反馈' });
    }

    const safeContent = typeof content === 'string' ? content.trim() : '';
    if (!type || !safeContent) {
      return res.status(400).json({ error: '反馈类型和内容不能为空' });
    }
    if (safeContent.length > 2000) {
      return res.status(400).json({ error: '反馈内容不能超过2000字' });
    }

    const normalizedType = normalizeFeedbackType(type);
    if (!VALID_FEEDBACK_TYPES.includes(normalizedType)) {
      return res.status(400).json({ error: '无效的反馈类型' });
    }

    const safeTrashName = typeof trashName === 'string' ? trashName.trim() : '';
    const safeContact = typeof contact === 'string' ? contact.trim() : '';

    const sql = `
      INSERT INTO user_feedback (user_id, type, content, trash_name, contact)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await query(sql, [
      loginUserId,
      normalizedType,
      safeContent,
      safeTrashName || null,
      safeContact || null
    ]);

    res.json({
      success: true,
      data: { id: result.insertId },
      message: '反馈提交成功，感谢您的反馈！'
    });
  } catch (error) {
    console.error('提交反馈失败:', error);
    res.status(500).json({ error: '提交反馈失败' });
  }
});

// 获取用户反馈列表
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const userId = toPositiveInt(req.params.userId, null);
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, userId)) return;

    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
    const page = Math.max(toPositiveInt(req.query.page, 1), 1);
    const offset = (page - 1) * limit;

    const sql = `
      SELECT id, user_id, type, content, trash_name, contact, status, reply, created_at, updated_at
      FROM user_feedback 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const results = await query(sql, [userId, limit, offset]);
    const count = await query('SELECT COUNT(*) as total FROM user_feedback WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total: count[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({ error: '获取反馈列表失败' });
  }
});

router.get('/admin/list', requireAdminAccess, async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
    const page = Math.max(toPositiveInt(req.query.page, 1), 1);
    const offset = (page - 1) * limit;

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';

    if (status && !VALID_FEEDBACK_STATUS.includes(status)) {
      return res.status(400).json({ error: '无效的反馈状态' });
    }
    if (type && !VALID_FEEDBACK_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的反馈类型' });
    }

    const where = [];
    const params = [];
    if (status) {
      where.push('f.status = ?');
      params.push(status);
    }
    if (type) {
      where.push('f.type = ?');
      params.push(type);
    }
    if (keyword) {
      where.push('(f.content LIKE ? OR f.trash_name LIKE ? OR f.contact LIKE ? OR u.nickname LIKE ?)');
      const pattern = `%${keyword}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = `
      ORDER BY
        CASE f.status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          WHEN 'resolved' THEN 3
          ELSE 4
        END,
        f.created_at DESC
    `;

    const listSql = `
      SELECT
        f.id, f.user_id, f.type, f.content, f.trash_name, f.contact,
        f.status, f.reply, f.created_at, f.updated_at,
        u.nickname AS user_nickname
      FROM user_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const rows = await query(listSql, [...params, limit, offset]);
    const countSql = `
      SELECT COUNT(*) as total
      FROM user_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ${whereSql}
    `;
    const countRows = await query(countSql, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: countRows[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('获取管理反馈列表失败:', error);
    res.status(500).json({ error: '获取管理反馈列表失败' });
  }
});

router.put('/admin/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的反馈ID' });
    }

    const updates = [];
    const params = [];

    if (req.body.status !== undefined) {
      const status = String(req.body.status || '').trim();
      if (!VALID_FEEDBACK_STATUS.includes(status)) {
        return res.status(400).json({ error: '无效的反馈状态' });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (req.body.reply !== undefined) {
      const reply = String(req.body.reply || '').trim();
      if (reply.length > 2000) {
        return res.status(400).json({ error: '回复内容不能超过2000字' });
      }
      updates.push('reply = ?');
      params.push(reply || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有可更新的内容' });
    }

    params.push(id);
    const result = await query(`UPDATE user_feedback SET ${updates.join(', ')} WHERE id = ?`, params);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: '反馈记录不存在' });
    }

    res.json({
      success: true,
      message: '反馈处理状态更新成功'
    });
  } catch (error) {
    console.error('更新反馈失败:', error);
    res.status(500).json({ error: '更新反馈失败' });
  }
});

// 采纳反馈并添加垃圾分类（管理端）
router.post('/admin/:id/accept-trash', requireAdminAccess, async (req, res) => {
  try {
    const feedbackId = toPositiveInt(req.params.id, null);
    if (!feedbackId) {
      return res.status(400).json({ error: '无效的反馈ID' });
    }

    const { name, type, typeName, tips, icon, examples, description } = req.body;

    if (!name || !type || !typeName) {
      return res.status(400).json({ error: '垃圾名称、类型、类型名称不能为空' });
    }

    const VALID_TYPES = ['recyclable', 'hazardous', 'kitchen', 'other'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的分类类型' });
    }

    // 检查反馈是否存在
    const feedbackRows = await query('SELECT id, status FROM user_feedback WHERE id = ? LIMIT 1', [feedbackId]);
    if (feedbackRows.length === 0) {
      return res.status(404).json({ error: '反馈记录不存在' });
    }

    // 使用事务：添加垃圾分类 + 更新反馈状态
    let trashId;
    await transaction(async (connection) => {
      const [insertResult] = await connection.execute(
        `INSERT INTO trash_categories (name, type, type_name, tips, icon, examples, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(name).trim(),
          type,
          String(typeName).trim(),
          tips || '',
          icon || '🗑️',
          JSON.stringify(examples || []),
          description || ''
        ]
      );
      trashId = insertResult.insertId;

      await connection.execute(
        `UPDATE user_feedback SET status = 'resolved', reply = CONCAT(COALESCE(reply, ''), ?) WHERE id = ?`,
        [`\n[系统] 已采纳此反馈，新增垃圾分类「${String(name).trim()}」(${String(typeName).trim()})`, feedbackId]
      );
    });

    res.json({
      success: true,
      data: { trashId, feedbackId },
      message: `已采纳反馈并成功添加垃圾分类「${String(name).trim()}」`
    });
  } catch (error) {
    console.error('采纳反馈添加分类失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该垃圾名称已存在' });
    }
    res.status(500).json({ error: '采纳反馈失败' });
  }
});

module.exports = router;
