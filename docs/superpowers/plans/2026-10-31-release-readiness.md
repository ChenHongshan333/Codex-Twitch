# ChatCrossfire Release Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement an assigned task; use subagent-driven-development only when delegation is explicitly authorized. Track steps with checkboxes.

**Goal:** Deliver verifiable native two-streamer Twitch gameplay and a reproducible teammate handoff, building on the current implementation.

**Architecture:** Keep Node ES modules and the existing authoritative room engines. Native clients use JWT-authenticated HTTP polling; legacy SSE/OBS remains a separate debug path. Complete release tooling and external acceptance before adding gameplay.

**Tech Stack:** Node >=22.13.0 (Node 24 reference), built-in HTTP/WebSocket, `node:test`, jsdom, vanilla frontend, Docker.

**Spec:** [Product baseline](../../PRODUCT.md); [existing architecture](../../ARCHITECTURE.md); [wire contract](../../API_CONTRACT.md).

**Status:** Proposed next-session queue, written 2026-10-31 after the audit spanning October 30–31 (Asia/Singapore), based on `dd440d6` and the 84/84 local test result. Tasks are independent deliverables with dependencies below. No runtime implementation is part of the planning session.

## Global constraints

- Participation is free; native PK needs no third host.
- Backend owns identity, allegiance, cooldowns, timers, and community scores.
- Native rooms, sandbox rooms, and the legacy debug match are separate.
- Production uses one long-running backend, HTTPS, exact CORS, and no local persona minting.
- Keep Node >=22.13.0, ES modules, and no additional production dependency unless justified.
- Never commit secrets or mistake synthetic/browser/public HTTP evidence for live Twitch acceptance.
- Changes to existing gameplay require observed requirements/failures and focused regression tests.

## Review focus

1. Production packager transformations can drift from the tested source: task 1 tests the actual generated script/config/ZIP contents.
2. A new clone lacks ignored credentials/artifacts: task 2 explicitly bootstraps private configuration and regenerates the package.
3. Actual panel clipping, Twitch CSP, Helper refresh, and hidden-tab recovery are not proved by jsdom: tasks 3 and 5 capture platform/browser behavior.
4. Native Extension results can be confused with legacy OBS/manual scores: task 4 makes the demo and testing instructions use the correct state path.
5. A backend restart loses native rooms, while a frontend refresh should recover them: task 5 distinguishes and records both behaviors.

## Task 0: Resolve judge access before choosing final delivery

**Owner:** Team representative with integrator. **Prerequisites:** Actual Extension
review/release status. No code changes are prescribed by this task.

**Files:** `docs/PRODUCT.md`, `docs/TASKS.md`, and this session's `records/` entry;
mirror the decision to the Google Doc Records tab.

- [ ] Check the current [official FAQ](https://twitchcon-codex.devpost.com/resources) and whether the team's Extension already has a reviewed/released version. The FAQ says judges cannot install an unreviewed Extension and estimates 5–14 days for review.
- [ ] Establish a judge-accessible route. If the existing Extension is unreviewed, agree on an accessible delivery approach with the user before adapting product behavior. The legacy chat/OBS route has different host/scoring semantics and is not an automatic native-room fallback.
- [ ] Record the selected route, actual access evidence, and any scope decision. Hosted Test health or an allowlisted teammate's installation alone does not close this item. Tasks 4–5 must reflect this decision before final recording/submission.

## Task 1: CI and actual package regression coverage

**Owner:** Integrator. **Prerequisites:** None beyond `npm ci`.

**Files:** Create `.github/workflows/ci.yml`, `test/package-extension.test.mjs`.
Modify `scripts/package-extension.mjs` only if a regression demonstrates a defect;
update `docs/STATUS.md` and the task handoff after verification.

**Interfaces:** Consume the existing exports
`parseOptions(args) -> options`, `collectAssets(options) -> Promise<Array<[name, content]>>`,
`stripLocalSimulator(source) -> string`, `createZip(entries) -> Buffer`, and
`crc32(data) -> number`. Produce credential-free automated checks; do not change
wire APIs or production dependencies.

- [ ] Add `node:test` characterization cases for existing behavior. Check that local options accept loopback, production rejects loopback/HTTP/placeholder origins, production asset names equal the documented 8-file set, generated config has the supplied origin and `enableSandbox: false`, and packaged app lacks `/api/sandbox/session`.
- [ ] Evaluate the generated config with `node:vm` in a fresh synthetic context and assert the public values. Compile the generated app with `vm.Script`. Include adversarial simulator-marker cases: missing end marker and unmatched end marker must throw.
- [ ] Verify the returned ZIP local/central entries and CRCs against the input assets using test-side parsing; check stable output across identical inputs and no `.env`, source maps, or token-bearing files. Keep temporary output outside tracked source. These are characterization checks; they need not fail first when existing behavior is correct. If a defect is found, prove the failing assertion before its fix.
- [ ] Run `node --test test/package-extension.test.mjs`; expected: all cases pass, no network or private credentials.
- [ ] Add CI for pull requests and pushes to `master`: checkout, set up Node 24 with npm cache, `npm ci`, `npm run check`, `npm test`, and the local packaging `--check` command from `AGENTS.md`. Use read-only repository permissions; do not inject Twitch credentials or run live verifiers in CI.
- [ ] Run the same commands locally and `git diff --check`. Acceptance: green results; no packaging/runtime contract regression. A local workflow review is not proof a hosted Actions run passed; record the latter after an authorized push.
- [ ] Prepare a scoped commit/PR for review when authorized, with test output and the distinction between local checks and hosted CI.

## Task 2: Reproducible Twitch Hosted Test setup

**Owner:** Account/deployment owner with integrator. **Prerequisites:** Permission to
configure the intended accounts/service, a second streamer, private setup values.

**Files:** Use `.env.example`, `docs/twitch-extension-setup.md`,
`docs/cloud-deploy.md`, `scripts/doctor-extension.mjs`, `scripts/package-extension.mjs`,
`scripts/verify-public.mjs`. Update setup docs only for observed differences;
record redacted evidence in `docs/HANDOFF.md`/`docs/STATUS.md`.

**Interfaces:** Produce a real HTTPS backend origin, version-specific 8-file ZIP,
Extension ID, and tested channel/allowlist configuration. Credential values remain
private; the backend origin and version identifier may enter the handoff.

- [ ] Confirm prior exposed application secret is revoked with the owner. Create `.env` only if missing; privately configure OAuth user token, Extension ID/shared secret, actual origin, and disabled sandbox/debug flags. Run `npm run doctor:extension`; expected exit 0 after all required setup is present.
- [ ] Provision or select one long-lived HTTPS backend following the deployment guide, within session authorization. Confirm health says `ok=true`, `extensionConfigured=true`, `sandboxEnabled=false`, and public debug APIs are unavailable. If using a temporary tunnel, record that limitation and arrange durable judge access.
- [ ] Run `npm run verify:public -- <actual-https-origin>`. Its HTTP checks may pass even when Extension configuration is missing; independently require `extensionConfigured=true`. This does not log in or prove Twitch gameplay.
- [ ] Generate the production ZIP with `node scripts/package-extension.mjs --backend <actual-https-origin>`; inspect its manifest and regenerate whenever the origin changes. Upload/configure the version, allow backend networking and identity linking, add both streamers/testers, and install/activate on both channels.
- [ ] Acceptance: an allowlisted viewer opens the installed Extension and an authenticated state request succeeds. Capture version, origin, channel IDs, and redacted evidence; never JWTs, secrets, or authorization headers.

## Task 3: Actual browser layout and interaction checks

**Owner:** Frontend lane. **Prerequisites:** Local sandbox for early checks; task 2
for final Twitch iframe checks.

**Files:** Inspect `extension/index.html`, `extension/app.js`, `extension/styles.css`,
`public/sandbox.*`; fix only demonstrated issues. Regression tests belong in
`test/extension-ui.test.mjs` or `test/extension-integrated-ui.test.mjs` when the
failure is representable there. Browser screenshots go in ignored `artifacts/`.

**Interfaces:** Consume the current native API unchanged. Produce a dated browser
matrix and reproducible failure/fix notes, with explicit local/Twitch labels.

- [ ] Run `npm run sandbox`, open `/sandbox` in a real browser, and rehearse all four roles through the automatic result. Stop owned processes after checking.
- [ ] Check `318 x 496` panel viewport, broadcaster dashboard, and intended video-overlay viewport in light/dark context. Check long challenge/name text, identity request, errors, button visibility, keyboard access, and readable final results. Save representative screenshots and actual browser/version.
- [ ] Check hide/show, refresh, and network interruption/recovery. Ensure one action produces one result and historical events do not all replay as fresh effects. Repeat on the installed Twitch iframe after task 2, checking CSP/CORS and Helper authorization refresh there.
- [ ] For each observed defect, reproduce it, add a focused regression assertion where meaningful, fix it within ownership, and rerun the affected tests/browser case. Coordinate any backend or contract change with the integrator.
- [ ] Acceptance: the recorded matrix passes or explicitly lists remaining failures. Run focused UI tests, full check/test, and diff checks for code changes. Report jsdom and actual browser results separately.

## Task 4: Native demo and English delivery instructions

**Owner:** Frontend/demo lane. **Prerequisites:** Product/contract now; tasks 2–3 and
5 results for final screenshots/recording. Coordinate README edits with integrator.

**Files:** Update `docs/demo-runbook.md`, `README.md`, `docs/twitch-extension-setup.md`,
`docs/cloud-deploy.md`; optionally create `docs/README.en.md` to avoid duplicating
the full Chinese README. Use existing instructions instead of a second competing
`DEMO.md`.

**Interfaces:** Produce English setup/testing instructions and a native-flow
storyboard. Consume actual platform evidence and community-score semantics.

- [ ] Rewrite the primary storyboard around invite/accept/both ready, automatic start, visible attacks in both directions, defection and changed targeting, automatic result, and Codex development evidence. Keep the planned video below 3 minutes.
- [ ] Clearly label the manual-host/OBS runbook as legacy if retaining it. Explain that `/overlay/a` does not show native rooms; do not quietly mix its result into the native demonstration.
- [ ] Provide English setup, private credential configuration instructions, testing steps, and restart/one-instance limitations. Check commands from a clean clone without overwriting local credentials.
- [ ] Acceptance: a teammate can follow the documented route and understands which steps require real accounts. Verify against the current official submission page, including judging access and session ID. Record and publish only when authorized and after real acceptance, then retain the actual URL in the handoff.

## Task 5: Real two-channel acceptance and release evidence

**Owner:** Integrator with account owner/testers. **Prerequisites:** Tasks 2–4;
task 1 should be green before release. Requires coordinated actual Twitch activity.

**Files:** Existing setup guide's acceptance table, `docs/STATUS.md`,
`docs/HANDOFF.md`, `progress.md` as a historical append-only record. Add regressions
in the owning test file only for failures discovered during this exercise.

**Interfaces:** Consume the deployed version/origin and exact native API. Produce
dated real-world evidence and an accurate pass/fail/blocker report.

- [ ] Record both channel IDs, Extension version, backend origin, browser versions, and test date. If chat is included, run `npm run verify:twitch -- <channelA> <channelB>` and confirm both actual subscriptions; this verifier sends no chat messages.
- [ ] Demonstrate A invite/B accept/both ready -> countdown -> automatic start. From both sides join/charge enough attacks for a released volley; verify the opposite challenge and the attacking team's point. Compare both snapshots/results.
- [ ] Using one linked viewer across channels and button/chat paths, verify allegiance/cooldown are shared. Defect in the window, check new targeting and rejection of a second defection. Pause/resume, then wait for automatic final settlement.
- [ ] Refresh/reconnect both clients while the backend remains alive: same room/result and no replay of old effects. In a separate noncritical test restart the backend: record the expected loss of the in-memory room rather than claiming recovery. Restore a clean release state afterward.
- [ ] Acceptance: all live steps pass with redacted screenshots/recording and a shared final result. If any fail, record the precise step and route a minimal fix to its owner. Keep that item unverified until rerun; simulation results cannot close it.
- [ ] Integrator reruns `npm run check`, `npm test`, `git diff --check`, reconciles docs with actual deployment, and completes the submission checklist within explicit authorization. Mark the software/demo/submission outcomes independently.

## Review and handoff

Self-review: product acceptance maps to tasks 2, 3, and 5; reproducibility to task 1;
English/native demo delivery to task 4. API names/defaults refer to existing code.
No new gameplay, persistence, token-refresh, or OBS integration is assumed.
Recommended execution is one assigned task at a time, with separate teammate
branches where ownership permits concurrent work. Update task status and current
handoff after every verified deliverable; do not start all lanes automatically.
