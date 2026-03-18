const express = require('express');
const router = express.Router();
const axios = require('axios');
const { query, transaction } = require('../config/database');
const { generateToken, requireAuth } = require('../utils/auth');
const { toPositiveInt, getLocalDateString } = require('../utils/common');
const { TASKS, ACHIEVEMENTS, getUserLevel } = require('../config/constants');
const { normalizeAvatarForStorage, resolveAvatarForResponse } = require('../utils/avatar');

const normalizeDateKey = (value) => {
  if (!value) return '';

  if (value instanceof Date) {
    return getLocalDateString(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const shortDate = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(shortDate)) {
      return shortDate;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getLocalDateString(parsed);
    }
  }

  return '';
};

const toDayIndex = (dateKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) {
    return null;
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
};

const sanitizeUser = (req, user) => {
  if (!user) return null;
  return {
    id: user.id,
    nickname: user.nickname,
    avatar_url: resolveAvatarForResponse(req, user.avatar_url),
    total_points: user.total_points,
    check_in_days: user.check_in_days,
    last_check_date: normalizeDateKey(user.last_check_date) || null,
    identify_count: user.identify_count,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
};

const ensureSelfAccess = (req, res, id) => {
  if (Number(req.userId) !== Number(id)) {
    res.status(403).json({ error: '无权访问其他用户数据' });
    return false;
  }
  return true;
};

// ========== 微信小程序登录 ==========
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo, devOpenId } = req.body;
    const disableMockLogin = String(process.env.WECHAT_DISABLE_MOCK_LOGIN ?? 'true').toLowerCase() === 'true';
    
    if (!code) {
      return res.status(400).json({ error: '授权码不能为空' });
    }

    let openid;
    let isMockLogin = false;
    
    // 步骤1：调用微信接口获取 openid
    try {
      const appid = process.env.WECHAT_APPID || 'your_appid';
      const secret = process.env.WECHAT_SECRET || 'your_secret';
      
      // 如果配置的是默认值，直接走模拟登录
      if (appid === 'your_appid' || secret === 'your_secret') {
        throw new Error('WECHAT_CONFIG_NOT_SET');
      }
      
      const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
      const wxResponse = await axios.get(wxUrl, { timeout: 10000 });
      
      if (wxResponse.data && wxResponse.data.openid) {
        openid = wxResponse.data.openid;
      } else if (wxResponse.data && wxResponse.data.errcode) {
        console.error('微信接口返回错误:', wxResponse.data);
        throw new Error(`WECHAT_API_ERROR: ${wxResponse.data.errmsg}`);
      } else {
        throw new Error('WECHAT_INVALID_RESPONSE');
      }
    } catch (wxError) {
      // 生产环境或强制真实登录：直接返回错误
      if (process.env.NODE_ENV === 'production' || disableMockLogin) {
        console.error('微信登录接口调用失败:', wxError.message);
        if (String(wxError.message || '').includes('WECHAT_CONFIG_NOT_SET')) {
          return res.status(500).json({ error: '微信登录配置缺失，请配置 WECHAT_APPID 和 WECHAT_SECRET' });
        }
        return res.status(502).json({ error: '微信登录服务异常，请稍后重试' });
      }
      
      // 开发环境：必须使用前端提供的稳定 devOpenId，避免把昵称/头像当作身份标识
      isMockLogin = true;
      if (typeof devOpenId === 'string' && devOpenId.trim()) {
        const trimmed = devOpenId.trim();
        openid = trimmed.startsWith('dev_') ? trimmed : `dev_${trimmed}`;
      } else {
        return res.status(400).json({ error: '开发环境缺少稳定登录标识，请重试登录' });
      }
      console.log('📝 开发环境模拟登录，使用 devOpenId:', openid);
    }

    // 步骤2：查询或创建用户
    let user = await query('SELECT * FROM users WHERE openid = ?', [openid]);
    let isNewUser = false;

    if (user.length === 0) {
      // 创建新用户
      isNewUser = true;
      
      // 处理用户信息
      const nickname = userInfo?.nickName?.trim() || userInfo?.nickname?.trim() || `环保用户${Date.now().toString().slice(-4)}`;
      const avatarUrl = normalizeAvatarForStorage(userInfo?.avatarUrl || userInfo?.avatar_url || '');
      
      const result = await query(
        'INSERT INTO users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
        [openid, nickname, avatarUrl]
      );
      
      user = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      console.log('✅ 新用户创建:', user[0].id, nickname);
    } else {
      // 老用户：只在提供了新信息时更新
      if (userInfo && (userInfo.nickName || userInfo.avatarUrl || userInfo.nickname || userInfo.avatar_url)) {
        const newNickname = userInfo.nickName || userInfo.nickname;
        const rawAvatar = userInfo.avatarUrl ?? userInfo.avatar_url;
        const newAvatar = rawAvatar === undefined ? null : normalizeAvatarForStorage(rawAvatar);
        
        await query(
          'UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url) WHERE openid = ?',
          [newNickname, newAvatar, openid]
        );
        user = await query('SELECT * FROM users WHERE openid = ?', [openid]);
        console.log('👤 老用户登录:', user[0].id, user[0].nickname);
      }
    }

    // 步骤3：生成 JWT Token
    const token = generateToken({ 
      userId: user[0].id, 
      openid: openid,
      userType: 'user'
    });

    const safeUser = sanitizeUser(req, user[0]);

    res.json({
      success: true,
      data: { ...safeUser, token },
      isNewUser,
      isMockLogin, // 告诉前端是否是模拟登录
      loginIdentityType: isMockLogin ? 'dev_openid' : 'wechat_openid'
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败: ' + error.message });
  }
});

// 获取用户信息
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;
    
    const user = await query('SELECT * FROM users WHERE id = ?', [id]);
    
    if (user.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      success: true,
      data: sanitizeUser(req, user[0])
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;

    const { nickname } = req.body;
    const avatarUrlRaw = req.body.avatarUrl;
    const safeNickname = typeof nickname === 'string' ? nickname.trim() : '';
    const safeAvatarUrl = avatarUrlRaw === undefined ? undefined : normalizeAvatarForStorage(avatarUrlRaw);

    if (safeNickname && safeNickname.length > 50) {
      return res.status(400).json({ error: '昵称长度不能超过50个字符' });
    }

    // 动态构建更新字段
    const updates = [];
    const params = [];
    
    if (safeNickname) {
      updates.push('nickname = ?');
      params.push(safeNickname);
    }
    if (avatarUrlRaw !== undefined) {
      updates.push('avatar_url = ?');
      params.push(safeAvatarUrl);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的内容' });
    }
    
    params.push(id);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 用户打卡（使用事务保证数据一致性）
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;

    const today = getLocalDateString();
    let responseData = null;

    await transaction(async (connection) => {
      const [users] = await connection.execute(
        'SELECT id, check_in_days, last_check_date FROM users WHERE id = ? FOR UPDATE',
        [id]
      );

      if (users.length === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      const user = users[0];
      const lastCheckDate = normalizeDateKey(user.last_check_date);

      if (lastCheckDate === today) {
        throw new Error('ALREADY_CHECKED_IN');
      }

      let checkInDays = user.check_in_days || 0;
      if (lastCheckDate) {
        const todayIndex = toDayIndex(today);
        const lastIndex = toDayIndex(lastCheckDate);
        const diffDays = todayIndex !== null && lastIndex !== null
          ? (todayIndex - lastIndex)
          : 0;
        checkInDays = diffDays === 1 ? checkInDays + 1 : 1;
      } else {
        checkInDays = 1;
      }

      const basePoints = 10;
      const bonusPoints = checkInDays % 7 === 0 ? 50 : 0;
      const totalPointsEarned = basePoints + bonusPoints;

      await connection.execute(
        'UPDATE users SET check_in_days = ?, last_check_date = ?, total_points = total_points + ? WHERE id = ?',
        [checkInDays, today, totalPointsEarned, id]
      );

      await connection.execute(
        'INSERT INTO point_records (user_id, points, type, reason) VALUES (?, ?, ?, ?)',
        [id, totalPointsEarned, 'add', bonusPoints > 0 ? `每日打卡 + 连续${checkInDays}天奖励` : '每日打卡']
      );

      // 同时完成"每日打卡"任务（如果存在）
      const checkinTask = TASKS.find(t => t.type === 'checkin' && t.status === 1);
      if (checkinTask) {
        const [existingTask] = await connection.execute(
          'SELECT id FROM user_tasks WHERE user_id = ? AND task_id = ? AND complete_date = ?',
          [id, checkinTask.id, today]
        );
        if (existingTask.length === 0) {
          await connection.execute(
            'INSERT INTO user_tasks (user_id, task_id, complete_date, complete_count) VALUES (?, ?, ?, 1)',
            [id, checkinTask.id, today]
          );
        }
      }

      responseData = {
        checkInDays,
        points: totalPointsEarned,
        bonusPoints,
        message: bonusPoints > 0
          ? `打卡成功！连续${checkInDays}天奖励 +${totalPointsEarned}分`
          : `打卡成功 +${basePoints}分`
      };
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (error.message === 'ALREADY_CHECKED_IN') {
      return res.status(400).json({ error: '今日已打卡' });
    }
    console.error('打卡失败:', error);
    res.status(500).json({ error: '打卡失败' });
  }
});

// 获取用户识别历史
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;

    const limit = toPositiveInt(req.query.limit, 50);

    const sql = `
      SELECT * FROM identify_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    const results = await query(sql, [id, limit]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取识别历史失败:', error);
    res.status(500).json({ error: '获取识别历史失败' });
  }
});

// 清空用户识别历史
router.delete('/:id/history', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;

    await query('DELETE FROM identify_history WHERE user_id = ?', [id]);

    res.json({
      success: true,
      message: '识别历史已清空'
    });
  } catch (error) {
    console.error('清空识别历史失败:', error);
    res.status(500).json({ error: '清空识别历史失败' });
  }
});

// 获取用户统计信息
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    if (!ensureSelfAccess(req, res, id)) return;

    // 用户基本信息
    const user = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 用户等级信息
    const userLevel = getUserLevel(user[0].total_points);
    const nextLevel = userLevel.level < 8
      ? require('../config/constants').USER_LEVELS.find(l => l.level === userLevel.level + 1)
      : null;

    // 识别统计
    const identifyStats = await query(
      'SELECT COUNT(*) as count, trash_type FROM identify_history WHERE user_id = ? GROUP BY trash_type',
      [id]
    );

    // 本月积分
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthPoints = await query(
      'SELECT SUM(points) as total FROM point_records WHERE user_id = ? AND type = "add" AND DATE_FORMAT(created_at, "%Y-%m") = ?',
      [id, currentMonth]
    );

    // 积分排名
    const pointsRank = await query(
      'SELECT COUNT(*) + 1 as rank_num FROM users WHERE total_points > ?',
      [user[0].total_points]
    );

    // 已获成就数（从用户数据实时计算）
    const favoriteCount = await query(
      'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?',
      [id]
    );
    const exchangeCount = await query('SELECT COUNT(*) as count FROM exchange_records WHERE user_id = ?', [id]);
    const userData = {
      identify_count: user[0]?.identify_count || 0,
      checkin_days: user[0]?.check_in_days || 0,
      total_points: user[0]?.total_points || 0,
      exchange_count: exchangeCount[0]?.count || 0,
      favorite_count: favoriteCount[0]?.count || 0,
      share_count: 0
    };
    const achievedCount = ACHIEVEMENTS.filter(ach => {
      let v = 0;
      switch (ach.condition_type) {
        case 'identify_count': v = userData.identify_count; break;
        case 'checkin_days': v = userData.checkin_days; break;
        case 'total_points': v = userData.total_points; break;
        case 'exchange_count': v = userData.exchange_count; break;
        case 'favorite_count': v = userData.favorite_count; break;
        case 'share_count': v = userData.share_count; break;
      }
      return v >= ach.condition_value;
    }).length;

    res.json({
      success: true,
      data: {
        user: sanitizeUser(req, user[0]),
        level: {
          current: userLevel,
          next: nextLevel,
          progress: nextLevel
            ? Math.round(((user[0].total_points - userLevel.min_points) / (nextLevel.min_points - userLevel.min_points)) * 100)
            : 100
        },
        identifyStats,
        monthPoints: monthPoints[0]?.total || 0,
        rank: pointsRank[0].rank_num,
        achievements: {
          achieved: achievedCount,
          total: ACHIEVEMENTS.length
        },
        favoriteCount: favoriteCount[0].count
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

module.exports = router;
