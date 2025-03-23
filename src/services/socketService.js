/**
 * Socket.IO 服务
 * 负责与服务器的通信和事件处理
 */

import io from 'socket.io-client';
import { SOCKET_CONFIG, getDynamicServerConfig } from '../utils/config';
import { loadDeviceInfo, saveDeviceInfo, syncPeerIdWithDeviceInfo } from '../utils/deviceStorage';

// 根据当前浏览器host推导初始socket URL
const getInitialSocketUrl = () => {
    const host = window.location.hostname;
    return `http://${host}:3001`;
};

// 初始使用基于当前host的URL创建Socket实例
const socketUrl = getInitialSocketUrl();
console.log('使用初始Socket URL:', socketUrl);
const socket = io(socketUrl, SOCKET_CONFIG);

// 异步更新Socket配置
(async () => {
    try {
        const dynamicConfig = await getDynamicServerConfig();
        if (dynamicConfig && dynamicConfig.serverUrl) {
            console.log('获取到动态服务器URL:', dynamicConfig.serverUrl);
            // Socket.io不支持动态更改URL，此信息用于调试和记录
        }
    } catch (error) {
        console.error('获取动态服务器URL失败:', error);
    }
})();

/**
 * 初始化 Socket.IO 事件监听
 * @param {Object} callbacks 回调函数对象
 */
export const initSocketListeners = (callbacks = {}) => {
    const {
        onConnect,
        onDisconnect,
        onConnectError,
        onReconnect,
        onUserList,
        onRegistered,
        onReconnected,
        onPeerIdUpdated,
        onOfferSignal,
        onAnswerSignal,
        onIceCandidateSignal
    } = callbacks;

    // 连接成功
    socket.on('connect', () => {
        console.log('已连接到服务器, socketId:', socket.id);
        if (typeof onConnect === 'function') {
            onConnect(socket.id);
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('与服务器断开连接');
        if (typeof onDisconnect === 'function') {
            onDisconnect();
        }
    });

    // 连接错误
    socket.on('connect_error', (error) => {
        console.error('连接错误:', error);
        if (typeof onConnectError === 'function') {
            onConnectError(error);
        }
    });

    // 重新连接
    socket.on('reconnect', () => {
        console.log('重新连接到服务器');
        if (typeof onReconnect === 'function') {
            onReconnect();
        }
    });

    // 用户列表更新
    socket.on('userList', (userList) => {
        console.log('收到用户列表更新:', userList);
        if (typeof onUserList === 'function') {
            onUserList(userList);
        }
    });

    // 注册成功
    socket.on('registered', (deviceInfo) => {
        console.log('设备注册成功:', deviceInfo);
        if (typeof onRegistered === 'function') {
            onRegistered(deviceInfo);
        }
    });

    // 重连成功
    socket.on('reconnected', (deviceInfo) => {
        console.log('设备重连成功:', deviceInfo);
        if (typeof onReconnected === 'function') {
            onReconnected(deviceInfo);
        }
    });

    // Peer ID 更新确认
    socket.on('peerIdUpdated', (data) => {
        console.log('收到 Peer ID 更新确认:', data);
        if (typeof onPeerIdUpdated === 'function') {
            onPeerIdUpdated(data);
        }
    });

    // WebRTC 信令
    if (typeof onOfferSignal === 'function') {
        socket.on('offer', onOfferSignal);
    }

    if (typeof onAnswerSignal === 'function') {
        socket.on('answer', onAnswerSignal);
    }

    if (typeof onIceCandidateSignal === 'function') {
        socket.on('ice-candidate', onIceCandidateSignal);
    }
};

/**
 * 清理 Socket.IO 事件监听
 */
export const cleanupSocketListeners = () => {
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('reconnect');
    socket.off('userList');
    socket.off('offer');
    socket.off('answer');
    socket.off('ice-candidate');
    socket.off('registered');
    socket.off('reconnected');
    socket.off('peerIdUpdated');
};

/**
 * 注册设备到服务器
 * @param {Object} deviceInfo 设备信息
 */
export const registerDevice = (deviceInfo) => {
    if (!deviceInfo) return;
    console.log('注册设备:', deviceInfo);
    socket.emit('register', deviceInfo);
};

/**
 * 重新连接设备到服务器
 * @param {Object} deviceInfo 设备信息
 */
export const reconnectDevice = (deviceInfo) => {
    if (!deviceInfo) return;

    // 确保 socketId 是最新的
    const updatedDeviceInfo = {
        ...deviceInfo,
        socketId: socket.id
    };

    // 确保设备信息与永久 Peer ID 同步
    const syncedDeviceInfo = syncPeerIdWithDeviceInfo(updatedDeviceInfo);

    console.log('重连设备:', syncedDeviceInfo);
    socket.emit('reconnect', syncedDeviceInfo);

    // 更新存储的设备信息
    saveDeviceInfo(syncedDeviceInfo);
};

/**
 * 更新设备的 Peer ID
 * @param {string} deviceId 设备 ID
 * @param {string} peerId Peer ID
 */
export const updatePeerId = (deviceId, peerId) => {
    if (!deviceId || !peerId) return;

    console.log('更新 Peer ID:', { id: deviceId, peerId });
    socket.emit('updatePeerId', { id: deviceId, peerId });
};

// 导出 Socket 实例，以便在需要时直接访问
export default socket; 