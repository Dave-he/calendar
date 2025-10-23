const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

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

// 确保数据目录存在
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// 加载事件数据
function loadEvents() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载事件数据失败:', error);
    }
    return {};
}

// 保存事件数据
function saveEvents(events) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
        return true;
    } catch (error) {
        console.error('保存事件数据失败:', error);
        return false;
    }
}

// 备份数据
function backupData() {
    try {
        const backupDir = path.join(__dirname, 'data', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const backupFile = path.join(backupDir, `events_backup_${timestamp}.json`);
        
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, backupFile);
        }
        
        // 只保留最近10个备份文件
        const backupFiles = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('events_backup_'))
            .sort()
            .reverse();
            
        if (backupFiles.length > 10) {
            backupFiles.slice(10).forEach(file => {
                fs.unlinkSync(path.join(backupDir, file));
            });
        }
        
        return backupFile;
    } catch (error) {
        console.error('备份数据失败:', error);
        return null;
    }
}

// 存储事件数据
let events = loadEvents();

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
app.get('/', (req, res) => {
  const today = moment();
  const year = parseInt(req.query.year) || today.year();
  const month = parseInt(req.query.month) || today.month() + 1;
  const view = req.query.view || 'month';
  
  res.render('index', {
        year,
        month,
        view,
        today: today.format('YYYY-MM-DD'),
        moment,
        events,
        eventCategories,
        getDateColor,
        isWorkday
    });
});

// 添加事件
app.post('/events', (req, res) => {
  const { date, text, category = 'other' } = req.body;
  if (!events[date]) {
    events[date] = [];
  }
  events[date].push({ 
    text, 
    category,
    id: Date.now(),
    createdAt: new Date().toISOString()
  });
  
  if (saveEvents(events)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 获取事件分类
app.get('/categories', (req, res) => {
  res.json(eventCategories);
});

// 搜索事件
app.get('/search', (req, res) => {
  const { q, category, startDate, endDate } = req.query;
  
  if (!q) {
    return res.json([]);
  }
  
  const results = [];
  const searchTerm = q.toLowerCase();
  
  Object.keys(events).forEach(date => {
    // 日期范围过滤
    if (startDate && date < startDate) return;
    if (endDate && date > endDate) return;
    
    events[date].forEach(event => {
      // 分类过滤
      if (category && event.category !== category) return;
      
      // 文本搜索
      if (event.text.toLowerCase().includes(searchTerm)) {
        results.push({
          ...event,
          date,
          dateFormatted: moment(date).format('YYYY年MM月DD日')
        });
      }
    });
  });
  
  // 按日期排序
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.json(results);
});

// 获取事件
app.get('/events/:date', (req, res) => {
  const date = req.params.date;
  res.json(events[date] || []);
});

// 删除事件
app.delete('/events/:date/:id', (req, res) => {
  const { date, id } = req.params;
  if (events[date]) {
    events[date] = events[date].filter(event => event.id !== parseInt(id));
    if (events[date].length === 0) {
      delete events[date];
    }
    
    if (saveEvents(events)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: '保存失败' });
    }
  } else {
    res.json({ success: true });
  }
});

// 数据导出
app.get('/export', (req, res) => {
  try {
    const exportData = {
      events,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=calendar_export_${moment().format('YYYY-MM-DD')}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

// 数据导入
app.post('/import', (req, res) => {
  try {
    const { importData, mergeMode = 'replace' } = req.body;
    
    if (!importData || !importData.events) {
      return res.status(400).json({ success: false, error: '无效的导入数据' });
    }
    
    // 备份当前数据
    const backupFile = backupData();
    
    if (mergeMode === 'replace') {
      events = importData.events;
    } else if (mergeMode === 'merge') {
      // 合并数据
      Object.keys(importData.events).forEach(date => {
        if (!events[date]) {
          events[date] = [];
        }
        events[date] = events[date].concat(importData.events[date]);
      });
    }
    
    if (saveEvents(events)) {
      res.json({ 
        success: true, 
        message: '导入成功',
        backupFile: backupFile ? path.basename(backupFile) : null
      });
    } else {
      res.status(500).json({ success: false, error: '保存失败' });
    }
  } catch (error) {
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