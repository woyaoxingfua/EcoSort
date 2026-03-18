// pages/identify/identify.js
const app = getApp()
const { trashAPI, userAPI } = require('../../utils/api')
const { getTrashTypeIcon, formatRelativeTime } = require('../../utils/util')

Page({
  data: {
    activeTab: 'image',
    tabs: [
      { id: 'image', name: '拍照识别', icon: '📷' },
      { id: 'text', name: '文字搜索', icon: '🔍' },
      { id: 'voice', name: '语音查询', icon: '🎤' },
      { id: 'history', name: '历史记录', icon: '⏰' }
    ],
    historyList: [],
    loading: false
  },  onLoad(options) {
    if (options.tab) {
      this.setData({ activeTab: options.tab })
    }
  },

  onShow() {
    // 处理来自“我的-识别历史”的跳转（tabBar 页面无法带参数）
    const pendingTab = app.globalData.pendingIdentifyTab || wx.getStorageSync('pendingIdentifyTab')
    if (pendingTab) {
      app.globalData.pendingIdentifyTab = null
      wx.removeStorageSync('pendingIdentifyTab')
      this.setData({ activeTab: pendingTab })
      if (pendingTab === 'history') {
        setTimeout(() => {
          wx.pageScrollTo({
            selector: '.history-card',
            duration: 300
          })
        }, 100)
      }
    }
    this.loadHistory()
  },

  // 加载识别历史
  async loadHistory() {
    if (!app.globalData.isLogin || !app.globalData.userId) {
      this.setData({ historyList: [] })
      return
    }
    
    this.setData({ loading: true })
    try {
      const res = await userAPI.getHistory(app.globalData.userId, 10)
      if (res.success) {
        const colorMap = {
          recyclable: '#2c9678',
          hazardous: '#e74c3c',
          kitchen: '#8b6914',
          other: '#7f8c8d'
        }
        const typeNameMap = {
          recyclable: '可回收物',
          hazardous: '有害垃圾',
          kitchen: '厨余垃圾',
          other: '其他垃圾'
        }
        const historyList = res.data.map(item => ({
          id: item.id,
          name: item.trash_name,
          type: item.trash_type,
          typeName: typeNameMap[item.trash_type] || '未知',
          icon: getTrashTypeIcon(item.trash_type),
          color: colorMap[item.trash_type] || '#999',
          confidence: item.confidence,
          time: formatRelativeTime(item.created_at)
        }))
        this.setData({ historyList })
      }
    } catch (error) {
      console.error('加载识别历史失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    const tabMap = {
      'image': '/pages/scan/scan',
      'text': '/pages/search/search',
      'voice': '/pages/voicerecord/voicerecord'
    }
    
    this.setData({ activeTab: tab })
    
    if (tab === 'history') {
      // 滚到历史区域
      setTimeout(() => {
        wx.pageScrollTo({
          selector: '.history-card',
          duration: 300
        })
      }, 100)
    } else if (['image', 'text', 'voice'].includes(tab)) {
      // 快捷导航到对应页面
      wx.navigateTo({ url: tabMap[tab] })
    }
  },

  // 拍照识别
  takePhoto() {
    wx.navigateTo({ url: '/pages/scan/scan' })
  },

  // 从相册选择
  chooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
        if (!tempFilePath) {
          wx.showToast({ title: '未获取到图片', icon: 'none' })
          return
        }

        app.globalData.pendingScanImagePath = tempFilePath
        wx.navigateTo({ url: '/pages/scan/scan' })
      }
    })
  },

  // 清空历史
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定清空所有识别历史？',
      success: async (res) => {
        if (res.confirm) {
          if (app.globalData.isLogin && app.globalData.userId) {
            try {
              await userAPI.clearHistory(app.globalData.userId)
            } catch (error) {
              console.error('清空识别历史失败:', error)
              wx.showToast({ title: '清空失败，请重试', icon: 'none' })
              return
            }
          }

          this.setData({ historyList: [] })
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  // 点击历史记录
  onHistoryTap(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(item.name)}`
    })
  }
})




