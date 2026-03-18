// pages/exchange/exchange.js
// 兑换凭证管理与核销

const app = getApp();
const { pointAPI, recycleAPI } = require('../../utils/api');

Page({
  data: {
    activeTab: 'pending',
    tabs: [
      { id: 'pending', name: '待核销（' + '0' + '）' },
      { id: 'completed', name: '已核销' }
    ],
    exchanges: {
      pending: [],
      completed: []
    },
    selectedExchange: null,
    showDetail: false,
    nearbyEnterprises: [],
    loading: false,
    selectedEnterpriseId: null
  },

  onLoad() {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadExchanges();
  },

  onShow() {
    this.loadExchanges();
  },

  // 加载兑换记录
  async loadExchanges() {
    this.setData({ loading: true });
    try {
      const res = await pointAPI.getExchanges(app.globalData.userId);
      if (res.success) {
        const pending = res.data.filter(item => item.status === 'pending');
        const completed = res.data.filter(item => item.status === 'completed');
        
        this.setData({
          'exchanges.pending': pending.map(item => this.formatExchange(item)),
          'exchanges.completed': completed.map(item => this.formatExchange(item)),
          tabs: [
            { id: 'pending', name: `待核销（${pending.length}）` },
            { id: 'completed', name: `已核销（${completed.length}）` }
          ]
        });
      }
    } catch (error) {
      console.error('加载兑换记录失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 格式化兑换数据
  formatExchange(item) {
    return {
      ...item,
      time: this.formatDateTime(item.created_at),
      statusText: this.getStatusText(item.status),
      voucherCode: this.generateVoucherCode(item.id, item.user_id)
    };
  },

  // 生成凭证码（用于核销使用）
  generateVoucherCode(exchangeId, userId) {
    // 格式: EX + 交易ID + 用户ID的后4位 + 日期码
    const date = new Date();
    const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const userPart = String(userId).slice(-2).padStart(2, '0');
    return `EX${String(exchangeId).padStart(5, '0')}${userPart}${datePart}`;
  },

  // 格式化时间
  formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  },

  // 获取状态文案
  getStatusText(status) {
    const map = {
      pending: '待核销',
      completed: '已完成',
      cancelled: '已取消'
    };
    return map[status] || '待处理';
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 查看兑换详情
  showExchangeDetail(e) {
    const exchange = e.currentTarget.dataset.item;
    this.setData({
      selectedExchange: exchange,
      showDetail: true
    });
  },

  // 关闭详情
  closeDetail() {
    this.setData({
      selectedExchange: null,
      showDetail: false,
      selectedEnterpriseId: null
    });
  },

  // 复制凭证码
  copyVoucherCode() {
    const code = this.data.selectedExchange?.voucherCode;
    if (code) {
      wx.setClipboardData({
        data: code,
        success: () => {
          wx.showToast({ title: '凭证码已复制', icon: 'success' });
        }
      });
    }
  },

  // 查找附近的企业/回收点
  async findNearbyEnterprises() {
    wx.showLoading({ title: '定位中...' });
    try {
      // 获取用户位置
      const location = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        });
      });

      // 这里可以调用回收点API查询附近的机构
      // 暂时显示通用提示
      wx.hideLoading();
      wx.showModal({
        title: '附近企业',
        content: '附近暂无可核销的企业，请稍后重试或联系客服。',
        showCancel: false
      });
    } catch (error) {
      wx.hideLoading();
      console.error('获取位置失败:', error);
      wx.showToast({ title: '获取位置失败', icon: 'none' });
    }
  },

  // 扫码核销
  scanToRedeem() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        // 扫码结果可能是凭证码或企业ID
        wx.showModal({
          title: '核销',
          content: `确认用此凭证进行核销吗？${res.result}`,
          success: async (modalRes) => {
            if (modalRes.confirm) {
              await this.submitRedeem(this.data.selectedExchange.id, res.result);
            }
          }
        });
      }
    });
  },

  // 提交核销
  async submitRedeem(exchangeId, code) {
    // 这个接口需要后端补充
    wx.showToast({ title: '核销功能开发中...', icon: 'none' });
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '我在垃圾分类助手兑换了好礼，快来一起环保吧！',
      path: '/pages/index/index'
    };
  }
});
