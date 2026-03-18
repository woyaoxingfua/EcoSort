<p align="center">
  <img src="https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-5.7+-4479A1?style=for-the-badge&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

<h1 align="center">EcoSort</h1>

<p align="center">
  <b>智能垃圾分类助手</b><br>
  <sub>AI 图像识别 · 语音查询 · 回收点导航 · 积分激励</sub>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-api-文档">API 文档</a> •
  <a href="#-部署指南">部署指南</a>
</p>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🔍 智能识别
- **AI 图像识别** - 拍照即知分类
- **语音查询** - 说出名称快速识别
- **模糊搜索** - 支持关键词联想

</td>
<td width="50%">

### 🗺️ 便捷导航
- **附近回收点** - 地图可视化展示
- **一键导航** - 快速前往回收站
- **价格参考** - 废品回收行情

</td>
</tr>
<tr>
<td width="50%">

### 🎮 积分激励
- **每日打卡** - 培养环保习惯
- **任务系统** - 完成任务赚积分
- **积分商城** - 兑换环保好礼

</td>
<td width="50%">

### 🏢 企业服务
- **回收点入驻** - 企业申请入驻平台
- **积分核销** - 扫码核销用户积分
- **数据看板** - 经营数据实时统计

</td>
</tr>
</table>

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      WeChat MiniProgram                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  首页   │  │  识别   │  │  导航   │  │  积分   │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │ HTTPS
┌──────────────────────────┴──────────────────────────────────┐
│                     Node.js + Express                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 用户服务 │  │ 分类服务 │  │ 积分服务 │  │ AI 服务  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                         MySQL 5.7+                           │
│    users │ trash_categories │ points │ enterprises │ ...    │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 技术栈 | 说明 |
|:---:|:---:|:---|
| **前端** | 微信小程序 | 原生框架 + WeUI 组件库 |
| **后端** | Node.js 18+ | Express 4.x + RESTful API |
| **数据库** | MySQL 5.7+ | 关系型数据存储 |
| **AI** | SiliconFlow | Qwen2.5-VL 视觉模型 |

## 📁 项目结构

```
EcoSort/
├── smart-trash-sorting/           # 📱 小程序前端
│   ├── pages/                     #    页面组件
│   │   ├── index/                 #    首页
│   │   ├── scan/                  #    拍照识别
│   │   ├── search/                #    文字搜索
│   │   ├── voicerecord/           #    语音查询
│   │   ├── navigation/            #    回收点导航
│   │   ├── points/                #    积分中心
│   │   └── enterprise/            #    企业端
│   ├── utils/api.js               #    API 封装
│   └── static/                    #    静态资源
│
└── smart-trash-sorting-server/    # ⚙️ Node.js 后端
    ├── routes/                    #    API 路由
    ├── services/                  #    业务逻辑
    ├── config/                    #    配置文件
    └── scripts/                   #    数据库脚本
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+
- 微信开发者工具

### 1️⃣ 启动后端服务

```bash
# 进入后端目录
cd smart-trash-sorting-server

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库配置

# 初始化数据库
npm run init-db

# 启动服务
npm run dev
```

> 服务默认运行在 `http://localhost:3000`

### 2️⃣ 导入小程序

1. 打开 **微信开发者工具**
2. 选择「导入项目」→ 选择 `smart-trash-sorting` 目录
3. 填写 AppID（测试号也可）
4. 在「本地设置」勾选「不校验合法域名」

### 3️⃣ 开始使用

打开小程序，体验智能垃圾分类！

## 📖 API 文档

<details>
<summary><b>垃圾分类</b> <code>/api/trash</code></summary>

| 方法 | 路径 | 说明 |
|:---:|:---|:---|
| `GET` | `/search?keyword=xxx` | 搜索垃圾分类 |
| `GET` | `/categories` | 获取四大分类 |
| `GET` | `/type/:type` | 按类型筛选 |
| `GET` | `/hot` | 热门搜索 |
| `POST` | `/identify` | AI 图像识别 |

</details>

<details>
<summary><b>用户管理</b> <code>/api/user</code></summary>

| 方法 | 路径 | 说明 |
|:---:|:---|:---|
| `POST` | `/login` | 微信登录 |
| `GET` | `/:id` | 获取用户信息 |
| `PUT` | `/:id` | 更新用户信息 |
| `POST` | `/:id/checkin` | 每日打卡 |
| `GET` | `/:id/history` | 识别历史 |

</details>

<details>
<summary><b>积分系统</b> <code>/api/points</code></summary>

| 方法 | 路径 | 说明 |
|:---:|:---|:---|
| `GET` | `/records/:userId` | 积分记录 |
| `GET` | `/tasks` | 任务列表 |
| `POST` | `/tasks/complete` | 完成任务 |
| `GET` | `/prizes` | 奖品列表 |
| `POST` | `/exchange` | 兑换奖品 |

</details>

<details>
<summary><b>回收点</b> <code>/api/recycle</code></summary>

| 方法 | 路径 | 说明 |
|:---:|:---|:---|
| `GET` | `/nearby` | 附近回收点 |
| `GET` | `/` | 所有回收点 |
| `GET` | `/:id` | 回收点详情 |

</details>

<details>
<summary><b>企业端</b> <code>/api/enterprise</code></summary>

| 方法 | 路径 | 说明 |
|:---:|:---|:---|
| `POST` | `/register` | 企业注册 |
| `POST` | `/login` | 企业登录 |
| `GET` | `/:id/stats` | 数据统计 |
| `POST` | `/verify` | 积分核销 |

</details>

> 完整 API 文档见 [smart-trash-sorting-server/README.md](./smart-trash-sorting-server/README.md)

## 🗃️ 数据库设计

| 表名 | 说明 | 核心字段 |
|:---|:---|:---|
| `users` | 用户信息 | openid, nickname, points |
| `trash_categories` | 垃圾分类 | name, type, tips |
| `point_records` | 积分记录 | user_id, points, reason |
| `identify_history` | 识别历史 | user_id, image_url, result |
| `recycle_points` | 回收点 | name, lat, lng, type |
| `enterprises` | 企业信息 | name, contact, status |
| `prizes` | 兑换奖品 | name, points, stock |

## 📦 部署指南

### 后端部署

```bash
# 使用 PM2 守护进程
npm install -g pm2
pm2 start app.js --name ecosort-api

# 查看日志
pm2 logs ecosort-api
```

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 小程序发布

1. 微信公众平台注册小程序账号
2. 配置服务器域名（request 合法域名）
3. 微信开发者工具上传代码
4. 提交审核 → 发布上线

## 🎯 项目亮点

- **全栈架构** — 小程序 + Node.js + MySQL 完整技术栈
- **AI 赋能** — 集成视觉大模型，拍照即知分类
- **游戏化设计** — 积分任务体系，提升用户参与度
- **B端支持** — 企业入驻、积分核销、数据统计
- **代码规范** — RESTful API、MVC 分层、模块化设计

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源
