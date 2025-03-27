#!/bin/bash

# 一键启动开发环境
echo "===== 🚀 启动 AirDrop Universal 开发环境 🚀 ====="

# 终止可能存在的进程
echo "===== 🧹 清理现有进程 ====="
pkill -f "node.*server.js" || true
pkill -f "react-scripts start" || true
pkill -f "electron" || true
lsof -t -i:3000 | xargs -r kill -9
lsof -t -i:3001 | xargs -r kill -9
lsof -t -i:9000 | xargs -r kill -9

# 使用 concurrently 同时启动前端和后端
echo "===== 🚀 启动前端和后端服务 ====="
npx concurrently -n "前端,后端,Electron" -c "green,blue,yellow" \
  "HOST=0.0.0.0 npm start" \
  "npm run server" \
  "sleep 10 && npm run electron-dev"

# 如果发生错误，清理进程
trap 'echo "===== 💥 发生错误，清理进程 ====="; pkill -f "node.*server.js"; pkill -f "react-scripts start"; pkill -f "electron"; exit 1' ERR

echo "===== 🌈 开发环境已启动 =====" 