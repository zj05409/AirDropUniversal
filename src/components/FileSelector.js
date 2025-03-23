import React from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { TRANSFER_CONFIG } from '../utils/config';

/**
 * 文件选择器组件
 * 允许用户选择要发送的文件
 */
const FileSelector = ({ selectedFile, onFileSelect }) => {
    // 处理文件选择
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // 检查文件大小
            if (file.size > TRANSFER_CONFIG.MAX_FILE_SIZE) {
                alert(`文件太大，请选择小于 ${TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB 的文件`);
                // 重置 input
                event.target.value = '';
                return;
            }
            onFileSelect(file);
        }
    };

    // 处理拖放文件
    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files[0];
        if (file) {
            // 检查文件大小
            if (file.size > TRANSFER_CONFIG.MAX_FILE_SIZE) {
                alert(`文件太大，请选择小于 ${TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB 的文件`);
                return;
            }
            onFileSelect(file);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">选择要发送的文件</h2>
            <div className="flex items-center space-x-3">
                <label className="flex-1">
                    <div
                        className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:bg-gray-100"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <div className="space-y-1 text-center">
                            <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                    <span>选择文件</span>
                                    <input
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        className="sr-only"
                                        onChange={handleFileSelect}
                                    />
                                </label>
                                <p className="pl-1">或拖拽文件到此处</p>
                            </div>
                            <p className="text-xs text-gray-500">
                                文件大小不超过 {TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB
                            </p>
                        </div>
                    </div>
                </label>
            </div>

            {selectedFile && (
                <div className="mt-3 text-center">
                    <p className="text-sm font-medium text-gray-700">
                        已选择: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                </div>
            )}
        </div>
    );
};

export default FileSelector; 