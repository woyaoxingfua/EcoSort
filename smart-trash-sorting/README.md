<p align="center">
  <img src="https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=flat-square&logo=wechat&logoColor=white" />
  <img src="https://img.shields.io/badge/Framework-Native-07C160?style=flat-square" />
  <img src="https://img.shields.io/badge/UI-WeUI-07C160?style=flat-square" />
</p>

# EcoSort 小程序

> 微信小程序前端

## ✨ 功能模块

```
┌──────────────────────────────────────────────────┐
│                    🏠 首页                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │📷 拍照 │ │🔍 搜索 │ │🎤 语音 │ │📚 科普 │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
├──────────────────────────────────────────────────┤
│  🔍 识别  │  🗺️ 导航  │  🎁 积分  │  👤 我的   │
└──────────────────────────────────────────────────┘
```

| 模块 | 功能 |
|:---:|:---|
| **识别** | AI 拍照识别 · 文字搜索 · 语音查询 |
| **导航** | 附近回收点 · 路线规划 · 价格参考 |
| **积分** | 每日打卡 · 任务系统 · 积分兑换 |
| **科普** | 分类知识 · 常见误区 · 环保资讯 |
| **企业** | 企业入驻 · 积分核销 · 数据统计 |

## 📁 项目结构

```
smart-trash-sorting/
├── pages/
│   ├── index/              # 🏠 首页
│   ├── identify/           # 🔍 识别入口
│   ├── scan/               # 📷 拍照识别
│   ├── search/             # 🔎 文字搜索
│   ├── voicerecord/        # 🎤 语音查询
│   ├── navigation/         # 🗺️ 回收点导航
│   ├── points/             # 🎁 积分中心
│   ├── exchange/           # 🛒 积分兑换
│   ├── ranking/            # 🏆 排行榜
│   ├── science/            # 📚 科普知识
│   ├── enterprise/         # 🏢 企业登录
│   ├── adminEnterprise/    # ⚙️ 企业管理
│   └── profile/            # 👤 个人中心
├── utils/
│   ├── api.js              # 🔌 API 封装
│   └── util.js             # 🛠️ 工具函数
├── static/
│   └── images/             # 🖼️ 图片资源
├── app.js                  # 📱 应用入口
├── app.json                # ⚙️ 全局配置
├── app.wxss                # 🎨 全局样式
└── project.config.json     # 📋 项目配置
```

## 🛠️ 技术栈

| 技术 | 说明 |
|:---:|:---|
| **框架** | 微信小程序原生框架 |
| **UI** | WeUI 组件库 |
| **地图** | 微信小程序 Map 组件 |
| **相机** | wx.camera API |
| **录音** | wx.getRecorderManager |

## 🚀 快速开始

### 1. 导入项目

1. 打开 **微信开发者工具**
2. 选择「导入项目」
3. 选择 `smart-trash-sorting` 目录
4. 填写 AppID（测试号也可）

### 2. 开发设置

在「详情」→「本地设置」中勾选：

- [x] 不校验合法域名
- [x] 不校验 HTTPS 证书

### 3. 配置后端地址

编辑 `utils/api.js`：

```javascript
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';
```

### 4. 真机调试

真机调试时需配置电脑局域网 IP：

```javascript
// 开发者工具控制台执行
wx.setStorageSync('apiBaseUrl', 'http://192.168.x.x:3000/api')

// 恢复默认
wx.removeStorageSync('apiBaseUrl')
```

## 📱 页面说明

| 页面 | 路径 | 说明 |
|:---|:---|:---|
| 首页 | `/pages/index/index` | 快捷入口、热门搜索、环保资讯 |
| 识别 | `/pages/identify/identify` | 选择识别方式 |
| 拍照 | `/pages/scan/scan` | AI 图像识别 |
| 搜索 | `/pages/search/search` | 关键词模糊搜索 |
| 语音 | `/pages/voicerecord/voicerecord` | 语音转文字查询 |
| 导航 | `/pages/navigation/navigation` | 地图展示回收点 |
| 积分 | `/pages/points/points` | 积分中心、任务列表 |
| 兑换 | `/pages/exchange/exchange` | 积分商城 |
| 排行 | `/pages/ranking/ranking` | 积分排行榜 |
| 科普 | `/pages/science/science` | 分类知识百科 |
| 企业 | `/pages/enterprise/enterprise` | 企业端入口 |
| 我的 | `/pages/profile/profile` | 个人中心 |

## 🎮 积分规则

### 获取方式

| 行为 | 积分 | 说明 |
|:---|:---:|:---|
| 每日打卡 | +10 | 每日首次签到 |
| 拍照识别 | +5 | 每次识别成功 |
| 文字搜索 | +2 | 每次搜索 |
| 语音查询 | +3 | 每次语音识别 |
| 查看科普 | +2 | 阅读科普文章 |
| 完成任务 | +5~20 | 根据任务难度 |

### 兑换商品

| 商品 | 积分 |
|:---|:---:|
| 环保购物袋 | 50 |
| 绿植盆栽 | 100 |
| 环保餐具套装 | 150 |
| 分类垃圾桶 | 200 |
| 10元话费 | 500 |

## ⚠️ 注意事项

1. **后端服务** — 确保 Node.js 后端已启动
2. **网络配置** — 开发环境需关闭域名校验
3. **权限申请** — 拍照、录音需用户授权
4. **定位授权** — 导航功能需要位置权限

## 📦 发布上线

1. 在 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序账号
2. 在「开发管理」→「服务器域名」配置 request 合法域名
3. 在微信开发者工具点击「上传」
4. 在公众平台「版本管理」提交审核
5. 审核通过后发布上线

## 📄 License

MIT
