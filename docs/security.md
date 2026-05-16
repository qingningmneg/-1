# 开源安全说明

这个仓库公开前做过以下处理：

- 没有提交 `.env`。
- 没有提交真实 API Key、Token、密码或私钥。
- `cache/questions.json` 已移除有道云笔记文件夹 ID。
- `cache/questions.json` 中题库 ID 已从原始笔记 ID 改成按标题生成的公开 ID。
- `questions-md/` 文件名已移除有道云笔记内部 ID。

## 仍需注意

- 如果你同步自己的题库，提交前重新检查 `cache/questions.json`。
- 不要提交 `.env`、日志、压缩包、浏览器缓存、个人账号配置。
- 如果误提交过密钥，删除文件不等于密钥安全，应立即去对应平台重置密钥。
