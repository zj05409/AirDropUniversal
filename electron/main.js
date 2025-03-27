const { app, BrowserWindow, Menu, Tray, dialog, shell, ipcMain, clipboard } = require('electron');
const path = require('path');
// 移除对Splashscreen的依赖
// const Splashscreen = require('@trodi/electron-splashscreen');
const url = require('url');
const { spawn } = require('child_process');
const os = require('os');
const { networkInterfaces } = require('os');
const fs = require('fs');

// 定义全局变量
let mainWindow;
let tray = null;
let serverProcess = null;
let reactProcess = null;
let isQuitting = false;
let hasShownServerDialog = false; // 追踪服务器信息对话框是否已显示

// 获取本机IP地址
function getLocalIpAddress() {
    const interfaces = networkInterfaces();
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

// 获取临时目录路径
function getTempDir() {
    // 使用系统临时目录而不是应用内部目录
    return path.join(os.tmpdir(), 'airdrop-universal-temp');
}

// 确保临时目录存在
function ensureTempDir() {
    const tempDir = getTempDir();
    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    } catch (error) {
        console.error('创建临时目录失败:', error);
        // 返回系统临时目录作为备选
        return os.tmpdir();
    }
}

// 启动React开发服务器
function startReactServer() {
    if (process.env.ELECTRON_START_URL) {
        console.log('使用现有的React开发服务器:', process.env.ELECTRON_START_URL);
        return null;
    }

    console.log('启动React开发服务器...');

    // 设置环境变量
    const env = {
        ...process.env,
        HOST: '0.0.0.0',
        BROWSER: 'none',
        PORT: 3000
    };

    // 尝试停止可能已经运行的React服务
    try {
        if (process.platform !== 'win32') {
            console.log('尝试终止可能存在的React服务进程...');
            require('child_process').execSync('lsof -t -i:3000 | xargs -r kill -9', { stdio: 'ignore' });
        }
    } catch (error) {
        console.log('清理进程时出错，但将继续:', error.message);
    }

    // 启动React开发服务器
    const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    reactProcess = spawn(npxPath, ['react-scripts', 'start'], {
        env,
        stdio: 'pipe',
        shell: true
    });

    let isReactServerReady = false;

    reactProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`React输出: ${output}`);

        // 检查React服务器是否已启动
        if (output.includes('Compiled successfully') || output.includes('Compiled with warnings')) {
            console.log('React服务器已成功启动，加载应用...');
            isReactServerReady = true;

            if (mainWindow) {
                const localIp = getLocalIpAddress();
                const url = `http://${localIp}:3000`;
                console.log('加载URL:', url);

                // 添加短暂延迟确保服务器真的准备好了
                setTimeout(() => {
                    mainWindow.loadURL(url);
                }, 1000);
            }
        }
    });

    reactProcess.stderr.on('data', (data) => {
        console.error(`React错误: ${data}`);
    });

    reactProcess.on('close', (code) => {
        console.log(`React进程退出，代码: ${code}`);

        if (!isQuitting && !isReactServerReady) {
            console.log('React服务器未成功启动，尝试直接使用静态文件...');

            // 如果React服务未成功启动，尝试使用静态文件
            if (mainWindow) {
                const staticPath = url.format({
                    pathname: path.join(__dirname, '../build/index.html'),
                    protocol: 'file:',
                    slashes: true
                });

                console.log('加载静态文件:', staticPath);
                mainWindow.loadURL(staticPath);
            }
        }
    });

    // 设置超时，如果React服务器在一定时间内未启动，则尝试直接启动
    setTimeout(() => {
        if (!isReactServerReady && mainWindow) {
            console.log('React服务器启动超时，尝试直接访问...');
            const localIp = getLocalIpAddress();
            const directUrl = `http://${localIp}:3000`;
            mainWindow.loadURL(directUrl);
        }
    }, 30000); // 30秒超时

    return reactProcess;
}

// 启动Express服务器
function startServer() {
    const serverPath = path.join(__dirname, '..', 'server.js');
    console.log('启动服务器:', serverPath);

    // 设置环境变量以监听所有接口
    const env = { ...process.env, HOST: '0.0.0.0' };

    try {
        // 使用fork代替spawn来创建子进程，确保能访问node模块
        serverProcess = require('child_process').fork(serverPath, [], {
            env,
            stdio: 'pipe',
            // 确保不继承父进程的stdin/stdout
            silent: true,
            // 禁用沙盒环境，确保后端进程可以正常使用os模块等
            detached: true,
            windowsHide: true
        });

        serverProcess.stdout.on('data', (data) => {
            console.log(`服务器输出: ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`服务器错误: ${data}`);
        });

        serverProcess.on('close', (code) => {
            console.log(`服务器进程退出，代码: ${code}`);
            if (!isQuitting) {
                dialog.showErrorBox('服务器错误', `服务器意外退出，代码: ${code}`);
            }
        });

        return serverProcess;
    } catch (error) {
        console.error('启动服务器失败:', error);

        // 备用方案：在主进程中直接加载服务器模块
        try {
            console.log('尝试备用方案：在主进程中加载服务器模块');
            // 设置环境变量
            Object.keys(env).forEach(key => {
                process.env[key] = env[key];
            });

            // 直接在主进程中加载服务器模块
            console.log('直接加载服务器模块:', serverPath);
            require(serverPath);
            return null; // 没有子进程返回
        } catch (moduleError) {
            console.error('直接加载服务器模块失败:', moduleError);
            throw moduleError;
        }
    }
}

// 加载构建好的React应用
function loadBuildPath(window) {
    const buildPath = path.join(__dirname, '../build/index.html');
    console.log('加载构建路径:', buildPath);

    try {
        if (fs.existsSync(buildPath)) {
            window.loadFile(buildPath);
            console.log('成功加载构建文件');
            return true;
        } else {
            console.error('构建文件不存在:', buildPath);
            return false;
        }
    } catch (error) {
        console.error('加载构建文件失败:', error);
        return false;
    }
}

// 创建主窗口
function createWindow() {
    const mainWindowConfig = {
        width: 1024,
        height: 768,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // 允许加载本地资源
        },
        icon: path.join(__dirname, '../public/logo512.png')
    };

    const localIp = getLocalIpAddress();

    try {
        // 创建主窗口
        mainWindow = new BrowserWindow(mainWindowConfig);

        // 设置窗口标题
        mainWindow.setTitle(`AirDrop Universal`);

        // 显示超级简单的加载界面
        mainWindow.loadURL(`data:text/html;charset=utf-8,
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>AirDrop Universal</title>
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                            background-color: #000;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        
                        /* 背景图替代复杂的CSS和JavaScript生成的星空 */
                        .bg-image {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDYwMCI+CiAgICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMGIwYjJkIiAvPgogICAgPGRlZnM+CiAgICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPSJncmFkIiBjeD0iNTAlIiBjeT0iNTAlIiByPSI1MCUiIGZ4PSI1MCUiIGZ5PSI1MCUiPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDAxZTNjIiBzdG9wLW9wYWNpdHk9IjEiIC8+CiAgICAgICAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzBiMGIyZCIgc3RvcC1vcGFjaXR5PSIxIiAvPgogICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8L2RlZnM+CiAgICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyYWQpIiAvPgogICAgCiAgICA8IS0tIFN0YXJzIC0tPgogICAgPGNpcmNsZSBjeD0iMzAwIiBjeT0iMTUwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjgiIC8+CiAgICA8Y2lyY2xlIGN4PSI1MDAiIGN5PSIzMDAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgPGNpcmNsZSBjeD0iNzAwIiBjeT0iMjAwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiIC8+CiAgICA8Y2lyY2xlIGN4PSIyMDAiIGN5PSI0MDAiIHI9IjIiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuNiIgLz4KICAgIDxjaXJjbGUgY3g9IjgwMCIgY3k9IjM1MCIgcj0iMSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgPGNpcmNsZSBjeD0iMTUwIiBjeT0iMjUwIiByPSIxLjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOCIgLz4KICAgIDxjaXJjbGUgY3g9IjkwMCIgY3k9IjEwMCIgcj0iMiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC42IiAvPgogICAgPGNpcmNsZSBjeD0iNDUwIiBjeT0iNTAwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjciIC8+CiAgICA8Y2lyY2xlIGN4PSI2NTAiIGN5PSI0NTAiIHI9IjEuMiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44IiAvPgogICAgPGNpcmNsZSBjeD0iMzUwIiBjeT0iMzgwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiIC8+CiAgICA8Y2lyY2xlIGN4PSI4ODAiIGN5PSI1MjAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgCiAgICA8IS0tIEFwcCBUaXRsZSAtLT4KICAgIDx0ZXh0IHg9IjUwMCIgeT0iMTgwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ1cmwoI3RpdGxlLWdyYWQpIj5BaXJEcm9wIFVuaXZlcnNhbDwvdGV4dD4KICAgIDxkZWZzPgogICAgICAgIDxsaW5lYXJHcmFkaWVudCBpZD0idGl0bGUtZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzQ5OGRiIiAvPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzJlY2M3MSIgLz4KICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMzQ5OGRiIiAvPgogICAgICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8L2RlZnM+CiAgICAKICAgIDwhLS0gTG9hZGluZyBUZXh0IC0tPgogICAgPHJlY3QgeD0iMzcwIiB5PSIyODAiIHdpZHRoPSIyNjAiIGhlaWdodD0iNzAiIHJ4PSIzNSIgcnk9IjM1IiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuNSkiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpIiBzdHJva2Utd2lkdGg9IjIiIC8+CiAgICA8dGV4dCB4PSI1MDAiIHk9IjMzMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuWKoOi9veS4rS4uLjwvdGV4dD4KPC9zdmc+');
                            background-size: cover;
                            background-position: center;
                            z-index: 1;
                        }
                        
                        .content {
                            position: relative;
                            z-index: 2;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            text-align: center;
                        }
                        
                        .title {
                            font-family: Arial, sans-serif;
                            font-size: 60px;
                            font-weight: bold;
                            color: #fff;
                            margin-bottom: 40px;
                            text-shadow: 0 0 20px rgba(52, 152, 219, 0.8);
                        }
                        
                        .loading {
                            font-family: Arial, sans-serif;
                            font-size: 36px;
                            font-weight: bold;
                            color: #fff;
                            padding: 15px 40px;
                            background: rgba(0, 0, 0, 0.5);
                            border-radius: 50px;
                            border: 2px solid rgba(255, 255, 255, 0.2);
                            box-shadow: 0 0 20px rgba(52, 152, 219, 0.5);
                        }
                    </style>
                </head>
                <body>
                    <!-- 使用预先定义的SVG背景图代替动态生成的内容 -->
                    <div class="bg-image"></div>
                    
                    <!-- 简单的内容层，以防背景图加载失败 -->
                    <div class="content">
                        <div class="title">AirDrop Universal</div>
                        <div class="loading">加载中...</div>
                    </div>
                </body>
            </html>`);

        // 加载应用
        if (process.env.ELECTRON_START_URL) {
            // 开发模式：使用URL加载React开发服务器
            console.log('从开发服务器加载:', process.env.ELECTRON_START_URL);
            mainWindow.loadURL(process.env.ELECTRON_START_URL);
        } else {
            // 生产模式：优先使用production-starter.js
            try {
                console.log('尝试使用production-starter.js加载');
                require('./production-starter');
                const localIp = getLocalIpAddress();
                mainWindow.loadURL(`http://${localIp}:3000`);
            } catch (error) {
                console.error('使用production-starter.js失败，尝试直接加载构建文件:', error);
                if (!loadBuildPath(mainWindow)) {
                    // 尝试启动React开发服务器
                    reactProcess = startReactServer();
                }
            }
        }

        // 开发模式下打开开发者工具
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }

        // 当窗口关闭时，除非用户强制退出应用，否则只隐藏窗口
        mainWindow.on('close', (event) => {
            if (!isQuitting) {
                event.preventDefault();
                mainWindow.hide();
                return false;
            }
        });

        // 窗口完全关闭时清空引用
        mainWindow.on('closed', () => {
            mainWindow = null;
        });

        // 监听加载失败事件
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error(`加载失败: ${errorDescription} (${errorCode})`);

            // 如果是由于React服务器尚未准备好，加载简单的等待页面
            if (errorCode === -102 && !process.env.ELECTRON_START_URL) {
                console.log('等待React服务器启动...');

                mainWindow.loadURL(`data:text/html;charset=utf-8,
                <html>
                    <head>
                        <meta charset="utf-8">
                        <title>AirDrop Universal</title>
                        <style>
                            html, body {
                                margin: 0;
                                padding: 0;
                                width: 100%;
                                height: 100%;
                                overflow: hidden;
                                background-color: #000;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                            }
                            
                            /* 背景图替代复杂的CSS和JavaScript生成的星空 */
                            .bg-image {
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDYwMCI+CiAgICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMGIwYjJkIiAvPgogICAgPGRlZnM+CiAgICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPSJncmFkIiBjeD0iNTAlIiBjeT0iNTAlIiByPSI1MCUiIGZ4PSI1MCUiIGZ5PSI1MCUiPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDAxZTNjIiBzdG9wLW9wYWNpdHk9IjEiIC8+CiAgICAgICAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzBiMGIyZCIgc3RvcC1vcGFjaXR5PSIxIiAvPgogICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8L2RlZnM+CiAgICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyYWQpIiAvPgogICAgCiAgICA8IS0tIFN0YXJzIC0tPgogICAgPGNpcmNsZSBjeD0iMzAwIiBjeT0iMTUwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjgiIC8+CiAgICA8Y2lyY2xlIGN4PSI1MDAiIGN5PSIzMDAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgPGNpcmNsZSBjeD0iNzAwIiBjeT0iMjAwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiIC8+CiAgICA8Y2lyY2xlIGN4PSIyMDAiIGN5PSI0MDAiIHI9IjIiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuNiIgLz4KICAgIDxjaXJjbGUgY3g9IjgwMCIgY3k9IjM1MCIgcj0iMSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgPGNpcmNsZSBjeD0iMTUwIiBjeT0iMjUwIiByPSIxLjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOCIgLz4KICAgIDxjaXJjbGUgY3g9IjkwMCIgY3k9IjEwMCIgcj0iMiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC42IiAvPgogICAgPGNpcmNsZSBjeD0iNDUwIiBjeT0iNTAwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjciIC8+CiAgICA8Y2lyY2xlIGN4PSI2NTAiIGN5PSI0NTAiIHI9IjEuMiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44IiAvPgogICAgPGNpcmNsZSBjeD0iMzUwIiBjeT0iMzgwIiByPSIxIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiIC8+CiAgICA8Y2lyY2xlIGN4PSI4ODAiIGN5PSI1MjAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC43IiAvPgogICAgCiAgICA8IS0tIEFwcCBUaXRsZSAtLT4KICAgIDx0ZXh0IHg9IjUwMCIgeT0iMTgwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ1cmwoI3RpdGxlLWdyYWQpIj5BaXJEcm9wIFVuaXZlcnNhbDwvdGV4dD4KICAgIDxkZWZzPgogICAgICAgIDxsaW5lYXJHcmFkaWVudCBpZD0idGl0bGUtZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzQ5OGRiIiAvPgogICAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzJlY2M3MSIgLz4KICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMzQ5OGRiIiAvPgogICAgICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8L2RlZnM+CiAgICAKICAgIDwhLS0gTG9hZGluZyBUZXh0IC0tPgogICAgPHJlY3QgeD0iMzcwIiB5PSIyODAiIHdpZHRoPSIyNjAiIGhlaWdodD0iNzAiIHJ4PSIzNSIgcnk9IjM1IiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuNSkiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpIiBzdHJva2Utd2lkdGg9IjIiIC8+CiAgICA8dGV4dCB4PSI1MDAiIHk9IjMzMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuWKoOi9veS4rS4uLjwvdGV4dD4KPC9zdmc+');
                                background-size: cover;
                                background-position: center;
                                z-index: 1;
                            }
                            
                            .content {
                                position: relative;
                                z-index: 2;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                text-align: center;
                            }
                            
                            .title {
                                font-family: Arial, sans-serif;
                                font-size: 60px;
                                font-weight: bold;
                                color: #fff;
                                margin-bottom: 40px;
                                text-shadow: 0 0 20px rgba(52, 152, 219, 0.8);
                            }
                            
                            .loading {
                                font-family: Arial, sans-serif;
                                font-size: 36px;
                                font-weight: bold;
                                color: #fff;
                                padding: 15px 40px;
                                background: rgba(0, 0, 0, 0.5);
                                border-radius: 50px;
                                border: 2px solid rgba(255, 255, 255, 0.2);
                                box-shadow: 0 0 20px rgba(52, 152, 219, 0.5);
                            }
                        </style>
                    </head>
                    <body>
                        <!-- 使用预先定义的SVG背景图代替动态生成的内容 -->
                        <div class="bg-image"></div>
                        
                        <!-- 简单的内容层，以防背景图加载失败 -->
                        <div class="content">
                            <div class="title">AirDrop Universal</div>
                            <div class="loading">加载中...</div>
                        </div>
                    </body>
                </html>`);

                return;
            }

            // 其他错误，尝试重新加载
            setTimeout(() => {
                console.log('尝试重新加载...');
                if (mainWindow) {
                    const localIp = getLocalIpAddress();
                    mainWindow.loadURL(`http://${localIp}:3000`);
                }
            }, 3000);
        });

        // 创建系统托盘图标
        createTray();

        // 设置React成功加载后的事件
        mainWindow.webContents.on('did-navigate', () => {
            showServerInfoDialog();
        });

    } catch (error) {
        console.error('创建窗口时出错:', error);

        // 如果窗口创建失败，使用简单配置重新创建
        try {
            if (!mainWindow) {
                console.log('尝试以简单配置重新创建窗口...');
                mainWindow = new BrowserWindow({
                    width: 800,
                    height: 600,
                    show: true
                });

                mainWindow.loadURL(`data:text/html,
                <html>
                    <body style="font-family: sans-serif; padding: 20px; background: #2c3e50; color: white; text-align: center;">
                        <h1 style="font-size: 36px; margin-top: 100px;">AirDrop Universal</h1>
                        <p style="font-size: 24px; margin: 30px 0;">加载中...</p>
                    </body>
                </html>`);
            }
        } catch (fallbackError) {
            console.error('备用窗口创建也失败:', fallbackError);
        }
    }
}

// 创建系统托盘图标
function createTray() {
    try {
        // 检查图标文件是否存在
        const iconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
        const defaultIconPath = path.join(__dirname, '..', 'electron', 'default-icon.png');

        let trayIconPath;
        if (require('fs').existsSync(iconPath)) {
            trayIconPath = iconPath;
        } else {
            console.warn('找不到图标文件，使用默认图标');
            // 创建一个默认图标文件
            const { nativeImage } = require('electron');
            const icon = nativeImage.createEmpty();
            trayIconPath = defaultIconPath;
        }

        tray = new Tray(trayIconPath);

        const localIp = getLocalIpAddress();
        const contextMenu = Menu.buildFromTemplate([
            {
                label: `AirDrop Universal - ${localIp}`,
                enabled: false
            },
            { type: 'separator' },
            {
                label: '显示应用',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                    }
                }
            },
            {
                label: '复制Web地址',
                click: () => {
                    const address = `http://${localIp}:3000`;
                    clipboard.writeText(address);
                }
            },
            {
                label: '在浏览器中打开',
                click: () => {
                    const address = `http://${localIp}:3000`;
                    shell.openExternal(address);
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('AirDrop Universal');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
            }
        });
    } catch (error) {
        console.error('创建系统托盘图标失败:', error);
        // 即使托盘创建失败，应用也应该继续运行
    }
}

// 设置IPC处理程序
function setupIPC() {
    // 复制到剪贴板
    ipcMain.handle('copy-to-clipboard', (event, text) => {
        clipboard.writeText(text);
        return true;
    });

    // 打开外部链接
    ipcMain.handle('open-external', (event, url) => {
        shell.openExternal(url);
        return true;
    });
}

// 显示服务器信息对话框，确保只显示一次
function showServerInfoDialog() {
    if (hasShownServerDialog || !mainWindow) {
        return; // 如果已经显示过或窗口不存在，则不再显示
    }

    const localIp = getLocalIpAddress();
    const serverInfoMessage = `
AirDrop Universal 服务器正在运行:

Web界面: http://${localIp}:3000
API服务: http://${localIp}:3001
PeerJS服务: http://${localIp}:9000

其他设备可通过上述地址连接到此服务。
`;

    // 标记为已显示
    hasShownServerDialog = true;

    // 显示对话框
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '服务器信息',
        message: '服务器已启动',
        detail: serverInfoMessage,
        buttons: ['确定']
    }).catch(err => console.error('显示服务器信息对话框失败:', err));
}

// 当Electron完成初始化时，创建窗口
app.whenReady().then(() => {
    try {
        console.log('Electron应用启动中...');

        // 设置IPC处理程序
        setupIPC();

        // 先创建窗口，显示加载界面，确保用户能看到
        createWindow();

        // 检查是否为开发环境
        const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_START_URL;
        if (!isDev) {
            // 生产环境：启动生产启动器脚本，它包含静态Web服务和后端API服务
            try {
                console.log('生产环境：启动生产服务...');
                require('./production-starter');
            } catch (err) {
                console.error('启动生产服务失败:', err);
                // 如果生产启动器失败，回退到直接启动后端服务
                startServer();
            }
        } else {
            // 开发环境：直接启动后端服务，前端由外部React开发服务器提供
            console.log('开发环境：启动后端服务...');
            startServer();
        }

        // 强制延迟较短时间后加载页面，确保界面能先显示出来
        setTimeout(() => {
            if (mainWindow) {
                // 生产环境中使用构建后的静态文件
                const staticPath = url.format({
                    pathname: path.join(__dirname, '../build/index.html'),
                    protocol: 'file:',
                    slashes: true
                });

                // 如果是开发环境，则可以加载本地React开发服务器
                // 但在打包后的应用中，我们使用静态文件
                const startUrl = process.env.ELECTRON_START_URL ||
                    (isDev ? `http://${getLocalIpAddress()}:3000` : `http://${getLocalIpAddress()}:3000`);

                console.log('加载页面:', startUrl);
                mainWindow.loadURL(startUrl);

                // 显示服务器信息对话框
                setTimeout(() => {
                    showServerInfoDialog();
                }, 3000);
            }
        }, 1000);

        app.on('activate', () => {
            // 在macOS上，当点击dock图标并且没有其他窗口打开时，
            // 通常在应用程序中重新创建一个窗口。
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else if (mainWindow) {
                mainWindow.show();
            }
        });
    } catch (error) {
        console.error('应用启动错误:', error);
    }
});

// 在所有窗口关闭时退出，除了macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 添加禁用硬件加速的选项，解决某些系统上的图形问题
app.disableHardwareAcceleration();

// 设置应用不是默认协议客户端
app.setAsDefaultProtocolClient('airdrop-universal');

// 在应用退出前清理资源
app.on('before-quit', () => {
    isQuitting = true;

    // 终止React服务器进程
    if (reactProcess) {
        console.log('终止React服务器进程...');
        reactProcess.kill();
    }

    // 终止服务器进程
    if (serverProcess) {
        console.log('终止服务器进程...');
        try {
            // 在Windows上，detached进程需要特殊处理才能正确终止
            if (process.platform === 'win32') {
                require('child_process').exec(`taskkill /pid ${serverProcess.pid} /f /t`);
            } else {
                // 在Unix系统上，可以使用进程组ID来终止整个进程组
                process.kill(-serverProcess.pid, 'SIGKILL');
            }
        } catch (error) {
            console.error('终止服务器进程出错:', error);
            serverProcess.kill();
        }
    }
});

// 确保应用退出时清理所有子进程
let childProcesses = [];

// 注册子进程，以便应用退出时可以终止它们
app.registerChildProcess = (process) => {
    if (process && process.pid) {
        console.log(`注册子进程: ${process.pid}`);
        childProcesses.push(process);
    }
};

// 优雅退出，确保杀死所有子进程
const cleanExit = () => {
    console.log('应用正在退出，清理资源...');

    // 终止所有子进程
    childProcesses.forEach(proc => {
        if (proc && proc.pid) {
            console.log(`终止子进程: ${proc.pid}`);
            try {
                process.kill(proc.pid);
            } catch (e) {
                console.error(`终止进程 ${proc.pid} 失败:`, e);
            }
        }
    });

    // 释放端口
    const ports = [3000, 3001, 9000];
    ports.forEach(port => {
        const command = process.platform === 'win32'
            ? `taskkill /F /IM "node.exe" /FI "LocalPort eq ${port}"`
            : `lsof -ti:${port} | xargs -r kill -9`;

        try {
            require('child_process').execSync(command, { stdio: 'ignore' });
            console.log(`已释放端口 ${port}`);
        } catch (e) {
            // 忽略错误，可能端口未被占用
        }
    });

    // 最后退出
    app.quit();
    process.exit(0);
};

// 监听所有退出事件
app.on('will-quit', cleanExit);
process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit); 