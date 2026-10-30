# Working on ChatCrossfire

## Start here

Read `docs/HANDOFF.md`, `docs/STATUS.md`, `docs/PRODUCT.md`, and
`docs/API_CONTRACT.md`, then inspect the files and tests for your assigned task.
`docs/TASKS.md` links the current plan. Check `git status --short`, branch, and
commit before changing files. Preserve other people's uncommitted work.

The code and fresh verification establish current behavior. `progress.md` is
historical evidence from another environment; its running processes, credentials,
tunnel URL, and ignored artifacts do not transfer with a clone.

## Hackathon records skill

For every ChatCrossfire work session, read and apply the repository skill at
`.agents/skills/chatcrossfire-records/SKILL.md` and `records/README.md`.
Keep this session's record under `records/`, update its index, and mirror its
compact summary to the shared hackathon Google Doc's **Records** tab, as the
user requested. Keep identity provenance and pending sync/session-ID fields
explicit. The main code-building session must be confirmed separately from an
audit or planning conversation. Do not copy credentials from the source document.
If Google access is unavailable, complete the local record and report the pending
mirror; do not claim success. Record naming `[NAME]_[CONTENT]` is a team convention.

## Product and invariants

- The primary product is a native Twitch Extension: A invites B, B accepts, both
  ready, then the backend starts and settles a community battle automatically.
  No third host is required.
- Keep participation free. Streamers choose the activity; this app does not
  control arbitrary games or judge artwork. Native scores count released volleys.
- The backend owns identity, room membership, allegiance, cooldowns, timers, and
  scores. Never trust a client-supplied role, user ID, team, or channel ownership.
- One real Twitch user has one allegiance, cooldown, and defection allowance per
  match across both channels and both button/chat inputs.
- Native rooms, sandbox rooms, and the legacy debug match are separate. Legacy
  `/overlay/a`, `/overlay/b`, and `/cue/*` do not display a native PK room.
- Production uses verified Twitch JWTs. Local persona minting stays loopback-only
  and disabled publicly. Do not weaken CORS/Host checks to make setup pass.
- State is in one long-running Node process. Do not add replicas or promise match
  recovery after a restart without designing shared persistence first.

## Stack and commands

Node.js >=22.13.0; Node 24 is the Docker/reference runtime. ES modules, plain
JavaScript/HTML/CSS, built-in HTTP, `node:test`; `jsdom` is development-only.
Keep the current dependency-light approach. There is no compile, lint, or typecheck
script; `npm run check` checks JavaScript syntax.

```powershell
npm ci
npm run check
npm test
npm start
npm run sandbox
npm run doctor:extension
node scripts/package-extension.mjs --backend http://127.0.0.1:3010 --local --check
```

`npm start`: landing/debug on 3000 by default. `npm run sandbox`: explicit local
four-role simulation on 3010. `doctor:extension` exits 1 when setup is incomplete;
this is not a failing unit test. Create `.env` from `.env.example` only if absent;
fill secrets privately. Never overwrite an existing `.env`.

## Ownership and changes

Use `codex/<lane>-<short-task>` branches and separate checkouts/worktrees when
teammates work concurrently. Assign one owner per task; agree on shared changes
before implementing them. Lane ownership and tests are in `docs/TASKS.md`.
The integrator coordinates `server.mjs`, shared contracts, package files, and CI.
Do not start additional agents just because lanes exist.

Follow existing injection seams (`now`, `fetchImpl`, `WebSocketImpl`, directory,
bridge factory) in tests. Use controlled clocks for game rules; reproduce bugs
with focused regression tests. Keep UI rendering safe for user-controlled text.
Avoid unrelated rewrites, framework migrations, or generated production assets
in source control. Update the contract in the same change as any interface change.

Keep `.env`, OAuth tokens, Extension secrets, debug links, bearer tokens, and raw
JWTs out of commits, logs, screenshots, reports, and ZIPs. Synthetic test secrets
must be clearly synthetic. A credential exposure reported in the earlier chat
still needs owner confirmation of revocation; never copy the exposed value.

## Verification and handoff

Run focused tests for behavior changes, then `npm run check`, `npm test`, and
`git diff --check` before reporting completion. Documentation-only changes need
link/content and diff checks; no new unit tests are needed for prose.
Distinguish automated synthetic tests, real-browser checks, public HTTP checks,
and real Twitch gameplay. Passing one does not establish the others.

For review, provide the concrete behavior change, files, test results, limitations,
and contract effects. Keep commits scoped. Do not merge, push, deploy, change live
credentials, or publish submissions unless the user's current instructions
authorize that action. A plan by itself does not authorize its execution.

Before ending a work session, update `docs/HANDOFF.md` and relevant status/task
entries with the branch/base commit, exact checks, remaining blockers, and next
action. Coordinate shared handoff edits through the integrator to avoid conflicts.
