# R04 semantic admission — reviewed single-word services, synonyms and execution modes

**Status: APPLIED_CONTROLLED_INTERNAL_DEV** on `leqcwgzvjsxugfgzdmth`. Source `39e5bf8d` passed Full CI41435448239; migration `20261102113012/r04_semantic_worker_continuity_receipt_recovery_v1` installed all14 guarded bodies. Postflight `R04_SEMANTIC_DEV_POSTIMAGE_MATCH` and read-only PG guard acceptance passed. Compatible post-save Edge v12 was deployed and both files read back byte-identical; active cron and worker flag restored, service tick HTTP200. Certificate/readiness remain unchanged. See [`dev-applied-20261102.json`](dev-applied-20261102.json).

Frozen build manifests retain their preparation-time status; the later execution receipt is the deployment evidence. Dated NOT_APPLIED entries below describe earlier states. The owner separately requested and authorized a fresh test-data reset; see [the exact operation and receipt](../dev-owner-data-reset-20261102/README.md).

**Positive business acceptance is still pending.** The first real Android Worker turn returned safety REVIEW for an ordinary profile preview and did not save a profile. A focused prompt/schema and truthful rejection-message correction has139/139 local tests PASS; it is not yet deployed or live-model verified. R01 remains FAILURE, R10 readiness=false, and no release-ready claim is made.

## Connected source milestone — 2026-11-02

The actual Worker prepare/confirmed-prepare → mobile decoder → Save/Activate → batch/binder → public reader chain now retains independently bound services when a later conversation adds a new service, including an unregistered semantic label and physical handoff. Current and earlier explicit mode/handoff changes cannot silently restore the previous choice. Semantic EXTEND_MODE preserves the confirmed category ID without creating a global alias. The 10-case connected proof passed; new authority still requires binding. An already ACTIVE edit Save records new consent and is not a blanket catalog revalidation.

The Need proof now also executes the actual evaluation Edge handler, decision writer and mobile publication resume through canonical PUBLISHED readback, with normal and lost completion ACK. Claims, provider, policy and selected supporting fixtures remain synthetic. This proves isolated publication/replay, not live model quality, hosted RLS or Android operation.

The 14-body package includes an independent closure calculation and exact pg_proc metadata/whole-catalog delta/inverse-code-rollback proof. Fresh read-only DEV preflight at 10:02:23 UTC returned PREIMAGE_MATCH with positive Auth acceptance=false; none of these replacements was applied. See the same `local-verification-20261102.json` for commands, hashes, final CI and native scope as they become available. Historical limitations below are superseded only for these explicitly proven source/isolated scopes.

Full [CI41427579876 SUCCESS](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41427579876) now covers this connected source:626Jest suites/14567tests,1535AI PASS/1existingTODO,TS/12Deno/SQL/PostGIS/integrity PASS. Test-only `cb3461ee` corrected one stale informal-copy assertion from initial failed run41426536069; runtime is unchanged from APK source `bdc45275`. The internal debug APK is installed and exact embedded source/update verified with limited UI inspection; no new server business acceptance. Separate [R0141427579875 FAILURE](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41427579875) remains8/49/3; DEV promotion is still not performed.

## What changes and why

A single-word concrete service (e.g. `Lektura`) used to become `NEEDS_CLARIFICATION` solely because its label contained no space; a signed, semantically matched existing service could then remain `PENDING_CLASSIFICATION`. An unregistered synonym could fail batch admission even after the human approved the service. Existing Need and Worker clients also rejected the new server's two optional signed category-witness fields.

The core four bodies remain, without creating a table/function or widening ACLs:

1. `private.taxonomy_risk_triage_v1(text)`: removes the blanket multiple-word requirement; preserves dangerous/regulated screening and explicit ambiguous-catch-all checks.
2. `private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)`: projects eligible reviewed service proposals into a signed classification state; unresolved or sensitive cases stay gated.
3. `private.needs_sync_taxonomy_category_trigger_fn()`: resolves the canonical category key and registered aliases without granting an unreviewed category identity.
4. `public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)`: admits reviewed existing IDs and low-risk unregistered synonyms with a category identity witness; checks label, parent, established leaf, actual mode, service intent, handoff and replay. It also supports validated `EXTEND_MODE`, `CREATE_CHILD` and `CREATE_NEW_BRANCH` under the existing audit and authorization boundaries.

The same transaction now also includes these ten existing owners:

- Worker semantic binding, skills sync, REMOTE activation eligibility and saved execution-mode readback.
- Signed REMOTE review readiness, owned saved-service mode context and ordinary and explicit-mode Worker review preparation.
- Existing post-save finalizer and reconciler, recovering only the same exact committed receipt after transport uncertainty.

`manifest.json` lists all exact signatures, source hashes and required compatible post-save Edge files. Candidate wrappers remain LOCAL_ONLY; the generator takes only their reviewed bodies, retains captured function headers, checks all 14 complete `pg_proc` metadata rows, rejects unrelated function changes and verifies the derived closure postimage. It changes no certificate, readiness flag, table, grant or model budget. Deploying SQL alone does not update the separately pinned Edge worker or installed APK.

The compatible source decoders are `src/data/aiTaskReviewClientService.ts` and `src/data/workerAiClientService.ts`: they preserve optional `categoryLabel`/`categoryParentId` and reject malformed or unrecognized fields. **Supported old APK/OTA behavior must be checked before the server rollout**; updated source code alone does not upgrade a running client.

## Historical local verification and its limits

Reported checks for `94c8862c`:

- `node --test supabase/operations/dev-alpha/r04-semantic-admission-20261101/package.test.mjs`: **14/14 isolated PGlite tests PASS**, covering four-body metadata, old/new triage, READY projection, trigger, rollback and replay, Need/Worker binding, unregistered synonyms, multi-level child and new root, BOTH, extension, drift and handoff negatives.
- `node supabase/operations/dev-alpha/r04-semantic-admission-20261101/build.mjs --check`: PASS.
- `python supabase/migrations/check_migration_integrity.py`: PASS (193 files reported).
- Need/Worker service Jest selection: 110/110 PASS reported; `reproduce-client-contract.cjs` returns `CONTRACT_VERIFIED_FIXED`.
- On live DEV, the **read-only** preflight returned `R04_SEMANTIC_DEV_PREIMAGE_MATCH`. It is *not* an applied migration or authenticated positive business test.

The PGlite suite executes significant real PL/pgSQL bodies but constructs synthetic identity/review fixtures and controlled supporting functions. It is **not** the complete signed AI conversation â†’ real Auth/HTTP prepare â†’ Save/Accept â†’ batch â†’ binding â†’ publication/activation â†’ Android readback. The new package has not been installed on DEV or PRODUCTION. The first main GitHub CI for `94c8862c` failed on a strict TypeScript test error. Fix commit `639c97d6` has **full CI SUCCESS** ([run 41367990553](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41367990553)): 626/626 mobile suites, 14,567 tests, 3 snapshots, 1,487 AI tests PASS/0 FAIL, TypeScript, Edge, isolated R04 package/rollback, PostgreSQL/PostGIS and migration integrity PASS. Subsequent commits updating this README and `CODEX_PLAN_RADA.md` are documentation-only. Independent [R01 run 41367990583](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41367990583) remains FAILURE, so this is not DEV promotion permission.

## New downstream R04/R08 source checkpoint â€” 2026-11-02

At `work/rev14-review-f17@6608730d`, two **additional LOCAL_ONLY (NOT APPLIED)** SQL candidates now exist:
- `worker-semantic-binder-local-only.sql`: validate the signed, committed, witnessed category ID for a worker's non-registered synonym. Preserve exact mode/leaf/parent/label and reject drift.
- `worker-remote-semantic-review-local-only.sql`: recognize a complete, current, signed, existing-ID REMOTE worker review without requiring a fictitious city. Never authorize a new category, new mode, or a capability from an unbound AI proposal.

`package.test.mjs` now includes **17/17 isolated scenarios PASS**. The linked full [CI 41374792426](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41374792426) is SUCCESS (626 Jest suites / 14,567 tests; 1,487 AI PASS + one TODO). Independent [R01 41374792443](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41374792443) still FAILS with 8 strict / 49 owner-ACL / 3 managed-net differences.

**These two scripts are NOT in this package's four-function `promotion.sql`**, which remains frozen PREPARED_NOT_APPLIED. At that earlier checkpoint, worker-sync preservation and post-binding REMOTE eligibility were NOT closed (see the subsequent source result below), and full Auth/Android acceptance is NOT proven. Never run either local-only SQL file directly on DEV/PROD, merge unguarded DDL into promotion, or interpret isolated CI success as deployment authorization. Build one reviewed compatible pre/postimage/rollback bundle and pass R01/closure/client/DEV gates before explicit DEV approval.

## Subsequent downstream source — 2026-11-02

Runtime source `d89f9aad2d176c9293a67c95943101659309e953` adds three more LOCAL_ONLY replacements: `worker-semantic-sync-local-only.sql`, `worker-remote-semantic-activation-local-only.sql`, and `worker-semantic-readback-local-only.sql`. The actual saved-mode reader is `rpc_get_worker_execution_modes`; `rpc_read_worker_ai_taxonomy` remains unchanged. Existing bound semantic IDs survive unrelated skill additions and formatting-only label changes. Explicit removal still revokes; a stale binder replay does not regrant. New signed consent can regrant the same ID with the current mode set.

The **18/18 isolated package tests PASS**, including captured live old-body failures and actual trigger/batch/binder/eligibility/public-reader execution with `skills text[]`. That harness prepares review/Save/Auth synthetically. Full [CI41414604704](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41414604704) passed the first batch. Final [CI41418479603 SUCCESS](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41418479603), head `deae029243c08982fea9803ed6c237b589235a17`, now covers all subsequent corrections below: 626 Jest suites / 14,567 tests, 1,530 AI PASS / one existing TODO, TypeScript, all 12 Deno checks, SQL/PostGIS and migration integrity PASS. Separate [R0141418479574 FAILURE](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41418479574) remains strict8/owner-ACL49/managed-net3. See `local-verification-20261102.json` for exact scope, related R06 checks and the fresh read-only GitHub/DEV comparison. No deployment or native acceptance is implied.

At that earlier checkpoint the five extra Worker candidates remained outside the four-body promotion. The current 14-body derivation above supersedes that packaging limitation, adds three existing Worker context/prepare owners and two R06 owners, and retains the ban on applying raw LOCAL_ONLY files directly. Packaging is not DEV acceptance.

The added `r04_worker_semantic_save_chain.test.mjs` executes actual prepare → current mobile decoder → Save/Activate → batch/binder → public readback. Its **7 cases + 18 package cases PASS** for existing IDs, new child/root, extension, two services, explicit physical handoff, replay and negative drift/owner/mode paths. New cityless activation gives consent, not capabilities: those remain absent and application readiness false until binding. Public submit reaches a declared calendar sentinel, not a completed application. Synthetic hints/claims and helper substitutes remain; real Auth, complete Need publication, matching and Android are unproven. A mixed novel plan with previously saved REUSE handoff absent from the current hint remains conservatively refused.

The four-body package also had incorrect hardcoded post-closure digests. `955da679` replaces them with deterministic offline derivation from the captured exact DEV catalog and four replacement bodies. **11 closure tests PASS**, including an independent PostgreSQL JSONB/SHA-256 calculation. Only expected source/erasure postconditions changed; certificate/readiness/bindings did not. The old generated-file equality test could not detect this error. The regenerated package is still unapplied and not a closure certification.

The connected Need proof (`3c3b54b6`, `r04_need_semantic_save_chain.test.mjs`, **1/1 PASS**) now executes actual prepare/decoder/Accept/draft-save/category trigger/batch/binder and owned RPC readback. It verifies stable review/category IDs and replay without manually inserting review/command/Need rows. Synthetic policy/claims/own-row RLS and NULL-only geography remain. Actual publication without an ALLOW decision is refused; positive evaluation/publication is still unproven.

## Controlled DEV verification order

1. Pin the exact source SHA and clean target. Require the relevant **full CI SUCCESS on the runtime SHA** and examine the separate R01 result; do not silently waive R01. Confirm that the relevant supported client(s) can decode both preimage and postimage server responses.
2. Confirm manifest hashes, all 14 current function preimages and full catalog attributes, owner/ACL, `private.closure_*` digests/retention bindings, target project and rollback with the **read-only** `preflight.sql`. If any assertion fails, stop and investigate drift.
3. Only after the plan's DEV promotion gates are satisfied, execute the reviewed, matching `promotion.sql` as a **single guarded transaction**, never by extracting unguarded statements from `forward.sql`. Keep its exact recovery `rollback.sql` available.
4. Run `postflight.sql` and `acceptance-readonly.sql`; record real before/after hashes and migration ledger with truthful timestamps and no premature success receipts.
5. Under the proper TEST account and supported Android build, verify the original "Lektura" blocker, signed review, actual Save/Publish/readback; repeat for Worker Save+Activate, BOTH and negative account/revision/handoff/drift paths. Do not modify real customer data or trigger paid provider requests accidentally.

Rollback restores exact function code; it does not erase or reverse newly admitted business data. Before reverting after any successful new binding, pause affected writes and verify that old readers/activation/sync can still serve those records. Otherwise restore compatible code or keep the affected feature paused while repairing it. Do not delete user data to make rollback appear safe. The package's isolated metadata/transaction test does not prove that production-state compatibility.

For an explicitly approved internal DEV pilot, restrict access to the verified new APK and designated TEST accounts; this does not establish compatibility with older clients. The 14 shared replacements are not themselves TEST-only. Coordinate SQL and the manifest-pinned post-save Edge deployment while affected Save/Accept operations and background processing are paused. The existing Edge flag `USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED=false` stops a new tick before reconciliation, claim and binding; verify actual disabled behavior and drain/recheck existing leases before replacement. Preserve and later restore the prior setting only after the matching SQL/Edge postflight. **The database outbox control alone is not a complete pause:** the live claim body checked on 2026-11-02 does not consult it, although reconciliation does. A zero-lease observation also does not prevent a new claim. This procedure does not change any flag or authorize deployment by itself.

Global R01 strict parity remains FAIL. A separately approved bounded DEV acceptance must record that limitation and exercise real Auth ownership, stale review/revision, Need publication/readback and cityless Worker activation/binding/readback. It cannot mark R01/R10 complete or open the app to new/untrusted users while the known Need column privacy boundary and lifecycle obligations remain unresolved. Do not rerun the unchanged disposable bootstrap as a substitute for these concrete checks.

R10 `retention_ai_source_ready()` remains false and export/erasure bindings remain unbound; do not manually rewrite certificates, hashes or flags to appear ready. R01/R10/R12 release gates remain open. This work is **not** a public release authorization. The sole execution master is `docs/plan/CODEX_PLAN_RADA.md`.
