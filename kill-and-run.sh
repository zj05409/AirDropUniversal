#!/bin/bash

# 需要监控的端口
REACT_PORT=3000
SERVER_PORT=3001
PEER_PORT=9000

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 根据传入的参数运行不同的命令
if [ "$1" == "start" ]; then
  echo -e "${YELLOW}正在检查并清理前端进程...${NC}"
  
  # 只杀死占用React端口的进程
  REACT_PID=$(lsof -t -i:$REACT_PORT 2>/dev/null)
  if [ ! -z "$REACT_PID" ]; then
    echo -e "${RED}杀死占用React端口($REACT_PORT)的进程:${NC} $REACT_PID"
    kill -9 $REACT_PID
  fi
  
  # 等待一秒以确保进程已被完全杀死
  sleep 1
  
  echo -e "${GREEN}前端进程已清理完毕${NC}"
  echo -e "${GREEN}启动前端应用...${NC}"
  npm start
  
elif [ "$1" == "server" ]; then
  echo -e "${YELLOW}正在检查并清理服务器进程...${NC}"
  
  # 只杀死占用服务器端口和PeerJS端口的进程
  SERVER_PID=$(lsof -t -i:$SERVER_PORT 2>/dev/null)
  if [ ! -z "$SERVER_PID" ]; then
    echo -e "${RED}杀死占用服务器端口($SERVER_PORT)的进程:${NC} $SERVER_PID"
    kill -9 $SERVER_PID
  fi
  
  PEER_PID=$(lsof -t -i:$PEER_PORT 2>/dev/null)
  if [ ! -z "$PEER_PID" ]; then
    echo -e "${RED}杀死占用PeerJS端口($PEER_PORT)的进程:${NC} $PEER_PID"
    kill -9 $PEER_PID
  fi
  
  # 等待一秒以确保进程已被完全杀死
  sleep 1
  
  echo -e "${GREEN}服务器进程已清理完毕${NC}"
  echo -e "${GREEN}启动后端服务器...${NC}"
  npm run server
  
else
  echo -e "${GREEN}使用示例:${NC}"
  echo -e "  ./kill-and-run.sh start   # 启动前端应用"
  echo -e "  ./kill-and-run.sh server  # 启动后端服务器"
fi 