// 兼容性入口文件
// 用于支持electron-builder找到正确的入口点

const path = require('path');
const fs = require('fs');

console.log('从根目录electron.js启动...');

// 尝试加载不同路径的入口文件
const possiblePaths = [
    './electron/index.js',
    './build/electron.js',
    path.join(__dirname, 'electron', 'index.js'),
    path.join(__dirname, 'build', 'electron.js')
];

let loaded = false;

for (const entryPath of possiblePaths) {
    try {
        console.log(`尝试加载: ${entryPath}`);
        if (fs.existsSync(entryPath)) {
            require(entryPath);
            console.log(`成功加载: ${entryPath}`);
            loaded = true;
            break;
        }
    } catch (error) {
        console.error(`加载 ${entryPath} 失败:`, error.message);
    }
}

if (!loaded) {
    console.error('无法找到有效的入口文件，直接加载主进程');
    try {
        require('./electron/main');
    } catch (error) {
        console.error('加载主进程失败:', error.message);
        process.exit(1);
    }
} 