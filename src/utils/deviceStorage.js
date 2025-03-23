/**
 * 设备信息存储相关工具函数
 */

// 存储键名常量
const STORAGE_KEYS = {
    DEVICE_INFO: 'deviceInfo',
    PEER_ID: 'persistentPeerId'
};

/**
 * 从 localStorage 加载设备信息
 * @returns {Object|null} 设备信息或 null
 */
export const loadDeviceInfo = () => {
    const savedInfo = localStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
    if (savedInfo) {
        try {
            return JSON.parse(savedInfo);
        } catch (e) {
            console.error('加载设备信息失败:', e);
            return null;
        }
    }
    return null;
};

/**
 * 保存设备信息到 localStorage
 * @param {Object} deviceInfo 设备信息对象
 */
export const saveDeviceInfo = (deviceInfo) => {
    try {
        localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(deviceInfo));
    } catch (e) {
        console.error('保存设备信息失败:', e);
    }
};

/**
 * 清除设备信息
 */
export const clearDeviceInfo = () => {
    localStorage.removeItem(STORAGE_KEYS.DEVICE_INFO);
};

/**
 * 获取永久存储的 Peer ID
 * @returns {string|null} Peer ID 或 null
 */
export const getPermanentPeerId = () => {
    return localStorage.getItem(STORAGE_KEYS.PEER_ID);
};

/**
 * 保存永久 Peer ID
 * @param {string} peerId 要保存的 Peer ID
 */
export const savePermanentPeerId = (peerId) => {
    if (peerId) {
        localStorage.setItem(STORAGE_KEYS.PEER_ID, peerId);
    }
};

/**
 * 清除永久 Peer ID
 */
export const clearPermanentPeerId = () => {
    localStorage.removeItem(STORAGE_KEYS.PEER_ID);
};

/**
 * 重置所有存储的信息
 */
export const resetAllStorage = () => {
    clearDeviceInfo();
    clearPermanentPeerId();
};

/**
 * 同步设备信息中的 Peer ID 与永久存储
 * @param {Object} deviceInfo 设备信息对象
 * @returns {Object} 更新后的设备信息
 */
export const syncPeerIdWithDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return null;

    const permanentPeerId = getPermanentPeerId();
    const updatedDeviceInfo = { ...deviceInfo };

    if (permanentPeerId) {
        // 如果存在永久 Peer ID，将其同步到设备信息
        if (updatedDeviceInfo.peerId !== permanentPeerId) {
            updatedDeviceInfo.peerId = permanentPeerId;
            saveDeviceInfo(updatedDeviceInfo);
            console.log('已更新设备信息中的 Peer ID 为永久 ID');
        }
    } else if (updatedDeviceInfo.peerId) {
        // 如果设备信息中有 Peer ID 但永久存储没有，将其保存为永久 ID
        savePermanentPeerId(updatedDeviceInfo.peerId);
        console.log('将设备信息中的 Peer ID 保存为永久 ID:', updatedDeviceInfo.peerId);
    }

    return updatedDeviceInfo;
}; 