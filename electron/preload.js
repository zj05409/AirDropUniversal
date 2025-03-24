const { contextBridge, ipcRenderer } = require('electron');
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

// 安全地将API暴露给渲染进程
contextBridge.exposeInMainWorld('electron', {
    // 系统信息
    getLocalIpAddress: () => getLocalIpAddress(),
    getPlatform: () => process.platform,

    // 发送消息到主进程
    sendMessage: (channel, data) => {
        // 白名单通道
        const validChannels = ['copy-to-clipboard', 'open-external', 'show-notification'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    // 从主进程接收消息
    onMessage: (channel, callback) => {
        // 白名单通道
        const validChannels = ['server-info', 'connection-status'];
        if (validChannels.includes(channel)) {
            // 删除旧的监听器以避免重复
            ipcRenderer.removeAllListeners(channel);
            // 添加新的监听器
            ipcRenderer.on(channel, (_, ...args) => callback(...args));
            // 返回一个清理函数
            return () => {
                ipcRenderer.removeAllListeners(channel);
            };
        }
    },

    // 从主进程请求数据并返回一个Promise
    invoke: async (channel, data) => {
        // 白名单通道
        const validChannels = ['get-server-info', 'get-version', 'get-path', 'show-dialog'];
        if (validChannels.includes(channel)) {
            return await ipcRenderer.invoke(channel, data);
        }
        return null;
    }
});

// 为web应用提供配置信息
contextBridge.exposeInMainWorld('appConfig', {
    isElectron: true,
    serverPort: 3001,
    peerPort: 9000,
    serverIp: getLocalIpAddress(),
    version: process.env.npm_package_version || '1.0.0'
});
