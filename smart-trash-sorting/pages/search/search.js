// pages/search/search.js
const app = getApp();
const { trashAPI, feedbackAPI } = require('../../utils/api');

Page({
  data: {
    keyword: '',
    searchResults: [],
    searchHistory: [],
    hotSearches: [],
    hasSearched: false
  },

  onLoad(options) {
    if (options.keyword) {
      // 解码URL编码的关键词（处理语音搜索等场景传递的中文）
      const decodedKeyword = decodeURIComponent(options.keyword);
      this.setData({ keyword: decodedKeyword });
      this.onSearch();
    }
    this.loadSearchHistory();
    this.loadHotSearches();
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history.slice(0, 10) });
  },

  // 加载热门搜索
  async loadHotSearches() {
    try {
      const res = await trashAPI.getHot(8);
      if (res.success) {
        const hotSearches = res.data.map(item => item.name);
        this.setData({ hotSearches });
      }
    } catch (error) {
      console.error('加载热门搜索失败:', error);
      this.setData({ hotSearches: ['电池', '塑料瓶', '外卖盒', '快递箱', '果皮', '纸巾'] });
    }
  },

  // 保存搜索历史
  saveSearchHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    history = history.filter(item => item !== keyword);
    history.unshift(keyword);
    if (history.length > 20) history = history.slice(0, 20);
    wx.setStorageSync('searchHistory', history);
    this.setData({ searchHistory: history.slice(0, 10) });
  },

  // 输入关键词
  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 搜索
  async onSearch() {
    const { keyword } = this.data;
    if (!keyword.trim()) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' });
      return;
    }

    this.saveSearchHistory(keyword);
    
    wx.showLoading({ title: '搜索中...' });
    
    try {
      const res = await trashAPI.search(keyword);
      
      this.setData({
        searchResults: res.data || [],
        hasSearched: true
      });

      // 搜索成功，增加积分
      if (res.data && res.data.length > 0 && app.globalData.isLogin) {
        await app.completeTask(3); // 3是搜索任务的ID
      }
    } catch (error) {
      console.error('搜索失败:', error);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      keyword: '',
      searchResults: [],
      hasSearched: false
    });
  },

  // 点击历史或热门搜索
  onTagTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.onSearch();
  },

  // 清空历史
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定清空搜索历史？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
        }
      }
    });
  },

  // 查看详情
  viewDetail(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: item.name,
      content: `分类：${item.typeName || item.type_name}\n\n投放提示：${item.tips || '暂无'}\n\n详细说明：${item.description || '暂无'}`,
      showCancel: false
    });
  },

  // 反馈
  feedback() {
    wx.showActionSheet({
      itemList: ['找不到该垃圾', '分类不准确', '信息有误', '其他反馈'],
      success: async (res) => {
        const types = ['info_error', 'classify_error', 'info_error', 'other'];
        if (app.globalData.isLogin) {
          try {
            await feedbackAPI.submit(
              app.globalData.userId,
              types[res.tapIndex],
              `搜索反馈：${this.data.keyword} - ${['找不到该垃圾', '分类不准确', '信息有误', '其他反馈'][res.tapIndex]}`,
              this.data.keyword
            );
          } catch (e) { /* ignore */ }
        }
        wx.showToast({ title: '反馈已提交', icon: 'success' });
      }
    });
  }
});
