/**
 * 文件传输服务
 * 负责文件的发送和接收逻辑
 */

import { TRANSFER_CONFIG, TRANSFER_STATES } from '../utils/config';
import JSZip from 'jszip';

const { CHUNK_SIZE } = TRANSFER_CONFIG;

/**
 * 准备文件传输元数据
 * @param {File} file 要传输的文件
 * @param {string} relativePath 文件的相对路径
 * @returns {Object} 文件元数据
 */
export const prepareFileMetadata = (file, relativePath = '') => {
    if (!file) return null;

    // 检查文件是否已有相对路径信息（从文件夹选择获取）
    if (!relativePath && file.webkitRelativePath) {
        // webkitRelativePath 格式为 "folder/subfolder/file.txt"
        relativePath = file.webkitRelativePath.split('/').slice(0, -1).join('/');
    }

    console.log(`为文件 ${file.name} 准备元数据，相对路径: ${relativePath}`);

    return {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        timestamp: Date.now(),
        fileIndex: 0, // 默认为0，在sendFile中会被更新
        totalFiles: 1, // 默认为1，在sendFile中会被更新
        batchId: Date.now().toString() + Math.random().toString(36).substr(2, 5), // 批次唯一标识符
        relativePath // 文件在文件夹中的相对路径
    };
};

/**
 * 发送单个文件
 * @param {Object} connection PeerJS 连接对象
 * @param {File} file 要发送的文件
 * @param {Object} metadata 文件元数据
 * @param {Function} onProgress 进度回调函数
 * @param {Function} onStatusChange 状态变化回调函数
 * @returns {Promise<void>} 传输完成的承诺
 */
export const sendSingleFile = async (connection, file, metadata, onProgress, onStatusChange) => {
    // 发送元数据
    console.log('发送文件元数据:', metadata);
    connection.send(JSON.stringify(metadata));

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
            onProgress(progress, metadata.fileIndex);
        }
    }

    console.log('文件发送完成:', metadata.fileName);
};

/**
 * 发送文件
 * @param {Object} connection PeerJS 连接对象
 * @param {File|Array<File>} files 要发送的文件或文件数组
 * @param {Function} onProgress 进度回调函数
 * @param {Function} onStatusChange 状态变化回调函数
 * @returns {Promise<void>} 传输完成的承诺
 */
export const sendFile = async (conn, files, progressCallback, statusCallback) => {
    try {
        // 确保文件数组是有效的
        if (!files || files.length === 0) {
            throw new Error('没有选择文件');
        }

        // 检查是否包含文件夹
        const containsFolders = checkFilesContainFolders(files);
        const totalFiles = files.length;
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        // 添加批次信息到状态
        let statusText = totalFiles > 1
            ? `发送中 (0/${totalFiles})`
            : '发送中';
        statusCallback(statusText);

        // 准备文件元数据
        statusCallback('正在准备文件...');
        const filesMetadata = [];

        // 处理所有文件，包括文件夹内的文件
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // 获取文件相对路径（如果是来自文件夹）
            let relativePath = '';
            if (file.webkitRelativePath) {
                // webkitRelativePath 格式为 "folder/subfolder/file.txt"
                // 提取文件夹路径部分
                relativePath = file.webkitRelativePath.split('/').slice(0, -1).join('/');
            } else if (file.relativePath) {
                // 如果已经设置了relativePath属性
                relativePath = file.relativePath;
            }

            // 准备元数据
            const metadata = await prepareFileMetadata(file, relativePath);
            // 设置文件在批次中的索引和总数
            metadata.fileIndex = i;
            metadata.totalFiles = totalFiles;

            filesMetadata.push(metadata);
        }

        // 发送文件元数据
        conn.send({
            type: 'file-metadata',
            files: filesMetadata,
            totalFiles: totalFiles,
            totalSize: totalSize,
            containsFolders: containsFolders
        });

        console.log(`发送${totalFiles}个文件的元数据:`, filesMetadata);

        // 逐个发送文件内容
        let totalSent = 0;
        let totalProgress = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileSize = file.size;

            // 更新状态为当前文件的序号
            statusText = totalFiles > 1
                ? `发送中 (${i + 1}/${totalFiles})`
                : '发送中';
            statusCallback(statusText);

            // 读取文件内容并分块发送
            const chunkSize = 65536; // 64KB
            let start = 0;

            // 创建一个包含文件各个部分的队列
            const fileReader = new FileReader();

            // 循环读取文件的每个块
            while (start < fileSize) {
                const end = Math.min(start + chunkSize, fileSize);
                const chunk = file.slice(start, end);

                // 读取文件块并发送
                const base64Chunk = await readFileChunkAsBase64(fileReader, chunk);

                conn.send({
                    type: 'file-chunk',
                    fileIndex: i,
                    chunk: base64Chunk,
                    start: start,
                    end: end,
                    fileName: file.name,
                    // 添加相对路径信息
                    relativePath: filesMetadata[i].relativePath
                });

                // 更新已发送的数据量
                start = end;
                totalSent += (end - start);

                // 计算总体进度
                const fileProgress = (start / fileSize) * 100;
                totalProgress = ((totalSent + (fileProgress * fileSize / 100)) / totalSize) * 100;

                // 确保进度不超过100%
                totalProgress = Math.min(totalProgress, (i / files.length) * 100 + (1 / files.length) * fileProgress);

                // 调用进度回调
                progressCallback(Math.min(Math.round(totalProgress), 99)); // 设置上限为99%，留出最后1%给完成步骤
            }
        }

        // 发送结束信号
        conn.send({
            type: 'file-complete',
            success: true
        });

        // 更新状态为已完成并设置进度为100%
        statusCallback('completed');
        progressCallback(100);

        return true;
    } catch (error) {
        console.error('文件发送错误:', error);
        statusCallback('error');
        throw error;
    }
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
 * @param {Object} options 附加选项
 * @returns {Promise<boolean>} 保存成功返回 true，否则返回 false
 */
export const saveReceivedFile = (blob, fileName, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!blob) {
            reject(new Error('无效的文件数据'));
            return;
        }

        // 确保有一个有效的文件名
        const safeFileName = fileName || `received-file-${Date.now()}`;
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
                        resolve(true);
                    }, 100);
                }, 0);
                return;
            }

            // 桌面浏览器标准处理
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = safeFileName;

            // 使用随机id，确保每个下载链接是唯一的
            a.id = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // 触发下载
            document.body.appendChild(a);

            // 使用小延迟，避免浏览器内存过度压力
            setTimeout(() => {
                a.click();

                // 清理
                setTimeout(() => {
                    if (document.body.contains(a)) {
                        document.body.removeChild(a);
                    }
                    URL.revokeObjectURL(url);
                    resolve(true);
                }, 300);
            }, 50);
        } catch (error) {
            console.error('文件下载失败:', error);

            // 使用自定义方法代替confirm
            // 只记录错误但返回成功，让批量传输流程继续
            console.warn(`文件 "${safeFileName}" 下载失败，继续处理其他文件`);

            // 这里我们选择不打开文件，而是直接报告失败但允许继续
            resolve(false); // 文件保存失败，但允许继续处理其他文件
        }
    });
};

/**
 * 将多个文件保存为一个压缩包，支持文件夹结构
 * @param {Array} files 文件对象数组
 * @param {Function} statusCallback 状态回调函数
 * @returns {Promise<boolean>} 保存成功返回true，失败返回false
 */
export const saveFilesAsZip = async (files, statusCallback) => {
    if (!files || files.length === 0) return false;

    try {
        // 通知UI开始创建压缩包
        if (typeof statusCallback === 'function') {
            statusCallback('正在创建压缩包...');
        }

        // 显示创建ZIP包的提示
        alert(`正在将${files.length}个文件打包为ZIP文件，请稍候...`);

        const zip = new JSZip();
        const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
        const zipFilename = `AirDrop文件组-${dateStr}-${Date.now().toString().slice(-4)}.zip`;

        console.log(`正在创建压缩包: ${zipFilename}，包含 ${files.length} 个文件`);

        // 文件名去重映射
        const filePathMap = new Map();

        // 添加所有文件到zip，保持文件夹结构
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            console.log('处理文件:', file.name, '相对路径:', file.relativePath);

            // 确定文件在ZIP中的路径
            let zipPath = '';

            // 如果有相对路径，使用相对路径
            if (file.relativePath) {
                // 确保路径格式正确（使用/分隔）
                zipPath = file.relativePath;
                if (!zipPath.endsWith(file.name)) {
                    zipPath = zipPath ? `${zipPath}/${file.name}` : file.name;
                }
            } else if (file.webkitRelativePath) {
                // 对于通过input[webkitdirectory]选择的文件，webkitRelativePath包含完整路径
                zipPath = file.webkitRelativePath;
            } else {
                // 没有路径信息，使用文件名放在根目录
                zipPath = file.name;
            }

            console.log('文件将保存到ZIP路径:', zipPath);

            // 处理同名文件
            if (filePathMap.has(zipPath)) {
                const count = filePathMap.get(zipPath) + 1;
                filePathMap.set(zipPath, count);

                // 添加数字后缀
                const lastDotIndex = zipPath.lastIndexOf('.');
                const lastSlashIndex = zipPath.lastIndexOf('/');

                if (lastDotIndex > 0 && lastDotIndex > lastSlashIndex) {
                    // 有扩展名的情况
                    const name = zipPath.substring(0, lastDotIndex);
                    const ext = zipPath.substring(lastDotIndex);
                    zipPath = `${name} (${count})${ext}`;
                } else {
                    // 没有扩展名的情况
                    zipPath = `${zipPath} (${count})`;
                }
            } else {
                filePathMap.set(zipPath, 1);
            }

            // 添加到zip - 使用正确的路径
            zip.file(zipPath, file);

            // 更新状态，显示进度
            if (typeof statusCallback === 'function') {
                const progress = Math.round((i + 1) / files.length * 50); // 压缩过程占总进度的50%
                statusCallback(`正在创建压缩包 (${i + 1}/${files.length})`, progress);
            }
        }

        // 通知UI开始生成ZIP文件
        if (typeof statusCallback === 'function') {
            statusCallback('正在生成压缩文件...', 50);
        }

        // 生成zip文件
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
            // 添加进度回调
            onUpdate: (metadata) => {
                if (typeof statusCallback === 'function') {
                    // 压缩过程从50%到90%
                    const progress = 50 + Math.round(metadata.percent * 0.4);
                    statusCallback(`正在生成压缩文件... ${Math.round(metadata.percent)}%`, progress);
                }
            }
        });

        // 通知UI开始下载ZIP文件
        if (typeof statusCallback === 'function') {
            statusCallback('准备下载ZIP文件...', 90);
        }

        // 显示ZIP包创建完成，即将下载的提示
        alert(`ZIP文件打包完成，文件名：${zipFilename}，即将开始下载...`);

        // 下载zip文件
        await saveReceivedFile(zipBlob, zipFilename);

        // 通知UI完成
        if (typeof statusCallback === 'function') {
            statusCallback('ZIP文件已创建完成', 100);

            // 延迟重置状态
            setTimeout(() => {
                statusCallback(''); // 重置状态
            }, 2000);
        }

        console.log('ZIP文件创建完成并开始下载');
        return true;
    } catch (error) {
        console.error('创建ZIP文件时出错:', error);

        // 通知UI出错
        if (typeof statusCallback === 'function') {
            statusCallback('创建ZIP文件出错', 0);
        }

        return false;
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
        onStatusChange,
        onBatchStart,
        onBatchEnd,
        onBatchProgress
    } = options;

    // 接收状态
    let receivedChunks = [];
    let fileMetadata = null;
    let currentBatch = null;
    let batchFiles = [];
    let receivedFiles = []; // 存储所有接收到的文件
    let isBatchComplete = false; // 标记批次是否完成接收
    let currentFileIndex = 0; // 当前正在接收的文件索引
    let batchMetadata = null; // 批次元数据

    // 处理单个接收到的文件但不立即保存
    const processReceivedFileData = async (chunks, metadata) => {
        if (!chunks || chunks.length === 0 || !metadata) {
            console.error('无效的文件块或元数据');
            return null;
        }

        try {
            // 处理文件
            const fileBlob = processReceivedFile(chunks, metadata);

            console.log('处理接收到的文件:', metadata.fileName, '相对路径:', metadata.relativePath);

            // 创建文件对象
            const fileObject = {
                blob: fileBlob,
                metadata: { ...metadata },
                saved: false // 标记文件是否已保存
            };

            // 如果是批量传输的一部分，保存到批次数组
            if (currentBatch && metadata.batchId === currentBatch.batchId) {
                batchFiles[metadata.fileIndex] = fileObject;
            }

            // 添加到接收文件数组
            receivedFiles.push(fileObject);

            // 传输完成回调
            if (typeof onComplete === 'function') {
                onComplete(fileBlob, metadata, false); // 不自动保存
            }

            return fileObject;
        } catch (err) {
            console.error('处理接收文件时出错:', err);
            if (typeof onError === 'function') {
                onError(err);
            }

            // 显示错误提示
            alert(`文件接收失败: ${err.message || '未知错误'}`);

            // 重置状态
            if (typeof onStatusChange === 'function') {
                onStatusChange(TRANSFER_STATES.ERROR);
                // 延迟清除错误状态
                setTimeout(() => {
                    onStatusChange('');
                }, 3000);
            }
            return null;
        }
    };

    // 保存接收到的所有文件
    const saveAllReceivedFiles = async () => {
        console.log('准备保存所有接收的文件:', receivedFiles.length);

        // 如果没有文件要保存，直接返回
        if (receivedFiles.length === 0) return;

        // 对于单个文件直接保存，多个文件打包为ZIP
        if (receivedFiles.length === 1 && !receivedFiles[0].metadata.relativePath) {
            // 没有相对路径信息，说明是单个文件，非文件夹内的文件
            const file = receivedFiles[0];
            if (!file.saved) {
                try {
                    console.log(`准备保存单个文件:`, file.metadata.fileName);

                    // 异步保存文件
                    await saveReceivedFile(file.blob, file.metadata.fileName)
                        .then(success => {
                            file.saved = success;
                        })
                        .catch(err => {
                            console.error('保存文件出错:', err);
                        });
                } catch (err) {
                    console.error('保存文件时出错:', err);
                }
            }
        } else {
            // 多个文件或包含文件夹，打包为ZIP
            console.log(`检测到多个文件 (${receivedFiles.length})，将创建ZIP压缩包`);

            // 添加ZIP包创建提示
            alert(`检测到${receivedFiles.length}个文件${currentBatch && currentBatch.containsFolders ? '(包含文件夹结构)' : ''}，即将创建ZIP压缩包...`);

            // 准备文件对象数组
            const filesForZip = receivedFiles.map(fileObj => {
                // 为blob对象添加name属性
                const blobWithName = new Blob([fileObj.blob], { type: fileObj.blob.type });
                blobWithName.name = fileObj.metadata.fileName;

                // 获取文件的相对路径
                const relativePath = fileObj.metadata.relativePath || '';
                if (relativePath) {
                    console.log(`文件 ${fileObj.metadata.fileName} 具有相对路径: ${relativePath}`);
                    blobWithName.relativePath = relativePath;
                }

                return blobWithName;
            });

            console.log('准备ZIP打包的文件列表:', filesForZip.map(f => ({
                name: f.name,
                relativePath: f.relativePath
            })));

            const success = await saveFilesAsZip(filesForZip, onStatusChange);
            if (success) {
                // 标记所有文件为已保存
                receivedFiles.forEach(file => file.saved = true);
            }
        }
    };

    // 处理批次完成
    const handleBatchComplete = () => {
        if (isBatchComplete) return;

        isBatchComplete = true;
        console.log('批量传输完成，准备保存文件');

        // 延迟一点时间再保存，确保所有处理都完成
        setTimeout(() => {
            if (typeof onBatchEnd === 'function') {
                onBatchEnd(currentBatch, batchFiles.filter(Boolean));
            }

            // 实际下载文件之前，先显示完成状态
            if (typeof onStatusChange === 'function') {
                onStatusChange(TRANSFER_STATES.COMPLETED);
            }

            // 显示批量文件接收成功提示
            let fileCount = 0;
            if (Array.isArray(batchFiles)) {
                fileCount = batchFiles.filter(Boolean).length; // 过滤出非空文件
            } else if (receivedFiles && Array.isArray(receivedFiles)) {
                fileCount = receivedFiles.length;
            }

            // 根据文件数量和是否包含文件夹结构，提供不同的提示
            if (fileCount > 1 || (currentBatch && currentBatch.containsFolders)) {
                alert(`${fileCount}个文件接收成功！${currentBatch && currentBatch.containsFolders ? '包含文件夹结构，' : ''}将打包为ZIP文件后下载。`);
            } else {
                alert(`文件接收成功！即将开始下载。`);
            }

            // 再延迟一点时间开始下载文件，给UI更新的时间
            setTimeout(() => {
                // 批量保存所有文件
                saveAllReceivedFiles();

                // 延迟清除状态
                setTimeout(() => {
                    if (typeof onStatusChange === 'function') {
                        onStatusChange('');

                        // 发送重置信号，告知上层组件传输已完全完成，可以重置UI
                        if (typeof onBatchEnd === 'function') {
                            onBatchEnd(null, null, true); // 最后一个参数表示传输完全结束，需要重置UI
                        }
                    }
                }, 3000); // 适当缩短时间
            }, 800);
        }, 500);
    };

    // 处理连接数据
    connection.on('data', async (data) => {
        try {
            // 处理新格式的消息
            if (typeof data === 'object' && data !== null && data.type) {
                // 处理文件元数据
                if (data.type === 'file-metadata') {
                    console.log('收到新格式的文件元数据:', data);
                    batchMetadata = data;

                    // 设置批次状态
                    currentBatch = {
                        totalFiles: data.totalFiles,
                        totalSize: data.totalSize,
                        containsFolders: data.containsFolders,
                        batchId: Date.now().toString() + Math.random().toString(36).substr(2, 5)
                    };

                    batchFiles = new Array(data.totalFiles).fill(null);
                    receivedFiles = []; // 清空之前的文件
                    isBatchComplete = false;
                    currentFileIndex = 0;

                    // 触发批次开始回调
                    if (typeof onBatchStart === 'function') {
                        onBatchStart(currentBatch);
                    }

                    // 更新状态
                    if (typeof onStatusChange === 'function') {
                        onStatusChange(`准备接收 ${data.totalFiles} 个文件`);
                    }

                    return;
                }

                // 处理文件块
                if (data.type === 'file-chunk') {
                    // 如果没有元数据，这是不正常的情况
                    if (!batchMetadata) {
                        console.error('收到数据块但没有元数据');
                        if (typeof onError === 'function') {
                            onError(new Error('收到数据块但没有元数据'));
                        }
                        return;
                    }

                    // 检查是否需要开始新文件
                    if (data.fileIndex !== currentFileIndex || !fileMetadata) {
                        currentFileIndex = data.fileIndex;

                        // 如果上一个文件有数据但未完成处理，处理它
                        if (fileMetadata && receivedChunks.length > 0) {
                            const currentMetadata = { ...fileMetadata };
                            const currentChunks = [...receivedChunks];

                            // 处理之前文件
                            setTimeout(async () => {
                                await processReceivedFileData(currentChunks, currentMetadata);
                            }, 0);
                        }

                        // 为新文件准备元数据
                        fileMetadata = {
                            fileName: data.fileName,
                            fileIndex: data.fileIndex,
                            totalFiles: batchMetadata.totalFiles,
                            batchId: currentBatch.batchId,
                            // 添加相对路径信息
                            relativePath: data.relativePath || ''
                        };

                        // 记录文件接收开始
                        console.log(`开始接收文件: ${data.fileName}, 索引: ${data.fileIndex}, 相对路径: ${data.relativePath || '无'}`);

                        receivedChunks = [];

                        // 更新状态
                        if (typeof onStatusChange === 'function') {
                            if (batchMetadata.totalFiles > 1) {
                                onStatusChange(`${TRANSFER_STATES.RECEIVING} (${data.fileIndex + 1}/${batchMetadata.totalFiles})`);
                            } else {
                                onStatusChange(TRANSFER_STATES.RECEIVING);
                            }
                        }
                    }

                    // 解码Base64数据块
                    try {
                        const binaryData = atob(data.chunk);
                        const byteArray = new Uint8Array(binaryData.length);
                        for (let i = 0; i < binaryData.length; i++) {
                            byteArray[i] = binaryData.charCodeAt(i);
                        }
                        receivedChunks.push(byteArray.buffer);
                    } catch (e) {
                        console.error('解析文件块出错:', e);
                        receivedChunks.push(data.chunk);
                    }

                    // 计算当前文件的进度
                    const currentFileSize = data.end;
                    const progress = Math.round((data.end / currentFileSize) * 100);

                    // 更新单个文件的进度
                    if (typeof onProgress === 'function') {
                        onProgress(progress);
                    }

                    // 更新批次整体进度
                    if (typeof onBatchProgress === 'function' && currentBatch) {
                        const batchProgress = Math.round(
                            (data.fileIndex + progress / 100) / batchMetadata.totalFiles * 100
                        );
                        onBatchProgress(batchProgress, data.fileIndex, progress);
                    }

                    return;
                }

                // 处理文件完成信号
                if (data.type === 'file-complete') {
                    console.log('收到文件传输完成信号:', data);

                    // 处理最后一个文件
                    if (fileMetadata && receivedChunks.length > 0) {
                        const currentMetadata = { ...fileMetadata };
                        const currentChunks = [...receivedChunks];

                        // 重置状态，为接收下一个文件做准备
                        receivedChunks = [];
                        fileMetadata = null;

                        // 异步处理文件
                        setTimeout(async () => {
                            await processReceivedFileData(currentChunks, currentMetadata);

                            // 触发批次完成
                            handleBatchComplete();
                        }, 0);
                    } else {
                        // 没有最后的文件数据，直接触发批次完成
                        handleBatchComplete();
                    }

                    return;
                }
            }

            // 处理原有格式的消息（向后兼容）
            if (typeof data === 'string') {
                try {
                    // 尝试解析为JSON (可能是元数据或批次信息)
                    const jsonData = JSON.parse(data);

                    // 检查是否为批次开始信息
                    if (jsonData.type === 'batch_start') {
                        console.log('收到批量传输开始信息:', jsonData);
                        currentBatch = jsonData;
                        batchFiles = new Array(jsonData.totalFiles).fill(null);
                        receivedFiles = []; // 清空之前的文件
                        isBatchComplete = false;

                        if (typeof onBatchStart === 'function') {
                            onBatchStart(jsonData);
                        }

                        if (typeof onStatusChange === 'function') {
                            onStatusChange(`准备接收 ${jsonData.totalFiles} 个文件`);
                        }

                        return;
                    }

                    // 检查是否为批次结束信息
                    if (jsonData.type === 'batch_end') {
                        console.log('收到批量传输结束信息:', jsonData);
                        handleBatchComplete();
                        return;
                    }

                    // 否则，这应该是一个文件的元数据
                    console.log('收到文件元数据:', jsonData);
                    fileMetadata = jsonData;
                    receivedChunks = [];

                    if (typeof onMetadata === 'function') {
                        onMetadata(jsonData);
                    }

                    if (typeof onStatusChange === 'function') {
                        if (fileMetadata.totalFiles > 1) {
                            onStatusChange(`${TRANSFER_STATES.RECEIVING} (${fileMetadata.fileIndex + 1}/${fileMetadata.totalFiles})`);
                        } else {
                            onStatusChange(TRANSFER_STATES.RECEIVING);
                        }
                    }

                    return;
                } catch (e) {
                    console.error('解析JSON数据失败:', e);
                    // 不是有效的JSON，可能是其他字符串数据
                }
            }

            // 如果不是新格式也不是旧格式的JSON，当作文件块处理
            if (!fileMetadata) {
                console.error('收到数据块但没有元数据');
                if (typeof onError === 'function') {
                    onError(new Error('收到数据块但没有元数据'));
                }
                return;
            }

            // 接收旧格式的文件块
            receivedChunks.push(data);

            // 计算进度
            const progress = Math.round((receivedChunks.length / fileMetadata.totalChunks) * 100);

            // 更新单个文件的进度
            if (typeof onProgress === 'function') {
                onProgress(progress);
            }

            // 更新批次整体进度
            if (typeof onBatchProgress === 'function' && currentBatch) {
                const batchProgress = Math.round(
                    (fileMetadata.fileIndex + progress / 100) / fileMetadata.totalFiles * 100
                );
                onBatchProgress(batchProgress, fileMetadata.fileIndex, progress);
            }

            // 检查是否接收完成
            if (receivedChunks.length >= fileMetadata.totalChunks) {
                console.log('文件接收完成:', fileMetadata.fileName);

                // 处理当前文件
                const currentMetadata = { ...fileMetadata };
                const currentChunks = [...receivedChunks];

                // 立即重置状态，为接收下一个文件做准备
                receivedChunks = [];
                fileMetadata = null;

                // 异步处理文件，不阻塞接收
                setTimeout(async () => {
                    await processReceivedFileData(currentChunks, currentMetadata);

                    // 检查是否是单文件传输 
                    if (currentMetadata.totalFiles <= 1) {
                        // 单文件传输，更新状态为完成
                        if (typeof onStatusChange === 'function') {
                            onStatusChange(TRANSFER_STATES.COMPLETED);
                        }

                        // 显示成功提示
                        alert('文件接收成功！即将开始下载。');

                        // 延迟下载文件，给UI更新的时间
                        setTimeout(() => {
                            // 单文件传输，直接保存
                            saveAllReceivedFiles();

                            // 延迟清除状态
                            setTimeout(() => {
                                if (typeof onStatusChange === 'function') {
                                    onStatusChange('');
                                }

                                // 触发批次结束回调，表示需要完全重置UI
                                if (typeof onBatchEnd === 'function') {
                                    onBatchEnd(null, null, true);
                                }
                            }, 3000);
                        }, 800);
                    } else if (currentBatch &&
                        currentMetadata.fileIndex === currentBatch.totalFiles - 1 &&
                        !isBatchComplete) {
                        // 如果是批次中的最后一个文件，且批次结束消息未收到
                        // 手动触发批次完成
                        console.log('已接收批次中最后一个文件，但未收到批次结束消息，手动触发批次完成');
                        handleBatchComplete();
                    }
                }, 0);
            }
        } catch (err) {
            console.error('处理接收数据时出错:', err);
            if (typeof onError === 'function') {
                onError(err);
            }

            // 显示错误提示
            alert(`文件接收失败: ${err.message || '未知错误'}`);

            // 重置状态
            if (typeof onStatusChange === 'function') {
                onStatusChange(TRANSFER_STATES.ERROR);
                // 延迟清除错误状态
                setTimeout(() => {
                    onStatusChange('');
                }, 3000);
            }
        }
    });

    // 返回清理函数
    return () => {
        // 清理资源
        receivedChunks = [];
        fileMetadata = null;
        currentBatch = null;
        batchFiles = [];
        receivedFiles = [];
        isBatchComplete = false;
        currentFileIndex = 0;
        batchMetadata = null;
    };
};

/**
 * 检查文件数组中是否包含文件夹
 * @param {Array} files 文件数组
 * @returns {boolean} 是否包含文件夹
 */
export const checkFilesContainFolders = (files) => {
    if (!files || !Array.isArray(files)) return false;
    return files.some(file => file.relativePath && file.relativePath.includes('/'));
};

/**
 * 以Base64格式读取文件块
 * @param {FileReader} fileReader 文件读取器实例
 * @param {Blob} chunk 文件块
 * @returns {Promise<string>} Base64编码的文件块
 */
const readFileChunkAsBase64 = (fileReader, chunk) => {
    return new Promise((resolve, reject) => {
        fileReader.onload = (e) => {
            // FileReader加载完成后，结果是一个ArrayBuffer
            const arrayBuffer = e.target.result;

            // 转换为Base64字符串
            const base64 = arrayBufferToBase64(arrayBuffer);
            resolve(base64);
        };

        fileReader.onerror = (error) => {
            reject(error);
        };

        // 读取文件块为ArrayBuffer
        fileReader.readAsArrayBuffer(chunk);
    });
};

/**
 * 将ArrayBuffer转换为Base64字符串
 * @param {ArrayBuffer} buffer 数据缓冲区
 * @returns {string} Base64编码的字符串
 */
const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}; 