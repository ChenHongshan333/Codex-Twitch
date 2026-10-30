# OBS danmaku implementation

Owner: current Codex session, integrator + rules + frontend. Branch
`codex/integrator-danmaku-dodge`, base `dd440d6`. User authorized implementation
on 2026-10-31. Preserve the uncommitted audit/docs and existing PK modes.

## Deliverable

A separate local two-arena controller and transparent OBS outputs, with server
physics, automatic camera marker input, keyboard rehearsal, chat/defection,
viewer-normalized admission/pressure, and a working synthetic demonstration.
Real Twitch acceptance requires private OAuth configuration and two live channels;
remote streamer networking and specific VTuber software adapters are follow-ups.

## Configurable initial rules

- Equal 960×540 arenas, 14-unit circular marker, fixed 128×28 message hitbox.
- Five health, 1.5-second invulnerability, 180-second round; surviving health wins.
- 800 ms warning, 300 units/second straight shots aimed at a position snapshot.
- One allegiance/cooldown per real user across channels; two-second activity
  cooldown, one switch during the middle 30 seconds, launched shots stay put.
- Eight-second comparison buckets; source-channel audience denominator frozen
  per bucket, EWMA alpha .3, floor 20; counts expire after 45 seconds.
- One chat unit; Cheer weight ceil(bits/100), gifts weight quantity, both capped
  at three units. Free chat always works. Anonymous support stays source-side.
- Normalize all admitted attack units to 100 viewers. Bounded fractional credit,
  queue and active bullets; larger channels do not get unlimited raw bullets.
- Ratio ≥1.5 and lead ≥.02 units/viewer sustained for five seconds within an eight-second bucket triggers
  a six-second barrage. At most three shots/sec normally, six during barrage,
  maximum 32 active per target. Missing/offline/stale counts suspend admission
  and escalation, and discard activity rather than save a reconnect burst.
- Both markers must be fresh (<1 second). Tracking loss freezes game time and
  requires operator Resume after recovery. No camera frames leave the browser.

These are first playable tuning defaults, not measured gameplay balance.

## Work and verification

1. Add deterministic engine tests for collisions, fair normalization, source
   attribution/defection, stale counts, tracking loss, bounded load and settlement.
2. Implement engine + loopback-only HTTP controller/OBS transport, strict Host
   and Origin checks, bounded request body, synthetic mode explicit.
3. Add webcam colour-marker tracker, keyboard rehearsal, controls and OBS views.
4. Wire real Twitch chat and sampled Get Streams counts; paid support requires
   broadcaster scopes and must not double count chat Cheer copies.
5. Run focused tests, syntax, entire suite and whitespace checks. Use Playwright
   for real rendered control/OBS flows; distinguish synthetic camera and live
   hardware/Twitch evidence. Update contract, runbook, records and handoff.

No push, deployment, secret changes or submission in this task.
