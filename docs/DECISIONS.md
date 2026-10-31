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

| Idea / decision | Status and consequence | Detail / provenance |
| --- | --- | --- |
| Cross-channel audience interference | Core idea; implemented in native PK and local dodge using different rules | [Product](PRODUCT.md), [original ideation summary](../records/sources-2026-10-31.md) |
| Streamers choose their activity | Retained; app does not control arbitrary external games or judge artwork | [AGENTS.md](../AGENTS.md), product |
| Free participation | Retained; ordinary chat is eligible. Paid support is optional, never required | [Dodge runbook](dodge-runbook.md) |
| No third host in native PK | Implemented: A invites B, B accepts, both ready, automatic start/result | Product and [contract](API_CONTRACT.md) |
| One viewer identity/allegiance across channels | Backend-owned; one cooldown and one defection allowance per match. Cooldown values differ between modes | Contract and runbook |
| Show existing attack/defection mechanics first | Earlier confirmed presentation scope; later expanded to playable physical dodging | [Presentation spec](superpowers/specs/2026-10-31-pk-danmaku-design.md), [discussion](design/physical-danmaku-discussion.md) |
| Equal arenas and body-point dodging via OBS | Confirmed; local 960×540 arenas implemented. Physical alignment and remote two-machine play pending | Runbook and [dodge plan](superpowers/plans/2026-10-31-dodge-mode.md) |
| VTuber avatars move to dodge with equivalent geometry | Confirmed direction; specific avatar software/control adapter unknown and not implemented | Physical discussion, runbook |
| Automatic tracked-marker hits | Explicit user selection; local colour-marker tracking/collisions implemented. Full body-pose recognition is not implemented | Discussion, runbook |
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
| Save records in repository and Google Doc | Explicit user selection. [Records skill](../.agents/skills/chatcrossfire-records/SKILL.md) and [index](../records/README.md) define identity/provenance, naming and safe mirroring. Latest Google mirror pending connector access |
| Main development session identity | Current ID is observed; representative still confirms the main submission session separately from the peer's unidentified original coding session | Records index and current record |
| Secrets | Store privately; no secrets in chat/records/Git/ZIPs. App credentials differ from user/Extension credentials. Earlier reported exposure still needs owner revocation confirmation | [Configuration](configuration-guide.md), AGENTS.md |
| Twitch installation | Local rehearsal needs a browser/Node, not the Twitch desktop app. Actual input needs OAuth/channel setup; OBS is needed to verify broadcast composition | Configuration and runbook |
| Hackathon integration | Earlier official review found actual Twitch connection required; native Extension optional. Simulated-only footage is not live Twitch acceptance | Source notes and product; reverify live rules before submission |
| Judge access | Unreviewed Extension installation restriction was found in earlier FAQ review. Final delivery route and durable access remain unresolved | Product, tasks, source notes |
| Publish/merge/deploy | Prototype and initial records pushed to feature branch at `b5c81e1`; master unchanged. No PR merge/deployment/submission authorized by a design/plan alone | Handoff and record; check current Git state |

## Open acceptance work

Actual two-channel Twitch chat/counts/support; physical marker/camera sharing and
OBS crop/mirror alignment; remote authenticated streamer transport; a named VTuber
adapter; competitive tuning; final judge-access/delivery decision; Google record
mirror; exposed-secret revocation confirmation; peer/main session provenance.
Each is explicit pending work, not hidden behind passing synthetic tests.
