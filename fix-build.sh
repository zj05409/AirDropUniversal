#!/bin/bash

# 一键构建脚本 - 构建React应用并创建DMG安装包

echo "===== 🚀 开始一键构建 AirDrop Universal 🚀 ====="

echo "===== 🧹 清理旧的构建文件 ====="
rm -rf dist
rm -rf build
rm -rf node_modules/.cache

echo "===== 🧹 清理electron-builder缓存 ====="
rm -rf ~/Library/Caches/electron-builder
rm -rf ~/.electron-gyp

echo "===== 📦 重新安装依赖 ====="
# 删除node_modules和package-lock.json完全重新安装
rm -rf node_modules
rm -f package-lock.json
npm install
# 特别安装semver，解决缺失模块问题
npm install semver --save-dev

echo "===== 🔨 构建React应用 ====="
# 确保React应用始终被构建
npm run build
if [ ! -d "build" ]; then
  echo "React构建失败，终止流程！"
  exit 1
fi

echo "===== ⚙️ 确保electron.js文件存在 ====="
if [ ! -f "build/electron.js" ]; then
  echo "创建build/electron.js文件..."
  mkdir -p build
  cat > build/electron.js << 'EOL'
// 这个文件是electron-builder寻找的入口点
// 它只是简单地转发到真正的入口文件

console.log('启动Electron应用...');
console.log('工作目录:', process.cwd());

// 加载主入口文件
try {
    console.log('尝试加载electron/index.js');
    require('../electron/index.js');
} catch (error) {
    console.error('加载入口文件失败:', error);
    
    // 尝试使用绝对路径
    try {
        const path = require('path');
        const appPath = path.join(__dirname, '..', 'electron', 'index.js');
        console.log('尝试使用绝对路径加载:', appPath);
        require(appPath);
    } catch (secondError) {
        console.error('二次尝试失败:', secondError);
        process.exit(1);
    }
}
EOL
fi

echo "===== 📱 构建Electron DMG安装包 ====="
# 直接构建dmg包
DEBUG=electron-builder NODE_DEBUG=electron-builder npx electron-builder -m

echo "===== ✅ 构建完成 ====="
echo "DMG安装包位于: dist/AirDrop Universal-1.0.0-x64.dmg"
echo "您可以双击DMG文件安装应用了！" 