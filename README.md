# ChatCrossfire / 弹幕交火

当前交付路线：**网页设置页 + 真实 Twitch 聊天 + 真人追踪 + OBS**。
主播在网页设置摄像头、开始/暂停；观众在 Twitch 聊天室参与；碰撞、血量与
胜负由后台自动处理。键盘人物仅用于模拟测试，原生 Extension 保留为可选模式。
真实输入配置后依次运行 `npm run doctor:dodge`、`npm run verify:dodge`、
`npm run dodge`。前两步分别检查配置和只读聊天/观众数连接，均不会代替你开播。
实时就绪清单和聊天接收/拒绝原因帮助定位缺口。
详见 [真实联调步骤](docs/dodge-runbook.md#real-twitch-input-private-configuration)。
当前仍是同机原型；远程双电脑和特定 VTuber 软件接口未实现。

New local OBS dodge prototype: `npm run dodge`, then open
[Dodge Lab](http://127.0.0.1:3020/). Equal arenas, camera colour-marker hits,
viewer-normalized chat attacks and defection. Start with keyboard rehearsal;
see [setup and limitations](docs/dodge-runbook.md). Live Twitch and physical OBS
acceptance remain pending; this is separate from the native PK mode below.

The battle-room UI now offers **Start rehearsal**, focus views and a match
activity column. [Fresh smoke/design review](docs/design/2026-10-31-dodge-ui-review.md)
records 103 passing tests and Chrome gameplay checks; real Twitch remains pending.

**Hackathon delivery clarification (2026-10-31): publishing a Twitch Extension
is optional.** Our next acceptance milestone is the app connected to real Twitch
chat/EventSub/API activity, rendered through OBS, followed by a demo showing the
project working on Twitch and development with Codex. The local simulator is
for development and is not that evidence. Native Extension PK remains an optional
existing route. See the [peer readiness checklist](docs/hackathon-readiness.md)
and [official FAQ](https://twitchcon-codex.devpost.com/resources).

## 协作与最新审计 / Collaboration

Fresh-clone audit and next steps (2026-10-31): [Current handoff](docs/HANDOFF.md),
[verified status](docs/STATUS.md), [task queue and ownership](docs/TASKS.md),
[product](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md),
[API contract](docs/API_CONTRACT.md). Coding agents start with [AGENTS.md](AGENTS.md).
For selective reading, use the [agent knowledge map](docs/AGENT_MAP.md) and
[idea/decision register](docs/DECISIONS.md). The map links each task to its
owning code, dependent boundaries and verification, with a freshness check.
Session evidence lives in [records/](records/README.md) and the shared Google Doc's
Records tab. For credential meanings and first-time setup, see the
[configuration guide](docs/configuration-guide.md).
Historical token/tunnel/process/artifact notes below and in `progress.md` do not
establish availability in a new clone. Legacy `/overlay/*` pages show the separate
debug match; they do not show native Extension PK rooms.

**Your chat. Their problem.** Twitch 原生 Extension：两位主播在 Twitch 内邀请、接受和准备，后台自动开赛、管理攻击与叛变、结束并结算社区阵营战。无需第三位主持人。

## 原生 Extension 入口（可选路线）

```powershell
# 正常服务，默认 3000；首页说明 Twitch 接入与本地测试
npm start
# 独立四角色本地联调，默认 3010
npm run sandbox
```

打开 `http://127.0.0.1:3010/sandbox`，四个窗口分别代表两位模拟主播和两个模拟观众。A 邀请 `demo_violet`，B 接受，双方准备；后台自动倒计时并开赛。观众点击 Join / Attack，半场窗口内 Defect，时间到自动结束。可选 30 秒短局测试。此页面明确标记 **LOCAL SIMULATION**，不会创建真实 Twitch 账号或冒充原生安装已验证。

真实 Twitch 原生接入需要额外的 Extension 配置，与现有聊天机器人的 OAuth 应用不同：

```text
TWITCH_EXTENSION_ID=扩展ClientID
TWITCH_EXTENSION_SECRET=扩展的Base64共享密钥
PUBLIC_ORIGIN=https://真实后端域名
ENABLE_SANDBOX=0
```

使用 `npm run doctor:extension` 检查缺失配置，不会打印凭证。后端验证 Twitch Helper 提供的 JWT，只有相应频道的主播能发起/接受 PK；观众分享身份后才能参与，跨两个频道共用同一个身份、冷却和叛变次数。

- [Twitch 创建、打包、安装和测试指南](docs/twitch-extension-setup.md)
- [公网 HTTPS 后端部署指南](docs/cloud-deploy.md)
- [项目进度与真实验证状态](progress.md)

正式 ZIP：`npm run package:extension -- --backend https://实际后端域名`。没有真实 HTTPS 后端时，只能生成明确标记的本地包：`npm run package:extension -- --backend http://127.0.0.1:3010 --local`。

本次已准备临时 HTTPS 测试后端和对应正式格式的前端 ZIP，实际地址、验证证据和缺失平台配置见 [progress.md](progress.md)。它仍需要 Twitch 开发者配置和两位主播安装激活，不能仅凭公网健康检查就认定真实 Twitch 已打通。

自动分数为成功释放的攻击次数（community battle points），不直接判定画作好坏或外部游戏输赢。当前仍需完成 Twitch 开发者配置、第二真实频道、公网部署与真实 Twitch 内全链路验证，详见 progress.md。

## 第一版调试模式（以下保留用于排错）

适合画画、答题、创作和主播约定的其他比赛。主持人负责记分，主播按约定执行挑战。OBS 动画不会自动改变或控制外部游戏。

## 30 秒启动

需要 **Node.js 22.13+（建议 24 LTS 或更新版本）**。运行项目没有第三方依赖；原仓库的 `.env` 可继续使用，不要覆盖它。

```powershell
npm start
```

打开终端打印的 **Debug** 链接（`http://127.0.0.1:3000/debug#key=…`），自动解锁本机浏览器的调试控制。`/debug` 普通地址是只读视图。调试 key 不等于 Twitch token，不要把私密链接分享给观众。

默认是明确标识的 **Demo** 模式，不连接 Twitch，也不发送 Twitch 聊天消息。没有 `.env` 也能运行演示。

## 先体验完整闭环

1. 打开 Host 链接，点击 **Start the round**。
2. 在 **Make some noise** 中连续点击 A 队 **Attack** 三次；模拟观众自动加入，B 队收到挑战。
3. 点击 **Open defection**，再点 **A → B**，观察叛变播报和阵营人数变化。
4. 使用两队比分旁的 `+` / `−` 手动记分。
5. 点击 **End round**，调整最终比分，再点 **Confirm result**。
6. 点击 **Set up another round**，回到准备状态。

Demo 按钮同样遵守正式规则，默认每队五个模拟账号；快速重复点击可能提示冷却或队伍已经充能。

## 接入真实 Twitch 聊天

现有 `.env` 只需要：

```text
TWITCH_OAUTH_TOKEN=你的用户访问令牌
```

没有 `.env` 时再复制 `.env.example`。只填 token 本体，不填 OAuth 返回网址。程序通过官方校验接口获取 Client ID、User ID 和登录名，无需 Client Secret。

1. 在 **Match setup** 填两个频道的登录名，不用填 URL。A 默认是 `hongshan333`；B 可暂时留空，进行单频道测试。
2. 填比赛主题、双方显示名和挑战池。双方需提前认可挑战内容。
3. 保存设置，切换为 **Twitch**，等待显示 **CONNECTED**。
4. 点击 **Start the round**，请观众在真实聊天室发指令。

| 指令 | 作用 |
| --- | --- |
| `!join` | 首次加入当前频道对应的阵营，准备阶段也可加入。 |
| `!attack` | 为自己的阵营充能，攻击当前阵营的对手。 |
| `!switch` | 在窗口内叛变，每人每局仅一次。 |
| `!help` | 请求简短玩法说明，聊天回复有节流。 |
| `HeyGuys` | 保留连通测试，回复 `VoHiYo` 和玩法提示。 |

最低读取权限是 `user:read:chat`；聊天回复还需 `user:write:chat`。使用 **User Access Token + EventSub WebSocket**，不混用 Cloud Bot 的 App Access Token 授权方式。每个频道独立订阅，统一进入同一场比赛。

同一 Twitch 用户跨两个频道共用身份、阵营、冷却和叛变次数；去对方聊天室发 `!join` 不会换阵营。重复事件和 Shared Chat 转发副本会被过滤。

真实连接检查（不发送聊天消息）：

```powershell
npm run verify:twitch -- hongshan333
npm run verify:twitch -- hongshan333 第二个频道名
```

原始单频道机器人保留：

```powershell
npm run bot
```

不要同时启动原始机器人和 PK 应用的 Twitch 模式，否则 `HeyGuys` 可能收到重复回复。

## OBS 和主播提示页

点击 **Broadcast kit** 获取链接，均不含主持人密钥。

| 页面 | 用途 |
| --- | --- |
| `/overlay/a` | A 主播的透明 OBS 画面 |
| `/overlay/b` | B 主播的透明 OBS 画面 |
| `/cue/a` | A 主播在自己屏幕上查看挑战 |
| `/cue/b` | B 主播在自己屏幕上查看挑战 |

OBS 添加 Browser Source，设为 **1920 × 1080**，每位主播使用自己的 overlay。页面显示比分、时间、阵营人数、攻击动画、叛变通知和当前挑战；刷新后获取当前状态，不回放旧攻击。

主播另外打开自己的 **cue** 页面。OBS 画面效果不会自动影响主播正在玩的游戏。控制台 **Sound off / on** 只控制该控制台的合成音效，OBS 页面默认无音。

## 默认规则

- 每位观众每 10 秒贡献一次充能，叛变后保留冷却。
- 每 3 次充能触发一个挑战；双方队伍最短释放间隔均为 20 秒。
- 挑战持续 15 秒；每队最多一个执行中挑战和一个待执行挑战。
- 队伍满充能时不再吸收充能，等待合法攻击时机。
- 默认半场自动开放 30 秒叛变窗口；主持人可提前开启或关闭，每局只开一次。
- 暂停冻结比赛、挑战、叛变窗口和冷却的游戏时间。
- 攻击和叛变不直接加比赛分，主持人按约定规则记分。
- 结算后可修正分数，修正会要求重新确认结果。
- 主持人点击当前挑战旁的 `×`，可取消该队的当前和待执行挑战。

队伍攻击上限限制刷屏和挑战堆叠，**不代表不同观众规模之间已完全公平**。

## 两位远程主播共用

两个 overlay 必须访问 **同一个后端**。localhost 只代表当前电脑，不能直接把 localhost 链接发给另一台电脑使用。

实际双主播演示建议部署到支持长期 HTTP/SSE 连接的 Node.js 主机，通过 HTTPS 反向代理访问：

```text
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=https://你的实际域名
ADMIN_KEY=至少24个字符的随机私密密钥
TWITCH_OAUTH_TOKEN=现有用户令牌
```

反向代理需关闭 `/api/events` 的响应缓冲。后端主动建立 Twitch EventSub WebSocket，不需要 webhook 回调。只把只读 overlay/cue 链接发给主播；主持人链接仅给裁判或主持人。音视频连麦和双方视频布局由主播现有工具完成。

本次尚未部署远程服务，也未自动修改账号授权或对外发布项目。

## 开发与测试

```powershell
npm ci
npm run check
npm test
```

`jsdom` 仅为测试依赖，用于页面渲染和交互；它不等于真实浏览器视觉验证。规则测试使用可控时钟；Twitch 生命周期测试模拟 HTTP/WebSocket，独立于真实账号和网络。

```text
server.mjs              HTTP、主持人会话、SSE、指令路由
src/engine.mjs          权威规则引擎，与网络和页面分离
src/twitch.mjs          校验、双频道订阅、迁移、重连、去重
src/store.mjs           原子保存配置与轮转事件日志
public/                 控制台、OBS overlay、主播提示页
test/                   规则、接口、Twitch 和页面交互测试
scripts/verify-twitch.mjs 只订阅、不发言的真实连接检查
bot.mjs                 保留原始首次连通测试入口
progress.md             给组员看的进度、验证结果与待办
```

网页实时更新使用 **SSE + HTTP POST**：后端推送状态，主持人用受保护的 HTTP 请求操作。Twitch 仍使用 EventSub WebSocket。

`data/config.json` 保存设置；`data/events.jsonl` 保存事件，并在约 5 MB 轮转，保留一份前序日志。这些文件不提交 Git。比赛状态在内存中，**重启后回到 Demo 准备阶段，不恢复进行中的比赛**。页面刷新和网络恢复会从仍在运行的后端获取状态。

## 排错

- `EADDRINUSE`：已有程序占用 3000，停掉旧实例或在 `.env` 设置 `PORT=3001`。
- 控制按钮不可点击：使用本次启动打印的 Host 链接；重启会更新随机 key 和会话。
- 设置保存不可用：重置到没有参与者的准备阶段。
- `fetch failed` / reconnecting：当前进程需能访问 `id.twitch.tv`、`api.twitch.tv`、`eventsub.wss.twitch.tv`。
- HTTP 401：token 过期或撤销，更新 `.env` 后重启；尚无 refresh token 自动续期。
- HTTP 403：检查 token 权限和相应频道的聊天访问条件。
- 只显示 `1/2`：单频道已连通，仍需配置第二个真实频道。
- Twitch 意外断线：显示重连并自动重新订阅，期间消息无法补回；主持人可暂停。
- 远程访问 Host 不允许：配置精确的 `PUBLIC_ORIGIN`，并使用该域名访问。

不要将 `.env`、token、Client Secret 或主持人链接写入提交材料。若 token 泄露，应撤销相关 Twitch 授权并重新获取。

## Hackathon 交付

仍需两位主播真实演练、OBS 视觉验证、公开 YouTube 视频（最长 3 分钟）、完整仓库、项目描述和主要开发 thread 的 Codex Session ID。代码完成不等于比赛已提交。

官方参考：[Chatbot Guide](https://dev.twitch.tv/docs/chat/chatbot-guide/)、[聊天授权](https://dev.twitch.tv/docs/chat/authenticating/)、[EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)、[比赛页面](https://twitchcon-codex.devpost.com/)。
