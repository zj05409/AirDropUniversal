const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PeerServer } = require('peer');
const os = require('os'); // 添加os模块用于获取网络接口

// 定义端口变量
const PORT = process.env.PORT || 3001;
const PEER_PORT = 9000;
const HOST = '0.0.0.0';

const app = express();

// 配置 CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(express.json());

// 创建 HTTP 服务器
const server = createServer(app);

// 获取服务器局域网 IP 地址的函数
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
    // 如果没有找到合适的IP地址，返回默认值
    return '127.0.0.1';
};

// API端点：获取服务器IP地址
app.get('/api/server-config', (req, res) => {
    try {
        const serverIp = getLocalIpAddress();
        console.log('服务器IP地址:', serverIp);
        res.json({
            ip: serverIp,
            port: PORT,
            peerPort: PEER_PORT
        });
    } catch (error) {
        console.error('获取服务器信息时出错:', error);
        res.status(500).json({ error: '获取服务器信息失败' });
    }
});

// 配置 Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// 创建独立的 PeerJS 服务器
const peerServer = PeerServer({
    port: PEER_PORT,
    path: '/peerjs',
    proxied: false,
    allow_discovery: true,
    debug: true,
    alive_timeout: 60000,
    key: 'peerjs',
    concurrent_limit: 5000,
    cleanup_out_msgs: 1000,
    host: '0.0.0.0'
});

peerServer.on('connection', (client) => {
    try {
        console.log('PeerJS 客户端连接:', client.getId ? client.getId() : 'unknown');
    } catch (error) {
        console.error('处理 PeerJS 连接时出错:', error);
    }
});

peerServer.on('disconnect', (client) => {
    try {
        console.log('PeerJS 客户端断开连接:', client.getId ? client.getId() : 'unknown');
    } catch (error) {
        console.error('处理 PeerJS 断开连接时出错:', error);
    }
});

peerServer.on('error', (error) => {
    console.error('PeerJS 服务器错误:', error);
});

// 存储连接的设备信息
const connectedUsers = new Map();

// 广播用户列表更新
const broadcastUserList = () => {
    try {
        const userList = Array.from(connectedUsers.values());
        io.emit('userList', userList);
        console.log('广播用户列表:', userList);
    } catch (error) {
        console.error('广播用户列表时出错:', error);
    }
};

// 处理 Socket.IO 连接
io.on('connection', (socket) => {
    console.log('新客户端连接:', socket.id);

    // 处理设备注册
    socket.on('register', (deviceInfo) => {
        try {
            console.log('设备注册:', deviceInfo);

            // 验证设备信息
            if (!deviceInfo.id || !deviceInfo.name || !deviceInfo.deviceType) {
                console.error('设备信息不完整:', deviceInfo);
                return;
            }

            // 更新设备信息
            connectedUsers.set(deviceInfo.id, {
                ...deviceInfo,
                socketId: socket.id,
                lastSeen: Date.now()
            });

            // 广播更新后的用户列表
            broadcastUserList();

            // 发送注册成功通知
            socket.emit('registered', deviceInfo);
        } catch (error) {
            console.error('处理设备注册时出错:', error);
        }
    });

    // 处理设备重连
    socket.on('reconnect', (deviceInfo) => {
        console.log('设备重连:', deviceInfo);

        // 检查是否存在旧连接
        const existingDevice = connectedUsers.get(deviceInfo.id);
        if (existingDevice) {
            console.log('发现旧连接，清理旧连接...');
            // 清理旧连接
            connectedUsers.delete(deviceInfo.id);
        }

        // 更新设备信息
        deviceInfo.socketId = socket.id;
        deviceInfo.lastSeen = new Date();
        connectedUsers.set(deviceInfo.id, deviceInfo);

        // 广播更新后的用户列表
        broadcastUserList();

        // 发送重连成功确认
        socket.emit('reconnected', deviceInfo);
    });

    // 处理 Peer ID 更新
    socket.on('updatePeerId', (data) => {
        console.log('收到 Peer ID 更新:', data);

        const device = connectedUsers.get(data.id);
        if (device) {
            // 检查是否存在使用相同 Peer ID 的其他设备
            const existingDevice = Array.from(connectedUsers.values())
                .find(d => d.peerId === data.peerId && d.id !== data.id);

            if (existingDevice) {
                console.log('发现 Peer ID 冲突，清理旧连接...');
                // 清理使用相同 Peer ID 的旧连接
                connectedUsers.delete(existingDevice.id);
            }

            // 更新当前设备的 Peer ID
            device.peerId = data.peerId;
            device.lastSeen = new Date();
            connectedUsers.set(data.id, device);

            // 广播更新后的用户列表
            broadcastUserList();

            // 发送更新确认
            socket.emit('peerIdUpdated', { id: data.id, peerId: data.peerId });
        }
    });

    // 处理客户端断开连接
    socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);
        // 清理断开连接的设备
        for (const [id, device] of connectedUsers.entries()) {
            if (device.socketId === socket.id) {
                connectedUsers.delete(id);
                break;
            }
        }
        broadcastUserList();
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('未处理的 Promise 拒绝:', error);
});

// 优雅退出处理
const cleanExit = () => {
    console.log('服务器正在关闭...');

    // 创建一个空的Promise数组来跟踪关闭操作
    const closePromises = [];

    // 关闭 Express 服务器
    if (server) {
        const expressPromise = new Promise((resolve) => {
            server.close(() => {
                console.log('Express 服务器已关闭');
                resolve();
            });
        });
        closePromises.push(expressPromise);
    }

    // 关闭 Socket.IO
    if (io) {
        const socketPromise = new Promise((resolve) => {
            io.close(() => {
                console.log('Socket.IO 已关闭');
                resolve();
            });
        });
        closePromises.push(socketPromise);
    }

    // 关闭 PeerJS 服务器 - 避免使用异常的close方法
    if (peerServer) {
        try {
            console.log('正在关闭 PeerJS 服务器...');
            // 不使用peerServer.close()，因为它可能不存在或不可靠

            // 如果peerServer有HTTP服务器属性，尝试关闭它
            if (peerServer._server && typeof peerServer._server.close === 'function') {
                const peerPromise = new Promise((resolve) => {
                    peerServer._server.close(() => {
                        console.log('PeerJS HTTP 服务器已关闭');
                        resolve();
                    });
                });
                closePromises.push(peerPromise);
            } else {
                console.log('PeerJS 服务器无法使用标准方法关闭，但将随进程终止');
            }

            // 移除所有事件监听器
            if (typeof peerServer.removeAllListeners === 'function') {
                peerServer.removeAllListeners();
                console.log('已移除 PeerJS 服务器的所有事件监听器');
            }
        } catch (error) {
            console.error('尝试关闭 PeerJS 服务器时出错:', error);
        }
    }

    // 等待所有关闭操作完成，或在超时后继续
    Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, 2000))  // 2秒超时
    ]).then(() => {
        console.log('所有服务已关闭或超时，退出进程');
        process.exit(0);
    });
};

// 注册退出事件处理程序
process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);

// 在 Electron 环境中运行时注册子进程
if (process.env.ELECTRON_RUN_AS_NODE || process.env.ELECTRON_START_URL) {
    try {
        const { app } = require('electron').remote;
        if (app && app.registerChildProcess) {
            app.registerChildProcess(process);
            console.log('已在 Electron 中注册服务器进程');
        }
    } catch (e) {
        // 忽略错误，可能不在 Electron 环境中
    }
}

// 启动服务器
server.listen(PORT, HOST, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
    console.log(`服务器运行在 http://${HOST}:${PORT}`);
    console.log(`本地网络地址: http://${getLocalIpAddress()}:${PORT}`);
}); 