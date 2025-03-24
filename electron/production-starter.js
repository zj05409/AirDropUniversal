/**
 * 这个脚本用于生产环境中启动Electron应用
 * 它会启动一个Express静态服务器来提供前端文件，并启动后端服务
 */

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { fork, execPath } = require('child_process');
const os = require('os');

// 获取本机IP地址
function getLocalIpAddress() {
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
}

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 服务静态文件
app.use(express.static(path.join(__dirname, '../build')));

// 所有其他请求返回index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// 创建HTTP服务器
const server = createServer(app);

// 启动静态Web服务器
server.listen(PORT, HOST, () => {
    const localIp = getLocalIpAddress();
    console.log(`前端服务运行在 http://${localIp}:${PORT}`);
});

// 启动后端服务
function startBackendServer() {
    const serverPath = path.join(__dirname, '..', 'server.js');
    console.log('启动后端服务器:', serverPath);

    // 使用NODE_ENV=production环境变量
    const env = {
        ...process.env,
        HOST: '0.0.0.0',
        NODE_ENV: 'production'
    };

    console.log('使用Electron内置Node运行时启动后端服务');

    // 使用Electron内置的Node.js运行时
    // 获取当前Electron应用的可执行路径作为Node运行时
    const electronPath = process.execPath;
    const appPath = path.dirname(electronPath);

    console.log('Electron应用路径:', appPath);
    console.log('服务器脚本路径:', serverPath);

    try {
        // 直接在当前进程中加载后端服务代码
        console.log('直接加载后端服务模块');

        // 创建后端服务进程，使用fork而不是spawn
        // fork会自动使用当前Node.js环境
        const serverProcess = fork(serverPath, [], {
            env,
            stdio: 'pipe',
            // 确保不继承父进程的stdin/stdout
            silent: true
        });

        // 监听服务输出
        serverProcess.stdout.on('data', (data) => {
            console.log(`后端服务输出: ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`后端服务错误: ${data}`);
        });

        // 监听进程退出
        serverProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`后端服务异常退出，代码: ${code}`);
                // 如果是非正常退出且应用仍在运行，尝试重启
                if (!global.isAppQuitting) {
                    console.log('尝试重启后端服务...');
                    setTimeout(startBackendServer, 1000);
                }
            } else {
                console.log('后端服务正常退出');
            }
        });

        return serverProcess;
    } catch (error) {
        console.error('启动后端服务失败:', error);

        // 备用方式：尝试直接在当前进程中加载后端模块
        try {
            console.log('尝试备用方式：直接在当前进程中加载后端模块');
            // 设置环境变量
            Object.keys(env).forEach(key => {
                process.env[key] = env[key];
            });

            // 直接加载模块
            console.log('直接加载模块:', serverPath);
            require(serverPath);
            console.log('后端服务加载成功');
            return null; // 没有子进程返回
        } catch (moduleError) {
            console.error('直接加载后端模块失败:', moduleError);
            throw moduleError;
        }
    }
}

// 启动后端服务
let backendProcess = null;
try {
    backendProcess = startBackendServer();
} catch (error) {
    console.error('启动后端服务失败:', error);
}

// 处理应用退出
process.on('exit', () => {
    global.isAppQuitting = true;
    if (backendProcess) {
        console.log('终止后端服务...');
        backendProcess.kill();
    }
    if (server) {
        console.log('终止Web服务器...');
        server.close();
    }
});

// 处理信号
process.on('SIGINT', () => {
    global.isAppQuitting = true;
    process.exit(0);
});

process.on('SIGTERM', () => {
    global.isAppQuitting = true;
    process.exit(0);
}); 