---
name: chatcrossfire-records
description: Use when starting, continuing, or handing off Codex work on ChatCrossfire, or preparing its hackathon session records and submission evidence.
---

# ChatCrossfire session records

Maintain one truthful, reusable session record in both the repository and the
shared Google Doc. This supports teammate handoff and the hackathon's Codex-use
evidence; it does not authorize implementation, deployment, or submission.

## Record contract

At the repository root read `records/README.md` and `records/TEMPLATE.md`.
Find this session's existing record/index row before creating another.
Use `records/YYYY-MM-DD_name_content_session-prefix.md` and label `name_content`,
following the setup tab's `[NAME]_[CONTENT]` convention. Use `unassigned` when the
human owner is unknown; do not guess it or rename the actual chat.
For a known UUID use its first 8 characters as the filename suffix; when unknown,
use `pending` and a stable record key such as `pending-2026-10-31-unassigned-handoff`.
If the real ID arrives later, fill the identity/source fields in that same record
and Google section; preserve the record key to avoid duplicates.

Populate the template's identity/provenance, purpose, branch/base commit,
contribution/decisions, exact checks with evidence class, limitations/next action,
and Google mirror fields. Update after a meaningful verified result and before
handoff. Add the local index row and link the record from `docs/HANDOFF.md`.
Keep another session's record intact; coordinate concurrent index/handoff edits.

| Situation | Record action |
| --- | --- |
| Codex identity available | Save the observed ID, actual title, and its source |
| ID or owner unavailable | Explicit `pending`/`unassigned` plus who must supply it |
| Current audit versus prior code-building session | Keep distinct; representative confirms the main development ID via `/status` |
| Checks inherited from earlier work | Attribute date/session; do not claim a fresh run |
| Mock/jsdom/local checks pass | Label synthetic; browser, public HTTP, and live Twitch remain separate |

A ChatGPT planning conversation ID, commit SHA, or subagent ID is not a replacement
for the main Codex development session. Do not automatically select the newest
audit thread for submission.

## Google mirror

The user requested both destinations for this project. Target the existing
**Hackthonnnnn** document ID `1x_30AXx2-QcIlqXfVeT-18YsWaFR7mQIaJNL9Q7lmvk`.
Use connected Google Docs tools to inspect all tab properties and locate
**Records**. Reuse its observed tab ID. Update the section keyed by record ID;
append only if absent. Mirror the compact identity/contribution/checks/blockers/
next-action summary. Preserve other tabs and records, use a current revision
guard, and read back the changed section once. Save the verified sync state in
the local record. If access fails, finish locally and report the mirror as pending.
If no Records tab exists, create one only within the user's authorized document.

## Source and credential boundaries

Consult `records/sources-2026-10-31.md` for reviewed ideation and official links;
recheck live official guidance when a decision depends on it. Reading a source
does not verify installation or gameplay. Capture Codex's concrete contribution,
not a full chat dump. Exclude `.env`, application/Extension secrets, OAuth tokens,
JWTs, and private debug links, even when present in the setup document. Record
credential names/configuration status only. Record judge-access and main-session
selection as unresolved until evidence establishes them.
