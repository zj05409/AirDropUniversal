/**
 * 文件传输服务
 * 负责文件的发送和接收逻辑
 */

import { TRANSFER_CONFIG, TRANSFER_STATES } from '../utils/config';

const { CHUNK_SIZE } = TRANSFER_CONFIG;

/**
 * 准备文件传输元数据
 * @param {File} file 要传输的文件
 * @returns {Object} 文件元数据
 */
export const prepareFileMetadata = (file) => {
    if (!file) return null;

    return {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        timestamp: Date.now()
    };
};

/**
 * 发送文件
 * @param {Object} connection PeerJS 连接对象
 * @param {File} file 要发送的文件
 * @param {Function} onProgress 进度回调函数
 * @param {Function} onStatusChange 状态变化回调函数
 * @returns {Promise<void>} 传输完成的承诺
 */
export const sendFile = async (connection, file, onProgress, onStatusChange) => {
    if (!connection || !file) {
        throw new Error('无效的连接或文件');
    }

    // 检查文件大小
    if (file.size > TRANSFER_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`文件过大，最大允许 ${TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB`);
    }

    // 准备元数据
    const metadata = prepareFileMetadata(file);
    if (!metadata) {
        throw new Error('无法准备文件元数据');
    }

    // 更新状态为准备中
    if (typeof onStatusChange === 'function') {
        onStatusChange(TRANSFER_STATES.PREPARING);
    }

    // 发送元数据
    console.log('发送文件元数据:', metadata);
    connection.send(JSON.stringify(metadata));

    // 更新状态为发送中
    if (typeof onStatusChange === 'function') {
        onStatusChange(TRANSFER_STATES.SENDING);
    }

    // 分块发送文件
    let offset = 0;

    while (offset < file.size) {
        // 切片文件
        const chunk = file.slice(offset, offset + CHUNK_SIZE);

        // 读取并发送块
        await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                try {
                    connection.send(reader.result);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
        });

        // 更新偏移和进度
        offset += CHUNK_SIZE;
        const progress = Math.min(100, Math.round((offset / file.size) * 100));

        if (typeof onProgress === 'function') {
            onProgress(progress);
        }
    }

    // 更新状态为已完成
    if (typeof onStatusChange === 'function') {
        onStatusChange(TRANSFER_STATES.COMPLETED);
    }

    console.log('文件发送完成:', metadata.fileName);
};

/**
 * 处理接收到的文件
 * @param {Array} chunks 接收到的文件块
 * @param {Object} metadata 文件元数据
 * @returns {Blob} 文件的 Blob 对象
 */
export const processReceivedFile = (chunks, metadata) => {
    if (!chunks || !chunks.length || !metadata) {
        throw new Error('无效的文件块或元数据');
    }

    // 创建 Blob 对象
    const blob = new Blob(chunks, {
        type: metadata.mimeType || 'application/octet-stream'
    });

    return blob;
};

/**
 * 保存接收到的文件
 * @param {Blob} blob 文件的 Blob 对象
 * @param {string} fileName 文件名
 */
export const saveReceivedFile = (blob, fileName) => {
    if (!blob) {
        throw new Error('无效的文件数据');
    }

    // 确保有一个有效的文件名
    const safeFileName = fileName || 'received-file';
    console.log('准备下载文件:', safeFileName);

    try {
        // 移动浏览器特殊处理
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            console.log('移动设备检测到，使用增强下载方法');

            // 为移动浏览器创建一个带有MIME类型的新Blob
            const mimeType = blob.type || 'application/octet-stream';
            const newBlob = new Blob([blob], { type: mimeType });

            // 创建下载链接并设置download属性
            const url = URL.createObjectURL(newBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = safeFileName;
            a.setAttribute('data-downloadurl', `${mimeType}:${safeFileName}:${url}`);
            a.setAttribute('target', '_blank');

            // 一些移动浏览器需要以下设置
            a.rel = 'noopener';

            // 触发下载
            document.body.appendChild(a);
            setTimeout(() => {
                a.click();

                // 清理
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            }, 0);

            return;
        }

        // 桌面浏览器标准处理
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName;

        // 触发下载
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('文件下载失败:', error);

        // 备用方法 - 直接打开URL可能导致浏览器预览而不是下载
        alert(`文件下载出错，将尝试直接打开文件。文件名是: ${safeFileName}`);
        window.open(URL.createObjectURL(blob), '_blank');
    }
};

/**
 * 配置接收文件的处理程序
 * @param {Object} connection PeerJS 连接对象
 * @param {Object} options 配置选项
 */
export const setupFileReceiver = (connection, options = {}) => {
    const {
        onMetadata,
        onProgress,
        onComplete,
        onError,
        onStatusChange
    } = options;

    // 接收状态
    let receivedChunks = [];
    let fileMetadata = null;

    // 处理连接数据
    connection.on('data', (data) => {
        try {
            // 处理元数据
            if (!fileMetadata) {
                const metadata = typeof data === 'string' ? JSON.parse(data) : data;
                console.log('收到文件元数据:', metadata);
                fileMetadata = metadata;

                if (typeof onMetadata === 'function') {
                    onMetadata(metadata);
                }

                if (typeof onStatusChange === 'function') {
                    onStatusChange(TRANSFER_STATES.RECEIVING);
                }

                return;
            }

            // 接收文件块
            receivedChunks.push(data);

            // 计算进度
            const progress = Math.round((receivedChunks.length / fileMetadata.totalChunks) * 100);

            if (typeof onProgress === 'function') {
                onProgress(progress);
            }

            // 检查是否接收完成
            if (receivedChunks.length >= fileMetadata.totalChunks) {
                console.log('文件接收完成:', fileMetadata.fileName);

                // 处理和保存文件
                const blob = processReceivedFile(receivedChunks, fileMetadata);

                if (typeof onComplete === 'function') {
                    onComplete(blob, fileMetadata);
                } else {
                    // 默认行为：直接保存文件
                    saveReceivedFile(blob, fileMetadata.fileName);
                }

                // 更新状态
                if (typeof onStatusChange === 'function') {
                    onStatusChange(TRANSFER_STATES.COMPLETED);
                }

                // 重置状态
                receivedChunks = [];
                fileMetadata = null;
            }
        } catch (err) {
            console.error('处理接收数据时出错:', err);

            if (typeof onError === 'function') {
                onError(err);
            }

            // 更新状态
            if (typeof onStatusChange === 'function') {
                onStatusChange(TRANSFER_STATES.ERROR);
            }
        }
    });
}; 