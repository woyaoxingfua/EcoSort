// pages/ranking/ranking.js
const app = getApp();
const { rankingAPI } = require('../../utils/api');
const { getTrashTypeColor } = require('../../utils/util');

Page({
  data: {
    activeTab: 'points',
    tabs: [
      { id: 'points', name: '积分榜' },
      { id: 'identify', name: '识别榜' },
      { id: 'checkin', name: '打卡榜' },
      { id: 'achievements', name: '成就' }
    ],
    rankList: [],
    myRank: null,
    achievements: [],
    levels: [],
    loading: false
  },

  onLoad() {
    this.loadRanking();
    this.loadMyRank();
  },

  onShow() {
    if (this.data.activeTab === 'achievements') {
      this.loadAchievements();
    }
  },

  onPullDownRefresh() {
    this.loadCurrentTab();
    wx.stopPullDownRefresh();
  },

  // 切换tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadCurrentTab();
  },

  loadCurrentTab() {
    switch (this.data.activeTab) {
      case 'points': this.loadRanking(); break;
      case 'identify': this.loadIdentifyRanking(); break;
      case 'checkin': this.loadCheckinRanking(); break;
      case 'achievements': this.loadAchievements(); break;
    }
  },

  // 加载积分排行榜
  async loadRanking() {
    this.setData({ loading: true });
    try {
      const res = await rankingAPI.getPointsRank(30);
      if (res.success) {
        const list = res.data.map((item, index) => ({
          ...item,
          rankIndex: index + 1,
          isMe: item.id === app.globalData.userId
        }));
        this.setData({ rankList: list });
      }
    } catch (error) {
      console.error('加载排行榜失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载识别排行榜
  async loadIdentifyRanking() {
    this.setData({ loading: true });
    try {
      const res = await rankingAPI.getIdentifyRank(30);
      if (res.success) {
        const list = res.data.map((item, index) => ({
          ...item,
          rankIndex: index + 1,
          isMe: item.id === app.globalData.userId
        }));
        this.setData({ rankList: list });
      }
    } catch (error) {
      console.error('加载排行榜失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载打卡排行榜
  async loadCheckinRanking() {
    this.setData({ loading: true });
    try {
      const res = await rankingAPI.getCheckinRank(30);
      if (res.success) {
        const list = res.data.map((item, index) => ({
          ...item,
          rankIndex: index + 1,
          isMe: item.id === app.globalData.userId
        }));
        this.setData({ rankList: list });
      }
    } catch (error) {
      console.error('加载排行榜失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载我的排名
  async loadMyRank() {
    if (!app.globalData.isLogin) return;
    try {
      const res = await rankingAPI.getMyRank();
      if (res.success) {
        this.setData({ myRank: res.data });
      }
    } catch (error) {
      console.error('加载排名失败:', error);
    }
  },

  // 加载成就列表
  async loadAchievements() {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await rankingAPI.getAchievements();
      if (res.success) {
        this.setData({ achievements: res.data });
      }
    } catch (error) {
      console.error('加载成就失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 领取成就奖励
  async claimAchievement(e) {
    const achievement = e.currentTarget.dataset.item;
    if (achievement.achieved) {
      wx.showToast({ title: '已领取', icon: 'none' });
      return;
    }
    if (achievement.progress < 100) {
      wx.showToast({ title: '未达成条件', icon: 'none' });
      return;
    }

    try {
      const res = await rankingAPI.claimAchievement(achievement.id);
      if (res.success) {
        app.globalData.totalPoints += res.data.pointsReward;
        wx.showToast({ title: res.message, icon: 'success' });
        this.loadAchievements();
      }
    } catch (error) {
      wx.showToast({ title: error.error || '领取失败', icon: 'none' });
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '快来看看垃圾分类排行榜！',
      path: '/pages/ranking/ranking'
    };
  }
});
