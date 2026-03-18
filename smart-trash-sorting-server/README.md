<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat-square&logo=mysql&logoColor=white" />
</p>

# EcoSort Server

> RESTful API 后端服务

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|:---:|:---:|:---|
| Node.js | 18+ | 运行环境 |
| Express | 4.x | Web 框架 |
| MySQL | 5.7+ | 数据存储 |
| JWT | - | 身份认证 |
| SiliconFlow | - | AI 图像识别 |

## 📁 项目结构

```
smart-trash-sorting-server/
├── config/
│   ├── database.js          # 数据库连接池
│   └── constants.js         # 常量配置
├── routes/
│   ├── trash.js             # 垃圾分类 API
│   ├── user.js              # 用户管理 API
│   ├── points.js            # 积分系统 API
│   ├── recycle.js           # 回收点 API
│   ├── news.js              # 资讯管理 API
│   ├── enterprise.js        # 企业端 API
│   ├── voice.js             # 语音识别 API
│   └── upload.js            # 文件上传 API
├── services/
│   ├── aiIdentify.js        # AI 图像识别
│   ├── aiContent.js         # AI 内容生成
│   └── speechToText.js      # 语音转文字
├── utils/
│   ├── auth.js              # JWT 认证中间件
│   ├── admin.js             # 管理员校验
│   └── common.js            # 通用工具函数
├── scripts/
│   └── initDatabase.js      # 数据库初始化
├── app.js                   # 应用入口
└── .env.example             # 环境变量模板
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

```bash
cp .env.example .env
```

编辑 `.env`：

```ini
# ========== 数据库 ==========
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_trash_sorting

# ========== JWT ==========
JWT_SECRET=your_jwt_secret_key

# ========== 微信小程序 ==========
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
WECHAT_DISABLE_MOCK_LOGIN=true

# ========== SiliconFlow AI（可选）==========
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务

```bash
# 开发环境（热重载）
npm run dev

# 生产环境
npm start
```

> 默认运行在 `http://localhost:3000`

## 📖 API 接口

### Base URL

```
http://localhost:3000/api
```

---

### 🔍 垃圾分类 `/api/trash`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `GET` | `/search?keyword=塑料瓶` | 搜索垃圾分类 |
| `GET` | `/categories` | 获取四大分类列表 |
| `GET` | `/type/:type` | 按类型筛选垃圾 |
| `GET` | `/hot?limit=10` | 热门搜索排行 |
| `POST` | `/identify` | AI 图像识别 |

---

### 👤 用户管理 `/api/user`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `POST` | `/login` | 微信授权登录 |
| `GET` | `/:id` | 获取用户信息 |
| `PUT` | `/:id` | 更新用户资料 |
| `POST` | `/:id/checkin` | 每日打卡签到 |
| `GET` | `/:id/history` | 识别历史记录 |
| `GET` | `/:id/stats` | 用户统计数据 |

---

### 🎁 积分系统 `/api/points`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `GET` | `/records/:userId` | 积分变动记录 |
| `POST` | `/add` | 增加积分 |
| `POST` | `/consume` | 消费积分 |
| `GET` | `/tasks?userId=xxx` | 任务列表 |
| `POST` | `/tasks/complete` | 完成任务 |
| `GET` | `/prizes` | 奖品列表 |
| `POST` | `/exchange` | 兑换奖品 |
| `GET` | `/exchanges/:userId` | 兑换记录 |

---

### 📍 回收点 `/api/recycle`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `GET` | `/nearby?lat=xx&lng=xx` | 附近回收点 |
| `GET` | `/` | 全部回收点 |
| `GET` | `/:id` | 回收点详情 |

---

### 📰 资讯管理 `/api/news`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `GET` | `/` | 资讯列表 |
| `GET` | `/:id` | 资讯详情 |
| `POST` | `/` | 新增资讯 ⚡ |
| `PUT` | `/:id` | 更新资讯 ⚡ |
| `DELETE` | `/:id` | 删除资讯 ⚡ |

> ⚡ 需要管理员权限

---

### 🏢 企业端 `/api/enterprise`

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `POST` | `/register` | 企业注册申请 |
| `POST` | `/login` | 企业登录 |
| `GET` | `/applications` | 申请列表 ⚡ |
| `PUT` | `/:id/verify` | 审核申请 ⚡ |
| `GET` | `/:id` | 企业信息 |
| `GET` | `/:id/stats` | 统计数据 |
| `POST` | `/verify` | 积分核销 |

---

## 🗃️ 数据库表

| 表名 | 说明 |
|:-----|:-----|
| `users` | 用户信息 |
| `trash_categories` | 垃圾分类数据（100+ 条） |
| `point_records` | 积分变动记录 |
| `identify_history` | AI 识别历史 |
| `user_tasks` | 任务完成记录 |
| `prizes` | 兑换奖品 |
| `exchange_records` | 兑换记录 |
| `recycle_points` | 回收点信息 |
| `enterprises` | 企业信息 |
| `verify_records` | 核销记录 |
| `news` | 环保资讯 |

## 📦 生产部署

### PM2 部署

```bash
npm install -g pm2

# 启动服务
pm2 start app.js --name ecosort-api

# 查看状态
pm2 status

# 查看日志
pm2 logs ecosort-api

# 重启服务
pm2 restart ecosort-api
```

### Nginx 反向代理

```nginx
upstream ecosort_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://ecosort_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
    }
}
```

## ❓ 常见问题

<details>
<summary><b>数据库连接失败</b></summary>

- 检查 MySQL 服务是否启动
- 检查 `.env` 中的数据库配置
- 确认数据库用户权限

</details>

<details>
<summary><b>AI 识别不可用</b></summary>

- 检查 `SILICONFLOW_API_KEY` 是否配置
- 确认 API 配额是否充足
- 检查网络是否能访问 SiliconFlow

</details>

<details>
<summary><b>微信登录失败</b></summary>

- 配置正确的 `WECHAT_APPID` 和 `WECHAT_SECRET`
- 开发环境可设置 `WECHAT_DISABLE_MOCK_LOGIN=false`

</details>

## 📄 License

MIT
