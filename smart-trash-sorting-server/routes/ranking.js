const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { requireAuth } = require('../utils/auth');
const { toPositiveInt } = require('../utils/common');
const { USER_LEVELS, getUserLevel, computeAchievements } = require('../config/constants');
const { resolveAvatarForResponse } = require('../utils/avatar');

// 获取积分排行榜（公开接口）
router.get('/points', async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 50);

    const sql = `
      SELECT id, nickname, avatar_url, total_points, check_in_days, identify_count,
        (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.total_points > u1.total_points) as rank_num
      FROM users u1
      ORDER BY total_points DESC
      LIMIT ?
    `;
    const results = await query(sql, [limit]);

    const rankList = results.map(user => {
      const level = getUserLevel(user.total_points);
      return {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: resolveAvatarForResponse(req, user.avatar_url),
        totalPoints: user.total_points,
        checkInDays: user.check_in_days,
        identifyCount: user.identify_count,
        rank: user.rank_num,
        level: {
          level: level.level,
          name: level.name,
          icon: level.icon
        }
      };
    });

    res.json({
      success: true,
      data: rankList
    });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// 获取识别排行榜
router.get('/identify', async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 50);

    const sql = `
      SELECT id, nickname, avatar_url, total_points, identify_count,
        (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.identify_count > u1.identify_count) as rank_num
      FROM users u1
      WHERE identify_count > 0
      ORDER BY identify_count DESC
      LIMIT ?
    `;
    const results = await query(sql, [limit]);

    res.json({
      success: true,
      data: results.map(user => ({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: resolveAvatarForResponse(req, user.avatar_url),
        totalPoints: user.total_points,
        identifyCount: user.identify_count,
        rank: user.rank_num
      }))
    });
  } catch (error) {
    console.error('获取识别排行榜失败:', error);
    res.status(500).json({ error: '获取识别排行榜失败' });
  }
});

// 获取打卡排行榜
router.get('/checkin', async (req, res) => {
  try {
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 50);

    const sql = `
      SELECT id, nickname, avatar_url, total_points, check_in_days,
        (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.check_in_days > u1.check_in_days) as rank_num
      FROM users u1
      WHERE check_in_days > 0
      ORDER BY check_in_days DESC
      LIMIT ?
    `;
    const results = await query(sql, [limit]);

    res.json({
      success: true,
      data: results.map(user => ({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: resolveAvatarForResponse(req, user.avatar_url),
        totalPoints: user.total_points,
        checkInDays: user.check_in_days,
        rank: user.rank_num
      }))
    });
  } catch (error) {
    console.error('获取打卡排行榜失败:', error);
    res.status(500).json({ error: '获取打卡排行榜失败' });
  }
});

// 获取当前用户排名
router.get('/myrank', requireAuth, async (req, res) => {
  try {
    const userId = toPositiveInt(req.userId);
    if (!userId) {
      return res.status(401).json({ error: '请先登录' });
    }

    const user = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 积分排名
    const pointsRank = await query(
      'SELECT COUNT(*) + 1 as rank_num FROM users WHERE total_points > ?',
      [user[0].total_points]
    );

    // 识别排名
    const identifyRank = await query(
      'SELECT COUNT(*) + 1 as rank_num FROM users WHERE identify_count > ?',
      [user[0].identify_count]
    );

    // 打卡排名
    const checkinRank = await query(
      'SELECT COUNT(*) + 1 as rank_num FROM users WHERE check_in_days > ?',
      [user[0].check_in_days]
    );

    // 总用户数
    const totalUsers = await query('SELECT COUNT(*) as count FROM users');

    res.json({
      success: true,
      data: {
        pointsRank: pointsRank[0].rank_num,
        identifyRank: identifyRank[0].rank_num,
        checkinRank: checkinRank[0].rank_num,
        totalUsers: totalUsers[0].count
      }
    });
  } catch (error) {
    console.error('获取排名失败:', error);
    res.status(500).json({ error: '获取排名失败' });
  }
});

// 获取用户等级列表
router.get('/levels', async (req, res) => {
  res.json({
    success: true,
    data: USER_LEVELS
  });
});

// 获取成就列表
router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const userId = toPositiveInt(req.userId);
    if (!userId) {
      return res.status(401).json({ error: '请先登录' });
    }

    // 用户当前数据
    const user = await query('SELECT * FROM users WHERE id = ?', [userId]);
    const favoriteCount = await query('SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?', [userId]);
    const exchangeCount = await query('SELECT COUNT(*) as count FROM exchange_records WHERE user_id = ?', [userId]);
    const claimedRows = await query(
      'SELECT achievement_id FROM user_achievements WHERE user_id = ?',
      [userId]
    );
    const claimedSet = new Set(claimedRows.map(row => row.achievement_id));

    const userData = {
      identify_count: user[0]?.identify_count || 0,
      checkin_days: user[0]?.check_in_days || 0,
      total_points: user[0]?.total_points || 0,
      exchange_count: exchangeCount[0]?.count || 0,
      favorite_count: favoriteCount[0]?.count || 0,
      share_count: 0
    };

    const achievements = computeAchievements(userData, claimedSet);

    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    console.error('获取成就列表失败:', error);
    res.status(500).json({ error: '获取成就列表失败' });
  }
});

// 领取成就奖励
router.post('/achievements/claim', requireAuth, async (req, res) => {
  try {
    const userId = toPositiveInt(req.userId);
    const achievementId = toPositiveInt(req.body.achievementId, null);

    if (!userId || !achievementId) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 从常量中查找成就定义
    const { ACHIEVEMENTS } = require('../config/constants');
    const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!ach) {
      return res.status(404).json({ error: '成就不存在' });
    }

    // 检查是否已领取
    const existing = await query(
      'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
      [userId, achievementId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '成就奖励已领取' });
    }

    // 验证是否达成条件
    const user = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    let currentValue = 0;
    switch (ach.condition_type) {
      case 'identify_count': currentValue = user[0].identify_count; break;
      case 'checkin_days': currentValue = user[0].check_in_days; break;
      case 'total_points': currentValue = user[0].total_points; break;
      case 'exchange_count': {
        const r = await query('SELECT COUNT(*) as count FROM exchange_records WHERE user_id = ?', [userId]);
        currentValue = r[0].count;
        break;
      }
      case 'favorite_count': {
        const r = await query('SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?', [userId]);
        currentValue = r[0].count;
        break;
      }
    }

    if (currentValue < ach.condition_value) {
      return res.status(400).json({ error: '未达成成就条件' });
    }

    // 记录成就并发放奖励
    await query(
      'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
      [userId, achievementId]
    );

    if (ach.points_reward > 0) {
      await query(
        'UPDATE users SET total_points = total_points + ? WHERE id = ?',
        [ach.points_reward, userId]
      );
      await query(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [userId, ach.points_reward, 'add', `成就奖励：${ach.name}`]
      );
    }

    res.json({
      success: true,
      data: { pointsReward: ach.points_reward },
      message: `恭喜获得成就「${ach.name}」！获得${ach.points_reward}积分`
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '成就奖励已领取' });
    }
    console.error('领取成就失败:', error);
    res.status(500).json({ error: '领取成就失败' });
  }
});

module.exports = router;
