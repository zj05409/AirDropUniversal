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
        // 确保设备信息包含时间戳
        const updatedInfo = {
            ...deviceInfo,
            updatedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(updatedInfo));
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

        // 同时更新设备信息中的peerId
        const deviceInfo = loadDeviceInfo();
        if (deviceInfo && deviceInfo.peerId !== peerId) {
            deviceInfo.peerId = peerId;
            deviceInfo.peerIdUpdatedAt = Date.now();
            saveDeviceInfo(deviceInfo);
            console.log('已更新设备信息中的 Peer ID');
        }
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
    let needsUpdate = false;

    // 记录同步时间
    updatedDeviceInfo.syncedAt = Date.now();

    if (permanentPeerId) {
        // 如果存在永久 Peer ID，将其同步到设备信息
        if (updatedDeviceInfo.peerId !== permanentPeerId) {
            console.log('同步中: 用永久ID替换设备信息中的ID');
            console.log('- 设备信息ID:', updatedDeviceInfo.peerId);
            console.log('- 永久ID:', permanentPeerId);

            updatedDeviceInfo.peerId = permanentPeerId;
            updatedDeviceInfo.peerIdUpdatedAt = Date.now();
            needsUpdate = true;
            console.log('已更新设备信息中的 Peer ID 为永久 ID');
        }
    } else if (updatedDeviceInfo.peerId) {
        // 如果设备信息中有 Peer ID 但永久存储没有，将其保存为永久 ID
        savePermanentPeerId(updatedDeviceInfo.peerId);
        updatedDeviceInfo.peerIdUpdatedAt = Date.now();
        needsUpdate = true;
        console.log('将设备信息中的 Peer ID 保存为永久 ID:', updatedDeviceInfo.peerId);
    }

    // 只有在有变更时才保存
    if (needsUpdate) {
        saveDeviceInfo(updatedDeviceInfo);
    }

    return updatedDeviceInfo;
}; 