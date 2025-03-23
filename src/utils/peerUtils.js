/**
 * PeerJS 工具函数
 */

/**
 * 生成有效的 PeerJS ID (只包含字母数字)
 * @param {number} length ID 长度，默认为 16
 * @returns {string} 生成的随机 ID
 */
export const generateValidPeerId = (length = 16) => {
    // 生成包含字母和数字的随机字符串
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * 将错误类型转换为用户友好的错误消息
 * @param {Error} error PeerJS 错误对象
 * @returns {string} 用户友好的错误消息
 */
export const getPeerErrorMessage = (error) => {
    if (!error) return '未知错误';

    // 根据 PeerJS 错误类型返回友好的错误消息
    switch (error.type) {
        case 'peer-unavailable':
            return '目标设备不在线或无法连接';
        case 'network':
            return '网络连接错误，请检查网络设置';
        case 'server-error':
            return 'PeerJS 服务器错误，请稍后重试';
        case 'socket-error':
            return 'WebSocket 连接错误，请检查网络';
        case 'unavailable-id':
            return 'Peer ID 已被使用，请刷新页面重试';
        case 'connection-failed':
            return '连接失败，请检查目标设备是否在线';
        case 'invalid-id':
            return '无效的 Peer ID 格式';
        case 'invalid-key':
            return '无效的 API 密钥';
        case 'browser-incompatible':
            return '您的浏览器不支持 WebRTC';
        default:
            return error.message || '连接错误，请重试';
    }
};

/**
 * 验证 Peer ID 的有效性
 * @param {string} peerId 要验证的 Peer ID
 * @returns {boolean} 是否有效
 */
export const isValidPeerId = (peerId) => {
    if (!peerId || typeof peerId !== 'string') return false;

    // Peer ID 应该只包含字母和数字
    const validPattern = /^[a-zA-Z0-9]+$/;
    return validPattern.test(peerId);
};

/**
 * 清理连接资源
 * @param {Object} connection PeerJS 连接对象
 */
export const cleanupConnection = (connection) => {
    if (!connection) return;

    try {
        if (typeof connection.close === 'function') {
            connection.close();
        }
    } catch (err) {
        console.error('关闭连接时出错:', err);
    }
}; 