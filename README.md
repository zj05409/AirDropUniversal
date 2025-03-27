# 📱💻 AirDrop 通用版

<div align="center">

**便捷文件共享，跨设备零阻碍！**

![版本](https://img.shields.io/badge/版本-1.0.0-blue)
![平台](https://img.shields.io/badge/平台-全平台-green)
![语言](https://img.shields.io/badge/语言-中文-orange)

</div>

## 📋 项目介绍

AirDrop通用版让你在所有设备间轻松传输文件，就像苹果的AirDrop，但适用于所有设备！无需注册账号，无需安装App，即开即用。

### ✨ 核心优势

| 特性 | 描述 |
|------|------|
| 📱 **全平台支持** | 手机、平板、电脑全覆盖，iOS、安卓、Windows、Mac无差别体验 |
| 🔌 **零安装使用** | 访问网页或打开桌面程序即可使用，无需下载额外软件 |
| 🔒 **安全私密传输** | 点对点直接传输，文件不经过服务器，保障隐私安全 |
| ⚡ **极速传输体验** | 基于WebRTC技术，局域网内高速传输，支持大文件 |
| 📁 **多文件支持** | 一次性传输多个文件和文件夹，自动打包为ZIP格式 |
| 🌐 **局域网工作** | 连接同一WiFi即可使用，适合办公室或家庭内共享 |

## 🚀 使用指南

### 快速开始

**方式一：网页版（推荐）**
1. 确保所有设备连接到同一WiFi
2. 浏览器访问：`http://你的服务器IP:3001`
3. 输入设备名称，选择类型即可使用

**方式二：桌面应用**
1. 下载并安装桌面应用（[下载链接](#下载链接)）
2. 打开应用，设置设备名称
3. 开始文件传输

### 文件传输操作

**发送文件：**
1. 点击"选择文件"或直接拖放文件
2. 从设备列表选择接收设备
3. 点击"发送"开始传输
4. 查看实时进度

**接收文件：**
- 接收通知自动弹出
- 传输完成后点击下载
- 多文件自动打包为ZIP格式

## 💡 使用技巧

- **大文件传输**：支持最大100MB单文件
- **保持连接**：传输过程中避免切换应用或锁屏
- **扫码连接**：电脑端可生成二维码供手机快速连接
- **连接问题**：找不到设备时尝试刷新页面

## 🛠️ 开发指南

### 环境搭建

```bash
# 克隆仓库
git clone https://github.com/zj05409/AirDropUniversal.git
cd AirDropUniversal

# 安装依赖
npm install
```

### 快捷命令

**一键启动开发环境**

```bash
# 方式一：使用脚本（推荐）
./start-dev.sh

# 方式二：使用npm命令
npm run dev
```

**构建应用**

```bash
# 一键构建DMG（推荐）
./fix-build.sh

# 或使用npm命令
npm run 一键部署
npm run build-dmg
```

> **注意**：请勿直接使用`npm run build-electron-mac`命令，它可能跳过React构建步骤。

### 各平台构建指令

| 平台 | 命令 |
|------|------|
| **macOS** | `npm run build-electron-mac` |
| **Windows** | `npm run build-electron-win` |
| **Linux** | `npm run build-electron-linux` |

## ❓ 常见问题

<details>
<summary><b>设备无法发现对方？</b></summary>
<ul>
<li>确保设备连接到同一WiFi网络</li>
<li>检查浏览器是否允许本地网络访问</li>
<li>尝试重新启动应用或刷新页面</li>
</ul>
</details>

<details>
<summary><b>文件传输失败？</b></summary>
<ul>
<li>确保文件大小不超过100MB</li>
<li>传输过程中保持设备亮屏</li>
<li>检查两设备是否仍然连接</li>
</ul>
</details>

<details>
<summary><b>移动端无法下载文件？</b></summary>
<ul>
<li>iOS设备请使用Safari浏览器</li>
<li>安卓设备请使用Chrome浏览器</li>
<li>确保给予浏览器存储权限</li>
</ul>
</details>

## 📦 技术架构

- **前端**：React + Tailwind CSS
- **后端**：Node.js + Express
- **通信**：Socket.IO + PeerJS (WebRTC)
- **桌面**：Electron

## 📄 开源许可

AirDrop通用版 &copy; 2023 - 基于MIT许可证开源 