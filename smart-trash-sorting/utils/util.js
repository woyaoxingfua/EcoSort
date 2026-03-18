const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 格式化日期
const formatDate = (date, format = 'YYYY-MM-DD') => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  return format
    .replace('YYYY', year)
    .replace('MM', formatNumber(month))
    .replace('DD', formatNumber(day))
}

// 计算两个日期相差天数
const daysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1 - date2) / oneDay))
}

// 节流函数
const throttle = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args)
        timer = null
      }, delay)
    }
  }
}

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 显示提示
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  })
}

// 显示加载
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

// 隐藏加载
const hideLoading = () => {
  wx.hideLoading()
}

// 确认对话框
const confirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

// 存储数据
const setStorage = (key, data) => {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('存储失败', e)
    return false
  }
}

// 获取数据
const getStorage = (key, defaultValue = null) => {
  try {
    return wx.getStorageSync(key) || defaultValue
  } catch (e) {
    console.error('读取失败', e)
    return defaultValue
  }
}

// 删除数据
const removeStorage = (key) => {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (e) {
    console.error('删除失败', e)
    return false
  }
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 深拷贝
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

// 随机整数
const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 获取垃圾分类颜色
const getTrashTypeColor = (type) => {
  const colors = {
    recyclable: '#2c9678',
    hazardous: '#e74c3c',
    kitchen: '#8b6914',
    other: '#7f8c8d'
  }
  return colors[type] || '#999'
}

// 获取垃圾分类名称
const getTrashTypeName = (type) => {
  const names = {
    recyclable: '可回收物',
    hazardous: '有害垃圾',
    kitchen: '厨余垃圾',
    other: '其他垃圾'
  }
  return names[type] || '未知'
}

// 获取垃圾分类图标
const getTrashTypeIcon = (type) => {
  const icons = {
    recyclable: '♻️',
    hazardous: '☠️',
    kitchen: '🍲',
    other: '🗑️'
  }
  return icons[type] || '🗑️'
}

// 格式化时间为相对时间
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

module.exports = {
  formatTime,
  formatDate,
  daysBetween,
  throttle,
  debounce,
  showToast,
  showLoading,
  hideLoading,
  confirm,
  setStorage,
  getStorage,
  removeStorage,
  generateId,
  deepClone,
  randomInt,
  getTrashTypeColor,
  getTrashTypeName,
  getTrashTypeIcon,
  formatRelativeTime
}
