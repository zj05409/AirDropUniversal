/**
 * PeerJS 服务
 * 负责管理 P2P 连接
 */

import { Peer } from 'peerjs';
import { PEER_SERVER_CONFIG } from '../utils/config';
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

    // 获取或生成 PeerID
    let peerIdToUse = getPermanentPeerId();
    let isNewId = false;

    if (!peerIdToUse) {
        peerIdToUse = generateValidPeerId();
        isNewId = true;
        console.log('生成新的永久 Peer ID:', peerIdToUse);
        savePermanentPeerId(peerIdToUse);
    } else {
        console.log('使用永久存储的 Peer ID:', peerIdToUse);
    }

    return new Promise((resolve, reject) => {
        try {
            // 创建 Peer 实例
            console.log('初始化 Peer 实例，使用 ID:', peerIdToUse);
            const peer = new Peer(peerIdToUse, PEER_SERVER_CONFIG);

            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error('Peer 连接超时'));
            }, 20000);

            // 监听 open 事件
            peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('PeerJS 连接已建立, ID:', id);

                // 处理服务器可能分配不同 ID 的情况
                if (id !== peerIdToUse) {
                    console.warn('服务器分配了不同的 ID:', id);
                    console.warn('但我们将继续使用本地 ID:', peerIdToUse);
                }

                // 通知服务器 Peer ID 已更新
                if (deviceId) {
                    updatePeerId(deviceId, peerIdToUse);
                }

                // 调用外部回调
                if (typeof onOpen === 'function') {
                    onOpen(peerIdToUse, isNewId);
                }

                resolve({ peer, peerId: peerIdToUse });
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

                // 仅当未解析时才拒绝承诺，以避免双重解析
                if (typeof onError === 'function') {
                    onError(err);
                }

                reject(new Error(getPeerErrorMessage(err)));
            });

            // 监听 disconnected 事件
            peer.on('disconnected', () => {
                console.log('PeerJS 服务器连接断开，尝试重连...');
                peer.reconnect();
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