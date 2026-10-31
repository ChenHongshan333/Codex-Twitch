# Dodge battle room: design review and smoke checks

User requested a fresh smoke test and rejected the initial UI. Source base:
`8c7425c`, branch `codex/integrator-danmaku-dodge`. This change affects the local
dodge controller, not the existing native Extension frontend or game rules.

## Skills and evidence

Applied installed **Shiro** in fix mode (implementation + real Chrome, then
re-review), its anti-pattern guidance, and the **Playwright** browser skill.
The user-linked [UI-TARS repository](https://github.com/bytedance/UI-TARS) was
rechecked: it is a GUI-agent model/automation project, not a visual-design
`SKILL.md`. No UI-TARS model/runtime or unrelated design tooling was installed.
The selected [Arena HUD direction](../superpowers/specs/2026-10-31-pk-danmaku-design.md)
informs hierarchy; this is an actual controller iteration, not a claim that the
native Extension redesign is finished.

Baseline smoke ran on isolated `127.0.0.1:3030`, explicit synthetic mode with no
`.env` loading. Both sides released one shot; health fell 5→4 each; pause worked;
no page script errors. Fresh baseline syntax/all 101 tests passed. Existing
port-3020 state was preserved.

## Findings and changes

- **P1 — Introduction competes with play.** Large marketing text and scattered
  controls preceded the arena. Replaced with compact match status and a battle-room
  layout: equal arenas, explicit community pressure and a chat/activity column.
- **P1 — Rehearsal requires setup knowledge.** Added explicit Start rehearsal:
  it enables local keyboard markers, starts a 60-second round and begins synthetic
  messages. Live mode hides this path and synthetic event controls.
- **P1 — Readiness was implicit after reset.** Browser smoke caught Start before
  marker refresh; Start/Resume now wait for fresh markers. Paused/disconnected
  event submission is disabled. Defection remains disabled outside its window.
- **P2 — Empty grid does not explain a body target.** Added a labelled practice
  figure around the marker in controller rehearsal only. This is not video,
  body-pose inference or an external VTuber adapter; OBS remains transparent.
- **P2 — Inspection and setup have equal visual weight.** Added real focus-view
  buttons and moved audience/OBS details into an expandable setup area. Focus
  changes preview layout only; both logical arenas remain 960×540.
- **Keep — Fairness and source clarity.** Fixed geometry, two distinct team colours,
  text labels/arrows, explicit local/test labels, keyboard access, local camera
  processing and authoritative health/timers remain intact. Activity uses DOM
  text nodes and bounded current-match history; it does not replay attacks.

## Verification boundary

Targeted jsdom/local HTTP tests cover one-click start, focus controls retaining
geometry, defection timing, disconnected controls and hiding synthetic controls
for Twitch-source state. Real Chrome checks cover the actual canvas/layout and
physical input interactions. Camera tests use generated video; hardware camera,
OBS CEF, actual Twitch accounts/events and remote streamer transport remain
separate acceptance work. Final results and ship call are in the session record.

Before/after screenshots and browser scripts are local evidence under ignored
`output/playwright/` and `artifacts/`; they do not transfer with the repository.

## Re-review and result

Fresh `npm run check`, **103/103 tests**, and `git diff --check` passed. Actual
Chrome smoke passed: both-direction hits (5→4 each), moving out of an announced
shot without taking damage, defection with cooldown denial then changed target,
Coral barrage, tracking-loss time freeze, recovery/resume, pause, and interrupted
polling/reconnect controls. No page script errors; expected HTTP 409 cooldown
and deliberately aborted polling requests are negative-test evidence.

No horizontal overflow at 320/390/768/1024/1440 px. Focus views, setup expansion,
reduced-motion transitions (0s), keyboard skip-to-battle and transparent overlay
pixels passed. Generated-camera mirroring mapped x≈729 to x≈230 when toggled;
marker expired after stopping. This did not activate a physical webcam.

The prior P1 hierarchy/setup/readiness issues are resolved in the checked UI.
The battle and next action lead; detailed setup is available without competing
with play. **Ship call: ready for local rehearsal.** Real Twitch, hardware/OBS
and native Extension presentation acceptance remain open. Visual preference is
still subject to the user's review; this pass does not claim their approval.
