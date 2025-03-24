import React from 'react';
import { ComputerDesktopIcon, DeviceTabletIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

/**
 * 设备列表组件
 * 显示可用的设备并允许选择传输目标
 */
const DeviceList = ({ users, onStartTransfer, disabled }) => {
    // 获取设备图标
    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'phone':
                return <DevicePhoneMobileIcon className="h-6 w-6 text-blue-500" />;
            case 'tablet':
                return <DeviceTabletIcon className="h-6 w-6 text-green-500" />;
            case 'laptop':
            case 'desktop':
                return <ComputerDesktopIcon className="h-6 w-6 text-purple-500" />;
            default:
                return <DevicePhoneMobileIcon className="h-6 w-6 text-gray-500" />;
        }
    };

    return (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">可用设备</h2>

            {users.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无可用设备</p>
            ) : (
                <ul className="space-y-2">
                    {users.map(user => (
                        <li key={user.id} className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-200">
                            <div className="flex items-center space-x-3">
                                {getDeviceIcon(user.deviceType)}
                                <span className="font-medium">{user.name}</span>
                            </div>

                            <button
                                className={`px-4 py-2 rounded-md ${disabled || !user.peerId
                                        ? 'bg-gray-300 cursor-not-allowed'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                                onClick={() => !disabled && user.peerId && onStartTransfer(user.id)}
                                disabled={disabled || !user.peerId}
                            >
                                {!user.peerId ? '未就绪' : '发送文件'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default DeviceList; 