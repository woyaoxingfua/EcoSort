# EcoSort Server - 后端服务

基于 Node.js + Express + MySQL 的 RESTful API 服务。

## 技术栈

- **运行环境**: Node.js 16+
- **Web 框架**: Express 4.x
- **数据库**: MySQL 5.7+
- **认证**: JWT
- **AI 服务**: SiliconFlow API

## 项目结构

```
smart-trash-sorting-server/
├── config/
│   ├── database.js       # 数据库连接
│   └── constants.js      # 常量配置
├── routes/
│   ├── trash.js          # 垃圾分类
│   ├── user.js           # 用户管理
│   ├── points.js         # 积分系统
│   ├── recycle.js        # 回收点
│   ├── news.js           # 资讯管理
│   ├── enterprise.js     # 企业端
│   ├── voice.js          # 语音识别
│   └── upload.js         # 文件上传
├── services/
│   ├── aiIdentify.js     # AI 图像识别
│   ├── aiContent.js      # AI 内容生成
│   └── speechToText.js   # 语音转文字
├── utils/
│   ├── auth.js           # JWT 认证
│   ├── admin.js          # 管理员校验
│   └── common.js         # 通用工具
├── scripts/
│   └── initDatabase.js   # 数据库初始化
├── app.js                # 入口文件
└── .env.example          # 环境变量示例
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_trash_sorting

# JWT
JWT_SECRET=your_secret_key

# 微信小程序
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
WECHAT_DISABLE_MOCK_LOGIN=true

# SiliconFlow AI (可选)
SILICONFLOW_API_KEY=your_key
SILICONFLOW_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务运行在 `http://localhost:3000`

## API 接口

### 基础地址

```
http://localhost:3000/api
```

### 垃圾分类 `/api/trash`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/search?keyword=xxx` | 搜索垃圾 |
| GET | `/categories` | 获取所有分类 |
| GET | `/type/:type` | 按类型获取 |
| GET | `/hot?limit=10` | 热门搜索 |
| POST | `/identify` | AI 图像识别 |

### 用户 `/api/user`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/login` | 微信登录 |
| GET | `/:id` | 获取用户信息 |
| PUT | `/:id` | 更新用户信息 |
| POST | `/:id/checkin` | 每日打卡 |
| GET | `/:id/history` | 识别历史 |
| GET | `/:id/stats` | 统计信息 |

### 积分 `/api/points`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/records/:userId` | 积分记录 |
| POST | `/add` | 增加积分 |
| POST | `/consume` | 消费积分 |
| GET | `/tasks?userId=xxx` | 任务列表 |
| POST | `/tasks/complete` | 完成任务 |
| GET | `/prizes` | 奖品列表 |
| POST | `/exchange` | 兑换奖品 |
| GET | `/exchanges/:userId` | 兑换记录 |

### 回收点 `/api/recycle`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/nearby?lat=xxx&lng=xxx` | 附近回收点 |
| GET | `/` | 所有回收点 |
| GET | `/:id` | 回收点详情 |

### 资讯 `/api/news`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 资讯列表 |
| GET | `/:id` | 资讯详情 |
| POST | `/` | 新增资讯 (管理) |
| PUT | `/:id` | 更新资讯 (管理) |
| DELETE | `/:id` | 删除资讯 (管理) |

### 企业端 `/api/enterprise`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 企业注册 |
| POST | `/login` | 企业登录 |
| GET | `/applications` | 申请列表 (管理) |
| PUT | `/:id/verify` | 审核申请 (管理) |
| GET | `/:id` | 企业信息 |
| GET | `/:id/stats` | 统计数据 |
| POST | `/verify` | 核销积分 |

## 数据库表

| 表名 | 说明 |
|------|------|
| `users` | 用户信息 |
| `trash_categories` | 垃圾分类数据 |
| `point_records` | 积分记录 |
| `identify_history` | 识别历史 |
| `user_tasks` | 任务完成记录 |
| `prizes` | 兑换奖品 |
| `exchange_records` | 兑换记录 |
| `recycle_points` | 回收点信息 |
| `enterprises` | 企业信息 |
| `verify_records` | 核销记录 |
| `news` | 环保资讯 |

## 部署

### PM2 部署

```bash
npm install -g pm2
pm2 start app.js --name "ecosort-api"
pm2 logs ecosort-api
```

### Nginx 配置

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 常见问题

**Q: 数据库连接失败**
- 检查 MySQL 服务是否启动
- 检查 `.env` 配置是否正确
- 确保数据库用户有权限

**Q: AI 识别不可用**
- 检查 `SILICONFLOW_API_KEY` 是否配置
- 确认 API 配额是否充足

**Q: 微信登录失败**
- 配置正确的 `WECHAT_APPID` 和 `WECHAT_SECRET`
- 或设置 `WECHAT_DISABLE_MOCK_LOGIN=false` 使用模拟登录

## 许可证

MIT License
