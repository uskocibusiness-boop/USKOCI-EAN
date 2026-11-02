# R04 semantic admission — reviewed single-word services, synonyms and execution modes

**Status: PREPARED_NOT_APPLIED** on DEV `leqcwgzvjsxugfgzdmth` at source commit `94c8862c`. The subsequent strict TypeScript test fix is `639c97d6`. **Source/PGlite tests do not establish DEV or Android acceptance.** Do not run `promotion.sql` merely because this package exists.

## What changes and why

A single-word concrete service (e.g. `Lektura`) used to become `NEEDS_CLARIFICATION` solely because its label contained no space; a signed, semantically matched existing service could then remain `PENDING_CLASSIFICATION`. An unregistered synonym could fail batch admission even after the human approved the service. Existing Need and Worker clients also rejected the new server's two optional signed category-witness fields.

This package changes **four existing function bodies**, without creating a table/function or widening ACLs:

1. `private.taxonomy_risk_triage_v1(text)`: removes the blanket multiple-word requirement; preserves dangerous/regulated screening and explicit ambiguous-catch-all checks.
2. `private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)`: projects eligible reviewed service proposals into a signed classification state; unresolved or sensitive cases stay gated.
3. `private.needs_sync_taxonomy_category_trigger_fn()`: resolves the canonical category key and registered aliases without granting an unreviewed category identity.
4. `public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)`: admits reviewed existing IDs and low-risk unregistered synonyms with a category identity witness; checks label, parent, established leaf, actual mode, service intent, handoff and replay. It also supports validated `EXTEND_MODE`, `CREATE_CHILD` and `CREATE_NEW_BRANCH` under the existing audit and authorization boundaries.

The compatible source decoders are `src/data/aiTaskReviewClientService.ts` and `src/data/workerAiClientService.ts`: they preserve optional `categoryLabel`/`categoryParentId` and reject malformed or unrecognized fields. **Supported old APK/OTA behavior must be checked before the server rollout**; updated source code alone does not upgrade a running client.

## Local verification and its limits

Reported checks for `94c8862c`:

- `node --test supabase/operations/dev-alpha/r04-semantic-admission-20261101/package.test.mjs`: **14/14 isolated PGlite tests PASS**, covering four-body metadata, old/new triage, READY projection, trigger, rollback and replay, Need/Worker binding, unregistered synonyms, multi-level child and new root, BOTH, extension, drift and handoff negatives.
- `node supabase/operations/dev-alpha/r04-semantic-admission-20261101/build.mjs --check`: PASS.
- `python supabase/migrations/check_migration_integrity.py`: PASS (193 files reported).
- Need/Worker service Jest selection: 110/110 PASS reported; `reproduce-client-contract.cjs` returns `CONTRACT_VERIFIED_FIXED`.
- On live DEV, the **read-only** preflight returned `R04_SEMANTIC_DEV_PREIMAGE_MATCH`. It is *not* an applied migration or authenticated positive business test.

The PGlite suite executes significant real PL/pgSQL bodies but constructs synthetic identity/review fixtures and controlled supporting functions. It is **not** the complete signed AI conversation → real Auth/HTTP prepare → Save/Accept → batch → binding → publication/activation → Android readback. The new package has not been installed on DEV or PRODUCTION. The main GitHub CI for `94c8862c` failed on a strict TypeScript test error; `639c97d6` fixes that test and requires its own full CI evidence. The independent R01 parity gate remains open.

## Controlled DEV verification order

1. Pin the exact source SHA and clean target. Require the relevant **full CI SUCCESS on the runtime SHA** and examine the separate R01 result; do not silently waive R01. Confirm that the relevant supported client(s) can decode both preimage and postimage server responses.
2. Confirm manifest hashes, current four-function preimage, owner/ACL, `private.closure_*` digests/retention bindings, target project and rollback with the **read-only** `preflight.sql`. If any assertion fails, stop and investigate drift.
3. Only after the plan's DEV promotion gates are satisfied, execute the reviewed, matching `promotion.sql` as a **single guarded transaction**, never by extracting unguarded statements from `forward.sql`. Keep its exact recovery `rollback.sql` available.
4. Run `postflight.sql` and `acceptance-readonly.sql`; record real before/after hashes and migration ledger with truthful timestamps and no premature success receipts.
5. Under the proper TEST account and supported Android build, verify the original "Lektura" blocker, signed review, actual Save/Publish/readback; repeat for Worker Save+Activate, BOTH and negative account/revision/handoff/drift paths. Do not modify real customer data or trigger paid provider requests accidentally.

R10 `retention_ai_source_ready()` remains false and export/erasure bindings remain unbound; do not manually rewrite certificates, hashes or flags to appear ready. R01/R10/R12 release gates remain open. This work is **not** a public release authorization. The sole execution master is `docs/plan/CODEX_PLAN_RADA.md`.
