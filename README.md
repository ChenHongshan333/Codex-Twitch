# ChatCrossfire

Current delivery route: **web setup page + real Twitch chat + physical tracking + OBS**.
Streamers configure cameras and start/pause from the web page; viewers participate
in Twitch chat. The backend automatically handles collisions, health and results.
Keyboard-controlled characters are for simulation only; the native Extension
remains an optional mode.
After configuring real input, run `npm run doctor:dodge`, `npm run verify:dodge`,
then `npm run dodge`. The first two commands check configuration and read-only
chat/viewer-count connectivity respectively; neither starts your broadcast.
The live readiness checklist and chat acceptance/rejection reasons help identify gaps.
For a solo video demonstration, set `DODGE_MODE=ai-demo` and `DODGE_LIVE=1`,
configure only real channel A, and let a clearly labelled local game AI control
the other side. A still needs to be live, with a real viewer-count sample and
camera A calibrated. The default `DODGE_MODE=duel` retains two-channel mode.
See the [shoot plan](docs/demo-runbook.md) and
[real-input setup steps](docs/dodge-runbook.md#real-twitch-input-private-configuration).
This remains a single-machine prototype; remote two-computer play and adapters
for specific VTuber applications are not implemented.

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

## Collaboration and latest audit

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

**Your chat. Their problem.** A native Twitch Extension: two streamers invite,
accept and ready up within Twitch. The backend automatically starts the match,
manages attacks and defection, and ends and settles the community team battle.
No third host is required.

## Native Extension entry point (optional route)

```powershell
# Standard server, port 3000 by default; landing page covers Twitch and local setup
npm start
# Separate four-role local integration sandbox, port 3010 by default
npm run sandbox
```

Open `http://127.0.0.1:3010/sandbox`. Four windows represent two simulated
streamers and two simulated viewers. A invites `demo_violet`, B accepts, and both
ready up; the backend automatically counts down and starts the match. Viewers
click Join / Attack and Defect during the halftime window; the match ends when
time runs out. An optional 30-second round is available for testing. The page is
clearly marked **LOCAL SIMULATION**; it creates no real Twitch accounts and does
not claim that native installation has been verified.

Real native Twitch integration requires additional Extension configuration,
separate from the existing chatbot's OAuth application:

```text
TWITCH_EXTENSION_ID=your-extension-client-id
TWITCH_EXTENSION_SECRET=your-extension-base64-shared-secret
PUBLIC_ORIGIN=https://your-backend.example.com
ENABLE_SANDBOX=0
```

Run `npm run doctor:extension` to check for missing configuration without printing
credentials. The backend verifies JWTs supplied by Twitch Helper. Only the
corresponding channel's broadcaster can initiate or accept a PK match. Viewers
must share their identity to participate; identity, cooldown and defection
allowance are shared across both channels.

- [Twitch Extension creation, packaging, installation and testing guide](docs/twitch-extension-setup.md)
- [Public HTTPS backend deployment guide](docs/cloud-deploy.md)
- [Project progress and real-world verification status](progress.md)

Production ZIP: `npm run package:extension -- --backend https://your-backend.example.com`.
Without a real HTTPS backend, generate only a clearly labelled local package:
`npm run package:extension -- --backend http://127.0.0.1:3010 --local`.

A temporary HTTPS test backend and a matching frontend ZIP in production format
were prepared in an earlier session. See [progress.md](progress.md) for historical
addresses, verification evidence and missing platform setup. Twitch developer
configuration and installation/activation by both streamers are still required;
a public health check alone does not establish real Twitch integration.

Automatic scoring counts successfully released attacks (community battle points).
It does not judge artwork quality or determine the outcome of an external game.
Twitch developer setup, a second real channel, public deployment and end-to-end
verification within Twitch remain outstanding; see progress.md.

## Original debug mode (retained below for troubleshooting)

Suitable for drawing, quizzes, creative activities and other contests agreed on
by the streamers. The host keeps score and streamers perform the agreed
challenges. OBS animations do not automatically change or control external games.

## Start in 30 seconds

Requires **Node.js 22.13+ (24 LTS or newer recommended)**. The runtime has no
third-party dependencies. Keep any existing `.env` in the repository; do not
overwrite it.

```powershell
npm start
```

Open the **Debug** link printed in the terminal
(`http://127.0.0.1:3000/debug#key=…`) to unlock debug controls in your local
browser. The plain `/debug` URL is read-only. The debug key is separate from the
Twitch token; do not share the private link with viewers.

The default is a clearly labelled **Demo** mode. It does not connect to Twitch
or send Twitch chat messages. The demo runs without a `.env` file.

## Try a complete round

1. Open the Host link and click **Start the round**.
2. Under **Make some noise**, click team A's **Attack** three times. Simulated
   viewers join automatically, and team B receives a challenge.
3. Click **Open defection**, then **A → B**, and watch the defection announcement
   and team membership counts change.
4. Use `+` / `−` beside each team's score to keep score manually.
5. Click **End round**, adjust the final scores, then click **Confirm result**.
6. Click **Set up another round** to return to the lobby.

Demo buttons follow the same gameplay rules, with five simulated accounts per
team by default. Rapid clicks may report a cooldown or a fully charged team.

## Connect real Twitch chat

The existing `.env` only needs:

```text
TWITCH_OAUTH_TOKEN=your-user-access-token
```

Copy `.env.example` only if `.env` does not exist. Enter the token itself, not
the OAuth return URL. The app obtains the Client ID, User ID and login name
through the official validation endpoint; no Client Secret is needed.

1. In **Match setup**, enter both channel login names, without URLs. A defaults
   to `hongshan333`; B can temporarily remain blank for single-channel testing.
2. Enter the match theme, both display names and the challenge pool. Both
   streamers should approve the challenges beforehand.
3. Save settings, switch to **Twitch**, and wait for **CONNECTED**.
4. Click **Start the round** and ask viewers to send commands in real chat.

| Command | Effect |
| --- | --- |
| `!join` | Initially joins the current channel's team; also available in the lobby. |
| `!attack` | Charges your team to attack its current opponent. |
| `!switch` | Defects during the window, once per viewer per round. |
| `!help` | Requests brief instructions; chat replies are throttled. |
| `HeyGuys` | Retained connectivity check; replies with `VoHiYo` and gameplay tips. |

The minimum read scope is `user:read:chat`; chat replies also require
`user:write:chat`. This uses **User Access Token + EventSub WebSocket**, separately
from the Cloud Bot App Access Token authorization flow. Each channel has its own
subscription, feeding the same match.

One Twitch user shares an identity, allegiance, cooldown and defection allowance
across both channels. Sending `!join` in the opposing chat does not switch teams.
Duplicate events and forwarded Shared Chat copies are filtered out.

Check real connectivity without sending chat messages:

```powershell
npm run verify:twitch -- hongshan333
npm run verify:twitch -- hongshan333 second_channel_login
```

The original single-channel bot is retained:

```powershell
npm run bot
```

Do not run the original bot alongside the PK app's Twitch mode, or `HeyGuys`
may receive duplicate replies.

## OBS and streamer cue pages

Click **Broadcast kit** for links; none includes the host key.

| Page | Purpose |
| --- | --- |
| `/overlay/a` | Transparent OBS view for streamer A |
| `/overlay/b` | Transparent OBS view for streamer B |
| `/cue/a` | Challenges for streamer A to view on their own screen |
| `/cue/b` | Challenges for streamer B to view on their own screen |

Add a Browser Source in OBS at **1920 × 1080**. Each streamer uses their own
overlay. It shows scores, time, team membership, attack animations, defection
notices and the current challenge. Refreshing loads the current state without
replaying old attacks.

Each streamer also opens their own **cue** page. OBS effects do not automatically
affect the game being played. The console's **Sound off / on** controls only its
own synthesized effects; OBS pages are silent by default.

## Default rules

- Each viewer contributes one charge every 10 seconds; defection retains the cooldown.
- Every 3 charges trigger a challenge; each team has a minimum 20-second release interval.
- Challenges last 15 seconds; each team can have at most one active and one queued challenge.
- A fully charged team stops accepting charges until it can legally attack.
- A 30-second defection window opens automatically at halftime by default. The
  host can open it early or close it; it opens only once per round.
- Pausing freezes gameplay time for the round, challenges, defection window and cooldowns.
- Attacks and defection do not directly add match points; the host scores under the agreed rules.
- Scores can be corrected after settlement; corrections require the result to be confirmed again.
- Clicking `×` beside a team's current challenge cancels its active and queued challenges.

Team attack caps limit spam and challenge stacking; **they do not establish full
fairness between audiences of different sizes**.

## Sharing with two remote streamers

Both overlays must connect to **the same backend**. localhost refers only to the
current computer; sending a localhost link to another computer will not work.

For a real two-streamer demo, deploy to a Node.js host supporting long-lived
HTTP/SSE connections, accessed through an HTTPS reverse proxy:

```text
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=https://your-domain.example.com
ADMIN_KEY=your-random-private-key-at-least-24-characters
TWITCH_OAUTH_TOKEN=your-existing-user-token
```

Disable reverse-proxy response buffering for `/api/events`. The backend initiates
the Twitch EventSub WebSocket connection; no webhook callback is required.
Share only read-only overlay/cue links with streamers. Host links are for the
referee or host only. Streamers use their existing tools for audio/video calls
and arranging both video feeds.

No remote service was deployed, account authorization changed automatically or
project published as part of the original debug setup.

## Development and testing

```powershell
npm ci
npm run check
npm test
```

`jsdom` is a development-only test dependency for page rendering and interaction;
it does not establish real-browser visual correctness. Rule tests use controlled
clocks. Twitch lifecycle tests mock HTTP/WebSocket, independently of real
accounts and network access.

```text
server.mjs               HTTP, host sessions, SSE and command routing
src/engine.mjs           Authoritative rules engine, separate from networking and UI
src/twitch.mjs           Validation, two-channel subscriptions, migration, reconnection, deduplication
src/store.mjs            Atomic configuration saves and rotating event logs
public/                  Console, OBS overlays and streamer cue pages
test/                    Rules, API, Twitch and page interaction tests
scripts/verify-twitch.mjs Read-only real connection check: subscribes without sending messages
bot.mjs                  Original initial connectivity test entry point
progress.md             Team progress, verification results and outstanding work
```

The web UI uses **SSE + HTTP POST** for live updates: the backend pushes state,
and the host acts through protected HTTP requests. Twitch still uses EventSub
WebSocket.

`data/config.json` stores settings. `data/events.jsonl` stores events and rotates
at approximately 5 MB, retaining one previous log. These files are not committed
to Git. Match state is in memory: **restarting returns to the Demo lobby and does
not recover an ongoing match**. Page refreshes and network recovery retrieve
state from the still-running backend.

## Troubleshooting

- `EADDRINUSE`: another process is using port 3000. Stop the old instance or set `PORT=3001` in `.env`.
- Controls disabled: use the Host link printed by the current startup. Restarting changes the random key and session.
- Cannot save settings: reset to a lobby with no participants.
- `fetch failed` / reconnecting: the process needs access to `id.twitch.tv`, `api.twitch.tv` and `eventsub.wss.twitch.tv`.
- HTTP 401: the token has expired or been revoked. Update `.env` and restart; automatic refresh-token renewal is not implemented.
- HTTP 403: check token scopes and the relevant channel's chat access requirements.
- Only `1/2` connected: one channel is connected; configure the second real channel.
- Unexpected Twitch disconnection: the app shows reconnecting and automatically resubscribes. Messages missed during the outage cannot be recovered; the host can pause.
- Remote Host rejected: configure the exact `PUBLIC_ORIGIN` and access the app through that domain.

Keep `.env`, tokens, Client Secrets and host links out of submission materials.
If a token is exposed, revoke the relevant Twitch authorization and obtain a new one.

## Hackathon delivery

Delivery still requires real Twitch/OBS demonstration footage for the selected
mode, a video under three minutes, the complete repository, a project description
and the main development thread's Codex Session ID. The current recording route
uses one human and a clearly labelled local AI opponent; complete two-human
acceptance remains separate outstanding work. Finished code does not mean the
hackathon entry has been submitted.

Official references: [Chatbot Guide](https://dev.twitch.tv/docs/chat/chatbot-guide/),
[chat authorization](https://dev.twitch.tv/docs/chat/authenticating/),
[EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[hackathon page](https://twitchcon-codex.devpost.com/).
