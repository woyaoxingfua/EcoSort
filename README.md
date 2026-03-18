# EcoSort - 智能垃圾分类系统

一款基于微信小程序的智能垃圾分类助手，集成 AI 图像识别、语音查询、回收点导航和积分激励系统。

## 项目预览

| 首页 | 识别 | 导航 | 积分 |
|:---:|:---:|:---:|:---:|
| 快捷入口 | AI拍照/语音/文字 | 附近回收点 | 任务与兑换 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序原生框架、WeUI |
| 后端 | Node.js 16+、Express 4.x |
| 数据库 | MySQL 5.7+ |
| AI服务 | SiliconFlow (Qwen2.5-VL) |

## 项目结构

```
EcoSort/
├── smart-trash-sorting/          # 微信小程序前端
│   ├── pages/                    # 页面
│   ├── utils/                    # 工具函数
│   ├── static/                   # 静态资源
│   └── app.js                    # 入口文件
│
└── smart-trash-sorting-server/   # Node.js 后端
    ├── routes/                   # API 路由
    ├── services/                 # 业务服务
    ├── config/                   # 配置文件
    └── scripts/                  # 数据库脚本
```

## 功能模块

### 识别模块
- **AI 图像识别** - 拍照自动识别垃圾类别
- **文字搜索** - 输入名称模糊匹配
- **语音查询** - 语音转文字快速查询

### 导航模块
- **回收点地图** - 显示附近回收站点
- **路线规划** - 一键导航前往
- **价格查询** - 废品回收参考价

### 积分模块
- **每日打卡** - 签到得积分
- **任务系统** - 完成任务赚积分
- **积分兑换** - 兑换环保商品

### 科普模块
- **分类知识** - 四类垃圾详解
- **常见误区** - 易错分类纠正
- **环保资讯** - 最新环保动态

### 企业端
- **回收点入驻** - 企业申请入驻
- **积分核销** - 扫码核销用户积分
- **数据统计** - 经营数据报表

## 快速开始

### 1. 启动后端

```bash
cd smart-trash-sorting-server
npm install
cp .env.example .env  # 修改数据库配置
npm run init-db       # 初始化数据库
npm run dev           # 启动服务 http://localhost:3000
```

### 2. 导入小程序

1. 打开 **微信开发者工具**
2. 导入 `smart-trash-sorting` 目录
3. 填写 AppID（可用测试号）
4. 在「本地设置」勾选「不校验合法域名」

### 3. 配置 API 地址

修改 `smart-trash-sorting/utils/api.js`：

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

## 数据库设计

| 表名 | 说明 |
|------|------|
| `users` | 用户信息 |
| `trash_categories` | 垃圾分类数据 (100+ 条) |
| `point_records` | 积分变动记录 |
| `identify_history` | AI 识别历史 |
| `recycle_points` | 回收点信息 |
| `enterprises` | 企业信息 |
| `news` | 环保资讯 |
| `prizes` | 兑换奖品 |

## API 概览

| 模块 | 路径 | 说明 |
|------|------|------|
| 垃圾分类 | `/api/trash/*` | 搜索、识别、分类查询 |
| 用户 | `/api/user/*` | 登录、打卡、历史记录 |
| 积分 | `/api/points/*` | 积分、任务、兑换 |
| 回收点 | `/api/recycle/*` | 附近回收点、详情 |
| 资讯 | `/api/news/*` | 环保资讯列表 |
| 企业 | `/api/enterprise/*` | 企业入驻、核销 |

详细文档见 [后端 README](./smart-trash-sorting-server/README.md)

## 部署

### 后端部署

```bash
npm install -g pm2
pm2 start app.js --name "ecosort-api"
```

### Nginx 反向代理

```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
}
```

### 小程序发布

1. 微信公众平台注册小程序
2. 配置服务器域名（request 合法域名）
3. 上传代码并提交审核

## 项目亮点

- **全栈架构** - 小程序 + Node.js + MySQL 完整链路
- **RESTful API** - 规范接口设计，支持 CRUD
- **AI 集成** - 对接 SiliconFlow 视觉模型
- **MVC 分层** - 清晰的代码组织结构
- **积分体系** - 游戏化设计提升用户粘性

## 许可证

MIT License
