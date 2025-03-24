/**
 * 网络工具函数
 */

/**
 * 检查是否在Electron环境
 * @returns {boolean} 是否在Electron环境
 */
export const isElectronEnv = () => {
    return window.appConfig && window.appConfig.isElectron === true;
};

/**
 * 获取服务器配置信息
 * @returns {Promise<Object>} 服务器配置信息
 */
export const getServerConfig = async () => {
    try {
        // 首先检查是否在Electron环境中
        if (isElectronEnv()) {
            console.log('Electron环境中，使用内置配置');
            const ip = window.appConfig.serverIp;
            const serverPort = window.appConfig.serverPort;
            const peerPort = window.appConfig.peerPort;

            return {
                socketServer: `http://${ip}:${serverPort}`,
                peerServer: {
                    host: ip,
                    port: peerPort,
                    path: '/peerjs',
                    secure: false
                }
            };
        }

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

        const config = await response.json();
        console.log('获取到服务器配置:', config);
        return {
            socketServer: `http://${config.ip}:${config.port}`,
            peerServer: {
                host: config.ip,
                port: config.peerPort,
                path: '/peerjs',
                secure: false
            }
        };
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
        // 首先检查是否在Electron环境中
        if (isElectronEnv()) {
            const ip = window.appConfig.serverIp;
            return `http://${ip}:3000`;
        }

        const config = await getServerConfig();

        // 直接使用getServerConfig返回的config对象中的ip
        if (config && config.socketServer) {
            const ip = config.peerServer.host;
            return `http://${ip}:3000`;
        }
        throw new Error('配置对象不完整');
    } catch (error) {
        console.error('获取应用URL失败:', error);
        // 作为备选，尝试从当前URL中获取IP地址
        try {
            const ipAddress = window.location.hostname;
            return `http://${ipAddress}:3000`;
        } catch (e) {
            return window.location.origin; // 最后的备选方案
        }
    }
}; 