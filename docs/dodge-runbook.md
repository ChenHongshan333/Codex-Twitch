# OBS dodge mode

This mode is the PK game itself: both streamers dodge in equal arenas, and
opponent-community messages scroll through the arena as bullets. It is not a
transparent interference layer over an arbitrary game, drawing session, or quiz.
Messages move horizontally through fixed lanes; they do not aim at or home on a
marker. Tracked markers still determine collisions and hits.

This separate local prototype implements the user's physical-danmaku direction.
It does not change native PK rooms, the four-role sandbox, or legacy OBS state.
It runs on one computer; two remote streamers and VTuber software adapters still
need a secure shared transport/integration. Do not expose this local controller
through a tunnel or weaken its loopback/Host/Origin checks.

## Try it without accounts

```powershell
npm run dodge
```

Open [the controller](http://127.0.0.1:3020/). Choose rehearsal keyboard markers
for both sides and a 60-second round, or click **Start rehearsal** to set these
up and begin test messages automatically. Manual setup: Start, then **Run both-side demo** or
send a message in the test form. Focus an arena and use WASD / arrow keys, or
drag the marker. The demo sends a synthetic event every 2.5 seconds, alternating
sides. It does not start a Twitch stream.

The battle room places match status, health and activity beside the arenas.
Use Focus Coral/Violet to inspect a larger preview; Both arenas restores the
equal split. Stream setup & fair play expands audience/camera/OBS instructions.
Start/Resume wait for both markers; synthetic event submission is disabled while
paused/disconnected and hidden in live mode. The practice figure only illustrates
the local hit marker; it is not an external VTuber avatar or a live video feed.

Messages from one community enter the opposing arena from its left edge and
travel left-to-right through successive fixed lanes. The warning marks the
message's lane before it moves. Move the tracked marker to avoid a capsule; hits
automatically reduce health. At the middle of the round, select a viewer who
already attacked and press **Defect this viewer**. Future attacks from that
identity go against their former side, even if you keep their source chat
unchanged. The two-second cooldown is retained. Already launched messages keep
their target and lane. One switch per round.

Five health; 1.5 seconds of invulnerability after a hit. Zero health ends the
round. At the time limit, higher remaining health wins; equal health draws.
Reset clears the match, allegiance, markers, bullets and scores. Rehearsal input
is explicitly synthetic; changing source chat is not authenticating a Twitch user.

## Camera and OBS

1. Choose **Camera tracker** in the controller for that side. Open its calibration
   link. Allow camera access after pressing **Enable camera**. Attach a distinct,
   bright coloured sticker to the desired body point; click it in the preview.
   This is a colour tracker, not full body-pose recognition. It chooses the largest
   connected matching region and rejects tiny/noisy or overly broad detections.
2. Keep tracking pages visible (separate windows for both), with consistent
   lighting and no matching background objects. The calibrated preview uses a
   centered 16:9 crop. Match its mirror setting and crop in the OBS camera source.
   Verify the 14-unit circle sits exactly on the sticker while moving to all edges.
3. In OBS, add Browser Source URLs
   [Coral overlay](http://127.0.0.1:3020/overlay/a) and
   [Violet overlay](http://127.0.0.1:3020/overlay/b), each **960 × 540**, above the
   corresponding camera. Use equal displayed arena sizes for both sides. The
   overlay is transparent except for projectiles, marker, boundary and status.
4. If OBS has exclusive webcam access, select **OBS Virtual Camera** in the
   tracker. Its feed must exclude this overlay to avoid feedback and false colour
   detection. Test camera sharing on the actual hardware; it is not guaranteed.
5. Start only when both marker indicators track. Loss of either marker for a
   second, a hidden tracker page, or a simulation stall pauses the round. Recover
   both markers, then explicitly Resume. Camera frames are processed locally;
   only coordinates go to the local server. Keyboard mode moves a test marker;
   it does not control an external VTuber avatar.

## Audience fairness and pressure

Every eligible event contributes weight divided by its verified **source
stream's concurrent viewer count**, then follows the user's allegiance. Visiting
the other chat does not automatically change allegiance. A switch does not
change the source denominator. Admission is normalized to 100 viewers: ten
one-unit events from 1,000 viewers and one from 100 admit one shot each.

Denominators have a floor of 20, exponential smoothing alpha .3 and remain
fixed within each eight-second bucket. Twitch counts are sampled together every
15 seconds and expire after 45 seconds. Missing/offline/zero counts suspend new
attacks and pressure on both sides; rejected activity is discarded. Shots
already in flight remain live. Synthetic counts are refreshed locally and labelled.

Free chat has one unit. Cheers have ceil(Bits/100) units and gift-sub events have
quantity units, both capped at three. All events from a known user share the
two-second cooldown. Anonymous gifts stay source-side. A gift receipt is not a
guarantee of a separate bullet: weighting, cooldown, fractional admission and
caps apply equally. No purchase is required to participate.

A lead of at least .02 units/viewer and ratio of at least 1.5, maintained for five
seconds in an eight-second bucket, triggers a six-second barrage. It releases
up to six shots/second, replaying recent accepted text after the queue drains.
Normal release is at most three/second. Each side has at most 32 pending and 32
active shots; queues never grow without limit. These are initial tuning values,
not validated competitive balance. Resetting buckets can interrupt a lead.

Every capsule has the same **128 × 28 rectangular hitbox**, clipped text and
horizontal speed of 300 arena units/second. A warning precedes movement by
800 ms. Lanes cycle independently for each arena, so repeated messages spread
vertically without following the marker. Free chat is a core input; Cheers and
gift-sub events are optional and capped at three units per event. Activity still
passes through audience normalization, cooldowns, pressure thresholds and queue
caps, so a paid event does not guarantee a bullet or extra damage. No neutral
hazards are generated: quiet chats produce quieter rounds. The engine uses
continuous relative collision checks against the visible 14-unit marker circle.
Rendering refresh rate does not award damage. Both marker inputs are trusted
local operator inputs; remote anti-cheat/latency compensation is not implemented.

## Real Twitch input (private configuration)

This route uses the web setup page, real Twitch chat and OBS. No native Twitch
Extension installation is required. The page starts/pauses the match; backend
collision, health, timing and settlement are automatic. Live play uses body-marker
tracking, not the rehearsal figure. Both arenas still run on one computer.

Create `.env` from `.env.example` only if absent. Never overwrite an existing
file or put tokens in chat, screenshots, records or Git. Configure:

```dotenv
DODGE_LIVE=1
DODGE_CHANNEL_A=first_channel_login
DODGE_CHANNEL_B=second_channel_login
```

`TWITCH_OAUTH_TOKEN` must be a valid user token with `user:read:chat` that can
subscribe to both channels. Client ID / Client Secret alone cannot do this.
The server validates the token to derive its identity and Client ID. See
[configuration guide](configuration-guide.md) for obtaining user authorization.

Optional `DODGE_SUPPORT_TOKEN_A` / `_B` are **that broadcaster's own user tokens**
with `bits:read` and/or `channel:read:subscriptions`. They use separate EventSub
sessions. A token from another broadcaster is refused. No app secret is used.
When a Cheer support subscription is configured, its chat representation is
ignored to prevent duplicate attacks; without it a Cheer chat message counts
as ordinary chat weight. Gift notifications require the subscriptions grant.
Use two different live channels: Twitch omits offline channels from Get Streams.
No token refresh flow is implemented; revoked/expired tokens require private renewal.

Restart `npm run dodge`. The UI must say **TWITCH INPUT** and both chats must
connect. Synthetic attack/audience endpoints then return 404. Ordinary chat,
`!attack`, and `!switch` use the real Twitch user ID. Shared Chat copies and
duplicate message IDs are ignored. Moderation delete/clear/ban events
conservatively remove all pending/in-flight text and reset pressure; damage
already awarded is not reversed. Delayed moderation cannot undo a shown frame.

### Check configuration, then check the actual connection

```powershell
npm run doctor:dodge
npm run verify:dodge
npm run dodge
```

`doctor:dodge` prints only configuration names, format/presence status and fixed
guidance. It exits 1 for incomplete live setup, without editing `.env` or making
network requests. A token-format OK is not token validity or a scope check.
`verify:dodge` first requires that configuration, then validates the user token,
subscribes to both chats and queries both actual viewer counts. It sends no chat,
does not start a round, camera or OBS broadcast, and closes its EventSub session
before exit. Offline/zero-viewer streams, failed subscription, API failure and
timeout exit 1. Exit 0 establishes only subscription/count access at that moment.

The live page has a readiness checklist for chats, viewer samples and markers.
It blocks Start/Resume until all are ready, including backend enforcement. Open
both camera setup windows, enable/calibrate the markers and keep them visible.
The page defaults to cameras; synthetic messages, test viewer counts and keyboard
marker controls are hidden or disabled in live mode. No full-body or avatar-software
tracking is implied by a fresh colour marker.

The per-side received/accepted/rejected chat counters help diagnose silence:
zero received means check connection/source chat; a rejected count shows the last
rule reason (e.g. not running, cooldown or missing counts). Accepted chat still
passes normalized admission and caps. Counters reset with the match.

### Small real acceptance run

1. Arrange two authorized live channels with test viewers actually watching.
   Both counts must be positive; allow time for the next 15-second sample.
2. Run the read-only verifier, then start dodge and verify the live checklist.
3. Calibrate both physical markers. Add `/overlay/a` and `/overlay/b` as 960×540
   OBS Browser Sources above their matching camera crops/mirror settings.
4. Start the match once. One test viewer in each chat sends an ordinary message
   every few seconds. Check A-chat -> B arena and B-chat -> A arena, a dodge and
   a hit, tracking loss/pause/recovery, and automatic settlement. Show the actual
   Twitch chat and delivered stream, allowing for broadcast delay.
5. In OBS, Start Streaming publishes to Twitch; Start Recording saves a file.
   No program command here starts broadcasting on the operator's behalf.

This is a same-computer acceptance procedure. Separate streamer computers need
authenticated shared transport; do not publish/tunnel this loopback controller.
Specific VTuber-position adapters remain unimplemented. A future remote/VTuber
delivery must add and verify those pieces before advertising them as working.

Rehearse with real channels before filming/submission. Browser and mocked tests
do not establish live Twitch or physical OBS acceptance.

References checked 2026-10-31:
[EventSub types and permissions](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/),
[Get Streams viewer_count](https://dev.twitch.tv/docs/api/reference/#get-streams),
[OBS Browser Source](https://obsproject.com/kb/browser-source).
