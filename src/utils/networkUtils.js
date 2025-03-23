/**
 * 网络工具函数
 */

/**
 * 获取服务器配置信息
 * @returns {Promise<Object>} 服务器配置信息
 */
export const getServerConfig = async () => {
    try {
        // 从当前URL推断API地址
        const currentUrl = window.location.origin;
        const apiPort = 3001; // 服务器端口

        // 提取主机名（不包括端口）
        const hostParts = currentUrl.split(':');
        const host = hostParts[0] + ':' + hostParts[1];

        // 构建API URL
        const apiUrl = `${host}:${apiPort}/api/server-config`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('无法获取服务器配置');
        }

        return await response.json();
    } catch (error) {
        console.error('获取服务器配置失败:', error);
        // 返回默认配置
        return {
            socketServer: window.location.origin,
            peerServer: {
                host: window.location.hostname,
                port: 9000,
                path: '/peerjs',
                secure: false
            }
        };
    }
};

/**
 * 获取应用访问URL
 * @returns {Promise<string>} 应用访问URL
 */
export const getAppUrl = async () => {
    try {
        const config = await getServerConfig();
        // 从socketServer中提取IP地址
        const urlParts = config.socketServer.split('//');
        const hostParts = urlParts[1].split(':');
        const ipAddress = hostParts[0];

        // 构建Web应用URL（通常端口为3000）
        return `http://${ipAddress}:3000`;
    } catch (error) {
        console.error('获取应用URL失败:', error);
        return window.location.origin; // 作为备选返回当前URL
    }
}; 