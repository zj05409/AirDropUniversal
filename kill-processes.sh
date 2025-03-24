#!/bin/bash

echo "正在清理遗留进程..."

# 终止占用特定端口的进程
cleanup_port() {
    PORT=$1
    echo "检查端口 $PORT..."
    PIDS=$(lsof -ti:$PORT)
    if [ -n "$PIDS" ]; then
        echo "发现端口 $PORT 被占用，PID: $PIDS"
        kill -9 $PIDS
        echo "已终止进程 PID: $PIDS"
    else
        echo "端口 $PORT 未被占用"
    fi
}

# 清理主要端口
cleanup_port 3000  # React 开发服务器
cleanup_port 3001  # API 和 Socket.IO 服务器
cleanup_port 9000  # PeerJS 服务器

# 检查 node 进程
NODE_PIDS=$(ps aux | grep '[n]ode' | grep -i airdrop | awk '{print $2}')
if [ -n "$NODE_PIDS" ]; then
    echo "发现 AirDrop 相关的 Node 进程: $NODE_PIDS"
    kill -9 $NODE_PIDS
    echo "已终止 Node 进程"
fi

# 检查是否仍有进程占用端口
REMAINING=$(lsof -ti:3000,3001,9000)
if [ -n "$REMAINING" ]; then
    echo "警告: 仍有进程占用端口: $REMAINING"
else
    echo "所有端口已释放"
fi

echo "清理完成" 