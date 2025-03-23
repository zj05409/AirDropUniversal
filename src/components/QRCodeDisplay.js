import React, { useState, useEffect } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { getAppUrl } from '../utils/networkUtils';

/**
 * QR码显示组件
 * 用于显示应用的访问二维码
 */
const QRCodeDisplay = ({ deviceId, isVisible = true, size = 200 }) => {
    const [appUrl, setAppUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadAppUrl = async () => {
            try {
                setLoading(true);
                setError('');

                // 获取应用URL
                let url = await getAppUrl();

                // 如果提供了设备ID，将其作为参数添加到URL中，便于其他设备直接连接
                if (deviceId) {
                    url += `?connect=${deviceId}&auto=true`;
                }

                setAppUrl(url);
                setLoading(false);
            } catch (err) {
                console.error('加载应用URL失败:', err);
                setError('无法获取应用访问地址');
                setLoading(false);
            }
        };

        if (isVisible) {
            loadAppUrl();
        }
    }, [deviceId, isVisible]);

    if (!isVisible) return null;

    return (
        <div className="p-4 bg-blue-50 rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">扫描二维码连接</h3>

            {loading ? (
                <div className="flex justify-center items-center py-4">
                    <p>正在生成二维码...</p>
                </div>
            ) : error ? (
                <div className="text-red-500 py-4">
                    <p>{error}</p>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-lg shadow-sm mb-2">
                        <QRCode
                            value={appUrl}
                            size={size}
                            qrStyle="dots"
                            eyeRadius={5}
                            bgColor="#FFFFFF"
                            fgColor="#000000"
                        />
                    </div>
                    <p className="text-sm text-gray-600 mt-2 break-all">
                        {appUrl}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        扫描此二维码或使用浏览器访问上方链接
                    </p>
                </div>
            )}
        </div>
    );
};

export default QRCodeDisplay; 