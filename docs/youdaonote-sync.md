# 有道云笔记同步教程

本项目开箱即用，不申请有道接口也能刷题，因为仓库已经包含 `cache/questions.json`。只有当你想维护自己的有道云笔记题库，并从网页里点击「同步有道云笔记」时，才需要配置有道云笔记访问能力。

## 一、准备有道云笔记题库

在有道云笔记里准备一个文件夹，文件夹下每篇笔记建议使用 Markdown，标题建议类似：

```text
2024年11月第4批 考题+答案+解析（AI参考待核对）.md
```

每道题建议使用下面的结构。解析可以为空，但题号和答案字段尽量保持一致：

```markdown
## 第1题

**题干内容**

A.选项A
B.选项B
C.选项C
D.选项D

**答案：C**

**解析：**
- 解析内容
```

## 二、申请或获取有道云笔记访问能力

有两条路线：

1. 推荐路线：使用 YoudaoNote CLI。官方帮助中心提供 CLI 快速上手文档，CLI 会使用有道云笔记账号授权或 API Key 完成访问。
2. 开发者路线：使用有道云笔记 OpenAPI。官方 OpenAPI 文档说明了通过授权访问用户笔记、管理笔记和附件等能力，涉及 Request Token、verifier、Access Token/Secret 等 OAuth 流程。

官方入口：

- YoudaoNote CLI 快速上手：https://note.youdao.com/help-center/cli-guide.html
- 有道云笔记 OpenAPI 开发指南：https://note.youdao.com/open/developguide.html
- 有道云笔记 OpenAPI 文档：https://note.youdao.com/open/apidoc.html

本项目当前后端集成的是 `youdaonote` CLI，不直接实现 OAuth。这样可以避免把 appKey、appSecret、access token 等敏感信息写进项目代码。

## 三、安装并登录 YoudaoNote CLI

按官方 CLI 文档安装 `youdaonote` 后，在终端确认命令可用：

```bash
youdaonote --help
```

完成登录或 API Key 配置后，确认可以列出笔记：

```bash
youdaonote -s ydn list
```

如果命令不存在，先确认 CLI 安装目录是否在 `PATH` 里。本项目启动时会额外把 `$HOME/.local/bin` 加入查找路径。

## 四、找到文件夹 ID

列出有道云笔记目录：

```bash
youdaonote -s ydn list
```

找到你的软考题库文件夹后，复制对应的文件夹 ID。不要把这个 ID 写进 README、源码或提交历史。

## 五、配置本项目

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`：

```dotenv
YDN_FOLDER_ID=你的文件夹ID
PORT=8787
```

`.env` 已经被 `.gitignore` 忽略，不会被提交。仍然建议提交前运行一次敏感信息扫描。

## 六、启动并同步

```bash
npm install
npm start
```

打开：

```text
http://localhost:8787
```

点击页面右上角「同步有道云笔记」。同步成功后，项目会更新：

```text
cache/questions.json
```

这个缓存是网页实际读取的题库。生成时会用标题生成公开 ID，不写入原始有道笔记 ID 或文件夹 ID。

## 七、开源前检查

提交前建议运行：

```bash
git status --short
rg -n --hidden -g '!node_modules' -g '!.git' -i "(api[_-]?key|token|password|secret|sk-[A-Za-z0-9_-]{20,}|[A-F0-9]{32})" .
```

如果命中 `.env`、Token、API Key、私有文件夹 ID、原始笔记 ID，不要提交。先改成环境变量、示例值或匿名 ID。
