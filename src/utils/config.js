/**
 * 应用的全局配置
 */

// 服务器地址配置
export const getServerUrl = () => {
    // 使用固定的服务器地址
    return 'http://192.168.31.149:3001';
};

// PeerJS 服务器配置
export const PEER_SERVER_CONFIG = {
    host: '192.168.31.149',
    port: 9000,
    path: '/peerjs',
    secure: false,
    debug: 3,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

// Socket.IO 配置
export const SOCKET_CONFIG = {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
};

// 文件传输配置
export const TRANSFER_CONFIG = {
    CHUNK_SIZE: 65536, // 64KB
    CHUNK_TIMEOUT: 5000, // 5秒超时
    MAX_RETRIES: 3, // 最大重试次数
    MAX_FILE_SIZE: 100 * 1024 * 1024 // 100MB
};

// 连接状态
export const CONNECTION_STATES = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

// 传输状态
export const TRANSFER_STATES = {
    IDLE: '',
    CONNECTING: 'connecting',
    PREPARING: 'preparing',
    RECEIVING: '接收中',
    SENDING: '发送中',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// 设备类型
export const DEVICE_TYPES = {
    PHONE: 'phone',
    TABLET: 'tablet',
    LAPTOP: 'laptop',
    DESKTOP: 'desktop'
}; 