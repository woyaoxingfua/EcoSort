const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { parseJsonField, toPositiveInt } = require('../utils/common');
const { identifyWithAI, fallbackIdentify, extractKeywordFromImage } = require('../services/aiIdentify');

const VALID_TYPES = ['recyclable', 'hazardous', 'kitchen', 'other'];

const parseCategoryRow = (row) => ({
  ...row,
  typeName: row.type_name,
  examples: parseJsonField(row.examples, [])
});

// 搜索垃圾分类
router.get('/search', async (req, res) => {
  try {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';

    if (!keyword) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }

    const sql = `
      SELECT * FROM trash_categories
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY search_count DESC
      LIMIT 20
    `;

    const results = await query(sql, [`%${keyword}%`, `%${keyword}%`]);

    if (results.length > 0) {
      const ids = results.map((item) => item.id);
      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE trash_categories SET search_count = search_count + 1 WHERE id IN (${placeholders})`,
        ids
      );
    }

    res.json({
      success: true,
      data: results.map(parseCategoryRow),
      count: results.length
    });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 获取所有分类
router.get('/categories', async (req, res) => {
  try {
    const results = await query('SELECT * FROM trash_categories ORDER BY type, id');
    const rows = results.map(parseCategoryRow);

    const grouped = rows.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = {
          type: item.type,
          typeName: item.type_name,
          items: []
        };
      }
      acc[item.type].items.push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: Object.values(grouped)
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ error: '获取分类失败' });
  }
});

// 根据类型获取垃圾列表
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的分类类型' });
    }

    const results = await query(
      'SELECT * FROM trash_categories WHERE type = ? ORDER BY search_count DESC',
      [type]
    );

    res.json({
      success: true,
      data: results.map(parseCategoryRow)
    });
  } catch (error) {
    console.error('获取分类详情失败:', error);
    res.status(500).json({ error: '获取分类详情失败' });
  }
});

// 获取热门搜索
router.get('/hot', async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 10), 30);
    const results = await query(
      'SELECT * FROM trash_categories ORDER BY search_count DESC LIMIT ?',
      [limit]
    );

    res.json({
      success: true,
      data: results.map(parseCategoryRow)
    });
  } catch (error) {
    console.error('获取热门搜索失败:', error);
    res.status(500).json({ error: '获取热门搜索失败' });
  }
});

// AI识别 - 优先使用大模型识别，失败时降级到关键词匹配
router.post('/identify', async (req, res) => {
  try {
    const { imageUrl = '', imageName = '', imageBase64 = '' } = req.body;
    const trimmedBase64 = typeof imageBase64 === 'string' ? imageBase64.trim() : '';
    const aiImageUrl = trimmedBase64
      ? (trimmedBase64.startsWith('data:image') ? trimmedBase64 : `data:image/jpeg;base64,${trimmedBase64}`)
      : imageUrl;

    
    if (!aiImageUrl) {
      return res.status(400).json({ error: '图片不能为空', code: 'EMPTY_IMAGE_URL' });
    }

    let identifyResult;
    let useAI = false;

    // 尝试使用AI识别
    try {
      const aiResult = await identifyWithAI(aiImageUrl);
      if (aiResult.success) {
        identifyResult = aiResult;
        useAI = true;
      } else {
        const hardFailCodes = new Set(['EMPTY_IMAGE_URL', 'AI_KEY_MISSING']);
        if (hardFailCodes.has(aiResult.code)) {
          return res.status(400).json({
            error: aiResult.error,
            code: aiResult.code,
            details: aiResult.details || null
          });
        }

        console.warn('AI识别失败，降级到关键词匹配:', aiResult.code, aiResult.error);
        identifyResult = await fallbackIdentify(imageUrl, imageName);
        identifyResult.aiError = aiResult;
      }
    } catch (aiError) {
      // AI服务不可用，使用降级方案
      console.warn('AI服务错误:', aiError.message, '，使用降级方案');
      identifyResult = await fallbackIdentify(imageUrl, imageName);
      identifyResult.aiError = { code: 'AI_RUNTIME_ERROR', error: aiError.message };
    }

    if (!identifyResult.success || !identifyResult.data) {
      return res.status(400).json({
        error: '无法识别垃圾类型',
        code: identifyResult && identifyResult.aiError ? identifyResult.aiError.code : 'IDENTIFY_FAILED'
      });
    }

    const mainResult = parseCategoryRow(identifyResult.data);
    const confidence = identifyResult.data.confidence || (useAI ? 92 : 85);

    // 记录识别历史和统计信息
    if (req.userId) {
      await transaction(async (connection) => {
        await connection.execute(
          `
          INSERT INTO identify_history (user_id, trash_name, trash_type, image_url, confidence)
          VALUES (?, ?, ?, ?, ?)
          `,
          [req.userId, mainResult.name, mainResult.type, imageUrl || '', confidence]
        );

        await connection.execute(
          'UPDATE users SET identify_count = identify_count + 1 WHERE id = ?',
          [req.userId]
        );

        if (mainResult.id) {
          await connection.execute(
            'UPDATE trash_categories SET search_count = search_count + 1 WHERE id = ?',
            [mainResult.id]
          );
        }
      });
    }

    // 处理alternatives
    const alternatives = (identifyResult.alternatives || []).map((item, index) => {
      const parsed = parseCategoryRow(item);
      return {
        id: parsed.id,
        name: parsed.name,
        type: parsed.type,
        typeName: parsed.typeName,
        icon: parsed.icon,
        confidence: Math.max(0, confidence - (index + 1) * 5 - Math.floor(Math.random() * 3))
      };
    });

    res.json({
      success: true,
      data: {
        id: mainResult.id,
        name: mainResult.name,
        type: mainResult.type,
        typeName: mainResult.typeName,
        tips: mainResult.tips || (identifyResult.data.aiTips),
        icon: mainResult.icon,
        examples: mainResult.examples,
        description: mainResult.description,
        confidence,
        alternatives,
        matchMode: useAI ? 'ai_visual' : identifyResult.matchMode || 'keyword_fallback',
        aiError: useAI ? null : (identifyResult.aiError ? {
          code: identifyResult.aiError.code,
          error: identifyResult.aiError.error,
          details: identifyResult.aiError.details || null
        } : null)
      }
    });
  } catch (error) {
    console.error('识别失败:', error);
    res.status(500).json({ error: '识别失败，请重试' });
  }
});

// 添加垃圾分类（管理员）
router.post('/', async (req, res) => {
  try {
    const { name, type, typeName, tips, icon, examples, description } = req.body;

    if (!name || !type || !typeName) {
      return res.status(400).json({ error: '名称、类型、类型名称不能为空' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的分类类型' });
    }

    const result = await query(
      `
      INSERT INTO trash_categories (name, type, type_name, tips, icon, examples, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
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

    res.json({
      success: true,
      data: { id: result.insertId },
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该垃圾名称已存在' });
    }
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新垃圾分类
router.put('/:id', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的分类ID' });
    }

    const { name, type, typeName, tips, icon, examples, description } = req.body;
    if (!name || !type || !typeName) {
      return res.status(400).json({ error: '名称、类型、类型名称不能为空' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的分类类型' });
    }

    await query(
      `
      UPDATE trash_categories
      SET name = ?, type = ?, type_name = ?, tips = ?, icon = ?, examples = ?, description = ?
      WHERE id = ?
      `,
      [
        String(name).trim(),
        type,
        String(typeName).trim(),
        tips || '',
        icon || '🗑️',
        JSON.stringify(examples || []),
        description || '',
        id
      ]
    );

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除垃圾分类
router.delete('/:id', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的分类ID' });
    }

    await query('DELETE FROM trash_categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;

