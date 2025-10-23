const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// 端口配置说明
console.log('🌈 多巴胺日历应用启动中...');
console.log(`📡 服务器将在端口 ${PORT} 启动`);
console.log('💡 端口配置说明:');
console.log('   - 默认端口: 3000');
console.log('   - 自定义端口: PORT=端口号 node server.js');
console.log('   - 或使用: PORT=端口号 npm start');
console.log('   - 预设端口: npm run start:3001 或 npm run start:8080');

// 设置模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'events.json');
const DB_FILE = path.join(__dirname, 'data', 'calendar.db');

// 确保数据目录存在
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// 初始化SQLite数据库
const db = new sqlite3.Database(DB_FILE);

// 创建数据库表
db.serialize(() => {
    // 事件表
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        text TEXT NOT NULL,
        category TEXT DEFAULT 'other',
        emoji TEXT DEFAULT '',
        type TEXT DEFAULT 'event',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 自定义表情表
    db.run(`CREATE TABLE IF NOT EXISTS custom_emojis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        image_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 用户设置表
    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// 数据库操作函数
const dbOperations = {
    // 获取所有事件
    getAllEvents: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM events ORDER BY date DESC", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // 转换为原有格式
                    const events = {};
                    rows.forEach(row => {
                        if (!events[row.date]) {
                            events[row.date] = [];
                        }
                        events[row.date].push({
                            id: row.id,
                            text: row.text,
                            category: row.category,
                            emoji: row.emoji,
                            type: row.type,
                            createdAt: row.created_at
                        });
                    });
                    resolve(events);
                }
            });
        });
    },
    
    // 添加事件
    addEvent: (date, text, category, emoji, type = 'event') => {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare("INSERT INTO events (date, text, category, emoji, type) VALUES (?, ?, ?, ?, ?)");
            stmt.run(date, text, category, emoji, type, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    },
    
    // 删除事件
    deleteEvent: (id) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM events WHERE id = ?", id, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },
    
    // 更新日期表情
    updateDateEmoji: (date, emoji) => {
        return new Promise((resolve, reject) => {
            // 先查找是否存在日期表情
            db.get("SELECT id FROM events WHERE date = ? AND type = 'date-emoji'", date, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row) {
                    // 更新现有记录
                    if (emoji) {
                        db.run("UPDATE events SET emoji = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", emoji, row.id, function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                    } else {
                        // 删除记录
                        db.run("DELETE FROM events WHERE id = ?", row.id, function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                    }
                } else if (emoji) {
                    // 创建新记录
                    const stmt = db.prepare("INSERT INTO events (date, text, category, emoji, type) VALUES (?, ?, ?, ?, ?)");
                    stmt.run(date, '', 'other', emoji, 'date-emoji', function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
                    stmt.finalize();
                } else {
                    resolve(0);
                }
            });
        });
    },
    
    // 搜索事件
    searchEvents: (query, category, startDate, endDate) => {
        return new Promise((resolve, reject) => {
            let sql = "SELECT * FROM events WHERE text LIKE ? AND type = 'event'";
            let params = [`%${query}%`];
            
            if (category) {
                sql += " AND category = ?";
                params.push(category);
            }
            
            if (startDate) {
                sql += " AND date >= ?";
                params.push(startDate);
            }
            
            if (endDate) {
                sql += " AND date <= ?";
                params.push(endDate);
            }
            
            sql += " ORDER BY date DESC";
            
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const results = rows.map(row => ({
                        ...row,
                        dateFormatted: moment(row.date).format('YYYY年MM月DD日')
                    }));
                    resolve(results);
                }
            });
        });
    },
    
    // 获取自定义表情
    getCustomEmojis: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM custom_emojis ORDER BY category, created_at", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const emojis = {};
                    rows.forEach(row => {
                        if (!emojis[row.category]) {
                            emojis[row.category] = {
                                name: row.category,
                                emojis: []
                            };
                        }
                        emojis[row.category].emojis.push({
                            id: row.id,
                            name: row.name,
                            imageData: row.image_data,
                            createdAt: row.created_at
                        });
                    });
                    resolve(emojis);
                }
            });
        });
    },
    
    // 添加自定义表情
    addCustomEmoji: (name, category, imageData) => {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare("INSERT INTO custom_emojis (name, category, image_data) VALUES (?, ?, ?)");
            stmt.run(name, category, imageData, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }
};

// 兼容性函数 - 从JSON迁移到SQLite
async function migrateFromJSON() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            console.log('🔄 检测到JSON数据文件，开始迁移到SQLite...');
            const jsonData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            
            for (const [date, events] of Object.entries(jsonData)) {
                for (const event of events) {
                    await dbOperations.addEvent(
                        date,
                        event.text || '',
                        event.category || 'other',
                        event.emoji || '',
                        event.type || 'event'
                    );
                }
            }
            
            // 备份原JSON文件
            const backupFile = DATA_FILE + '.backup.' + Date.now();
            fs.renameSync(DATA_FILE, backupFile);
            console.log(`✅ 数据迁移完成！原JSON文件已备份为: ${path.basename(backupFile)}`);
        }
    } catch (error) {
        console.error('❌ 数据迁移失败:', error);
    }
}

// 加载事件数据（兼容旧版本）
function loadEvents() {
    // 这个函数保留用于兼容性，实际使用数据库
    return {};
}

// 保存事件数据（兼容旧版本）
function saveEvents(events) {
    // 这个函数保留用于兼容性，实际使用数据库
    return true;
}

// 创建数据库备份
async function createDatabaseBackup() {
    try {
        const backupDir = path.join(__dirname, 'data', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const backupFile = path.join(backupDir, `database_backup_${timestamp}.json`);
        
        const currentEvents = await dbOperations.getAllEvents();
        const currentCustomEmojis = await dbOperations.getCustomEmojis();
        
        const backupData = {
            events: currentEvents,
            customEmojis: currentCustomEmojis,
            backupDate: new Date().toISOString(),
            version: '2.0'
        };
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        // 只保留最近10个备份文件
        const backupFiles = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('database_backup_'))
            .sort()
            .reverse();
            
        if (backupFiles.length > 10) {
            backupFiles.slice(10).forEach(file => {
                fs.unlinkSync(path.join(backupDir, file));
            });
        }
        
        return backupFile;
    } catch (error) {
        console.error('创建数据库备份失败:', error);
        return null;
    }
}

// 兼容性函数
async function backupData() {
    return await createDatabaseBackup();
}

// 加载用户自定义表情
function loadCustomEmojis() {
    try {
        const customEmojiFile = path.join(__dirname, 'data', 'custom-emojis.json');
        if (fs.existsSync(customEmojiFile)) {
            const data = fs.readFileSync(customEmojiFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载自定义表情失败:', error);
    }
    return {};
}

// 初始化数据
let events = {};

// 启动时迁移数据并加载
(async () => {
    await migrateFromJSON();
    events = await dbOperations.getAllEvents();
    userCustomEmojis = await dbOperations.getCustomEmojis();
    console.log('📊 数据库初始化完成');
})();

// 事件分类配置
const eventCategories = {
  work: { name: '工作', icon: '💼', color: '#FF6B6B' },
  life: { name: '生活', icon: '🏠', color: '#4ECDC4' },
  study: { name: '学习', icon: '📚', color: '#45B7D1' },
  entertainment: { name: '娱乐', icon: '🎮', color: '#96CEB4' },
  health: { name: '健康', icon: '💪', color: '#FECA57' },
  social: { name: '社交', icon: '👥', color: '#FF9FF3' },
  travel: { name: '旅行', icon: '✈️', color: '#54A0FF' },
  other: { name: '其他', icon: '📝', color: '#5F27CD' }
};

// 内置表情包
const builtInEmojis = {
  mood: {
    name: '心情',
    emojis: ['😊', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓']
  },
  weather: {
    name: '天气',
    emojis: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌈', '☔', '💧', '💦']
  },
  activities: {
    name: '活动',
    emojis: ['🏃‍♂️', '🏃‍♀️', '🚶‍♂️', '🚶‍♀️', '🧘‍♂️', '🧘‍♀️', '🏋️‍♂️', '🏋️‍♀️', '🤸‍♂️', '🤸‍♀️', '🏊‍♂️', '🏊‍♀️', '🚴‍♂️', '🚴‍♀️', '🏌️‍♂️', '🏌️‍♀️', '🏄‍♂️', '🏄‍♀️', '⛷️', '🏂', '🤾‍♂️', '🤾‍♀️', '🏀', '⚽', '🎾', '🏐', '🏈', '⚾', '🥎', '🎱', '🏓', '🏸', '🥅', '🎯', '🎮', '🎲', '🎪', '🎨', '🎭', '🎪', '🎵', '🎶', '🎤', '🎧', '📚', '✏️', '🖊️', '🖋️', '✒️']
  },
  food: {
    name: '美食',
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
  },
  nature: {
    name: '自然',
    emojis: ['🌱', '🌿', '☘️', '🍀', '🎋', '🎍', '🌾', '🌵', '🌲', '🌳', '🌴', '🌸', '🌺', '🌻', '🌷', '🌹', '🥀', '🌼', '🌻', '🏵️', '💐', '🍄', '🌰', '🐚', '🪨', '🌊', '💧', '🔥', '⭐', '🌟', '💫', '✨', '🌙', '☀️', '🪐', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']
  },
  animals: {
    name: '动物',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
  }
};

// 用户自定义表情存储
let userCustomEmojis = {};

// 多巴胺色彩配置
const dopamineColors = {
  light: [
    '#FFE5E5', // 浅粉色
    '#E5F3FF', // 浅蓝色
    '#E5FFE5', // 浅绿色
    '#FFF5E5', // 浅橙色
    '#F0E5FF'  // 浅紫色
  ],
  medium: [
    '#FFB3B3', // 中粉色
    '#B3D9FF', // 中蓝色
    '#B3FFB3', // 中绿色
    '#FFDFB3', // 中橙色
    '#D9B3FF'  // 中紫色
  ],
  dark: [
    '#FF8080', // 深粉色
    '#80B3FF', // 深蓝色
    '#80FF80', // 深绿色
    '#FFCC80', // 深橙色
    '#CC80FF'  // 深紫色
  ]
};

// 获取日期的颜色
function getDateColor(date) {
  const dateKey = moment(date).format('YYYY-MM-DD');
  const dayEvents = events[dateKey] || [];
  const eventCount = dayEvents.length;
  const textLength = dayEvents.reduce((sum, event) => sum + event.text.length, 0);
  
  // 根据事件数量和文字长度计算颜色强度
  const intensity = Math.min(Math.floor((eventCount * 2 + textLength / 50) / 3), 2);
  const colorIndex = Math.floor(Math.random() * 5);
  
  if (intensity === 0) return dopamineColors.light[colorIndex];
  if (intensity === 1) return dopamineColors.medium[colorIndex];
  return dopamineColors.dark[colorIndex];
}

// 判断是否为工作日
function isWorkday(date) {
  const day = moment(date).day();
  return day >= 1 && day <= 5; // 周一到周五
}

// 路由
app.get('/', async (req, res) => {
  const today = moment();
  const year = parseInt(req.query.year) || today.year();
  const month = parseInt(req.query.month) || today.month() + 1;
  const view = req.query.view || 'month';
  
  try {
    // 从数据库获取最新事件数据
    const currentEvents = await dbOperations.getAllEvents();
    
    res.render('index', {
          year,
          month,
          view,
          today: today.format('YYYY-MM-DD'),
          moment,
          events: currentEvents,
          eventCategories,
          getDateColor,
          isWorkday
      });
  } catch (error) {
    console.error('获取事件数据失败:', error);
    res.render('index', {
          year,
          month,
          view,
          today: today.format('YYYY-MM-DD'),
          moment,
          events: {},
          eventCategories,
          getDateColor,
          isWorkday
      });
  }
});

// 添加事件
app.post('/events', async (req, res) => {
  const { date, text, category = 'other', emoji = '' } = req.body;
  
  try {
    const eventId = await dbOperations.addEvent(date, text, category, emoji);
    // 更新内存中的事件数据
    events = await dbOperations.getAllEvents();
    res.json({ success: true, id: eventId });
  } catch (error) {
    console.error('添加事件失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 设置日期表情
app.post('/date-emoji', async (req, res) => {
  const { date, emoji } = req.body;
  
  try {
    await dbOperations.updateDateEmoji(date, emoji);
    // 更新内存中的事件数据
    events = await dbOperations.getAllEvents();
    res.json({ success: true });
  } catch (error) {
    console.error('设置日期表情失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 获取内置表情
app.get('/emojis', (req, res) => {
  res.json(builtInEmojis);
});

// 获取用户自定义表情
app.get('/custom-emojis', async (req, res) => {
  try {
    const customEmojis = await dbOperations.getCustomEmojis();
    res.json(customEmojis);
  } catch (error) {
    console.error('获取自定义表情失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 上传自定义表情
app.post('/upload-emoji', async (req, res) => {
  const { name, category, imageData } = req.body;
  
  try {
    const emojiId = await dbOperations.addCustomEmoji(name, category, imageData);
    // 更新内存中的自定义表情数据
    userCustomEmojis = await dbOperations.getCustomEmojis();
    res.json({ success: true, emojiId });
  } catch (error) {
    console.error('上传自定义表情失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 获取事件分类
app.get('/categories', (req, res) => {
  res.json(eventCategories);
});

// 搜索事件
app.get('/search', async (req, res) => {
  const { q, category, startDate, endDate } = req.query;
  
  if (!q) {
    return res.json([]);
  }
  
  try {
    const results = await dbOperations.searchEvents(q, category, startDate, endDate);
    res.json(results);
  } catch (error) {
    console.error('搜索事件失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 获取事件
app.get('/events/:date', (req, res) => {
  const date = req.params.date;
  res.json(events[date] || []);
});

// 删除事件
app.delete('/events/:date/:id', async (req, res) => {
  const { date, id } = req.params;
  
  try {
    await dbOperations.deleteEvent(parseInt(id));
    // 更新内存中的事件数据
    events = await dbOperations.getAllEvents();
    res.json({ success: true });
  } catch (error) {
    console.error('删除事件失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// 数据导出
app.get('/export', async (req, res) => {
  try {
    const currentEvents = await dbOperations.getAllEvents();
    const currentCustomEmojis = await dbOperations.getCustomEmojis();
    
    const exportData = {
      events: currentEvents,
      customEmojis: currentCustomEmojis,
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=calendar_export_${moment().format('YYYY-MM-DD')}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

// 数据导入
app.post('/import', async (req, res) => {
  try {
    const { importData, mergeMode = 'replace' } = req.body;
    
    if (!importData || !importData.events) {
      return res.status(400).json({ success: false, error: '无效的导入数据' });
    }
    
    // 备份当前数据
    const backupFile = await createDatabaseBackup();
    
    if (mergeMode === 'replace') {
      // 清空现有数据
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM events", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM custom_emojis", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    // 导入事件数据
    for (const [date, eventList] of Object.entries(importData.events)) {
      for (const event of eventList) {
        await dbOperations.addEvent(
          date,
          event.text || '',
          event.category || 'other',
          event.emoji || '',
          event.type || 'event'
        );
      }
    }
    
    // 导入自定义表情（如果有）
    if (importData.customEmojis) {
      for (const [category, categoryData] of Object.entries(importData.customEmojis)) {
        for (const emoji of categoryData.emojis) {
          await dbOperations.addCustomEmoji(emoji.name, category, emoji.imageData);
        }
      }
    }
    
    // 更新内存数据
    events = await dbOperations.getAllEvents();
    userCustomEmojis = await dbOperations.getCustomEmojis();
    
    res.json({ 
      success: true, 
      message: '导入成功',
      backupFile: backupFile ? path.basename(backupFile) : null
    });
  } catch (error) {
    console.error('导入数据失败:', error);
    res.status(500).json({ success: false, error: '导入失败' });
  }
});

// 创建备份
app.post('/backup', (req, res) => {
  const backupFile = backupData();
  if (backupFile) {
    res.json({ 
      success: true, 
      message: '备份创建成功',
      backupFile: path.basename(backupFile)
    });
  } else {
    res.status(500).json({ success: false, error: '备份失败' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🎉 服务器启动成功！');
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log('📱 移动端访问: 在同一网络下使用设备IP地址访问');
  console.log('🔧 停止服务: 按 Ctrl+C');
  console.log('');
  console.log('✨ 享受你的多巴胺日历之旅！');
  console.log('');
});