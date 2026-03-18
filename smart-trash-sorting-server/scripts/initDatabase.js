const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置（不指定数据库，用于创建数据库）
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

const dbName = process.env.DB_NAME || 'smart_trash_sorting';

// 创建数据库和表的SQL语句
const createDatabaseSQL = `CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const createTablesSQL = [
  // 垃圾分类表
  `CREATE TABLE IF NOT EXISTS trash_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '垃圾名称',
    type ENUM('recyclable', 'hazardous', 'kitchen', 'other') NOT NULL COMMENT '分类类型',
    type_name VARCHAR(50) NOT NULL COMMENT '分类名称',
    tips TEXT COMMENT '投放提示',
    icon VARCHAR(50) DEFAULT '🗑️' COMMENT '图标',
    examples TEXT COMMENT '常见示例，JSON格式',
    description TEXT COMMENT '详细说明',
    search_count INT DEFAULT 0 COMMENT '搜索次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_name_type (name, type),
    INDEX idx_name (name),
    INDEX idx_type (type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='垃圾分类数据库'`,

  // 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
    unionid VARCHAR(100) COMMENT '微信unionid',
    nickname VARCHAR(100) COMMENT '昵称',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    total_points INT DEFAULT 0 COMMENT '总积分',
    check_in_days INT DEFAULT 0 COMMENT '连续打卡天数',
    last_check_date DATE COMMENT '最后打卡日期',
    identify_count INT DEFAULT 0 COMMENT '识别次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表'`,

  // 积分记录表
  `CREATE TABLE IF NOT EXISTS point_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    points INT NOT NULL COMMENT '积分变动值',
    type ENUM('add', 'consume') NOT NULL COMMENT '类型：增加/消费',
    reason VARCHAR(200) NOT NULL COMMENT '变动原因',
    related_id INT COMMENT '关联ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分记录表'`,

  // 识别历史表
  `CREATE TABLE IF NOT EXISTS identify_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    trash_name VARCHAR(100) NOT NULL COMMENT '垃圾名称',
    trash_type ENUM('recyclable', 'hazardous', 'kitchen', 'other') NOT NULL COMMENT '分类类型',
    image_url VARCHAR(500) COMMENT '图片URL',
    confidence INT COMMENT '置信度',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='识别历史表'`,

  // 回收点表
  `CREATE TABLE IF NOT EXISTS recycle_points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL COMMENT '回收点名称',
    type ENUM('smart', 'recyclable', 'hazardous', 'other') NOT NULL COMMENT '类型',
    address VARCHAR(500) NOT NULL COMMENT '地址',
    latitude DECIMAL(10, 8) NOT NULL COMMENT '纬度',
    longitude DECIMAL(11, 8) NOT NULL COMMENT '经度',
    phone VARCHAR(20) COMMENT '联系电话',
    hours VARCHAR(100) COMMENT '营业时间',
    types JSON COMMENT '回收类型，JSON格式',
    prices JSON COMMENT '回收价格，JSON格式',
    enterprise_id INT COMMENT '企业ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recycle_point_name_addr (name, address),
    INDEX idx_location (latitude, longitude),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回收点表'`,

  // 企业表
  `CREATE TABLE IF NOT EXISTS enterprises (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL COMMENT '企业名称',
    type VARCHAR(100) COMMENT '企业类型',
    address VARCHAR(500) COMMENT '地址',
    contact_name VARCHAR(100) COMMENT '联系人',
    phone VARCHAR(20) COMMENT '联系电话',
    license_no VARCHAR(100) COMMENT '营业执照号',
    verify_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending' COMMENT '认证状态',
    username VARCHAR(100) UNIQUE COMMENT '登录账号',
    password VARCHAR(200) COMMENT '登录密码',
    is_admin TINYINT DEFAULT 0 COMMENT '是否管理员',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_verify_status (verify_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业表'`,

  // 核销记录表
  `CREATE TABLE IF NOT EXISTS verify_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    enterprise_id INT NOT NULL COMMENT '企业ID',
    user_id INT NOT NULL COMMENT '用户ID',
    item_name VARCHAR(200) COMMENT '兑换物品',
    points INT NOT NULL COMMENT '核销积分',
    verify_code VARCHAR(100) COMMENT '核销码',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_enterprise_id (enterprise_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='核销记录表'`,

  // 环保资讯表（同时存储分类知识、常见误区、每日小知识等内容）
  `CREATE TABLE IF NOT EXISTS news (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(300) NOT NULL COMMENT '标题',
    summary TEXT COMMENT '摘要',
    content TEXT COMMENT '内容',
    source VARCHAR(100) COMMENT '来源',
    author VARCHAR(100) COMMENT '作者',
    cover_image VARCHAR(500) COMMENT '封面图',
    category VARCHAR(20) NOT NULL DEFAULT 'news' COMMENT '内容类别: news-环保资讯, knowledge-分类知识, mistake-常见误区, daily_tip-每日小知识',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    status TINYINT DEFAULT 1 COMMENT '状态：0下架 1上架',
    published_at TIMESTAMP COMMENT '发布时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_news_title (title),
    INDEX idx_status (status),
    INDEX idx_published_at (published_at),
    INDEX idx_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容管理表（资讯/知识/误区/小知识）'`,

  // 用户任务完成记录表
  `CREATE TABLE IF NOT EXISTS user_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    task_id INT NOT NULL COMMENT '任务ID',
    complete_date DATE COMMENT '完成日期',
    complete_count INT DEFAULT 1 COMMENT '完成次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_task_date (user_id, task_id, complete_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户任务完成记录表'`,

  // 奖品表
  `CREATE TABLE IF NOT EXISTS prizes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL COMMENT '奖品名称',
    description VARCHAR(500) COMMENT '奖品描述',
    icon VARCHAR(50) DEFAULT '🎁' COMMENT '图标',
    points INT NOT NULL COMMENT '所需积分',
    stock INT DEFAULT 0 COMMENT '库存数量',
    type ENUM('virtual', 'physical') DEFAULT 'physical' COMMENT '类型',
    status TINYINT DEFAULT 1 COMMENT '状态：0下架 1上架',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_prize_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='奖品表'`,

  // 兑换记录表
  `CREATE TABLE IF NOT EXISTS exchange_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    prize_id INT NOT NULL COMMENT '奖品ID',
    points INT NOT NULL COMMENT '消耗积分',
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
    address TEXT COMMENT '配送地址',
    phone VARCHAR(20) COMMENT '联系电话',
    remark VARCHAR(500) COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='兑换记录表'`,

  // 用户反馈表
  `CREATE TABLE IF NOT EXISTS user_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT COMMENT '用户ID',
    type ENUM('identify_error', 'classify_error', 'info_error', 'suggestion', 'other') NOT NULL COMMENT '反馈类型',
    content TEXT NOT NULL COMMENT '反馈内容',
    trash_name VARCHAR(100) COMMENT '相关垃圾名称',
    contact VARCHAR(100) COMMENT '联系方式',
    status ENUM('pending', 'processing', 'resolved') DEFAULT 'pending' COMMENT '处理状态',
    reply TEXT COMMENT '回复内容',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户反馈表'`,

  // 用户收藏表
  `CREATE TABLE IF NOT EXISTS user_favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    trash_id INT NOT NULL COMMENT '垃圾分类ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_trash (user_id, trash_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trash_id) REFERENCES trash_categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏表'`,

  // 用户成就领取记录表
  `CREATE TABLE IF NOT EXISTS user_achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    achievement_id INT NOT NULL COMMENT '成就ID（对应constants.js中的ACHIEVEMENTS）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_achievement (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户成就领取记录表'`
];

// 初始化垃圾分类数据（60+条完整数据）
const initTrashDataSQL = `
INSERT INTO trash_categories (name, type, type_name, tips, icon, examples, description) VALUES
-- 可回收物（20种）
('废纸', 'recyclable', '可回收物', '请保持干燥整洁，压平后投放', '📄', '["报纸", "书本", "纸箱", "信封", "打印纸"]', '纸类是可回收物的主要组成部分，包括各种废纸、纸板等。注意被严重污染的纸张应投放其他垃圾'),
('塑料瓶', 'recyclable', '可回收物', '倒空液体，压扁后投放', '🥤', '["矿泉水瓶", "饮料瓶", "洗发水瓶"]', '塑料制品需要清洗干净后投放，压扁可以节省空间'),
('玻璃瓶', 'recyclable', '可回收物', '小心轻放，防止破碎', '🍾', '["酒瓶", "饮料瓶", "酱菜瓶", "调料瓶"]', '玻璃瓶可以无限次回收利用，请勿打碎后投放'),
('易拉罐', 'recyclable', '可回收物', '压扁后投放', '🥫', '["铝罐", "铁罐", "饮料罐"]', '金属罐类压扁后投放，节省空间'),
('旧衣服', 'recyclable', '可回收物', '清洗干净后投放', '👕', '["T恤", "裤子", "裙子", "外套", "毛衣"]', '纺织物类需要保持清洁干燥，建议折叠整齐后投放'),
('快递纸箱', 'recyclable', '可回收物', '拆开折叠后投放，去除胶带', '📦', '["淘宝箱", "快递盒", "鞋盒"]', '快递纸箱是最常见的可回收物之一，请拆开压平后投放'),
('废旧书籍', 'recyclable', '可回收物', '保持干燥，捆扎后投放', '📚', '["课本", "杂志", "漫画书", "字典"]', '书籍纸张可以回收再利用制成再生纸'),
('金属制品', 'recyclable', '可回收物', '清洗干净后投放', '🔧', '["铁钉", "铁丝", "铜线", "铝箔"]', '各类金属制品均可回收，请注意尖锐物品需包裹好'),
('塑料袋', 'recyclable', '可回收物', '清洁干燥后投放', '🛍️', '["购物袋", "包装袋", "保鲜袋"]', '干净的塑料袋可以回收，但被污染的应投放其他垃圾'),
('旧电器', 'recyclable', '可回收物', '完整投放，勿拆解', '📱', '["旧手机", "旧电脑", "旧平板"]', '废旧电子产品含有贵重金属，应完整回收'),
('牛奶盒', 'recyclable', '可回收物', '清洗干净压扁后投放', '🥛', '["利乐包", "果汁盒", "牛奶纸盒"]', '利乐包装需要清洗后投放，否则归为其他垃圾'),
('废旧报纸', 'recyclable', '可回收物', '保持干燥，叠放整齐', '📰', '["日报", "晚报", "周刊"]', '报纸是最容易回收的纸类之一'),
('玻璃杯', 'recyclable', '可回收物', '小心轻放，用纸包好', '🥂', '["水杯", "酒杯", "茶杯"]', '完整未破碎的玻璃器皿可以回收'),
('废铁锅', 'recyclable', '可回收物', '清洗后投放', '🍳', '["铁锅", "不锈钢锅", "铝锅"]', '废旧金属锅具可以回收再利用'),
('塑料玩具', 'recyclable', '可回收物', '去除电池后投放', '🧸', '["积木", "塑料公仔", "模型"]', '纯塑料玩具可回收，含电池的需取出电池'),
('旧鞋子', 'recyclable', '可回收物', '清洗干净，成双投放', '👟', '["运动鞋", "皮鞋", "拖鞋"]', '可穿着的旧鞋建议捐赠，不可穿着的可回收'),
('铝制易拉罐', 'recyclable', '可回收物', '清洗压扁后投放', '🥫', '["啤酒罐", "汽水罐"]', '铝制易拉罐是高价值回收物'),
('旧充电器', 'recyclable', '可回收物', '整理好线缆后投放', '🔌', '["手机充电器", "数据线", "耳机线"]', '电子配件中的金属和塑料均可回收'),
('废旧钥匙', 'recyclable', '可回收物', '可直接投放', '🔑', '["门钥匙", "锁头", "金属挂件"]', '金属钥匙可以回收冶炼再利用'),
('旧雨伞', 'recyclable', '可回收物', '拆分金属和布料分别投放', '☂️', '["折叠伞", "长柄伞"]', '雨伞的金属骨架可回收，伞布视材质而定'),
-- 有害垃圾（15种）
('电池', 'hazardous', '有害垃圾', '防止破损，单独投放', '🔋', '["干电池", "充电电池", "纽扣电池", "蓄电池"]', '电池含有汞、铅、镉等重金属，对土壤和水源污染严重'),
('灯管', 'hazardous', '有害垃圾', '防止破碎，单独投放', '💡', '["日光灯管", "节能灯", "LED灯泡"]', '灯管含有汞等有害物质，破碎后会释放重金属蒸气'),
('药品', 'hazardous', '有害垃圾', '连同包装投放', '💊', '["过期药", "药品包装", "药瓶"]', '过期药品属于有害垃圾，切勿随意丢弃'),
('油漆', 'hazardous', '有害垃圾', '密封后投放', '🎨', '["油漆桶", "涂料", "稀释剂"]', '油漆类化学品含有有害有机溶剂'),
('温度计', 'hazardous', '有害垃圾', '不要打破，轻放投入', '🌡️', '["水银温度计", "水银血压计"]', '温度计含有水银（汞），打破后会造成严重污染'),
('杀虫剂', 'hazardous', '有害垃圾', '连瓶投放，勿挤压', '🧴', '["蚊香液", "杀虫喷雾", "除草剂"]', '农药及杀虫剂含有机磷等有毒物质'),
('指甲油', 'hazardous', '有害垃圾', '连瓶投放', '💅', '["指甲油", "洗甲水", "卸甲液"]', '指甲油含有甲苯、甲醛等有害化学物质'),
('过期化妆品', 'hazardous', '有害垃圾', '连同包装投放', '💄', '["过期口红", "过期面霜", "过期香水"]', '过期化妆品中的化学成分可能产生有害物质'),
('废胶片', 'hazardous', '有害垃圾', '避免折叠，平放投入', '🎞️', '["相机胶片", "X光片"]', '胶片含有银等重金属物质'),
('废墨盒', 'hazardous', '有害垃圾', '不要拆解，整体投放', '🖨️', '["打印墨盒", "硒鼓", "碳粉盒"]', '墨盒中含有有害化学墨水'),
('染发剂', 'hazardous', '有害垃圾', '连瓶投放', '🧪', '["染发膏", "漂白剂"]', '染发剂含有对苯二胺等有害化学物质'),
('消毒液', 'hazardous', '有害垃圾', '密封后投放', '🧹', '["84消毒液", "酒精消毒液"]', '消毒液含有强氧化性物质'),
('老鼠药', 'hazardous', '有害垃圾', '密封后投放，注意安全', '🐀', '["灭鼠药", "蟑螂药"]', '鼠药含有剧毒物质，需特别小心处理'),
('废荧光棒', 'hazardous', '有害垃圾', '不要折断，整体投放', '✨', '["荧光棒", "夜光贴纸"]', '荧光物质含有有害化学成分'),
('过期农药', 'hazardous', '有害垃圾', '密封后投放，注意安全', '☠️', '["除草剂", "杀菌剂"]', '农药对土壤和水源有严重污染'),
-- 厨余垃圾（15种）
('剩菜剩饭', 'kitchen', '厨余垃圾', '沥干水分后投放', '🍲', '["剩饭", "剩菜", "火锅底料"]', '厨余垃圾需要沥干水分，减少异味和渗漏'),
('果皮', 'kitchen', '厨余垃圾', '沥干水分后投放', '🍎', '["苹果皮", "香蕉皮", "橘子皮", "西瓜皮"]', '果皮果核属于厨余垃圾，可以堆肥处理'),
('蛋壳', 'kitchen', '厨余垃圾', '沥干水分后投放', '🥚', '["鸡蛋壳", "鸭蛋壳", "鹌鹑蛋壳"]', '蛋壳富含钙质，可以堆肥处理改良土壤'),
('茶叶渣', 'kitchen', '厨余垃圾', '沥干水分后投放', '🍵', '["茶叶渣", "茶包", "中药渣"]', '茶叶属于有机废弃物，可以堆肥'),
('鱼骨头', 'kitchen', '厨余垃圾', '小心尖刺，沥干投放', '🐟', '["鱼刺", "虾壳", "蟹壳"]', '小型骨头属于厨余垃圾，可以生物降解'),
('玉米棒', 'kitchen', '厨余垃圾', '掰小块后投放', '🌽', '["玉米芯", "玉米叶"]', '玉米棒芯可以堆肥处理'),
('过期食品', 'kitchen', '厨余垃圾', '去除包装后投放', '🍞', '["过期面包", "过期牛奶", "过期零食"]', '过期食品需去除外包装，食品部分投厨余，包装另行分类'),
('菜根菜叶', 'kitchen', '厨余垃圾', '沥干水分后投放', '🥬', '["白菜根", "萝卜叶", "芹菜叶"]', '蔬菜的根茎叶均属于厨余垃圾'),
('瓜子壳', 'kitchen', '厨余垃圾', '直接投放即可', '🌻', '["西瓜子壳", "南瓜子壳", "花生壳"]', '坚果壳类多属于厨余垃圾'),
('豆腐渣', 'kitchen', '厨余垃圾', '沥干水分后投放', '🫘', '["豆渣", "豆浆渣"]', '豆制品废料属于厨余垃圾'),
('面包屑', 'kitchen', '厨余垃圾', '直接投放即可', '🍞', '["蛋糕屑", "饼干屑"]', '面食类废料属于厨余垃圾'),
('动物内脏', 'kitchen', '厨余垃圾', '密封后投放，避免异味', '🥩', '["鸡肝", "猪心", "鱼内脏"]', '动物内脏属于厨余垃圾，需密封防臭'),
('咖啡渣', 'kitchen', '厨余垃圾', '沥干后投放', '☕', '["咖啡粉", "咖啡滤纸"]', '咖啡渣可以堆肥，滤纸也可以一起投放'),
('宠物饲料', 'kitchen', '厨余垃圾', '去除包装后投放', '🐕', '["猫粮", "狗粮", "鱼食"]', '过期或废弃的宠物食品属于厨余垃圾'),
('鲜花', 'kitchen', '厨余垃圾', '去除花盆后投放', '🌹', '["枯萎鲜花", "落叶", "杂草"]', '花卉绿植属于厨余垃圾，但花盆属于其他垃圾'),
-- 其他垃圾（15种）
('纸巾', 'other', '其他垃圾', '污染纸张为其他垃圾', '🧻', '["厕纸", "餐巾纸", "湿巾", "面巾纸"]', '被污染的纸张不可回收，属于其他垃圾'),
('烟蒂', 'other', '其他垃圾', '熄灭后投放', '🚬', '["烟头", "烟灰", "烟盒内锡纸"]', '烟蒂需要熄灭后投放，防止火灾'),
('大骨头', 'other', '其他垃圾', '难以降解，投放其他垃圾', '🦴', '["猪大骨", "牛骨", "羊排骨"]', '大骨头质地坚硬不易腐烂，注意与小鱼骨区分'),
('破碎陶瓷', 'other', '其他垃圾', '用纸包好防划伤', '🏺', '["碎碗", "碎盘", "碎花盆"]', '陶瓷制品不可回收，破碎后需包好防止划伤'),
('尘土', 'other', '其他垃圾', '装袋后投放', '🧹', '["灰尘", "头发", "宠物毛发"]', '清扫产生的灰尘毛发属于其他垃圾'),
('外卖餐盒', 'other', '其他垃圾', '被油污污染的不可回收', '🥡', '["油污餐盒", "一次性筷子", "一次性杯子"]', '被食物污染的餐盒无法回收，清洗干净的可以回收'),
('奶茶杯', 'other', '其他垃圾', '倒掉残余液体后投放', '🧋', '["珍珠奶茶杯", "咖啡杯"]', '被饮品污染的纸杯塑料杯属于其他垃圾'),
('创可贴', 'other', '其他垃圾', '直接投放', '🩹', '["创可贴", "纱布", "棉签"]', '使用过的医疗卫生用品属于其他垃圾'),
('旧毛巾', 'other', '其他垃圾', '严重污损的投其他垃圾', '🧣', '["抹布", "脏毛巾", "百洁布"]', '严重污损的织物无法回收'),
('一次性手套', 'other', '其他垃圾', '直接投放', '🧤', '["乳胶手套", "PE手套"]', '一次性使用的手套属于其他垃圾'),
('口香糖', 'other', '其他垃圾', '用纸包好后投放', '🫧', '["泡泡糖", "口香糖"]', '口香糖粘性强，需用纸包好投放'),
('贝壳', 'other', '其他垃圾', '直接投放', '🐚', '["花蛤壳", "扇贝壳", "蛤蜊壳"]', '贝壳质地坚硬，不易降解，属于其他垃圾'),
('猫砂', 'other', '其他垃圾', '装袋密封后投放', '🐱', '["膨润土猫砂", "豆腐猫砂"]', '使用过的猫砂属于其他垃圾'),
('旧拖把', 'other', '其他垃圾', '折断后投放', '🧹', '["拖把头", "破扫帚"]', '破旧的清洁用具属于其他垃圾'),
('干燥剂', 'other', '其他垃圾', '不要拆开，直接投放', '📦', '["食品干燥剂", "衣柜除湿包"]', '普通干燥剂属于其他垃圾')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化奖品数据
const initPrizeDataSQL = `
INSERT INTO prizes (name, description, icon, points, stock, type) VALUES
('环保购物袋', '可重复使用的环保袋', '🛍️', 50, 1000, 'physical'),
('绿植盆栽', '多肉植物小盆栽', '🪴', 100, 500, 'physical'),
('环保餐具', '便携餐具套装', '🥢', 150, 300, 'physical'),
('分类垃圾桶', '家用四分类垃圾桶', '🗑️', 200, 100, 'physical'),
('环保T恤', '再生纤维环保T恤', '👕', 400, 50, 'physical'),
('10元话费', '手机话费充值', '📱', 500, 9999, 'virtual'),
('20元超市券', '连锁超市代金券', '🎫', 800, 200, 'virtual')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化环保资讯（包含完整内容）
const initNewsDataSQL = `
INSERT INTO news (title, summary, content, source, author, status, published_at) VALUES
('全国垃圾分类工作稳步推进', 
 '住建部数据显示，我国垃圾分类工作取得阶段性进展，297个地级以上城市已全面实施生活垃圾分类。', 
 '住房和城乡建设部最新数据显示，目前全国297个地级以上城市已全面实施生活垃圾分类，居民小区平均覆盖率达到82.5%。其中，上海、北京、广州等46个重点城市居民小区覆盖率达到95%以上。\\n\\n据统计,全国生活垃圾日处理能力超过100万吨,焚烧处理能力占比达到68%。通过垃圾分类,全国生活垃圾回收利用率达到30%以上,有效减少了填埋量和环境污染。\\n\\n专家指出,垃圾分类不仅是环保行为,更是城市精细化管理的重要组成部分。未来将继续推进智能分类设备投放,利用AI技术提高分类准确率。', 
 '中华人民共和国生态环境部', '环保编辑部', 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('上海垃圾分类三周年成效显著', 
 '《上海市生活垃圾管理条例》实施三年来，居民参与率超过95%，湿垃圾日均分出量增长近一倍。', 
 '自2019年7月1日《上海市生活垃圾管理条例》实施以来,上海垃圾分类工作取得了显著成效。\\n\\n数据显示,上海可回收物日均回收量达到7698吨,较分类前增长了1.5倍;湿垃圾日均分出量达到9504吨,较分类前增长了近一倍;干垃圾日均处置量下降到15518吨,较分类前减少了近30%。\\n\\n上海市绿化和市容管理局表示,目前上海已建成生活垃圾分类投放点约6.7万个,其中智能化投放点超过1.2万个。通过持续推进源头分类,上海生活垃圾分类实效已进入全国前列。', 
 '解放日报', '记者 张明', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('塑料污染治理新规出台', 
 '国家发改委发布塑料污染治理行动方案,到2025年塑料污染治理机制运行更加有效。', 
 '国家发展改革委、生态环境部联合印发的《"十四五"塑料污染治理行动方案》提出了明确目标:到2025年,塑料制品生产、流通、消费、回收利用、末端处置全链条治理成效更加显著。\\n\\n方案重点推进以下措施:\\n1. 在商场、超市、药店等场所推广使用环保布袋、纸袋等替代品\\n2. 在餐饮外卖领域推广使用生物基材料替代传统塑料\\n3. 建设塑料废弃物回收网络,提高回收利用效率\\n4. 加大对违规生产销售一次性塑料制品的执法力度\\n\\n业内人士表示,该政策将大力推动可降解塑料行业发展。', 
 '新华社', '新华社记者', 1, DATE_SUB(NOW(), INTERVAL 3 DAY)),
('智能垃圾分类桶亮相多个社区',
 '搭载AI识别技术的智能垃圾桶在全国多个城市社区投入使用,实现自动识别和投放指引。',
 '近日,搭载AI图像识别技术的新型智能垃圾分类桶在北京、上海、深圳等多个城市社区正式投入使用。\\n\\n据了解,该智能垃圾桶内置高清摄像头和AI芯片,居民只需将垃圾放在识别区域,系统即可自动判断垃圾类别,LED屏幕上会显示正确的投放桶位,同时语音播报投放指引。\\n\\n识别准确率方面,该系统已训练超过10万种常见垃圾图片,识别准确率已达到95%以上。同时,居民每次正确投放还可获得相应积分,积分可兑换社区超市优惠券和日用品。\\n\\n项目负责人介绍,首批智能垃圾桶已覆盖500个社区,计划年底前推广至2000个社区。',
 '科技日报', '科技编辑部', 1, DATE_SUB(NOW(), INTERVAL 4 DAY)),
('垃圾分类小知识：哪些垃圾容易分错？',
 '日常生活中常见的分类误区盘点,帮助大家避免分类错误。',
 '在日常垃圾分类中,很多人容易犯以下错误:\\n\\n1. 大骨头是厨余垃圾？\\n错！大骨头（如猪大骨、牛骨）因为质地坚硬、难以粉碎,应投放到其他垃圾桶。而鱼骨、鸡骨等小骨头则属于厨余垃圾。\\n\\n2. 用过的纸巾是可回收物？\\n错！用过的纸巾已被污染,无法再回收利用,应投放到其他垃圾桶。\\n\\n3. 外卖盒一定是其他垃圾？\\n不一定！如果外卖盒清洗干净,没有油污,是可以回收的。但被食物严重污染的就只能投放到其他垃圾了。\\n\\n4. 所有电池都是有害垃圾？\\n不完全正确。普通干电池（如5号、7号碱性电池）已达到无汞标准,属于其他垃圾。但充电电池、纽扣电池等含有重金属,属于有害垃圾。',
 '环保科普', '科普作者', 1, DATE_SUB(NOW(), INTERVAL 5 DAY)),
('2026年全国环保志愿者活动启动',
 '全国千所高校联合发起环保志愿活动,预计超百万大学生参与垃圾分类宣传推广。',
 '由生态环境部指导、中华环保联合会主办的"2026年全国环保志愿者行动"近日在北京正式启动。\\n\\n本次活动以"分类有我,绿色未来"为主题,联合全国1000多所高校的环保社团,组织100万名大学生志愿者走进社区、学校、企业,开展垃圾分类知识宣讲、分类指导和环保创意活动。\\n\\n活动将持续半年,计划覆盖全国500个城市的5000个社区。参与志愿服务的大学生可获得社会实践学分和环保荣誉证书。\\n\\n活动组委会表示,希望通过青年志愿者的力量,带动更多市民参与垃圾分类,营造全社会共同参与的良好氛围。',
 '中国青年报', '记者 李华', 1, DATE_SUB(NOW(), INTERVAL 6 DAY)),
('可降解塑料袋真的环保吗？专家解读',
 '关于可降解塑料的真相——并非所有标注"可降解"的塑料袋都真正环保。',
 '随着限塑令的推进,市场上出现了大量标注"可降解"的塑料袋。但这些产品真的环保吗？\\n\\n中国塑料加工工业协会的专家指出,目前市面上的"可降解"塑料袋主要分为三类：\\n\\n1. 全生物降解塑料：由PLA（聚乳酸）或PBAT等生物基材料制成,在工业堆肥条件下可完全降解为二氧化碳和水。这是真正意义上的可降解产品。\\n\\n2. 氧化降解塑料：在传统塑料中添加促进氧化的添加剂,使其碎裂为微塑料颗粒。这种产品实际上造成了更严重的微塑料污染。\\n\\n3. 淀粉基塑料：将淀粉与传统塑料混合,淀粉部分可降解,但塑料基材仍然残留。\\n\\n专家建议消费者选购时认准"GB/T 38082-2019"国标标识,确保购买到真正的全生物降解产品。',
 '科学时报', '环保专栏', 1, DATE_SUB(NOW(), INTERVAL 7 DAY)),
('日本垃圾分类经验：值得借鉴的细致管理',
 '日本垃圾分类制度已实行40余年,其精细化管理经验值得中国参考借鉴。',
 '日本是世界上垃圾分类做得最细致的国家之一。以东京为例,垃圾被分为"可燃垃圾""不可燃垃圾""资源垃圾""大型垃圾"等多个类别。\\n\\n日本垃圾分类有几个值得借鉴的特点：\\n\\n1. 定时定点投放：不同类型的垃圾有固定的收集日期,错过就要等下一周\\n2. 透明垃圾袋：要求使用透明或半透明垃圾袋,便于确认分类是否正确\\n3. 严格的社区监督：邻里之间互相监督,分类不当会被退回\\n4. 从幼儿园开始的教育：将垃圾分类纳入学校教育体系\\n5. 精细到极致：例如,塑料瓶需要去掉瓶盖和标签后分别投放\\n\\n中国可以借鉴日本的社区管理经验和教育体系,结合我国实际情况推进垃圾分类工作。',
 '参考消息', '国际观察', 1, DATE_SUB(NOW(), INTERVAL 10 DAY))
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化分类知识数据
const initKnowledgeDataSQL = `
INSERT INTO news (title, summary, content, source, author, category, status, published_at) VALUES
('可回收物分类指南',
 '适宜回收利用和资源化利用的生活废弃物，包括废纸、塑料、玻璃、金属、纺织物等。',
 '可回收物是指适宜回收利用和资源化利用的生活废弃物。\\n\\n主要包括：\\n1. 废纸类：报纸、书本、纸箱、信封、打印纸等\\n2. 塑料类：塑料瓶、塑料袋、塑料盒等\\n3. 玻璃类：玻璃瓶、玻璃杯等\\n4. 金属类：易拉罐、铁钉、铜线等\\n5. 纺织物：旧衣服、旧鞋子等\\n\\n投放提示：\\n- 保持清洁干燥\\n- 压扁节省空间\\n- 尖锐物品包好',
 '垃圾分类科普', '系统管理员', 'knowledge', 1, NOW()),
('有害垃圾分类指南',
 '对人体健康或自然环境造成直接或潜在危害的废弃物，需要特殊安全处理。',
 '有害垃圾是指对人体健康或自然环境造成直接或潜在危害的废弃物。\\n\\n主要包括：\\n1. 电池类：充电电池、纽扣电池、蓄电池等\\n2. 灯管类：日光灯管、节能灯等\\n3. 药品类：过期药品、药品包装等\\n4. 化学品：油漆、杀虫剂、消毒液等\\n5. 其他：温度计、指甲油、染发剂等\\n\\n投放提示：\\n- 轻放防破损\\n- 保持完整性\\n- 密封防泄漏',
 '垃圾分类科普', '系统管理员', 'knowledge', 1, NOW()),
('厨余垃圾分类指南',
 '居民日常生活及食品加工、饮食服务等活动中产生的废弃物。',
 '厨余垃圾是指居民日常生活及食品加工、饮食服务等活动中产生的废弃物。\\n\\n主要包括：\\n1. 食物残渣：剩菜剩饭、鱼骨鸡骨等小骨头\\n2. 瓜皮果核：苹果皮、香蕉皮、西瓜皮等\\n3. 花卉绿植：枯萎鲜花、落叶等\\n4. 过期食品：去除包装后的食品部分\\n5. 茶叶渣、咖啡渣、中药渣等\\n\\n投放提示：\\n- 沥干水分\\n- 去除包装\\n- 破袋投放',
 '垃圾分类科普', '系统管理员', 'knowledge', 1, NOW()),
('其他垃圾分类指南',
 '除可回收物、有害垃圾、厨余垃圾之外的其他生活废弃物。',
 '其他垃圾是指除可回收物、有害垃圾、厨余垃圾之外的其他生活废弃物。\\n\\n主要包括：\\n1. 污染纸张：用过的纸巾、湿巾等\\n2. 生活杂物：烟蒂、尘土、毛发等\\n3. 难降解物：大骨头、破碎陶瓷、贝壳等\\n4. 一次性用品：外卖餐盒（油污）、一次性手套等\\n5. 其他：猫砂、干燥剂等\\n\\n投放提示：\\n- 装袋投放\\n- 沥干水分\\n- 防止散落',
 '垃圾分类科普', '系统管理员', 'knowledge', 1, NOW())
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化常见误区数据
const initMistakeDataSQL = `
INSERT INTO news (title, summary, content, source, author, category, status, published_at) VALUES
('大骨头是厨余垃圾？',
 '错误！大骨头质地坚硬不易腐烂，应投入其他垃圾桶。',
 '很多人以为骨头就是厨余垃圾，但其实要区分大小。大骨头（如猪大骨、牛骨、羊排骨）质地坚硬，不易被粉碎处理设备处理，应投入其他垃圾桶。而鱼骨、鸡骨等小骨头则属于厨余垃圾，可以被生物降解。\\n\\n简单判断方法：能轻松掰断的是厨余垃圾，掰不断的是其他垃圾。',
 '垃圾分类科普', '系统管理员', 'mistake', 1, NOW()),
('厕纸是可回收物？',
 '错误！厕纸遇水即溶，不属于可回收纸张。',
 '厕纸、面巾纸等纸巾类产品使用后已经被严重污染，且纸质纤维已经被破坏，无法再回收利用，应投入其他垃圾桶。\\n\\n需要注意的是，未使用的纸巾一般也归为其他垃圾，因为纸巾的纤维结构与可回收废纸不同。\\n\\n可回收的纸张包括：报纸、书本、纸箱、打印纸等保持干燥整洁的纸类。',
 '垃圾分类科普', '系统管理员', 'mistake', 1, NOW()),
('玻璃瓶要打碎再扔？',
 '错误！完整玻璃瓶可以直接回收，打碎后反而可能划伤他人。',
 '玻璃瓶可以无限次回收再利用，完整的玻璃瓶直接投放到可回收物桶即可。打碎后不仅增加了划伤风险，还降低了回收价值。\\n\\n投放时注意：\\n- 轻放避免破碎\\n- 瓶内残余液体倒空\\n- 如果已经破碎，请用厚纸或布包好再投放，并标注"碎玻璃"以防划伤他人。',
 '垃圾分类科普', '系统管理员', 'mistake', 1, NOW()),
('电池都是有害垃圾？',
 '不完全正确！普通干电池已达到无汞或低汞标准，属于其他垃圾。',
 '这是一个常见的误解。实际上：\\n\\n1. 普通干电池（5号、7号碱性电池）——按照国家标准已达到无汞或低汞，属于其他垃圾\\n2. 充电电池（锂电池、镍氢电池）——含有重金属，属于有害垃圾\\n3. 纽扣电池——含有汞等重金属，属于有害垃圾\\n4. 蓄电池（铅酸电池）——含大量铅和硫酸，属于有害垃圾\\n\\n记住：常用的5号7号干电池可以扔其他垃圾，其他电池都要按有害垃圾处理。',
 '垃圾分类科普', '系统管理员', 'mistake', 1, NOW()),
('外卖盒洗干净也不能回收？',
 '错误！清洗干净没有油污的外卖盒是可以回收的。',
 '外卖盒能否回收取决于是否被食物污染：\\n\\n- 被油污严重污染的外卖盒 → 其他垃圾\\n- 清洗干净、没有油污的外卖盒 → 可回收物\\n\\n所以关键在于是否"清洁"。如果你愿意花时间清洗外卖盒，它就是可回收物。\\n\\n同理，其他塑料容器（如酸奶杯、食品盒）也适用这个原则：清洁的可回收，污染的归其他垃圾。',
 '垃圾分类科普', '系统管理员', 'mistake', 1, NOW())
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化每日环保小知识
const initDailyTipDataSQL = `
INSERT INTO news (title, summary, content, source, author, category, status, published_at) VALUES
('塑料瓶降解需要450年',
 '一只塑料瓶需要450年才能完全降解，回收一吨废纸可以少砍17棵大树。',
 '一只塑料瓶需要450年才能完全降解，回收一吨废纸可以少砍17棵大树。让我们一起行动，从垃圾分类做起！',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW()),
('一个易拉罐的旅程',
 '回收一个铝制易拉罐所节省的能量，足够让一台电视运行3小时。',
 '回收一个铝制易拉罐所节省的能量，足够让一台电视运行3小时。铝可以无限次回收利用，且品质不会降低。请将空易拉罐压扁后投入可回收物桶。',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW()),
('食物浪费与碳排放',
 '全球约三分之一的食物被浪费，产生的碳排放占全球总量的8%。',
 '全球约三分之一的食物被浪费，如果把食物浪费看作一个国家，它将是第三大温室气体排放国。正确处理厨余垃圾，减少食物浪费，是每个人都能为地球做的事。',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW()),
('旧衣服的第二次生命',
 '中国每年产生约2600万吨废旧纺织品，但回收利用率不到10%。',
 '中国每年产生约2600万吨废旧纺织品，但回收利用率不到10%。将不再穿着的干净衣物投入可回收物桶或衣物回收箱，它们可以被再生为保温材料、工业擦布等产品。',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW()),
('电池污染有多严重',
 '一节5号电池可以污染1平方米的土壤，一粒纽扣电池可以污染60万升水。',
 '一节废旧5号电池可以使1平方米的土壤永久失去利用价值，一粒纽扣电池可以污染60万升水（相当于一个人一生的饮用水量）。请将废旧电池投入有害垃圾桶，切勿随意丢弃。',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW()),
('垃圾分类改变世界',
 '日本实行垃圾分类40年，垃圾处理量减少了60%以上。',
 '日本从上世纪80年代开始实行垃圾分类，40年间垃圾处理量减少了60%以上。中国的垃圾分类虽然起步较晚，但只要每个人都参与进来，我们也能创造同样的改变！',
 '环保小知识', '系统管理员', 'daily_tip', 1, NOW())
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 初始化回收点数据（多个城市多个点位）
const initRecyclePointSQL = `
INSERT INTO recycle_points (name, type, address, latitude, longitude, phone, hours, types, prices) VALUES
('智能回收站-朝阳公园', 'smart', '朝阳区朝阳公园南路1号', 39.9342, 116.4374, '010-12345678', '24小时开放', '["可回收物", "有害垃圾", "厨余垃圾", "其他垃圾"]', '{"废纸": "1.2元/kg", "塑料瓶": "2.0元/kg", "金属": "3.5元/kg", "玻璃": "0.5元/kg"}'),
('废品回收站-三里屯', 'recyclable', '朝阳区三里屯路19号', 39.9242, 116.4474, '010-87654321', '08:00-20:00', '["废纸", "塑料", "金属", "纺织物"]', '{"废纸": "1.0元/kg", "塑料瓶": "1.8元/kg", "旧衣服": "0.8元/kg"}'),
('有害垃圾回收点-建国路', 'hazardous', '朝阳区建国路88号', 39.9142, 116.4174, '010-11223344', '09:00-17:00', '["电池", "灯管", "药品", "油漆"]', '{"电池": "回收不收费"}'),
('智能回收柜-望京', 'smart', '朝阳区望京西园三区', 40.0042, 116.4774, '010-55667788', '24小时开放', '["可回收物", "有害垃圾"]', '{"废纸": "1.3元/kg", "塑料瓶": "2.2元/kg", "易拉罐": "6.0元/kg"}'),
('社区回收站-国贸', 'recyclable', '朝阳区光华路SOHO', 39.9082, 116.4604, '010-99887766', '07:00-21:00', '["废纸", "塑料", "金属", "玻璃"]', '{"废纸": "1.1元/kg", "塑料瓶": "1.9元/kg"}'),
('环保回收驿站-海淀', 'smart', '海淀区中关村大街52号', 39.9842, 116.3174, '010-33445566', '08:00-22:00', '["可回收物", "有害垃圾", "厨余垃圾"]', '{"废纸": "1.2元/kg", "塑料瓶": "2.1元/kg", "金属": "3.8元/kg"}'),
('大件垃圾回收站-丰台', 'other', '丰台区丰台东路10号', 39.8642, 116.2874, '010-22334455', '09:00-18:00', '["大件家具", "旧家电", "建筑垃圾"]', '{"旧家电": "上门回收", "旧家具": "上门回收"}'),
('智能回收箱-通州', 'smart', '通州区新华大街38号', 39.9042, 116.6574, '010-66778899', '24小时开放', '["可回收物", "有害垃圾"]', '{"废纸": "1.0元/kg", "塑料瓶": "1.8元/kg"}')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;

// 企业数据在initDatabase函数中使用bcrypt动态生成密码哈希

async function initDatabase() {
  let connection;
  try {
    // 创建连接
    connection = await mysql.createConnection(config);
    console.log('✅ 连接到MySQL服务器成功');

    // 创建数据库 (使用query而非execute)
    await connection.query(createDatabaseSQL);
    console.log(`✅ 数据库 "${dbName}" 创建成功或已存在`);

    // 使用数据库 (使用query而非execute，因为USE不支持预处理语句)
    await connection.query(`USE \`${dbName}\``);
    console.log(`✅ 切换到数据库 "${dbName}"`);

    // 创建表
    for (const sql of createTablesSQL) {
      await connection.execute(sql);
    }
    console.log('✅ 所有数据表创建成功');

    // 初始化数据
    try {
      await connection.execute(initTrashDataSQL);
      console.log('✅ 垃圾分类数据初始化成功');
    } catch (e) {
      console.log('⚠️ 垃圾分类数据已存在或初始化失败:', e.message);
    }

    try {
      await connection.execute(initPrizeDataSQL);
      console.log('✅ 奖品数据初始化成功');
    } catch (e) {
      console.log('⚠️ 奖品数据已存在或初始化失败:', e.message);
    }

    try {
      await connection.execute(initNewsDataSQL);
      console.log('✅ 资讯数据初始化成功');
    } catch (e) {
      console.log('⚠️ 资讯数据已存在或初始化失败:', e.message);
    }

    // 为已有news表添加category字段（如果不存在）
    try {
      const [cols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'news' AND COLUMN_NAME = 'category'`,
        [dbName]
      );
      if (cols.length === 0) {
        await connection.query(
          `ALTER TABLE news ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'news' COMMENT '内容类别: news-环保资讯, knowledge-分类知识, mistake-常见误区, daily_tip-每日小知识' AFTER cover_image`
        );
        await connection.query(`ALTER TABLE news ADD INDEX idx_category (category)`);
        console.log('✅ news表已添加category字段');
      }
    } catch (e) {
      console.log('⚠️ 检查/添加category字段时:', e.message);
    }

    try {
      await connection.execute(initKnowledgeDataSQL);
      console.log('✅ 分类知识数据初始化成功');
    } catch (e) {
      console.log('⚠️ 分类知识数据已存在或初始化失败:', e.message);
    }

    try {
      await connection.execute(initMistakeDataSQL);
      console.log('✅ 常见误区数据初始化成功');
    } catch (e) {
      console.log('⚠️ 常见误区数据已存在或初始化失败:', e.message);
    }

    try {
      await connection.execute(initDailyTipDataSQL);
      console.log('✅ 每日环保小知识数据初始化成功');
    } catch (e) {
      console.log('⚠️ 每日环保小知识数据已存在或初始化失败:', e.message);
    }

    try {
      await connection.execute(initRecyclePointSQL);
      console.log('✅ 回收点数据初始化成功');
    } catch (e) {
      console.log('⚠️ 回收点数据已存在或初始化失败:', e.message);
    }

    // 初始化企业数据（需要先bcrypt加密密码）
    try {
      // 使用bcryptjs生成密码哈希
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('123456', 10);
      const enterpriseSQL = `
        INSERT INTO enterprises (name, type, address, contact_name, phone, license_no, username, password, verify_status, is_admin) VALUES
        ('绿色环保回收有限公司', '回收企业', '朝阳区朝阳公园南路1号', '张经理', '13800138000', 'BJ20230001', 'admin', '${hashedPassword}', 'verified'),
        ('城市智慧回收科技公司', '科技企业', '海淀区中关村大街52号', '李经理', '13900139000', 'BJ20230002', 'test', '${hashedPassword}', 'verified')
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;
      await connection.execute(enterpriseSQL);
      console.log('✅ 企业数据初始化成功 (账号: admin/test, 密码: 123456)');
    } catch (e) {
      console.log('⚠️ 企业数据已存在或初始化失败:', e.message);
    }

    console.log('\n🎉 数据库初始化完成！');
    console.log(`📌 数据库名称: ${dbName}`);
    console.log(`📌 表数量: ${createTablesSQL.length} 个`);

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('\n请检查:');
    console.error('1. MySQL服务是否启动');
    console.error('2. 数据库配置是否正确 (.env 文件)');
    console.error('3. 用户是否有创建数据库的权限');
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

initDatabase();

