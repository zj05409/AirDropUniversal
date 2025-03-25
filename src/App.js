import React, { useState, useEffect, useRef } from 'react';

// 导入组件
import DeviceRegistration from './components/DeviceRegistration';
import FileSelector from './components/FileSelector';
import DeviceList from './components/DeviceList';
import TransferStatus from './components/TransferStatus';
import ErrorMessage from './components/ErrorMessage';
import QRCodeDisplay from './components/QRCodeDisplay';

// 导入服务和工具
import socket, {
    initSocketListeners,
    cleanupSocketListeners,
    registerDevice as registerDeviceToServer,
    reconnectDevice,
    updatePeerId
} from './services/socketService';
import {
    createPeerInstance,
    createPeerConnection,
    cleanupPeer
} from './services/peerService';
import {
    sendFile,
    setupFileReceiver,
    // 这些导入当前被ESLint警告为未使用
    // saveReceivedFile,
    // checkFilesContainFolders
} from './services/fileTransferService';
import {
    loadDeviceInfo,
    saveDeviceInfo,
    resetAllStorage,
    getPermanentPeerId,
    savePermanentPeerId,
    // 这个导入当前被ESLint警告为未使用
    // syncPeerIdWithDeviceInfo
} from './utils/deviceStorage';
import { generateValidPeerId } from './utils/peerUtils';
import { CONNECTION_STATES, TRANSFER_STATES, TRANSFER_CONFIG } from './utils/config';

/**
 * 主应用组件
 */
function App() {
    // 状态管理
    const [users, setUsers] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [transferProgress, setTransferProgress] = useState(0);
    const [deviceName, setDeviceName] = useState('');
    const [deviceType, setDeviceType] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
    const [transferState, setTransferState] = useState(TRANSFER_STATES.IDLE);
    const [target, setTarget] = useState(null);
    const [peer, setPeer] = useState(null);
    const [error, setError] = useState('');
    const [qrCodeVisible, setQrCodeVisible] = useState(false);
    const [serverUrl, setServerUrl] = useState('');
    const [batchFiles, setBatchFiles] = useState(null);

    // 引用管理
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const connectionsRef = useRef({});
    const transferStartTimeRef = useRef(null);
    const transferTimeoutRef = useRef(null);
    const fileMetadataRef = useRef(null);
    const receivedChunksRef = useRef([]);
    const fileSelectorRef = useRef(null);

    // 处理设备注册
    const handleRegisterDevice = () => {
        if (!deviceName || !deviceType) return;

        // 使用 Socket ID 作为设备 ID
        const newDeviceId = socket.id;
        setDeviceId(newDeviceId);

        // 生成新的 Peer ID 或使用已存在的
        let newPeerId = getPermanentPeerId();
        let isNewId = false;

        if (!newPeerId) {
            newPeerId = generateValidPeerId();
            isNewId = true;
            savePermanentPeerId(newPeerId);
            console.log('生成新的永久 Peer ID:', newPeerId);
        } else {
            console.log('使用永久存储的 Peer ID:', newPeerId);
        }

        setPeer(newPeerId);

        // 创建设备信息
        const deviceInfo = {
            id: newDeviceId,
            name: deviceName,
            deviceType: deviceType,
            socketId: socket.id,
            peerId: newPeerId
        };

        // 保存设备信息
        saveDeviceInfo(deviceInfo);
        console.log('注册新设备:', deviceInfo);

        // 注册到服务器
        registerDeviceToServer(deviceInfo);

        // 初始化 PeerJS
        initializePeerJS();

        // 如果是电脑设备（笔记本或台式机），显示QR码
        if (deviceType === 'laptop' || deviceType === 'desktop') {
            setQrCodeVisible(true);
        } else {
            setQrCodeVisible(false);
        }
    };

    // 处理设备重置
    const handleResetDevice = () => {
        // 清理资源
        cleanupPeer(peerRef.current, connectionsRef.current);

        // 重置状态
        setPeer(null);
        setDeviceId('');
        setDeviceName('');
        setDeviceType('');
        setUsers([]);
        setSelectedFiles([]);
        setTransferProgress(0);
        setTransferState(TRANSFER_STATES.IDLE);
        setError('');
        setQrCodeVisible(false);

        // 清除存储
        resetAllStorage();

        // 刷新页面以完全重置状态
        window.location.reload();
    };

    // 初始化 PeerJS
    const initializePeerJS = async () => {
        try {
            // 清理现有 Peer 实例
            if (peerRef.current) {
                cleanupPeer(peerRef.current);
                peerRef.current = null;
            }

            // 创建新的 Peer 实例
            const { peer, peerId } = await createPeerInstance({
                deviceId: deviceId,
                onOpen: (id) => {
                    setPeer(id);

                    // 通知服务器更新 Peer ID
                    if (deviceId) {
                        updatePeerId(deviceId, id);
                    }

                    // 连接成功后清除任何错误提示
                    setError('');
                    setConnectionState(CONNECTION_STATES.CONNECTED);
                },
                onConnection: handleIncomingConnection,
                onError: (err) => {
                    console.error('PeerJS 错误:', err);

                    // 如果不是因为ID已被使用的错误，才显示错误信息
                    // ID已被使用会在peerService中自动处理
                    if (err.type !== 'unavailable-id') {
                        setError(`PeerJS 错误: ${err.message}`);
                    }
                },
                onDisconnected: () => {
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                }
            });

            peerRef.current = peer;

            // PeerJS连接成功，更新设备信息中的peerId
            if (deviceId && peerId) {
                const savedInfo = loadDeviceInfo();
                if (savedInfo) {
                    savedInfo.peerId = peerId;
                    saveDeviceInfo(savedInfo);
                }
            }

            return peer;
        } catch (error) {
            console.error('初始化 PeerJS 失败:', error);

            // 如果是网络连接问题，设置更明确的错误消息
            if (error.message.includes('网络连接错误') || error.message.includes('连接超时')) {
                setError('网络连接不稳定，请检查网络后刷新页面');
            } else {
                setError(`无法初始化 Peer 连接: ${error.message}`);
            }

            setConnectionState(CONNECTION_STATES.ERROR);
            throw error;
        }
    };

    // 处理接收文件的连接
    const handleIncomingConnection = (conn) => {
        console.log('收到来自以下设备的连接:', conn.peer);

        // 保存连接以供后续使用
        connectionsRef.current[conn.peer] = conn;

        // 设置接收者
        const cleanup = setupFileReceiver(conn, {
            onMetadata: (metadata) => {
                console.log('接收文件元数据:', metadata);
                fileMetadataRef.current = metadata;
                receivedChunksRef.current = [];

                // 设置超时检测
                if (transferTimeoutRef.current) {
                    clearTimeout(transferTimeoutRef.current);
                }

                transferTimeoutRef.current = setTimeout(() => {
                    console.log('文件传输超时');
                    setError('文件传输超时，请重试');
                    setTransferState(TRANSFER_STATES.ERROR);
                }, TRANSFER_CONFIG.CHUNK_TIMEOUT * (metadata.totalChunks + 5)); // 额外时间用于建立连接等

                setTransferState(metadata.totalFiles > 1 ?
                    `${TRANSFER_STATES.RECEIVING} (${metadata.fileIndex + 1}/${metadata.totalFiles})` :
                    TRANSFER_STATES.RECEIVING);
            },
            onProgress: (progress) => {
                setTransferProgress(progress);
            },
            onBatchStart: (batchInfo) => {
                console.log('开始接收批量文件:', batchInfo);
                setTransferState(`准备接收 ${batchInfo.totalFiles} 个文件`);
            },
            onBatchProgress: (overallProgress, fileIndex, fileProgress) => {
                setTransferProgress(overallProgress);
            },
            onBatchEnd: (batchInfo, files, shouldResetUI) => {
                console.log('批量文件接收完成:', batchInfo);
                // 清除超时
                if (transferTimeoutRef.current) {
                    clearTimeout(transferTimeoutRef.current);
                    transferTimeoutRef.current = null;
                }

                // 如果需要完全重置UI
                if (shouldResetUI) {
                    setTransferState('');
                    setTransferProgress(0);
                    setBatchFiles(null);
                    fileMetadataRef.current = null;
                    receivedChunksRef.current = [];

                    // 重置文件选择器
                    if (fileSelectorRef.current) {
                        fileSelectorRef.current.resetFiles();
                    }
                }

                // 不在这里修改状态，让文件保存流程完成后统一更新
            },
            onComplete: (blob, metadata, autoSaved) => {
                console.log(`文件 "${metadata.fileName}" 接收完成，自动保存: ${autoSaved}`);

                // 清除超时
                if (transferTimeoutRef.current) {
                    clearTimeout(transferTimeoutRef.current);
                    transferTimeoutRef.current = null;
                }

                // 不在这里更新状态，让统一的状态管理逻辑处理
            },
            onError: (err) => {
                console.error('接收文件时出错:', err);
                setError(err.message || '文件接收失败');
                setTransferState(TRANSFER_STATES.ERROR);

                // 清除超时
                if (transferTimeoutRef.current) {
                    clearTimeout(transferTimeoutRef.current);
                    transferTimeoutRef.current = null;
                }
            },
            onStatusChange: (status) => {
                setTransferState(status);
            }
        });

        // 设置连接关闭事件
        conn.on('close', () => {
            console.log('连接已关闭');
            delete connectionsRef.current[conn.peer];

            // 如果传输未完成，显示错误
            if (fileMetadataRef.current &&
                receivedChunksRef.current.length < fileMetadataRef.current.totalChunks) {
                setError('连接已关闭，文件传输未完成');
            }

            // 清理资源
            cleanup();
        });
    };

    // 检查文件是否包含文件夹
    const checkFilesContainFolders = (files) => {
        if (!files || files.length === 0) return false;
        return files.some(file => file.relativePath && file.relativePath.includes('/'));
    };

    // 更新传输进度和状态信息
    const handleTransferProgress = (progress) => {
        setTransferProgress(progress);

        // 更新传输速度
        if (transferStartTimeRef.current && selectedFiles.length > 0) {
            const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
            const elapsedTime = (Date.now() - transferStartTimeRef.current) / 1000; // 秒
            if (elapsedTime > 0) {
                const transferredBytes = totalSize * (progress / 100);
                const bytesPerSecond = transferredBytes / elapsedTime;

                setBatchFiles({
                    totalFiles: selectedFiles.length,
                    totalSize: totalSize,
                    speed: bytesPerSecond,
                    containsFolders: checkFilesContainFolders(selectedFiles)
                });
            }
        }
    };

    // 更新传输状态
    const handleTransferState = (status) => {
        setTransferState(status);

        // 如果是开始传输，记录开始时间
        if (status === TRANSFER_STATES.SENDING || status.includes('发送中')) {
            transferStartTimeRef.current = Date.now();

            // 初始化传输统计信息
            if (selectedFiles.length > 0) {
                const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
                setBatchFiles({
                    totalFiles: selectedFiles.length,
                    totalSize: totalSize,
                    speed: 0,
                    containsFolders: checkFilesContainFolders(selectedFiles)
                });
            }
        }

        // 如果传输完成或出错，重置统计信息
        if (status === TRANSFER_STATES.COMPLETED || status === TRANSFER_STATES.ERROR || status === '') {
            transferStartTimeRef.current = null;
        }
    };

    // 处理开始传输
    const handleStartTransfer = async (targetId) => {
        try {
            console.log('开始传输文件到:', targetId);

            // 检查是否选择了文件
            if (!selectedFiles || selectedFiles.length === 0) {
                setError('请先选择文件或文件夹');
                return;
            }

            // 计算文件总大小
            const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

            // 检查是否包含文件夹
            const containsFolders = checkFilesContainFolders(selectedFiles);

            // 显示确认对话框
            let confirmMessage = `确定要传输 ${selectedFiles.length} 个项目 (${totalSizeMB} MB)`;
            if (containsFolders) {
                confirmMessage += '，包含文件夹结构';
            }
            confirmMessage += '?';

            if (!window.confirm(confirmMessage)) {
                return;
            }

            setTransferState(TRANSFER_STATES.CONNECTING);
            setError('');

            // 初始化传输统计信息
            setBatchFiles({
                totalFiles: selectedFiles.length,
                totalSize: totalSize,
                speed: 0,
                containsFolders: containsFolders
            });

            // 获取目标用户的 Peer ID
            const targetUser = users.find(user => user.id === targetId);
            if (!targetUser) {
                throw new Error('找不到目标设备');
            }
            if (!targetUser.peerId) {
                throw new Error('目标设备未就绪，请等待对方刷新页面');
            }

            console.log('目标设备信息:', targetUser);

            // 确保本地 Peer 已初始化
            if (!peerRef.current) {
                console.log('初始化本地 Peer...');
                await initializePeerJS();
            }

            // 创建到目标设备的连接
            const conn = await createPeerConnection(peerRef.current, targetUser.peerId, {
                onOpen: () => {
                    console.log('与目标设备的连接已建立');
                },
                onClose: () => {
                    console.log('与目标设备的连接已关闭');

                    // 如果传输未完成，显示错误
                    if (transferState.includes('发送中')) {
                        setError('连接已关闭，文件传输未完成');
                        setTransferState(TRANSFER_STATES.ERROR);
                    }
                },
                onError: (err) => {
                    console.error('连接错误:', err);
                    setError(`连接错误: ${err.message}`);
                    setTransferState(TRANSFER_STATES.ERROR);
                }
            });

            // 记录传输开始时间
            transferStartTimeRef.current = Date.now();

            // 发送文件 - 支持多文件和文件夹
            await sendFile(conn, selectedFiles,
                handleTransferProgress,
                handleTransferState
            );

            // 发送完成后，显示成功提示并重置状态
            alert('文件传输成功完成！');
            setTimeout(() => {
                setTransferState('');
                setTransferProgress(0);
                setBatchFiles(null);
                // 清空已选文件列表，以便用户可以重新选择文件
                if (fileSelectorRef.current) {
                    fileSelectorRef.current.resetFiles();
                }
            }, 1500);
        } catch (err) {
            console.error('传输错误:', err);
            setError(err.message || '传输失败');
            setTransferState(TRANSFER_STATES.ERROR);
            setBatchFiles(null);

            // 显示错误提示并重置UI
            alert(`传输失败: ${err.message || '未知错误'}`);
            setTimeout(() => {
                setTransferState('');
                setTransferProgress(0);
                // 保留选择的文件，以便用户可以重试
            }, 3000);
        }
    };

    // 初始化时加载保存的设备信息并设置事件处理
    useEffect(() => {
        // 初始化 Socket.IO 事件监听
        initSocketListeners({
            onConnect: (socketId) => {
                setConnectionState(CONNECTION_STATES.CONNECTED);
                setError('');

                // 如果有保存的设备信息，自动重新注册
                const savedInfo = loadDeviceInfo();
                if (savedInfo) {
                    console.log('连接成功后重新注册设备...');
                    reconnectDevice(savedInfo);
                }
            },
            onDisconnect: () => {
                setConnectionState(CONNECTION_STATES.DISCONNECTED);
            },
            onConnectError: (error) => {
                console.error('连接错误:', error);
                setConnectionState(CONNECTION_STATES.ERROR);
                setError('无法连接到服务器，请检查网络连接');
            },
            onReconnect: () => {
                setConnectionState(CONNECTION_STATES.CONNECTED);

                // 重新注册设备
                const savedInfo = loadDeviceInfo();
                if (savedInfo) {
                    console.log('重连成功后重新注册设备...');
                    reconnectDevice(savedInfo);
                }
            },
            onUserList: (userList) => {
                setUsers(userList);
                setConnectionState(CONNECTION_STATES.CONNECTED);
            },
            onRegistered: () => {
                setConnectionState(CONNECTION_STATES.CONNECTED);
            },
            onReconnected: () => {
                setConnectionState(CONNECTION_STATES.CONNECTED);
            },
            onPeerIdUpdated: (data) => {
                if (data.id === deviceId) {
                    setPeer(data.peerId);
                }
            }
        });

        // 如果有保存的设备信息，恢复设备状态
        const savedInfo = loadDeviceInfo();
        if (savedInfo) {
            console.log('找到保存的设备信息，恢复状态...');
            setDeviceName(savedInfo.name);
            setDeviceType(savedInfo.deviceType);
            setDeviceId(savedInfo.id);
            setPeer(savedInfo.peerId);

            // 如果是电脑设备，显示QR码
            if (savedInfo.deviceType === 'laptop' || savedInfo.deviceType === 'desktop') {
                setQrCodeVisible(true);
            }
        }

        // 清理函数，组件卸载时执行
        return () => {
            console.log('清理 Socket.IO 监听器...');
            cleanupSocketListeners();

            // 清理peer连接
            if (peerRef.current) {
                console.log('清理 Peer 实例...');
                cleanupPeer(peerRef.current, connectionsRef.current);
                peerRef.current = null;
                connectionsRef.current = {};
            }
        };
    }, []);

    // 当设备ID变化时，初始化PeerJS
    useEffect(() => {
        if (deviceId) {
            console.log('设备ID变化，初始化PeerJS...');
            initializePeerJS()
                .catch(err => console.error('初始化PeerJS失败:', err));
        }
    }, [deviceId]);

    // 用于当Socket连接时重新注册设备的useEffect
    useEffect(() => {
        // 监听socket连接状态
        if (connectionState === CONNECTION_STATES.CONNECTED && deviceId) {
            // 恢复设备连接
            const savedInfo = loadDeviceInfo();
            if (savedInfo) {
                console.log('Socket已连接，重新注册设备...');
                // 确保使用更新后的socketId
                savedInfo.socketId = socket.id;
                reconnectDevice(savedInfo);
            }
        }
    }, [connectionState, deviceId]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
                {/* 页面标题 */}
                <div className="bg-blue-500 text-white p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">AirDrop 通用版</h1>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm">
                            {connectionState === CONNECTION_STATES.CONNECTED ? '已连接' :
                                connectionState === CONNECTION_STATES.DISCONNECTED ? '已断开' : '连接出错'}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${connectionState === CONNECTION_STATES.CONNECTED ? 'bg-green-400' :
                            connectionState === CONNECTION_STATES.DISCONNECTED ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></div>
                    </div>
                </div>

                {/* 主内容区域 */}
                <div className="p-4 sm:p-6">
                    {/* 设备注册表单 */}
                    {!deviceId ? (
                        <DeviceRegistration
                            deviceName={deviceName}
                            setDeviceName={setDeviceName}
                            deviceType={deviceType}
                            setDeviceType={setDeviceType}
                            onRegister={handleRegisterDevice}
                        />
                    ) : (
                        <div>
                            {/* 设备信息 */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-semibold text-gray-700">设备信息</h2>
                                    <button
                                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 rounded-md"
                                        onClick={handleResetDevice}
                                    >
                                        重置设备
                                    </button>
                                </div>
                                <p className="text-gray-600 mt-2">
                                    设备名称: <span className="font-semibold">{deviceName}</span> ({deviceType})
                                </p>
                            </div>

                            {/* QR码显示 - 条件渲染 */}
                            {qrCodeVisible && (
                                <QRCodeDisplay
                                    url={window.location.href}
                                    deviceInfo={{ name: deviceName, type: deviceType }}
                                />
                            )}

                            {/* 文件选择器 */}
                            <FileSelector
                                ref={fileSelectorRef}
                                onFileSelect={setSelectedFiles}
                            />

                            {/* 设备列表 */}
                            <DeviceList
                                users={users.filter(user => user.id !== deviceId)} // 排除自己
                                onStartTransfer={handleStartTransfer}
                                disabled={!selectedFiles?.length || transferState !== ''}
                            />

                            {/* 传输状态 */}
                            {transferState && (
                                <TransferStatus
                                    status={transferState}
                                    progress={transferProgress}
                                    transferStats={batchFiles || null}
                                />
                            )}

                            {/* 错误消息 */}
                            {error && (
                                <ErrorMessage
                                    message={error}
                                    onDismiss={() => setError('')}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* 页脚 */}
                <div className="bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                    AirDrop 通用版 &copy; {new Date().getFullYear()} - 支持多设备文件共享
                </div>
            </div>
        </div>
    );
}

export default App; 