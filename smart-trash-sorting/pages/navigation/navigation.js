// pages/navigation/navigation.js
const { recycleAPI } = require('../../utils/api');

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    markers: [],
    recyclePoints: [],
    selectedPoint: null,
    showDetail: false,
    currentFilter: 'all',
    filters: [
      { id: 'all', name: '全部' },
      { id: 'recyclable', name: '可回收' },
      { id: 'hazardous', name: '有害垃圾' },
      { id: 'smart', name: '智能回收' }
    ],
    loading: false
  },

  mapContext: null,

  onLoad() {
    this.getLocation();
  },

  onReady() {
    this.mapContext = wx.createMapContext('recycleMap');
  },

  // 获取当前位置
  getLocation() {
    this.setData({ loading: true });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        });
        this.loadRecyclePoints(res.latitude, res.longitude);
      },
      fail: () => {
        // 使用默认位置
        this.loadRecyclePoints(this.data.latitude, this.data.longitude);
        wx.showToast({
          title: '请开启定位权限',
          icon: 'none'
        });
      }
    });
  },

  // 计算两坐标间距离（km）
  calculateDistance(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (6371 * c).toFixed(1); // 6371是地球平均半径（km）
  },

  // 格式化距离显示
  formatDistance(km) {
    if (km < 1) {
      return Math.round(km * 1000) + 'm';
    }
    return km + 'km';
  },

  // 加载回收点数据
  async loadRecyclePoints(lat, lng) {
    try {
      const res = await recycleAPI.getNearby(lat, lng, 10000);
      
      if (res.success) {
        const userLat = this.data.latitude;
        const userLng = this.data.longitude;
        
        const points = res.data.map(item => {
          let types, prices;
          try { types = typeof item.types === 'string' ? JSON.parse(item.types) : (item.types || []); } 
          catch(e) { types = []; }
          try { prices = typeof item.prices === 'string' ? JSON.parse(item.prices) : (item.prices || {}); } 
          catch(e) { prices = {}; }
          
          // 使用后端返回的distance字段或自行计算
          const distance = item.distance 
            ? parseFloat(item.distance).toFixed(1)
            : this.calculateDistance(userLat, userLng, item.latitude, item.longitude);
          
          return {
            ...item,
            types,
            prices,
            distance,
            distanceText: this.formatDistance(distance)
          };
        });

        // 按距离排序
        points.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        const markers = points.map(point => ({
          id: point.id,
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          title: point.name,
          iconPath: this.getMarkerIcon(point.type),
          width: 40,
          height: 40,
          callout: {
            content: point.name,
            display: 'BYCLICK',
            padding: 8,
            borderRadius: 8,
            fontSize: 12
          }
        }));

        this.setData({
          recyclePoints: points,
          markers: markers,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载回收点失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载回收点失败', icon: 'none' });
    }
  },

  // 获取标记图标
  getMarkerIcon(type) {
    const iconMap = {
      smart: '/static/images/marker-smart.png',
      recyclable: '/static/images/marker-recycle.png',
      hazardous: '/static/images/marker-hazardous.png',
      other: '/static/images/marker-other.png'
    };
    return iconMap[type] || '/static/images/marker.png';
  },

  // 筛选回收点
  filterPoints(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentFilter: filter });

    if (filter === 'all') {
      this.loadRecyclePoints(this.data.latitude, this.data.longitude);
    } else {
      // 从已加载的数据中筛选（减少网络请求）
      const allPoints = this.data.recyclePoints;
      if (allPoints.length > 0) {
        const filtered = allPoints.filter(p => p.type === filter);
        const markers = filtered.map(point => ({
          id: point.id,
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          title: point.name,
          iconPath: this.getMarkerIcon(point.type),
          width: 40,
          height: 40
        }));
        this.setData({ markers });
      }
    }
  },

  // 标记点击事件
  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const point = this.data.recyclePoints.find(p => p.id === markerId);
    if (point) {
      this.setData({
        selectedPoint: point,
        showDetail: true
      });
    }
  },

  // 列表点击
  onPointTap(e) {
    const point = e.currentTarget.dataset.point;
    this.setData({
      latitude: parseFloat(point.latitude),
      longitude: parseFloat(point.longitude),
      selectedPoint: point,
      showDetail: true
    });
    // 移动到该回收点
    if (this.mapContext) {
      this.mapContext.moveToLocation({
        latitude: parseFloat(point.latitude),
        longitude: parseFloat(point.longitude)
      });
    }
  },

  // 关闭详情
  closeDetail() {
    this.setData({ showDetail: false });
  },

  // 阻止冒泡关闭
  preventClose() {},

  // 导航到回收点
  navigateToPoint() {
    const { selectedPoint } = this.data;
    if (!selectedPoint) return;

    wx.openLocation({
      latitude: parseFloat(selectedPoint.latitude),
      longitude: parseFloat(selectedPoint.longitude),
      name: selectedPoint.name,
      address: selectedPoint.address,
      scale: 18
    });
  },

  // 拨打电话
  makeCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  // 定位到当前位置
  locateCurrentPosition() {
    this.getLocation();
    if (this.mapContext) {
      this.mapContext.moveToLocation();
    }
  },

  // 查看回收价格
  viewPrices() {
    const { selectedPoint } = this.data;
    if (!selectedPoint || !selectedPoint.prices) return;

    const priceObj = selectedPoint.prices;
    const prices = Object.entries(priceObj)
      .map(([item, price]) => `${item}: ${price}`)
      .join('\n');

    wx.showModal({
      title: `${selectedPoint.name} - 回收价格`,
      content: prices || '暂无价格信息',
      showCancel: false
    });
  }
});
