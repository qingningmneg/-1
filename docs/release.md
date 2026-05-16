# 发布下载包

仓库内的 `releases/` 目录已经保存了 macOS 和 Windows 压缩包。GitHub 也会自动提供源码 ZIP：

```text
https://github.com/qingningmneg/-1/archive/refs/heads/main.zip
```

## 固定下载链接

仓库文件下载：

```text
https://github.com/qingningmneg/-1/raw/main/releases/ruankao-practice-macos.zip
https://github.com/qingningmneg/-1/raw/main/releases/ruankao-practice-windows.zip
```

GitHub Release latest 下载：

```text
https://github.com/qingningmneg/-1/releases/latest/download/ruankao-practice-macos.zip
https://github.com/qingningmneg/-1/releases/latest/download/ruankao-practice-windows.zip
```

## 创建 GitHub Release

推送 tag 后，`.github/workflows/release.yml` 会自动重新打包并创建 Release：

```bash
git tag v1.0.0
git push origin v1.0.0
```

如果只更新普通代码，不会创建新的 Release。只有 `v*` 格式 tag 会触发。

## 关于“一键安装”

当前压缩包是“一键启动包”：

- macOS 解压后运行 `start.command`
- Windows 解压后运行 `start.bat`

它们不会内置 Node.js。用户第一次使用前需要安装 Node.js 18 或更高版本：

```text
https://nodejs.org/zh-cn/download
```

如果要做真正的免 Node.js 安装器，需要进一步把项目封装成 Electron/Tauri 桌面应用，或把 Node.js runtime 一起打进安装包。
