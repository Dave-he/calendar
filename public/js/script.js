let currentView = 'month';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedDate = '';
let translations = {};
let currentLanguage = 'zh';
let currentCountry = 'CN';
let holidays = [];

// 多语言支持
async function loadTranslations() {
    try {
        const response = await fetch('/locales/translations.json');
        translations = await response.json();
    } catch (error) {
        console.error('加载翻译文件失败:', error);
        translations = { zh: {}, en: {} };
    }
}

function t(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    for (const k of keys) {
        if (value && value[k]) {
            value = value[k];
        } else {
            return key; // 如果找不到翻译，返回原始key
        }
    }
    
    return value || key;
}

// 更新界面语言
function updateLanguage() {
    // 更新标题
    document.title = t('title');
    
    // 更新导航按钮
    const todayBtn = document.querySelector('.nav-button[onclick*="today"]');
    if (todayBtn) todayBtn.textContent = t('navigation.today');
    
    // 更新视图按钮
    const yearBtn = document.querySelector('.view-button[onclick*="year"]');
    const monthBtn = document.querySelector('.view-button[onclick*="month"]');
    const dayBtn = document.querySelector('.view-button[onclick*="day"]');
    
    if (yearBtn) yearBtn.textContent = t('navigation.year');
    if (monthBtn) monthBtn.textContent = t('navigation.month');
    if (dayBtn) dayBtn.textContent = t('navigation.day');
    
    // 更新其他界面元素
    updateModalLanguage();
    updateSettingsLanguage();
}

function updateModalLanguage() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        const title = modal.querySelector('h2');
        if (title) {
            title.textContent = isEditMode ? t('events.edit') : t('events.add');
        }
        
        const textarea = modal.querySelector('textarea');
        if (textarea) {
            textarea.placeholder = t('events.placeholder');
        }
    }
}

function updateSettingsLanguage() {
    // 这里可以添加设置界面的语言更新逻辑
}

// 国家和语言管理
async function loadUserSettings() {
    try {
        const response = await fetch('/settings');
        const settings = await response.json();
        currentCountry = settings.country || 'CN';
        currentLanguage = settings.language || 'zh';
    } catch (error) {
        console.error('加载用户设置失败:', error);
    }
}

async function saveUserSettings(country, language) {
    try {
        const response = await fetch('/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ country, language })
        });
        
        if (response.ok) {
            currentCountry = country;
            currentLanguage = language;
            updateLanguage();
            await loadHolidays();
            location.reload(); // 重新加载页面以应用新设置
        }
    } catch (error) {
        console.error('保存用户设置失败:', error);
    }
}

// 节假日管理
async function loadHolidays(forceRefresh = false) {
    try {
        const url = `/holidays/${currentCountry}/${currentYear}${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        holidays = await response.json();
        updateHolidayDisplay();
        
        if (forceRefresh) {
            showMessage('节假日数据已刷新', 'success');
        }
    } catch (error) {
        console.error('加载节假日失败:', error);
        holidays = [];
        if (forceRefresh) {
            showMessage('刷新节假日数据失败', 'error');
        }
    }
}

// 手动刷新节假日
async function refreshHolidays() {
    try {
        showMessage('正在刷新节假日数据...', 'info');
        
        const response = await fetch('/holidays/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                country: currentCountry,
                year: currentYear
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadHolidays();
            showMessage(result.message, 'success');
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        console.error('刷新节假日失败:', error);
        showMessage('刷新节假日数据失败', 'error');
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function updateHolidayDisplay() {
    // 在日历中标记节假日
    holidays.forEach(holiday => {
        const dateElement = document.querySelector(`[data-date="${holiday.date}"]`);
        if (dateElement) {
            dateElement.classList.add('holiday');
            
            // 添加节假日标记
            const holidayMark = document.createElement('div');
            holidayMark.className = 'holiday-mark';
            holidayMark.textContent = '🎉';
            holidayMark.title = holiday.name;
            dateElement.appendChild(holidayMark);
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 加载翻译和用户设置
    await loadTranslations();
    await loadUserSettings();
    
    // 更新界面语言
    updateLanguage();
    
    // 加载节假日
    await loadHolidays();
    
    // 设置今天的日期跳转输入框
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateJump').value = today;
    
    // 应用背景颜色
    applyBackgroundColors();
    
    // 初始化触摸手势
    initTouchGestures();
    
    // 模态框事件
    const modal = document.getElementById('eventModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
});

// 初始化触摸手势
function initTouchGestures() {
    let startX = 0;
    let startY = 0;
    let isSwipe = false;
    
    const calendarContainer = document.querySelector('.calendar-container');
    
    if (!calendarContainer) return;
    
    calendarContainer.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwipe = false;
    }, { passive: true });
    
    calendarContainer.addEventListener('touchmove', function(e) {
        if (!startX || !startY) return;
        
        const diffX = Math.abs(e.touches[0].clientX - startX);
        const diffY = Math.abs(e.touches[0].clientY - startY);
        
        // 判断是否为水平滑动
        if (diffX > diffY && diffX > 50) {
            isSwipe = true;
        }
    }, { passive: true });
    
    calendarContainer.addEventListener('touchend', function(e) {
        if (!isSwipe || !startX) return;
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        
        // 滑动阈值
        if (Math.abs(diffX) > 100) {
            if (diffX > 0) {
                // 向左滑动 - 下一个月/年
                navigate(1);
            } else {
                // 向右滑动 - 上一个月/年
                navigate(-1);
            }
        }
        
        startX = 0;
        startY = 0;
        isSwipe = false;
    }, { passive: true });
}

// 移动端专用的快速添加事件
function quickAddEvent(date) {
    if (window.innerWidth <= 768) {
        // 移动端使用简化的添加流程
        const text = prompt('快速添加事件:');
        if (text && text.trim()) {
            addEventQuick(date, text.trim());
        }
    } else {
        // 桌面端使用完整模态框
        openEventModal(date);
    }
}

// 快速添加事件（移动端）
async function addEventQuick(date, text) {
    try {
        const response = await fetch('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: date,
                text: text,
                category: 'other'
            })
        });
        
        if (response.ok) {
            showSuccessMessage('事件添加成功！');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (error) {
        console.error('添加事件失败:', error);
        alert('添加事件失败，请重试');
    }
}

// 应用背景颜色
function applyBackgroundColors() {
    const elements = document.querySelectorAll('[data-bg-color]');
    elements.forEach(element => {
        const bgColor = element.getAttribute('data-bg-color');
        if (bgColor) {
            element.style.backgroundColor = bgColor;
        }
    });
    
    // 应用边框颜色
    const borderElements = document.querySelectorAll('[data-border-color]');
    borderElements.forEach(element => {
        const borderColor = element.getAttribute('data-border-color');
        if (borderColor) {
            // 检查是否是月视图中的事件项
            if (element.classList.contains('event-item')) {
                element.style.borderLeft = `3px solid ${borderColor}`;
            } else {
                element.style.borderLeft = `4px solid ${borderColor}`;
            }
        }
    });
}

// 切换视图
function changeView(view) {
    currentView = view;
    const url = new URL(window.location);
    url.searchParams.set('view', view);
    url.searchParams.set('year', currentYear);
    url.searchParams.set('month', currentMonth);
    window.location.href = url.toString();
}

// 导航
function navigate(direction) {
    if (currentView === 'year') {
        currentYear += direction;
    } else if (currentView === 'month') {
        currentMonth += direction;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        } else if (currentMonth < 1) {
            currentMonth = 12;
            currentYear--;
        }
    }
    
    const url = new URL(window.location);
    url.searchParams.set('view', currentView);
    url.searchParams.set('year', currentYear);
    url.searchParams.set('month', currentMonth);
    window.location.href = url.toString();
}

// 跳转到今天
function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;
    
    const url = new URL(window.location);
    url.searchParams.set('view', currentView);
    url.searchParams.set('year', currentYear);
    url.searchParams.set('month', currentMonth);
    window.location.href = url.toString();
}

// 跳转到指定日期
function jumpToDate(dateStr) {
    if (!dateStr) return;
    
    const date = new Date(dateStr);
    currentYear = date.getFullYear();
    currentMonth = date.getMonth() + 1;
    
    const url = new URL(window.location);
    url.searchParams.set('view', 'month');
    url.searchParams.set('year', currentYear);
    url.searchParams.set('month', currentMonth);
    window.location.href = url.toString();
}

// 打开事件模态框
function openEventModal(date) {
    selectedDate = date;
    const modal = document.getElementById('eventModal');
    const modalDate = document.getElementById('modalDate');
    const eventList = document.getElementById('eventList');
    
    modalDate.textContent = formatDate(date);
    modal.style.display = 'block';
    
    // 加载事件
    loadEvents(date);
}

// 格式化日期显示
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}年${month}月${day}日 ${weekday}`;
}

// 加载事件
async function loadEvents(date) {
    try {
        const response = await fetch(`/events/${date}`);
        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        console.error('加载事件失败:', error);
    }
}

// 显示事件
function displayEvents(events) {
    const eventList = document.getElementById('eventList');
    
    if (events.length === 0) {
        eventList.innerHTML = '<div class="no-events"><p>这一天还没有记录任何事件</p></div>';
        return;
    }
    
    eventList.innerHTML = events.map(event => `
        <div class="event-card">
            <div class="event-content">
                <p>${escapeHtml(event.text)}</p>
            </div>
            <button class="delete-btn" onclick="deleteEvent('${selectedDate}', ${event.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// 添加事件
async function addEvent() {
    const eventText = document.getElementById('eventText');
    const eventCategory = document.getElementById('eventCategory');
    const eventEmoji = document.getElementById('eventEmoji');
    const text = eventText.value.trim();
    const category = eventCategory.value;
    const emoji = eventEmoji.value;
    
    if (!text) {
        alert('请输入事件内容');
        return;
    }
    
    try {
        const response = await fetch('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: selectedDate,
                text: text,
                category: category,
                emoji: emoji
            })
        });
        
        if (response.ok) {
            eventText.value = '';
            eventCategory.value = 'other';
            eventEmoji.value = '';
            loadEvents(selectedDate);
            showSuccessMessage('事件添加成功！');
            // 刷新页面以更新颜色
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (error) {
        console.error('添加事件失败:', error);
        alert('添加事件失败，请重试');
    }
}

// 删除事件
async function deleteEvent(date, eventId) {
    if (!confirm('确定要删除这个事件吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/events/${date}/${eventId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            if (selectedDate) {
                loadEvents(selectedDate);
            }
            // 刷新页面以更新颜色
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (error) {
        console.error('删除事件失败:', error);
        alert('删除事件失败，请重试');
    }
}

// 日视图添加事件
async function addDayEvent() {
    const eventText = document.getElementById('dayEventText');
    const eventCategory = document.getElementById('dayEventCategory');
    const eventEmoji = document.getElementById('dayEventEmoji');
    const text = eventText.value.trim();
    const category = eventCategory.value;
    const emoji = eventEmoji.value;
    
    if (!text) {
        alert('请输入事件内容');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const response = await fetch('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: today,
                text: text,
                category: category,
                emoji: emoji
            })
        });
        
        if (response.ok) {
            eventText.value = '';
            eventCategory.value = 'other';
            eventEmoji.value = '';
            showSuccessMessage('事件添加成功！');
            // 刷新页面
            setTimeout(() => {
                window.location.reload();
            }, 300);
        }
    } catch (error) {
        console.error('添加事件失败:', error);
        alert('添加事件失败，请重试');
    }
}

// 显示成功消息
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// 分类筛选功能
function filterByCategory(category) {
    // 这里可以实现分类筛选逻辑
    // 暂时通过URL参数实现
    const url = new URL(window.location);
    if (category) {
        url.searchParams.set('category', category);
    } else {
        url.searchParams.delete('category');
    }
    window.location.href = url.toString();
}

// 数据导出
async function exportData() {
    try {
        const response = await fetch('/export');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `calendar_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showSuccessMessage('数据导出成功！');
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败，请重试');
    }
}

// 显示导入模态框
function showImportModal() {
    document.getElementById('importModal').style.display = 'block';
}

// 关闭导入模态框
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    document.getElementById('importFile').value = '';
    document.getElementById('importBtn').disabled = true;
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('importBtn').disabled = false;
    }
}

// 处理文件拖拽
function handleFileDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('importFile').files = files;
        document.getElementById('importBtn').disabled = false;
    }
}

function handleDragOver(event) {
    event.preventDefault();
}

// 导入数据
async function importData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择要导入的文件');
        return;
    }
    
    try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        const importMode = document.querySelector('input[name="importMode"]:checked').value;
        
        const response = await fetch('/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                importData,
                mergeMode: importMode
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccessMessage('数据导入成功！');
            closeImportModal();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            alert('导入失败：' + result.error);
        }
    } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败，请检查文件格式');
    }
}

// 创建备份
async function createBackup() {
    try {
        const response = await fetch('/backup', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccessMessage('备份创建成功！');
        } else {
            alert('备份失败：' + result.error);
        }
    } catch (error) {
        console.error('备份失败:', error);
        alert('备份失败，请重试');
    }
}

// 搜索处理
function handleSearch(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

// 执行搜索
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('请输入搜索关键词');
        return;
    }
    
    try {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const params = new URLSearchParams({
            q: query
        });
        
        if (categoryFilter) {
            params.append('category', categoryFilter);
        }
        
        const response = await fetch(`/search?${params}`);
        const results = await response.json();
        
        displaySearchResults(results, query);
        document.getElementById('searchModal').style.display = 'block';
        
        // 保存搜索历史
        saveSearchHistory(query);
        
    } catch (error) {
        console.error('搜索失败:', error);
        alert('搜索失败，请重试');
    }
}

// 显示搜索结果
function displaySearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="no-results">
                <p>没有找到包含 "${query}" 的事件</p>
                <p>试试其他关键词吧！</p>
            </div>
        `;
        return;
    }
    
    searchResults.innerHTML = `
        <div class="search-summary">
            <p>找到 <strong>${results.length}</strong> 个包含 "<strong>${query}</strong>" 的事件</p>
        </div>
        <div class="search-results-list">
            ${results.map(result => `
                <div class="search-result-item" onclick="jumpToDate('${result.date}')">
                    <div class="result-header">
                        <span class="result-date">${result.dateFormatted}</span>
                        <span class="result-category" style="color: ${getEventCategoryColor(result.category)}">
                            ${getEventCategoryIcon(result.category)} ${getEventCategoryName(result.category)}
                        </span>
                    </div>
                    <div class="result-content">
                        ${highlightSearchTerm(result.text, query)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 高亮搜索关键词
function highlightSearchTerm(text, term) {
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 获取事件分类信息
function getEventCategoryColor(category) {
    const categories = {
        work: '#FF6B6B',
        life: '#4ECDC4',
        study: '#45B7D1',
        entertainment: '#96CEB4',
        health: '#FECA57',
        social: '#FF9FF3',
        travel: '#54A0FF',
        other: '#5F27CD'
    };
    return categories[category] || '#ccc';
}

function getEventCategoryIcon(category) {
    const icons = {
        work: '💼',
        life: '🏠',
        study: '📚',
        entertainment: '🎮',
        health: '💪',
        social: '👥',
        travel: '✈️',
        other: '📝'
    };
    return icons[category] || '📝';
}

function getEventCategoryName(category) {
    const names = {
        work: '工作',
        life: '生活',
        study: '学习',
        entertainment: '娱乐',
        health: '健康',
        social: '社交',
        travel: '旅行',
        other: '其他'
    };
    return names[category] || '其他';
}

// 关闭搜索模态框
function closeSearchModal() {
    document.getElementById('searchModal').style.display = 'none';
}

// 保存搜索历史
function saveSearchHistory(query) {
    let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    
    // 移除重复项
    history = history.filter(item => item !== query);
    
    // 添加到开头
    history.unshift(query);
    
    // 只保留最近10个搜索
    history = history.slice(0, 10);
    
    localStorage.setItem('searchHistory', JSON.stringify(history));
}

// 加载搜索历史
function loadSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

// 表情管理器相关功能
let currentEmojiInput = null;
let builtInEmojis = {};
let customEmojis = {};

// 显示表情管理器
async function showEmojiManager() {
    await loadEmojis();
    document.getElementById('emojiManagerModal').style.display = 'block';
    renderBuiltInEmojis();
}

// 关闭表情管理器
function closeEmojiManager() {
    document.getElementById('emojiManagerModal').style.display = 'none';
}

// 切换表情管理器标签
function switchEmojiTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.emoji-tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tab === 'built-in' ? 'builtInEmojis' : tab === 'custom' ? 'customEmojis' : 'uploadEmojis').classList.add('active');
    
    if (tab === 'built-in') {
        renderBuiltInEmojis();
    } else if (tab === 'custom') {
        renderCustomEmojis();
    }
}

// 加载表情数据
async function loadEmojis() {
    try {
        const [builtInResponse, customResponse] = await Promise.all([
            fetch('/emojis'),
            fetch('/custom-emojis')
        ]);
        
        builtInEmojis = await builtInResponse.json();
        customEmojis = await customResponse.json();
    } catch (error) {
        console.error('加载表情失败:', error);
    }
}

// 渲染内置表情
function renderBuiltInEmojis() {
    const container = document.querySelector('#builtInEmojis .emoji-categories');
    container.innerHTML = '';
    
    Object.keys(builtInEmojis).forEach(categoryKey => {
        const category = builtInEmojis[categoryKey];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'emoji-category';
        categoryDiv.innerHTML = `
            <h4>${category.name}</h4>
            <div class="emoji-grid">
                ${category.emojis.map(emoji => `
                    <span class="emoji-item" onclick="selectEmoji('${emoji}')">${emoji}</span>
                `).join('')}
            </div>
        `;
        container.appendChild(categoryDiv);
    });
}

// 渲染自定义表情
function renderCustomEmojis() {
    const container = document.querySelector('#customEmojis .custom-emoji-list');
    container.innerHTML = '';
    
    if (Object.keys(customEmojis).length === 0) {
        container.innerHTML = '<p class="no-custom-emojis">还没有自定义表情，去上传一些吧！</p>';
        return;
    }
    
    Object.keys(customEmojis).forEach(categoryKey => {
        const category = customEmojis[categoryKey];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'custom-emoji-category';
        categoryDiv.innerHTML = `
            <h4>${category.name}</h4>
            <div class="custom-emoji-grid">
                ${category.emojis.map(emoji => `
                    <div class="custom-emoji-item" onclick="selectEmoji('${emoji.imageData}')">
                        <img src="${emoji.imageData}" alt="${emoji.name}" title="${emoji.name}">
                        <button class="delete-custom-emoji" onclick="deleteCustomEmoji('${categoryKey}', '${emoji.id}')">&times;</button>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(categoryDiv);
    });
}

// 选择表情
function selectEmoji(emoji) {
    if (currentEmojiInput) {
        document.getElementById(currentEmojiInput).value = emoji;
        closeEmojiPicker();
    }
}

// 显示表情选择器
async function showEmojiPicker(inputId) {
    currentEmojiInput = inputId;
    await loadEmojis();
    
    document.getElementById('emojiPickerModal').style.display = 'block';
    renderEmojiPicker();
}

// 关闭表情选择器
function closeEmojiPicker() {
    document.getElementById('emojiPickerModal').style.display = 'none';
    currentEmojiInput = null;
}

// 渲染表情选择器
function renderEmojiPicker() {
    const content = document.getElementById('emojiPickerContent');
    content.innerHTML = '';
    
    // 渲染内置表情
    Object.keys(builtInEmojis).forEach(categoryKey => {
        const category = builtInEmojis[categoryKey];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'picker-emoji-category';
        categoryDiv.innerHTML = `
            <h5>${category.name}</h5>
            <div class="picker-emoji-grid">
                ${category.emojis.slice(0, 20).map(emoji => `
                    <span class="picker-emoji-item" onclick="selectEmoji('${emoji}')">${emoji}</span>
                `).join('')}
            </div>
        `;
        content.appendChild(categoryDiv);
    });
}

// 清除表情
function clearEmoji(inputId) {
    document.getElementById(inputId).value = '';
}

// 预览上传的表情
function previewEmoji(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('emojiPreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="预览" style="max-width: 50px; max-height: 50px;">`;
        };
        reader.readAsDataURL(file);
    }
}

// 上传自定义表情
async function uploadCustomEmoji() {
    const name = document.getElementById('emojiName').value.trim();
    const category = document.getElementById('emojiCategory').value;
    const file = document.getElementById('emojiFile').files[0];
    
    if (!name || !file) {
        alert('请填写表情名称并选择图片');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const response = await fetch('/upload-emoji', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    category: category,
                    imageData: e.target.result
                })
            });
            
            if (response.ok) {
                showSuccessMessage('表情上传成功！');
                document.getElementById('emojiName').value = '';
                document.getElementById('emojiFile').value = '';
                document.getElementById('emojiPreview').innerHTML = '';
                await loadEmojis();
                renderCustomEmojis();
            } else {
                alert('上传失败，请重试');
            }
        } catch (error) {
            console.error('上传表情失败:', error);
            alert('上传失败，请重试');
        }
    };
    reader.readAsDataURL(file);
}

// 设置日期表情
function setDateEmoji(date) {
    document.getElementById('dateEmojiDate').textContent = date;
    document.getElementById('dateEmojiModal').style.display = 'block';
    currentDateForEmoji = date;
}

// 关闭日期表情模态框
function closeDateEmojiModal() {
    document.getElementById('dateEmojiModal').style.display = 'none';
}

// 保存日期表情
async function saveDateEmoji() {
    const emoji = document.getElementById('dateEmojiInput').value;
    
    if (!emoji) {
        alert('请选择一个表情');
        return;
    }
    
    try {
        const response = await fetch('/date-emoji', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: currentDateForEmoji,
                emoji: emoji
            })
        });
        
        if (response.ok) {
            showSuccessMessage('日期表情设置成功！');
            closeDateEmojiModal();
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (error) {
        console.error('设置日期表情失败:', error);
        alert('设置失败，请重试');
    }
}

// 清除日期表情
async function clearDateEmoji() {
    try {
        const response = await fetch('/date-emoji', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: currentDateForEmoji,
                emoji: ''
            })
        });
        
        if (response.ok) {
            showSuccessMessage('日期表情已清除！');
            closeDateEmojiModal();
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (error) {
        console.error('清除日期表情失败:', error);
        alert('清除失败，请重试');
    }
}

let currentDateForEmoji = null;

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 键盘快捷键
document.addEventListener('keydown', function(e) {
    // ESC 关闭模态框
    if (e.key === 'Escape') {
        const modal = document.getElementById('eventModal');
        modal.style.display = 'none';
    }
    
    // Enter 在模态框中添加事件
    if (e.key === 'Enter' && e.ctrlKey) {
        const modal = document.getElementById('eventModal');
        if (modal.style.display === 'block') {
            addEvent();
        }
    }
    
    // 方向键导航
    if (e.key === 'ArrowLeft' && e.ctrlKey) {
        navigate(-1);
    }
    if (e.key === 'ArrowRight' && e.ctrlKey) {
        navigate(1);
    }
    
    // T 键跳转到今天
    if (e.key === 't' || e.key === 'T') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            goToToday();
        }
    }
});

// 创建设置按钮
function createSettingsButton() {
    const header = document.querySelector('.header');
    if (header && !document.getElementById('settingsBtn')) {
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'settingsBtn';
        settingsBtn.className = 'settings-button';
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.title = t('settings.title');
        settingsBtn.onclick = showSettingsModal;
        header.appendChild(settingsBtn);
    }
}

// 显示设置模态框
function showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'settingsModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closeSettingsModal()">&times;</span>
            <h2>${t('settings.title')}</h2>
            
            <div class="settings-section">
                <label for="countrySelect">${t('settings.country')}:</label>
                <select id="countrySelect" onchange="onCountryChange()">
                    ${Object.entries(window.supportedCountries || {}).map(([code, info]) => 
                        `<option value="${code}" ${code === currentCountry ? 'selected' : ''}>
                            ${info.flag} ${info.name}
                        </option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="settings-section">
                <label for="languageSelect">${t('settings.language')}:</label>
                <select id="languageSelect">
                    <option value="zh" ${currentLanguage === 'zh' ? 'selected' : ''}>🇨🇳 中文</option>
                    <option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                </select>
            </div>
            
            <div class="settings-section">
                <label>${t('settings.holidays')}:</label>
                <button onclick="refreshHolidays()" class="refresh-btn">🔄 刷新节假日数据</button>
            </div>
            
            <div class="settings-actions">
                <button onclick="saveSettings()" class="save-btn">${t('settings.save')}</button>
                <button onclick="closeSettingsModal()" class="cancel-btn">${t('settings.cancel')}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// 国家变化时的处理
function onCountryChange() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const selectedCountry = countrySelect.value;
    
    // 根据国家建议语言
    const countryInfo = window.supportedCountries[selectedCountry];
    if (countryInfo && countryInfo.language) {
        const suggestedLanguage = countryInfo.language === 'zh' ? 'zh' : 'en';
        
        // 询问是否切换语言
        if (confirm(`${t('settings.country')} ${countryInfo.name}\n${t('settings.language')} ${suggestedLanguage === 'zh' ? '中文' : 'English'}?`)) {
            languageSelect.value = suggestedLanguage;
        }
    }
}

// 保存设置
async function saveSettings() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    
    const newCountry = countrySelect.value;
    const newLanguage = languageSelect.value;
    
    await saveUserSettings(newCountry, newLanguage);
    closeSettingsModal();
}

// 关闭设置模态框
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.remove();
    }
}

// 获取当前视图参数
const urlParams = new URLSearchParams(window.location.search);
currentView = urlParams.get('view') || 'month';
currentYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
currentMonth = parseInt(urlParams.get('month')) || new Date().getMonth() + 1;