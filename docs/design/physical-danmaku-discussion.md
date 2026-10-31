# Physical / VTuber danmaku — design discussion

2026-10-31. Historical discussion before implementation: automatic tracked-marker
hits were confirmed, and numerical rules were still open. This superseded the
earlier visualization-only assumption for the new mode.

Follow-up: user authorized implementation. These notes preserve the design
discussion; implemented first-pass defaults and evidence now live in the
[dodge runbook](../dodge-runbook.md) and [handoff](../HANDOFF.md).

## What the user described

- OBS presentation with equally sized, bounded play areas for both streamers.
- Real streamers move physically to dodge attacks directed toward a body point.
- VTubers move their avatars inside an equivalent arena.
- Incoming danmaku consists of chat messages and optional paid-support/gift events.
- Restrict message appearance/length and geometry equally for both sides.
- Sustained excess activity over roughly 5–10 seconds can overwhelm the opponent.
- Automatic hits using a tracked marker, rather than human judging, was selected.
- Audience normalization confirmed: divide by the number of viewers watching
  each stream (interpreting the user's "streamers watching" as viewers), not
  follower counts, chat-connected users, or only players who joined the game.

At discussion time the prototype only animated charges/volleys and allegiance.
Camera tracking, collision/health and a physical arena required new gameplay,
not merely Arena HUD CSS; these now exist in the local dodge mode. A specific
avatar-position adapter remains pending. Legacy OBS routes cannot silently
become native-room views. The proposals below preserve the original reasoning;
the current implemented defaults are in the runbook linked above.

## Proposed foundation (agent recommendations, not agreed constants)

Use an equal logical arena, such as 960 × 540 units, rendered/cropped identically
in both OBS scenes. Use the same visible circular hitbox radius. Calibrate the
IRL marker (proposed chest/shoulder midpoint) and movement range into the arena.
VTuber mode supplies its avatar's actual in-arena position through an adapter;
equal avatar pixel height alone is not equivalent collision geometry or reach.
Which VTuber software/input source is used is still unknown. Start with an IRL
tracking feasibility prototype before claiming compatibility with avatar tools.

Keep camera processing local. A local tracking page can produce normalized,
timestamped marker coordinates for authoritative projectile/hit simulation and
OBS output. A browser source over a camera image does not automatically grant
access to that camera's pixels or avatar state. Shared camera access, permission,
mirroring/crop/coordinate transforms, performance and tracking loss need explicit
validation. On lost tracking, propose pausing the match instead of allowing an
invisible invulnerable marker. Do not aim using delayed Twitch video frames.

Propose fixed-size message capsules: consistent font, maximum grapheme count,
pixel-width limit, height, speed and lifetime; fit/ellipsize CJK, emoji and Latin
text to the same visual envelope. Gift icons remain within that envelope.
Give the same capsule a visible, fixed collision footprint on either side.
Moderation/deletions, accepted-event dedupe, per-viewer cooldown, a bounded queue
and a maximum active projectile count are needed before using ordinary chat as
projectiles. The current chat connector discards the input except for commands;
it does not implement this new event normalization or moderation behavior.

Aim an announced trajectory at a marker-position snapshot, rather than having
projectiles chase the player continuously. Propose a warning/travel interval so
players have a chance to react. Actual spawn/speed/reaction budgets need testing,
including fast crossing collisions, network delay and framerate differences.
Automatic hit consequences (health, invulnerability interval, finish conditions)
remain to be decided; current volley counts cannot be labelled dodge-game results.

## Pressure and defection

Propose a rolling comparison over an 8-second window within the requested 5–10
second range, using accepted activity after cooldown/moderation rules. A sustained
lead fills a visible pressure meter, then triggers a short denser barrage. Keep
the same hard projectile/geometry limits and warning rules for both sides; pressure
affects the admitted pattern/rate, not arbitrary message width or infinite backlog.
Overwhelming patterns and an unavoidable finisher are different mechanics; neither
outcome should be asserted until the win condition is chosen.

The user selected **audience-normalized pressure**. Proposed calculation:
`accepted attack units in the comparison window / smoothed concurrent viewers`.
For example, 100 accepted units from 1,000 viewers and 10 from 100 viewers yield
the same pressure in the same window. Gift weights and pressure thresholds remain
unresolved. Free ordinary chat remains an entry path; paid events are optional.

Use server-fetched Twitch `Get Streams` `viewer_count`, sampled for both channels
with the same freshness policy. It is a sampled aggregate, not an exact live
attendance ledger. Proposed robustness: smooth counts, freeze the denominator
within each comparison bucket, define a minimum denominator for tiny audiences,
and suspend pressure escalation on stale/missing/offline counts instead of
treating them as zero or silently substituting chatters. Keep synthetic counts
explicitly labelled in local rehearsal. Exact smoothing/sample/floor values must
be tested and chosen before implementation.

For defection, propose normalizing an accepted event by its verified source
stream's audience before routing its contribution to the viewer's current
allegiance. Defection alone therefore does not change that event's denominator.
Posting in another source chat can change weighting; this is not a complete
anti-manipulation guarantee. Team pressure can sum those normalized
contributions. This source-attribution detail is an agent recommendation; the
user confirmed audience normalization, not this precise allocation formula.

If preserving defection, new attacks follow the viewer's new allegiance, including
when they stay in their original channel. Propose retaining cooldown and one
switch per round. Already launched projectiles keep their original target so a
switch does not retroactively erase an attack. Anonymous gifts cannot reliably
inherit a particular player's allegiance; define a separate routing rule or omit
them from allegiance-dependent input. These extensions require agreement/tests.

## Verified platform references

- [OBS Browser Source](https://obsproject.com/kb/browser-source) supports a URL,
  explicit source dimensions and transparent browser rendering; this supports
  the proposed output surface, not verified camera access or collision tracking.
- [MediaPipe Web Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
  can produce body landmarks from video, including normalized coordinates. It is
  a candidate to evaluate, not an installed/tested dependency. Its synchronous
  inference calls need performance consideration (e.g. worker isolation).
- [Twitch EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/):
  `channel.chat.message`, `channel.cheer` (`bits:read`), and
  `channel.subscription.gift` (`channel:read:subscriptions`) provide candidate
  inputs. "Super Chat" is not the Twitch event identifier. Both broadcasters'
  account authorization and duplicate paid/chat representations need planning;
  the current single chat-user token is not proof those permissions are present.
- [Twitch Get Streams](https://dev.twitch.tv/docs/api/reference/#get-streams)
  returns `viewer_count` for live streams, accepts app or user access tokens, and
  can filter by both broadcaster IDs. Offline channels are absent from the
  results. Read on 2026-10-31; no live viewer-count lookup was performed here.

## Next design decision

The original next step was to settle rules and build a prototype. That local
slice is now implemented; use the current handoff for live/physical/remote and
VTuber follow-ups. Preserve native/legacy behavior while extending the new mode.
