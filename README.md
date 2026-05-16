# 软考练题网页

本地网页练题系统，支持按年份/批次练习、全年份随机练习、错题本、练习记录，以及用 DeepSeek 辅助判断填空题和分析错题。

项目默认读取 `cache/questions.json` 中的本地题库缓存。所有练习记录、错题本和可选保存的 API Key 都只保存在当前浏览器的 `localStorage`。

## 题库内容

仓库已经内置题库，克隆后不配置任何接口也可以直接使用：

- `cache/questions.json`：网页运行使用的题库缓存，当前包含 18 套、1247 道题。
- `questions-md/`：可直接阅读的 Markdown 题库源文件，文件名已去掉有道云笔记内部 ID。

题目和解析为 AI 参考与人工复核过程稿，仍建议学习者自行核对，不冒充官方答案。

## 启动

请先安装 Node.js 18 或更高版本：

- Node.js 官网下载：https://nodejs.org/zh-cn/download

```bash
git clone https://github.com/qingningmneg/-1.git
cd -1
npm install
npm start
```

打开：<http://localhost:8787>

## 功能

- 按年份/批次刷题
- 全题库随机练习
- 选择题即时判题和解析
- 填空题可调用 DeepSeek 做语义判分
- 错题本和练习记录保存在本机浏览器

## 可选：从有道云笔记同步

如果你维护自己的有道云笔记题库，可以安装并登录 `youdaonote` CLI，然后配置 `YDN_FOLDER_ID`：

```bash
cp .env.example .env
# 编辑 .env，把 YDN_FOLDER_ID 改成你的有道云笔记文件夹 ID
npm start
```

页面点击「同步有道云笔记」会重新拉取并覆盖 `cache/questions.json`。生成的公开题库缓存会使用按标题生成的匿名 ID，不写入原始笔记 ID 或文件夹 ID。

更详细的申请、安装、登录、同步教程见：[docs/youdaonote-sync.md](docs/youdaonote-sync.md)。

## 离线压缩包

仓库的 `releases/` 目录提供两个可下载压缩包：

- `ruankao-practice-macos.zip`：macOS 启动脚本版
- `ruankao-practice-windows.zip`：Windows 启动脚本版

这两个包都不内置 Node.js。用户仍需先安装 Node.js，再运行包内启动脚本。

## 隐私与安全

- 不要把 `.env`、日志、压缩包、私有配置文件提交到仓库。
- DeepSeek API Key 由用户在网页中手动输入，服务端只在本次请求中转发，不写入项目文件。
- 只有勾选「记住 API Key」时，Key 才会保存到当前浏览器本地。
- 开源前建议运行一次文本扫描，确认没有误提交密钥、账号、Token 或私人数据。
