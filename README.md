# AirDrop 通用版

一个类似于 AirDrop 的文件传输工具，支持各种设备之间的文件传输，基于 WebRTC 技术。通过局域网实现多设备间的快速文件共享，同时提供桌面应用和Web访问两种使用方式。

## 功能特点

- **跨平台文件传输**：适用于手机、平板、笔记本和台式机等多种设备
- **双重访问模式**：可通过浏览器访问或使用Electron桌面应用
- **P2P 直接传输**：文件直接在设备间传输，不经过中央服务器，保护隐私
- **快速高效**：利用 WebRTC 技术提供高速传输，适合大文件共享
- **易于使用**：简洁直观的用户界面，拖放即可发送文件
- **局域网内工作**：在同一局域网内的设备可以互相发现并传输文件
- **无需注册账号**：即开即用，无需注册账号或登录
- **开源免费**：完全开源，可自由定制和部署

## 技术栈

- **前端**：React 18 + Tailwind CSS
- **后端**：Node.js + Express
- **实时通信**：Socket.IO（用于设备发现和信令）
- **P2P 连接**：PeerJS (基于WebRTC技术实现点对点连接)
- **桌面应用**：Electron (打包为跨平台桌面应用)

## 系统要求

- **浏览器支持**：Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- **操作系统**：
  - Web版：任何支持现代浏览器的操作系统
  - 桌面应用：Windows 10/11, macOS 10.13+, Linux (Ubuntu 18.04+)
- **网络环境**：所有设备需要在同一局域网内

## 安装和运行

### 前置要求

- Node.js 14.x 或更高版本（推荐使用 Node.js 18+）
- npm 6.x 或更高版本（或使用yarn）
- Git（克隆源码时需要）
- 用于构建Electron应用：
  - macOS: Xcode命令行工具
  - Windows: Visual Studio Build Tools
  - Linux: 基本构建工具(gcc, g++等)

### 获取源码

```bash
git clone https://github.com/your-username/AirDropUniversal.git
cd AirDropUniversal
```

### 安装依赖

```bash
npm install
```

## 运行方式

### 方式一：Web应用（开发模式）

1. 启动前端开发服务器：

```bash
npm start
```

2. 在另一个终端窗口启动后端服务器：

```bash
npm run server
```

3. 访问应用：在浏览器中打开 `http://localhost:3000`

### 方式二：Web应用（生产模式）

1. 构建前端：

```bash
npm run build
```

2. 启动生产服务器：

```bash
NODE_ENV=production node server.js
```

3. 访问应用：在浏览器中打开 `http://<服务器IP>:3001`

### 方式三：Electron桌面应用（开发模式）

运行以下命令启动开发模式的Electron应用：

```bash
npm run electron-dev
```

### 方式四：Electron桌面应用（生产模式）

> **重要说明**：本项目不提供预构建的安装包，您需要自行构建安装包。

#### 构建桌面应用安装包

```bash
# 先构建React应用
npm run build

# 然后构建对应平台的安装包
# MacOS系统
npm run build-electron-mac

# Windows系统
npm run build-electron-win

# Linux系统
npm run build-electron-linux

# 或构建所有平台（需要在对应平台上运行）
npm run build-electron-all
```

构建完成后，安装包将位于`dist`目录中：
- MacOS：`dist/AirDrop Universal-1.0.0.dmg`
- Windows：`dist/AirDrop Universal Setup 1.0.0.exe`
- Linux：`dist/airdrop-universal-1.0.0.AppImage`

## 使用指南

### 设备发现与连接

1. **启动应用**：
   - 桌面用户：运行已安装的Electron应用
   - 移动设备/其他电脑：在浏览器中访问`http://<服务器IP>:3001`

2. **设备注册**：
   - 首次使用时，系统会要求输入设备名称和选择设备类型
   - 每个设备会获得唯一标识符，便于后续识别

3. **查看在线设备**：
   - 应用会自动显示同一局域网内的其他设备
   - 设备列表实时更新，显示设备名称和类型

### 发送文件

1. 选择要发送的文件：
   - 点击"选择文件"按钮或拖放文件到指定区域
   - 支持单个文件发送，最大文件大小为100MB

2. 选择目标设备：
   - 从在线设备列表中选择要发送到的设备

3. 发送文件：
   - 点击"发送"按钮开始传输
   - 传输进度会实时显示

### 接收文件

当其他设备向您发送文件时：
1. 系统会自动接收并处理文件数据
2. 传输完成后，文件会自动下载到您的设备上
3. 在桌面应用中，您可以选择保存位置

## 项目结构

```
AirDropUniversal/
├── build/                # 构建后的前端代码
├── electron/             # Electron应用相关代码
│   ├── index.js          # 主入口点
│   ├── main.js           # Electron主进程代码
│   ├── preload.js        # 预加载脚本
│   └── production-starter.js # 生产环境启动脚本
├── public/               # 静态资源文件
├── scripts/              # 脚本文件
│   └── electron-starter.js # Electron开发环境启动脚本
├── src/                  # 前端源代码
│   ├── components/       # React组件
│   ├── services/         # 服务逻辑
│   ├── utils/            # 工具函数和配置
│   └── App.js            # 主应用组件
├── server.js             # 后端服务器代码
├── package.json          # 项目配置和依赖
└── README.md             # 项目说明文档
```

## 配置说明

### 基本配置

服务器和客户端配置位于 `src/utils/config.js` 文件中：

- `PEER_SERVER_CONFIG`：PeerJS服务器配置，包括STUN/TURN服务器设置
- `SOCKET_CONFIG`：Socket.IO配置，控制实时通信参数
- `TRANSFER_CONFIG`：文件传输配置，包括分块大小和超时设置

### 高级配置

如需自定义构建配置，可修改`package.json`文件中的`build`部分：

```json
"build": {
    "appId": "com.airdrop.universal",
    "productName": "AirDrop Universal",
    "files": [
        "build/**/*",
        "electron/**/*",
        "server.js"
    ],
    ...
}
```

## 网络要求

- **局域网连接**：默认情况下，所有设备需要在同一局域网内
- **端口要求**：
  - 3000：前端Web服务（开发模式）
  - 3001：API和Socket.IO服务
  - 9000：PeerJS服务
- **防火墙设置**：确保以上端口在防火墙中开放

## 故障排除

### 常见问题

1. **设备无法相互发现**
   - 检查所有设备是否在同一局域网内
   - 确保路由器允许局域网内设备相互访问
   - 检查防火墙设置是否阻止了相关端口

2. **文件传输中断**
   - 确保在传输过程中设备保持连接状态
   - 大文件传输可能需要较长时间，保持应用处于活动状态
   - 检查设备存储空间是否充足

3. **应用无法启动**
   - 检查端口3000、3001和9000是否被其他应用占用
   - 确认Node.js和npm版本是否符合要求
   - 检查是否正确安装了所有依赖

4. **Electron构建问题**
   - 确保安装了所有必要的构建工具
   - 尝试清除缓存后重新构建：`rm -rf dist && npm run build-electron-mac`
   - 检查electron-builder日志以获取详细错误信息

5. **移动设备上的浏览器兼容性**
   - 优先使用Chrome或Safari浏览器
   - 某些移动浏览器可能限制文件访问或下载功能
   - 确保允许浏览器存储文件和处理下载

### 日志和诊断

- 前端控制台日志提供详细的连接和传输信息
- 服务器日志记录在终端中
- Electron应用日志位于：
  - macOS: `~/Library/Logs/AirDrop Universal/main.log`
  - Windows: `%USERPROFILE%\AppData\Roaming\AirDrop Universal\logs\main.log`
  - Linux: `~/.config/AirDrop Universal/logs/main.log`

## 贡献指南

欢迎为本项目做出贡献，可以通过以下方式参与：

1. 报告问题：提交Issue描述遇到的问题或建议
2. 提交代码：通过Pull Request提交改进或新功能
3. 完善文档：帮助改进README或添加使用文档
4. 提供反馈：分享使用体验和改进建议

## 开源许可

本项目采用 [MIT 许可证](LICENSE)。您可以自由使用、修改和分发本项目，详细条款请参阅LICENSE文件。 