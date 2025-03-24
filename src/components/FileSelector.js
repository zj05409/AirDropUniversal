import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, FolderIcon, DocumentIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { TRANSFER_CONFIG } from '../utils/config';

/**
 * 文件选择器组件
 * 允许用户选择要发送的文件和文件夹
 */
const FileSelector = ({ selectedFiles, onFileSelect }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const fileInputRef = useRef(null);
    const directoryInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // 检测是否为移动设备
    useEffect(() => {
        const checkMobile = () => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        };
        setIsMobile(checkMobile());
        console.log('检测到设备类型:', checkMobile() ? '移动设备' : '桌面设备');
    }, []);

    // 当选择的项目变化时，更新父组件
    useEffect(() => {
        // 获取所有选中项目的文件对象
        const allFiles = selectedItems.reduce((files, item) => {
            if (item.type === 'file') {
                files.push(item.file);
            } else if (item.type === 'directory' && item.files && Array.isArray(item.files)) {
                console.log(`处理目录: ${item.name}, 包含 ${item.files.length} 个文件`);

                // 将文件夹内的所有文件添加到文件列表
                item.files.forEach(file => {
                    if (file) {
                        // 检查文件是否已经有相对路径
                        if (!file.relativePath) {
                            // 如果没有，设置相对路径
                            const filePath = item.path ? `${item.path}/${file.name}` : file.name;
                            console.log(`为文件 ${file.name} 设置相对路径: ${filePath}`);

                            // 创建一个新文件对象，带有relativePath属性
                            const fileWithPath = new File([file], file.name, {
                                type: file.type,
                                lastModified: file.lastModified
                            });
                            fileWithPath.relativePath = filePath;
                            files.push(fileWithPath);
                        } else {
                            // 已有相对路径，直接使用
                            console.log(`文件 ${file.name} 已有相对路径: ${file.relativePath}`);
                            files.push(file);
                        }
                    }
                });
            }
            return files;
        }, []);

        console.log(`总共处理 ${allFiles.length} 个文件进行传输`);
        onFileSelect(allFiles);
    }, [selectedItems, onFileSelect]);

    // 处理文件选择
    const handleFileSelect = (event) => {
        console.log('文件选择事件触发', {
            isMobile,
            fileCount: event.target.files?.length,
            hasMultiple: event.target.hasAttribute('multiple'),
            multipleValue: event.target.multiple
        });

        // 强制性确保移动设备上多文件选择
        if (isMobile && event.target.files && event.target.files.length === 1 && !event.target.multiple) {
            console.warn('移动设备检测到单选模式，尝试强制启用多选');
            // 保存当前文件
            const currentFile = event.target.files[0];

            // 重置input以便下次选择
            event.target.value = '';

            // 添加单个文件到列表
            if (currentFile && currentFile.size <= TRANSFER_CONFIG.MAX_FILE_SIZE) {
                const newItem = {
                    id: `file-${Date.now()}-${Math.random()}`,
                    name: currentFile.name,
                    size: currentFile.size,
                    type: 'file',
                    file: currentFile
                };

                setSelectedItems(prev => [...prev, newItem]);
                return;
            }
        }

        const files = Array.from(event.target.files || []);
        console.log('选择的文件列表', files.map(f => f.name));

        if (files.length > 0) {
            // 检查每个文件大小
            const invalidFiles = files.filter(file => file.size > TRANSFER_CONFIG.MAX_FILE_SIZE);
            if (invalidFiles.length > 0) {
                alert(`以下文件太大，请选择小于 ${TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB 的文件：\n${invalidFiles.map(f => f.name).join('\n')}`);
                // 过滤掉太大的文件
                const validFiles = files.filter(file => file.size <= TRANSFER_CONFIG.MAX_FILE_SIZE);

                // 添加文件到已选项目
                const newItems = validFiles.map(file => ({
                    id: `file-${Date.now()}-${Math.random()}`,
                    name: file.name,
                    size: file.size,
                    type: 'file',
                    file: file
                }));

                setSelectedItems(prev => [...prev, ...newItems]);
            } else {
                // 添加文件到已选项目
                const newItems = files.map(file => ({
                    id: `file-${Date.now()}-${Math.random()}`,
                    name: file.name,
                    size: file.size,
                    type: 'file',
                    file: file
                }));

                setSelectedItems(prev => [...prev, ...newItems]);
            }
        }
        // 重置 input
        event.target.value = '';
    };

    // 处理文件夹选择
    const handleDirectorySelect = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            // 获取基本文件夹路径（取第一个文件的路径的父目录）
            const firstFilePath = files[0].webkitRelativePath;
            const folderName = firstFilePath.split('/')[0];

            // 检查每个文件大小
            const invalidFiles = files.filter(file => file.size > TRANSFER_CONFIG.MAX_FILE_SIZE);
            if (invalidFiles.length > 0) {
                alert(`文件夹中有${invalidFiles.length}个文件太大，将被跳过`);
                // 过滤掉太大的文件
                const validFiles = files.filter(file => file.size <= TRANSFER_CONFIG.MAX_FILE_SIZE);

                // 添加文件夹到已选项目
                const newItem = {
                    id: `folder-${Date.now()}-${Math.random()}`,
                    name: folderName,
                    type: 'directory',
                    path: folderName,
                    files: validFiles,
                    size: validFiles.reduce((size, file) => size + file.size, 0),
                    fileCount: validFiles.length
                };

                setSelectedItems(prev => [...prev, newItem]);
            } else {
                // 添加文件夹到已选项目
                const newItem = {
                    id: `folder-${Date.now()}-${Math.random()}`,
                    name: folderName,
                    type: 'directory',
                    path: folderName,
                    files: files,
                    size: files.reduce((size, file) => size + file.size, 0),
                    fileCount: files.length
                };

                setSelectedItems(prev => [...prev, newItem]);
            }
        }
        // 重置 input
        event.target.value = '';
    };

    // 处理拖放
    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);

        console.log('接收到拖放事件');

        // 检查是否有dataTransfer项
        if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
            // 使用DataTransferItemList接口处理项目
            console.log(`检测到 ${event.dataTransfer.items.length} 个拖放项目`);
            handleDataTransferItems(Array.from(event.dataTransfer.items));
        } else if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            // 回退到只处理文件
            const files = Array.from(event.dataTransfer.files);
            console.log(`检测到 ${files.length} 个拖放文件`);

            if (files.length > 0) {
                // 检查每个文件大小
                const invalidFiles = files.filter(file => file.size > TRANSFER_CONFIG.MAX_FILE_SIZE);
                if (invalidFiles.length > 0) {
                    alert(`以下文件太大，请选择小于 ${TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB 的文件：\n${invalidFiles.map(f => f.name).join('\n')}`);
                    // 过滤掉太大的文件
                    const validFiles = files.filter(file => file.size <= TRANSFER_CONFIG.MAX_FILE_SIZE);

                    // 添加文件到已选项目
                    const newItems = validFiles.map(file => ({
                        id: `file-${Date.now()}-${Math.random()}`,
                        name: file.name,
                        size: file.size,
                        type: 'file',
                        file: file
                    }));

                    setSelectedItems(prev => [...prev, ...newItems]);
                } else {
                    // 添加文件到已选项目
                    const newItems = files.map(file => ({
                        id: `file-${Date.now()}-${Math.random()}`,
                        name: file.name,
                        size: file.size,
                        type: 'file',
                        file: file
                    }));

                    setSelectedItems(prev => [...prev, ...newItems]);
                }
            }
        } else {
            console.warn('拖放事件没有包含任何文件');
        }
    };

    // 处理DataTransfer项目（包括文件夹）
    const handleDataTransferItems = async (items) => {
        console.log(`开始处理 ${items.length} 个拖拽项目`);
        const newItems = [];
        const processPromises = [];

        // 用于跟踪处理进度
        let processedCount = 0;
        const totalItems = items.length;

        // 遍历所有项，收集处理的Promise
        for (const item of items) {
            // 仅处理文件类型
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

                if (entry) {
                    processedCount++;
                    console.log(`处理第 ${processedCount}/${totalItems} 个项目: ${entry.name}, 类型: ${entry.isFile ? '文件' : '文件夹'}`);

                    if (entry.isFile) {
                        // 处理单个文件
                        const filePromise = new Promise(resolve => {
                            entry.file(file => {
                                if (file.size <= TRANSFER_CONFIG.MAX_FILE_SIZE) {
                                    const fileItem = {
                                        id: `file-${Date.now()}-${Math.random()}`,
                                        name: file.name,
                                        size: file.size,
                                        type: 'file',
                                        file: file
                                    };
                                    newItems.push(fileItem);
                                    console.log(`添加文件: ${file.name}, 大小: ${file.size} 字节`);
                                } else {
                                    console.warn(`文件过大，已跳过: ${file.name}, 大小: ${file.size} 字节`);
                                }
                                resolve();
                            }, error => {
                                console.error(`读取文件失败: ${entry.name}`, error);
                                resolve();
                            });
                        });
                        processPromises.push(filePromise);
                    } else if (entry.isDirectory) {
                        // 处理文件夹 - 将Promise保存到数组，而不是立即await
                        console.log(`将文件夹 ${entry.name} 添加到处理队列`);
                        const dirPromise = processDirectory(entry)
                            .then(dirResult => {
                                // 确保dirResult是有效的且包含files数组
                                if (dirResult && dirResult.files && dirResult.files.length > 0) {
                                    console.log(`文件夹 ${entry.name} 处理完成，包含 ${dirResult.files.length} 个文件`);
                                    newItems.push(dirResult);
                                } else {
                                    console.log(`文件夹 ${entry.name} 为空或处理失败`);
                                }
                            })
                            .catch(error => {
                                console.error(`处理文件夹 ${entry.name} 时出错:`, error);
                            });
                        processPromises.push(dirPromise);
                    }
                } else {
                    console.warn('无法获取入口点，可能不支持webkitGetAsEntry');
                }
            } else {
                console.warn(`跳过非文件类型的项目: ${item.kind}`);
            }
        }

        // 等待所有处理完成
        console.log(`正在等待 ${processPromises.length} 个处理任务完成...`);
        await Promise.all(processPromises);
        console.log(`所有项目处理完成，共添加 ${newItems.length} 个项目`);
        console.log('添加的项目类型统计:',
            newItems.reduce((stats, item) => {
                stats[item.type] = (stats[item.type] || 0) + 1;
                return stats;
            }, {})
        );

        if (newItems.length > 0) {
            console.log('更新选中项目列表');
            setSelectedItems(prev => {
                const combined = [...prev, ...newItems];
                console.log(`更新后的选中项目数量: ${combined.length}`);
                return combined;
            });
        }
    };

    // 递归处理文件夹 - 优化版本
    const processDirectory = async (dirEntry, path = '') => {
        const dirName = dirEntry.name;
        const dirPath = path || dirName;
        console.log(`开始处理目录: ${dirName}, 路径: ${dirPath}`);

        // 生成唯一的文件夹ID
        const folderId = `folder-${Date.now()}-${Math.random()}`;

        // 存储找到的所有文件
        const collectedFiles = [];

        // 创建一个函数来处理单个目录
        const processDir = async (entry, currentPath) => {
            return new Promise(async (resolve, reject) => {
                try {
                    console.log(`处理子目录: ${entry.name}, 路径: ${currentPath}`);
                    const reader = entry.createReader();
                    let entries = [];
                    let readBatch = [];

                    // 读取目录中的所有条目
                    // 注意: readEntries可能一次不会返回所有条目，需要多次调用直到返回空数组
                    do {
                        readBatch = await new Promise((resolveRead, rejectRead) => {
                            reader.readEntries(
                                (result) => resolveRead(result),
                                (error) => rejectRead(error)
                            );
                        });

                        entries = entries.concat(Array.from(readBatch));
                        console.log(`${entry.name} 读取到 ${readBatch.length} 个条目，累计 ${entries.length} 个`);
                    } while (readBatch.length > 0);

                    console.log(`目录 ${entry.name} 中有 ${entries.length} 个条目`);

                    // 创建处理所有条目的Promise数组
                    const entryPromises = entries.map(async (entryItem) => {
                        if (entryItem.isFile) {
                            // 处理文件
                            return new Promise((resolveFile) => {
                                entryItem.file((file) => {
                                    if (file.size <= TRANSFER_CONFIG.MAX_FILE_SIZE) {
                                        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                                        // 创建一个新文件对象，保留原始file的所有属性
                                        const fileWithPath = new File([file], file.name, {
                                            type: file.type,
                                            lastModified: file.lastModified
                                        });
                                        // 添加相对路径信息
                                        fileWithPath.relativePath = filePath;

                                        collectedFiles.push(fileWithPath);
                                        console.log(`${currentPath}: 添加文件: ${file.name}`);
                                    } else {
                                        console.warn(`${currentPath}: 文件过大，已跳过: ${file.name}`);
                                    }
                                    resolveFile();
                                }, (error) => {
                                    console.error(`读取文件失败: ${entryItem.name}`, error);
                                    resolveFile();
                                });
                            });
                        } else if (entryItem.isDirectory) {
                            // 处理子目录
                            const subDirPath = currentPath ? `${currentPath}/${entryItem.name}` : entryItem.name;
                            return processDir(entryItem, subDirPath);
                        }
                    });

                    // 等待所有条目处理完成
                    await Promise.all(entryPromises);
                    resolve();
                } catch (error) {
                    console.error(`处理目录 ${entry.name} 时出错:`, error);
                    // 即使出错也要resolve，不要中断整个处理流程
                    resolve();
                }
            });
        };

        try {
            // 处理根目录
            await processDir(dirEntry, dirPath);

            console.log(`目录 ${dirName} 处理完成，收集到 ${collectedFiles.length} 个文件`);

            // 返回目录对象
            return {
                id: folderId,
                name: dirName,
                type: 'directory',
                path: dirPath,
                files: collectedFiles,
                size: collectedFiles.reduce((size, file) => size + file.size, 0),
                fileCount: collectedFiles.length
            };
        } catch (error) {
            console.error(`处理目录 ${dirName} 失败:`, error);
            // 返回空目录对象
            return {
                id: folderId,
                name: dirName,
                type: 'directory',
                path: dirPath,
                files: [],
                size: 0,
                fileCount: 0
            };
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) {
            setIsDragging(true);
        }
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    // 清除所有选中的项目
    const handleClearAll = () => {
        setSelectedItems([]);
    };

    // 移除单个项目
    const handleRemoveItem = (id) => {
        setSelectedItems(prev => prev.filter(item => item.id !== id));
    };

    // 触发文件选择对话框
    const handleSelectFileClick = () => {
        console.log('点击选择文件按钮', {
            isMobile,
            inputElement: fileInputRef.current,
            hasMultiple: fileInputRef.current?.hasAttribute('multiple'),
            multipleValue: fileInputRef.current?.multiple
        });

        // 确保文件选择器有multiple属性
        if (fileInputRef.current) {
            if (isMobile) {
                console.log('为移动设备明确设置multiple属性');
                fileInputRef.current.setAttribute('multiple', 'multiple');
                fileInputRef.current.multiple = true;
            }
            fileInputRef.current.click();
        }
    };

    // 触发文件夹选择对话框
    const handleSelectFolderClick = () => {
        directoryInputRef.current?.click();
    };

    // 计算所有选择项目的总大小
    const calculateTotalSize = () => {
        return selectedItems.reduce((total, item) => total + item.size, 0);
    };

    // 格式化文件大小显示
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // 渲染信息提示区域
    const renderInfoBox = () => {
        if (isMobile) {
            return (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4 rounded-md">
                    <div className="flex">
                        <InformationCircleIcon className="h-6 w-6 text-yellow-500 mr-2" />
                        <div>
                            <h3 className="font-medium text-yellow-800">移动设备提示</h3>
                            <ul className="text-sm text-yellow-700 list-disc pl-5 mt-1">
                                <li>移动设备不支持选择文件夹功能</li>
                                <li><strong>可以选择多个文件（依次点击多次选择）</strong></li>
                                <li>多个文件将自动打包为ZIP下载</li>
                                <li>单个文件大小限制: {(TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-md">
                <div className="flex">
                    <InformationCircleIcon className="h-6 w-6 text-blue-500 mr-2" />
                    <div>
                        <h3 className="font-medium text-blue-800">文件传输说明</h3>
                        <ul className="text-sm text-blue-700 list-disc pl-5 mt-1">
                            <li>支持同时传输多个文件和文件夹</li>
                            <li>单个文件大小限制: {(TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB</li>
                            <li>文件夹结构将在传输中保留</li>
                            <li>多文件将自动打包为ZIP格式，仅需下载一次</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">选择传输文件</h2>

            {renderInfoBox()}

            <div
                className={`flex flex-col space-y-3 p-6 border-2 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-dashed border-gray-300 hover:bg-gray-100'} rounded-md cursor-pointer transition-colors duration-200`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById('fileInput').click()}
            >
                {isDragging ? (
                    <div className="text-center py-6">
                        <ArrowUpTrayIcon className="h-12 w-12 text-blue-500 mx-auto animate-bounce" />
                        <p className="mt-2 text-lg font-medium text-blue-600">释放鼠标以上传文件</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center items-center">
                            <ArrowUpTrayIcon className="h-10 w-10 text-gray-400" />
                        </div>

                        <p className="text-center text-gray-500">
                            {isMobile
                                ? "点击此处或下方按钮选择多个文件"
                                : "将文件或文件夹拖放到此处，或点击下方按钮选择"}
                        </p>

                        {!isMobile && (
                            <div className="flex items-center justify-center">
                                <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
                                <p className="text-sm text-blue-600">
                                    提示：可以同时拖放多个文件和文件夹，或分别使用下方按钮多次选择
                                </p>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-center space-x-4">
                    {/* 隐藏的文件输入 */}
                    <input
                        ref={fileInputRef}
                        id="fileInput"
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        multiple={true}
                    />

                    {/* 隐藏的文件夹输入（仅桌面设备显示） */}
                    {!isMobile && (
                        <input
                            ref={directoryInputRef}
                            id="directoryInput"
                            type="file"
                            className="hidden"
                            onChange={handleDirectorySelect}
                            webkitdirectory="true"
                            directory="true"
                            multiple
                        />
                    )}

                    {/* 文件选择按钮 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelectFileClick();
                        }}
                        className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        <DocumentIcon className="h-5 w-5 mr-2" />
                        {isMobile ? "选择多个文件" : "选择文件"}
                    </button>

                    {/* 文件夹选择按钮（仅桌面设备显示） */}
                    {!isMobile && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFolderClick();
                            }}
                            className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                        >
                            <FolderIcon className="h-5 w-5 mr-2" />
                            选择文件夹
                        </button>
                    )}
                </div>
            </div>

            {/* 已选文件列表 */}
            {selectedItems.length > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-gray-700">已选择的项目</h3>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-4">
                                共 {selectedItems.length} 个项目，
                                总计：{formatFileSize(calculateTotalSize())}
                            </span>
                            <button
                                onClick={handleClearAll}
                                className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors"
                            >
                                清除全部
                            </button>
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded-md">
                        {selectedItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b last:border-b-0">
                                <div className="flex items-center flex-1 min-w-0">
                                    {item.type === 'directory' ? (
                                        <FolderIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                                    ) : (
                                        <DocumentIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                                    )}
                                    <div className="truncate">
                                        <span className="font-medium">{item.name}</span>
                                        {item.type === 'directory' && (
                                            <span className="text-gray-500 text-xs ml-1">
                                                ({item.fileCount}个文件)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center ml-2">
                                    <span className="text-gray-500 text-sm mr-3">{formatFileSize(item.size)}</span>
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                        title="移除"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileSelector; 