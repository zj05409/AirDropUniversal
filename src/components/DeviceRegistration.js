import React, { useState, useEffect } from 'react';
import { DEVICE_TYPES } from '../utils/config';

/**
 * 设备注册组件
 * 用于注册新设备或显示已注册设备的信息
 */
const DeviceRegistration = ({
    isRegistered,
    deviceName,
    setDeviceName,
    deviceType,
    setDeviceType,
    peerId,
    connectionStatus,
    onRegister,
    onReset
}) => {
    // 使用useEffect自动生成设备类型和设备名称
    useEffect(() => {
        // 如果设备类型和名称尚未设置，则自动生成
        if (!deviceType || !deviceName) {
            // 自动检测设备类型
            const detectDeviceType = () => {
                const ua = navigator.userAgent;
                if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
                    // 移动设备检测
                    if (/iPad|Tablet|PlayBook/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
                        return DEVICE_TYPES.TABLET;
                    } else {
                        return DEVICE_TYPES.PHONE;
                    }
                } else {
                    // 桌面设备检测
                    if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua)) {
                        return DEVICE_TYPES.LAPTOP;
                    } else {
                        return DEVICE_TYPES.DESKTOP;
                    }
                }
            };

            // 生成默认设备名称
            const generateDeviceName = (type) => {
                const browserInfo = navigator.userAgent.match(/(chrome|safari|firefox|edge|opera|trident(?=\/))\/?\s*(\d+)/i) || [];
                const browser = browserInfo[1] || "浏览器";

                const os = (() => {
                    if (/Windows/.test(navigator.userAgent)) return "Windows";
                    if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent)) return "Mac";
                    if (/Android/.test(navigator.userAgent)) return "Android";
                    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "iOS";
                    if (/Linux/.test(navigator.userAgent)) return "Linux";
                    return "设备";
                })();

                const deviceMap = {
                    [DEVICE_TYPES.PHONE]: `${os}手机`,
                    [DEVICE_TYPES.TABLET]: `${os}平板`,
                    [DEVICE_TYPES.LAPTOP]: `${os}笔记本`,
                    [DEVICE_TYPES.DESKTOP]: `${os}台式机`
                };

                return deviceMap[type] || `我的${browser}设备`;
            };

            // 获取并设置设备类型
            const detectedType = detectDeviceType();
            setDeviceType(detectedType);

            // 根据设备类型生成设备名称
            setDeviceName(generateDeviceName(detectedType));
        }
    }, [deviceType, deviceName, setDeviceName, setDeviceType]);

    // 如果已注册，显示设备信息
    if (isRegistered) {
        return (
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-medium text-gray-900">{deviceName}</h2>
                        <p className="text-sm text-gray-500">类型: {deviceType}</p>
                        <p className="text-xs text-gray-400 mt-1">Peer ID: {peerId}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${connectionStatus === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : connectionStatus === 'error'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {connectionStatus === 'connected'
                                ? '已连接'
                                : connectionStatus === 'error'
                                    ? '连接错误'
                                    : '未连接'}
                        </div>
                        <button
                            onClick={onReset}
                            className="ml-2 inline-flex items-center px-2 py-1 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            重置
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 否则显示注册表单
    return (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-3 text-blue-800">请注册您的设备</h2>
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deviceName">
                        设备名称
                    </label>
                    <input
                        type="text"
                        id="deviceName"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        placeholder="输入您的设备名称"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deviceType">
                        设备类型
                    </label>
                    <select
                        id="deviceType"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={deviceType}
                        onChange={(e) => setDeviceType(e.target.value)}
                    >
                        <option value="">选择设备类型</option>
                        <option value={DEVICE_TYPES.PHONE}>手机</option>
                        <option value={DEVICE_TYPES.TABLET}>平板</option>
                        <option value={DEVICE_TYPES.LAPTOP}>笔记本</option>
                        <option value={DEVICE_TYPES.DESKTOP}>台式机</option>
                    </select>
                </div>
                <button
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={onRegister}
                    disabled={!deviceName || !deviceType}
                >
                    注册设备
                </button>
            </div>
        </div>
    );
};

export default DeviceRegistration; 