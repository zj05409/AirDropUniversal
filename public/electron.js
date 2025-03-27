
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