import React from 'react';
import { FaFolder, FaFile } from 'react-icons/fa';

/**
 * 传输状态组件
 * 显示当前文件传输的状态和进度
 */
const TransferStatus = ({ status, progress, transferStats }) => {
    // 格式化文件大小显示
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // 格式化传输速度
    const formatTransferSpeed = (bytesPerSecond) => {
        if (bytesPerSecond < 1024) {
            return `${bytesPerSecond.toFixed(2)} B/s`;
        } else if (bytesPerSecond < 1024 * 1024) {
            return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
        } else {
            return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
        }
    };

    // 获取状态文本
    const getStatusText = () => {
        // 保留原始状态文本，特别是在创建ZIP文件过程中
        if (status.includes('正在创建压缩包') || status.includes('正在准备文件')) {
            return status;
        }

        switch (status) {
            case 'connecting':
                return '正在连接...';
            case 'sending':
                return '正在发送文件...';
            case 'receiving':
                return '正在接收文件...';
            case 'completed':
                return '传输完成！';
            case 'error':
                return '传输失败';
            default:
                return status;
        }
    };

    // 估算剩余时间（基于当前速度和进度）
    const getEstimatedTimeRemaining = () => {
        if (!transferStats || transferStats.speed <= 0 || progress >= 100) {
            return null;
        }

        const totalBytes = transferStats.totalSize || 0;
        const bytesTransferred = totalBytes * (progress / 100);
        const bytesRemaining = totalBytes - bytesTransferred;
        const secondsRemaining = bytesRemaining / transferStats.speed;

        if (secondsRemaining < 60) {
            return `约 ${Math.ceil(secondsRemaining)} 秒`;
        } else if (secondsRemaining < 3600) {
            return `约 ${Math.ceil(secondsRemaining / 60)} 分钟`;
        } else {
            return `超过 ${Math.floor(secondsRemaining / 3600)} 小时`;
        }
    };

    // 获取进度条显示类
    const getProgressBarClass = () => {
        if (status === 'error') {
            return 'bg-red-500';
        } else if (status === 'completed') {
            return 'bg-green-500';
        } else {
            return 'bg-blue-500';
        }
    };

    if (!status) {
        return null;
    }

    return (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">传输状态</h3>

            {/* 状态文本显示 */}
            <p className="text-gray-600 mb-2">{getStatusText()}</p>

            {/* 多文件打包提示 */}
            {transferStats && typeof transferStats === 'object' && transferStats.totalFiles > 1 && (
                <p className="text-sm text-gray-500 mb-2">
                    多个文件将会被打包为一个ZIP文件，传输完成后只需确认一次下载。
                </p>
            )}

            {/* 传输统计信息 */}
            {transferStats && typeof transferStats === 'object' && (
                <div className="mt-3 mb-3 text-sm text-gray-600">
                    <div className="flex items-center mb-1">
                        {transferStats.containsFolders ? (
                            <FaFolder className="text-yellow-500 mr-2" />
                        ) : (
                            <FaFile className="text-blue-500 mr-2" />
                        )}
                        <span>
                            {typeof transferStats.totalFiles === 'number' ? transferStats.totalFiles : 0} 个
                            {transferStats.containsFolders ? '项目' : '文件'}
                            ({formatFileSize(transferStats.totalSize || 0)})
                        </span>
                    </div>

                    {transferStats.speed > 0 && (
                        <div className="flex justify-between">
                            <span>传输速度: {formatTransferSpeed(transferStats.speed)}</span>
                            {getEstimatedTimeRemaining() && (
                                <span>剩余时间: {getEstimatedTimeRemaining()}</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 进度条 */}
            {progress > 0 && (
                <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className={`h-2.5 rounded-full ${getProgressBarClass()}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-right text-sm text-gray-500 mt-1">{Math.round(progress)}%</p>
                </div>
            )}
        </div>
    );
};

export default TransferStatus; 