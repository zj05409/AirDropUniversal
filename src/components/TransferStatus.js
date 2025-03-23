import React from 'react';

/**
 * 传输状态组件
 * 显示文件传输的状态和进度
 */
const TransferStatus = ({ status, progress }) => {
    // 如果没有传输状态，不显示
    if (!status) {
        return null;
    }

    // 状态文字映射
    const statusText = {
        'connecting': '正在连接...',
        'preparing': '准备传输...',
        'completed': '传输完成',
        'error': '传输错误'
    };

    // 获取显示文本
    const displayText = statusText[status] || status;

    return (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">传输状态</h2>
            <p className="text-gray-600 mb-2">{displayText}</p>

            {progress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${progress}%` }}>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransferStatus; 