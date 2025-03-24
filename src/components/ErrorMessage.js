import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * 错误消息组件
 * 显示操作过程中的错误信息
 */
const ErrorMessage = ({ message, onDismiss }) => {
    if (!message) {
        return null;
    }

    return (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 mb-1">出错了</h3>
                    <p className="text-red-700">{message}</p>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-red-500 hover:text-red-700"
                        aria-label="关闭错误消息"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ErrorMessage; 