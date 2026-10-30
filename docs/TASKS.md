# Shared task queue and ownership

The [release-readiness plan](superpowers/plans/2026-10-31-release-readiness.md)
contains task steps, prerequisites, and acceptance criteria. It is a proposal for
the next implementation sessions; this session completed the audit and handoff.

| Task | Priority | Proposed owner | Depends on | State |
| --- | --- | --- | --- | --- |
| 0. Resolve judge access/delivery route | P0 | Representative + integrator | Extension review status and official FAQ restriction | Decision needed |
| 1. CI + packaging regression coverage | P0 | Integrator | Current passing baseline | Ready |
| 2. Twitch accounts + HTTPS/Hosted Test | P0 | Account/deployment owner + integrator | Private setup values and two channels | Setup blocked |
| 3. Real browser validation | P0 | Frontend lane | Local sandbox; Hosted Test for final platform checks | Local portion ready |
| 4. Native demo + English delivery docs | P0 | Frontend/demo lane | Product/contract; real results before final recording | Drafting ready |
| 5. Real two-channel acceptance + release evidence | P0 | Integrator + account owner | Tasks 2–4; CI before release | Waiting |
| OBS physical danmaku prototype | P0 user scope | Current session, integrator/rules/frontend | [Implementation plan](superpowers/plans/2026-10-31-dodge-mode.md) | Local slice verified: 101 tests + Chrome + synthetic camera; physical/live/remote follow-up pending |

Latest scope steering: [physical / VTuber danmaku](design/physical-danmaku-discussion.md)
now includes automatic tracked-marker hits and viewer normalization. The user
authorized starting implementation: see [runbook](dodge-runbook.md) for the
separate local mode. Remote coordination, VTuber adapters, real Twitch/OBS
acceptance and competitive tuning remain follow-ups.

The official FAQ says judges cannot install an unreviewed Extension. Task 0
establishes whether an approved version exists or a different accessible route
is required. Preserve native behavior until that product/delivery decision is
explicit. Record the decision in both `records/` and the Google Records tab.

## File ownership

| Lane | Owns | Focused verification |
| --- | --- | --- |
| Twitch/auth | `src/twitch.mjs`, `src/twitch-directory.mjs`, `src/extension-auth.mjs`, `scripts/verify-twitch.mjs`, `scripts/doctor-extension.mjs`; related tests | `node --test test/twitch.test.mjs test/extension-auth.test.mjs` plus the relevant HTTP tests |
| Rooms/rules | `src/engine.mjs`, `src/pk-rooms.mjs`; `test/engine.test.mjs`, `test/pk-rooms.test.mjs` | `node --test test/engine.test.mjs test/pk-rooms.test.mjs` |
| Frontend/demo | `extension/`, `public/`, frontend tests, `docs/demo-runbook.md` | `node --test test/extension-ui.test.mjs test/extension-integrated-ui.test.mjs test/ui.test.mjs`, then actual browser checks |
| Integrator | `server.mjs`, `src/extension-http.mjs`, `src/store.mjs`, package/lock files, CI, packaging/deployment scripts, shared docs and HTTP tests | `npm run check`, `npm test`, `git diff --check` |

The lanes are ownership boundaries, not instructions to launch agents now.
For two developers, combine transport and core under one owner. Use
`codex/<lane>-<task>` branches and PR titles such as `ci: verify native extension
packaging`. Claim task ownership before concurrent work; shared contract changes
need coordinated consumer updates. Do not assign the same file to two open tasks.

The user's explicit scope change brought physical danmaku and audience-size
normalization into the local prototype. Still deferred: AI challenge generation,
payment processing, token auto-renewal, durable recovery and native-room OBS
consumption. The new mode does not silently consume native PK state.
