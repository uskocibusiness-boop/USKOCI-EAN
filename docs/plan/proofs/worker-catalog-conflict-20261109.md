# Worker classification: exact DEV conflict reproduction, 2026-11-09

**Finding:** the observed seven-service Worker turn has two independent blockers. This is a read-only diagnosis plus isolated reproduction; no runtime or DEV change and no model calls.

## Exact cause

1. `Kurirske dostave` and `Nabavka i kupovina` both resolve to `00000000-0000-4000-8000-000000000701` / `ON_SITE`. The live resolver explicitly rejects a repeated category ID plus mode, even for different service labels. Both proposals succeed individually. No competing canonical/alias identity was found for either label.
2. After removing that duplicate in the diagnostic input, `Fizički poslovi` independently returns `NEEDS_CLARIFICATION` from the live triage function and therefore `CATALOG_SAFETY` from the resolver. That label is intentionally broad; the present receipt code conflates ambiguity with actual safety rejection. The specific remaining five services resolve with their original IDs.

All six referenced IDs were established leaf nodes with the requested mode. There was no missing category, wrong leaf or wrong-mode explanation for the first conflict. The actual failing condition is the second disjunct of the resolver's existing pair loop:

```sql
(item->>'categoryId'=category::text AND h.proposals->j->>'mode'=mode)
```

## Why a one-line workaround would be incomplete

Read-only inspection also found:

- `rpc_taxonomy_commit_reviewed_batch_service` independently raises `BATCH_DUPLICATE_CANONICAL_ID` on the same category/mode pair.
- Review projection matches each offered **service label + mode** to its proposal. Removing one proposal alone would leave that offered service uncovered.
- Resolved-hint projection requires one resolution item per proposal.
- Worker binder requires matching review/plan/result lengths and per-service approval; it upserts capabilities by account/category and confirmed modes by account/category/mode. Handoff evidence must not be overwritten by contradictory duplicates.

Consequently, relaxing only the resolver moves the failure to Save, while silently dropping a label or a proposal loses coverage. A possible Edge consolidation would have to update the effective service facts and classification plan together while preserving all requested work and handoff semantics; no such change is implemented or proven here. Supporting several visible service labels under one capability identity instead requires a linked resolver/batch admission contract with contradictory-mode/handoff and replay protections, followed by the normal SQL promotion procedure. Neither is permission to infer a skill or weaken ownership, revision or signed Save.

The broad-service case should produce one useful clarification and retain the five specific services already known. It must not announce a ready review or ask the user to fix catalog IDs.

## Local proof

Command: `node --test scripts/worker-catalog-conflict.test.cjs`.

Result: **6/6 PASS**, 0 failures/skips, approximately 7.29 seconds.

1. Exact seven proposals produce durable `DEFERRED / CATALOG_CONFLICT`, without audit/catalog mutation.
2. First two proposals individually resolve; together conflict.
3. Removing only the duplicate exposes `DEFERRED / CATALOG_SAFETY`; the broad third label alone does the same.
4. Removing those two inputs for diagnosis yields five resolved original IDs and no catalog writes.
5. Explicit different-mode extension is a separate accepted decision in the isolated fixture; the duplicate rule is specifically category plus mode.
6. A single NEW combined natural offer `Kurirske dostave i nabavka` plus the other four specific services resolves under unchanged SQL with the intended IDs. The broad offer remains a separate clarification obligation, not a service silently removed by this diagnostic test.

The two removals are **diagnostic test inputs, not a proposed loss of the user's services**.

## Upstream contract available without a SQL relaxation

`workerServiceChangesSchema` already allows a new model-authored `ADD` label backed by verbatim current USER evidence; `applyWorkerServiceChanges` alone constructs the complete `patch.skills`. A single combined natural offered service can therefore use the same exact label in that ADD, its `serviceModeChangesJson` entry and its taxonomy decision. Work details remain in the label/biography; unmentioned saved services and their IDs/modes remain untouched. This shape has the local SQL proof in scenario 6; a production whole-output change still needs its linked Edge tests.

Instruction alone is not an acceptance guarantee. Any deterministic consolidation must be confined to genuinely NEW additions with the same validated existing category ID and identical complete mode/handoff sets, update all related structures together, preserve all requested scope without truncation, and avoid renaming or merging previous saved rights. Metadata-only deduplication is not sufficient. The broad service must yield `NEEDS_CLARIFICATION` with one concrete work question while preserving known specific offers, rather than a premature ready-review invitation.

Fixture captures the current catalog (204 nodes, 72 aliases, 2 risk rules) and the exact four live SQL bodies. Only Auth-role/closure scaffolding and table shape are bounded local substitutes; this is not full Auth/RLS, Worker Save/activation, concurrent SQL, Android or hosted acceptance. User/account/conversation IDs were not copied into the capture; the test uses a synthetic account.

| Live function | Body MD5 |
| --- | --- |
| `taxonomy_resolve_turn_catalog_v1` | `bdc9c0623132c3a93708c8d0e63ccef6` |
| `taxonomy_normalize_v1` | `8c360cb0a05699cdae25485a5efc77ba` |
| `taxonomy_risk_triage_v1` | `93d94a6c7e21ce3ecb854cda239b546a` |
| `taxonomy_turn_category_identity_v1` | `b8ccc18825305df690c1b9b2546e03c9` |
| `rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)` | `156107382ec4aea5fda5348a6fc86f2d` |
| `rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)` | `f1122a1dcbfa7bedbee5ecae2d6d9a3c` |
| `private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1)` | `74e02b0d7775533900a6a7858f94fb61` |
| `private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)` | `f439455e1d5edb63ae4297a5c922a3c5` |

Source capture: [worker_catalog_conflict_20261109.preimage.json](../../../scripts/sql/worker_catalog_conflict_20261109.preimage.json). Executable reproduction: [worker-catalog-conflict.test.cjs](../../../scripts/worker-catalog-conflict.test.cjs).
