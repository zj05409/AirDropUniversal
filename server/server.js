const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PeerServer } = require('peer');
const os = require('os');

// 获取本机IP地址
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部IP和非IPv4地址
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // 如果找不到有效IP，返回localhost
};

const localIP = getLocalIP();
console.log('服务器IP地址:', localIP);

const app = express();

// 配置 CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(express.json());

// 添加健康检查端点
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connectedUsers: Array.from(connectedUsers.values()).map(user => ({
            id: user.id,
            name: user.name,
            deviceType: user.deviceType,
            online: user.online
        }))
    });
});

// 添加一个简单的HTML页面，方便手机直接连接测试
app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AirDrop Universal - 服务器连接页</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 16px; }
                h1 { color: #333; }
                .card { background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
                .button { background: #0284c7; color: white; border: none; padding: 10px 16px; 
                          border-radius: 4px; cursor: pointer; font-size: 14px; }
                .button:hover { background: #0369a1; }
                .info { font-size: 14px; margin: 8px 0; }
                .code { background: #e5e5e5; padding: 8px; border-radius: 4px; font-family: monospace; }
                .form-group { margin-bottom: 10px; }
                .form-control { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>AirDrop Universal</h1>
            <div class="card">
                <h2>服务器状态: 运行中</h2>
                <p class="info">当前IP地址: <span id="serverIp"></span></p>
                <p class="info">用户可通过以下方式连接：</p>
                <div class="code" id="serverUrl"></div>
            </div>
            
            <div class="card">
                <h2>快速连接</h2>
                <p>点击下方按钮直接在浏览器中访问应用：</p>
                <a id="openAppButton" class="button">打开Web应用</a>
            </div>
            
            <div class="card">
                <h2>手动连接</h2>
                <p>如果扫码连接失败，可以输入设备ID手动连接：</p>
                <div>
                    <div class="form-group">
                        <input type="text" id="deviceIdInput" placeholder="输入要连接的设备ID" class="form-control">
                    </div>
                    <button onclick="connectToDevice()" class="button">连接设备</button>
                </div>
                <script>
                    function connectToDevice() {
                        const deviceId = document.getElementById('deviceIdInput').value.trim();
                        if (!deviceId) {
                            alert('请输入设备ID');
                            return;
                        }
                        const url = "http://" + serverIp + ":3000?connect=" + deviceId + "&auto=true";
                        window.location.href = url;
                    }
                </script>
            </div>
            
            <div class="card">
                <h2>已连接设备 (<span id="userCount">0</span>)</h2>
                <div id="userList">加载中...</div>
                <div id="deviceConnections" class="mt-3"></div>
            </div>
            
            <script>
                // 定义服务器IP地址变量
                const serverIp = "${localIP}";
                
                // 设置HTML中的IP地址和URL
                document.getElementById('serverIp').textContent = serverIp;
                document.getElementById('serverUrl').textContent = "http://" + serverIp + ":3000";
                document.getElementById('openAppButton').href = "http://" + serverIp + ":3000";
                
                // 定期检查已连接用户
                function updateUserList() {
                    fetch('/health')
                        .then(response => response.json())
                        .then(data => {
                            const users = data.connectedUsers || [];
                            document.getElementById('userCount').textContent = users.length;
                            
                            if (users.length === 0) {
                                document.getElementById('userList').innerHTML = '<p>暂无连接的设备</p>';
                                document.getElementById('deviceConnections').innerHTML = '';
                                return;
                            }
                            
                            let html = '<ul>';
                            let connectButtons = '';
                            
                            users.forEach(user => {
                                const statusColor = user.online ? 'green' : 'red';
                                const statusText = user.online ? '在线' : '离线';
                                const deviceInfo = user.name + ' (' + user.deviceType + ')';
                                html += '<li>' + deviceInfo + ' - <span style="color:' + statusColor + '">' + statusText + '</span>';
                                
                                // 只为在线设备显示ID
                                if (user.online) {
                                    html += ' - ID: <span class="code" style="font-size:0.8em">' + user.id + '</span></li>';
                                    
                                    // 为每个在线设备添加连接按钮
                                    connectButtons += 
                                        '<div style="margin:5px 0">' +
                                        '<button onclick="window.location.href=\'http://' + serverIp + ':3000?connect=' + user.id + '&auto=true\'" ' +
                                        'style="background:#0284c7; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:12px;">' +
                                        '连接到 ' + deviceInfo +
                                        '</button>' +
                                        '</div>';
                                } else {
                                    html += '</li>';
                                }
                            });
                            html += '</ul>';
                            document.getElementById('userList').innerHTML = html;
                            
                            if (connectButtons) {
                                document.getElementById('deviceConnections').innerHTML = 
                                    '<p style="margin-top:10px; font-weight:bold">快速连接:</p>' + connectButtons;
                            }
                        })
                        .catch(err => {
                            document.getElementById('userList').innerHTML = '<p>获取设备列表失败</p>';
                            console.error('获取设备列表失败:', err);
                        });
                }
                
                // 立即执行一次，然后每5秒更新一次
                updateUserList();
                setInterval(updateUserList, 5000);
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// 提供服务器配置接口
app.get('/api/server-config', (req, res) => {
    res.json({
        socketServer: `http://${localIP}:3001`,
        peerServer: {
            host: localIP,
            port: 9000,
            path: '/peerjs',
            secure: false
        }
    });
});

// 创建 HTTP 服务器
const server = createServer(app);

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
    port: 9000,
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

// 保存连接的用户信息
const connectedUsers = new Map();
// Socket ID到设备ID的映射
const socketToDeviceMap = new Map();

// 广播用户列表
const broadcastUserList = () => {
    const userList = Array.from(connectedUsers.values()).map(user => ({
        id: user.id,
        name: user.name,
        deviceType: user.deviceType,
        online: user.online,
        socketId: user.socketId,
        peerId: user.peerId,
        lastSeen: user.lastSeen
    }));
    console.log('广播用户列表详情:', userList);
    io.emit('userList', userList);
};

// 设备登录
io.on('connection', (socket) => {
    console.log('新客户端连接:', socket.id);

    // 处理断开连接
    socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);

        // 通过Socket ID查找设备ID
        const deviceId = socketToDeviceMap.get(socket.id);
        if (deviceId) {
            console.log('找到对应的设备ID:', deviceId);
            // 找到设备后，标记为离线但不立即删除
            const deviceInfo = connectedUsers.get(deviceId);
            if (deviceInfo) {
                deviceInfo.online = false;
                deviceInfo.lastSeen = Date.now();
                // 从Socket到设备映射中删除此Socket
                socketToDeviceMap.delete(socket.id);

                // 广播更新后的用户列表
                broadcastUserList();

                // 设置一个定时器，如果设备在一定时间内没有重新连接，则彻底删除
                setTimeout(() => {
                    const currentDeviceInfo = connectedUsers.get(deviceId);
                    // 如果设备仍然存在且仍处于离线状态
                    if (currentDeviceInfo && !currentDeviceInfo.online) {
                        // 检查上次见到的时间
                        const timeSinceLastSeen = Date.now() - currentDeviceInfo.lastSeen;
                        if (timeSinceLastSeen > 5 * 60 * 1000) { // 5分钟
                            console.log('设备未重连，彻底删除:', deviceId);
                            connectedUsers.delete(deviceId);
                            broadcastUserList();
                        }
                    }
                }, 5 * 60 * 1000); // 5分钟后检查
            }
        } else {
            console.log('未找到对应的设备ID');
            broadcastUserList();
        }
    });

    // 注册设备
    socket.on('registerDevice', (deviceInfo) => {
        console.log('设备注册:', deviceInfo);

        // 添加在线状态和最后见到时间
        deviceInfo.online = true;
        deviceInfo.lastSeen = Date.now();

        // 保存设备信息
        connectedUsers.set(deviceInfo.id, deviceInfo);

        // 维护Socket ID到设备ID的映射
        socketToDeviceMap.set(socket.id, deviceInfo.id);

        // 回复注册成功
        socket.emit('registered', { success: true, message: '设备注册成功' });

        // 广播用户列表更新
        broadcastUserList();
    });

    // 设备重连
    socket.on('reconnectDevice', (deviceInfo) => {
        console.log('设备重连:', deviceInfo);

        // 检查是否已存在此设备
        const existingDevice = connectedUsers.get(deviceInfo.id);
        if (existingDevice) {
            console.log('发现已注册设备，更新连接信息...');

            // 清除旧的Socket映射
            if (existingDevice.socketId && existingDevice.socketId !== deviceInfo.socketId) {
                console.log('清除旧的Socket映射:', existingDevice.socketId);
                socketToDeviceMap.delete(existingDevice.socketId);
            }

            // 更新设备信息，保留设备ID和其他信息
            const updatedDevice = {
                ...existingDevice,            // 保留原有信息
                ...deviceInfo,                // 更新新的信息
                online: true,                 // 确保标记为在线
                socketId: deviceInfo.socketId, // 更新Socket ID
                lastSeen: Date.now()          // 更新最后活跃时间
            };

            // 保存更新后的设备信息
            connectedUsers.set(deviceInfo.id, updatedDevice);

            // 更新Socket到设备的映射
            socketToDeviceMap.set(socket.id, deviceInfo.id);

            console.log('设备信息已更新:', updatedDevice);
        } else {
            console.log('未找到设备，进行新注册');
            // 添加在线状态和最后见到时间
            deviceInfo.online = true;
            deviceInfo.lastSeen = Date.now();

            // 保存设备信息
            connectedUsers.set(deviceInfo.id, deviceInfo);

            // 维护Socket ID到设备ID的映射
            socketToDeviceMap.set(socket.id, deviceInfo.id);
        }

        // 回复重连成功
        socket.emit('reconnected', {
            success: true,
            message: '设备重连成功',
            device: connectedUsers.get(deviceInfo.id)
        });

        // 广播用户列表更新
        broadcastUserList();
    });

    // 更新 Peer ID
    socket.on('updatePeerId', (data) => {
        console.log('更新Peer ID:', data);
        const { id, peerId } = data;

        // 检查设备是否存在
        const deviceInfo = connectedUsers.get(id);
        if (deviceInfo) {
            // 更新 Peer ID
            deviceInfo.peerId = peerId;
            deviceInfo.lastSeen = Date.now();

            // 广播更新
            io.emit('peerIdUpdated', { id, peerId });
            broadcastUserList();
        } else {
            console.log('找不到设备，无法更新 Peer ID');
        }
    });

    // 更新设备名称
    socket.on('updateDeviceName', (data) => {
        console.log('更新设备名称:', data);
        const { id, name } = data;

        // 检查设备是否存在
        const deviceInfo = connectedUsers.get(id);
        if (deviceInfo) {
            // 更新设备名称
            deviceInfo.name = name;
            deviceInfo.lastSeen = Date.now();

            // 广播更新
            io.emit('deviceNameUpdated', { id, name });
            broadcastUserList();

            console.log('设备名称已更新:', deviceInfo);
        } else {
            console.log('找不到设备，无法更新设备名称');
        }
    });

    // 发送当前用户列表
    broadcastUserList();
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('未处理的 Promise 拒绝:', error);
});

// 启动服务器
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
    console.log(`服务器运行在 http://${localIP}:${PORT}`);
    console.log(`服务器配置接口: http://${localIP}:${PORT}/api/server-config`);
}); 