# Existing module and wire contracts

This documents the current implemented interface; the horizontal dodge update
changes trajectory behavior but adds no route or snapshot field. Contract changes
must include all producers, consumers, tests, and this document in one coordinated
review.

2026-11-02 live-setup addition: dodge snapshots now add `serverTime`, `setup`
and `inputActivity`; no route was added. The earlier no-field-change statement
refers to the horizontal-lane revision only.

## Separate local dodge mode (2026-10-31)

### One live channel versus local AI (2026-11-03)

`DODGE_MODE=ai-demo`, `DODGE_LIVE=1` selects the user-authorized recording mode;
default `DODGE_MODE=duel` preserves the two-channel rules below. The mode is an
immutable server/engine constructor option, not a client-selected role. AI demo
requires real Twitch input; selecting it with `live:false` is rejected.
The process subscribes only to `DODGE_CHANNEL_A`; channel B and support token B
are ignored. Get Streams queries only A's verified ID. B's audience stays null;
no second stream, viewer count or Twitch user is invented.

Snapshots add `mode:'duel'|'ai-demo'`. In AI demo, `inputSource:'twitch'` describes
the primary viewer input; B is explicitly a local game-AI actor. Start/Resume
require A's real subscribed chat, a fresh A viewer sample from a confirmed live stream and fresh
physical marker A. `marker` writes for B return 400 because the server controls
that actor. `tracking.b:true` means AI availability, not physical tracking.
Synthetic audience/activity HTTP endpoints remain 404; Host/Origin/loopback
protections and native PK are unchanged. Snapshot `inputActivity.b` stays zero:
AI is not passed off as Twitch traffic. Real chat still comes only from the bridge.
In this single-presenter AI mode an actual live-stream sample of zero viewers is
valid; a missing/offline sample is still null and blocks Start. The normalizer's
existing floor of 20 still applies. AI audience A additionally includes `raw` for
the actual sample; `value` retains smoothing for normalization, while the UI
displays `raw`, including zero. B is always null even if an internal caller supplies
a value. Default duel still rejects zero viewer samples on either side.

The AI uses bounded vertical avoidance (350ms decisions, 120 arena units/second)
and adds one labelled `kind:'ai'` queued attack every 2.5 seconds, starting at
2 seconds of gameplay. Both new AI attacks and real admission wait for fresh A
audience data. No AI activity is registered as a viewer identity. Existing
collision, health, tracking-loss pause, timers and result shape apply to both
actors. Barrage comparison is disabled in this mode. A real Twitch viewer may
still defect once in the existing middle window, retaining identity/cooldown
and the real A source denominator; subsequent messages can back the AI side.

The controller labels the mode/opponent, omits a second channel/count requirement
and embeds `/track/a?embedded=1` for local calibration. Both overlays label actors:
A is transparent over a real camera, B draws an opaque local-AI arena and robot.
The embedded tracker is the same local detector, with compact presentation;
camera permission/calibration is still explicit, and hidden-page pause remains.
In AI demo the controller also paints the enabled iframe's actual camera video
behind arena A, using the same centred 16:9 crop and mirror as detection. Frames
stay in the browser; no new frame-upload route is introduced. Overlay A remains
transparent. Window Capture of the controller includes the real camera picture.
Producers: `danmaku.mjs`, `dodge-http.mjs`, `dodge-setup.mjs` and launchers;
consumers: controller/tracker/overlays, doctor/verifier; coverage: `dodge-ai.test.mjs`
and the AI case in `dodge-ui.test.mjs` plus existing duel regressions.

### Default duel and rehearsal contracts

`npm run dodge` starts `startDodgeServer` on 127.0.0.1:3020, independently of
`createApp` and all PK registries. Its `DanmakuEngine` owns marker, collision,
health, timer, allegiance and pressure state. Clock/random/config injections
support deterministic tests. This mode has no remote user authentication and
must remain loopback-only. Exact local Host and same-origin JSON writes are
required; Forwarded/X-Forwarded headers are rejected. Bodies are limited to 8 KB.

| Route | Method | Body / response |
| --- | --- | --- |
| `/`, `/track/a`, `/track/b`, `/overlay/a`, `/overlay/b` | GET | Controller, local colour tracker, transparent 960×540 OBS views |
| `/api/dodge/state` | GET | Detached snapshot, polled by the browser; no tokens or frames |
| `/api/dodge/marker` | POST | `{side:'a'|'b',x,y}` finite arena coordinates; server timestamp and clamp |
| `/api/dodge/action` | POST | `{action:'start'|'pause'|'resume'|'reset',durationSeconds?}`; optional duration 60/180/300 only before start |
| `/api/dodge/audience` | POST | Synthetic only: `{a,b}` nonnegative integers; unavailable in live mode |
| `/api/dodge/activity` | POST | Synthetic only: `{id,userId,channelTeam,text,kind?,units?}`; unavailable in live mode |

Successful mutations return the snapshot, except activity returns
`{ok,team,normalized?,switched?,state}`. Rule-rejected activity returns 409 with
`{ok:false,reason,state}`; invalid requests 400/413/415; boundary violations 403;
unknown routes and synthetic routes in live mode 404. Reset creates a new match ID.
In live mode, `start` and `resume` additionally require both verified chat
subscriptions, fresh positive audience samples and both fresh markers. A failed
readiness check returns 409 `{error,state}` without changing phase/duration.
Rehearsal start rules remain unchanged. During an already running match, missing
audience data continues to suspend new admission rather than changing in-flight
collision rules. The existing tracking-loss pause still applies.

`serverTime` is the server wall clock in milliseconds (the engine's injected
clock in tests). `setup` is `{ready,chats,audience,markers,blockers:string[]}`;
it reports input readiness, not proof of physical OBS alignment, avatar support
or successful broadcast. `inputActivity` contains sides `a,b`, each with
`{received,accepted,rejected,lastAt,lastReason}`. Counts refer to deduplicated
chat events handed from TwitchBridge to dodge, excluding Cheers handled by an
optional support subscription. `lastAt` is a server wall-clock timestamp or null.
Only a fixed rule rejection reason is retained: no viewer ID, message body or
token is added. Acceptance does not guarantee a bullet (normalization/caps still
apply). Reset zeroes these match-local counters. These are diagnostics, not scores.

The live controller defaults to camera input, disables keyboard selection and
does not submit rehearsal marker coordinates even if selection is manipulated.
Local marker endpoints remain trusted operator controls; no remote identity or
physical camera attestation is introduced. Native PK contracts are unchanged.

Controller follow-up: **Start rehearsal** is synthetic-only and sends existing
marker calls for both sides followed by a 60-second start action; it starts local
test messages. Focus controls change preview layout only. The practice figure is
controller-only; OBS stays transparent. No new endpoint or snapshot schema was
added. Start/Resume wait for fresh markers; disconnected and paused play controls
are disabled in the UI, while the backend still enforces all game rules.

Snapshot fields: `id,phase,reason,config,elapsedMs,remainingMs,health,markers,
tracking,invulnerable,pressure,switchOpen,pending,shots,bullets,events,result,
inputSource,twitch,support`. Phases are lobby/running/paused/finished. Result is
`{winner:'a'|'b'|'tie',health:{a,b}}`. A marker is `{x,y,at}` (wall-clock `at`).
Bullets have `id,from,target,text,kind,x,y,vx,vy,armsAt,expiresAt`; times are elapsed
game milliseconds. Dodge bullets move left-to-right at fixed horizontal speed
through cycling lanes in the target arena; marker coordinates affect collision
only, never trajectory. Both source chats use the same direction and geometry.
State events have `id,type,at,...`, elapsed `at`, last 30 only.
IDs are local to the match. Browsers render current bullets; they do not replay
the event feed to reconstruct authoritative physics. `pressure` includes enabled,
current/previous normalized units, barrage, audience sample timestamps, frozen
denominators, source and bucket/barrage remaining durations.

Input source is immutable per process: synthetic or Twitch. In live mode only
validated EventSub bridge events create activity identities/teams. Marker and
round controls remain trusted local operator actions. Audience lookup uses both
verified channel IDs in one Get Streams request. See [runbook](dodge-runbook.md)
for rules, scopes, tracking limitations and conservative moderation behavior.

`TwitchBridge` adds optional `supportOnly` and `moderationEvents` constructor
options, both false by default. Normal chat events additionally expose `id` and
`isCheer`; existing PK consumers ignore these fields. Support-only sessions
verify broadcaster ownership, subscribe only to scopes actually granted, and
emit `activity` with `{id,userId,channelTeam,kind,units,text}`. Anonymous userId
is null. Chat moderation emits `moderation`; this mode clears all displayed and
queued text. Existing native/legacy subscription defaults are unchanged.

## Internal boundaries

- `new MatchEngine({ now = Date.now, config = {}, mode = 'demo' })`.
  `mode` is `demo | live`; native rooms use `live` with `scoringMode: 'community'`.
  `command({ userId, name, channelTeam, text })` returns an outcome object or throws
  `RuleError` with `.code`. `snapshot()` returns detached JSON-safe state.
  Mutators include `start()`, `pause()`, `resume()`, `finish()`, `tick()`.
- `new TwitchBridge({ token, fetchImpl, WebSocketImpl, retryBaseMs })` is an
  `EventEmitter`. `start({ a: login, b: login })` is async; `stop(report = true)`
  closes sockets/timers. Events: `chat`, `status`, `reply_error`.
  `reply(channelId, message)` is async and rate-limited. Check `.status`, rather
  than treating a resolved `start()` promise as proof of successful connection.
- A normalized `chat` event is
  `{ userId, name, channelTeam: 'a'|'b', text, channelId }` (string identifiers).
  `TwitchBridge` filters unknown channels, duplicate delivery, and forwarded Shared
  Chat copies before emitting. `PkRooms` also checks channel ID matches its side.
- A channel directory implements async `resolve({ id? , login? })` returning
  `{ id, login, name }`. Production uses `TwitchDirectory`; sandbox has an explicit
  two-channel directory. Match identity uses IDs; logins are lookup/display input.
- `new PkRooms({ directory, now, countdownMs, invitationMs, mode, inputSource,
  bridgeFactory, onEvents, maxRooms })`. `invite(identity, input)` is async;
  `action(identity, input)`, `play(identity, input)`, `state(identity)`, `tick()`,
  `close()` are synchronous. `bridgeFactory(room)` returns a bridge or is null.
  `onEvents(sourceId, entries)` receives newly logged engine events only.
- `ExtensionAuth.verify(token)` returns a frozen identity:
  `{ channelId, userId: string|null, opaqueUserId, role, broadcaster: boolean }`.
  The HTTP boundary supplies this identity; browsers cannot post their own one.

## Native HTTP

Requests to `/api/extension/*` use `Authorization: Bearer <Helper JWT>`;
`X-Extension-JWT` is also accepted. POST bodies are JSON objects, max 16 KiB.
Allowed Extension origins get CORS preflight; arbitrary origins and unexpected
Host headers are rejected. JSON responses use `Cache-Control: no-store`.

| Method/path | Body | Result |
| --- | --- | --- |
| `GET /api/health` | None; public | `{ service: 'chatcrossfire', ok, extensionConfigured, sandboxEnabled }` |
| `GET /api/extension/state` | None | Full channel/viewer-specific state |
| `POST /api/extension/invite` | `{ targetLogin, title?, durationSeconds? }` | Full state; broadcaster only |
| `POST /api/extension/action` | `{ roomId, action }` | Full state; broadcaster only |
| `POST /api/extension/play` | `{ roomId, command }` | Full state; linked identity required |
| `POST /api/sandbox/session` | `{ persona }` | `{ token, identity, inputSource, backendOrigin }`; sandbox loopback only |

Broadcaster actions: `accept`, `decline`, `ready`, `unready`, `pause`, `resume`,
`leave`. Only side B can accept/decline. Room access requires the caller's channel
to be currently mapped to that room. Viewer commands: `!join`, `!attack`,
`!switch`. `!help` is handled in chat, not by the native play endpoint.
Sandbox personas: `streamer-a`, `streamer-b`, `viewer-a`, `viewer-b`.
Sandbox sessions expire in one hour; forwarded requests cannot mint/use them.

### State envelope

```js
{
  identity: { channelId, userId, opaqueUserId, role, broadcaster },
  roomSide: 'a' | 'b' | null,
  inputSource: 'twitch-extension' | 'local-simulation',
  viewer: { joined, team, switched, attackReadyInMs },
  liveChat: { state, message, channels /* may also include login */ },
  room: null | {
    id, revision, lifecycle,
    channels: { a: { id, login, name }, b: { id, login, name } },
    inviterChannelId, ready: { a, b },
    countdownRemainingMs, invitationRemainingMs, cancellationReason,
    engine: /* MatchEngine.snapshot() */ {}
  }
}
```

Room lifecycle: `invited -> lobby -> countdown -> running -> finished`.
`unready` returns countdown/lobby to lobby; running can pause/resume; decline,
expiry, or leaving a nonterminal match produce `cancelled`.
Engine phase is independently `lobby | running | paused | finished`; it has no
`invited` or `countdown` phase. Do not rename one to match the other.

The snapshot includes `id`, `revision`, `mode`, `phase`, `scoreLabel`, `config`,
`serverTime`, `elapsedMs`, `remainingMs`, `windowUsed`, `defectionRemainingMs`,
`teams`, `participants`, `leaders`, `events`, `result`.
Each team has `score`, `energy`, `attacks`, `volleys`, `nextVolleyAt`,
`activeChallenge`, `queuedChallenge`, `switchedIn`, `switchedOut`, `members`.
An active challenge has `{ id, text, from, endsAt }`; `endsAt` is elapsed game
time, not a wall-clock timestamp. Countdown/remaining fields are durations in ms.
Result is null or `{ winner: 'a'|'b'|'tie', scores: { a, b }, provisional }`;
native automatic settlement sets `provisional: false`.

`room.revision` combines the room and engine revision. Timers can change without
a revision increment. Use snapshots for current timers, not revision alone.
On refresh, render the snapshot and initialize event cursors to its latest ID;
do not replay every historical attack as a new effect.

### Events and errors

Engine events are `{ id, type, at, ...typeSpecificFields }`; `id` is a monotonic
sequence within an engine match, and `at` is wall-clock milliseconds. The engine
keeps 100 events; snapshots expose the latest 30. This is a bounded UI feed, not
a durable replay protocol. Dedupe effects by match ID and event ID.

Gameplay types: `joined`, `attack` (one charge), `volley` (released challenge),
`community_score`, `defected`, `window_open`, `window_closed`, `started`, `paused`,
`resumed`, `finished`, `challenge_complete`. Legacy/configuration types include
`reset`, `configured`, `score`, `confirmed`, `challenge_cancelled`.
Attack/volley carry `team` and `target`; defection carries `name`, `from`, `to`,
`team`; UI must escape all displayed names, challenge strings, and `text`.

Errors are `{ error, code? }`: ordinary rule validation defaults to 400, invalid
JWTs 401, role/channel/CORS/Host denial 403, channel reservation conflict 409,
missing Extension setup/service capacity 503. Upstream lookup/network failures
can be 502. Check actual codes; not every validation failure has a distinct one.
Never include bearer tokens or shared secrets in errors.

## Legacy boundary

`GET /api/state` and SSE `GET /api/events` return the top-level legacy snapshot
with an added `twitch` status. SSE uses named `state` events. Mutation uses the
debug host session obtained through `/api/session`. Public default configuration
returns 404 for these developer APIs. These endpoints do not expose native rooms;
do not use them as the Extension's transport or an OBS view of native PK.

## Existing contract tests

`test/engine.test.mjs`, `test/twitch.test.mjs`, `test/pk-rooms.test.mjs`,
`test/extension-auth.test.mjs`, `test/extension-http.test.mjs`, and
`test/extension-integrated-ui.test.mjs` exercise these boundaries. Identities and
Twitch transports in these suites are synthetic.
