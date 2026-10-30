# Hackathon development records

Keep one concise record per Codex session, with updates as that session progresses.
The user requested both this Git-tracked directory and a matching **Records** tab
in the shared hackathon Google Doc. The repository holds detailed evidence; the
Google tab mirrors the session identity, contribution, checks, blockers, and next action.

## Index

| Record | Session identity | Kind |
| --- | --- | --- |
| [Current review, records and dodge implementation](2026-10-31_unassigned_review-records_01a18d87.md) | `01a18d87-3294-76d2-88a8-b5aa16e5daaf` (observed Codex app thread) | Audit, docs, reusable skill and OBS dodge prototype |
| [Prior application implementation](2026-10-30_chenhongshan333_native-pk.md) | Original development session ID still needed from its owner | Historical Git/progress reconstruction |
| [Reviewed document and official sources](sources-2026-10-31.md) | No session claim | Redacted source and decision notes |
| [Skill validation](skill-validation-2026-10-31.md) | Synthetic exercise only | Baseline and skill application checks |

## Naming and identity

The Google setup tab suggests `[NAME]_[CONTENT]`, for example `hongshan_setup`.
Use that as the record's **Session label**, with a filename such as
`YYYY-MM-DD_name_content_session-prefix.md`. Dates use Asia/Singapore.
Use `unassigned` explicitly when the human owner is unknown; do not infer the
current user's name from a Git author or another teammate's setup example.
Do not rename an actual chat merely to match the record label.
For known UUIDs use the first 8 characters as the filename suffix. If unavailable,
use `pending` as the suffix and a stable record key such as
`pending-2026-10-31-unassigned-handoff`. When identity becomes available, update
the same record/Google section's identity fields; keep its original key stable.

Use [TEMPLATE.md](TEMPLATE.md) for new sessions. Record the actual Codex identity
and how it was obtained. App tools can confirm a Codex thread ID; the hackathon
FAQ asks the representative to verify `/status` in the thread where most code was
built before submission. A prior ChatGPT planning conversation, commit SHA,
subagent ID, and current audit session are different evidence. Do not substitute
one for the main implementation session. If unavailable, record `pending` and
the owner/action needed to obtain it.

## Google mirror

Target: the existing shared **Hackthonnnnn** document,
`1x_30AXx2-QcIlqXfVeT-18YsWaFR7mQIaJNL9Q7lmvk`.
The [verified shared document](https://docs.google.com/document/d/1x_30AXx2-QcIlqXfVeT-18YsWaFR7mQIaJNL9Q7lmvk)
now has **Records** tab ID `t.v5dw10hrs0ha` (created and read back 2026-10-31).
Read its tab inventory and locate **Records** before each sync; use the existing
tab rather than adding duplicates. Update the section keyed by record/session ID;
append only when there is no matching section. Preserve requirements, setup,
ideation, other records, and unrelated collaborators' edits. Use a revision guard.
If access is unavailable, finish the local record and state that its mirror is
pending; do not claim a sync succeeded. This does not authorize unrelated Drive edits.

Record identities, dates, source links, branch/base commit, contribution,
commands/results and evidence class, limitations, decisions, and next action.
Summarize Codex's concrete contribution instead of copying entire conversations.
Never copy setup credentials, `.env`, bearer tokens, JWTs, or private debug links.
Source review is evidence of reading, not evidence that a live integration works.

The local naming/mirroring workflow is a team convention. The official requirement
is the main development session ID and an explanation of Codex usage; it does not
mandate this directory or a Google Docs tab. See [source notes](sources-2026-10-31.md).
