---
name: chatcrossfire-navigation
description: Navigate ChatCrossfire tasks using the project graph, decision register and source/test ownership map. Use when continuing work, locating a rule or bug, scoping a change, or preparing a handoff in this repository.
---

# ChatCrossfire navigation

Find the smallest relevant set of documents, producers/consumers and tests.
This is a source navigation aid, not a replacement for reading code being changed
or permission to implement a candidate idea, spawn agents, push or deploy.

## Enter through the map

Honor [AGENTS.md](../../../AGENTS.md), including its required startup documents
and [records skill](../chatcrossfire-records/SKILL.md). Then use
[AGENT_MAP.md](../../../docs/AGENT_MAP.md): select the runtime boundary and task
row. Read [DECISIONS.md](../../../docs/DECISIONS.md) when scope, rationale or a
historical idea is in question. Read the linked detail only for the selected lane;
do not load every design/record or reread every module by default.

The four states are native PK rooms, sandbox PK rooms, the legacy debug match,
and standalone OBS dodge. Shared module names and identical URL paths on
different ports do not make them one match. Native volleys/community points and
dodge projectiles/health are different rule sets.

## Follow and verify relevant edges

Check branch, HEAD and uncommitted changes. Compare the map's reviewed commit
to current code in the selected lane. Use `rg -n` for the mapped symbols; read
their implementation, relevant callers and regression tests. Follow another
edge only when an import, route, snapshot, identity or shared rule requires it.
If the map conflicts with code, investigate and repair the affected entry rather
than assuming the whole audit must be repeated or treating the cache as authority.

Use the focused verification pointers, then the checks required by AGENTS.md.
Keep synthetic, browser, public HTTP and real Twitch/OBS evidence distinct.
Ignored artifacts and running servers are local evidence, not cloned resources.

## Leave knowledge current

Update the touched map row/edge and contract with interface/dependency changes.
Record confirmed choices and superseded ideas in DECISIONS.md; retain concrete
tuning values in the existing runbook/source instead of copying constants into
this skill. Update handoff/status/session evidence through the records skill.
Do not infer unknown teammate identities, grants, integration success or final
submission choices. Peers need a checkout containing these project skills and
docs; the map is not an automatically synchronized external knowledge database.
