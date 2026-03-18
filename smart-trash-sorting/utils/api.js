// API配置
// 可通过 wx.setStorageSync('apiBaseUrl', 'http://你的IP:3000/api') 动态配置
// 未配置时默认使用 localhost（适合开发者工具）
const API_BASE_URL_STORAGE_KEY = 'apiBaseUrl';
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';
// const DEFAULT_API_BASE_URL = 'http://172.20.224.1:3000/api';
// const DEFAULT_API_BASE_URL = 'http://172.20.10.13:3000/api';

const normalizeApiBaseUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return /\/api$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

const getApiBaseUrl = () => {
  const customApiBaseUrl = normalizeApiBaseUrl(wx.getStorageSync(API_BASE_URL_STORAGE_KEY));
  return customApiBaseUrl || DEFAULT_API_BASE_URL;
};

const setApiBaseUrl = (rawUrl) => {
  const normalized = normalizeApiBaseUrl(rawUrl);
  if (!normalized) {
    wx.removeStorageSync(API_BASE_URL_STORAGE_KEY);
    return '';
  }
  wx.setStorageSync(API_BASE_URL_STORAGE_KEY, normalized);
  return normalized;
};

const getRequestApiBaseUrl = (options = {}) => {
  const override = normalizeApiBaseUrl(options.baseUrlOverride || '');
  return override || getApiBaseUrl();
};

const isConnectionRefusedError = (err) => {
  const message = String(err?.errMsg || '');
  return /ERR_CONNECTION_REFUSED|errcode:-102|cronet_error_code:-102/i.test(message);
};

const canRetryWithDefaultBase = (currentBaseUrl, options, err) => {
  if (options._retriedWithDefaultBase) return false;
  if (!isConnectionRefusedError(err)) return false;

  const current = normalizeApiBaseUrl(currentBaseUrl);
  const fallback = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  return !!current && !!fallback && current !== fallback;
};

const getApiOrigin = (apiBaseUrl = getApiBaseUrl()) => {
  return apiBaseUrl.replace(/\/api\/?$/i, '');
};

const HEALTH_PATH = '/health';

const pingApiBaseUrl = (apiBaseUrl, timeout = 800) => new Promise((resolve) => {
  const origin = getApiOrigin(apiBaseUrl);
  if (!origin) {
    resolve(false);
    return;
  }

  wx.request({
    url: `${origin}${HEALTH_PATH}`,
    method: 'GET',
    timeout,
    success: (res) => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const service = res.data && res.data.service;
      resolve(ok && service === 'smart-trash-sorting-server');
    },
    fail: () => resolve(false)
  });
});

const extractSubnet = (apiBaseUrl) => {
  const origin = getApiOrigin(apiBaseUrl);
  const match = origin.match(/^https?:\/\/(\d+)\.(\d+)\.(\d+)\.\d+(?::\d+)?$/);
  if (!match) return '';
  if (Number(match[1]) === 127) return '';
  return `${match[1]}.${match[2]}.${match[3]}`;
};

const scanSubnetForApi = async (subnet, options = {}) => {
  if (!subnet) return '';
  const port = options.port || 3000;
  const concurrency = options.concurrency || 20;
  const timeout = options.timeout || 500;

  const candidates = [];
  for (let i = 2; i <= 254; i += 1) {
    candidates.push(`http://${subnet}.${i}:${port}/api`);
  }

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((url) => pingApiBaseUrl(url, timeout).then((ok) => (ok ? url : '')))
    );
    const hit = results.find((value) => value);
    if (hit) return hit;
  }
  return '';
};

const ensureApiBaseUrl = async (options = {}) => {
  const current = getApiBaseUrl();
  try {
    const ok = await pingApiBaseUrl(current, options.timeout || 800);
    if (ok) return current;
  } catch (e) {
    // ignore
  }

  const stored = normalizeApiBaseUrl(wx.getStorageSync(API_BASE_URL_STORAGE_KEY)) || current;
  const subnet = extractSubnet(stored);
  if (!subnet) return current;

  const detected = await scanSubnetForApi(subnet, {
    port: options.port || 3000,
    concurrency: options.concurrency || 20,
    timeout: options.scanTimeout || 500
  });

  if (detected) {
    setApiBaseUrl(detected);
    return detected;
  }

  return current;
};


const extractUploadsPath = (rawValue) => {
  if (typeof rawValue !== 'string') return '';

  const normalized = rawValue
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/');

  if (normalized.startsWith('/api/uploads/')) {
    return normalized.replace(/^\/api/, '');
  }
  if (normalized.startsWith('/uploads/')) {
    return normalized;
  }
  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  const markerIndex = normalized.indexOf('/uploads/');
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex);
  }

  return '';
};

const resolveMediaUrl = (rawUrl, apiBaseUrl = getApiBaseUrl()) => {
  if (typeof rawUrl !== 'string') return '';

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const apiOrigin = getApiOrigin(apiBaseUrl);
  const localUploadsPath = extractUploadsPath(trimmed);
  if (localUploadsPath) {
    return `${apiOrigin}${localUploadsPath}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const parsedUploadPath = extractUploadsPath(parsed.pathname || '');
      return parsedUploadPath ? `${apiOrigin}${parsedUploadPath}` : trimmed;
    } catch (error) {
      return trimmed;
    }
  }

  return trimmed;
};

const normalizeAvatarFields = (payload, apiBaseUrl) => {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeAvatarFields(item, apiBaseUrl));
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const normalized = {};
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if ((key === 'avatar_url' || key === 'avatarUrl') && typeof value === 'string') {
      normalized[key] = resolveMediaUrl(value, apiBaseUrl);
    } else {
      normalized[key] = normalizeAvatarFields(value, apiBaseUrl);
    }
  });

  return normalized;
};

const clearAuthState = (tokenKey = 'token') => {
  if (tokenKey === 'enterpriseToken') {
    wx.removeStorageSync('enterpriseToken');
    wx.removeStorageSync('enterpriseInfo');
    return;
  }

  try {
    const app = getApp();
    if (app && typeof app.logout === 'function') {
      app.logout();
      return;
    }
  } catch (error) {
    console.warn('获取App实例失败，使用兜底清理登录状态');
  }

  wx.removeStorageSync('token');
  wx.removeStorageSync('userId');
  wx.removeStorageSync('userInfo');
};

// 请求封装
const request = (url, method = 'GET', data = {}, options = {}) => {
  return new Promise((resolve, reject) => {
    const tokenKey = options.tokenKey || 'token';
    const apiBaseUrl = getRequestApiBaseUrl(options);
    // 获取token
    const token = wx.getStorageSync(tokenKey) || '';
    
    wx.request({
      url: `${apiBaseUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(normalizeAvatarFields(res.data, apiBaseUrl));
        } else {
          // 401时清除登录状态
          if (res.statusCode === 401) {
            clearAuthState(tokenKey);
          }
          reject(res.data);
        }
      },
      fail: (err) => {
        if (canRetryWithDefaultBase(apiBaseUrl, options, err)) {
          const fallbackBase = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
          console.warn(`网络请求失败，尝试回退默认地址: ${apiBaseUrl} -> ${fallbackBase}`);
          request(url, method, data, {
            ...options,
            _retriedWithDefaultBase: true,
            baseUrlOverride: fallbackBase
          })
            .then((result) => {
              wx.removeStorageSync(API_BASE_URL_STORAGE_KEY);
              resolve(result);
            })
            .catch(reject);
          return;
        }

        const requestUrl = `${apiBaseUrl}${url}`;
        const isRefused = isConnectionRefusedError(err);
        console.error('网络请求失败:', { requestUrl, err });
        reject({
          error: isRefused
            ? '无法连接后端服务，请确认服务已启动并检查请求地址'
            : '网络请求失败，请检查网络连接',
          requestUrl,
          detail: err
        });
      }
    });
  });
};

// 上传文件封装（用于头像上传等）
const uploadFile = (url, filePath, name = 'file', formData = {}, options = {}) => {
  return new Promise((resolve, reject) => {
    const tokenKey = options.tokenKey || 'token';
    const apiBaseUrl = getRequestApiBaseUrl(options);
    const token = wx.getStorageSync(tokenKey) || '';

    wx.uploadFile({
      url: `${apiBaseUrl}${url}`,
      filePath,
      name,
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}');
          const normalizedData = normalizeAvatarFields(data, apiBaseUrl);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(normalizedData);
          } else {
            if (res.statusCode === 401) {
              clearAuthState(tokenKey);
            }
            reject(normalizedData);
          }
        } catch (err) {
          reject({ error: '上传失败：响应解析异常' });
        }
      },
      fail: (err) => {
        if (canRetryWithDefaultBase(apiBaseUrl, options, err)) {
          const fallbackBase = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
          console.warn(`上传失败，尝试回退默认地址: ${apiBaseUrl} -> ${fallbackBase}`);
          uploadFile(url, filePath, name, formData, {
            ...options,
            _retriedWithDefaultBase: true,
            baseUrlOverride: fallbackBase
          })
            .then((result) => {
              wx.removeStorageSync(API_BASE_URL_STORAGE_KEY);
              resolve(result);
            })
            .catch(reject);
          return;
        }

        const requestUrl = `${apiBaseUrl}${url}`;
        const isRefused = isConnectionRefusedError(err);
        console.error('上传失败:', { requestUrl, err });
        reject({
          error: isRefused
            ? '无法连接后端服务，请确认服务已启动并检查请求地址'
            : '上传失败，请检查网络连接',
          requestUrl,
          detail: err
        });
      }
    });
  });
};

// 垃圾分类API
const trashAPI = {
  // 搜索垃圾分类
  search: (keyword) => request(`/trash/search?keyword=${encodeURIComponent(keyword)}`),
  
  // 获取所有分类
  getCategories: () => request('/trash/categories'),
  
  // 根据类型获取垃圾列表
  getByType: (type) => request(`/trash/type/${type}`),
  
  // 获取热门搜索
  getHot: (limit = 10) => request(`/trash/hot?limit=${limit}`),
  
  // AI识别
  identify: (imageUrl, imageName, imageBase64 = '') => request('/trash/identify', 'POST', { imageUrl, imageName, imageBase64 })
};

// 用户API
const userAPI = {
  // 微信登录 - 符合微信最新规范
  // userInfo: 可选，包含 nickName 和 avatarUrl
  // devOpenId: 开发环境稳定标识（可选）
  login: (code, userInfo, devOpenId) => request('/user/login', 'POST', { code, userInfo, devOpenId }),
  
  // 获取用户信息
  getUser: (id) => request(`/user/${id}`),
  
  // 更新用户信息
  updateUser: (id, data) => request(`/user/${id}`, 'PUT', data),
  
  // 上传头像
  uploadAvatar: (filePath) => uploadFile('/upload/avatar', filePath, 'file'),
  
  // 用户打卡
  checkIn: (id) => request(`/user/${id}/checkin`, 'POST'),
  
  // 获取识别历史
  getHistory: (id, limit = 50) => request(`/user/${id}/history?limit=${limit}`),

  // 清空识别历史
  clearHistory: (id) => request(`/user/${id}/history`, 'DELETE'),
  
  // 获取统计信息
  getStats: (id) => request(`/user/${id}/stats`)
};

// 积分API
const pointAPI = {
  // 获取积分记录
  getRecords: (userId, limit = 50, page = 1) => 
    request(`/points/records/${userId}?limit=${limit}&page=${page}`),
  
  // 添加积分
  addPoints: (userId, points, reason, relatedId) => 
    request('/points/add', 'POST', { userId, points, reason, relatedId }),
  
  // 消费积分
  consumePoints: (userId, points, reason) => 
    request('/points/consume', 'POST', { userId, points, reason }),
  
  // 获取任务列表
  getTasks: (userId) => request(`/points/tasks?userId=${userId}`),
  
  // 完成任务
  completeTask: (userId, taskId) => 
    request('/points/tasks/complete', 'POST', { userId, taskId }),
  
  // 获取奖品列表
  getPrizes: (status = 1) => request(`/points/prizes?status=${status}`),
  
  // 兑换奖品
  exchangePrize: (userId, prizeId, address, phone) => 
    request('/points/exchange', 'POST', { userId, prizeId, address, phone }),
  
  // 获取兑换记录
  getExchanges: (userId) => request(`/points/exchanges/${userId}`)
};

// 回收点API
const recycleAPI = {
  // 获取附近回收点
  getNearby: (lat, lng, radius = 5000, type) => 
    request(`/recycle/nearby?lat=${lat}&lng=${lng}&radius=${radius}${type ? '&type='+type : ''}`),
  
  // 获取所有回收点
  getAll: (type, status = 1) => 
    request(`/recycle?status=${status}${type ? '&type='+type : ''}`),
  
  // 获取回收点详情
  getDetail: (id) => request(`/recycle/${id}`)
};

// 资讯/内容API（支持 category 筛选：news/knowledge/mistake/daily_tip）
const newsAPI = {
  // 获取内容列表（公开，支持 category）
  getList: (limit = 10, page = 1, status = 1, category = '') => {
    let url = `/news?limit=${limit}&page=${page}&status=${status}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    return request(url);
  },
  
  // 获取详情
  getDetail: (id) => request(`/news/${id}`),

  // 管理端：获取内容列表（支持 category）
  getAdminList: ({ status = '', keyword = '', category = '', page = 1, limit = 20, adminKey = '' } = {}) => {
    const params = [
      `page=${encodeURIComponent(page)}`,
      `limit=${encodeURIComponent(limit)}`
    ];
    if (status !== '' && status !== null && status !== undefined) {
      params.push(`status=${encodeURIComponent(status)}`);
    }
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (adminKey) params.push(`adminKey=${encodeURIComponent(adminKey)}`);
    return request(`/news/admin/list?${params.join('&')}`, 'GET', {}, { tokenKey: 'enterpriseToken' });
  },

  // 管理端：获取详情
  getAdminDetail: (id, adminKey = '') => {
    const suffix = adminKey ? `?adminKey=${encodeURIComponent(adminKey)}` : '';
    return request(`/news/admin/${id}${suffix}`, 'GET', {}, { tokenKey: 'enterpriseToken' });
  },

  // 管理端：新增（支持 category）
  create: (data = {}, adminKey = '') =>
    request('/news', 'POST', adminKey ? { ...data, adminKey } : data, { tokenKey: 'enterpriseToken' }),

  // 管理端：更新
  update: (id, data = {}, adminKey = '') =>
    request(`/news/${id}`, 'PUT', adminKey ? { ...data, adminKey } : data, { tokenKey: 'enterpriseToken' }),

  // 管理端：删除
  remove: (id, adminKey = '') => {
    const suffix = adminKey ? `?adminKey=${encodeURIComponent(adminKey)}` : '';
    return request(`/news/${id}${suffix}`, 'DELETE', {}, { tokenKey: 'enterpriseToken' });
  },

  // 管理端：AI辅助生成内容
  aiGenerate: (category, topic, adminKey = '') =>
    request('/news/ai-generate', 'POST', adminKey ? { category, topic, adminKey } : { category, topic }, { tokenKey: 'enterpriseToken' })
};

// 企业端API
const enterpriseAPI = {
  // 企业注册
  register: (data) => request('/enterprise/register', 'POST', data),
  
  // 企业登录
  login: (username, password) =>
    request('/enterprise/login', 'POST', { username, password }),
  
  // 获取企业信息
  getInfo: (id) => request(`/enterprise/${id}`, 'GET', {}, { tokenKey: 'enterpriseToken' }),
  
  // 获取统计数据
  getStats: (id, days = 30) => request(`/enterprise/${id}/stats?days=${days}`, 'GET', {}, { tokenKey: 'enterpriseToken' }),
  
  // 获取核销记录
  getRecords: (id, limit = 20, page = 1) =>
    request(`/enterprise/${id}/records?limit=${limit}&page=${page}`, 'GET', {}, { tokenKey: 'enterpriseToken' }),
  
  // 核销积分
  verify: (enterpriseId, userId, itemName, points, verifyCode) =>
    request('/enterprise/verify', 'POST', { enterpriseId, userId, itemName, points, verifyCode }, { tokenKey: 'enterpriseToken' }),

  // 管理端：获取企业申请列表
  getApplications: (status = 'pending', keyword = '', page = 1, limit = 30, adminKey = '') => {
    const params = [
      `status=${encodeURIComponent(status)}`,
      `page=${encodeURIComponent(page)}`,
      `limit=${encodeURIComponent(limit)}`
    ];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (adminKey) params.push(`adminKey=${encodeURIComponent(adminKey)}`);
    return request(`/enterprise/applications?${params.join('&')}`, 'GET', {}, { tokenKey: 'enterpriseToken' });
  },

  // 管理端：审核企业申请
  verifyApplication: (id, status, adminKey = '') =>
    request(`/enterprise/${id}/verify`, 'PUT', { status, adminKey }, { tokenKey: 'enterpriseToken' })
};

// 反馈API
const feedbackAPI = {
  // 提交反馈
  submit: (userId, type, content, trashName, contact) =>
    request('/feedback', 'POST', { userId, type, content, trashName, contact }),
  
  // 获取用户反馈列表
  getList: (userId, limit = 20, page = 1) =>
    request(`/feedback/user/${userId}?limit=${limit}&page=${page}`),

  // 管理端：获取反馈列表
  getAdminList: ({ status = '', type = '', keyword = '', page = 1, limit = 20, adminKey = '' } = {}) => {
    const params = [
      `page=${encodeURIComponent(page)}`,
      `limit=${encodeURIComponent(limit)}`
    ];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (type) params.push(`type=${encodeURIComponent(type)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (adminKey) params.push(`adminKey=${encodeURIComponent(adminKey)}`);
    return request(`/feedback/admin/list?${params.join('&')}`, 'GET', {}, { tokenKey: 'enterpriseToken' });
  },

  // 管理端：更新反馈状态/回复
  updateAdmin: (id, data = {}, adminKey = '') =>
    request(`/feedback/admin/${id}`, 'PUT', adminKey ? { ...data, adminKey } : data, { tokenKey: 'enterpriseToken' }),

  // 管理端：采纳反馈并添加垃圾分类
  acceptAndAddTrash: (feedbackId, trashData = {}, adminKey = '') =>
    request(`/feedback/admin/${feedbackId}/accept-trash`, 'POST', adminKey ? { ...trashData, adminKey } : trashData, { tokenKey: 'enterpriseToken' })
};

// 语音识别API
const voiceAPI = {
  /**
   * 上传音频文件进行语音转文字
   * @param {string} filePath - 微信临时文件路径
   * @returns {Promise<{success, data: {text}}>}
   */
  recognize: (filePath) => uploadFile('/voice/recognize', filePath, 'audio')
};

// 收藏API
const favoritesAPI = {
  // 添加收藏
  add: (userId, trashId) => request('/favorites', 'POST', { userId, trashId }),
  
  // 取消收藏
  remove: (userId, trashId) => request('/favorites', 'DELETE', { userId, trashId }),
  
  // 获取收藏列表
  getList: (userId) => request(`/favorites/${userId}`),
  
  // 检查是否已收藏
  check: (userId, trashId) => request(`/favorites/check/${userId}/${trashId}`)
};

// 排行榜/成就API
const rankingAPI = {
  // 积分排行榜
  getPointsRank: (limit = 20) => request(`/ranking/points?limit=${limit}`),
  
  // 识别排行榜
  getIdentifyRank: (limit = 20) => request(`/ranking/identify?limit=${limit}`),
  
  // 打卡排行榜
  getCheckinRank: (limit = 20) => request(`/ranking/checkin?limit=${limit}`),
  
  // 我的排名
  getMyRank: () => request('/ranking/myrank'),
  
  // 等级列表
  getLevels: () => request('/ranking/levels'),
  
  // 成就列表
  getAchievements: () => request('/ranking/achievements'),
  
  // 领取成就奖励
  claimAchievement: (achievementId) => request('/ranking/achievements/claim', 'POST', { achievementId })
};

module.exports = {
  getApiBaseUrl,
  setApiBaseUrl,
  ensureApiBaseUrl,
  resolveMediaUrl,
  trashAPI,
  userAPI,
  pointAPI,
  recycleAPI,
  newsAPI,
  enterpriseAPI,
  feedbackAPI,
  favoritesAPI,
  rankingAPI,
  voiceAPI
};



