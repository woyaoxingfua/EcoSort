const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { optionalAuth } = require('./utils/auth');

// 导入路由
const trashRoutes = require('./routes/trash');
const userRoutes = require('./routes/user');
const pointRoutes = require('./routes/points');
const recycleRoutes = require('./routes/recycle');
const newsRoutes = require('./routes/news');
const enterpriseRoutes = require('./routes/enterprise');
const feedbackRoutes = require('./routes/feedback');
const favoritesRoutes = require('./routes/favorites');
const rankingRoutes = require('./routes/ranking');
const uploadRoutes = require('./routes/upload');
const voiceRoutes = require('./routes/voice');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 可选认证中间件（给所有路由注入userId）
app.use(optionalAuth);

// 路由
app.use('/api/trash', trashRoutes);
app.use('/api/user', userRoutes);
app.use('/api/points', pointRoutes);
app.use('/api/recycle', recycleRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/voice', voiceRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'smart-trash-sorting-server'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '智能垃圾分类系统后端服务',
    version: '1.0.0',
    apis: [
      '/api/trash - 垃圾分类相关',
      '/api/user - 用户相关',
      '/api/points - 积分相关',
      '/api/recycle - 回收点相关',
      '/api/news - 资讯相关',
      '/api/enterprise - 企业端相关',
      '/api/ranking - 排行榜/等级/成就',
      '/api/feedback - 反馈相关',
      '/api/favorites - 收藏相关',
      '/api/voice - 语音识别相关'
    ]
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
async function startServer() {
  // 测试数据库连接
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('数据库连接失败，服务器可能无法正常工作');
  }

  app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }
    console.log(`\n🚀 服务器启动成功！`);
    console.log(`📌 本地访问: http://localhost:${PORT}`);
    console.log(`📌 局域网访问: http://${localIp}:${PORT}`);
    console.log(`📌 API文档: http://${localIp}:${PORT}/`);
    console.log(`📌 健康检查: http://${localIp}:${PORT}/health\n`);
  });
}

startServer();
