# 部署原生扩展的共享后端

两位远程主播必须访问同一个公网 HTTPS 后端。本项目使用长期运行的 Node.js 进程，比赛状态在内存中；首次演示使用 **单实例**，不要开启多副本、自动缩容为零或请求结束即销毁进程的部署方式。重启会结束进行中的内存比赛。

## Docker 镜像

仓库提供 `Dockerfile` 和 `.dockerignore`。镜像基于 Node.js 24，运行时无第三方 npm 依赖，以非 root 的 `node` 用户运行。镜像只复制运行代码，排除 `.env`、本机事件日志、测试、node_modules 和开发归档。

```powershell
docker build -t chatcrossfire .
```

在支持长期 Docker/Node.js 服务的主机部署镜像。容器监听 `0.0.0.0:$PORT`，默认端口 3000；主机在前面提供有效 HTTPS。环境变量通过主机的密钥管理或私密运行配置注入，不能打进镜像。

| 环境变量 | 用途 |
| --- | --- |
| `PUBLIC_ORIGIN` | 精确的实际公网 HTTPS origin，无路径、参数和片段 |
| `HOST` | Docker 中为 `0.0.0.0` |
| `PORT` | 由主机提供，默认 `3000` |
| `TWITCH_EXTENSION_ID` | 扩展 Client ID |
| `TWITCH_EXTENSION_SECRET` | 扩展的 Base64 共享密钥，仅后端使用 |
| `TWITCH_OAUTH_TOKEN` | 已有聊天用户 token，供频道查询/聊天接入 |
| `ENABLE_SANDBOX` | 生产环境必须为 `0` |
| `ENABLE_DEBUG` | 生产环境设为 `0`，明确关闭旧版开发者控制台 |

`/api/health` 可作为健康检查端点。`ok=true` 只说明当前进程健康，还需确认 `extensionConfigured=true`、`sandboxEnabled=false`。

生产环境无需配置 `ADMIN_KEY`。设置 `PUBLIC_ORIGIN` 后，后端默认关闭 `/debug` 和旧版 `/api/session`、`/api/state`、`/api/events` 等开发接口；即使提供正确的调试 key，也不能在默认公开配置中解锁这些接口。原生 `/api/extension/*` 继续使用经过验证的 Twitch JWT 工作，不依赖主持人 key。公开配置同时禁止启用本地模拟器。

## 反向代理与保存

- 对 Node.js 转发原始公网 Host；`PUBLIC_ORIGIN` 必须匹配用户实际访问的域名。
- 原生扩展使用带 JWT 的 HTTP 请求轮询同一后端；不要缓存 `/api/extension/*` 响应。
- 公网实例不需要开放旧版 `/api/events` SSE。若需本地调试，使用单独的 loopback 开发实例。
- 挂载持久目录到 `/app/data` 可保存旧版配置和事件日志；这不会让内存中的进行中比赛自动跨重启恢复。
- 不要把调试 Host 链接、OAuth token 或 Extension Secret 放在公开站点或项目说明中。

## 上线核对

1. 访问公网 `/api/health` 并确认预期标志。
2. 在 Twitch 开发者控制台允许该 HTTPS 后端 URL，配置扩展身份与测试名单。
3. 用实际后端域名运行 `scripts/package-extension.mjs`，生成生产 ZIP。
4. 上传 Hosted Test，在两个已授权的真实频道验证。[完整配置清单](twitch-extension-setup.md)

此文件提供部署配方，不表示已经创建云主机、上传镜像或安装 Twitch 扩展。实际部署地址应填入 `progress.md`，不要使用示例域名代替。

## 本地电脑上的临时 HTTPS 联调

本次另外建立了 Cloudflare Quick Tunnel，实际地址和当前状态见根目录 progress.md。该方式不需要云主机账号，但只有本机后端和隧道两个进程都运行时才可用，不适合作为长期托管承诺。

两个独立终端分别运行（换成当次真实生成的地址）：

```powershell
# 已从官方来源下载并验证签名的 Cloudflare 程序
.\artifacts\cloudflared.exe --no-autoupdate tunnel --url http://127.0.0.1:3020 --protocol http2
```

```powershell
npm run start:public-test -- --origin https://当次实际域名.trycloudflare.com --port 3020
npm run verify:public
```

启动器只在本机 3020 监听，强制关闭模拟器和调试接口，并把公开路由元信息写入 artifacts/public-backend.json。已有 `.env` 的 token 和 Extension secret 只加载到后端进程。修改 `.env` 后需重启后端以读取新配置；可以保留隧道进程来维持当前域名。

`verify:public` 只检查服务健康、扩展页面和权限边界，明确报告是否尚缺 Extension 配置；它不登录 Twitch，也不替代真实账号验收。

Quick Tunnel 每次重建会改变域名、不保证稳定性，且不支持 SSE；新的原生扩展使用 HTTP 轮询，旧 SSE 调试接口不对公网开放。更换地址后重新打包 ZIP、更新 Twitch 后端 URL 允许列表。[Cloudflare 官方限制](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
