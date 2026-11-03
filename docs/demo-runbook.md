# ChatCrossfire — narrated demonstration video

## Produced cut — 2026-11-03

Preferred review version after the reference-style update:
`artifacts/submission-video/ChatCrossfire-demo-face-only.mp4`. A small opaque oval
robot face still follows the face; body/shoulder/arm visibility is preserved.
New duration 2:15. Conversational first-person English narration uses the generic
Andrew voice, with action-aligned pauses and 76 bold phrase captions with violet
emphasis. Reference footage/audio is not reused and its speaker is not cloned.
Same path updated; original 142s masked version retained as
`ChatCrossfire-demo-face-only-before-style.mp4`. FFprobe, full decode and actual
135s audio energy/peak checks PASS. No upload/submission or archive changes.

Current timeline: 0:00–0:20 idea/broadcast camera setup; 0:20–0:36 connection and
rehearsal explanation; 0:36–1:30 actual engine rehearsal; 1:30–1:59 Codex source
and real test results; 1:59–2:15 closing with the remaining live-chat evidence gap.
Current narration/subtitles are in `natural-style/` and mirrored to root
`narration.txt`/`captions.srt` under the local artifact directory. The 142s original
timeline and earlier intended shoot below remain historical evidence.

Local output: `artifacts/submission-video/ChatCrossfire-demo-narrated.mp4`, 2:22,
720p H.264/AAC, English Jenny neural narration with normalized volume, synchronized
burned-in English subtitles; separate `captions.srt` and `narration.txt` included.
No upload or submission was performed. The following historical shoot plan was
not fully achieved because no real chat-triggered match was recorded.

| Time | Actual contents |
| --- | --- |
| 0:00–0:21 | Project idea and genuine Twitch-delivered camera calibration footage; browser tabs cropped |
| 0:21–0:40 | Verified connection explanation; explicit transition to controlled local rehearsal |
| 0:40–1:34 | Actual offline engine and production canvas running synthetic messages/automated A marker versus labelled game AI; playback 1.22× |
| 1:34–2:05 | Real source excerpts and saved 126/126 automated test results; narration explains Codex's work |
| 2:05–2:22 | Recorded broadcast footage and explicit remaining real-chat gameplay validation |

The raw Twitch stream capture is 162.282 seconds and contains camera setup only.
The rehearsal report records real engine events, a single defection, damage,
pause/resume and final AI victory (A 2 HP, B 5 HP). It is not presented as live
Twitch gameplay. Live synthetic endpoints remain disabled; the renderer runs a
separate offline engine and never sends messages to Twitch. Camera-calibration
controls and the tracking-lost state remain visible in the genuine footage.

The owner no longer needs to keep camera/OBS live for this edit. OBS and capture
stopped and Twitch was API-confirmed offline. Two public archives remained;
ending the broadcast does not remove them. No archive changes were authorized.
Before submission, owner reviews the MP4, assesses the missing real chat-to-game
proof, confirms the main code-building session ID, and uploads the chosen cut.

## Earlier intended shoot

Current plan, 2026-11-03: one presenter, real Twitch channel `hongshan333`, and
a clearly labelled **local game AI** opponent. Default two-channel dodge and
native PK remain separate modes. The plan below supersedes the historical
host-scored script at the end of this file.

The shared [ideation tab](https://docs.google.com/document/d/1x_30AXx2-QcIlqXfVeT-18YsWaFR7mQIaJNL9Q7lmvk/edit?tab=t.nlw8e441e7ui)
was read fresh through its public text export. Its core idea is opposing-chat
interference, free participation and timed allegiance switching. Demonstrate
the implemented physical dodge game, with the AI side labelled throughout.

## What the presenter does now

1. Log into your own `hongshan333` account through OBS's Twitch connection flow.
   Keep login, OAuth, stream-key and private settings screens out of recordings.
   No second account is needed for `DODGE_MODE=ai-demo`.
2. Refresh [the controller](http://127.0.0.1:3020/). Confirm **TWITCH × LOCAL AI
   DEMO**, enable camera in the right-hand panel and click your bright marker.
   Keep this page visible; camera A is the only physical marker needed.
3. For a simple composition, add OBS **Window Capture** of that browser window.
   Include your actual camera preview and both labelled arenas. The tracker
   keeps the webcam; OBS captures the window instead of reopening it. Scroll
   to the battle area after checking readiness. Alternatively compose the
   matching camera and `/overlay/a` alongside `/overlay/b`, each 960x540.
4. Preview the picture you are comfortable broadcasting. You, the account
   owner, start the Twitch broadcast. Open your actual Twitch channel/player
   and wait for Twitch to confirm it is live with a fresh sample (zero viewers
   is allowed in AI demo) and for the camera checklist
   to be ready. No program command here publishes video on your behalf.
5. Start a 60-second challenge. In actual Twitch chat send a distinct ordinary
   message, such as `Crossfire demo 1`, leaving at least two seconds between
   accepted messages. Capture chat → received/accepted counter → corresponding
   text bullets against the AI. Move the physical marker to dodge a labelled
   AI shot, then demonstrate an actual collision and health change. Record the
   actual result rather than prescribing who wins.
6. Optional defection: attack as that viewer, send `!switch` during the shown
   middle window, then capture the next eligible message attacking the human
   arena. The same identity keeps its cooldown and switch allowance.
7. Capture a short continuous view of the actual Twitch channel/player and
   chat showing the delivered project, not just localhost or an OBS preview.
   Keep tracking visible during play. A separate screen recording can capture
   the Twitch browser without changing the scene OBS is broadcasting.
8. Record 15–30 seconds of the actual Codex conversation, its code changes and
   automated checks. Run `/status` in the thread where most building happened;
   use that ID in the submission form. The recovered implementation thread
   `01a197c3-77bd-72b1-a450-ca1147bf6c53` is observed, but main-session selection
   still needs owner confirmation.

One presenter is sufficient. On-camera speaking is optional: you can speak
Chinese and add English subtitles, or record the English narration afterward.

## Final edit timeline

| Final time | Picture | Point |
| --- | --- | --- |
| 0:00–0:10 | Actual Twitch message → bullet → dodge/hit | Working hook |
| 0:10–0:25 | Presenter and running game, labels visible | Free-chat idea; one real channel versus local AI |
| 0:25–1:20 | Actual channel/player + chat, game reaction, movement and health | Live integration and physical mechanic |
| 1:20–1:45 | Captured defection and/or actual round result | Timing, shared identity and automatic settlement |
| 1:45–2:25 | Actual Codex thread, changed code and checks | What Codex built and how the user directed it |
| 2:25–2:45 | Return to actual Twitch/game footage | Value and honest prototype scope |

Keep at least one chat-to-game sequence continuous and readable. Do not replace
missing evidence with a generated Twitch screen, fabricated message or viewer
count. AI attacks have their own label. The 125/125 automated pass is synthetic
test evidence; the recording must separately show the real interaction. The
current full suite is 126/126 after adding the live-zero-viewer regression.

## Draft English voiceover

Read against the events actually captured; use the alternate paragraph if
defection was not recorded successfully.

**Hook and introduction:**

Your chat. Their problem. This is ChatCrossfire: Twitch messages become bullets
in the other arena. We wanted viewers to shape a streamer battle through free
chat and team choices. Today I'm demonstrating the physical dodge mechanics
with one real Twitch channel and a clearly labelled local AI opponent.

**Live demonstration:**

This is my live Twitch channel, hongshan333. Watch this message in chat. Our
backend receives it through EventSub and releases horizontal message bullets
toward the AI. The AI moves automatically. Its own attacks are labelled AI.
I move a coloured marker on camera to dodge. Here I avoid a shot; here a
collision automatically costs one health point.

Viewers can change sides during the middle window. This message backs the AI
instead, while the same identity and cooldown remain. The server controls the
timer and settles the round from remaining health. No paid gift is required.

Alternate without captured defection: Every accepted message shares a viewer
cooldown. The server controls the timer, collision checks and remaining health.
At the end of the round it settles the result automatically. Viewers participate
through free chat; no paid gift is required.

**Codex contribution:**

Codex helped turn our design into the game engine, Twitch integration, camera
tracker and OBS overlays. We used it to refine shared cooldowns, swept collisions,
reconnect behaviour and this labelled AI demonstration. Here are the actual code
changes and automated regression checks. We chose the rules and verified the
results. Codex implemented and tested the iterations.

**Closing:**

ChatCrossfire makes the audience part of the action. This recording uses one
live Twitch channel and one local game AI. The two-channel mode remains in
the project; remote streamer transport and external avatar adapters are future work.

## Production status

Implementation and shoot plan are ready for recording. Raw real-Twitch footage,
presenter audio, final MP4 and upload are **not yet produced**. Store recordings
under ignored `artifacts/submission-video/raw/` or supply their local paths.
FFmpeg/ffprobe are available for editing, English captions and duration checks.
Export under 180 seconds; confirm the primary Codex session and repository/judge
access. YouTube may be public or unlisted, not private. Upload/submission is a
separate authorized step.

Sources checked 2026-11-03: [official rules](https://twitchcon-codex.devpost.com/rules),
[official FAQ](https://twitchcon-codex.devpost.com/resources),
[OBS quick start](https://obsproject.com/kb/quick-start-guide).

## Historical legacy host flow — not the current recording plan

> 以下保留旧版主持人 / OBS 流程用于排错，不用于当前投稿录像。原生 Extension 的主验收流程见
> [twitch-extension-setup.md](twitch-extension-setup.md)，更新视频脚本的任务见
> [TASKS.md](TASKS.md)。原生 PK 自动结算，不需要第三位主持人；
> `/overlay/*` 只读取旧版独立比赛状态，不能用于证明原生 PK 的画面或比分。

## 录制前

- 两位主播确定相同的比赛主题、评分方式、三条可以实际执行的挑战。
- 确认两个真实频道均显示 CONNECTED；Demo 仅供排练，不替代真实 Twitch 集成。
- 两位主播各加入自己的 OBS overlay，在自己屏幕打开 cue 页面。
- 主持人和观众分别准备 Twitch 账号，一个账号不能在两个频道扮演不同阵营。
- 演练 `!join` → `!attack` → 挑战 → `!switch` → 攻击目标改变。
- 检查 OBS 1920×1080、普通电脑屏幕和手机宽度上的可读性。
- 录屏前关闭所有包含 `.env`、token 和 Host key 的窗口。

## 三分钟视频脚本

| 时间 | 画面 | 重点 |
| --- | --- | --- |
| 0:00–0:15 | 攻击与叛变精彩片段 | Your chat. Their problem. |
| 0:15–0:35 | 两位主播同题 PK | 主播自选内容，观众直接参战 |
| 0:35–1:20 | 真实聊天室指令与 OBS 同屏 | !join、!attack、对方实际执行挑战 |
| 1:20–1:55 | 窗口内观众 !switch | 名字跨阵营，下一次攻击目标改变 |
| 1:55–2:20 | 主持人确认胜负、社区战报 | 比赛成绩和阵营变化分开展示 |
| 2:20–2:50 | Codex thread、代码与测试 | 展示实现和修复过程，避开密钥 |
| 2:50–2:55 | 项目名和价值 | 预留时长余量 |

## 提交材料

- [ ] 完整源码、运行说明、素材与许可证说明。
- [ ] 仓库链接，按比赛要求设置访问权限。
- [ ] 公开 YouTube 视频，最长 3 分钟，包含真实 Twitch 和 Codex 使用。
- [ ] 项目功能、创新点、已知限制，以及 Codex 如何参与开发。
- [ ] 主要开发 thread 的 Codex Session ID，提交前核对。
- [ ] 内部目标：11 月 2 日晚完成提交，避免拖到 11 月 3 日 06:00 北京时间。

## MVP 后续候选

- 不同观众规模下的攻击资源归一化。
- 独立的弹幕躲避游戏模式和自动成绩接入。
- refresh token、多房间、房间邀请和更多管理角色。
- 经授权的自动剪辑、回放与更完整的赛后报告。
