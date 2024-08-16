# koishi-plugin-chatluna-cohere-playground-adapter

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-cohere-playground-adapter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-cohere-playground-adapter)

## 🎐 介绍

Chatluna 的 Cohere 适配器，无甲，免费量大管饱，输出速度快，智商低，瑟瑟文笔逆天，适合纯瑟瑟母猪流用户。

## 🎉 安装

```
前往 Koishi 插件市场添加该插件即可。
```

## 🌈 使用

1. **获取 API Key：**

- 访问 [Cohere](https://dashboard.cohere.com/) 注册并登录。
- 登录后前往 [Cohere API Key](https://dashboard.cohere.com/api-keys) 页面，复制 `Trial key`。
  - `Trial key` 形如 `iD35z8XuYzI1KKGoQ9EdzOSoV0SKPWLCHrUv61OD`。

2. **配置插件：** 在本插件请求设置中添加获取到的 `Trial key`。

3. **开始使用！** 现在您可以通过 Chatluna 与 Cohere AI 进行对话了。

- 仅推荐使用 `command-r-plus` 模型，其他模型不予置评。
- `Cohere` 每个账号每月有 1000 次免费请求，超出后将无法使用。
  - 小贴士：使用 [Gmail 临时邮箱](https://www.emailtick.com/) 注册 Cohere 账号，以获取更多免费请求次数。

## ⚙️ 配置项

### 请求设置

- `apiKeys` - Cohere API Keys。

### 模型设置

- `k` - k 参数。确保在每个步骤中只考虑最有可能的 k 个 tokens。默认 0，范围 0-500。
- `p` - p 参数。确保在每一步生成时，只考虑总概率质量为 p 的可能性最大的 tokens。如果 k 和 p 都启用，则 p 在 k 之后执行。默认 0.75。范围 0.01-0.99。
- `max_tokens` - 最大输出 tokens。默认 4000，范围 1-4000。
- `temperature` - 回复温度，越高越随机。随机性可以通过增加 p 参数的值来进一步最大化。范围 0-1。
- `frequency_penalty` - 频率惩罚。用于减少生成的重复性。值越高，越随机，且跟 tokens 重复出现的次数成比例。默认 0，范围 0-1。
- `presence_penalty` - 存在惩罚。用于减少生成的重复性。与频率惩罚类似，但这种惩罚适用于所有已经出现的 tokens，无论它们的频率（出现次数）如何。默认 0，范围 0-1。
- `documents` - 文档列表。一个模型可以引用的相关文档列表，以生成更准确的回复。每个文档都是一个字符串-字符串字典。示例：
  `[
  {“title”：“高企鹅”，“text”：“帝企鹅最高。" },
  {“title”：“企鹅栖息地”，“text”：“帝企鹅只生活在南极洲。" },
  ]`

## 🍧 致谢

* [Koishi](https://koishi.chat/) - 强大的跨平台机器人框架
* [Cohere](https://cohere.com/) - 提供先进 NLP 技术的 Cohere AI

## ✨ 许可证

MIT License © 2024
