# 智能垃圾分类系统 - 后端服务

基于 Node.js + Express + MySQL 的后端API服务。

## 技术栈

- **运行环境**: Node.js 16+
- **Web框架**: Express 4.x
- **数据库**: MySQL 5.7+
- **ORM**: mysql2 (原生SQL)
- **其他**: CORS、JWT、bcryptjs

## 项目结构

```
smart-trash-sorting-server/
├── config/                 # 配置文件
│   └── database.js        # 数据库连接配置
├── routes/                # 路由
│   ├── trash.js          # 垃圾分类相关
│   ├── user.js           # 用户相关
│   ├── points.js         # 积分相关
│   ├── recycle.js        # 回收点相关
│   ├── news.js           # 资讯相关
│   └── enterprise.js     # 企业端相关
├── scripts/              # 脚本
│   └── initDatabase.js   # 数据库初始化脚本
├── app.js               # 应用入口
├── package.json         # 项目配置
└── .env                 # 环境变量
```

## 快速开始

### 1. 安装依赖

```bash
cd smart-trash-sorting-server
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并修改配置：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=smart_trash_sorting

# JWT密钥
JWT_SECRET=your_secret_key

# 微信小程序（可选）
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
WECHAT_DISABLE_MOCK_LOGIN=true

# SiliconFlow AI（拍照识别）
SILICONFLOW_API_URL=https://api.siliconflow.cn/v1
SILICONFLOW_API_KEY=your_siliconflow_key
# 建议使用视觉模型；未配置时服务端会自动尝试内置视觉模型
SILICONFLOW_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
# 可选：多个备用模型，英文逗号分隔
SILICONFLOW_FALLBACK_MODELS=Qwen/Qwen2-VL-7B-Instruct
# 超时建议>=90秒，避免大图识别频繁超时
SILICONFLOW_TIMEOUT_MS=90000
SILICONFLOW_RETRY_TIMEOUT_MS=120000
```

说明：默认启用 `WECHAT_DISABLE_MOCK_LOGIN=true`，登录将严格使用微信 `openid` 识别用户。
若 `WECHAT_APPID/WECHAT_SECRET` 未配置，登录会返回配置缺失错误，避免把同一微信账号误判为新用户。

### 3. 初始化数据库

确保MySQL服务已启动，然后运行：

```bash
npm run init-db
```

这将自动创建数据库和所有数据表，并插入初始数据。

### 4. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器默认运行在 `http://localhost:3000`

## API接口文档

### 基础地址
```
http://localhost:3000/api
```

### 接口列表

#### 垃圾分类
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/trash/search?keyword=xxx` | 搜索垃圾分类 |
| GET | `/trash/categories` | 获取所有分类 |
| GET | `/trash/type/:type` | 按类型获取垃圾 |
| GET | `/trash/hot?limit=10` | 获取热门搜索 |
| POST | `/trash/identify` | AI识别垃圾 |

#### 用户
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/user/login` | 用户登录 |
| GET | `/user/:id` | 获取用户信息 |
| PUT | `/user/:id` | 更新用户信息 |
| POST | `/user/:id/checkin` | 用户打卡 |
| GET | `/user/:id/history` | 获取识别历史 |
| GET | `/user/:id/stats` | 获取统计信息 |

#### 积分
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/points/records/:userId` | 获取积分记录 |
| POST | `/points/add` | 添加积分 |
| POST | `/points/consume` | 消费积分 |
| GET | `/points/tasks?userId=xxx` | 获取任务列表 |
| POST | `/points/tasks/complete` | 完成任务 |
| GET | `/points/prizes` | 获取奖品列表 |
| POST | `/points/exchange` | 兑换奖品 |
| GET | `/points/exchanges/:userId` | 获取兑换记录 |

#### 回收点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/recycle/nearby?lat=xxx&lng=xxx` | 获取附近回收点 |
| GET | `/recycle` | 获取所有回收点 |
| GET | `/recycle/:id` | 获取回收点详情 |

#### 资讯
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/news` | 获取资讯列表 |
| GET | `/news/:id` | 获取资讯详情 |
| GET | `/news/admin/list` | 管理员获取资讯列表 |
| GET | `/news/admin/:id` | 管理员获取资讯详情 |
| POST | `/news` | 管理员新增资讯 |
| PUT | `/news/:id` | 管理员更新资讯 |
| DELETE | `/news/:id` | 管理员删除资讯 |

#### 反馈
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/feedback` | 提交反馈（需登录） |
| GET | `/feedback/user/:userId` | 获取我的反馈（需登录） |
| GET | `/feedback/admin/list` | 管理员获取反馈列表 |
| PUT | `/feedback/admin/:id` | 管理员更新处理状态/回复 |

#### 企业端
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/enterprise/register` | 企业注册 |
| POST | `/enterprise/login` | 企业登录 |
| GET | `/enterprise/applications` | 获取企业申请列表（管理） |
| PUT | `/enterprise/:id/verify` | 审核企业申请（管理） |
| GET | `/enterprise/:id` | 获取企业信息 |
| GET | `/enterprise/:id/stats` | 获取统计数据 |
| GET | `/enterprise/:id/records` | 获取核销记录 |
| POST | `/enterprise/verify` | 核销积分 |

> 提示：管理接口支持两种鉴权方式：
> 1) 企业管理员账号登录后的 `Bearer Token`；
> 2) 若配置了 `ADMIN_REVIEW_KEY`，请求可携带 `x-admin-key`（或 `adminKey` 参数）进行校验。

## 数据库表结构

### 核心数据表

| 表名 | 说明 |
|------|------|
| trash_categories | 垃圾分类数据 |
| users | 用户信息 |
| point_records | 积分记录 |
| identify_history | 识别历史 |
| user_tasks | 用户任务完成记录 |
| prizes | 兑换奖品 |
| exchange_records | 兑换记录 |
| user_favorites | 用户收藏 |
| user_feedback | 用户反馈 |
| user_achievements | 用户成就领取记录 |
| recycle_points | 回收点信息 |
| enterprises | 企业信息 |
| verify_records | 核销记录 |
| news | 环保资讯 |

## 部署说明

### 服务器部署

1. 安装 Node.js 和 MySQL
2. 克隆代码到服务器
3. 运行 `npm install`
4. 配置 `.env` 文件
5. 运行 `npm run init-db` 初始化数据库
6. 使用 PM2 启动服务：

```bash
npm install -g pm2
pm2 start app.js --name "trash-sorting-api"
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 微信小程序配置

修改 `smart-trash-sorting/utils/api.js` 中的 API_BASE_URL：

```javascript
const API_BASE_URL = 'https://your-domain.com/api';
```

并在微信小程序后台配置 request 合法域名。

## 开发与维护

### 添加新的API

1. 在 `routes/` 目录下创建路由文件
2. 在 `app.js` 中引入并使用路由
3. 遵循 RESTful API 设计规范

### 数据库迁移

修改数据库结构后，更新 `scripts/initDatabase.js` 中的 SQL 语句，并通知团队成员重新运行初始化脚本。

## 常见问题

### 1. 数据库连接失败
- 检查MySQL服务是否启动
- 检查 `.env` 中的数据库配置
- 确保数据库用户有相应权限

### 2. 跨域问题
- 开发环境已配置 CORS
- 生产环境使用Nginx反向代理

### 3. 微信小程序无法访问
- 检查服务器防火墙设置
- 配置微信小程序 request 合法域名
- 确保使用 HTTPS（生产环境）

## 许可证

MIT License


