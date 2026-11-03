# Ideas, decisions and open work

Consolidated 2026-10-31 from this chat, the reviewed Google ideation tab and
the linked repository records. This covers the ideas available to this session;
it is not a verbatim archive or a claim about unseen teammate discussions.
The external source review dates are in [source notes](../records/sources-2026-10-31.md).

**Confirmed** means a user choice; **implemented default** means an engineering
choice that can be tuned. **Candidate** is not an approved task. **Pending
acceptance** means code exists but platform/hardware behavior has not been proved.
Latest explicit user instructions supersede earlier choices; source/tests govern
what actually works. Use [agent map](AGENT_MAP.md) to find the relevant code.

## Product and gameplay

Confirmed video scope, 2026-11-03: after initially choosing a second test account,
the user declined creating one, confirmed continuing with `hongshan333`, then
explicitly requested AI for the second side. Implemented `DODGE_MODE=ai-demo`
alongside default `duel`: one real Twitch channel and a labelled local game AI,
not a fake second stream or viewer count. Embedded camera A reduces window
switching. Local steering/attack cadence is a game-AI implementation, not an LLM
service or external avatar adapter. User may appear on camera; one operator
must be identified truthfully. Producing a video is authorized; broadcasting,
uploading or submitting still needs the relevant operator action/authorization.

Implementation authorization (2026-11-02): user explicitly asked to build the
web/chat/OBS route, update progress.md and push to GitHub. Implemented local live
readiness, diagnostic tooling and camera-first operator UI; no credentials,
broadcast, deployment, native-mode replacement or remote exposure was performed.
Topology/VTuber questions were sent to the user; no answer assumed. Local live
acceptance still needs private channel setup and physical OBS verification.

Current working route (2026-11-02): user responds to the unreviewed-Extension
judge restriction by preferring the web controller and requests a consolidated
direction/task sequence. Gameplay stays real chat -> opposing horizontal shots ->
physical/avatar dodging -> automatic collision/health/result -> OBS/Twitch output.
No manual scoring or mouse-character play is implied by the web entry point.
Native Extension is preserved as an alternative; its integration is no longer
the immediate proposal. Final delivery topology (same-machine acceptance versus
required remote play), avatar software and judge setup remain open. Suggested
physical-first acceptance is not a user-approved cancellation of avatar support.
No runtime redesign/deployment/broadcast is authorized by the planning question.

Earlier preference, superseded for the immediate route (2026-11-02): use a native Twitch Extension for streamer
buttons and automatic start/scoring/settlement, retaining physical/virtual-avatar
dodging and avoiding a separate controller in normal use. This supersedes the
earlier suggestion to retain a standalone operator page as the target UX. Existing
native invitation/ready/auth components can be reused, but their community-volley
engine is separate from dodge health/collision. Integration must explicitly
preserve native PK and add dodge support rather than treating both states as one.
Local tracking/avatar adapters and authenticated remote transport remain needed.
This is a product direction, not a claim of implemented integration or permission
to publish/deploy. Hosted Test and public review/judge access are separate gates.

Scope reconfirmed (2026-11-02): after questioning the chatbot-to-dodge transition,
the user explicitly retains physical/virtual-avatar dodging and asks for the
real-Twitch integration approach and controller necessity. Prioritize explaining
and validating chat input, tracked coordinates, collision and OBS output. Existing
chat wiring and physical colour-marker prototype are implemented; actual live/
hardware acceptance, specific avatar-position adapters and remote transport remain
open. Browser start/pause controls are a current implementation choice, not a
Twitch requirement. A smaller streamer setup/control page is a recommendation,
not implemented or approved as a redesign; no chat start/pause command is wired.
Mouse/keyboard input remains a local tracking substitute. The user's request
for an approach does not authorize broadcasting, deployment or credential changes.

Latest user correction: audience support should create collective pressure;
OBS danmaku should scroll horizontally like Bilibili without targeting the marker.
The user clarified that this is the dodge game itself (two equal arenas with
health/survival deciding PK), not an overlay layer for arbitrary activity. This
supersedes earlier aimed-trajectory defaults. Free chat is the core participation
path, optional Cheer/gift input is capped by existing rules, and quiet chats stay
quiet rather than receiving fabricated neutral hazards. These choices are now
implemented in the separate dodge mode; competitive tuning and live acceptance
remain open. See the [design discussion](design/physical-danmaku-discussion.md)
and [runbook](dodge-runbook.md).

| Idea / decision | Status and consequence | Detail / provenance |
| --- | --- | --- |
| Cross-channel audience interference | Core idea; implemented in native PK and local dodge using different rules | [Product](PRODUCT.md), [original ideation summary](../records/sources-2026-10-31.md) |
| Streamers choose their activity | Retained for native PK; physical-danmaku mode is the selected dodge game arena, not an arbitrary-activity overlay | [AGENTS.md](../AGENTS.md), product |
| Dodge PK format | Confirmed as A: both streamers dodge in equal arenas; opposing-community messages are horizontal bullets; remaining health settles the winner | [Product](PRODUCT.md), [dodge runbook](dodge-runbook.md) |
| Free participation | Retained; ordinary chat is eligible. Paid support is optional, never required | [Dodge runbook](dodge-runbook.md) |
| No third host in native PK | Implemented: A invites B, B accepts, both ready, automatic start/result | Product and [contract](API_CONTRACT.md) |
| One viewer identity/allegiance across channels | Backend-owned; one cooldown and one defection allowance per match. Cooldown values differ between modes | Contract and runbook |
| Show existing attack/defection mechanics first | Earlier confirmed presentation scope; later expanded to playable physical dodging | [Presentation spec](superpowers/specs/2026-10-31-pk-danmaku-design.md), [discussion](design/physical-danmaku-discussion.md) |
| Equal arenas and body-point dodging via OBS | Confirmed; local 960×540 arenas implemented. Physical alignment and remote two-machine play pending | Runbook and [dodge plan](superpowers/plans/2026-10-31-dodge-mode.md) |
| VTuber avatars move to dodge with equivalent geometry | Confirmed direction; specific avatar software/control adapter unknown and not implemented | Physical discussion, runbook |
| Automatic tracked-marker hits | Explicit user selection; local colour-marker tracking/collisions implemented. Markers determine hits, not message aim. Full body-pose recognition is not implemented | Discussion, runbook |
| Danmaku made from chat, gifts and paid messages | Chat + optional Twitch Cheer/gift ingestion implemented; real grants/events pending acceptance. “Super Chat” describes the idea, not a Twitch event name | Contract, runbook, source notes |
| Equal bounded projectile appearance and length | Confirmed; fixed hit geometry, clipped text and capped load implemented | Runbook; geometry source via agent map |
| Sustained 5–10-second lead can overwhelm opponent | Confirmed direction; first-pass five-second lead/eight-second bucket/six-second barrage implemented. Competitive balance unverified | Runbook |
| Normalize by viewers watching each stream | Explicit user choice: concurrent `viewer_count`, not followers/chatters/joined players. Real sampling pending private setup | Runbook, source notes |
| Source denominator, smoothing/floor/freshness and weights | Implemented engineering defaults, not individual user-approved constants. No unqualified claim that these eliminate manipulation | Runbook; test/source routes in agent map |
| Health, invulnerability, warning, speed and rate caps | Implemented engineering defaults; existing native community scoring was preserved | Runbook and contract |
| Defection changes future target without resetting cooldown | Retained; already launched shots keep their target, anonymous gifts stay source-side | Runbook and contract |
| Native PK, sandbox, legacy debug and dodge isolation | Required implementation boundary; never silently use another mode's state or score | [Architecture](ARCHITECTURE.md), agent map |

## Design and interaction

| Idea / decision | State | Detail |
| --- | --- | --- |
| TikTok PK inspiration with Twitch-compatible interaction | Requested reference: score/timer/team hierarchy, clear attacks and allegiance. Use Crossfire's identity, not copied branding/assets | [Presentation spec](superpowers/specs/2026-10-31-pk-danmaku-design.md) |
| Arena HUD versus Chat-led | **Arena HUD selected** through concept carousel. Chat-led remains an alternative, not a second chosen design | [Concept](design/crossfire-pk-directions.html) and spec |
| Integrate Arena HUD in native Extension | Selected presentation direction, still pending native integration; new dodge controller borrows the hierarchy but does not prove native redesign complete | Spec, [status](STATUS.md) |
| UI-TARS as a design skill | Repository reviewed: GUI automation, not a ready Twitch design skill; no UI-TARS runtime installed | Source notes |
| First-party Twitch design reference | Official Extension guidance reviewed; no public first-party Twitch Codex skill found in that review | Source notes; recheck if adopting new guidance |
| Accessibility and restrained motion | Retained design guidance: labels/arrows as well as colour, keyboard focus, text safety, video-safe placement, reduced motion | Spec, AGENTS.md |
| Local camera privacy and honest status | Frames stay in browser; only coordinates sent. Lost tracking pauses; synthetic/live source must be visible | Runbook and contract |

## Alternatives kept for future evaluation

The Google brainstorm also mentioned **opponent-only voting, a cooperative
second half, creative-activity variants, music/AI summaries, and accessibility
extensions**. These remain candidates, not features delivered by the current
build. Bullet-hell/physical dodging moved from candidate to user-authorized local
implementation in this chat. Arbitrary external-game control, AI challenge
generation, token refresh, durable recovery and automatic art judging are not
implemented. See source notes and [tasks](TASKS.md); do not quietly add candidates
to a current task. Brainstorm claims of market novelty remain unverified.

## Collaboration, records and delivery

| Requirement / decision | Current rule and source |
| --- | --- |
| Standard engineering workflow | [AGENTS.md](../AGENTS.md): inspect branch/status, scoped work, focused tests, final checks, contract update and handoff. Use one task owner; coordinate shared files |
| Parallel collaboration | [Tasks](TASKS.md): lanes and file ownership; separate branches/worktrees for concurrent humans. No automatic agent spawning or fabricated teammate assignments |
| Reusable agent knowledge | [Agent map](AGENT_MAP.md) routes task → source → tests; navigation skill gives selective-reading/freshness rules; map must be updated with affected boundaries |
| Codex usage and other tools | Official FAQ rechecked 2026-10-31: project must be built with Codex; other AI/design/development tools are allowed. Show actual Codex contribution and submit the main session ID; no exclusivity requirement | [Official FAQ](https://twitchcon-codex.devpost.com/resources), [readiness](hackathon-readiness.md) |
| Save records in repository and Google Doc | Explicit user selection. [Records skill](../.agents/skills/chatcrossfire-records/SKILL.md) and [index](../records/README.md) define identity/provenance, naming and safe mirroring. Latest Google mirror pending connector access |
| Main development session identity | Current ID is observed; representative still confirms the main submission session separately from the peer's unidentified original coding session | Records index and current record |
| Secrets | Store privately; no secrets in chat/records/Git/ZIPs. App credentials differ from user/Extension credentials. Earlier reported exposure still needs owner revocation confirmation | [Configuration](configuration-guide.md), AGENTS.md |
| Twitch installation | Local rehearsal needs a browser/Node, not the Twitch desktop app. Actual input needs OAuth/channel setup; OBS is needed to verify broadcast composition | Configuration and runbook |
| Hackathon integration | Earlier official review found actual Twitch connection required; native Extension optional. Simulated-only footage is not live Twitch acceptance | Source notes and product; reverify live rules before submission |
| Extension publication and next milestone | User accepted the clarification on 2026-10-31: Extension publication is optional. Next evidence run uses actual Twitch chat/EventSub/API → app → OBS; native PK remains an optional route | [Readiness](hackathon-readiness.md), [official FAQ](https://twitchcon-codex.devpost.com/resources) |
| Judge access | Unreviewed Extension installation restriction was found in earlier FAQ review. Final delivery route and durable access remain unresolved | Product, tasks, source notes |
| Publish/merge/deploy | Prototype/initial records published through `b5c81e1`; knowledge map/skill/setup docs published as `9950029`, all on the feature branch. Master unchanged. No PR merge/deployment/submission authorized by a design/plan alone | Handoff and record; check current Git state |

## Open acceptance work

Actual two-channel Twitch chat/counts/support; physical marker/camera sharing and
OBS crop/mirror alignment; remote authenticated streamer transport; a named VTuber
adapter; competitive tuning; final judge-access/delivery decision; Google record
mirror; exposed-secret revocation confirmation; peer/main session provenance.
Each is explicit pending work, not hidden behind passing synthetic tests.
