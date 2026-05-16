# 安装与使用

## 环境要求

- Node.js 18 或更高版本
- npm
- 浏览器

Node.js 官网下载：

```text
https://nodejs.org/zh-cn/download
```

## 本地启动

```bash
git clone https://github.com/qingningmneg/-1.git
cd -1
npm install
npm start
```

打开：

```text
http://localhost:8787
```

如果 8787 端口被占用，可以指定端口：

```bash
PORT=8797 npm start
```

## 不配置任何接口也能用

仓库已经包含 `cache/questions.json`，所以第一次启动不需要有道云笔记账号，也不需要 DeepSeek API Key。

DeepSeek API Key 只在你使用「填空题 AI 判断」或「错题 AI 分析」时需要。Key 由浏览器页面手动输入，服务端只在当次请求中转发；只有勾选「记住 API Key」时才会保存在当前浏览器的 `localStorage`。

## Windows 版

Windows 用户可以使用同一份题库缓存运行：

```bash
npm run start
```

如果你使用 `package-win.json` 打包或分发，请确保 `cache/questions.json` 一起放在项目目录内。Windows 版后端默认不从有道云笔记同步，只读取本地缓存。

## 使用 releases 压缩包

仓库内置两个压缩包：

- `releases/ruankao-practice-macos.zip`
- `releases/ruankao-practice-windows.zip`

直接下载链接：

- 源码 ZIP：https://github.com/qingningmneg/-1/archive/refs/heads/main.zip
- macOS 压缩包：https://github.com/qingningmneg/-1/raw/main/releases/ruankao-practice-macos.zip
- Windows 压缩包：https://github.com/qingningmneg/-1/raw/main/releases/ruankao-practice-windows.zip

GitHub Release 链接：

- macOS：https://github.com/qingningmneg/-1/releases/latest/download/ruankao-practice-macos.zip
- Windows：https://github.com/qingningmneg/-1/releases/latest/download/ruankao-practice-windows.zip

使用前先安装 Node.js。解压后：

- macOS：双击 `start.command`，或在终端运行 `./start.command`
- Windows：双击 `start.bat`

启动后浏览器打开：

```text
http://localhost:8787
```

这些压缩包是“一键启动包”，不是免环境安装器。它们不会把 Node.js 打包进去，因此用户仍需先安装 Node.js。
