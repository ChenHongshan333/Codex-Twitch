# Twitch 聊天机器人：首次连通测试

用途：验证真实 Twitch 聊天 → EventSub WebSocket → 本地程序 → Twitch 聊天回复。
收到 `HeyGuys` 后，以你授权的账号回复 `VoHiYo`。这两个词在 Twitch 可能显示为表情。
默认测试的是 token 所属账号自己的频道，不需要手工找 User ID 或填写 Client ID。
本工具只连接 Twitch 聊天，不会启动直播，也不会启动 localhost:3000 网页。

## Windows PowerShell 启动

需要 Node.js 22 或更新版本。无需 npm install，无第三方依赖。
解压后进入包含 bot.mjs 的文件夹，在该文件夹打开 PowerShell。

```powershell
Copy-Item .env.example .env
notepad .env
```

将占位符替换为新 token，例如：

```text
TWITCH_OAUTH_TOKEN=PASTE_NEW_TOKEN_HERE
```

只粘贴 `access_token=` 后面、第一个 `&` 前面的字符。
不要粘贴完整网址。保存并关闭记事本，然后运行：

```powershell
node --env-file=.env bot.mjs
```

预期输出（名字和 ID 以你授权的账号为准）：

```text
[AUTH OK] Account: your_login | User ID: 12345
[CHANNEL] Using your own channel: your_login
[CONNECTED] EventSub WebSocket connected.
[READY] Subscribed to channel.chat.message
[TEST] Open https://www.twitch.tv/your_login/chat and send HeyGuys
```

打开终端打印的聊天室链接，发 `HeyGuys`；也可以让队友用自己的账号发。
终端应出现 `[CHAT]` 和 `[SENT] VoHiYo`，聊天室应出现回复或对应表情。
机器人使用你的账号，所以回复名字会和你自己的账号一样。
发言触发回复会受 2 秒全局冷却限制，避免测试时刷屏。
终端保持运行，按 Ctrl+C 停止。

## 常见问题

- `ENOENT ... .env`：没有进入正确文件夹，或者还没复制 .env.example。
- `Token validation failed (HTTP 401)`：token 过期/已撤销，重新授权并更新 .env，重启程序。
- `Missing permissions`：重新授权，确保有 user:read:chat 和 user:write:chat。
- `[AUTH OK]` 是错误的账号：授权时登录了其他账号，需要切换账号重新授权。
- `fetch failed` / `WebSocket connection failed`：检查本机能否访问 Twitch 身份服务、API、WebSocket；这是本机网络连接问题。
- `[NOT SENT]`：Twitch 接收了 API 请求但未发送消息，终端会显示原因。
- 没有回复：确认终端已显示 READY、频道是终端打印的频道、消息为大小写完全相同的 HeyGuys、距离上次触发超过 2 秒。
- 意外断线：本工具会退出并提示重启；Twitch 主动要求的会话迁移已支持。

## 凭证与协作

.env 已被 .gitignore 排除；只提交 .env.example，不分享真实 token。
如果 token 已出现在共享截图里，先去 https://www.twitch.tv/settings/connections 断开应用，再重新授权。
Client Secret 不需要填写。程序通过官方 token 校验接口获取 client_id、user_id 和 login。
这是首次连通测试工具。暂未提供自动刷新 token、多频道配置、overlay 或玩法。
不要同时运行多份相同配置的机器人，以免重复回复。

## 开发与验证说明

本启动包由本次 Codex 对话生成。已在交付环境使用模拟 Twitch HTTP/WebSocket 事件检查收发流程，尚需在你的本机用有效 token 完成真实 Twitch 联调。

参考：
- https://dev.twitch.tv/docs/chat/chatbot-guide/
- https://dev.twitch.tv/docs/authentication/validate-tokens/
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

下一步：在此基础上把聊天事件接到游戏状态，再接浏览器 overlay。
