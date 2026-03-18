const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { requireAuth } = require('../utils/auth');
const { toPositiveInt } = require('../utils/common');

const ensureSelf = (req, res, userIdInput) => {
  const requestUserId = toPositiveInt(userIdInput, null);
  const tokenUserId = toPositiveInt(req.userId, null);

  if (!tokenUserId) {
    res.status(401).json({ error: '请先登录' });
    return null;
  }
  if (requestUserId && requestUserId !== tokenUserId) {
    res.status(403).json({ error: '无权访问其他用户数据' });
    return null;
  }
  return tokenUserId;
};

router.use(requireAuth);

// 添加收藏
router.post('/', async (req, res) => {
  try {
    const userId = ensureSelf(req, res, req.body.userId);
    if (!userId) return;

    const trashId = toPositiveInt(req.body.trashId, null);
    if (!trashId) {
      return res.status(400).json({ error: '垃圾分类ID不能为空' });
    }

    await query(
      'INSERT INTO user_favorites (user_id, trash_id) VALUES (?, ?)',
      [userId, trashId]
    );

    res.json({
      success: true,
      message: '收藏成功'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '已收藏过该项目' });
    }
    console.error('收藏失败:', error);
    res.status(500).json({ error: '收藏失败' });
  }
});

// 取消收藏
router.delete('/', async (req, res) => {
  try {
    const userId = ensureSelf(req, res, req.body.userId);
    if (!userId) return;

    const trashId = toPositiveInt(req.body.trashId, null);
    if (!trashId) {
      return res.status(400).json({ error: '垃圾分类ID不能为空' });
    }

    await query('DELETE FROM user_favorites WHERE user_id = ? AND trash_id = ?', [userId, trashId]);

    res.json({
      success: true,
      message: '已取消收藏'
    });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

// 检查是否已收藏
router.get('/check/:userId/:trashId', async (req, res) => {
  try {
    const userId = ensureSelf(req, res, req.params.userId);
    if (!userId) return;

    const trashId = toPositiveInt(req.params.trashId, null);
    if (!trashId) {
      return res.status(400).json({ error: '无效的垃圾分类ID' });
    }

    const results = await query(
      'SELECT id FROM user_favorites WHERE user_id = ? AND trash_id = ?',
      [userId, trashId]
    );

    res.json({
      success: true,
      data: { isFavorited: results.length > 0 }
    });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ error: '检查收藏状态失败' });
  }
});

// 获取用户收藏列表
router.get('/:userId', async (req, res) => {
  try {
    const userId = ensureSelf(req, res, req.params.userId);
    if (!userId) return;

    const results = await query(
      `
      SELECT uf.id, uf.created_at as favorited_at,
             tc.id as trash_id, tc.name, tc.type, tc.type_name, tc.tips, tc.icon, tc.examples, tc.description
      FROM user_favorites uf
      JOIN trash_categories tc ON uf.trash_id = tc.id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ error: '获取收藏列表失败' });
  }
});

module.exports = router;
