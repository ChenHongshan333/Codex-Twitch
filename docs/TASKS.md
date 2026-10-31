# Shared task queue and ownership

The [release-readiness plan](superpowers/plans/2026-10-31-release-readiness.md)
contains task steps, prerequisites, and acceptance criteria. It is a proposal for
the next implementation sessions; this session completed the audit and handoff.

Use the [agent map](AGENT_MAP.md) for task-to-code/test routing and
[decisions](DECISIONS.md) for confirmed scope versus optional ideas.

| Task | Priority | Proposed owner | Depends on | State |
| --- | --- | --- | --- | --- |
| Horizontal community-support dodge revision | P0 revised direction | Integrator/rules/frontend, implementation owner not yet assigned | [Latest design correction](design/physical-danmaku-discussion.md); agreement on quiet/free/paid balance | Confirmed horizontal/no-aim direction; balance proposals under discussion, implementation not started |
| 0. Resolve judge access/delivery setup | P0 | Representative + integrator | Real Twitch accounts and a reproducible judging setup | Chat/OBS accepted for next evidence run; final judge access still open; Extension publication optional |
| 1. CI + packaging regression coverage | P0 | Integrator | Current passing baseline | Ready |
| 2. Twitch accounts + HTTPS/Hosted Test | P0 | Account/deployment owner + integrator | Private setup values and two channels | Setup blocked |
| 3. Real browser validation | P0 | Frontend lane | Local sandbox; Hosted Test for final platform checks | Local portion ready |
| 4. Native demo + English delivery docs | P0 | Frontend/demo lane | Product/contract; real results before final recording | Drafting ready |
| 5. Real two-channel acceptance + release evidence | P0 | Integrator + account owner | Tasks 2–4; CI before release | Waiting |
| OBS physical danmaku prototype + battle-room UI | P0 user scope | Current session, integrator/rules/frontend | [Implementation plan](superpowers/plans/2026-10-31-dodge-mode.md), [design review](design/2026-10-31-dodge-ui-review.md) | Fresh full suite: 111 tests, including eight added dodge unit cases; prior Chrome/synthetic-camera smoke passed; physical/live/remote follow-up pending |
| Real Twitch proof for chosen dodge delivery | P0 submission | Account owner + integrator, people not yet assigned | Authorized channels/tokens; explicit broadcast setup | Required: [readiness checklist](hackathon-readiness.md); simulator does not complete this task |

Latest scope steering: [physical / VTuber danmaku](design/physical-danmaku-discussion.md)
now includes automatic tracked-marker hits and viewer normalization. The user
authorized starting implementation: see [runbook](dodge-runbook.md) for the
separate local mode. Remote coordination, VTuber adapters, real Twitch/OBS
acceptance and competitive tuning remain follow-ups.

The official FAQ says judges cannot install an unreviewed Extension. The user
accepted that publication is optional and that our next milestone is actual
Twitch chat/API/EventSub driving OBS. Task 0 finalizes judging access for that
route; native PK remains intact as a separate optional path. Record the decision
in both `records/` and the Google Records tab when access is available.

## File ownership

| Lane | Owns | Focused verification |
| --- | --- | --- |
| Twitch/auth | `src/twitch.mjs`, `src/twitch-directory.mjs`, `src/extension-auth.mjs`, `scripts/verify-twitch.mjs`, `scripts/doctor-extension.mjs`; related tests | `node --test test/twitch.test.mjs test/extension-auth.test.mjs` plus the relevant HTTP tests |
| Rooms/rules | `src/engine.mjs`, `src/pk-rooms.mjs`; `test/engine.test.mjs`, `test/pk-rooms.test.mjs` | `node --test test/engine.test.mjs test/pk-rooms.test.mjs` |
| Dodge rules/tracking | `src/danmaku.mjs`, `public/dodge/tracker.js`; collision/pressure/colour tests | `node --test test/danmaku.test.mjs test/dodge-http.test.mjs`, browser camera pipeline, hardware separately |
| Frontend/demo | `extension/`, `public/`, frontend tests, `docs/demo-runbook.md` | `node --test test/extension-ui.test.mjs test/extension-integrated-ui.test.mjs test/ui.test.mjs`, then actual browser checks |
| Integrator | `server.mjs`, `src/extension-http.mjs`, `src/dodge-http.mjs`, `scripts/dodge-server.mjs`, `src/store.mjs`, package/lock files, CI, packaging/deployment scripts, shared docs and HTTP tests | `npm run check`, `npm test`, `git diff --check` |

The lanes are ownership boundaries, not instructions to launch agents now.
For two developers, combine transport and core under one owner. Use
`codex/<lane>-<task>` branches and PR titles such as `ci: verify native extension
packaging`. Claim task ownership before concurrent work; shared contract changes
need coordinated consumer updates. Do not assign the same file to two open tasks.

The user's explicit scope change brought physical danmaku and audience-size
normalization into the local prototype. Still deferred: AI challenge generation,
payment processing, token auto-renewal, durable recovery and native-room OBS
consumption. The new mode does not silently consume native PK state.
