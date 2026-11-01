# ChatCrossfire product baseline

Recorded 2026-10-31 (Asia/Singapore) from the cloned code, README, progress notes,
and the [earlier discussion](https://chatgpt.com/c/6ae4ba2a-0b2c-83ec-8337-4f9699f33359).
This captures the existing product direction and proposed release scope; it does
not imply that live Twitch acceptance has passed.

## Intended experience

Current working delivery route (2026-11-02): after considering native Extension
controls and judge-installation constraints, the user prefers returning to the
web controller and asks to consolidate scope. Retain physical/virtual-avatar
dodging, real Twitch chat and OBS presentation. The web page is the streamer
setup/control surface; viewers participate in Twitch chat. Backend collisions,
health, timing and settlement remain automatic. Controller use does not imply
manual scoring or mouse-controlled characters as the normal experience.

The immediate proposed sequence is real two-channel chat admission, physical
marker/OBS alignment, then capture of the actual Twitch interaction. The existing
local prototype can establish these on one computer; it cannot establish remote
two-computer play. Whether remote play is required for this delivery and which
avatar software to integrate remain unresolved. Starting with physical tracking
before a software-specific avatar adapter is a recommendation, not a confirmed
cut. Web invitation/ready automation is not inherited from native PK automatically.
Native Extension code remains preserved; its integration is deferred as a current
route preference, with final judge access still to be resolved. No deployment,
broadcast or credential change is authorized by that discussion. The subsequent
user instruction authorizes implementation and push: local live-readiness checks,
diagnostic tools and camera-first setup UI are now implemented. Actual Twitch/
hardware acceptance and authenticated remote/avatar integration remain open.

The selected physical-danmaku mode is PK game A: each streamer plays the same
dodge game in an equal arena, opponent-community messages cross that arena as
horizontal bullets, and remaining health determines the result. It is not a
transparent message layer placed over a streamer-selected external activity.
The native Extension's broader activity-agnostic PK remains a separate mode.

The confirmed direction is Bilibili-style horizontal messages without
marker-directed aiming. Free chat is the core input; optional paid support uses
the existing capped event weights. Quiet chats do not receive invented neutral
hazards. Competitive balance still needs live playtesting. See [design notes](design/physical-danmaku-discussion.md).

Submission-route clarification confirmed with the user on 2026-10-31:
**publishing a native Twitch Extension is optional**. Next acceptance work is
real Twitch chat/EventSub/API input driving the OBS dodge experience, then
recording working Twitch interaction and Codex development. Existing native PK
remains available as a separate optional route; it is not being removed or
declared reviewed. See [hackathon readiness](hackathon-readiness.md).

Latest design discussion (2026-10-31): the user now proposes an **OBS physical /
VTuber dodge mode** with equal arenas, message/gift danmaku, and automatic
tracked-marker collisions. This supersedes the earlier visualization-only scope
for that proposed mode. See [discussion notes](design/physical-danmaku-discussion.md)
for confirmed intent versus recommendations/open fairness and scoring decisions.
Audience normalization is now selected: use concurrent viewers watching each
stream, rather than raw activity totals or only joined players. Exact pressure
parameters and hit-scoring rules are now implemented as configurable first-pass
defaults in a separate [local dodge prototype](dodge-runbook.md). The user
authorized implementation after this discussion. It includes colour-marker
tracking, health/collisions, normalized shot admission and bounded barrages;
real Twitch, physical OBS and remote VTuber acceptance remain pending.
The rules and native flow below describe the current implementation, not an
already implemented version of the new dodge gameplay.

**Your chat. Their problem.** Two streamers choose an activity and invite their
communities into an opposing-team battle. Viewers join, charge challenges against
the other streamer, and can defect once during a timed window. Participation is
free. The streamers perform the agreed challenges themselves.

The latest repository direction supersedes the earlier host-operated demo:
native Twitch Extension controls support invite -> accept -> both ready ->
automatic countdown -> play -> halftime defection -> automatic result.
Either streamer can pause/resume or leave. No third host is needed.

## Rules already implemented

| Rule | Native PK behavior |
| --- | --- |
| Identity | Shared Twitch numeric user ID across both channels and button/chat input |
| Allegiance | First `!join` chooses the channel's side; visiting the other channel does not switch it |
| Attack | `!attack` adds one charge; 3 charges release a volley toward the other team |
| Limits | 10-second viewer cooldown, 20-second team volley cooldown |
| Challenges | 15-second duration; at most one active and one queued per target team |
| Defection | `!switch` once per player per round, only during the halftime window |
| Native timing | API accepts 30–900 seconds, defaults to 180 when omitted; current UI selects 300; countdown 5 seconds; invite expires after 90 seconds |
| Native defection window | `min(30, floor(roundSeconds / 3))` seconds |
| Pausing | Freezes round, challenges, defection, and gameplay cooldown clocks |
| Scoring | One community point per released volley; automatic final result, including ties |
| Restart | In-memory rooms are lost; page refresh can recover only while the backend still has the room |

The legacy debug mode has manual scoring and a 300-second default round. It is
useful for diagnosis but does not define native scoring or native room state.

## Native Extension acceptance (if choosing this route)

Two real Twitch channels must use one HTTPS backend and the same packaged
Extension version. Both streamers and test viewers must be allowlisted and the
Extension installed/activated. Demonstrate invitations, both ready states,
automatic start, A -> B and B -> A attacks, identity sharing, defection with changed
target, pause/resume, automatic settlement, and refresh/reconnect behavior.
Capture browser evidence at the panel viewport and overlay size; synthetic tests
alone cannot establish these results.

The release should retain the offline four-role rehearsal and reproducible tests.
English setup/testing instructions and an accurate demo must accompany delivery.

## Scope decisions and deferred ideas

Native PK remains implemented; the user subsequently authorized building the
separate physical OBS dodge mode. The local dodge slice is implemented, while
remote coordination, VTuber adapters and live/hardware acceptance remain open.
The chat/OBS route is accepted for the next evidence run; final judge access and
delivery setup remain open. Keep the
host/debug flow for diagnosis. Other speculative mechanics are candidates,
not implied requirements. See the consolidated [decision register](DECISIONS.md).

## Submission reference

The [official rules](https://twitchcon-codex.devpost.com/rules), checked 2026-10-30,
require working Twitch footage and Codex development footage in a public YouTube
video under three minutes, source/setup access, a description of Codex usage, and
the development session ID. Materials need English or an English translation.
The rules state November 2, 2026, 2 PM Pacific Time; the page header labels PST.
Use **November 2, 22:00 Asia/Singapore** as a proposed internal submission target,
comfortably before either interpretation, and confirm the official countdown
when submitting. Judge access must remain available through the judging period;
a temporary tunnel alone is not a durable delivery plan.

Follow-up review on 2026-10-31: the [official resources/FAQ](https://twitchcon-codex.devpost.com/resources)
says judges cannot install unreviewed Extensions and estimates 5–14 days for
review. Resolve judge access before selecting the final delivery route. This is
a release risk, not an instruction to abandon the native implementation.
The native Google Doc's ideation was also read directly; the redacted mapping to
implemented and optional ideas is in [source notes](../records/sources-2026-10-31.md).
