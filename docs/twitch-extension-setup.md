# 在 Twitch 内安装 ChatCrossfire 测试版

这份说明对应原生 Twitch Extension：主播在 Twitch 内发起/接受 PK，观众在扩展里加入、攻击和叛变。独立网页的四个模拟身份用于本地集成测试，不能替代本说明中的真实账号验证。

## 准备两类配置

已有聊天机器人应用和 Twitch Extension 是两项不同配置。继续保留原有 `TWITCH_OAUTH_TOKEN`；另外在 [Twitch Extensions 开发者控制台](https://dev.twitch.tv/console/extensions) 创建扩展，获取 **Extension Client ID** 与 **Extension Secret**。

把以下值填入后端的私密环境变量，不写入前端、ZIP、源码或截图：

```text
TWITCH_EXTENSION_ID=扩展的ClientID
TWITCH_EXTENSION_SECRET=扩展控制台提供的Base64编码Secret
TWITCH_OAUTH_TOKEN=已有用户访问令牌
PUBLIC_ORIGIN=https://实际后端域名
HOST=0.0.0.0
PORT=3000
ENABLE_SANDBOX=0
```

Extension Secret 用来验证 Twitch 提供的 JWT。它不是 OAuth token，也不是聊天应用的 Client Secret。后端负责验证身份与角色；客户端提交一个频道名不等于拥有该频道。[Twitch 身份与共享密钥说明](https://dev.twitch.tv/docs/extensions/required-technical-background/)

部署后打开 `https://实际后端域名/api/health`，确认 `ok=true`、`extensionConfigured=true`、`sandboxEnabled=false`。健康检查通过只说明服务和配置就绪，不说明 Twitch 已安装扩展。

## 创建版本并设置入口

首次可以先启用 **Panel**，确认最小闭环；需要直播画面上的 PK 图层时同时配置 **Video Overlay**。不要把普通浏览器插件当作 Twitch Extension：这里使用 Twitch 官方 Helper 和 Twitch 托管的 iframe。

打包器会生成这些入口，所有路径均相对于 ZIP 根目录：

| 控制台字段 | 填入 |
| --- | --- |
| Panel Viewer Path | `panel.html` |
| Panel Height | `500`；按有效 `318 × 496` 视口检查布局 |
| Video Overlay Viewer Path / Fullscreen View Path（启用该类型时） | `overlay.html` |
| Config Path | `config.html` |
| Live Config Path | `dashboard.html` |

`config.html` 是主播安装配置页；`dashboard.html` 是主播直播期间的控制入口。主播可以从直播仪表盘打开它发起邀请。观众入口不会获得主播权限。[扩展页面组成](https://dev.twitch.tv/docs/extensions/required-technical-background/)

Panel 的有效布局空间为 `318 × 496`；本地弹出窗口较大，不能据此代替 Panel 尺寸验证。[官方 Panel 布局指南](https://dev.twitch.tv/docs/extensions/designing/)

在 **Capabilities** 中启用 **Request Identity Link**，使已登录观众可以授权共享 Twitch 身份。首次点击参与时，观众需要接受该身份请求；只读观看无需把自己冒充成可参战账号。聊天回复由已有 EventSub/Helix 连接处理，不要为了按钮玩法额外启用 Bits 或付费权限。

在扩展允许联网的 URL 设置中加入实际 **HTTPS 后端 origin**。后端 CORS 同时需要允许这个 Extension 对应的 Twitch CDN origin：`https://<EXTENSION_ID>.ext-twitch.tv`。不能简单改为允许任意来源；后台仍会校验每次请求的 Extension JWT。

## 生成并上传前端 ZIP

在仓库根目录运行，把示例域名替换为已经部署的实际地址：

```powershell
node scripts/package-extension.mjs --backend https://实际后端域名 --check
node scripts/package-extension.mjs --backend https://实际后端域名
```

输出：

```text
artifacts/chatcrossfire-extension.zip
artifacts/chatcrossfire-extension.json
```

JSON 是本机核对清单，不需要随 ZIP 上传。ZIP 中只有 `index.html`、四个页面入口、脚本、样式和生成的公开 `config.js`。`config.js` 只含后端地址和关闭模拟器的标志。打包不会读取 `.env`，不会把共享密钥或 token 放入归档，生产包会移除本地模拟身份入口。

在 Twitch 控制台的 **Files** 上传 ZIP，然后按控制台流程切换到 **Hosted Test**。ZIP 已把文件放在根目录，不要再套一层文件夹。Hosted Test 让前端由 Twitch CDN 提供，后端仍需保持在线。[版本与 Hosted Test 流程](https://dev.twitch.tv/docs/extensions/life-cycle/)

如果只是检查本地归档结构，可运行：

```powershell
node scripts/package-extension.mjs --backend http://127.0.0.1:3000 --local
```

它输出带 `-local` 的开发归档。Loopback 指向使用者自己的电脑，不能把这个归档当作两位远程主播的可用 Hosted Test 成品。

## 配置测试账号与两个频道

在 **Access** 中添加两位主播到 **Streamer Allowlist**，把参与演练的主播和观众账号加入 **Testing Account Allowlist**。两位主播分别安装并激活测试版本，启用对应的 Panel/Overlay 槽位。

测试阶段只有指定测试账号及 Twitch 相关人员能看到扩展；其他观众可能看到正常频道但没有扩展。未发布扩展还可能显示测试披露，需要测试者接受。不要用未加入名单的普通账号来判断“插件失效”。[可见性和测试披露](https://dev.twitch.tv/docs/extensions/life-cycle/)

## 真实全链路验收

准备至少两个不同主播账号。测试观众可以是主播以外的队友；同一 Twitch 用户跨两个频道仍应只有一个阵营和一份冷却。

| 步骤 | 操作 | 应看到 |
| --- | --- | --- |
| 1 | A 在自己的扩展控制入口输入 B 频道，发起邀请 | A 等待，B 收到邀请 |
| 2 | B 接受邀请 | 双方看到相同主题、对手和准备状态 |
| 3 | 双方点击准备 | 同一个后端倒计时，随后自动开赛 |
| 4 | A 的观众授权身份、加入并攻击 | A 充能，B 收到挑战；双方数据一致 |
| 5 | 比赛到达叛变窗口，A 的观众点击叛变 | 人数迁移，同一账号不能再次叛变 |
| 6 | 该观众冷却后再攻击 | 攻击目标随新阵营改变 |
| 7 | 等待比赛到时 | 自动结束，显示社区阵营战结果 |
| 8 | 刷新双方扩展 | 恢复当前结果，不重新开赛或重放旧攻击 |

自动分数表示应用可验证的社区阵营战数据，不会自动判断外部游戏成绩或画作质量。主播自定挑战的实际表现需另行约定。

本地测试通过、ZIP 成功生成、健康检查通过和 Twitch 内验收，是四种不同证据。请分别在 `progress.md` 记录，只有完成上表才标记真实全链路通过。正式公开发布还需 Twitch 审核；测试版可用不等于已公开上架。

## 常见问题

- **普通网页显示等待 Twitch 授权**：生产入口需要在 Twitch iframe 中收到 Helper 的授权回调。单独打开 HTML 不会自动成为真实 Twitch 主播。
- **扩展看不到**：核对测试名单、频道激活槽位、版本状态和是否已接受测试披露。
- **后端报 401**：核对 Extension ID、该扩展的 Secret、Secret 是否仍为控制台提供的 Base64 原文，以及前端是否使用最新 Helper JWT。
- **能看不能参战**：登录 Twitch，接受 Request Identity Link；匿名/未授权身份仅只读。
- **请求被 CSP/CORS 阻止**：核对实际后端 HTTPS origin 已在扩展允许 URL 中，后端允许正确的 Extension CDN origin，生产包中地址没有指向 localhost。
- **主播按钮不可用**：必须从自己的频道或直播仪表盘以主播身份打开；后端不会接受观众伪造的主播动作。
- **双方状态不同**：确认两边包配置的后端 origin 完全相同，且云端只有一个当前服务实例。
