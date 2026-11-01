# ChatCrossfire / 弹幕交火 — 项目进度

## 2026-11-02：网页＋真实 Twitch＋OBS 联调准备

本轮基于 `e91c6fb`，实现分支 `codex/integrator-live-dodge-setup`；用户授权实现、
更新本文件并 push。当前交付路线是网页设置/操作、真实 Twitch 聊天、真人追踪和
OBS 输出，保留虚拟形象的后续接入目标与原生 Extension 代码。控制台不负责人工
算分：碰撞、血量、计时和胜负仍由后台自动处理；键盘人物仅是模拟测试工具。

### 已完成的代码

- `npm run doctor:dodge`：离线检查真实模式、用户 token 格式、两个不同频道名和
  端口，只打印固定提示，不修改 `.env`。格式通过不代表 token 授权有效。
- `npm run verify:dodge`：只读验证用户授权、两路 EventSub 订阅及真实正数观众数，
  不发聊天、不开始比赛、不启用摄像头或代替用户开播，结束后关闭连接。
- 真实模式新增就绪清单：两边聊天、观众数和追踪是否可用；后端也会阻止未就绪
  的开始/恢复请求。新增每侧聊天接收、接纳、拒绝计数和最后拒绝原因。
- 真实模式默认摄像头输入，隐藏模拟聊天/人数表单，禁用键盘坐标提交；明确区分
  位置预览与 OBS 摄像头画面，并说明 OBS 开播、录制的不同作用。
- 新增带可控时钟的 EventSub→HTTP→双向弹幕→碰撞扣血→自动结算测试，以及
  配置/只读验证、断连竞争和真实模式 UI 回归。原生 PK 和 loopback 边界保留。
- 更新 [运行指南](docs/dodge-runbook.md)、[接口契约](docs/API_CONTRACT.md)、
  [状态](docs/STATUS.md)、[交接](docs/HANDOFF.md)和本轮
  [记录](records/2026-11-01_unassigned_status-run-guide_pending.md)。

### 本次验证与限制

- `npm run check`：最终在沙箱内单独运行通过；早期并行检查出现 Node 原生内存错误，
  沙箱外单独重跑也通过。
- `npm test`：默认并行执行在当前 Node `v25.9.0` 出现多个测试进程原生内存崩溃，
  沙箱外重跑也未全部通过；原因未定，不能写成默认命令已全部通过。
- `npm test -- --test-concurrency=1`：完整 **119/119 通过**，无失败/取消/跳过。
  项目参考环境仍是 Node 24；本轮没有替换本机 Node 或修改默认测试并行度。
- `doctor:dodge`：预期退出 1。本机 token 只有格式符合，未验证有效授权；
  `DODGE_LIVE` 未开启，两个 dodge 频道名未配齐。原有 `.env` 保持不变。
- `verify:dodge` 同样在配置检查阶段退出 1，未发送真实网络请求；临时模拟服务的
  首页、脚本、两路 tracker、两路 overlay 和 state 共 7 个入口均 HTTP 200，已关闭。
- 本轮无可用浏览器连接，没有完成真实浏览器、实体摄像头、OBS 或真实 Twitch
  对局验收；自动测试使用模拟 HTTP/WebSocket，不等于真实平台证明。
- 仍是**同一台电脑运行双方场地**；远程双电脑的认证/状态/坐标传输，以及具体
  VTuber 软件的位置接口尚未实现。没有开放隧道、部署或开启直播。
- Google Records 镜像待同步：当前没有连接的文档会话；本轮 session ID 仍待确认。

### 下一步实际操作

账号负责人私下填好 `.env` 中的 `TWITCH_OAUTH_TOKEN`、`DODGE_CHANNEL_A`、
`DODGE_CHANNEL_B`、`DODGE_LIVE=1`，安排两路直播和实际测试观众观看，再依次运行：

```powershell
npm run doctor:dodge
npm run verify:dodge
npm run dodge
```

打开 `http://127.0.0.1:3020/`，按就绪清单校准两边摄像头，在 OBS 对齐两个
960×540 Browser Source。确认真实聊天、双向弹幕、躲避/命中、追踪丢失暂停和
自动结算后再录真实 Twitch 证据。若此次交付必须两位主播各一台电脑，须先补齐
远程方案并验收；同机测试不能替代。以下是历史记录，旧域名和运行状态不代表当前可用。

> 新克隆协作审计（2026-10-31，Asia/Singapore）：最新状态见
> [docs/STATUS.md](docs/STATUS.md)，接手说明见 [docs/HANDOFF.md](docs/HANDOFF.md)，
> 后续计划见 [docs/TASKS.md](docs/TASKS.md)。本文件下方保留历史开发记录；
> “当前运行”、临时域名、凭证和 artifacts 是原环境的记录，不代表本次克隆已具备。
> 本次本地复核 84/84 测试通过，但缺少 .env 和真实平台验收证据。

最后更新：2026-11-02（北京时间）；下方 2026-10-30 原生路线记录保留作历史。

## 原生 Extension 目标（保留实现，历史路线）

该模式目标：Twitch 原生 Extension 内由两位主播邀请、接受、准备，后台自动开赛、管理攻击和叛变、结束并结算阵营战；不需要第三位主持人。主播自选比赛内容，外部游戏/创作成绩不被冒充为自动判定的结果。

## 原生 Extension 全链路（历史记录）

- [x] 用户确认取消第三位主持人，改为双方主播发起和确认。
- [x] 创建持续目标：邀请 → 接受 → 双方准备 → 自动倒计时 → 攻击 → 半场叛变 → 自动结束/结算。
- [x] 原生 Extension 前端：panel / component 兼容视图、overlay、live dashboard、安装配置视图。
- [x] Twitch Extension HS256 JWT 校验、主播频道所有权验证、观众身份分享。
- [x] 邀请过期、并发邀请互斥、准备撤回、暂停/继续、退出和自动结算。
- [x] 模拟账户和真实 Twitch 房间分区；生产模式关闭模拟身份入口。
- [x] 四角色本地模拟页与独立 `npm run sandbox`（3010 端口，不占用普通服务的 3000）。
- [x] 84 项测试全部通过：规则、JWT、HTTP、CORS、权限、前端交互、四窗口前端到后端集成、临时公网启动器。
- [x] 可生成 Twitch 上传 ZIP；生产包移除本地模拟入口；Docker 部署文件已准备。
- [x] 两个小 agent 分别扮演 A/B 主播与观众，独立进程通过 HTTP 跑完整 60 秒对局；自动 B 胜 2:1，双方结果一致，未使用主持人接口。
- [x] 实际临时公网 HTTPS 后端（仅供测试，进程停止即失效）。
- [ ] Twitch Extension Client ID / Base64 shared secret 私密配置。
- [ ] 第二真实 Twitch 频道及安装、激活、测试账号名单。
- [ ] 在真实 Twitch 页面验证原生扩展全链路。

### 当前平台配置检查

`npm run doctor:extension` 已确认：已有聊天机器人的 OAuth token；尚无 `TWITCH_EXTENSION_ID`、`TWITCH_EXTENSION_SECRET`。这些与已有聊天机器人的应用配置不同。不要把 secret 发到群聊或写进源码，需填入本机 `.env` / 部署环境。临时公网启动器已显式设置 PUBLIC_ORIGIN，没有覆盖本机 `.env`。

当前没有可用的浏览器控制连接，不能代替用户在已登录 Twitch 开发者控制台中创建/安装扩展。正在完成所有不依赖这些平台输入的实现和验证；没有把模拟对局称为真实 Twitch 原生安装已通过。

### 本次可用入口与证据

- 本地四角色模拟：http://127.0.0.1:3010/sandbox （当前已运行，想重启时先停止旧的 3010 进程）。
- 临时 HTTPS 后端：https://genuine-refer-walk-kilometers.trycloudflare.com
- 公网健康检查：https://genuine-refer-walk-kilometers.trycloudflare.com/api/health
- 可上传的前端包：`artifacts/chatcrossfire-extension.zip`；已验证 ZIP CRC、8 个根目录资源、后端地址及模拟身份入口被移除。
- 本地开发包：`artifacts/chatcrossfire-extension-local.zip`，不能当作远程 Twitch Hosted Test 成品。
- A 进程证据：`artifacts/role-a-result.json`；B 进程证据：`artifacts/role-b-result.json`。都明确标记 `local-simulation`，不包含 bearer token。
- 公网验证：`artifacts/public-verification.json`。健康和原生页面 HTTP 200；旧调试接口 404；模拟账号 POST 403；缺少原生扩展配置时 /api/extension/state 为 503，未伪造为真实连接成功。
- 公网元信息：`artifacts/public-backend.json`，包含实际后端端口和 PID，无凭证。
- Cloudflare 官方 Windows 可执行文件位于忽略的 `artifacts/`；Authenticode 签名验证为 Cloudflare, Inc.，版本 2026.10.6。
- Quick Tunnel 是临时测试地址，不保证长期在线；重建隧道会换域名，需要重新打包和更新 Twitch URL 允许列表。它不支持 SSE，新原生流程使用 HTTP 轮询，旧 SSE 调试接口已在公网关闭。

### 距离真实 Twitch 完成还缺什么

1. 用户在 Twitch 开发者控制台创建 Extension，私密填写 `.env` 中的 `TWITCH_EXTENSION_ID` 和 `TWITCH_EXTENSION_SECRET`；不在聊天中发送 secret。
2. 第二位真实主播登录名及账号授权；两位主播和测试观众加入允许列表。
3. Twitch 控制台配置入口、身份分享和上述实际 HTTPS 后端，上传 ZIP，两位主播分别安装并激活。
4. 重启本次公网后端读取新配置（隧道保持不变），在真实 Twitch 页面完成验收表。

当前持续目标尚未完成，不把本地或公网基础设施验证计作 Twitch 原生全链路成功。

### GitHub 代码交接

- 按用户要求，将本轮原生 Extension、自动 PK 后端、四角色模拟、打包部署工具、84 项测试及运行文档整理为一次版本提交，目标为 `origin/master`。
- 真实 `.env`、运行日志、事件数据、Cloudflare 可执行文件和生成 ZIP 均通过 Git ignore 排除；队友应按文档自行填写凭证并重新生成安装包。
- 该版本包含已验证的模拟完整链路和临时 HTTPS 接入准备；真实 Twitch 平台验收仍受账号侧配置阻塞，代码提交不代表这一验收已完成。

### 持续目标平台等待审计

- 第 1 次：完成代码、双 agent 独立进程演练、84 项测试、HTTPS 后端与上传包，确认缺少 Extension ID/shared secret、第二真实频道和平台安装。这一目标轮有实质进展。
- 第 2 次（自动继续复查）：重新运行配置检查，Extension ID/shared secret 仍未填写；3010 本地模拟器和 3020 后端健康，均报告原生扩展未配置。重新轮询确认隧道进程和公网后端进程仍存活，没有重启或重复占用端口。本轮为经过验证的等待，真实平台步骤仍依赖账号侧输入。
- 第 3 次（自动继续复查）：再次确认 `.env` 缺少 Extension ID/shared secret；3020 后端健康但 `extensionConfigured=false`；浏览器/应用连接列表仍为空。第二真实频道和平台安装也没有新增证据。同一账号侧阻塞已连续出现三轮，持续目标标记为 `blocked`（受阻），不标记完成；待用户完成平台配置或连接可操作的已登录浏览器后继续。
- `doctor:extension` 针对本机 `.env` 检查 PUBLIC_ORIGIN；本次公网进程的地址是启动器通过 CLI 显式注入，不能据 `.env` 未填写就判定已验证的 HTTPS 后端不存在。

## 第一版已完成（归档）

- [x] 原始单频道 Twitch 聊天机器人已建立（`bot.mjs`）。
- [x] 用户已报告成功连接 `hongshan333` 聊天室。
- [x] 已检查现有仓库；保留现有 `.env` 和原始机器人。
- [x] 建立本进度记录，供组员交接。
- [x] 实现 PK 规则引擎：阵营、攻击冷却、挑战、计时、叛变、结算。
- [x] 实现主持人控制台、主播提示页和透明 OBS overlay。
- [x] 将 Twitch 接入扩展为双频道，并添加断线重连、会话迁移和去重。
- [x] 提供明确标识的离线演示模式，真实模式禁止注入模拟指令。
- [x] 35 项自动化测试通过，覆盖核心规则、HTTP 接口、Twitch 生命周期和页面交互。
- [x] 真实验证现有 token 可订阅 `hongshan333`；验证未发送聊天消息。
- [x] 更新中文 README 和演示/提交清单。
- [ ] 真实浏览器与 OBS 视觉验证（当前工具无可用浏览器连接）。
- [ ] 两个真实 Twitch 频道及两位主播的端到端演练。
- [ ] 录制公开视频、准备 Devpost 提交。

## 已确定的实现范围

- 继续使用仓库已有的 Node.js ES modules，优先保持无第三方运行依赖。
- 一个后端统一管理一场 PK，接收两个频道聊天，向网页实时推送状态。
- 保留 `HeyGuys` → `VoHiYo` 的原始机器人供单独排错。
- 观众指令：`!join`、`!attack`、`!switch`、`!help`。
- 按 Twitch 用户 ID 统一身份，同一用户跨频道不能绕过阵营和冷却。
- 叛变只在窗口内有效，每人每局一次。
- OBS 中的画面效果不会自动改变主播本地游戏；实际挑战由主播按约定执行。
- 第一版调试控制台支持手动记分；新的原生 PK 自动结算社区阵营战，两者分开运行。

## 队友接手需知

- 聊天室：https://www.twitch.tv/popout/hongshan333/chat
- `.env` 是本机私密配置，不提交、不粘贴到聊天或截图中。
- 第二个真实频道名称尚未提供；开发期间将允许单频道接入和离线模拟，不能把模拟称为真实双频道验证。
- 截止时间：2026-11-03 06:00 北京/新加坡时间；内部目标为 11 月 2 日晚前完成提交。

## 工作记录

### 2026-10-30

- 检查了 `package.json`、`bot.mjs`、README 和 `.env.example`，未读取或输出真实 token。
- 初始仓库干净；Node.js 版本为 v25.9.0。
- 开始实现可运行的 PK MVP，后续在此记录实现和验证结果。
- 完成权威规则引擎：统一 Twitch 用户身份；攻击充能、队伍释放上限、最多一个排队挑战；暂停冻结全部游戏计时；每局一次限时叛变；手动计分和最终确认。
- 完成控制台：Demo/Twitch 切换、比赛设置、模拟观众、攻击/叛变动画、可选合成音效、活动记录、参与者贡献榜、比分调整和挑战取消。
- 完成只读 `/overlay/a`、`/overlay/b`、`/cue/a`、`/cue/b`，刷新后恢复当前画面。
- 完成双频道 EventSub 连接器：token 校验、频道查询、独立订阅、主动迁移、退避重连、跨频道身份、Shared Chat 副本过滤、回复限流。
- 主持人操作由私密 Host 链接解锁，使用 HttpOnly 会话；普通页面和 overlay 不具备管理权限。真实 token 只留在后端，`.env` 保持未修改且被 Git 忽略。
- 配置原子保存到 `data/config.json`，事件记录到轮转 JSONL 日志；`data/` 不提交。
- `npm run check`、`npm test`（35/35）、`git diff --check` 通过。
- `npm run verify:twitch -- hongshan333` 已在允许联网的环境真实通过：以 `hongshan333` 账号成功订阅该频道；未发送消息。
- 使用 jsdom 验证真实前端脚本的交互流程与文本转义；这不是截图或真实浏览器视觉检查，后者仍待完成。
- 安装的 jsdom 仅用于开发测试，无第三方运行依赖；依赖安装审计报告 0 个漏洞。
- 曾在 `http://127.0.0.1:3000/` 启动本地服务，实际通过网页后端接口切换到 Twitch，确认 `hongshan333` 单频道处于 CONNECTED、比赛处于准备阶段。没有主动发送聊天消息。
- 修复实时更新的竞态：较旧 HTTP 响应不能覆盖已收到的更新 SSE 状态。
- 用户自行 `npm start` 时发现 3000 端口冲突；确认占用者是本次开发留在后台的实例（比赛尚未开始），已停止该实例，将启动交回用户终端。再次启动会生成新的 Host 链接，旧链接不再使用。

## 当前运行方式

```powershell
npm start
# 本地完整 PK：两个模拟主播 + 两个模拟观众
npm run sandbox
```

- `http://127.0.0.1:3000/` 是新入口页；真实 Twitch 扩展由安装激活后的 Twitch 页面提供身份。
- `http://127.0.0.1:3010/sandbox` 是明确标记的四角色本地联调页，当前由开发测试进程启动。
- 原始主持人功能保留在 `/debug`，仅用于排错；终端打印 Debug 私密链接。
- 先用 Demo 完成开始 → 三次 A 队 Attack → B 队挑战 → 开放叛变 → A→B → 计分 → 结算。
- 要连接真实聊天，切换 Twitch 模式，等频道 CONNECTED 再开始。
- 先前占用 3000 的开发实例已停止；当前模拟器使用 3010。不要重复启动同端口实例。
- 原始机器人改为 `npm run bot`，不要和 PK 的 Twitch 模式同时运行。
- 详细说明：[README](README.md)；录制与提交清单：[demo-runbook](docs/demo-runbook.md)。

## 实现决策与限制

| 项目 | 当前实现与原因 |
| --- | --- |
| 语言 | 延续现有 Node.js `.mjs`，减少编译工具和安装步骤；没有按初步建议引入 TypeScript/React。 |
| 网页实时同步 | SSE 推送状态 + HTTP POST 主持人操作，满足网页单向状态推送；Twitch 仍使用 EventSub WebSocket。 |
| 保存 | 原子 JSON 配置 + 有上限的事件日志，暂不引入 SQLite。 |
| 房间 | 旧调试页单房间；原生服务支持受限数量的 PK 房间，频道同一时间只能加入一场。 |
| 比赛恢复 | 刷新网页能恢复；重启后端会回到 Demo 准备阶段，不恢复进行中的比赛。 |
| 网络部署 | 默认只监听本机；远程两位主播需共用 HTTPS 后端，尚未部署。 |
| OAuth | token 校验与失败提示已实现，暂不自动刷新过期 token。 |
| 真实验证 | 单频道订阅已验证；真实观众指令驱动完整对局、第二频道和双主播 OBS 仍待联调。 |
| 视觉验证 | 响应式 CSS 和页面交互已实现，尚无真实浏览器/OBS 截图证据。 |

## 队友下一步

1. 按 [原生扩展配置指南](docs/twitch-extension-setup.md) 创建 Twitch Extension；私密填写 Client ID 和 shared secret。
2. 提供第二位主播登录名，并给两个频道及观众测试账号配置测试名单、安装和激活。
3. 按 [后端部署指南](docs/cloud-deploy.md) 部署同一个 HTTPS 后端，再生成正式 Extension ZIP。
4. 两位主播在 Twitch 页面完成邀请/接受/准备，观众通过原生按钮或聊天参与；验证自动开赛、攻击、叛变、结算。
5. 录制真实 Twitch 全链路与 Codex 开发过程，整理提交。本地模拟只用作回归测试证据。
