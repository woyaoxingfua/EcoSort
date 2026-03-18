// pages/scan/scan.js
const app = getApp();
const { trashAPI, feedbackAPI } = require('../../utils/api');
const { getTrashTypeIcon } = require('../../utils/util');

Page({
  data: {
    imagePath: '',
    previewLoadFailed: false,
    isAnalyzing: false,
    result: null,
    showResult: false
  },

  onLoad(options) {
    const pendingImagePath = app.globalData.pendingScanImagePath || '';
    app.globalData.pendingScanImagePath = '';

    if (options.imagePath || pendingImagePath) {
      const imagePath = decodeURIComponent(options.imagePath || pendingImagePath);
      this.setData({ imagePath, previewLoadFailed: false, showResult: false });
      this.analyzeImage(imagePath);
    } else {
      this.chooseImage();
    }
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || '';
        if (!tempFilePath) {
          wx.showToast({ title: '未获取到图片', icon: 'none' });
          return;
        }

        this.setData({ 
          imagePath: tempFilePath,
          previewLoadFailed: false,
          showResult: false
        });
        this.analyzeImage(tempFilePath);
      },
      fail: () => {
        wx.navigateBack();
      }
    });
  },

  // 重新拍照
  retake() {
    this.chooseImage();
  },

  // AI分析图片
  async analyzeImage(filePath) {
    this.setData({ isAnalyzing: true });
    
    try {
      const decodedPath = decodeURIComponent(filePath || '');
      const imageName = decodedPath
        .split('?')[0]
        .split('#')[0]
        .split(/[\/]/)
        .pop() || '';

      let aiFilePath = decodedPath;
      let imageMime = 'image/jpeg';

      // 尝试按最大边缩放到 1024（若支持离屏画布）
      try {
        const imageInfo = await new Promise((resolve, reject) => {
          wx.getImageInfo({
            src: decodedPath,
            success: resolve,
            fail: reject
          });
        });
        const width = imageInfo && imageInfo.width ? imageInfo.width : 0;
        const height = imageInfo && imageInfo.height ? imageInfo.height : 0;
        const maxSide = Math.max(width, height);
        if (maxSide > 1024 && typeof wx.createOffscreenCanvas === 'function') {
          const ratio = 1024 / maxSide;
          const targetW = Math.max(1, Math.round(width * ratio));
          const targetH = Math.max(1, Math.round(height * ratio));
          const canvas = wx.createOffscreenCanvas({ type: '2d', width: targetW, height: targetH });
          const ctx = canvas.getContext('2d');
          const img = canvas.createImage();
          aiFilePath = await new Promise((resolve, reject) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, targetW, targetH);
              if (typeof canvas.toTempFilePath === 'function') {
                canvas.toTempFilePath({
                  success: (res) => resolve(res.tempFilePath),
                  fail: reject
                });
              } else {
                reject(new Error('OFFSCREEN_EXPORT_UNSUPPORTED'));
              }
            };
            img.onerror = reject;
            img.src = decodedPath;
          });
        }
      } catch (e) {
        // ignore resize errors, fallback to original path
      }

      // 压缩一次
      try {
        const compressRes = await new Promise((resolve, reject) => {
          wx.compressImage({
            src: aiFilePath,
            quality: 60,
            success: resolve,
            fail: reject
          });
        });
        if (compressRes && compressRes.tempFilePath) {
          aiFilePath = compressRes.tempFilePath;
        }
      } catch (e) {
        // ignore compression errors
      }

      // 如果仍然很大，再压缩一次
      try {
        const fs = wx.getFileSystemManager();
        const info = await new Promise((resolve, reject) => {
          fs.getFileInfo({
            filePath: aiFilePath,
            success: resolve,
            fail: reject
          });
        });
        if (info && info.size && info.size > 2 * 1024 * 1024) {
          const compressRes = await new Promise((resolve, reject) => {
            wx.compressImage({
              src: aiFilePath,
              quality: 40,
              success: resolve,
              fail: reject
            });
          });
          if (compressRes && compressRes.tempFilePath) {
            aiFilePath = compressRes.tempFilePath;
          }
        }
      } catch (e) {
        // ignore size check errors
      }
      try {
        const info = await new Promise((resolve, reject) => {
          wx.getImageInfo({
            src: aiFilePath,
            success: resolve,
            fail: reject
          });
        });
        const type = String(info && info.type ? info.type : '').toLowerCase();
        if (type) {
          imageMime = type === 'jpg' || type === 'jpeg' ? 'image/jpeg' : `image/${type}`;
        } else {
          const ext = aiFilePath.split('?')[0].split('#')[0].split('.').pop();
          const extNorm = String(ext || '').toLowerCase();
          if (extNorm) {
            imageMime = extNorm === 'jpg' || extNorm === 'jpeg' ? 'image/jpeg' : `image/${extNorm}`;
          }
        }
      } catch (e) {
        // ignore mime detect errors
      }

      let imageBase64 = '';
      try {
        const fs = wx.getFileSystemManager();
        const info = await new Promise((resolve, reject) => {
          fs.getFileInfo({
            filePath: aiFilePath,
            success: resolve,
            fail: reject
          });
        });
        if (info && info.size && info.size <= 4 * 1024 * 1024) {
          const base64Data = await new Promise((resolve, reject) => {
            fs.readFile({
              filePath: aiFilePath,
              encoding: 'base64',
              success: (res) => resolve(res.data),
              fail: reject
            });
          });
          imageBase64 = base64Data ? `data:${imageMime};base64,${base64Data}` : '';
        }
      } catch (e) {
        // ignore base64 errors, fallback to url
      }

      const res = await trashAPI.identify(aiFilePath, imageName, imageBase64);
      
      if (res.success) {
        const result = res.data;
        // 添加颜色字段
        const colorMap = {
          recyclable: '#2c9678',
          hazardous: '#e74c3c',
          kitchen: '#8b6914',
          other: '#7f8c8d'
        };
        result.color = colorMap[result.type] || '#999';
        result.icon = result.icon || getTrashTypeIcon(result.type);
        // 兼容字段名
        result.typeName = result.typeName || result.type_name;
        
        this.setData({
          isAnalyzing: false,
          result: result,
          showResult: true
        });

        if (res.data && res.data.aiError) {
          console.warn('AI降级原因:', res.data.aiError);
        }

        // 完成任务获得积分
        if (app.globalData.isLogin) {
          await app.completeTask(2); // 2是拍照识别任务的ID
        }
      } else {
        throw new Error('识别失败');
      }
    } catch (error) {
      console.error('识别失败:', error);
      const message = (error && error.error) ? error.error : '识别失败，请重试';
      wx.showToast({ title: message, icon: 'none' });
      if (error && error.code) {
        console.warn('识别失败 code:', error.code, error.details || '');
      }
      this.setData({ isAnalyzing: false });
    }
  },

  // 查看详情
  viewDetail() {
    const { result } = this.data;
    wx.navigateTo({
      url: `/pages/science/science?keyword=${encodeURIComponent(result.name)}`
    });
  },

  // 错误反馈
  feedbackError() {
    wx.showActionSheet({
      itemList: ['识别错误', '分类不正确', '其他问题'],
      success: async (res) => {
        const types = ['identify_error', 'classify_error', 'other'];
        if (app.globalData.isLogin) {
          try {
            await feedbackAPI.submit(
              app.globalData.userId,
              types[res.tapIndex],
              `识别反馈：${this.data.result ? this.data.result.name : '未知'} - ${['识别错误', '分类不正确', '其他问题'][res.tapIndex]}`
            );
          } catch (e) { /* ignore */ }
        }
        wx.showToast({ title: '反馈已提交', icon: 'success' });
      }
    });
  },

  // 返回首页
  goBack() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 图片预览失败兜底
  onPreviewError() {
    this.setData({ previewLoadFailed: true });
  }
});



