// pages/profile/profile.js
const app = getApp();
const { userAPI, favoritesAPI, feedbackAPI, resolveMediaUrl } = require('../../utils/api');

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    totalPoints: 0,
    checkInDays: 0,
    identifyCount: 0,
    userLevel: null,
    achievementCount: 0,
    favoriteCount: 0,
    // 登录弹窗相关
    showLoginModal: false,
    tempNickname: '',
    tempAvatarUrl: '',
    tempAvatarPreview: '',
    isChoosingAvatar: false,
    menuList: [
      { id: 'history', name: '识别历史', icon: '📋', color: '#07c160' },
      { id: 'exchange', name: '我的兑换', icon: '🎁', color: '#ffbe00' },
      { id: 'collection', name: '我的收藏', icon: '⭐', color: '#ff6b6b' },
      { id: 'ranking', name: '排行榜', icon: '🏆', color: '#667eea' },
      { id: 'enterprise', name: '企业入驻/企业端', icon: '🏢', color: '#10aeff' }
    ],
    settingsList: [
      { id: 'feedback', name: '意见反馈', icon: '💬', color: '#07c160' },
      { id: 'enterpriseAudit', name: '管理中心', icon: '🧾', color: '#667eea' },
      { id: 'about', name: '关于我们', icon: 'ℹ️', color: '#10aeff' },
      { id: 'help', name: '使用帮助', icon: '❓', color: '#ffbe00' }
    ]
  },

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    const cachedUserInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!(token && userId);
    const normalizedUserInfo = isLoggedIn
      ? this.normalizeUserInfo(app.globalData.userInfo || cachedUserInfo || null)
      : null;
    
    // 同步全局状态
    app.globalData.isLogin = isLoggedIn;
    app.globalData.userId = userId;
    app.globalData.token = token;
    if (isLoggedIn && normalizedUserInfo) {
      app.globalData.userInfo = normalizedUserInfo;
      wx.setStorageSync('userInfo', normalizedUserInfo);
    } else if (isLoggedIn) {
      app.globalData.userInfo = app.globalData.userInfo || null;
    }
    
    this.setData({
      totalPoints: app.globalData.totalPoints,
      checkInDays: app.globalData.checkInDays,
      hasUserInfo: isLoggedIn,
      userInfo: normalizedUserInfo
    });
    
    if (isLoggedIn) {
      this.loadUserStats();
    }
  },

  // 加载用户数据
  loadUserData() {
    // 从 storage 检查登录状态（更可靠）
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userId) {
      const normalizedUserInfo = this.normalizeUserInfo(userInfo || app.globalData.userInfo || null);
      this.setData({
        userInfo: normalizedUserInfo,
        hasUserInfo: true
      });
      // 同步全局状态
      app.globalData.isLogin = true;
      app.globalData.userId = userId;
      app.globalData.token = token;
      app.globalData.userInfo = normalizedUserInfo;
      if (normalizedUserInfo) {
        wx.setStorageSync('userInfo', normalizedUserInfo);
      }
    }
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

  // 加载用户统计
  async loadUserStats() {
    if (!app.globalData.userId || !app.globalData.isLogin) {
      console.log('用户未登录，跳过加载统计');
      return;
    }
    
    try {
      const res = await userAPI.getStats(app.globalData.userId);
      if (res.success) {
        this.setData({
          identifyCount: res.data.user.identify_count || 0,
          userLevel: res.data.level?.current || null,
          achievementCount: res.data.achievements?.achieved || 0,
          favoriteCount: res.data.favoriteCount || 0
        });
      }
    } catch (error) {
      console.error('加载统计失败:', error);
      // 如果是401，自动弹出登录框
      if (error.error === '请先登录' || error.error === '登录已过期，请重新登录') {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
        this.setData({ hasUserInfo: false });
        setTimeout(() => this.showLoginModal(), 1500);
      }
    }
  },

  // ========== 微信授权登录弹窗 ==========
  
  // 显示登录弹窗
  showLoginModal() {
    // 使用稳定默认昵称（开发环境不随机）
    const defaultNickname = this.getDefaultNickname();
    
    this.setData({
      showLoginModal: true,
      tempNickname: defaultNickname,
      tempAvatarUrl: '',
      tempAvatarPreview: ''
    });
  },

  // 关闭登录弹窗
  closeLoginModal() {
    this.setData({
      showLoginModal: false,
      tempNickname: '',
      tempAvatarUrl: '',
      tempAvatarPreview: ''
    });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    // 防止重复选择（防抖）
    if (this.data.isChoosingAvatar) return;
    this.setData({ isChoosingAvatar: true, tempAvatarPreview: avatarUrl });
    console.log('选择头像:', avatarUrl);

    wx.showLoading({ title: '上传头像...' });
    userAPI.uploadAvatar(avatarUrl)
      .then((res) => {
        if (res && res.success && res.data && res.data.url) {
          const avatarStorageUrl = res.data.url;
          const avatarPreviewUrl = res.data.previewUrl || resolveMediaUrl(avatarStorageUrl) || avatarUrl;
          this.setData({ tempAvatarUrl: avatarStorageUrl, tempAvatarPreview: avatarPreviewUrl });
        } else {
          throw res || { error: '上传失败' };
        }
      })
      .catch((err) => {
        console.error('头像上传失败:', err);
        wx.showToast({ title: err.error || '头像上传失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ isChoosingAvatar: false });
      });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },

  // 昵称输入完成（失焦）
  onNicknameChange(e) {
    let nickname = e.detail.value.trim();
    // 如果输入为空，生成默认昵称
    if (!nickname) {
      nickname = this.getDefaultNickname();
    }
    this.setData({
      tempNickname: nickname
    });
  },

  // 确认登录
  async confirmLogin() {
    const { tempNickname, tempAvatarUrl } = this.data;
    
    if (!tempNickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '登录中...' });

      // 1. 先获取微信登录 code
      const loginRes = await wx.login();
      
      // 2. 准备用户信息
      const userInfo = {
        nickName: tempNickname.trim(),
        avatarUrl: tempAvatarUrl || ''
      };

      // 3. 调用后端登录（后端按微信 openid 识别用户）
      const res = await userAPI.login(loginRes.code, userInfo);

      if (res.success) {
        const userData = this.normalizeUserInfo(res.data);

        // 保存到全局
        app.globalData.userId = userData.id;
        app.globalData.userInfo = userData;
        app.globalData.totalPoints = userData.total_points || 0;
        app.globalData.checkInDays = userData.check_in_days || 0;
        app.globalData.isLogin = true;

        // 保存到本地存储
        wx.setStorageSync('userId', userData.id);
        wx.setStorageSync('userInfo', userData);
        if (userData.token) {
          wx.setStorageSync('token', userData.token);
          app.globalData.token = userData.token;
          console.log('✅ Token已保存:', userData.token.substring(0, 20) + '...');
        } else {
          console.warn('⚠️ 登录返回数据中没有 token');
        }

        // 将头像/昵称写回用户资料（防止登录返回未及时更新）
        try {
          const updatePayload = {};
          if (tempNickname && tempNickname.trim()) updatePayload.nickname = tempNickname.trim();
          if (tempAvatarUrl) updatePayload.avatarUrl = tempAvatarUrl;
          if (Object.keys(updatePayload).length > 0) {
            await userAPI.updateUser(userData.id, updatePayload);
            // 本地同步展示
            userData.nickname = updatePayload.nickname || userData.nickname;
            if (updatePayload.avatarUrl) {
              userData.avatar_url = resolveMediaUrl(updatePayload.avatarUrl);
            }
          }
        } catch (updateError) {
          console.warn('⚠️ 登录后更新用户资料失败:', updateError);
        }

        app.globalData.userInfo = userData;
        wx.setStorageSync('userInfo', userData);

        // 同步打卡状态
        this.syncCheckInStatus(userData.last_check_date);

        // 更新页面数据
        this.setData({
          userInfo: userData,
          hasUserInfo: true,
          showLoginModal: false,
          totalPoints: userData.total_points || 0,
          checkInDays: userData.check_in_days || 0
        });

        wx.hideLoading();
        wx.showToast({ 
          title: res.isNewUser ? '登录成功' : '欢迎回来', 
          icon: 'success' 
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('登录失败:', error);
      wx.showToast({ 
        title: error.error || '登录失败，请重试', 
        icon: 'none' 
      });
    }
  },

  // 默认昵称
  getDefaultNickname() {
    return '微信用户';
  },

  // 同步服务器打卡状态到本地
  syncCheckInStatus(lastCheckDate) {
    if (!lastCheckDate) {
      wx.removeStorageSync('lastCheckDate');
      return;
    }
    const serverDate = new Date(lastCheckDate).toDateString();
    wx.setStorageSync('lastCheckDate', serverDate);
  },

  // ========== 其他功能 ==========

  // 菜单点击
  onMenuTap(e) {
    const id = e.currentTarget.dataset.id;
    
    if (id === 'history') {
      // 识别页是 tabBar 页面，不能用 navigateTo 传参
      app.globalData.pendingIdentifyTab = 'history';
      wx.setStorageSync('pendingIdentifyTab', 'history');
      wx.switchTab({ url: '/pages/identify/identify' });
    } else if (id === 'exchange') {
      wx.navigateTo({ url: '/pages/exchange/exchange' });
    } else if (id === 'collection') {
      this.showCollection();
    } else if (id === 'ranking') {
      wx.navigateTo({ url: '/pages/ranking/ranking' });
    } else if (id === 'enterprise') {
      wx.showActionSheet({
        itemList: ['企业登录', '企业入驻'],
        success: (res) => {
          const mode = res.tapIndex === 1 ? 'register' : 'login';
          wx.navigateTo({ url: `/pages/enterprise/enterprise?mode=${mode}` });
        }
      });
    }
  },

  // 积分页
  goToPoints() {
    wx.switchTab({ url: '/pages/points/points' });
  },

  // 排行榜页
  goToRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking?tab=achievements' });
  },

  // 显示收藏列表
  async showCollection() {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.showLoginModal();
      return;
    }
    
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await favoritesAPI.getList(app.globalData.userId);
      wx.hideLoading();
      
      if (res.success && res.data.length > 0) {
        const items = res.data.map(item => `${item.name} - ${item.type_name}`);
        wx.showActionSheet({
          itemList: items.slice(0, 6),
          success: (tapRes) => {
            const selected = res.data[tapRes.tapIndex];
            wx.showModal({
              title: selected.name,
              content: `分类：${selected.type_name}\n投放提示：${selected.tips || '暂无'}`,
              showCancel: false
            });
          }
        });
      } else {
        wx.showToast({ title: '暂无收藏', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '加载收藏失败', icon: 'none' });
    }
  },

  // 设置点击
  onSettingTap(e) {
    const id = e.currentTarget.dataset.id;
    
    if (id === 'feedback') {
      this.submitFeedback();
    } else if (id === 'enterpriseAudit') {
      wx.navigateTo({ url: '/pages/adminEnterprise/adminEnterprise' });
    } else if (id === 'about') {
      wx.showModal({
        title: '关于智能垃圾分类',
        content: '版本：1.0.0\n\n智能垃圾分类助手是一款结合AI图像识别的环保工具，帮助用户快速准确地进行垃圾分类。\n\n功能特点：\n· AI拍照识别\n· 语音搜索\n· 附近回收点导航\n· 积分兑换奖品',
        showCancel: false
      });
    } else if (id === 'help') {
      wx.showModal({
        title: '使用帮助',
        content: '1. 拍照识别：对准垃圾拍照，AI自动识别\n2. 文字搜索：输入垃圾名称查询分类\n3. 语音查询：语音说出垃圾名称\n4. 积分系统：完成任务获得积分\n5. 附近回收：查找附近回收站点',
        showCancel: false
      });
    }
  },

  // 提交反馈
  submitFeedback() {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.showLoginModal();
      return;
    }
    
    wx.showActionSheet({
      itemList: ['功能建议', '分类不准确', '信息有误', '其他问题'],
      success: (res) => {
        const types = ['suggestion', 'classify_error', 'info_error', 'other'];
        const selectedType = types[res.tapIndex];
        
        wx.showModal({
          title: '意见反馈',
          editable: true,
          placeholderText: '请描述您的反馈内容...',
          success: async (modalRes) => {
            if (modalRes.confirm && modalRes.content) {
              try {
                await feedbackAPI.submit(
                  app.globalData.userId,
                  selectedType,
                  modalRes.content
                );
                wx.showToast({ title: '反馈已提交', icon: 'success' });
              } catch (error) {
                wx.showToast({ title: '提交失败', icon: 'none' });
              }
            }
          }
        });
      }
    });
  },

  // 清除本地数据
  clearData() {
    wx.showModal({
      title: '清除数据',
      content: '确定清除所有本地数据？这将清除搜索历史、缓存等数据，不会影响账号信息。',
      success: (res) => {
        if (res.confirm) {
          // 保留登录信息
          const userId = wx.getStorageSync('userId');
          const userInfo = wx.getStorageSync('userInfo');
          const token = wx.getStorageSync('token');
          const devOpenId = wx.getStorageSync('devOpenId');
          
          wx.clearStorageSync();
          
          // 恢复登录信息
          if (userId) wx.setStorageSync('userId', userId);
          if (userInfo) wx.setStorageSync('userInfo', userInfo);
          if (token) wx.setStorageSync('token', token);
          if (devOpenId) wx.setStorageSync('devOpenId', devOpenId);
          
          wx.showToast({ title: '清除成功', icon: 'success' });
        }
      }
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定退出登录？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({
            userInfo: null,
            hasUserInfo: false,
            totalPoints: 0,
            checkInDays: 0,
            identifyCount: 0
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '智能垃圾分类助手 - 让环保更简单',
      path: '/pages/index/index'
    };
  }
});

