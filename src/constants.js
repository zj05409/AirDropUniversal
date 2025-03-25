/**
 * 文件传输状态常量
 */
export const TRANSFER_STATES = {
    IDLE: '空闲',
    CONNECTING: '正在连接',
    WAITING: '等待连接',
    SENDING: '发送中',
    RECEIVING: '接收中',
    COMPLETED: '已完成',
    ERROR: '错误'
};

/**
 * 连接状态常量
 */
export const CONNECTION_STATES = {
    DISCONNECTED: '未连接',
    CONNECTING: '正在连接',
    CONNECTED: '已连接',
    ERROR: '连接错误'
};

/**
 * 传输配置常量
 */
export const TRANSFER_CONFIG = {
    CHUNK_SIZE: 65536, // 64KB
    RECONNECT_TIMEOUT: 30000, // 30秒
    CONNECTION_CHECK_INTERVAL: 5000, // 5秒检查一次连接状态
    CHUNK_TIMEOUT: 30000, // 增加到30秒
    MAX_RECONNECT_ATTEMPTS: 5 // 最大重连次数
}; 