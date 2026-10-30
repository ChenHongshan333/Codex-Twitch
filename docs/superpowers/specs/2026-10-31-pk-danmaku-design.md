# ChatCrossfire PK / danmaku presentation design

Status: **Arena HUD selected via concept carousel**, 2026-10-31; implementation
plan pending. The user chose to visualize the
existing attack and defection mechanics first. This is a presentation proposal;
the product frontend has not been changed and this is not a new dodging game.

## Intent

Give two-streamer PK an immediately readable battle rhythm: who's ahead, time
remaining, what the opposing community caused, and where a viewer's next attack
will land. Reference TikTok's PK score/timer/team hierarchy and Twitch's native
Extension interaction constraints. Preserve free participation, shared identity,
automatic community scoring, broadcaster-owned controls, and existing rules.

The Extension decorates the current channel's stream. It does not combine two
video feeds, control an external game, or create a standalone OBS view of native
rooms. Teams' participant counts are joined players, not live Twitch view counts.

## Approaches for review

| Direction | Layout | Tradeoff |
| --- | --- | --- |
| Arena HUD — recommended | Prominent two-team score/timer bar, opposing charge/attack direction, compact challenge card; panel keeps actions within easy reach | Strong match readability and PK recognition; requires careful motion and video-safe placement |
| Chat-led | Smaller score frame, activity feed more prominent, compact event toast, same fixed viewer actions | More conversation context; weaker immediate battle/score impact |

Both concepts use the same backend data and retain existing gameplay. The user
has confirmed the mechanic scope and selected Arena HUD through the concept carousel.

## Proposed visual language

- Own Crossfire identity, with neutral charcoal/light surfaces, compact spacing,
  system sans-serif, clear button states, and theme support. Use coral and aqua
  team accents with labels/arrows. The sample Violet team name does not imply its
  accent must be purple. Actual team names still come from room state.
- Reference familiar Twitch density and theme behavior without using its logo,
  Glitch, global emotes, or presenting the Extension as an official Twitch UI.
  Keep the app's own palette; avoid a pervasive imitation of Twitch purple.
- Score is visibly labelled **Community points**. The comparison bar encodes
  `scoreA / (scoreA + scoreB)` with a neutral 50/50 empty state. It is not a
  health bar, gift total, predictive win probability, or audience-size measure.
- Attack, Defect, allegiance, destination, and cooldown labels remain readable
  without relying on hue or motion. Maintain visible keyboard focus.

## Panel and overlay

The panel targets **318 × 496 CSS px**, including action controls. Shorten
nonessential copy; use a compact score block, current challenge, defection state,
allegiance/charge, actions, and bounded activity. Long names/challenges wrap or
get an accessible expansion; do not shrink essential text to fit. Preserve all
authorization, invite, accept, ready/unready, paused, finished and error states.

The overlay uses compact match/challenge elements inside video-safe positions,
with a transparent remainder and noninteractive effects. Keep the stream center
and player controls usable. Collapse/omit secondary information in small players.
No extra videos/iframes or duplicated video controls. A disconnected/unauthorized
state must not falsely imply the match is live.

The interactive concept uses clearly labelled placeholder stream content and
example players/scores. It demonstrates one running/defection-open state and
local illustrative button behavior, not a complete engine or Twitch connection.
The shared [concept source](../../design/crossfire-pk-directions.html) is an HTML
fragment for review, outside the product runtime and Extension ZIP.

## Event-to-visual mapping

| Existing event/state | Proposed presentation |
| --- | --- |
| `attack` | One brief directional charge projectile/label, team-colored; does not itself increment the score |
| `volley` + `community_score` | Bounded multi-lane burst toward `target`, visible challenge, actual authoritative point update |
| `defected` | Brief name/from/to spotlight, allegiance and member-count change; subsequent projectiles follow the new team |
| `defectionRemainingMs` | Timed window cue and eligible Defect control; no promise of immediate cooldown reset |
| `paused` | Freeze decorative gameplay motion; retain readable status and disable unavailable actions |
| New snapshot after refresh/reconnect | Render authoritative score/timers/challenges; initialize event cursor without replaying old attacks |

Render effects from normalized engine events, not arbitrary raw chat text. Escape
names/challenge content. Cap concurrent particles/labels, animate transforms and
opacity, honor reduced-motion preferences, and keep sound off. Normal score
changes and feed entries remain meaningful when animation is disabled. Existing
100-event history and 30-event snapshot are not a complete chat replay stream.

## Implementation boundaries after design review

Primary files: `extension/index.html`, `extension/styles.css`, and
`extension/app.js`; `public/sandbox.*` only for rehearsal presentation if useful.
Keep source DOM hooks compatible where possible. Preserve API payloads, JWT/CORS,
MatchEngine/PkRooms rules, production packaging markers, and sandbox labels.
The legacy `public/app.js` and `/overlay/*` remain a distinct state path.

Verify focused UI/HTTP integration tests, then full syntax/tests/package check.
Use a real browser for both themes, 318 × 496, responsive overlay sizes, keyboard
focus, long/untrusted content, cooldown after defection, reduced motion, particle
cleanup, and refresh/reconnect event cursors. A mockup does not satisfy these
production acceptance checks or live Twitch acceptance.

## References and what they contribute

- [ByteDance UI-TARS](https://github.com/bytedance/UI-TARS): GUI automation and
  grounding reference. It is not a Twitch or TikTok visual-design skill. No model
  or automation framework is required for this presentation change.
- [TikTok LIVE Match help](https://support.tiktok.com/en/live-gifts-wallet/tiktok-live/live-match):
  competing creators, timed shared match, opposing scores. The web crawler could
  search its indexed text but direct access was blocked; visual PK examples were
  also found through image search. Use the battle hierarchy as inspiration, with
  the project's free, server-authoritative gameplay.
- [Twitch Designing Extensions](https://dev.twitch.tv/docs/extensions/designing/):
  compact panel size, themes, legibility, restrained effects, stream-safe layout.
- [Twitch Extension policies](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/):
  branding/content and frontend interaction constraints.

Targeted searches did not locate a first-party Twitch agent `SKILL.md` for UI
design. Official design documentation is the source of platform constraints;
do not present a third-party skill as official or install unrelated tooling.

## Preview verification (not application acceptance)

The concept script was checked in jsdom for syntax, volley score, cooldown,
one-time defection, new targeting, and cooldown preservation. A temporary Chrome
preview checked both themes, reduced-motion static feedback, and the same core
controls. Both concepts fit a 318 × 496 panel; a measured Chat-led overflow was
corrected by shortening one activity entry and tightening spacing. Final layout
checks at 320/360/1024 browser widths found no horizontal or internal panel
overflow; the wrapper's 320-pixel case supplied 288 pixels of inner width and the
panel adapted. A normal-motion click created three volley labels and cleanup
removed all three. Chrome console recorded no errors or warnings.

This concept covers an illustrative running state, not all lifecycle screens,
actual Twitch rendering, or full production semantics. Existing runtime files
and the earlier 84-test application baseline were not changed or rerun for prose.

## Open review

Arena HUD is selected. Prepare the implementation plan around this direction.
Backend mechanics remain
unchanged under the user-confirmed visualization scope.
