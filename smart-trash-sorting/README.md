# EcoSort 小程序 - 前端

基于微信小程序原生框架开发的智能垃圾分类助手。

## 功能模块

### 识别模块
- **AI 拍照识别** - 拍照自动识别垃圾类别
- **文字搜索** - 输入名称模糊匹配
- **语音查询** - 语音转文字快速查询

### 导航模块
- **回收点地图** - 显示附近回收站点
- **路线规划** - 调用微信导航
- **价格查询** - 废品回收参考价

### 积分模块
- **每日打卡** - 签到获取积分
- **任务系统** - 完成任务赚积分
- **积分兑换** - 兑换环保商品

### 科普模块
- **分类知识** - 四类垃圾详解
- **常见误区** - 易错分类纠正
- **环保资讯** - 最新环保动态

### 企业端
- **回收点入驻** - 企业申请入驻
- **积分核销** - 扫码核销积分
- **数据统计** - 经营数据报表

## 项目结构

```
smart-trash-sorting/
├── pages/
│   ├── index/              # 首页
│   ├── identify/           # 识别主页
│   ├── scan/               # 拍照识别
│   ├── search/             # 文字搜索
│   ├── voicerecord/        # 语音查询
│   ├── navigation/         # 回收点导航
│   ├── points/             # 积分中心
│   ├── exchange/           # 积分兑换
│   ├── ranking/            # 积分排行
│   ├── science/            # 科普知识
│   ├── enterprise/         # 企业端
│   ├── adminEnterprise/    # 企业管理
│   └── profile/            # 个人中心
├── utils/
│   ├── api.js              # API 封装
│   └── util.js             # 工具函数
├── static/
│   └── images/             # 图片资源
├── app.js                  # 应用入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式
└── project.config.json     # 项目配置
```

## 技术栈

- **框架**: 微信小程序原生框架
- **UI**: WeUI 组件库
- **地图**: 微信小程序 Map 组件
- **语音**: 微信小程序录音 API
- **相机**: 微信小程序 Camera API

## 快速开始

### 1. 导入项目

1. 打开 **微信开发者工具**
2. 选择「导入项目」
3. 选择 `smart-trash-sorting` 目录
4. 填写 AppID（可用测试号）
5. 点击「导入」

### 2. 配置后端地址

编辑 `utils/api.js`：

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### 3. 开发设置

在开发者工具「详情」-「本地设置」中：
- 勾选「不校验合法域名」
- 勾选「不校验 HTTPS 证书」

### 4. 真机调试

真机调试时，需要将 API 地址改为电脑局域网 IP：

```javascript
// 在控制台执行
wx.setStorageSync('apiBaseUrl', 'http://192.168.1.100:3000/api')
```

恢复默认：
```javascript
wx.removeStorageSync('apiBaseUrl')
```

## 页面说明

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/pages/index/index` | 快捷入口、热门搜索 |
| 识别 | `/pages/identify/identify` | 识别方式选择 |
| 拍照 | `/pages/scan/scan` | AI 图像识别 |
| 搜索 | `/pages/search/search` | 文字搜索 |
| 语音 | `/pages/voicerecord/voicerecord` | 语音查询 |
| 导航 | `/pages/navigation/navigation` | 回收点地图 |
| 积分 | `/pages/points/points` | 积分中心 |
| 兑换 | `/pages/exchange/exchange` | 积分兑换 |
| 排行 | `/pages/ranking/ranking` | 积分排行榜 |
| 科普 | `/pages/science/science` | 分类知识 |
| 企业 | `/pages/enterprise/enterprise` | 企业登录 |
| 个人 | `/pages/profile/profile` | 个人中心 |

## 积分规则

### 获取方式

| 行为 | 积分 |
|------|------|
| 每日打卡 | +10 |
| 拍照识别 | +5 |
| 文字搜索 | +2 |
| 语音查询 | +3 |
| 查看科普 | +2 |
| 完成任务 | +5~20 |

### 兑换商品

| 商品 | 积分 |
|------|------|
| 环保购物袋 | 50 |
| 绿植盆栽 | 100 |
| 环保餐具 | 150 |
| 分类垃圾桶 | 200 |
| 10元话费 | 500 |

## 注意事项

1. **后端服务** - 确保后端服务已启动
2. **网络配置** - 开发时需关闭域名校验
3. **权限申请** - 拍照、录音需用户授权
4. **定位权限** - 导航功能需要位置授权

## 发布上线

1. 在微信公众平台注册小程序
2. 配置服务器域名（request 合法域名）
3. 在开发者工具中上传代码
4. 提交审核并发布

## 许可证

MIT License
