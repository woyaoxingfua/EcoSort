const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { requireAuth } = require('../utils/auth');
const { getLocalDateString, toPositiveInt } = require('../utils/common');
const { TASKS } = require('../config/constants');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parsePaging = (pageRaw, limitRaw, defaultLimit = 20, maxLimit = 100) => {
  const page = clamp(toPositiveInt(pageRaw, 1), 1, 10000);
  const limit = clamp(toPositiveInt(limitRaw, defaultLimit), 1, maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const resolveUserId = (req, userIdInput) => {
  const tokenUserId = toPositiveInt(req.userId);
  const requestUserId = toPositiveInt(userIdInput, null);

  if (!tokenUserId) {
    return { ok: false, error: '请先登录', status: 401 };
  }

  if (requestUserId && requestUserId !== tokenUserId) {
    return { ok: false, error: '无权访问其他用户数据', status: 403 };
  }

  return { ok: true, userId: tokenUserId };
};

router.use(requireAuth);

// 获取用户积分记录
router.get('/records/:userId', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.params.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const { limit, offset } = parsePaging(req.query.page, req.query.limit, 50, 200);

    const sql = `
      SELECT * FROM point_records
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await query(sql, [userCheck.userId, limit, offset]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取积分记录失败:', error);
    res.status(500).json({ error: '获取积分记录失败' });
  }
});

// 添加积分
router.post('/add', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.body.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const points = toPositiveInt(req.body.points, null);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    const relatedId = toPositiveInt(req.body.relatedId, null);

    if (!points || !reason) {
      return res.status(400).json({ error: '积分和原因不能为空' });
    }

    await transaction(async (connection) => {
      const [updateResult] = await connection.execute(
        'UPDATE users SET total_points = total_points + ? WHERE id = ?',
        [points, userCheck.userId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason, related_id) VALUES (?, ?, ?, ?, ?)',
        [userCheck.userId, points, 'add', reason, relatedId]
      );
    });

    res.json({
      success: true,
      message: '积分添加成功'
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    console.error('添加积分失败:', error);
    res.status(500).json({ error: '添加积分失败' });
  }
});

// 消费积分
router.post('/consume', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.body.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const points = toPositiveInt(req.body.points, null);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!points || !reason) {
      return res.status(400).json({ error: '积分和原因不能为空' });
    }

    await transaction(async (connection) => {
      const [consumeResult] = await connection.execute(
        'UPDATE users SET total_points = total_points - ? WHERE id = ? AND total_points >= ?',
        [points, userCheck.userId, points]
      );

      if (consumeResult.affectedRows === 0) {
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [userCheck.userId]);
        throw new Error(users.length === 0 ? 'USER_NOT_FOUND' : 'INSUFFICIENT_POINTS');
      }

      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [userCheck.userId, -points, 'consume', reason]
      );
    });

    res.json({
      success: true,
      message: '积分消费成功'
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (error.message === 'INSUFFICIENT_POINTS') {
      return res.status(400).json({ error: '积分不足' });
    }
    console.error('消费积分失败:', error);
    res.status(500).json({ error: '消费积分失败' });
  }
});

// 获取任务列表
router.get('/tasks', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.query.userId || req.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const tasks = TASKS.filter(t => t.status === 1);
    const today = getLocalDateString();
    const completedTasks = await query(
      'SELECT task_id, complete_count FROM user_tasks WHERE user_id = ? AND complete_date = ?',
      [userCheck.userId, today]
    );

    const completedMap = completedTasks.reduce((acc, item) => {
      acc[item.task_id] = item.complete_count;
      return acc;
    }, {});

    const taskList = tasks.map((task) => ({
      ...task,
      completedCount: completedMap[task.id] || 0,
      isCompleted: (completedMap[task.id] || 0) >= task.daily_limit
    }));

    res.json({
      success: true,
      data: taskList
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

// 完成任务
router.post('/tasks/complete', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.body.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const taskId = toPositiveInt(req.body.taskId, null);
    if (!taskId) {
      return res.status(400).json({ error: '任务ID不能为空' });
    }

    const today = getLocalDateString();
    let gainedPoints = 0;

    await transaction(async (connection) => {
      const task = TASKS.find(t => t.id === taskId && t.status === 1);

      if (!task) {
        throw new Error('TASK_NOT_FOUND');
      }

      const [userTaskRows] = await connection.execute(
        'SELECT id, complete_count FROM user_tasks WHERE user_id = ? AND task_id = ? AND complete_date = ? FOR UPDATE',
        [userCheck.userId, taskId, today]
      );

      const currentCount = userTaskRows.length > 0 ? userTaskRows[0].complete_count : 0;
      if (currentCount >= task.daily_limit) {
        throw new Error('TASK_LIMIT_REACHED');
      }

      if (userTaskRows.length === 0) {
        await connection.execute(
          'INSERT INTO user_tasks (user_id, task_id, complete_date, complete_count) VALUES (?, ?, ?, 1)',
          [userCheck.userId, taskId, today]
        );
      } else {
        await connection.execute(
          'UPDATE user_tasks SET complete_count = complete_count + 1 WHERE id = ?',
          [userTaskRows[0].id]
        );
      }

      const [updateResult] = await connection.execute(
        'UPDATE users SET total_points = total_points + ? WHERE id = ?',
        [task.points, userCheck.userId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [userCheck.userId, task.points, 'add', `完成任务：${task.name}`]
      );

      gainedPoints = task.points;
    });

    res.json({
      success: true,
      data: {
        points: gainedPoints,
        message: `获得 ${gainedPoints} 积分`
      }
    });
  } catch (error) {
    if (error.message === 'TASK_NOT_FOUND') {
      return res.status(404).json({ error: '任务不存在' });
    }
    if (error.message === 'TASK_LIMIT_REACHED') {
      return res.status(400).json({ error: '今日任务已完成' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    console.error('完成任务失败:', error);
    res.status(500).json({ error: '完成任务失败' });
  }
});

// 获取奖品列表
router.get('/prizes', async (req, res) => {
  try {
    const status = Number.parseInt(req.query.status, 10);
    const safeStatus = Number.isFinite(status) ? status : 1;

    const sql = 'SELECT * FROM prizes WHERE status = ? ORDER BY points';
    const results = await query(sql, [safeStatus]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取奖品列表失败:', error);
    res.status(500).json({ error: '获取奖品列表失败' });
  }
});

// 兑换奖品
router.post('/exchange', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.body.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const prizeId = toPositiveInt(req.body.prizeId, null);
    if (!prizeId) {
      return res.status(400).json({ error: '奖品ID不能为空' });
    }

    const address = typeof req.body.address === 'string' ? req.body.address.trim() : null;
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : null;

    await transaction(async (connection) => {
      const [prizes] = await connection.execute(
        'SELECT id, name, points, stock FROM prizes WHERE id = ? AND status = 1 FOR UPDATE',
        [prizeId]
      );

      if (prizes.length === 0) {
        throw new Error('PRIZE_NOT_FOUND');
      }

      const prize = prizes[0];
      if (prize.stock <= 0) {
        throw new Error('PRIZE_OUT_OF_STOCK');
      }

      const [consumeResult] = await connection.execute(
        'UPDATE users SET total_points = total_points - ? WHERE id = ? AND total_points >= ?',
        [prize.points, userCheck.userId, prize.points]
      );

      if (consumeResult.affectedRows === 0) {
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [userCheck.userId]);
        throw new Error(users.length === 0 ? 'USER_NOT_FOUND' : 'INSUFFICIENT_POINTS');
      }

      const [stockResult] = await connection.execute(
        'UPDATE prizes SET stock = stock - 1 WHERE id = ? AND stock > 0',
        [prizeId]
      );

      if (stockResult.affectedRows === 0) {
        throw new Error('PRIZE_OUT_OF_STOCK');
      }

      await connection.execute(
        'INSERT INTO exchange_records (user_id, prize_id, points, status, address, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [userCheck.userId, prizeId, prize.points, 'pending', address, phone]
      );

      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [userCheck.userId, -prize.points, 'consume', `兑换：${prize.name}`]
      );
    });

    res.json({
      success: true,
      message: '兑换成功'
    });
  } catch (error) {
    if (error.message === 'PRIZE_NOT_FOUND') {
      return res.status(404).json({ error: '奖品不存在' });
    }
    if (error.message === 'PRIZE_OUT_OF_STOCK') {
      return res.status(400).json({ error: '奖品库存不足' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (error.message === 'INSUFFICIENT_POINTS') {
      return res.status(400).json({ error: '积分不足' });
    }
    console.error('兑换失败:', error);
    res.status(500).json({ error: '兑换失败' });
  }
});

// 获取用户兑换记录
router.get('/exchanges/:userId', async (req, res) => {
  try {
    const userCheck = resolveUserId(req, req.params.userId);
    if (!userCheck.ok) {
      return res.status(userCheck.status).json({ error: userCheck.error });
    }

    const sql = `
      SELECT er.*, p.name as prize_name, p.icon as prize_icon
      FROM exchange_records er
      JOIN prizes p ON er.prize_id = p.id
      WHERE er.user_id = ?
      ORDER BY er.created_at DESC
    `;

    const results = await query(sql, [userCheck.userId]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    res.status(500).json({ error: '获取兑换记录失败' });
  }
});

module.exports = router;
