#!/bin/bash

# 显示欢迎信息
echo "=========================================================="
echo "     AirDrop Universal - 调试模式启动脚本"
echo "=========================================================="
echo "这个脚本将启动不压缩的开发环境，方便调试。"
echo ""

# 杀死可能占用端口的进程
echo "正在清理可能占用端口的进程..."
lsof -t -i:3000 | xargs -r kill -9
lsof -t -i:3001 | xargs -r kill -9
lsof -t -i:9000 | xargs -r kill -9

# 启动不压缩的Electron开发环境
echo "正在启动不压缩的Electron开发环境..."
echo "调试提示："
echo "1. 在Electron窗口中按 Ctrl+Shift+I (Windows/Linux) 或 Cmd+Opt+I (Mac) 打开开发者工具"
echo "2. 在开发者工具中，可以查看未压缩的源代码"
echo "3. 在Console标签页中查看错误信息"
echo "4. 在Sources标签页中可以设置断点进行调试"
echo ""
echo "正在启动..."

# 执行npm脚本
npm run electron-dev-uncompressed 