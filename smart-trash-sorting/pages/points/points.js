// pages/points/points.js
const app = getApp();
const { pointAPI, userAPI } = require('../../utils/api');
const { formatDate, formatTime } = require('../../utils/util');

Page({
  data: {
    totalPoints: 0,
    checkInDays: 0,
    todayCheckedIn: false,
    activeTab: 'tasks',
    tabs: [
      { id: 'tasks', name: '任务' },
      { id: 'exchange', name: '兑换' },
      { id: 'records', name: '记录' }
    ],
    tasks: [],
    prizes: [],
    records: [],
    exchangeRecords: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.setData({
      totalPoints: app.globalData.totalPoints,
      checkInDays: app.globalData.checkInDays
    });
    this.checkTodayCheckIn();
    // 刷新任务列表（确保打卡任务状态同步）
    if (app.globalData.isLogin) {
      this.loadTasks();
    }
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return formatTime(date).replace(/\//g, '-').slice(0, 16);
  },

  getExchangeStatusText(status) {
    const statusMap = {
      pending: '待处理',
      completed: '已完成',
      cancelled: '已取消'
    };
    return statusMap[status] || '处理中';
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
      // 新用户或未打卡
      this.setData({ todayCheckedIn: false });
      wx.removeStorageSync('lastCheckDate');
    }
  },

  // 加载数据
  async loadData() {
    this.setData({
      totalPoints: app.globalData.totalPoints,
      checkInDays: app.globalData.checkInDays
    });
    this.checkTodayCheckIn();
    
    if (app.globalData.isLogin) {
      await Promise.all([
        this.loadTasks(),
        this.loadPrizes(),
        this.loadRecords(),
        this.loadExchanges()
      ]);
    }
  },

  // 加载任务列表
  async loadTasks() {
    try {
      const res = await pointAPI.getTasks(app.globalData.userId);
      if (res.success) {
        const tasks = res.data.map((task) => {
          const completedCount = Number.isFinite(task.completedCount) ? task.completedCount : 0;
          const dailyLimit = Number.isFinite(task.daily_limit) ? task.daily_limit : 1;
          const safeLimit = dailyLimit > 0 ? dailyLimit : 1;
          const status = task.status === 1
            ? (task.isCompleted ? 'completed' : 'available')
            : 'locked';
          return {
            ...task,
            desc: task.description || '',
            progress: `${Math.min(completedCount, safeLimit)}/${safeLimit}`,
            status
          };
        });
        this.setData({ tasks });
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  },

  // 加载奖品列表
  async loadPrizes() {
    try {
      const res = await pointAPI.getPrizes();
      if (res.success) {
        const prizes = (res.data || []).map((prize) => ({
          ...prize,
          desc: prize.description || prize.desc || ''
        }));
        this.setData({ prizes });
      }
    } catch (error) {
      console.error('加载奖品失败:', error);
    }
  },

  // 加载积分记录
  async loadRecords() {
    try {
      const res = await pointAPI.getRecords(app.globalData.userId, 50);
      if (res.success) {
        const records = (res.data || []).map((item) => ({
          ...item,
          reason: item.reason || (item.type === 'add' ? '积分增加' : '积分消费'),
          time: this.formatDateTime(item.created_at || item.time)
        }));
        this.setData({ records });
      }
    } catch (error) {
      console.error('加载积分记录失败:', error);
    }
  },

  // 加载兑换记录
  async loadExchanges() {
    try {
      const res = await pointAPI.getExchanges(app.globalData.userId);
      if (res.success) {
        const exchangeRecords = (res.data || []).map((item) => ({
          ...item,
          time: this.formatDateTime(item.created_at || item.time),
          statusText: this.getExchangeStatusText(item.status)
        }));
        this.setData({ exchangeRecords });
      }
    } catch (error) {
      console.error('加载兑换记录失败:', error);
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    if (tab === 'tasks') this.loadTasks();
    if (tab === 'exchange') this.loadPrizes();
    if (tab === 'records') {
      this.loadRecords();
      this.loadExchanges();
    }
  },

  goToRecords() {
    this.setData({ activeTab: 'records' });
    this.loadRecords();
    this.loadExchanges();
  },

  // 跳转排行榜
  goToRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking' });
  },

  // 打卡
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

      // 刷新任务列表（标记打卡任务为已完成）
      this.loadTasks();

      wx.showToast({
        title: `打卡成功 +${result.points}分`,
        icon: 'success'
      });
    }
  },

  // 执行任务
  async doTask(e) {
    const task = e.currentTarget.dataset.task;
    
    // 打卡任务特殊处理：使用统一的打卡逻辑
    if (task.type === 'checkin') {
      if (this.data.todayCheckedIn || task.isCompleted) {
        wx.showToast({ title: '今日已打卡', icon: 'none' });
        return;
      }
      this.onCheckIn();
      return;
    }
    
    // 其他任务
    if (task.isCompleted) {
      wx.showToast({ title: '今日任务已完成', icon: 'none' });
      return;
    }

    // 根据任务类型跳转到对应页面
    const paths = {
      identify: '/pages/scan/scan',
      search: '/pages/search/search',
      voice: '/pages/voicerecord/voicerecord',
      science: '/pages/science/science'
    };

    if (paths[task.type]) {
      wx.navigateTo({ url: paths[task.type] });
    }
  },

  // 兑换奖品
  async exchangePrize(e) {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const prize = e.currentTarget.dataset.prize;
    
    if (this.data.totalPoints < prize.points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确定花费${prize.points}积分兑换${prize.name}吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await pointAPI.exchangePrize(
              app.globalData.userId, 
              prize.id
            );
            if (result.success) {
              const latestPoints = Math.max(0, Number(this.data.totalPoints) - Number(prize.points));
              app.globalData.totalPoints = latestPoints;
              this.setData({
                totalPoints: latestPoints
              });
              await Promise.all([
                this.loadPrizes(),
                this.loadRecords(),
                this.loadExchanges()
              ]);
              wx.showToast({ title: '兑换成功！', icon: 'success' });
              // 跳转到兑换凭证页，让用户查看待核销状态
              setTimeout(() => {
                wx.navigateTo({ url: '/pages/exchange/exchange?tab=pending' });
              }, 1500);
            }
          } catch (error) {
            wx.showToast({ title: error.error || '兑换失败', icon: 'none' });
          }
        }
      }
    });
  }
});
