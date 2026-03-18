const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { toPositiveInt } = require('../utils/common');
const { requireAdminAccess } = require('../utils/admin');
const { generateContent } = require('../services/aiContent');

const VALID_CATEGORIES = ['news', 'knowledge', 'mistake', 'daily_tip'];

const normalizeNewsStatus = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (parsed !== 0 && parsed !== 1) return fallback;
  return parsed;
};

const normalizeCategory = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return VALID_CATEGORIES.includes(trimmed) ? trimmed : '';
};

const trimString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

// 获取资讯列表（公开接口，支持 category 筛选）
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 10), 50);
    const page = Math.max(toPositiveInt(req.query.page, 1), 1);
    const safeStatus = 1;
    const offset = (page - 1) * limit;
    const category = normalizeCategory(req.query.category);

    const where = ['status = ?'];
    const params = [safeStatus];

    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const sql = `
      SELECT id, title, summary, source, author, cover_image, category, view_count, published_at, created_at
      FROM news 
      ${whereSql}
      ORDER BY published_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const results = await query(sql, [...params, limit, offset]);

    // 获取总数
    const countResult = await query(`SELECT COUNT(*) as total FROM news ${whereSql}`, params);

    res.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total: countResult[0].total
      }
    });
  } catch (error) {
    console.error('获取资讯失败:', error);
    res.status(500).json({ error: '获取资讯失败' });
  }
});

router.get('/admin/list', requireAdminAccess, async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
    const page = Math.max(toPositiveInt(req.query.page, 1), 1);
    const offset = (page - 1) * limit;

    const keyword = trimString(req.query.keyword);
    const category = normalizeCategory(req.query.category);
    const statusRaw = req.query.status;
    let statusFilter = null;
    if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== '') {
      const normalizedStatus = normalizeNewsStatus(statusRaw, null);
      if (normalizedStatus !== 0 && normalizedStatus !== 1) {
        return res.status(400).json({ error: '无效的资讯状态' });
      }
      statusFilter = normalizedStatus;
    }

    const where = [];
    const params = [];

    if (statusFilter !== null) {
      where.push('status = ?');
      params.push(statusFilter);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (keyword) {
      where.push('(title LIKE ? OR summary LIKE ? OR content LIKE ? OR source LIKE ? OR author LIKE ?)');
      const pattern = `%${keyword}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const listSql = `
      SELECT id, title, summary, source, author, cover_image, category, view_count, status, published_at, created_at, updated_at
      FROM news
      ${whereSql}
      ORDER BY published_at DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(listSql, [...params, limit, offset]);

    const countSql = `SELECT COUNT(*) as total FROM news ${whereSql}`;
    const totalRows = await query(countSql, params);

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
    console.error('获取管理资讯列表失败:', error);
    res.status(500).json({ error: '获取管理资讯列表失败' });
  }
});

router.get('/admin/:id', requireAdminAccess, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的资讯ID' });
    }

    const rows = await query('SELECT * FROM news WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '资讯不存在' });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('获取管理资讯详情失败:', error);
    res.status(500).json({ error: '获取管理资讯详情失败' });
  }
});

// 获取资讯详情
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的资讯ID' });
    }
    
    const results = await query('SELECT * FROM news WHERE id = ? AND status = 1', [id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: '资讯不存在' });
    }

    // 更新浏览次数
    await query('UPDATE news SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('获取资讯详情失败:', error);
    res.status(500).json({ error: '获取资讯详情失败' });
  }
});

// 添加资讯
router.post('/', requireAdminAccess, async (req, res) => {
  try {
    const title = trimString(req.body.title);
    const summary = trimString(req.body.summary);
    const content = trimString(req.body.content);
    const source = trimString(req.body.source);
    const author = trimString(req.body.author);
    const coverImage = trimString(req.body.coverImage);
    const category = normalizeCategory(req.body.category) || 'news';
    const status = normalizeNewsStatus(req.body.status, 1);
    const publishedAt = req.body.publishedAt || new Date();

    if (!title.trim()) {
      return res.status(400).json({ error: '标题不能为空' });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: '标题长度不能超过300个字符' });
    }

    const sql = `
      INSERT INTO news (title, summary, content, source, author, cover_image, category, status, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await query(sql, [
      title, summary || null, content || null, source || null, author || null, coverImage || null, category, status, publishedAt
    ]);

    res.json({
      success: true,
      data: { id: result.insertId },
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加资讯失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '资讯标题已存在' });
    }
    res.status(500).json({ error: '添加资讯失败' });
  }
});

// 更新资讯
router.put('/:id(\\d+)', requireAdminAccess, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的资讯ID' });
    }

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) {
      const title = trimString(req.body.title);
      if (!title) {
        return res.status(400).json({ error: '标题不能为空' });
      }
      if (title.length > 300) {
        return res.status(400).json({ error: '标题长度不能超过300个字符' });
      }
      updates.push('title = ?');
      params.push(title);
    }

    if (req.body.summary !== undefined) {
      updates.push('summary = ?');
      params.push(trimString(req.body.summary) || null);
    }
    if (req.body.content !== undefined) {
      updates.push('content = ?');
      params.push(trimString(req.body.content) || null);
    }
    if (req.body.source !== undefined) {
      updates.push('source = ?');
      params.push(trimString(req.body.source) || null);
    }
    if (req.body.author !== undefined) {
      updates.push('author = ?');
      params.push(trimString(req.body.author) || null);
    }
    if (req.body.coverImage !== undefined) {
      updates.push('cover_image = ?');
      params.push(trimString(req.body.coverImage) || null);
    }
    if (req.body.category !== undefined) {
      const cat = normalizeCategory(req.body.category);
      if (!cat) {
        return res.status(400).json({ error: '无效的内容类别' });
      }
      updates.push('category = ?');
      params.push(cat);
    }
    if (req.body.publishedAt !== undefined) {
      updates.push('published_at = ?');
      params.push(req.body.publishedAt || null);
    }
    if (req.body.status !== undefined) {
      const status = normalizeNewsStatus(req.body.status, null);
      if (status !== 0 && status !== 1) {
        return res.status(400).json({ error: '无效的资讯状态' });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有可更新的内容' });
    }

    params.push(id);
    
    const result = await query(`UPDATE news SET ${updates.join(', ')} WHERE id = ?`, params);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: '资讯不存在' });
    }

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新资讯失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '资讯标题已存在' });
    }
    res.status(500).json({ error: '更新资讯失败' });
  }
});

// 删除资讯
router.delete('/:id(\\d+)', requireAdminAccess, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的资讯ID' });
    }
    
    const result = await query('DELETE FROM news WHERE id = ?', [id]);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: '资讯不存在' });
    }

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除资讯失败:', error);
    res.status(500).json({ error: '删除资讯失败' });
  }
});

// AI辅助内容生成（管理员）
router.post('/ai-generate', requireAdminAccess, async (req, res) => {
  try {
    const category = normalizeCategory(req.body.category);
    const topic = trimString(req.body.topic);

    if (!category) {
      return res.status(400).json({ error: '请选择内容类别（knowledge/mistake/daily_tip/news）' });
    }
    if (!topic) {
      return res.status(400).json({ error: '请输入内容主题' });
    }
    if (topic.length > 200) {
      return res.status(400).json({ error: '主题长度不能超过200字' });
    }

    const result = await generateContent(category, topic);
    if (!result.success) {
      return res.status(500).json({ error: result.error, code: result.code });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'AI内容生成成功，请审阅后保存'
    });
  } catch (error) {
    console.error('AI内容生成失败:', error);
    res.status(500).json({ error: 'AI内容生成失败' });
  }
});

module.exports = router;
