# AirDrop 通用版

一个类似于 AirDrop 的文件传输工具，支持各种设备之间的文件传输，基于 WebRTC 技术。

## 功能特点

- 跨平台文件传输：适用于手机、平板、笔记本和台式机
- 无需安装额外应用：直接在浏览器中运行
- P2P 传输：文件直接在设备间传输，不经过服务器
- 快速高效：利用 WebRTC 技术提供高速传输
- 易于使用：简洁直观的用户界面

## 技术栈

- 前端：React + Tailwind CSS
- 实时通信：Socket.IO
- P2P 连接：PeerJS (WebRTC)
- 服务器：Express

## 安装和运行

### 前置要求

- Node.js 14.x 或更高版本
- npm 6.x 或更高版本

### 安装步骤

1. 克隆项目仓库：

```bash
git clone <仓库链接>
cd AirDropUniversal
```

2. 安装依赖：

```bash
npm install
```

3. 启动开发服务器：

```bash
npm start
```

4. 启动 PeerJS 和 Socket.IO 服务器：

```bash
node server.js
```

### 生产环境部署

构建生产版本：

```bash
npm run build
```

然后使用以下命令启动服务器：

```bash
NODE_ENV=production node server.js
```

## 使用方法

1. 访问应用：在浏览器中打开 `http://localhost:3000`
2. 注册设备：提供设备名称和类型
3. 传输文件：
   - 选择要发送的文件
   - 从设备列表中选择目标设备
   - 点击"发送文件"按钮
4. 接收文件：当其他设备发送文件给你时，会自动接收并提示下载

## 网络要求

- 在同一局域网内的设备可以直接连接
- 不同网络环境下的设备需要通过 STUN/TURN 服务器进行连接
- 默认使用 Google 的公共 STUN 服务器，可以在配置中修改

## 配置说明

服务器和客户端配置位于 `src/utils/config.js` 文件中，可以根据需要修改：

- `PEER_SERVER_CONFIG`：PeerJS 服务器配置
- `SOCKET_CONFIG`：Socket.IO 配置
- `TRANSFER_CONFIG`：文件传输配置

## 故障排除

1. **无法连接到其他设备**
   - 确保所有设备都已注册并在线
   - 检查是否在同一网络环境下
   - 刷新页面重新建立连接

2. **文件传输失败**
   - 确认文件大小不超过限制（默认 100MB）
   - 检查网络连接是否稳定
   - 尝试重新发送

3. **Peer ID 冲突**
   - 刷新页面重新获取 Peer ID

## 许可证

[MIT License](LICENSE)

## 贡献指南

欢迎提交 Pull Request 或提出 Issue 来完善这个项目。 