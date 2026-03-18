const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { parseJsonField, toFloat, toPositiveInt } = require('../utils/common');

const VALID_TYPES = ['smart', 'recyclable', 'hazardous', 'other'];

const normalizePoint = (row) => ({
  ...row,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  types: parseJsonField(row.types, []),
  prices: parseJsonField(row.prices, {})
});

// 获取附近回收点
router.get('/nearby', async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, null);
    const lng = toFloat(req.query.lng, null);
    const radius = Math.min(toPositiveInt(req.query.radius, 5000), 30000);
    const type = req.query.type;

    if (lat === null || lng === null) {
      return res.status(400).json({ error: '经纬度不能为空' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: '经纬度参数不合法' });
    }
    if (type && type !== 'all' && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的回收点类型' });
    }

    let sql = `
      SELECT *,
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(latitude))
        )) AS distance
      FROM recycle_points
      WHERE status = 1
    `;

    const params = [lat, lng, lat];

    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' HAVING distance < ? ORDER BY distance LIMIT 50';
    params.push(radius / 1000);

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results.map(normalizePoint),
      count: results.length
    });
  } catch (error) {
    console.error('获取回收点失败:', error);
    res.status(500).json({ error: '获取回收点失败' });
  }
});

// 获取所有回收点
router.get('/', async (req, res) => {
  try {
    const status = Number.parseInt(req.query.status, 10);
    const safeStatus = Number.isFinite(status) ? status : 1;
    const type = req.query.type;

    if (type && type !== 'all' && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的回收点类型' });
    }

    let sql = 'SELECT * FROM recycle_points WHERE status = ?';
    const params = [safeStatus];

    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY id DESC';

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results.map(normalizePoint)
    });
  } catch (error) {
    console.error('获取回收点失败:', error);
    res.status(500).json({ error: '获取回收点失败' });
  }
});

// 获取回收点详情
router.get('/:id', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的回收点ID' });
    }

    const results = await query('SELECT * FROM recycle_points WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: '回收点不存在' });
    }

    res.json({
      success: true,
      data: normalizePoint(results[0])
    });
  } catch (error) {
    console.error('获取回收点详情失败:', error);
    res.status(500).json({ error: '获取回收点详情失败' });
  }
});

// 添加回收点
router.post('/', async (req, res) => {
  try {
    const { name, type, address, phone, hours, enterpriseId } = req.body;
    const latitude = toFloat(req.body.latitude, null);
    const longitude = toFloat(req.body.longitude, null);

    if (!name || !type || !address || latitude === null || longitude === null) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的回收点类型' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: '经纬度参数不合法' });
    }

    const result = await query(
      `
      INSERT INTO recycle_points
      (name, type, address, latitude, longitude, phone, hours, types, prices, enterprise_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(name).trim(),
        type,
        String(address).trim(),
        latitude,
        longitude,
        phone || null,
        hours || null,
        JSON.stringify(req.body.types || []),
        JSON.stringify(req.body.prices || {}),
        toPositiveInt(enterpriseId, null)
      ]
    );

    res.json({
      success: true,
      data: { id: result.insertId },
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加回收点失败:', error);
    res.status(500).json({ error: '添加回收点失败' });
  }
});

// 更新回收点
router.put('/:id', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的回收点ID' });
    }

    const { name, type, address, phone, hours } = req.body;
    const latitude = toFloat(req.body.latitude, null);
    const longitude = toFloat(req.body.longitude, null);
    const status = Number.parseInt(req.body.status, 10);

    if (!name || !type || !address || latitude === null || longitude === null) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: '无效的回收点类型' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: '经纬度参数不合法' });
    }

    await query(
      `
      UPDATE recycle_points
      SET name = ?, type = ?, address = ?, latitude = ?, longitude = ?,
          phone = ?, hours = ?, types = ?, prices = ?, status = ?
      WHERE id = ?
      `,
      [
        String(name).trim(),
        type,
        String(address).trim(),
        latitude,
        longitude,
        phone || null,
        hours || null,
        JSON.stringify(req.body.types || []),
        JSON.stringify(req.body.prices || {}),
        Number.isFinite(status) ? status : 1,
        id
      ]
    );

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新回收点失败:', error);
    res.status(500).json({ error: '更新回收点失败' });
  }
});

// 删除回收点
router.delete('/:id', async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id, null);
    if (!id) {
      return res.status(400).json({ error: '无效的回收点ID' });
    }

    await query('DELETE FROM recycle_points WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除回收点失败:', error);
    res.status(500).json({ error: '删除回收点失败' });
  }
});

module.exports = router;
