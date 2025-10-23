@echo off
REM 多巴胺日历应用启动脚本 (Windows)
REM 使用方法: start.bat [端口号]

REM 默认端口
set DEFAULT_PORT=3000

REM 获取端口参数
if "%1"=="" (
    set PORT=%DEFAULT_PORT%
    echo 🌈 使用默认端口: %PORT%
) else (
    set PORT=%1
    echo 🌈 使用指定端口: %PORT%
)

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装！
    echo 💡 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    npm install
)

REM 启动应用
echo 🚀 启动多巴胺日历应用...
echo 📡 端口: %PORT%
echo 🌐 访问地址: http://localhost:%PORT%
echo 🔧 停止服务: 按 Ctrl+C
echo.

set PORT=%PORT%
node server.js

pause