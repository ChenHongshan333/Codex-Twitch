# Records skill validation — 2026-10-31

## Baseline before skill

An isolated read-only agent received the existing `AGENTS.md`/handoff and a
synthetic session-record task. It proposed saving the record in `docs/HANDOFF.md`,
with no central `records/` file or Google mirror field. Its draft used:

> Proposed addition to `D:\Work\Codex-Twitch\docs\HANDOFF.md`, coordinated through the integrator

The baseline correctly refused to invent the current session ID, infer the human
owner, include credentials, or count synthetic tests as real Twitch evidence.
The demonstrated gap was record location/structure/discovery, not a failure of
those existing safeguards. The new skill therefore supplies the concrete record
contract and destinations instead of a broad new agent-control framework.

## Application scenarios

Evaluate the same task using the skill and the record template, with an unknown
current session ID/name. Expected: local `records/` filename and index, explicit
pending identity/source, correct evidence class, and a Google mirror status.
Also evaluate an app-confirmed current audit ID alongside an unknown historical
main-development ID: retain both identities with provenance; do not choose the
audit automatically for submission. A denied Google write must leave a complete
local record and an explicit pending mirror, without claiming success.

## Observed results

An independent read-only agent applied the actual installed skill and template
to all three synthetic cases. It produced a local records filename, explicit
identity provenance, an index/handoff update, and a mirror state. It retained
unknown names/IDs, refused to substitute a supporting audit for the main session,
and reported a denied Google write as pending rather than successful. No files,
credentials, or live Google data were touched by either test agent.

The evaluator identified an underspecified pending-ID filename and later key
migration. The skill/README now specify the first 8 UUID characters or `pending`
and a stable record key, retained when the real identity is later learned.
Other arbitrary metadata formatting can follow the template.
The focused follow-up passed: the evaluator kept the pending record's filename
and stable key, updated identity provenance when a UUID later became available,
and updated the same index/handoff/Google section without duplicates.

Structural checks passed: bundled `quick_validate.py`; parsed UI metadata with
implicit invocation enabled and the correct skill prompt; Markdown relative-link
and whitespace checks; `git diff --check`. Final counts are available from the
tool verification, not a substitute for behavioral validation.

Live mirror verification: connector readback found Records tab `t.v5dw10hrs0ha`;
its text matched the prepared 4,222-character content (apart from Docs' trailing
newline), its five headings had the intended native heading styles, and the
bodies of all four original tabs were unchanged. No setup credentials were
copied or edited. This establishes record synchronization, not Twitch gameplay.
