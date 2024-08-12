# koishi-plugin-chatluna-cohere-playground-adapter

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-cohere-playground-adapter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-cohere-playground-adapter)

## 🎐 介绍

Chatluna 的 Cohere Playground 适配器，无甲，免费量大管饱，输出速度快，智商低，瑟瑟文笔逆天，适合纯瑟瑟母猪流用户。

## 🎉 安装

```
前往 Koishi 插件市场添加该插件即可。
```

## 🌈 使用

1. **获取 authorization：**

- 访问 [Cohere Playground](https://dashboard.cohere.com/playground/chat) 并登录。
- 打开浏览器开发者工具 (F12)，切换到 "Network" (网络) 选项卡。
- 在 playground 中进行一次对话，找到名为 `Session` 的网络请求。
- 在请求头 (Request Headers) 中，复制 `authorization` 的值。
  - 格式类似: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. **配置插件：** 在插件设置中填入获取到的 `authorization`。

3. **开始使用！** 现在您可以通过 Chatluna 与 Cohere AI 进行对话了。

- 仅推荐使用 `command-r-plus` 模型，其他模型不予置评。

## ⚙️ 配置项

- `authorizations`: Array<string> - Cohere 授权码列表
- `temperature`: number - 回复温度，范围 0-1，默认 1。值越高，回复越随机

## 🍧 致谢

* [Koishi](https://koishi.chat/) - 强大的跨平台机器人框架
* [Cohere](https://cohere.com/) - 提供先进 NLP 技术的 CohereAI

## ✨ 许可证

MIT License © 2024
