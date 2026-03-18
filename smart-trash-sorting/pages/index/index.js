// pages/index/index.js
const app = getApp();
const { trashAPI, newsAPI, userAPI, rankingAPI } = require('../../utils/api');
const { formatDate } = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    totalPoints: 0,
    checkInDays: 0,
    identifyCount: 0,
    todayCheckedIn: false,
    hotItems: [],
    envNews: [],
    userLevel: null,
    levelProgress: 0,
    identifyWays: [
      { icon: '📷', name: '拍照识别', desc: 'AI智能识别', path: '/pages/scan/scan' },
      { icon: '🔍', name: '文字搜索', desc: '输入垃圾名称', path: '/pages/search/search' },
      { icon: '🎤', name: '语音查询', desc: '语音快速识别', path: '/pages/voicerecord/voicerecord' }
    ],
    trashTypes: [
      { name: '可回收物', icon: '♻️', color: '#2c9678', desc: '纸张、塑料、玻璃等', examples: ['废纸', '塑料瓶', '玻璃瓶', '金属'] },
      { name: '有害垃圾', icon: '☠️', color: '#e74c3c', desc: '电池、药品、化学品等', examples: ['电池', '灯管', '药品', '油漆'] },
      { name: '厨余垃圾', icon: '🍲', color: '#8b6914', desc: '剩菜剩饭、果皮等', examples: ['剩菜', '果皮', '蛋壳', '茶叶'] },
      { name: '其他垃圾', icon: '🗑️', color: '#7f8c8d', desc: '卫生纸、烟蒂等', examples: ['纸巾', '烟蒂', '尘土', '破碎瓷'] }
    ]
  },

  onLoad() {
    this.loadHotItems();
    this.loadEnvNews();
    this.loadDailyTip();
  },

  onShow() {
    this.setData({
      userInfo: app.globalData.userInfo,
      totalPoints: app.globalData.totalPoints,
      checkInDays: app.globalData.checkInDays
    });
    this.checkTodayCheckIn();
    this.loadUserStats();
  },

  // 加载用户统计和等级信息
  async loadUserStats() {
    if (!app.globalData.userId) return;
    try {
      const res = await userAPI.getStats(app.globalData.userId);
      if (res.success) {
        this.setData({
          identifyCount: res.data.user.identify_count || 0,
          userLevel: res.data.level?.current || null,
          levelProgress: res.data.level?.progress || 0
        });
      }
    } catch (e) { /* ignore */ }
  },

  // 检查今日是否打卡（优先使用服务器数据）
  checkTodayCheckIn() {
    const normalizeDateKey = (value) => {
      if (!value) return '';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '';
      return formatDate(parsed, 'YYYY-MM-DD');
    };
    const today = formatDate(new Date(), 'YYYY-MM-DD');

    // 从服务器获取的用户数据判断
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.last_check_date) {
      const serverDate = normalizeDateKey(userInfo.last_check_date);
      this.setData({ todayCheckedIn: serverDate === today });
      // 同步到本地缓存
      if (serverDate === today) {
        wx.setStorageSync('lastCheckDate', today);
      }
    } else {
      // 新用户或未打卡，确保状态为未打卡
      this.setData({ todayCheckedIn: false });
      wx.removeStorageSync('lastCheckDate');
    }
  },

  // 今日打卡
  async onCheckIn() {
    if (this.data.todayCheckedIn) {
      wx.showToast({ title: '今日已打卡', icon: 'none' });
      return;
    }

    const result = await app.checkIn();
    if (result) {
      this.setData({
        todayCheckedIn: true,
        totalPoints: app.globalData.totalPoints,
        checkInDays: app.globalData.checkInDays
      });

      wx.showToast({
        title: `打卡成功 +${result.points}分`,
        icon: 'success'
      });
    }
  },

  // 加载热门垃圾
  async loadHotItems() {
    try {
      const res = await trashAPI.getHot(6);
      if (res.success) {
        const hotItems = res.data.map(item => ({
          name: item.name,
          type: item.type_name,
          icon: item.icon
        }));
        this.setData({ hotItems });
      }
    } catch (error) {
      console.error('加载热门垃圾失败:', error);
      // 使用默认数据
      this.setData({
        hotItems: [
          { name: '充电宝', type: '有害垃圾', icon: '🔋' },
          { name: '快递盒', type: '可回收物', icon: '📦' },
          { name: '奶茶杯', type: '其他垃圾', icon: '🧋' }
        ]
      });
    }
  },

  // 加载环保资讯（只加载 news 类别）
  async loadEnvNews() {
    try {
      const res = await newsAPI.getList(4, 1, 1, 'news');
      if (res.success) {
        const news = res.data.map(item => ({
          id: item.id,
          title: item.title,
          date: item.published_at ? item.published_at.split('T')[0] : '',
          source: item.source
        }));
        this.setData({ envNews: news });
      }
    } catch (error) {
      console.error('加载资讯失败:', error);
    }
  },

  // 加载每日环保小知识（从数据库 daily_tip 类别随机取一条）
  async loadDailyTip() {
    try {
      const res = await newsAPI.getList(10, 1, 1, 'daily_tip');
      if (res.success && res.data && res.data.length > 0) {
        // 随机选一条
        const randomIndex = Math.floor(Math.random() * res.data.length);
        const tip = res.data[randomIndex];
        this.setData({
          dailyTip: {
            title: tip.title || '每日环保小知识',
            content: tip.summary || tip.content || ''
          }
        });
      }
    } catch (error) {
      console.error('加载每日小知识失败:', error);
      // 失败时使用默认文案（WXML中已有兜底）
    }
  },

  // 导航到识别方式
  goToIdentify(e) {
    const path = e.currentTarget.dataset.path;
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: path });
  },

  // 导航到积分页
  goToPoints() {
    wx.switchTab({ url: '/pages/points/points' });
  },

  // 导航到排行榜
  goToRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking' });
  },

  // 查看分类详情
  showTypeDetail(e) {
    const index = e.currentTarget.dataset.index;
    const type = this.data.trashTypes[index];
    wx.navigateTo({
      url: `/pages/science/science?type=${encodeURIComponent(type.name)}`
    });
  },

  // 热门垃圾点击
  onHotItemTap(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(item.name)}`
    });
  },

  // 查看更多资讯
  onMoreNews() {
    wx.navigateTo({ url: '/pages/science/science' });
  },

  // 资讯详情
  async onNewsTap(e) {
    const news = e.currentTarget.dataset.item;
    try {
      const res = await newsAPI.getDetail(news.id);
      if (res.success) {
        wx.showModal({
          title: res.data.title,
          content: `来源：${res.data.source}\n\n${res.data.summary || res.data.content || '暂无详细内容'}`,
          showCancel: false
        });
      }
    } catch (error) {
      console.error('获取资讯详情失败:', error);
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await Promise.all([
      this.loadHotItems(),
      this.loadEnvNews(),
      this.loadUserStats(),
      this.loadDailyTip()
    ]);
    this.checkTodayCheckIn();
    this.setData({
      totalPoints: app.globalData.totalPoints,
      checkInDays: app.globalData.checkInDays
    });
    wx.stopPullDownRefresh();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '智能垃圾分类助手 - 让环保更简单',
      path: '/pages/index/index',
      imageUrl: '/static/images/share.png'
    };
  }
});
