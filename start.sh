#!/bin/bash

# 多巴胺日历应用启动脚本
# 使用方法: ./start.sh [端口号]

# 默认端口
DEFAULT_PORT=3000

# 获取端口参数
if [ $# -eq 0 ]; then
    PORT=$DEFAULT_PORT
    echo "🌈 使用默认端口: $PORT"
else
    PORT=$1
    echo "🌈 使用指定端口: $PORT"
fi

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ 端口 $PORT 已被占用！"
    echo "💡 请尝试以下解决方案："
    echo "   1. 使用其他端口: ./start.sh 3001"
    echo "   2. 杀死占用进程: kill -9 \$(lsof -ti:$PORT)"
    echo "   3. 查看占用进程: lsof -i :$PORT"
    exit 1
fi

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装！"
    echo "💡 请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

# 启动应用
echo "🚀 启动多巴胺日历应用..."
echo "📡 端口: $PORT"
echo "🌐 访问地址: http://localhost:$PORT"
echo "🔧 停止服务: 按 Ctrl+C"
echo ""

PORT=$PORT node server.js