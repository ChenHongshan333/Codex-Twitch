# Hackathon readiness: required Twitch proof

2026-11-03 final media update: a 142-second English-narrated/subtitled local MP4
now exists. It contains actual Twitch camera-setup capture and actual source/test
evidence, plus a clearly labelled offline mechanics rehearsal. It does not contain
a real chat-triggered game round; that acceptance gap remains explicit. Streaming
has ended, public VODs were not changed, and no upload/submission was performed.
See the [produced-cut timeline](demo-runbook.md). Earlier video-pending notes below
describe the prior shoot state, not the current existence of the local draft.

2026-11-03 recording route: user selected their own `hongshan333` channel plus
an explicitly labelled local game AI opponent, using the new `ai-demo` mode.
One real chat is subscribed; the actual broadcast/viewer sample, stable physical
tracking and chat-to-game/OBS footage are still pending. The full automated suite
passes 126/126 serially. This does not close the live video requirement or prove
two real streamers. Follow the current [shoot plan](demo-runbook.md); older
two-channel acceptance details below still apply to the default duel mode.
The operator has now started hongshan333's broadcast; Get Streams confirms it is
live, with raw counts of zero and then one observed. AI demo supports that real
zero sample; offline is distinct and rejected. Live game interaction and the
finished video remain unverified; a stream existing alone is not that proof.

Rechecked 2026-10-31 against the [overview](https://twitchcon-codex.devpost.com/),
[official rules](https://twitchcon-codex.devpost.com/rules) and
[FAQ](https://twitchcon-codex.devpost.com/resources). This is an engineering
readiness checklist, not certification of eligibility or a completed submission.
Code baseline `addc634`; runtime evidence remains the earlier 101 synthetic tests,
browser rehearsal and generated-camera checks. No live Twitch acceptance yet.

Follow-up UI smoke on 2026-10-31: 103 tests plus fresh Chrome and generated-camera
checks passed; see [design review](design/2026-10-31-dodge-ui-review.md). These are
local checks and do not close the Twitch evidence gate.

Codex does not have to be the exclusive tool. The FAQ explicitly allows other
AI tools alongside frameworks/libraries/templates, while requiring the project
to be built with Codex. Record and show the actual Codex contribution; a design
skill used by Codex is compatible with that workflow.

## Required evidence and current gaps

| Requirement relevant to this project | What we have | What remains |
| --- | --- | --- |
| Build with Codex; functioning interactive Twitch connection | Codex implementation/records; EventSub/API/overlay code | Actually authorize, connect and verify the chosen delivery path |
| Stable installation matching advertised behavior | Source, setup/runbooks and local checks | Reproduce on the intended judging platform; do not present remote/VTuber support as finished |
| Repository with source/assets/instructions and judge access | Feature branch published | Confirm judge access, especially if repository is private; make testing free and available through judging |
| Feature/Codex-use description and main development session ID | Decisions/records with observed current ID | Representative confirms the correct main coding session, including peer provenance |
| Short YouTube demonstration with Twitch operation and Codex building footage | Local synthetic rehearsal only | Record actual Twitch operation plus Codex development, aim under three minutes, upload with judge-viewable visibility |
| English materials or translations, authorized assets/integrations | English technical docs and private configuration guidance | Final description/video/setup/rights and submission review |

The project should be newly built within the submission window. The site lists
November 2, 2026 at 2 PM Pacific for submission; use its countdown when submitting.
The FAQ's UTC conversion conflicts with the PST page header, so do not rely on
that conversion. The earlier proposed internal target, November 2 at 22:00
Asia/Singapore, remains deliberately earlier. The FAQ accepts unlisted YouTube
videos; the rules require judge-visible YouTube access. Private videos are unsuitable.

## Twitch route

**Peer-facing clarification, confirmed with the user 2026-10-31:** we do not
have to publish a Twitch Extension to enter. The accepted next milestone is
real Twitch chat/EventSub/API → app → OBS overlay, demonstrated on Twitch.
We still need real integration evidence, Codex-building footage and the other
submission materials. This is not approval to broadcast, deploy or submit on
the user's behalf; operators must explicitly start their authorized streams.

An Extension is one allowed integration, not a required one. The FAQ recommends
chat/overlays/API/EventSub when Extension review would block access; it estimates
5–14 days and says judges cannot install unreviewed Extensions. Prioritize the
existing chat/OBS path for the evidence run, while preserving native PK. Final
judge access and delivery setup remain unresolved; no deployment is implied.

[Twitch developer tools](https://dev.twitch.tv/) and the
[Example Chatbot guide](https://dev.twitch.tv/docs/chat/chatbot-guide/) are
implementation resources, not separate deliverables that must be reproduced.
The guide's local bot uses actual EventSub/API calls. “Runs locally” does not
mean “uses fake Twitch events.” Our standalone synthetic mode is different.

## Smallest credible acceptance run for our two-channel concept

1. Account owner arranges two authorized Twitch test channels and the necessary
   user-token consent. This is a project-specific need, not a rule that every
   teammate must personally own a channel. A teammate can operate the real setup.
2. Both channels go live for actual concurrent viewer counts. They can broadcast
   owned test cards/animations/avatars; showing the team's faces is unnecessary.
   Starting OBS video publishing is an explicit separate operator action.
3. Run live dodge input; verify fresh Get Streams counts for both channels and
   real chat from both sides producing opposing projectiles. Verify identity,
   cooldown, defection, hits and settlement. Synthetic inputs must remain disabled.
4. Verify the camera/OBS crop and mirror alignment if physical tracking is shown.
   A keyboard-only demo must be described honestly. Paid events can stay optional;
   do not present synthetic gifts as verified live gift ingestion.
5. Capture the real Twitch interaction and the actual delivered screen/overlay,
   then add Codex-building footage and finalize the short submission video.
6. Representative checks repository/judge access, description, main session ID,
   English materials and the actual Devpost Submitted state before the deadline.

Current dodge is loopback-only. It can be tested on one operator's machine;
it must not be tunneled publicly or advertised as finished remote two-machine
streamer coordination. If remote coordination is essential to the final pitch,
authenticated transport and acceptance are additional required implementation.

Local simulation and CLI mocks remain useful development tools; they are not
our final proof of a functioning Twitch connection. Do not label the hackathon
integration complete merely because unit/browser/mock checks passed.
