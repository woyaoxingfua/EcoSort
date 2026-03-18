# 智能垃圾分类系统 - 课程设计

基于微信小程序 + Node.js + MySQL 的全栈项目。

## 项目架构

```
KESHE/
├── smart-trash-sorting/           # 微信小程序前端
│   ├── pages/                    # 页面目录
│   ├── utils/api.js             # API接口封装
│   ├── app.js                   # 应用入口
│   └── ...
│
└── smart-trash-sorting-server/    # Node.js后端服务
    ├── config/database.js       # 数据库配置
    ├── routes/                  # API路由
    ├── scripts/initDatabase.js  # 数据库初始化
    └── ...
```

## 技术栈

### 前端
- 微信小程序原生框架
- WeUI 组件库
- 微信小程序 Map API
- 微信小程序录音 API

### 后端
- Node.js 16+
- Express 4.x
- MySQL 5.7+
- mysql2

## 功能模块

### 📷 识别模块
- AI图像识别（模拟）
- 文字搜索（连接MySQL数据库）
- 语音查询

### 🗺️ 导航模块
- 附近回收点定位
- 路线规划
- 回收价格查询

### 🎁 积分模块
- 分类打卡
- 积分兑换
- 环保任务

### 📚 科普模块
- 垃圾分类知识（数据库驱动）
- 常见误区
- 环保资讯（数据库驱动）

### 🏢 企业端
- 回收点入驻
- 积分核销
- 数据统计

## 快速开始

### 1. 启动后端服务

```bash
cd smart-trash-sorting-server

# 安装依赖
npm install

# 配置数据库（修改 .env 文件）
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password

# 初始化数据库
npm run init-db

# 启动服务
npm run dev
```

后端服务将运行在 `http://localhost:3000`

### 2. 导入微信小程序

1. 打开微信开发者工具
2. 选择「导入项目」
3. 选择 `smart-trash-sorting` 目录
4. 填写AppID（测试号也可）
5. 点击「导入」

### 3. 配置小程序API地址

修改 `smart-trash-sorting/utils/api.js`：

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

**注意**：在微信开发者工具中，需要在「详情」-「本地设置」中勾选「不校验合法域名」

## 数据库设计

核心数据表：

| 表名 | 说明 |
|------|------|
| trash_categories | 垃圾分类数据（100+条记录） |
| users | 用户表 |
| point_records | 积分变动记录 |
| identify_history | AI识别历史 |
| recycle_points | 回收点信息 |
| enterprises | 企业信息 |
| news | 环保资讯 |
| tasks | 积分任务 |
| prizes | 兑换奖品 |

详细表结构见 `smart-trash-sorting-server/scripts/initDatabase.js`

## API接口

完整的RESTful API设计，包含以下模块：

- **垃圾分类** `/api/trash/*`
- **用户管理** `/api/user/*`
- **积分系统** `/api/points/*`
- **回收点** `/api/recycle/*`
- **资讯管理** `/api/news/*`
- **企业端** `/api/enterprise/*`

详细API文档见 `smart-trash-sorting-server/README.md`

## 课程设计亮点

1. **全栈开发**：微信小程序前端 + Node.js后端 + MySQL数据库
2. **RESTful API**：规范的接口设计，支持CRUD操作
3. **数据库设计**：合理的表结构设计，支持事务处理
4. **数据持久化**：所有数据存储在MySQL中，非本地存储
5. **企业级架构**：MVC分层，代码结构清晰

## 演示流程

1. **环境准备**：启动MySQL，运行后端服务
2. **用户登录**：微信授权登录，数据存入数据库
3. **垃圾分类搜索**：实时查询MySQL数据库
4. **积分系统**：完成任务，积分实时更新到数据库
5. **回收点导航**：从数据库获取回收点数据
6. **企业端**：数据统计从数据库实时计算

## 部署说明

### 后端部署

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start app.js --name "trash-api"

# 查看日志
pm2 logs trash-api
```

### 小程序部署

1. 在微信公众平台注册小程序
2. 配置服务器域名（request合法域名）
3. 上传代码并提交审核

## 开发注意事项

1. **开发环境**：需要同时运行后端服务和微信开发者工具
2. **数据库**：确保MySQL服务正常启动
3. **网络**：小程序需要配置服务器域名或使用开发者工具的不校验域名选项
4. **跨域**：后端已配置CORS，支持跨域访问

## 目录说明

```
smart-trash-sorting/           # 小程序前端
├── pages/                    # 页面文件
│   ├── index/               # 首页
│   ├── search/              # 搜索页（连接数据库）
│   ├── scan/                # 拍照识别页
│   ├── navigation/          # 地图导航页
│   ├── points/              # 积分中心（连接数据库）
│   ├── science/             # 科普页（连接数据库）
│   ├── enterprise/          # 企业端
│   └── profile/             # 个人中心
├── utils/                   # 工具函数
│   └── api.js              # API接口封装
└── app.js                   # 应用入口

smart-trash-sorting-server/    # 后端服务
├── config/                  # 配置文件
│   └── database.js         # MySQL连接配置
├── routes/                  # API路由
│   ├── trash.js            # 垃圾分类API
│   ├── user.js             # 用户API
│   ├── points.js           # 积分API
│   ├── recycle.js          # 回收点API
│   ├── news.js             # 资讯API
│   └── enterprise.js       # 企业端API
├── scripts/                 # 脚本
│   └── initDatabase.js     # 数据库初始化
├── app.js                  # 服务入口
└── .env                    # 环境变量配置
```

## 许可证

MIT License

---

**课程设计项目** - 智能垃圾分类系统
