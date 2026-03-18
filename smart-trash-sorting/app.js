// app.js
const { userAPI, pointAPI, resolveMediaUrl, getApiBaseUrl, ensureApiBaseUrl } = require('./utils/api');
const { formatDate } = require('./utils/util');

App({
  globalData: {
    userInfo: null,
    userId: null,
    openid: null,
    totalPoints: 0,
    checkInDays: 0,
    location: null,
    isLogin: false
  },

  async onLaunch() {
    try {
      const resolved = await ensureApiBaseUrl();
      console.log('当前后端地址:', resolved);
    } catch (error) {
      console.log('当前后端地址:', getApiBaseUrl());
    }
    // 检查本地存储的用户信息
    this.checkLoginStatus();
  },

  normalizeUserInfo(userInfo) {
    if (!userInfo || typeof userInfo !== 'object') {
      return userInfo;
    }

    const normalized = { ...userInfo };
    if (normalized.avatar_url) {
      normalized.avatar_url = resolveMediaUrl(normalized.avatar_url);
    }
    if (normalized.avatarUrl) {
      normalized.avatarUrl = resolveMediaUrl(normalized.avatarUrl);
    }
    return normalized;
  },

  normalizeDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatDate(parsed, 'YYYY-MM-DD');
  },

  getTodayDateKey() {
    return formatDate(new Date(), 'YYYY-MM-DD');
  },

  // 检查登录状态
  checkLoginStatus() {
    const userId = wx.getStorageSync('userId');
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userId && token) {
      this.globalData.userId = userId;
      this.globalData.userInfo = this.normalizeUserInfo(userInfo || {});
      this.globalData.isLogin = true;
      this.globalData.token = token;
      
      // 获取最新用户信息
      this.refreshUserInfo(userId);
    }
  },

  // 刷新用户信息
  async refreshUserInfo(userId) {
    try {
      const res = await userAPI.getUser(userId);
      if (res.success) {
        this.globalData.totalPoints = res.data.total_points;
        this.globalData.checkInDays = res.data.check_in_days;
        // 合并用户信息，保留本地可能有的头像昵称
        this.globalData.userInfo = this.normalizeUserInfo({ ...this.globalData.userInfo, ...res.data });
        wx.setStorageSync('userInfo', this.globalData.userInfo);
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  },

  // 增加积分
  async addPoints(points, reason, relatedId) {
    if (!this.globalData.userId) return;
    
    try {
      const res = await pointAPI.addPoints(this.globalData.userId, points, reason, relatedId);
      if (res.success) {
        this.globalData.totalPoints += points;
        return true;
      }
    } catch (error) {
      console.error('增加积分失败:', error);
    }
    return false;
  },

  // 消费积分
  async consumePoints(points, reason) {
    if (!this.globalData.userId) return false;
    if (this.globalData.totalPoints < points) return false;
    
    try {
      const res = await pointAPI.consumePoints(this.globalData.userId, points, reason);
      if (res.success) {
        this.globalData.totalPoints -= points;
        return true;
      }
    } catch (error) {
      console.error('消费积分失败:', error);
    }
    return false;
  },

  // 完成打卡
  async checkIn() {
    if (!this.globalData.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return null;
    }
    
    // 前端预检查：如果已打卡直接返回
    const userInfo = this.globalData.userInfo;
    if (userInfo && userInfo.last_check_date) {
      const serverDate = this.normalizeDateKey(userInfo.last_check_date);
      const today = this.getTodayDateKey();
      if (serverDate === today) {
        wx.showToast({ title: '今日已打卡', icon: 'none' });
        return null;
      }
    }
    
    try {
      const res = await userAPI.checkIn(this.globalData.userId);
      if (res.success) {
        this.globalData.checkInDays = res.data.checkInDays;
        this.globalData.totalPoints += res.data.points;
        // 更新用户信息中的打卡日期
        if (this.globalData.userInfo) {
          const today = this.getTodayDateKey();
          this.globalData.userInfo.last_check_date = today;
          wx.setStorageSync('userInfo', this.globalData.userInfo);
        }
        // 同步到本地缓存
        wx.setStorageSync('lastCheckDate', this.getTodayDateKey());
        return res.data;
      }
    } catch (error) {
      console.error('打卡失败:', error);
      wx.showToast({ title: error.error || '打卡失败', icon: 'none' });
    }
    return null;
  },

  // 完成任务
  async completeTask(taskId) {
    if (!this.globalData.userId) return null;
    
    try {
      const res = await pointAPI.completeTask(this.globalData.userId, taskId);
      if (res.success) {
        this.globalData.totalPoints += res.data.points;
        return res.data;
      }
    } catch (error) {
      console.error('完成任务失败:', error);
    }
    return null;
  },

  // 退出登录
  logout() {
    this.globalData.userId = null;
    this.globalData.userInfo = null;
    this.globalData.totalPoints = 0;
    this.globalData.checkInDays = 0;
    this.globalData.isLogin = false;
    this.globalData.token = null;
    
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('token');
    wx.removeStorageSync('lastCheckDate');
  }
});
