import React from 'react';

/**
 * 错误信息组件
 * 显示应用程序错误
 */
const ErrorMessage = ({ message, reconnecting }) => {
    if (!message && !reconnecting) {
        return null;
    }

    // 显示错误消息
    if (message) {
        return (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                <p>{message}</p>
            </div>
        );
    }

    // 显示重连提示
    if (reconnecting) {
        return (
            <div className="p-4 mb-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg">
                <p>正在尝试重新连接服务器...</p>
            </div>
        );
    }

    return null;
};

export default ErrorMessage; 