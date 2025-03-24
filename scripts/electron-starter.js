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

// 检查是否使用不压缩模式
const useUncompressedMode = process.env.GENERATE_SOURCEMAP === 'true';

// 启动React开发服务器
console.log(`启动React开发服务器${useUncompressedMode ? '(不压缩模式)' : ''}...`);
const reactProcess = spawn(getNpxCommand(), ['react-scripts', 'start'], {
    env: {
        ...process.env,
        HOST: '0.0.0.0',
        BROWSER: 'none',
        // 如果使用不压缩模式，设置相关环境变量
        ...(useUncompressedMode ? {
            GENERATE_SOURCEMAP: 'true',
            INLINE_RUNTIME_CHUNK: 'false',
            DISABLE_ESLINT_PLUGIN: 'true',
            REACT_APP_BABEL_DISABLE_CACHE: '1',
            BABEL_ENV: 'development',
            NODE_ENV: 'development',
            FAST_REFRESH: 'false', // 禁用快速刷新，有时会导致源码映射问题
        } : {})
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

// 增强清理函数
const cleanUp = () => {
    console.log('正在清理进程...');

    // 尝试优雅地终止进程
    const gracefulTerminate = (proc, name) => {
        if (proc && !proc.killed) {
            console.log(`正在终止 ${name} 进程...`);
            try {
                // 首先尝试发送终止信号
                proc.kill('SIGTERM');

                // 设置超时强制终止
                setTimeout(() => {
                    if (!proc.killed) {
                        console.log(`${name} 进程未响应，强制终止`);
                        proc.kill('SIGKILL');
                    }
                }, 3000);
            } catch (err) {
                console.error(`终止 ${name} 进程失败:`, err);
            }
        }
    };

    // 终止所有进程
    if (reactProcess) gracefulTerminate(reactProcess, 'React');
    if (backendProcess) gracefulTerminate(backendProcess, 'Backend');
    // 注意：此时electronProcess可能尚未定义，因此跳过

    // 释放端口
    try {
        const ports = [3000, 3001, 9000];
        console.log('释放被占用的端口...');

        ports.forEach(port => {
            const command = process.platform === 'win32'
                ? `taskkill /F /IM "node.exe" /FI "LocalPort eq ${port}"`
                : `lsof -ti:${port} | xargs -r kill -9`;

            try {
                require('child_process').execSync(command, { stdio: 'ignore' });
            } catch (e) {
                // 忽略错误，可能端口未被占用
            }
        });
    } catch (e) {
        console.error('释放端口时出错:', e);
    }

    // 确保完全退出
    console.log('清理完成，退出进程');
    process.exit(0);
};

// 监听更多退出信号
process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('SIGHUP', cleanUp);
process.on('exit', cleanUp);
process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    cleanUp();
}); 