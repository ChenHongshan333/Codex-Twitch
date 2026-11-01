# Current handoff

### Implemented live-dodge setup and diagnostics — 2026-11-02

User authorized implementation, progress update and GitHub push. Current branch
`codex/integrator-live-dodge-setup`, base `e91c6fbd49f1db3fdfc73521b88319b97b6a0ab4`;
prior conversation documentation was preserved. Native PK is unchanged.
Added offline `doctor:dodge`, read-only `verify:dodge`, live chat/count/marker
readiness with backend Start/Resume gating, match-local input diagnostics, and a
camera-first live setup UI. New snapshot fields/409 behavior are in the contract.
No remote/public transport, avatar adapter or actual broadcast was introduced.

Checks: syntax final isolated sandbox run PASS (also escalated rerun PASS after initial native OOM); default
parallel full tests failed with native process memory errors even outside sandbox;
serial full suite `npm.cmd test -- --test-concurrency=1` PASS 119/119. Local Node
is v25.9.0; reference Node 24 is unchanged. Offline doctor EXPECTED exit 1: live
flag/channels incomplete, token format only. No .env value printed/modified.
Read-only verifier likewise exits 1 at local config, without network access.
Ephemeral synthetic HTTP smoke: all 7 controller/script/tracker/overlay/state
URLs return 200, server closed afterward.
No browser surface available, so no fresh real-browser/hardware/OBS/Twitch result.
Documentation/diff checks pass. Implementation commit `1d5e50a` was successfully
pushed with upstream tracking to `origin/codex/integrator-live-dodge-setup`;
this publication receipt is a follow-up documentation commit. No merge/deployment.
Google mirror pending: connected document inventory is empty. Update the existing
[session record](../records/2026-11-01_unassigned_status-run-guide_pending.md).

Next owner action: privately configure two channels/user consent and run
`doctor:dodge`, `verify:dodge`, then `dodge`; calibrate cameras and OBS per the
runbook, exercise actual chat/hits/pause/result and record Twitch footage. Confirm
whether separate computers are mandatory before claiming delivery complete;
authenticated remote state/marker transport and specific avatar adapters remain
unimplemented. Older planning sections below are history.

### Consolidated web/chat/OBS route — 2026-11-02

User prefers returning to the web controller after reviewing Extension judge
access, and asks which decisions are settled and what this route requires.
Gameplay is retained: real Twitch chat attacks the opposing arena, physical/avatar
positions drive collision, backend owns health/timing/result, OBS broadcasts it.
Web controls are streamer setup/start/pause, not a requirement for manual scoring
or mouse-character play. Current dodge already provides chat wiring, local colour
tracking and OBS views; no fresh live/hardware acceptance was performed.

Recommended next sequence: privately authorize two channels and verify live chat
admission with valid audience data; align physical tracking/OBS; capture real
Twitch interaction; simplify operator UI only as needed from that acceptance.
Decide whether this delivery must support separate computers before claiming
completion: authenticated shared remote state/marker/OBS transport is missing.
Specific VTuber adapter and final judge access are also unresolved. Physical-first
acceptance is recommended, not an approved removal of avatar support. Preserve
native Extension code; previous Extension integration preference below is history.
Same branch/base; planning/docs only, no runtime/configuration changes, live
connection, deployment or submission. Checks: local links/content and diff pass;
Google mirror pending lack of connected document sessions. See the session record
linked below. A plan alone does not authorize implementation.

### Twitch Extension controls requested — 2026-11-02

User now prefers streamer buttons inside a native Twitch Extension, with backend
start/scoring/settlement and no standalone controller in normal play. Physical/
virtual-avatar dodging stays. Existing native invite/accept/ready/countdown/auth
UI and tests were reviewed; this UI currently controls community-volley PK, not
DanmakuEngine. No runtime integration was made. Next: scope an explicit dodge
mode behind Extension identity, shared authoritative state and authenticated
remote tracker/OBS sessions, retaining existing native PK. Local camera capture
and specific avatar adapters still need setup/integration. Rechecked official
Extension broadcaster live-view support and hackathon unreviewed-Extension access
restriction. Same branch/base; documentation-only, no fresh tests/live acceptance,
credentials, deployment or publication. Session record updated; Google mirror
pending the previously observed lack of connected document sessions.

### Current scope question — 2026-11-02

Resolved by the next user message: retain physical/virtual-avatar dodging and
explain how to connect real Twitch and whether a controller is needed. The prior
question about scope does not authorize removal of existing modes. Source confirms the standalone
bot is separate from dodge's embedded TwitchBridge. Keyboard/mouse input is a
tracker substitute, while collision/health/results are real gameplay additions.
The current browser controller supplies start/pause/calibration; Twitch does not
require that page, but an alternative operator interface has not been wired.
Same branch/base, documentation-only; no fresh runtime/live verification.
Next: establish whether the two performers share one machine or need remote play;
privately configure and verify real chat, then physical tracking and OBS alignment.
Avatar software adapters and authenticated remote transport remain unimplemented.
Retain existing operator controls for initial acceptance; reducing the page or
moving controls to chat is proposed follow-up, not a current capability. No live
connection, broadcast, deployment or runtime change was performed in this review.
See the [session record](../records/2026-11-01_unassigned_status-run-guide_pending.md).

### OBS presentation clarification — 2026-11-02

Continued on `codex/docs-status-run-guide`, base `e91c6fb`, preserving the existing
documentation edits. Explained terminal/backend vs browser controller vs tracker
vs OBS output, with a proposed one-machine two-arena demonstration. Source/docs
review only; no new runtime/browser/live/physical OBS checks or contract changes.
November 1 test results below are inherited. Next: operator prepares OBS camera
and Browser Source composition, validates tracking alignment, then demonstrates
real two-channel chat if privately authorized/configured. Google mirror remains
pending: no connected document sessions. Same [session record](../records/2026-11-01_unassigned_status-run-guide_pending.md)
updated; documentation whitespace checks pass.
Further clarification provides OBS Window Capture steps for recording keyboard
rehearsal, checked against the official OBS Quick Start Guide. No OBS application
operation, fresh runtime test or recording was performed by the agent.

## Status and startup review — 2026-11-01

Fresh checkout review started clean on `master` at `e91c6fb` (exact base in the
[session record](../records/2026-11-01_unassigned_status-run-guide_pending.md)).
The horizontal dodge revision is already merged through PR #2; older statements
below about uncommitted changes/previous feature branches are historical.
This explanation-only session uses `codex/docs-status-run-guide`; runtime and
configuration are unchanged. Local Node is `v25.9.0`, npm `11.12.1`.

Fresh `npm.cmd run check` passes. First full test run reported two file-level
failures (105 passed); focused rerun passes 19/19 and full rerun passes 112/112.
Cause of the first failures remains unconfirmed. Temporary synthetic dodge HTTP
smoke passes all six controller/state/tracker/overlay URLs and was shut down;
this does not establish browser, physical OBS or live Twitch acceptance.
Documentation links/content and `git diff --check` pass. No live acceptance,
credentials, push, deployment or submission changed. Google mirror is pending:
document-control inventory found no connected sessions; identity remains pending.
Next: user runs `npm run dodge`, opens port 3020 and clicks **Start rehearsal**;
account owner/integrator complete physical OBS and two-channel Twitch acceptance.

Updated 2026-10-31 (Asia/Singapore; audit started October 30). Read this first, then [status](STATUS.md),
[product](PRODUCT.md), [architecture](ARCHITECTURE.md), and [contract](API_CONTRACT.md).

## What this session did

### Horizontal dodge PK implemented

After the user confirmed the dodge arena itself is the PK game (A), replaced
marker-aimed shots with fixed, cycling horizontal lanes in `DanmakuEngine`.
Messages from either source chat now travel left-to-right in the opposing
arena; markers remain collision targets, and defection only redirects future
messages. Free chat is the core input, optional Cheer/gift events remain capped,
and no synthetic neutral hazards are generated. Updated product, contract,
runbook, design, task, decision and record notes. No wire fields or routes changed.
Working tree: `master`, base `a138f8d`; edits remain uncommitted.

Initial full `npm test` under Node `v23.11.0` exposed six Twitch lifecycle tests
cancelled because reconnect retry timers were unref'ed. Removed the unref so the
bridge remains alive during recovery. Final `npm test` passes **112/112**;
`npm run check` and `git diff --check` pass. No physical OBS or live Twitch
acceptance was performed. The local session record is updated; Google
Records mirror stays pending because no connected document session is available.
Chrome 156 headless smoke on isolated port 3031 passed controller start, both
960×540 arenas, opposite-chat routing, horizontal trajectories, W marker
movement, Coral focus and the transparent overlay. Generated-camera feeds through
both tracker pages produced the expected mirror transforms (X≈230↔728, Y≈269),
with no page errors. Physical webcams and OBS were not available/validated.
Remaining blockers: physical camera/OBS alignment and authorized account access
for live Twitch. Next: open both tracker pages and OBS Browser Sources on hardware,
align camera crops, then proceed to two-channel acceptance.

### Current codebase explanation

The first audit on `master` at `a138f8d` read the required source/docs and explained
the four isolated runtime modes: native Extension PK, loopback sandbox, legacy
debug, and local OBS dodge. It also confirmed `bot.mjs` is only a retained
single-channel EventSub connectivity bot, rather than the main application.
No runtime/configuration changes or fresh automated/browser/live checks were
performed. At that audit's start, shots still aimed at marker snapshots. The
implementation and current behavior are recorded above. The local
[session record](../records/2026-10-31_unassigned_codebase-review_pending.md)
is updated; its Google Records mirror is pending because no connected document
session was available. No implementation or tests were run for this review.

### Pull request and default-branch integration

User explicitly requested opening a PR and merging to the primary branch.
GitHub confirms the default is `master` (there is no `main` target in this
workflow). [PR #1](https://github.com/ChenHongshan333/Codex-Twitch/pull/1) contains
the OBS prototype, UI/tests, collaboration docs and pending horizontal design
from `codex/integrator-danmaku-dodge`, base `dd440d6`. The PR is the canonical
remote integration/status record. This handoff entry is written before the
final merge action; it does not claim an observed merge result.

Fresh merge preparation at `29cd122`: `npm run check` PASS; `npm test` **111/111**,
zero failures/skips; `git diff --check origin/master...HEAD` PASS; knowledge-doc
check **181 links / 19 documents** PASS. GitHub reports clean/mergeable, no review
decision and no check runs; these local checks are not GitHub CI. No new browser,
Twitch or physical OBS acceptance. Merge is user-authorized; no deployment.
At that merge-preparation point the follow-up was to settle balance and implement
horizontal lanes; the implementation is recorded above. Real Twitch/OBS evidence
remains outstanding. Google mirror remains pending.

### Horizontal support model — design correction

From clean feature-branch base `7f422f8`, user clarified community-support-driven
horizontal Bilibili-style danmaku, without marker-directed aim, and asked about
few gifts/supporters. Recorded confirmed correction separately from proposed
free-support, neutral-floor and capped-density tuning in the design discussion,
product, decisions and runbook. Arena HUD remains the selected visual direction.
At that review point, code still aimed at markers; the later implementation above
replaced that behavior with horizontal lanes.
The 111-test result below belongs to the preceding unit-test turn, not a fresh
run here. Local documentation checks only. User subsequently requested publishing
these notes to `codex/integrator-danmaku-dodge`; published as `be0f193`. No merge or
deployment. The later implementation above chose free chat as the core input and
no fabricated quiet-stream hazards. Google mirror pending:
no Google writer or connected document session available.

### Additional dodge unit tests

User requested unit tests and a push to the current feature branch. From clean
base `13b0aa4` on `codex/integrator-danmaku-dodge`, added eight controlled-clock
cases in `test/danmaku.test.mjs`: warning/locked aim and dodging, swept marker
crossing, pause/cooldown boundaries, frozen/smoothed audience weighting, offline
credit removal, interrupted barrage lead, knockout/reset isolation and detached
snapshots. Runtime code, dependencies and API contracts are unchanged.

Fresh focused dodge suites: **25/25**; full `npm test`: **111/111**;
`npm run check` and `git diff --check` pass. Browser evidence below belongs to
the previous UI work; no new real Twitch/physical OBS acceptance was performed.
Tests/records committed as `9463d0d` and pushed to the matching origin branch.
177 local documentation links and staged whitespace checks pass. Google Records mirror
remains pending: no Google writer or connected document session is available.
Next: account owner/integrator completes real two-channel Twitch/OBS acceptance
and mirrors the local session record when Google access returns.

### Fresh smoke test and battle-room UI

User requested smoke testing, rejected the UI and asked about Codex exclusivity.
Rechecked official FAQ: other AI/tools allowed, while actual Codex building use
and evidence remain required. Applied Shiro in fix mode and Playwright skill;
UI-TARS was rechecked as GUI automation research, not a design skill. Reworked
the dodge controller around the selected Arena HUD hierarchy: compact match
strip, equal arenas/health, chat/activity column, one-click synthetic rehearsal,
focus previews and expandable setup. Practice figures are explicitly test targets;
native Extension UI, backend rules and API schema are unchanged.

Base `8c7425c` on `codex/integrator-danmaku-dodge`. Fresh `npm run check`,
`npm test` **103/103**, and `git diff --check` passed. Chrome smoke passed both
hits, dodge, cooldown-retaining defection, barrage, lost-tracking pause/resume,
reconnect, five responsive widths, reduced motion, keyboard skip and transparent
OBS output. Generated-camera mirror/loss check also passed. No actual Twitch,
physical webcam/OBS or remote acceptance was performed. See
[review/evidence](design/2026-10-31-dodge-ui-review.md).

Isolated synthetic server session 14262 remains at `http://127.0.0.1:3030/`,
left in lobby for Start rehearsal. It loaded no `.env`; user port-3020 state was
preserved. Source assets now contain the new UI; reload existing tabs to see it.
Browser artifacts are ignored under `output/playwright/`. Local processes do
not transfer with a clone. Google Records mirror remains pending connector
access. UI/test/review commit `e860205` was pushed to the shared feature branch;
177 documentation links and staged whitespace checks passed. No deployment/merge.

### Peer-facing delivery clarification

User accepted the explanation that Twitch Extension publication is optional and
asked to record it for peers. Made it prominent in README, AGENTS.md, product,
decision register, tasks and [readiness](hackathon-readiness.md). Current next
milestone is actual Twitch chat/EventSub/API → app → OBS evidence and the Twitch/
Codex demo video. Native PK is preserved as an optional path. Final judge access,
accounts/live acceptance and submission materials are still pending; the
simulator does not complete those requirements. Documentation-only commit
`893ab65` was pushed to `codex/integrator-danmaku-dodge` for peer access, based
on `addc634`. Link/whitespace validation passed (166 local links, 16 documents).
No app code, runtime, credentials, broadcast or deployment changed. Google mirror
pending. Older local-only notes below describe previous handoff states.

### Hackathon requirement recheck

User correctly emphasized the Devpost requirements after account-free testing
guidance. Reopened overview/rules/FAQ and linked Twitch developer/chatbot sources
on 2026-10-31. Actual Twitch operation and corresponding demo footage remain
required; local simulation is only a development stage. Added
[readiness checklist](hackathon-readiness.md) and a P0 real-Twitch-proof task.
Recommend chat/OBS evidence path given the unreviewed-Extension judge restriction;
no final route selection, account creation, broadcast, token generation or
deployment occurred. Need an account owner to arrange authorized test channels
and actual viewer counts/chat/overlay acceptance. Published source code is not
proof this has passed. Current checklist/docs are local and uncommitted; Google
mirror pending. Code/tests unchanged; runtime results remain inherited.

### Account/testing clarification

User reports having no Twitch account. Local simulation/camera/OBS preview needs
none; skip user-token authorization for now. Real user-token consent needs a
Twitch login, which the user or a teammate must supply on their own authorized
setup. Token entry does not start broadcasting; the app has no video ingest
publisher, and camera frames stay local. Actual viewer-normalized acceptance
needs live channels, which can broadcast test cards rather than people. CLI
mock API/EventSub servers are an additional future test option, not already
wired into this bridge. No credentials read, no `.env` change, and no broadcast
started. This clarification is documented locally; no new push in this turn.

### CLI installation and documentation publication follow-up

User explicitly requested the missing agent-map/docs be pushed, and Twitch CLI
installed so they can enter credentials themselves. Installed official CLI
`v1.1.24` under `%LOCALAPPDATA%\Programs\TwitchCLI`, verified the archive against
the release SHA-256 checksum and added that directory to user PATH. `twitch
version` returned `twitch-cli/1.1.24`; token help and persisted user PATH passed.
No keys/tokens were generated, no CLI credentials configured/read, and `.env`
was preserved. Open a new terminal, or use the explicit path in the configuration
guide. Token setup belongs to the user; tokens are secrets, not device-bound.

Published docs-only commit `9950029` on `codex/integrator-danmaku-dodge`, starting
from `b5c81e1`; Git push succeeded. Includes map, decision register, navigation
skill and related documentation fixes. Earlier notes saying those edits were
local describe the prior handoff. Application code is unchanged; checks are
documentation/skill validation plus CLI installation checks. Google mirror still
pending. View the feature branch on GitHub; master is unchanged.

### Local environment preparation

User asked what to fill in `.env`. It was absent; created a copy of
`.env.example` without adding credentials or changing defaults. `git check-ignore
.env` confirms exclusion. Existing secret values were not read or displayed.
At that earlier check `twitch` CLI was not on PATH; it is now installed as above.
Rechecked official CLI install/token documentation;
see [configuration guide](configuration-guide.md) for minimum live-dodge settings
and the separate native Extension requirements. Live OAuth consent/account setup
has not been performed. Restart dodge after private edits; current process stays
in synthetic mode until restarted with `DODGE_LIVE=1`. Google mirror pending.

### Agent knowledge follow-up

At `b5c81e1`, reviewed the documentation against this chat and source entry
points. Added [agent map](AGENT_MAP.md) with documentation/runtime dependency
graphs and task-to-symbol/test routing, plus [decisions](DECISIONS.md) consolidating
confirmed ideas, engineering defaults, candidates and pending acceptance.
Added the project `chatcrossfire-navigation` skill, linked through AGENTS.md;
the existing records skill still owns session evidence/mirroring. Updated stale
native-only scope language and marked earlier design/source notes as history.
These follow-up docs/skill edits were local at the previous handoff; they are
now committed and pushed as `9950029`.
No application code changed; the 101-test result below is inherited from the
verified implementation/publication turn, not rerun for prose.
Navigation skill validation passed; 153 local links/whitespace checks across
14 knowledge documents and `git diff --check` passed. Google mirror still pending.

### Latest: implemented local OBS dodge mode

Publication follow-up: user explicitly requested pushing to the configured
GitHub remote on 2026-10-31. Commit `245cec9` contains the prototype and the
collaboration docs/records/skill; `git push --set-upstream origin
codex/integrator-danmaku-dodge` succeeded. The branch tracks its GitHub upstream.
This follow-up documents that successful publication. No master merge or
deployment. Fresh pre-push syntax, all 101 tests, documentation links and
staged whitespace checks passed. Credentials and local artifacts were excluded.

User authorized starting engineering work after confirming tracked-marker hits
and normalization by concurrent viewers. Branch is now
`codex/integrator-danmaku-dodge`, base
`dd440d63a63616c28e7de50b080ea1e396bcdf9b`. Earlier uncommitted documentation
was preserved and committed with the implementation as `245cec9`. Publication
is recorded above; no deployment or live credential change was performed.
Older audit-only statements below are historical.

`npm run dodge` starts the new standalone loopback app on port 3020. It has
equal 960×540 arenas, camera colour-marker tracking, authoritative swept hits,
health and settlement, normalized chat/support admission, five-second sustained
pressure within eight-second buckets, and allegiance/cooldown-preserving
defection. Separate transparent OBS views do not consume native PK state.
Actual Twitch chat/count/support code is wired with opt-in support grants;
synthetic endpoints are disabled in live mode. Existing PK defaults are intact.
See [runbook](dodge-runbook.md), [plan](superpowers/plans/2026-10-31-dodge-mode.md)
and the added section in [contract](API_CONTRACT.md).

Fresh checks: `npm run check` PASS; `npm test` **101/101** PASS;
`git diff --check` PASS. This is synthetic/mocked/local HTTP/jsdom evidence.
Local links in 11 implementation/handoff documents also passed validation.
Real Chrome rehearsal confirmed both attacks and health 5→4 on both sides,
pointer/keyboard movement, a viewer switching to B then attacking A, pause,
no horizontal overflow at 1440/390 px, and transparent OBS background. Synthetic
canvas camera verified mirrored x≈729 and unmirrored x≈230, with marker expiry
after stopping; no physical webcam was activated. Page script errors: zero.
Artifacts live locally under ignored `artifacts/dodge-*`.

Server session 43249 remains running on `http://127.0.0.1:3020/`; Chrome
`dodge-rehearsal` contains a paused 60-second rehearsal after defection (elapsed
15.2s, health A4/B3, two shots each). Rehearsal marker selectors were switched
Off after testing so they cannot compete with the user's own tracker/controller.
Enable both markers, then Resume, or Reset for a clean round. These
processes do not transfer with Git. Original port-3010 sandbox was not restarted.
Google Records mirror of this work is **pending**, because no Google Docs/Drive
connector is currently available. Local record/index updated in this session.

Next owner action: privately configure OAuth tokens/two live channels and verify
real chat/viewer counts/support grants. Perform physical sticker/crop/mirror/OBS
alignment and lost-tracking checks on hardware. Remote two-streamer transport,
specific VTuber adapters, competitive tuning and production review are still
open; this is a local playable prototype, not a completed remote service.

### Earlier audit and design history

Read the [previous ChatGPT discussion](https://chatgpt.com/c/6ae4ba2a-0b2c-83ec-8337-4f9699f33359)
through the app's conversation reader, then inspected the cloned source and tests.
The original attached Word export was not separately reviewed. Follow-up work
read the native Google Doc directly, including requirements/setup/ideation; the
AI for Good tab was empty. The previous discussion could not inspect the private
GitHub repository; this audit can.

Created repository instructions, current product/architecture/API notes,
evidence-based status, ownership lanes, and a dependency-ordered release plan.
Added navigation and historical-status notices to the existing entry documents.
Application code and existing gameplay behavior were unchanged.

Follow-up: clarified `.env.example` comments and added
[configuration-guide.md](configuration-guide.md). Added the shared
`chatcrossfire-records` skill, a [records index](../records/README.md), the current
[session record](../records/2026-10-31_unassigned_review-records_01a18d87.md), and a
historical implementation record with the original development session ID pending.
The user requested both repository records and a Google Doc Records mirror.
The app-confirmed ID for this supporting audit is
`01a18d87-3294-76d2-88a8-b5aa16e5daaf`; do not automatically select it as the main
implementation session. Final mirror/skill verification is recorded in
[validation notes](../records/skill-validation-2026-10-31.md).
The Google Records tab is `t.v5dw10hrs0ha`; connector readback confirmed both
session summaries and unchanged original tab bodies. The repository skill is
installed at `.agents/skills/chatcrossfire-records/SKILL.md`, with implicit
invocation enabled. Both the skill and local records remain uncommitted; other
teammates need these files in their checkout for local skill discovery.

Official source review found a release issue: the hackathon FAQ says judges cannot
install an unreviewed Extension and estimates 5–14 days for review. Task 0 now
requires a judge-access decision. The shared setup tab still contains a Client
Secret; owner action to revoke/remove it remains outstanding. No credential value
was copied or used, and setup/ideation source content was not modified.

Branch: `master`. Audited base: `dd440d63a63616c28e7de50b080ea1e396bcdf9b`.
Documentation changes are local and uncommitted; no branch, commit, push, PR,
deployment, or account change was created. Run `git status --short` for the
current file list rather than assuming the workspace still matches this note.

## Verification and boundaries

Node 24.19.0 / npm 11.17.0. `npm ci`, syntax checks, and all 84 tests passed.
The local packaging source check passed for 8 assets without writing an archive.
`doctor:extension` correctly reported missing ID, secret, OAuth token, and origin;
no `.env` exists in this clone. See [STATUS.md](STATUS.md) for evidence classes.
Documentation relative links and whitespace were also checked before handoff.

No persistent application server or tunnel was started; test servers were scoped
to the automated checks. Historical URLs/PIDs/ZIP reports in
`progress.md` do not establish current availability. No live Twitch connection or
real browser/OBS acceptance was attempted during this planning session.

## Immediate next actions

Latest user steering: [physical / VTuber danmaku discussion](design/physical-danmaku-discussion.md)
replaces the earlier visualization-only premise for a new OBS dodge mode. Equal
arenas/message sizes and a 5–10-second activity advantage were requested;
automatic hits using a tracked marker were confirmed. No camera, avatar adapter,
collision engine, hit scoring, or paid-event ingestion exists yet. The user has
now selected normalization by concurrent viewers watching each stream. This is
not follower count, game participants, or active chatters. Twitch Get Streams
provides viewer_count; smoothing/freshness/floor, gift weights, pressure
thresholds, defection attribution and hit outcomes still need concrete rules
before freezing the mode
design. Arena HUD remains reusable presentation work, not proof this gameplay
exists. Google mirror of the new discussion is pending (connector unavailable).

Competition clarification rechecked against official rules/FAQ on 2026-10-31:
an actual Twitch-connected interactive experience is required; a native Extension
is optional. A separate app/web with real chat/EventSub/API/stream-overlay use can
qualify. The local simulator does not by itself establish that integration. No
delivery-route change was authorized by the rules question. Sources and details
were added to the current session record; Google mirror remains pending.

Latest user-requested local rehearsal: existing four-role simulator is running at
`http://127.0.0.1:3010/sandbox`, with a visible Chrome browser `pk-rehearsal` left
open. Actual UI actions demonstrated both volleys, then viewer A defecting A -> B
and attacking A. Score 1:1; members 0:2; match paused with about 22 seconds left.
Either broadcaster can Resume. `artifacts/pk-rehearsal.webm` and the redacted
`artifacts/rehearsal-result.json` retain local evidence. Server session is 56460;
it is intentionally left running for user inspection. No Twitch broadcast was
started. Arena HUD was selected through the concept carousel but is not yet
integrated; this demo uses the original frontend. Latest Google mirror is pending.

Design follow-up: user confirmed visualizing existing attack/defection mechanics.
[Draft design](superpowers/specs/2026-10-31-pk-danmaku-design.md) and
[two concept directions](design/crossfire-pk-directions.html) are ready for visual
review. Arena HUD is now selected; Chat-led was the quieter alternative. Concept
Chrome checks passed for core interactions, reduced motion, themes, compact
panels, responsive widths, and effect cleanup. This is not application/Twitch
acceptance. Runtime code is unchanged; prepare the Arena HUD implementation plan
before product edits. The new design record's Google mirror is pending because the
connector is currently unavailable; earlier mirror verification still stands.

1. Integrator: take task 1 in the [release plan](superpowers/plans/2026-10-31-release-readiness.md):
   CI and packaging regression coverage. It needs no Twitch credentials.
2. Account/deployment owner, in parallel: privately configure a valid OAuth user
   token, Extension ID/shared secret, actual HTTPS backend origin, two real
   channels, test allowlists, and installation/activation. Confirm the exposed
   application secret reported in the earlier chat has been revoked. Do not paste
   old or new credential values into chat or docs.
3. Frontend owner: run task 3 browser checks and capture actual panel/overlay
   rendering; fixes should follow observed failures.
4. Integrator + account owner: perform the real Twitch acceptance matrix only
   after setup and packaging agree. Update the demonstration to the native flow.

The critical path is platform setup -> shared backend/production ZIP -> real
two-channel acceptance -> recording/submission. CI, packaging tests, browser
rehearsal, and English instructions can advance while setup is being completed.
No new feature is needed merely to recreate the already-passing synthetic flow.

## Collaboration workflow

Use one assigned task per branch/worktree. Proposed lane ownership is in
[TASKS.md](TASKS.md); no teammate has been assigned automatically. The integrator
owns shared routing/contracts and resolves overlap before changes are made.
Each PR reports checks, evidence type, contract effects, known limitations, and
the next reproducible action. Task owners give their handoff to the integrator
for the shared files rather than all rewriting them concurrently.

Useful existing tools: Git/local CLI as the source of code; GitHub connector/CLI
when repository permission is available; installed Superpowers workflows for
implementation/debugging/review; real-browser automation for layout and flows.
Do not introduce another agent framework. Skills installed on one machine are
not guaranteed on teammates' machines; `AGENTS.md` and the checked-in contracts
must remain sufficient to get started.

### Next-session prompt

```text
Read AGENTS.md, docs/HANDOFF.md, docs/STATUS.md, docs/API_CONTRACT.md,
and docs/TASKS.md. Inspect git status, branch, and the assigned task's code/tests.
Work on the task I assign, within its file ownership and acceptance criteria.
Preserve the native two-streamer flow and distinguish it from legacy debug/OBS.
Use focused regression tests for behavior changes, then run check/test/diff checks.
Report synthetic, browser, public HTTP, and live Twitch evidence separately.
Update the task handoff with exact results, blockers, and next action.
Coordinate shared contracts and server.mjs with the integrator; do not merge or
deploy unless this session authorizes it. Keep all credentials private.
```
