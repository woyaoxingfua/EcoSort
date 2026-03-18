// 用户等级定义（原 user_levels 表）
const USER_LEVELS = [
  { id: 1, level: 1, name: '环保新手', icon: '🌱', min_points: 0, max_points: 99, privileges: '基础功能使用' },
  { id: 2, level: 2, name: '环保学徒', icon: '🌿', min_points: 100, max_points: 299, privileges: '每日签到积分+2' },
  { id: 3, level: 3, name: '环保达人', icon: '🌳', min_points: 300, max_points: 599, privileges: '每日签到积分+5，解锁高级搜索' },
  { id: 4, level: 4, name: '环保先锋', icon: '🌲', min_points: 600, max_points: 999, privileges: '每日签到积分+8，兑换享9折' },
  { id: 5, level: 5, name: '环保卫士', icon: '🏅', min_points: 1000, max_points: 1999, privileges: '每日签到积分+10，兑换享8折' },
  { id: 6, level: 6, name: '环保大使', icon: '🎖️', min_points: 2000, max_points: 4999, privileges: '每日签到积分+15，专属客服' },
  { id: 7, level: 7, name: '环保之星', icon: '⭐', min_points: 5000, max_points: 9999, privileges: '每日签到积分+20，优先兑换' },
  { id: 8, level: 8, name: '环保传奇', icon: '👑', min_points: 10000, max_points: 99999, privileges: '全部特权，荣誉展示' }
];

// 成就定义（原 achievements 表）
const ACHIEVEMENTS = [
  { id: 1, name: '初次识别', description: '完成第一次垃圾识别', icon: '🎯', condition_type: 'identify_count', condition_value: 1, points_reward: 10 },
  { id: 2, name: '识别达人', description: '累计识别50次垃圾', icon: '🔍', condition_type: 'identify_count', condition_value: 50, points_reward: 50 },
  { id: 3, name: '识别专家', description: '累计识别200次垃圾', icon: '🏆', condition_type: 'identify_count', condition_value: 200, points_reward: 200 },
  { id: 4, name: '连续签到3天', description: '连续签到3天', icon: '📅', condition_type: 'checkin_days', condition_value: 3, points_reward: 20 },
  { id: 5, name: '连续签到7天', description: '连续签到一周', icon: '🔥', condition_type: 'checkin_days', condition_value: 7, points_reward: 50 },
  { id: 6, name: '连续签到30天', description: '连续签到一个月', icon: '💎', condition_type: 'checkin_days', condition_value: 30, points_reward: 300 },
  { id: 7, name: '积分破百', description: '累计获得100积分', icon: '💰', condition_type: 'total_points', condition_value: 100, points_reward: 10 },
  { id: 8, name: '积分千元户', description: '累计获得1000积分', icon: '🤑', condition_type: 'total_points', condition_value: 1000, points_reward: 100 },
  { id: 9, name: '环保先锋', description: '累计获得5000积分', icon: '🌟', condition_type: 'total_points', condition_value: 5000, points_reward: 500 },
  { id: 10, name: '首次兑换', description: '完成第一次奖品兑换', icon: '🎁', condition_type: 'exchange_count', condition_value: 1, points_reward: 20 },
  { id: 11, name: '收藏家', description: '收藏10个垃圾分类知识', icon: '⭐', condition_type: 'favorite_count', condition_value: 10, points_reward: 30 },
  { id: 12, name: '分享达人', description: '分享小程序给好友', icon: '📤', condition_type: 'share_count', condition_value: 1, points_reward: 15 }
];

// 任务定义（原 tasks 表）
const TASKS = [
  { id: 1, name: '每日打卡', description: '每日登录签到', icon: '📅', points: 10, type: 'checkin', daily_limit: 1, status: 1 },
  { id: 2, name: '拍照识别', description: '使用AI识别垃圾', icon: '📷', points: 5, type: 'identify', daily_limit: 10, status: 1 },
  { id: 3, name: '文字搜索', description: '搜索垃圾分类知识', icon: '🔍', points: 2, type: 'search', daily_limit: 10, status: 1 },
  { id: 4, name: '语音查询', description: '使用语音查询垃圾', icon: '🎤', points: 3, type: 'voice', daily_limit: 10, status: 1 },
  { id: 5, name: '查看科普', description: '阅读垃圾分类知识', icon: '📚', points: 2, type: 'science', daily_limit: 5, status: 1 }
];

// 根据积分获取用户等级
function getUserLevel(totalPoints) {
  return USER_LEVELS.find(l => totalPoints >= l.min_points && totalPoints <= l.max_points) || USER_LEVELS[0];
}

// 根据用户数据计算已达成的成就
function computeAchievements(userData, claimedLookup = null) {
  return ACHIEVEMENTS.map(ach => {
    let currentValue = 0;
    switch (ach.condition_type) {
      case 'identify_count': currentValue = userData.identify_count || 0; break;
      case 'checkin_days': currentValue = userData.checkin_days || 0; break;
      case 'total_points': currentValue = userData.total_points || 0; break;
      case 'exchange_count': currentValue = userData.exchange_count || 0; break;
      case 'favorite_count': currentValue = userData.favorite_count || 0; break;
      case 'share_count': currentValue = userData.share_count || 0; break;
    }
    const completed = currentValue >= ach.condition_value;
    let claimed = false;
    let claimedAt = null;
    if (claimedLookup instanceof Map) {
      claimedAt = claimedLookup.get(ach.id) || null;
      claimed = Boolean(claimedAt);
    } else if (claimedLookup instanceof Set) {
      claimed = claimedLookup.has(ach.id);
    }
    return {
      id: ach.id,
      name: ach.name,
      description: ach.description,
      icon: ach.icon,
      conditionType: ach.condition_type,
      conditionValue: ach.condition_value,
      pointsReward: ach.points_reward,
      achieved: claimed,
      achievedAt: claimedAt,
      completed,
      currentValue,
      progress: Math.min(Math.round((currentValue / ach.condition_value) * 100), 100)
    };
  });
}

module.exports = { USER_LEVELS, ACHIEVEMENTS, TASKS, getUserLevel, computeAchievements };
