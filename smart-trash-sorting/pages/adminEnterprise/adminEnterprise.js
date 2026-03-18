const { enterpriseAPI, newsAPI, feedbackAPI } = require('../../utils/api');

const FEEDBACK_TYPE_TEXT = {
  identify_error: '识别错误',
  classify_error: '分类错误',
  info_error: '信息错误',
  suggestion: '建议',
  other: '其他'
};

const CATEGORY_TEXT = {
  news: '环保资讯',
  knowledge: '分类知识',
  mistake: '常见误区',
  daily_tip: '每日小知识'
};

const TRASH_TYPE_MAP = {
  recyclable: '可回收物',
  hazardous: '有害垃圾',
  kitchen: '厨余垃圾',
  other: '其他垃圾'
};

Page({
  data: {
    activeModule: 'enterprise',
    moduleTabs: [
      { id: 'enterprise', name: '企业审核' },
      { id: 'news', name: '资讯管理' },
      { id: 'feedback', name: '反馈处理' }
    ],

    canReview: false,
    adminInfo: null,
    hasPromptedAdminLogin: false,

    enterpriseStatus: 'pending',
    enterpriseStatusTabs: [
      { id: 'pending', name: '待审核' },
      { id: 'verified', name: '已通过' },
      { id: 'rejected', name: '已拒绝' },
      { id: 'all', name: '全部' }
    ],
    enterpriseKeyword: '',
    applications: [],
    enterpriseLoading: false,

    newsStatus: 'all',
    newsStatusTabs: [
      { id: 'all', name: '全部' },
      { id: '1', name: '上架' },
      { id: '0', name: '下架' }
    ],
    newsCategory: 'news',
    newsCategoryTabs: [
      { id: 'news', name: '环保资讯' },
      { id: 'knowledge', name: '分类知识' },
      { id: 'mistake', name: '常见误区' },
      { id: 'daily_tip', name: '每日小知识' }
    ],
    newsKeyword: '',
    newsList: [],
    newsLoading: false,
    showNewsForm: false,
    isEditingNews: false,
    editingNewsId: null,
    newsSubmitting: false,
    newsForm: {
      title: '',
      summary: '',
      content: '',
      source: '',
      author: '',
      coverImage: '',
      category: 'news',
      status: 1
    },
    aiGenerating: false,
    aiTopic: '',

    feedbackStatus: 'pending',
    feedbackStatusTabs: [
      { id: 'pending', name: '待处理' },
      { id: 'processing', name: '处理中' },
      { id: 'resolved', name: '已解决' },
      { id: 'all', name: '全部' }
    ],
    feedbackType: 'all',
    feedbackTypeTabs: [
      { id: 'all', name: '全部类型' },
      { id: 'identify_error', name: '识别错误' },
      { id: 'classify_error', name: '分类错误' },
      { id: 'info_error', name: '信息错误' },
      { id: 'suggestion', name: '建议' },
      { id: 'other', name: '其他' }
    ],
    feedbackKeyword: '',
    feedbackList: [],
    feedbackLoading: false,
    replyDrafts: {},

    // 反馈采纳 → 添加垃圾分类
    showTrashForm: false,
    acceptingFeedbackId: null,
    trashForm: {
      name: '',
      type: 'recyclable',
      typeName: '可回收物',
      tips: '',
      icon: '🗑️',
      examples: '',
      description: ''
    },
    trashSubmitting: false
  },

  onLoad() {
    this.checkAdminAccess();
  },

  onShow() {
    this.checkAdminAccess();
  },

  getAdminKey() {
    return String(wx.getStorageSync('adminReviewKey') || '').trim();
  },

  checkAdminAccess() {
    const enterpriseInfo = wx.getStorageSync('enterpriseInfo');
    const token = wx.getStorageSync('enterpriseToken');
    const isAdmin = enterpriseInfo && Number(enterpriseInfo.is_admin) === 1;
    const adminKey = this.getAdminKey();
    const hasAdminToken = !!(token && isAdmin);

    if (hasAdminToken || adminKey) {
      this.setData({
        canReview: true,
        adminInfo: hasAdminToken ? enterpriseInfo : { name: '管理员', username: 'ADMIN_KEY' },
        hasPromptedAdminLogin: false
      });
      this.loadCurrentModule();
      return;
    }

    this.setData({
      canReview: false,
      adminInfo: enterpriseInfo || null,
      applications: [],
      newsList: [],
      feedbackList: []
    });

    if (this.data.hasPromptedAdminLogin) return;
    this.setData({ hasPromptedAdminLogin: true });

    wx.showModal({
      title: '需要管理员登录',
      content: '请使用企业管理员账号登录后进入管理中心。',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          this.goToEnterpriseLogin();
        }
      }
    });
  },

  goToEnterpriseLogin() {
    wx.navigateTo({ url: '/pages/enterprise/enterprise?mode=login' });
  },

  onPullDownRefresh() {
    if (!this.data.canReview) {
      wx.stopPullDownRefresh();
      return;
    }
    Promise.resolve(this.loadCurrentModule()).finally(() => wx.stopPullDownRefresh());
  },

  switchModule(e) {
    const moduleId = e.currentTarget.dataset.module;
    if (!moduleId || moduleId === this.data.activeModule) return;
    this.setData({ activeModule: moduleId });
    this.loadCurrentModule();
  },

  loadCurrentModule() {
    if (!this.data.canReview) return Promise.resolve();
    if (this.data.activeModule === 'news') return this.loadNewsList();
    if (this.data.activeModule === 'feedback') return this.loadFeedbackList();
    return this.loadApplications();
  },

  formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  getEnterpriseStatusText(status) {
    const map = {
      pending: '待审核',
      verified: '已通过',
      rejected: '已拒绝'
    };
    return map[status] || status;
  },

  getEnterpriseStatusClass(status) {
    if (status === 'verified') return 'verified';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  },

  onEnterpriseKeywordInput(e) {
    this.setData({ enterpriseKeyword: e.detail.value || '' });
  },

  switchEnterpriseStatus(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.enterpriseStatus) return;
    this.setData({ enterpriseStatus: status });
    this.loadApplications();
  },

  searchEnterprise() {
    this.loadApplications();
  },

  async loadApplications() {
    if (this.data.enterpriseLoading || !this.data.canReview) return;

    this.setData({ enterpriseLoading: true });
    try {
      const res = await enterpriseAPI.getApplications(
        this.data.enterpriseStatus,
        this.data.enterpriseKeyword,
        1,
        50,
        this.getAdminKey()
      );

      if (res.success) {
        const applications = (res.data || []).map((item) => ({
          ...item,
          statusText: this.getEnterpriseStatusText(item.verify_status),
          statusClass: this.getEnterpriseStatusClass(item.verify_status),
          createdAtText: this.formatTime(item.created_at)
        }));
        this.setData({ applications });
      }
    } catch (error) {
      const message = error?.error || '加载失败';
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ enterpriseLoading: false });
    }
  },

  reviewApplication(e) {
    if (!this.data.canReview) {
      this.checkAdminAccess();
      return;
    }

    const { id, status } = e.currentTarget.dataset;
    if (!id || !status) return;

    const actionText = status === 'verified' ? '通过' : '拒绝';
    wx.showModal({
      title: '确认审核',
      content: `确认${actionText}该企业入驻申请吗？`,
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await enterpriseAPI.verifyApplication(id, status, this.getAdminKey());
          if (result.success) {
            wx.showToast({ title: '审核完成', icon: 'success' });
            this.loadApplications();
          }
        } catch (error) {
          wx.showToast({ title: error?.error || '审核失败', icon: 'none' });
        }
      }
    });
  },

  getNewsStatusText(status) {
    return Number(status) === 1 ? '上架' : '下架';
  },

  getNewsStatusClass(status) {
    return Number(status) === 1 ? 'verified' : 'rejected';
  },

  onNewsKeywordInput(e) {
    this.setData({ newsKeyword: e.detail.value || '' });
  },

  switchNewsStatus(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.newsStatus) return;
    this.setData({ newsStatus: status });
    this.loadNewsList();
  },

  switchNewsCategory(e) {
    const category = e.currentTarget.dataset.category;
    if (!category || category === this.data.newsCategory) return;
    this.setData({ newsCategory: category });
    this.loadNewsList();
  },

  searchNews() {
    this.loadNewsList();
  },

  async loadNewsList() {
    if (this.data.newsLoading || !this.data.canReview) return;

    this.setData({ newsLoading: true });
    try {
      const status = this.data.newsStatus === 'all' ? '' : this.data.newsStatus;
      const category = this.data.newsCategory;
      const res = await newsAPI.getAdminList({
        status,
        category,
        keyword: this.data.newsKeyword,
        page: 1,
        limit: 50,
        adminKey: this.getAdminKey()
      });

      if (res.success) {
        const newsList = (res.data || []).map((item) => ({
          ...item,
          status: Number(item.status) === 1 ? 1 : 0,
          statusText: this.getNewsStatusText(item.status),
          statusClass: this.getNewsStatusClass(item.status),
          publishedAtText: this.formatTime(item.published_at),
          updatedAtText: this.formatTime(item.updated_at)
        }));
        this.setData({ newsList });
      }
    } catch (error) {
      wx.showToast({ title: error?.error || '加载资讯失败', icon: 'none' });
    } finally {
      this.setData({ newsLoading: false });
    }
  },

  openCreateNews() {
    this.setData({
      showNewsForm: true,
      isEditingNews: false,
      editingNewsId: null,
      aiTopic: '',
      newsForm: {
        title: '',
        summary: '',
        content: '',
        source: '',
        author: '',
        coverImage: '',
        category: this.data.newsCategory || 'news',
        status: 1
      }
    });
  },

  closeNewsForm() {
    this.setData({
      showNewsForm: false,
      isEditingNews: false,
      editingNewsId: null,
      newsSubmitting: false
    });
  },

  onNewsFormInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`newsForm.${field}`]: e.detail.value || '' });
  },

  switchNewsFormStatus(e) {
    const status = Number(e.currentTarget.dataset.status);
    if (status !== 0 && status !== 1) return;
    this.setData({ 'newsForm.status': status });
  },

  switchNewsFormCategory(e) {
    const category = e.currentTarget.dataset.category;
    if (!category) return;
    this.setData({ 'newsForm.category': category });
  },

  onAiTopicInput(e) {
    this.setData({ aiTopic: e.detail.value || '' });
  },

  async aiGenerateContent() {
    if (this.data.aiGenerating) return;

    const topic = String(this.data.aiTopic || '').trim();
    if (!topic) {
      wx.showToast({ title: '请输入AI生成主题', icon: 'none' });
      return;
    }

    const category = this.data.newsForm.category || 'news';

    this.setData({ aiGenerating: true });
    wx.showLoading({ title: 'AI生成中...' });

    try {
      const res = await newsAPI.aiGenerate(category, topic, this.getAdminKey());
      if (res.success && res.data) {
        const updates = {};
        if (res.data.title) updates['newsForm.title'] = res.data.title;
        if (res.data.summary) updates['newsForm.summary'] = res.data.summary;
        if (res.data.content) updates['newsForm.content'] = res.data.content;
        this.setData(updates);
        wx.showToast({ title: 'AI生成成功，请审阅', icon: 'success' });
      } else {
        wx.showToast({ title: res.error || 'AI生成失败', icon: 'none' });
      }
    } catch (error) {
      wx.showToast({ title: error?.error || 'AI生成失败', icon: 'none' });
    } finally {
      this.setData({ aiGenerating: false });
      wx.hideLoading();
    }
  },

  async editNews(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showLoading({ title: '加载中...' });
    try {
      const res = await newsAPI.getAdminDetail(id, this.getAdminKey());
      if (!res.success || !res.data) {
        wx.showToast({ title: '资讯不存在', icon: 'none' });
        return;
      }

      const item = res.data;
      this.setData({
        showNewsForm: true,
        isEditingNews: true,
        editingNewsId: item.id,
        aiTopic: '',
        newsForm: {
          title: item.title || '',
          summary: item.summary || '',
          content: item.content || '',
          source: item.source || '',
          author: item.author || '',
          coverImage: item.cover_image || '',
          category: item.category || 'news',
          status: Number(item.status) === 0 ? 0 : 1
        }
      });
    } catch (error) {
      wx.showToast({ title: error?.error || '加载资讯失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async submitNewsForm() {
    if (this.data.newsSubmitting) return;

    const form = this.data.newsForm;
    const title = String(form.title || '').trim();
    if (!title) {
      wx.showToast({ title: '标题不能为空', icon: 'none' });
      return;
    }

    const payload = {
      title,
      summary: String(form.summary || '').trim(),
      content: String(form.content || '').trim(),
      source: String(form.source || '').trim(),
      author: String(form.author || '').trim(),
      coverImage: String(form.coverImage || '').trim(),
      category: form.category || 'news',
      status: Number(form.status) === 0 ? 0 : 1
    };

    this.setData({ newsSubmitting: true });
    try {
      let res;
      if (this.data.isEditingNews && this.data.editingNewsId) {
        res = await newsAPI.update(this.data.editingNewsId, payload, this.getAdminKey());
      } else {
        res = await newsAPI.create(payload, this.getAdminKey());
      }

      if (res.success) {
        wx.showToast({ title: this.data.isEditingNews ? '更新成功' : '新增成功', icon: 'success' });
        this.closeNewsForm();
        this.loadNewsList();
      }
    } catch (error) {
      wx.showToast({ title: error?.error || '保存失败', icon: 'none' });
    } finally {
      this.setData({ newsSubmitting: false });
    }
  },

  toggleNewsStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    if (!id) return;

    const currentStatus = Number(status) === 1 ? 1 : 0;
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const actionText = nextStatus === 1 ? '上架' : '下架';

    wx.showModal({
      title: '确认操作',
      content: `确认${actionText}该资讯吗？`,
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await newsAPI.update(id, { status: nextStatus }, this.getAdminKey());
          if (result.success) {
            wx.showToast({ title: `${actionText}成功`, icon: 'success' });
            this.loadNewsList();
          }
        } catch (error) {
          wx.showToast({ title: error?.error || `${actionText}失败`, icon: 'none' });
        }
      }
    });
  },

  deleteNews(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确认删除该资讯吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await newsAPI.remove(id, this.getAdminKey());
          if (result.success) {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadNewsList();
          }
        } catch (error) {
          wx.showToast({ title: error?.error || '删除失败', icon: 'none' });
        }
      }
    });
  },

  getFeedbackStatusText(status) {
    const map = {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决'
    };
    return map[status] || status;
  },

  getFeedbackStatusClass(status) {
    if (status === 'resolved') return 'verified';
    if (status === 'processing') return 'pending';
    return 'rejected';
  },

  onFeedbackKeywordInput(e) {
    this.setData({ feedbackKeyword: e.detail.value || '' });
  },

  switchFeedbackStatus(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.feedbackStatus) return;
    this.setData({ feedbackStatus: status });
    this.loadFeedbackList();
  },

  switchFeedbackType(e) {
    const type = e.currentTarget.dataset.type;
    if (!type || type === this.data.feedbackType) return;
    this.setData({ feedbackType: type });
    this.loadFeedbackList();
  },

  searchFeedback() {
    this.loadFeedbackList();
  },

  onReplyInput(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ [`replyDrafts.${id}`]: e.detail.value || '' });
  },

  async loadFeedbackList() {
    if (this.data.feedbackLoading || !this.data.canReview) return;

    this.setData({ feedbackLoading: true });
    try {
      const status = this.data.feedbackStatus === 'all' ? '' : this.data.feedbackStatus;
      const type = this.data.feedbackType === 'all' ? '' : this.data.feedbackType;
      const res = await feedbackAPI.getAdminList({
        status,
        type,
        keyword: this.data.feedbackKeyword,
        page: 1,
        limit: 50,
        adminKey: this.getAdminKey()
      });

      if (res.success) {
        const drafts = { ...this.data.replyDrafts };
        const feedbackList = (res.data || []).map((item) => {
          if (drafts[item.id] === undefined) {
            drafts[item.id] = item.reply || '';
          }
          return {
            ...item,
            typeText: FEEDBACK_TYPE_TEXT[item.type] || item.type,
            statusText: this.getFeedbackStatusText(item.status),
            statusClass: this.getFeedbackStatusClass(item.status),
            createdAtText: this.formatTime(item.created_at)
          };
        });

        this.setData({
          feedbackList,
          replyDrafts: drafts
        });
      }
    } catch (error) {
      wx.showToast({ title: error?.error || '加载反馈失败', icon: 'none' });
    } finally {
      this.setData({ feedbackLoading: false });
    }
  },

  updateFeedbackStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    if (!id || !status) return;

    const actionText = status === 'resolved' ? '标记为已解决' : '标记为处理中';
    wx.showModal({
      title: '确认操作',
      content: `确认${actionText}？`,
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await feedbackAPI.updateAdmin(id, { status }, this.getAdminKey());
          if (result.success) {
            wx.showToast({ title: '更新成功', icon: 'success' });
            this.loadFeedbackList();
          }
        } catch (error) {
          wx.showToast({ title: error?.error || '更新失败', icon: 'none' });
        }
      }
    });
  },

  async saveFeedbackReply(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const reply = String(this.data.replyDrafts[id] || '').trim();
    if (!reply) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }

    const current = (this.data.feedbackList || []).find((item) => Number(item.id) === Number(id));
    const nextStatus = current && current.status === 'pending' ? 'processing' : (current?.status || 'processing');

    try {
      const result = await feedbackAPI.updateAdmin(
        id,
        { reply, status: nextStatus },
        this.getAdminKey()
      );

      if (result.success) {
        wx.showToast({ title: '回复已保存', icon: 'success' });
        this.loadFeedbackList();
      }
    } catch (error) {
      wx.showToast({ title: error?.error || '保存回复失败', icon: 'none' });
    }
  },

  // === 反馈采纳 → 添加垃圾分类 ===
  openAcceptTrashForm(e) {
    const feedbackId = e.currentTarget.dataset.id;
    const feedbackItem = (this.data.feedbackList || []).find((item) => Number(item.id) === Number(feedbackId));
    const trashName = (feedbackItem && feedbackItem.trash_name) || '';

    this.setData({
      showTrashForm: true,
      acceptingFeedbackId: feedbackId,
      trashForm: {
        name: trashName,
        type: 'recyclable',
        typeName: '可回收物',
        tips: '',
        icon: '🗑️',
        examples: '',
        description: ''
      }
    });
  },

  closeTrashForm() {
    this.setData({
      showTrashForm: false,
      acceptingFeedbackId: null,
      trashSubmitting: false
    });
  },

  onTrashFormInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`trashForm.${field}`]: e.detail.value || '' });
  },

  switchTrashType(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    this.setData({
      'trashForm.type': type,
      'trashForm.typeName': TRASH_TYPE_MAP[type] || type
    });
  },

  async submitTrashForm() {
    if (this.data.trashSubmitting) return;

    const form = this.data.trashForm;
    const name = String(form.name || '').trim();
    if (!name) {
      wx.showToast({ title: '垃圾名称不能为空', icon: 'none' });
      return;
    }

    const trashData = {
      name,
      type: form.type,
      typeName: form.typeName || TRASH_TYPE_MAP[form.type] || '',
      tips: String(form.tips || '').trim(),
      icon: String(form.icon || '🗑️').trim(),
      examples: String(form.examples || '').trim() ? String(form.examples).split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [],
      description: String(form.description || '').trim()
    };

    this.setData({ trashSubmitting: true });
    try {
      const res = await feedbackAPI.acceptAndAddTrash(
        this.data.acceptingFeedbackId,
        trashData,
        this.getAdminKey()
      );

      if (res.success) {
        wx.showToast({ title: res.message || '采纳成功', icon: 'success' });
        this.closeTrashForm();
        this.loadFeedbackList();
      }
    } catch (error) {
      wx.showToast({ title: error?.error || '采纳失败', icon: 'none' });
    } finally {
      this.setData({ trashSubmitting: false });
    }
  }
});
