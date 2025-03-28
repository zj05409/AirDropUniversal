/**
 * PeerJS 服务
 * 负责管理 P2P 连接
 */

import { Peer } from 'peerjs';
import { getDynamicServerConfig } from '../utils/config';
import { getPermanentPeerId, savePermanentPeerId } from '../utils/deviceStorage';
import { generateValidPeerId, getPeerErrorMessage, cleanupConnection } from '../utils/peerUtils';
import { updatePeerId } from './socketService';

/**
 * 创建并初始化 PeerJS 实例
 * @param {Object} options 配置选项
 * @returns {Promise<Object>} 包含 peer 实例和 peerId 的对象
 */
export const createPeerInstance = async (options = {}) => {
    const {
        deviceId,
        onOpen,
        onConnection,
        onError,
        onDisconnected,
        onClose
    } = options;

    // 重试计数器
    let retryCount = 0;
    const maxRetries = 3;

    // 获取服务器配置
    let peerServerConfig;
    try {
        const dynamicConfig = await getDynamicServerConfig();
        peerServerConfig = dynamicConfig.peerServerConfig;
        console.log('使用动态PeerJS服务器配置:', peerServerConfig);
    } catch (error) {
        console.error('获取动态配置失败，使用默认配置:', error);
        // peerServerConfig = PEER_SERVER_CONFIG;
    }

    // 重试创建实例的函数
    const attemptCreateInstance = async (peerId) => {
        return new Promise((resolve, reject) => {
            try {
                // 创建 Peer 实例
                console.log('初始化 Peer 实例，使用 ID:', peerId);
                const peer = new Peer(peerId, {
                    host: options.host || window.location.hostname,
                    port: options.port || 9000,
                    path: options.path || '/peerjs',
                    debug: 2,
                    config: {
                        // 完全禁用 STUN/TURN 服务器
                        iceServers: [],
                        // 局域网优化设置
                        iceTransportPolicy: 'all',
                        // 禁用 ICE 候选池
                        iceCandidatePoolSize: 0,
                    },
                    // 禁用 TURN 服务器
                    secure: false,
                    // 增加连接稳定性的设置
                    retries: 5,
                    pingInterval: 1000,
                    // 降低连接开销
                    serialization: 'binary',
                    reliable: true,
                    // 增加连接超时时间
                    timeout: 60000
                });

                // 设置超时
                const timeout = setTimeout(() => {
                    reject(new Error('Peer 连接超时'));
                }, 20000);

                // 监听 open 事件
                peer.on('open', (id) => {
                    clearTimeout(timeout);
                    console.log('PeerJS 连接已建立, ID:', id);

                    // 保存成功连接的ID
                    savePermanentPeerId(peerId);

                    // 通知服务器 Peer ID 已更新
                    if (deviceId) {
                        updatePeerId(deviceId, peerId);
                    }

                    // 调用外部回调
                    if (typeof onOpen === 'function') {
                        onOpen(peerId);
                    }

                    resolve({ peer, peerId });
                });

                // 监听 connection 事件
                peer.on('connection', (conn) => {
                    console.log('收到新的对等连接:', conn.peer);
                    if (typeof onConnection === 'function') {
                        onConnection(conn);
                    }
                });

                // 监听 error 事件
                peer.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('PeerJS 错误:', err);

                    // 如果是ID已使用错误且未超过最大重试次数，则重试
                    if (err.type === 'unavailable-id' && retryCount < maxRetries) {
                        console.log(`Peer ID ${peerId} 已被使用，尝试生成新ID (重试 ${retryCount + 1}/${maxRetries})`);
                        retryCount++;

                        // 清理当前实例
                        try {
                            peer.destroy();
                        } catch (e) {
                            console.error('清理Peer实例时出错:', e);
                        }

                        // 生成新的ID
                        const newPeerId = generateValidPeerId();
                        console.log('生成新的Peer ID:', newPeerId);

                        // 递归尝试使用新ID
                        setTimeout(() => {
                            attemptCreateInstance(newPeerId)
                                .then(resolve)
                                .catch(reject);
                        }, 1000); // 延迟1秒再试
                    } else {
                        // 调用错误回调
                        if (typeof onError === 'function') {
                            onError(err);
                        }
                        reject(new Error(getPeerErrorMessage(err)));
                    }
                });

                // 监听 disconnected 事件
                peer.on('disconnected', () => {
                    console.log('PeerJS 服务器连接断开，尝试重连...');

                    // 检查peer是否已被销毁，只有未销毁的peer才能重连
                    if (!peer.destroyed) {
                        try {
                            peer.reconnect();
                        } catch (err) {
                            console.error('PeerJS重连失败:', err);
                        }
                    } else {
                        console.warn('PeerJS实例已销毁，无法重连');
                    }

                    if (typeof onDisconnected === 'function') {
                        onDisconnected();
                    }
                });

                // 监听 close 事件
                peer.on('close', () => {
                    console.log('PeerJS 连接已关闭');
                    if (typeof onClose === 'function') {
                        onClose();
                    }
                });
            } catch (error) {
                console.error('创建 Peer 实例时出错:', error);
                reject(error);
            }
        });
    };

    // 获取或生成 PeerID
    let peerIdToUse = getPermanentPeerId();

    if (!peerIdToUse) {
        peerIdToUse = generateValidPeerId();
        console.log('生成新的 Peer ID:', peerIdToUse);
    } else {
        console.log('使用永久存储的 Peer ID:', peerIdToUse);
    }

    // 开始尝试创建实例
    return attemptCreateInstance(peerIdToUse);
};

/**
 * 创建到目标 Peer 的连接
 * @param {Object} peer 本地 Peer 实例
 * @param {string} targetPeerId 目标 Peer ID
 * @param {Object} options 配置选项
 * @returns {Promise<Object>} 连接对象
 */
export const createPeerConnection = async (peer, targetPeerId, options = {}) => {
    const {
        onOpen,
        onData,
        onClose,
        onError
    } = options;

    if (!peer || !targetPeerId) {
        throw new Error('创建连接失败：Peer 实例或目标 ID 无效');
    }

    return new Promise((resolve, reject) => {
        try {
            console.log('创建到目标的连接:', targetPeerId);
            const conn = peer.connect(targetPeerId, {
                reliable: true,
                serialization: 'binary'
            });

            if (!conn) {
                throw new Error('连接创建失败');
            }

            const timeout = setTimeout(() => {
                reject(new Error('连接超时，请确保目标设备在线'));
            }, 20000);

            conn.on('open', () => {
                clearTimeout(timeout);
                console.log('与目标设备的连接已建立:', targetPeerId);

                if (typeof onOpen === 'function') {
                    onOpen(conn);
                }

                resolve(conn);
            });

            if (typeof onData === 'function') {
                conn.on('data', onData);
            }

            conn.on('close', () => {
                console.log('连接已关闭:', targetPeerId);
                if (typeof onClose === 'function') {
                    onClose();
                }
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                console.error('连接错误:', err);

                if (typeof onError === 'function') {
                    onError(err);
                }

                reject(new Error(getPeerErrorMessage(err)));
            });
        } catch (error) {
            console.error('创建连接时出错:', error);
            reject(error);
        }
    });
};

/**
 * 清理 Peer 实例和所有连接
 * @param {Object} peer Peer 实例
 * @param {Object} connections 连接对象的映射
 */
export const cleanupPeer = (peer, connections = {}) => {
    // 清理所有连接
    Object.values(connections).forEach(cleanupConnection);

    // 清理 Peer 实例
    if (peer) {
        try {
            peer.destroy();
        } catch (err) {
            console.error('销毁 Peer 实例时出错:', err);
        }
    }
}; 