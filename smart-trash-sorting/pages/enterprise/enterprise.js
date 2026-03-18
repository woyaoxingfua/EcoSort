// pages/enterprise/enterprise.js
const { enterpriseAPI } = require('../../utils/api');

Page({
  data: {
    isLoggedIn: false,
    enterpriseInfo: null,
    activeTab: 'overview',
    tabs: [
      { id: 'overview', name: '概览' },
      { id: 'verify', name: '积分核销' },
      { id: 'data', name: '数据统计' }
    ],
    stats: {
      todayPoints: 0,
      todayVisits: 0,
      totalPoints: 0,
      totalVisits: 0
    },
    verifyRecords: [],
    monthlyData: [],
    showLoginForm: false,
    isRegisterMode: false,
    loginUsername: '',
    loginPassword: '',
    loginLoading: false,
    registerName: '',
    registerType: '回收企业',
    registerAddress: '',
    registerContactName: '',
    registerPhone: '',
    registerLicenseNo: '',
    registerUsername: '',
    registerPassword: '',
    registerLoading: false
  },

  onLoad(options) {
    this.checkLoginStatus();

    if (wx.getStorageSync('enterpriseInfo')) return;

    if (options && options.mode === 'register') {
      this.showRegisterForm();
      return;
    }

    if (options && options.mode === 'login') {
      this.setData({ showLoginForm: true, isRegisterMode: false });
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const enterpriseInfo = wx.getStorageSync('enterpriseInfo');
    if (enterpriseInfo) {
      this.setData({
        isLoggedIn: true,
        enterpriseInfo: enterpriseInfo
      });
      this.loadStats();
      this.loadRecords();
    }
  },

  // 切换登录表单显示
  toggleLoginForm() {
    const nextVisible = !this.data.showLoginForm;
    this.setData({
      showLoginForm: nextVisible,
      isRegisterMode: false,
      loginUsername: '',
      loginPassword: ''
    });

    if (!nextVisible) {
      this.resetRegisterForm();
    }
  },

  showRegisterForm() {
    this.setData({
      showLoginForm: true,
      isRegisterMode: true
    });
  },

  switchToLoginForm() {
    this.setData({
      showLoginForm: true,
      isRegisterMode: false
    });
  },

  resetRegisterForm() {
    this.setData({
      registerName: '',
      registerType: '回收企业',
      registerAddress: '',
      registerContactName: '',
      registerPhone: '',
      registerLicenseNo: '',
      registerUsername: '',
      registerPassword: ''
    });
  },

  // 用户名输入
  onUsernameInput(e) {
    this.setData({ loginUsername: e.detail.value });
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ loginPassword: e.detail.value });
  },

  onRegisterNameInput(e) {
    this.setData({ registerName: e.detail.value });
  },

  onRegisterTypeInput(e) {
    this.setData({ registerType: e.detail.value });
  },

  onRegisterAddressInput(e) {
    this.setData({ registerAddress: e.detail.value });
  },

  onRegisterContactInput(e) {
    this.setData({ registerContactName: e.detail.value });
  },

  onRegisterPhoneInput(e) {
    this.setData({ registerPhone: e.detail.value });
  },

  onRegisterLicenseInput(e) {
    this.setData({ registerLicenseNo: e.detail.value });
  },

  onRegisterUsernameInput(e) {
    this.setData({ registerUsername: e.detail.value });
  },

  onRegisterPasswordInput(e) {
    this.setData({ registerPassword: e.detail.value });
  },

  // 执行登录
  async doLogin() {
    const { loginUsername, loginPassword } = this.data;
    
    if (!loginUsername.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }
    if (!loginPassword) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    
    this.setData({ loginLoading: true });
    
    try {
      const loginRes = await enterpriseAPI.login(loginUsername.trim(), loginPassword);
      if (loginRes.success) {
        // 分离token和企业信息
        const { token: eToken, ...eInfo } = loginRes.data;
        wx.setStorageSync('enterpriseInfo', eInfo);
        if (eToken) {
          wx.setStorageSync('enterpriseToken', eToken);
        }
        this.setData({
          isLoggedIn: true,
          enterpriseInfo: eInfo,
          showLoginForm: false,
          loginUsername: '',
          loginPassword: ''
        });
        this.loadStats();
        this.loadRecords();
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (error) {
      wx.showToast({ title: error.error || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  async doRegister() {
    const {
      registerName,
      registerType,
      registerAddress,
      registerContactName,
      registerPhone,
      registerLicenseNo,
      registerUsername,
      registerPassword
    } = this.data;

    if (!registerName.trim()) {
      wx.showToast({ title: '请输入企业名称', icon: 'none' });
      return;
    }
    if (!registerUsername.trim()) {
      wx.showToast({ title: '请输入登录账号', icon: 'none' });
      return;
    }
    if (!registerPassword) {
      wx.showToast({ title: '请输入登录密码', icon: 'none' });
      return;
    }

    this.setData({ registerLoading: true });

    try {
      const registerRes = await enterpriseAPI.register({
        name: registerName.trim(),
        type: registerType.trim() || '回收企业',
        address: registerAddress.trim(),
        contactName: registerContactName.trim(),
        phone: registerPhone.trim(),
        licenseNo: registerLicenseNo.trim(),
        username: registerUsername.trim(),
        password: registerPassword
      });

      if (registerRes.success) {
        wx.showModal({
          title: '入驻申请已提交',
          content: '请等待管理员审核，通过后即可使用企业账号登录。',
          showCancel: false,
          success: () => {
            this.resetRegisterForm();
            this.setData({
              isRegisterMode: false,
              showLoginForm: true,
              loginUsername: registerUsername.trim(),
              loginPassword: ''
            });
          }
        });
      }
    } catch (error) {
      wx.showToast({ title: error.error || '入驻提交失败', icon: 'none' });
    } finally {
      this.setData({ registerLoading: false });
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'data') {
      this.loadRecords();
    }
  },

  // 加载统计数据
  async loadStats() {
    if (!this.data.enterpriseInfo) return;
    
    try {
      const res = await enterpriseAPI.getStats(this.data.enterpriseInfo.id, 30);
      if (res.success) {
        this.setData({
          stats: {
            todayPoints: res.data.today.points || 0,
            todayVisits: res.data.today.count || 0,
            totalPoints: res.data.total.points || 0,
            totalVisits: res.data.total.count || 0
          },
          monthlyData: res.data.monthly || []
        });
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  },

  // 加载核销记录
  async loadRecords() {
    if (!this.data.enterpriseInfo) return;
    
    try {
      const res = await enterpriseAPI.getRecords(this.data.enterpriseInfo.id, 20);
      if (res.success) {
        this.setData({ verifyRecords: res.data });
      }
    } catch (error) {
      console.error('加载记录失败:', error);
    }
  },

  // 扫码核销
  scanToVerify() {
    wx.scanCode({
      success: async (res) => {
        try {
          // 解析二维码内容（格式：userId:points:itemName）
          const parts = res.result.split(':');
          if (parts.length < 2) {
            wx.showToast({ title: '无效的核销码', icon: 'none' });
            return;
          }
          const userId = parseInt(parts[0]);
          const points = parseInt(parts[1]);
          const itemName = parts[2] || '积分兑换';

          wx.showModal({
            title: '核销确认',
            content: `用户ID: ${userId}\n核销积分: ${points}\n项目: ${itemName}`,
            success: async (modalRes) => {
              if (modalRes.confirm) {
                try {
                  const verifyRes = await enterpriseAPI.verify(
                    this.data.enterpriseInfo.id,
                    userId,
                    itemName,
                    points,
                    res.result
                  );
                  if (verifyRes.success) {
                    wx.showToast({ title: '核销成功', icon: 'success' });
                    this.loadStats();
                    this.loadRecords();
                  }
                } catch (error) {
                  wx.showToast({ title: error.error || '核销失败', icon: 'none' });
                }
              }
            }
          });
        } catch (error) {
          wx.showToast({ title: '解析核销码失败', icon: 'none' });
        }
      }
    });
  },

  // 手动输入核销
  manualVerify() {
    wx.showModal({
      title: '手动核销',
      editable: true,
      placeholderText: '请输入核销码（格式：用户ID:积分:商品名）',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const parts = res.content.split(':');
            if (parts.length < 2) {
              wx.showToast({ title: '核销码格式错误', icon: 'none' });
              return;
            }
            const userId = parseInt(parts[0]);
            const points = parseInt(parts[1]);
            const itemName = parts[2] || '积分兑换';

            const verifyRes = await enterpriseAPI.verify(
              this.data.enterpriseInfo.id,
              userId,
              itemName,
              points,
              res.content
            );
            if (verifyRes.success) {
              wx.showToast({ title: '核销成功', icon: 'success' });
              this.loadStats();
              this.loadRecords();
            }
          } catch (error) {
            wx.showToast({ title: error.error || '核销失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定退出企业端登录？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('enterpriseInfo');
          wx.removeStorageSync('enterpriseToken');
          this.setData({
            isLoggedIn: false,
            enterpriseInfo: null
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 查看数据详情
  viewDataDetail(e) {
    const type = e.currentTarget.dataset.type;
    const { stats } = this.data;
    const titles = { points: '积分核销详情', visits: '访问量详情' };
    const content = type === 'points'
      ? `今日核销：${stats.todayPoints} 积分\n累计核销：${stats.totalPoints} 积分`
      : `今日访问：${stats.todayVisits} 人次\n累计访问：${stats.totalVisits} 人次`;
    wx.showModal({ title: titles[type] || '数据详情', content, showCancel: false });
  },

  // 店铺设置
  viewSettings() {
    wx.showModal({
      title: '店铺设置',
      content: `店铺名称：${this.data.enterpriseInfo.name || '未设置'}\n联系人：${this.data.enterpriseInfo.contact_name || '未设置'}\n联系电话：${this.data.enterpriseInfo.phone || '未设置'}\n地址：${this.data.enterpriseInfo.address || '未设置'}`,
      showCancel: false
    });
  }
});
