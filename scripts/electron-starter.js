#!/usr/bin/env node

/**
 * 这个脚本用于开发环境中启动Electron应用
 * 它会先启动React开发服务器和后端服务器，然后启动Electron
 */

const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');
const os = require('os');

// 获取当前平台下的npx命令
const getNpxCommand = () => {
    return process.platform === 'win32' ? 'npx.cmd' : 'npx';
};

// 获取本机IP地址
const getLocalIpAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过非IPv4和内部地址
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

// 启动React开发服务器
console.log('启动React开发服务器...');
const reactProcess = spawn(getNpxCommand(), ['react-scripts', 'start'], {
    env: {
        ...process.env,
        HOST: '0.0.0.0',
        BROWSER: 'none'
    },
    stdio: 'inherit',
    shell: true
});

// 启动后端服务器
console.log('启动后端服务器...');
const backendProcess = spawn('node', ['server.js'], {
    env: {
        ...process.env,
        HOST: '0.0.0.0'
    },
    stdio: 'inherit',
    shell: true
});

// 等待服务启动
const ip = getLocalIpAddress();
const resources = [
    `http://${ip}:3000`, // React开发服务器
    `http://${ip}:3001/api/server-config` // 后端API服务器
];

console.log(`等待服务启动: ${resources.join(', ')}...`);

waitOn({
    resources,
    timeout: 30000, // 30秒超时
    interval: 1000, // 每1秒检查一次
    log: true
}).then(() => {
    console.log('服务已启动，正在启动Electron...');

    // 启动Electron
    const electronProcess = spawn(getNpxCommand(), ['electron', '.'], {
        env: {
            ...process.env,
            ELECTRON_START_URL: `http://${ip}:3000`,
            NODE_ENV: 'development'
        },
        stdio: 'inherit',
        shell: true
    });

    // 处理Electron进程退出
    electronProcess.on('close', (code) => {
        console.log(`Electron进程已退出，代码: ${code}`);
        // 终止其他进程
        reactProcess.kill();
        backendProcess.kill();
        process.exit(code);
    });
}).catch((error) => {
    console.error('等待服务启动时出错:', error);
    // 终止所有进程
    reactProcess.kill();
    backendProcess.kill();
    process.exit(1);
});

// 处理脚本终止
const cleanUp = () => {
    console.log('正在清理进程...');
    if (reactProcess) reactProcess.kill();
    if (backendProcess) backendProcess.kill();
};

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('exit', cleanUp); 