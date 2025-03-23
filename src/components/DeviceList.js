import React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { CONNECTION_STATES } from '../utils/config';

/**
 * 设备列表组件
 * 展示可用设备并允许用户选择目标设备进行文件传输
 */
const DeviceList = ({
    users,
    currentDeviceId,
    connectionStatus,
    selectedFile,
    transferStatus,
    onStartTransfer
}) => {
    // 过滤掉当前设备
    const availableUsers = users.filter(user => user.id !== currentDeviceId);

    // 检查是否有可用设备
    if (availableUsers.length === 0) {
        return (
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3 text-gray-700">可用设备</h2>
                <div className="bg-yellow-50 rounded-md p-4">
                    <p className="text-center text-yellow-700">
                        {connectionStatus === CONNECTION_STATES.CONNECTED
                            ? '目前没有可用的设备，请等待其他设备连接'
                            : '未连接到服务器，请检查您的网络连接'}
                    </p>
                </div>
            </div>
        );
    }

    // 渲染设备列表
    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">可用设备</h2>
            <div className="divide-y divide-gray-200">
                {availableUsers.map((user) => (
                    <div key={user.id} className="py-3 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                            <p className="text-sm text-gray-500">类型: {user.deviceType}</p>
                            {user.peerId ? (
                                <p className="text-xs text-gray-400">已就绪</p>
                            ) : (
                                <p className="text-xs text-red-400">等待设备就绪</p>
                            )}
                        </div>
                        <button
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => onStartTransfer(user.id)}
                            disabled={!selectedFile || !user.peerId || transferStatus.includes('发送中') || transferStatus === 'connecting'}
                        >
                            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                            发送文件
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DeviceList; 