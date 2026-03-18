// pages/science/science.js
const { newsAPI, trashAPI } = require('../../utils/api');

// 硬编码兜底数据（当数据库无数据时使用）
const DEFAULT_TRASH_TYPES = [
  {
    name: '可回收物',
    icon: '♻️',
    color: '#2c9678',
    desc: '适宜回收利用和资源化利用的生活废弃物',
    items: ['废纸', '塑料', '玻璃', '金属', '纺织物'],
    tips: ['保持清洁干燥', '压扁节省空间', '尖锐物品包好'],
    examples: [
      { name: '报纸', icon: '📰' },
      { name: '塑料瓶', icon: '🥤' },
      { name: '玻璃瓶', icon: '🍾' },
      { name: '易拉罐', icon: '🥫' },
      { name: '旧衣服', icon: '👕' }
    ]
  },
  {
    name: '有害垃圾',
    icon: '☠️',
    color: '#e74c3c',
    desc: '对人体健康或自然环境造成直接或潜在危害的废弃物',
    items: ['电池', '灯管', '药品', '油漆', '温度计'],
    tips: ['轻放防破损', '保持完整性', '密封防泄漏'],
    examples: [
      { name: '电池', icon: '🔋' },
      { name: '灯管', icon: '💡' },
      { name: '药品', icon: '💊' },
      { name: '油漆', icon: '🎨' },
      { name: '温度计', icon: '🌡️' }
    ]
  },
  {
    name: '厨余垃圾',
    icon: '🍲',
    color: '#8b6914',
    desc: '居民日常生活及食品加工、饮食服务等活动中产生的废弃物',
    items: ['剩菜剩饭', '瓜皮果核', '花卉绿植', '过期食品'],
    tips: ['沥干水分', '去除包装', '破袋投放'],
    examples: [
      { name: '剩菜', icon: '🍲' },
      { name: '果皮', icon: '🍎' },
      { name: '蛋壳', icon: '🥚' },
      { name: '茶叶', icon: '🍵' },
      { name: '骨头', icon: '🍖' }
    ]
  },
  {
    name: '其他垃圾',
    icon: '🗑️',
    color: '#7f8c8d',
    desc: '除可回收物、有害垃圾、厨余垃圾之外的其他生活废弃物',
    items: ['污染纸张', '烟蒂', '尘土', '破碎陶瓷'],
    tips: ['装袋投放', '沥干水分', '防止散落'],
    examples: [
      { name: '纸巾', icon: '🧻' },
      { name: '烟蒂', icon: '🚬' },
      { name: '尘土', icon: '🧹' },
      { name: '破碎陶瓷', icon: '🏺' },
      { name: '大骨头', icon: '🦴' }
    ]
  }
];

const DEFAULT_MISTAKES = [
  { id: 1, title: '大骨头是厨余垃圾？', content: '错误！大骨头质地坚硬，不易腐烂，应投入其他垃圾桶。', icon: '🦴' },
  { id: 2, title: '厕纸是可回收物？', content: '错误！厕纸遇水即溶，不属于可回收纸张。', icon: '🧻' },
  { id: 3, title: '玻璃瓶要打碎再扔？', content: '错误！完整玻璃瓶可以直接回收，打碎后反而可能划伤他人。', icon: '🍾' },
  { id: 4, title: '电池都是有害垃圾？', content: '不完全正确！普通干电池已达到无汞或低汞标准，属于其他垃圾。', icon: '🔋' },
  { id: 5, title: '外卖盒洗干净也不能回收？', content: '错误！外卖盒如果清洗干净、没有油污，是可以回收的。', icon: '🥡' }
];

Page({
  data: {
    activeTab: 'types',
    tabs: [
      { id: 'types', name: '分类知识' },
      { id: 'mistakes', name: '常见误区' },
      { id: 'news', name: '环保资讯' }
    ],
    trashTypes: DEFAULT_TRASH_TYPES,
    mistakes: DEFAULT_MISTAKES,
    // 从数据库加载的知识和误区文章（用于详情展示）
    knowledgeList: [],
    mistakeList: [],
    newsList: [],
    selectedType: null
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ activeTab: 'types' });
    }
    if (options.keyword) {
      this.showTrashDetail(options.keyword);
    }
    this.loadNews();
    this.loadKnowledge();
    this.loadMistakes();
  },

  // 显示垃圾详情（从scan页面跳转过来）
  async showTrashDetail(keyword) {
    try {
      const res = await trashAPI.search(keyword);
      if (res.success && res.data.length > 0) {
        const item = res.data[0];
        const typeNameMap = {
          recyclable: '可回收物',
          hazardous: '有害垃圾',
          kitchen: '厨余垃圾',
          other: '其他垃圾'
        };
        wx.showModal({
          title: item.name,
          content: `分类：${item.typeName || typeNameMap[item.type] || item.type_name}\n\n投放提示：${item.tips || '暂无'}\n\n详细说明：${item.description || '暂无'}`,
          showCancel: false
        });
      }
    } catch (error) {
      console.error('查询垃圾详情失败:', error);
    }
  },

  // 加载环保资讯
  async loadNews() {
    try {
      const res = await newsAPI.getList(10, 1, 1, 'news');
      if (res.success) {
        const news = res.data.map(item => ({
          id: item.id,
          title: item.title,
          date: item.published_at ? item.published_at.split('T')[0] : '',
          source: item.source,
          summary: item.summary
        }));
        this.setData({ newsList: news });
      }
    } catch (error) {
      console.error('加载资讯失败:', error);
    }
  },

  // 从数据库加载分类知识文章
  async loadKnowledge() {
    try {
      const res = await newsAPI.getList(20, 1, 1, 'knowledge');
      if (res.success && res.data && res.data.length > 0) {
        this.setData({ knowledgeList: res.data });
      }
    } catch (error) {
      console.error('加载分类知识失败:', error);
    }
  },

  // 从数据库加载常见误区
  async loadMistakes() {
    try {
      const res = await newsAPI.getList(20, 1, 1, 'mistake');
      if (res.success && res.data && res.data.length > 0) {
        const dbMistakes = res.data.map((item, index) => ({
          id: item.id,
          title: item.title,
          content: item.content || item.summary || '',
          summary: item.summary || '',
          icon: '❓',
          fromDb: true
        }));
        this.setData({ mistakes: dbMistakes });
      }
    } catch (error) {
      console.error('加载常见误区失败，使用默认数据:', error);
      // 失败时保持默认硬编码数据
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'news') {
      this.loadNews();
    } else if (tab === 'mistakes') {
      this.loadMistakes();
    } else if (tab === 'types') {
      this.loadKnowledge();
    }
  },

  // 展开分类详情
  expandType(e) {
    const index = e.currentTarget.dataset.index;
    const type = this.data.trashTypes[index];
    this.setData({ selectedType: type });
  },

  // 关闭详情
  closeDetail() {
    this.setData({ selectedType: null });
  },

  // 阻止冒泡关闭
  preventClose() {},

  // 查看误区详情
  viewMistake(e) {
    const mistake = e.currentTarget.dataset.item;
    if (mistake.fromDb && mistake.id) {
      // 来自数据库的误区，尝试获取完整内容
      newsAPI.getDetail(mistake.id).then(res => {
        if (res.success && res.data) {
          wx.showModal({
            title: res.data.title,
            content: res.data.content || res.data.summary || mistake.content,
            showCancel: false
          });
        } else {
          wx.showModal({ title: mistake.title, content: mistake.content, showCancel: false });
        }
      }).catch(() => {
        wx.showModal({ title: mistake.title, content: mistake.content, showCancel: false });
      });
    } else {
      wx.showModal({
        title: mistake.title,
        content: mistake.content,
        showCancel: false
      });
    }
  },

  // 查看数据库中的分类知识文章
  async viewKnowledge(e) {
    const item = e.currentTarget.dataset.item;
    try {
      const res = await newsAPI.getDetail(item.id);
      if (res.success) {
        wx.showModal({
          title: res.data.title,
          content: res.data.content || res.data.summary || '暂无详细内容',
          showCancel: false
        });
      }
    } catch (error) {
      wx.showModal({
        title: item.title,
        content: item.summary || '暂无详细内容',
        showCancel: false
      });
    }
  },

  // 查看新闻详情
  async viewNews(e) {
    const news = e.currentTarget.dataset.item;
    try {
      const res = await newsAPI.getDetail(news.id);
      if (res.success) {
        wx.showModal({
          title: res.data.title,
          content: `${res.data.source} ${res.data.published_at ? res.data.published_at.split('T')[0] : ''}\n\n${res.data.summary || res.data.content || '暂无详细内容'}`,
          showCancel: false
        });
      }
    } catch (error) {
      console.error('获取资讯详情失败:', error);
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '垃圾分类科普知识',
      path: '/pages/science/science'
    };
  }
});
