// pages/voicerecord/voicerecord.js
const app = getApp()
const { trashAPI, feedbackAPI, voiceAPI } = require('../../utils/api')
const { getTrashTypeIcon } = require('../../utils/util')

Page({
  data: {
    isRecording: false,
    voiceText: '',
    recordingTime: 0,
    result: null,
    results: [], // 多个搜索结果
    showResult: false,
    waveAnimation: []
  },

  recorderManager: null,
  recordTimer: null,

  onLoad() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager()
    
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      this.startWaveAnimation()
    })

    this.recorderManager.onStop((res) => {
      console.log('录音结束', res)
      this.stopWaveAnimation()
      this.processVoice(res.tempFilePath)
    })

    this.recorderManager.onError((err) => {
      console.error('录音错误', err)
      this.stopRecording()
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  onUnload() {
    this.stopRecording()
  },

  // 开始录音
  startRecording() {
    const options = {
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    }

    this.setData({ 
      isRecording: true,
      recordingTime: 0,
      showResult: false
    })

    this.recorderManager.start(options)

    // 计时
    this.recordTimer = setInterval(() => {
      this.setData({
        recordingTime: this.data.recordingTime + 1
      })
    }, 1000)
  },

  // 停止录音
  stopRecording() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer)
      this.recordTimer = null
    }
    if (this.data.isRecording) {
      this.recorderManager.stop()
    }
    this.setData({ isRecording: false })
  },

  // 波形动画
  startWaveAnimation() {
    const animate = () => {
      if (!this.data.isRecording) return
      const wave = Array.from({ length: 20 }, () => Math.random() * 0.5 + 0.3)
      this.setData({ waveAnimation: wave })
      setTimeout(animate, 100)
    }
    animate()
  },

  stopWaveAnimation() {
    this.setData({ waveAnimation: [] })
  },

  // 处理语音（上传到后端进行讯飞语音转写）
  async processVoice(filePath) {
    wx.showLoading({ title: '识别中...' })

    try {
      // 调用后端语音识别接口
      const res = await voiceAPI.recognize(filePath)

      wx.hideLoading()

      if (!res.success) {
        wx.showToast({ title: res.error || '语音识别失败', icon: 'none' })
        return
      }

      const text = (res.data && res.data.text || '').trim()

      if (!text) {
        wx.showToast({ title: '未识别到语音内容，请重试', icon: 'none' })
        return
      }

      this.setData({
        voiceText: text,
        showResult: true
      })

      // 用识别出的文字搜索垃圾分类
      await this.searchTrash(text)
    } catch (error) {
      wx.hideLoading()
      console.error('语音识别失败:', error)
      wx.showToast({ title: error?.error || '语音识别失败', icon: 'none' })
    }
  },

  // 搜索垃圾（调用后端API）
  async searchTrash(keyword) {
    try {
      const res = await trashAPI.search(keyword)
      if (res.success && res.data && res.data.length > 0) {
        // 统一字段名映射
        const colorMap = {
          recyclable: '#2c9678',
          hazardous: '#e74c3c',
          kitchen: '#8b6914',
          other: '#7f8c8d'
        }
        // 处理所有搜索结果，最多显示5个
        const results = res.data.slice(0, 5).map(item => ({
          id: item.id,
          name: item.name,
          type: item.type,
          typeName: item.type_name,
          tips: item.tips,
          icon: item.icon || getTrashTypeIcon(item.type),
          color: colorMap[item.type] || '#999',
          description: item.description
        }))
        
        this.setData({ 
          results,
          result: results[0] // 保持兼容，第一个作为主结果
        })

        // 语音查询完成任务获得积分
        if (app.globalData.isLogin) {
          await app.completeTask(4) // 4是语音查询任务的ID
        }
      } else {
        this.setData({ result: null, results: [] })
        wx.showToast({ title: '未找到相关结果', icon: 'none' })
      }
    } catch (error) {
      console.error('搜索失败:', error)
      this.setData({ result: null, results: [] })
      wx.showToast({ title: '搜索失败', icon: 'none' })
    }
  },

  // 重新录音
  reRecord() {
    this.setData({
      voiceText: '',
      result: null,
      results: [],
      showResult: false
    })
  },

  // 手动输入
  manualInput() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  // 选择其他结果
  onSelectResult(e) {
    const item = e.currentTarget.dataset.item
    this.setData({ result: item })
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  // 查看详情
  viewDetail() {
    const { result } = this.data
    if (result) {
      wx.navigateTo({
        url: `/pages/search/search?keyword=${encodeURIComponent(result.name)}`
      })
    }
  },

  // 反馈
  feedback() {
    wx.showActionSheet({
      itemList: ['语音识别不准', '分类结果有误', '其他问题'],
      success: (res) => {
        const types = ['identify_error', 'classify_error', 'other']
        if (app.globalData.isLogin) {
          feedbackAPI.submit(
            app.globalData.userId,
            types[res.tapIndex],
            `语音查询反馈：${this.data.voiceText}`,
            this.data.voiceText
          )
        }
        wx.showToast({ title: '反馈已提交', icon: 'success' })
      }
    })
  }
})
