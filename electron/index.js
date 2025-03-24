// 这个文件是Electron应用的入口点
// 它只是简单地加载主进程文件

const { app } = require('electron');
const path = require('path');

// 禁用硬件加速以解决某些显卡的渲染问题
app.disableHardwareAcceleration();

// 在Mac上注册为代理应用程序以接收文件拖放
if (process.platform === 'darwin') {
    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        // 存储文件路径以便稍后处理
        global.fileToOpen = filePath;
    });
}

// 加载主进程文件
require('./main'); 