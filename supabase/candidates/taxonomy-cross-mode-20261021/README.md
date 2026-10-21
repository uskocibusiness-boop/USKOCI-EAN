# Cross-mode taxonomy review guard — source-only, 21.10.2026.

**Status:** SQL candidate and deterministic assertions only. No DEV write, migration, signed Save, batch admission, PostgreSQL assertion run, commit, or push by this package. `pglast` parsed all five SQL files. `psql` is unavailable on this host. The candidate ends in `ROLLBACK` and cannot persist a change.

## Finding and scope

The active `private.taxonomy_review_candidate_projection_v2` builds one plan per worker service and execution mode. A worker can offer one concrete service in both `ON_SITE` and `REMOTE`; today the planner can return a signable `READY` review even when two **new** plans name different parents or paths. The batch writer validates plans after Save, but does not make the two-mode identity agreement a review invariant. This can produce a late failure or order-dependent category path. A signed review already stored before this guard is not automatically invalidated.

The guard is inserted just before the projection returns `READY`. For the same normalized worker service across the two modes:

- `CREATE_CHILD`/`CREATE_NEW_BRANCH` must use the same action, parent ID/label and normalized ordered path.
- `REUSE_EXISTING`/`EXTEND_MODE` must use one category ID; these two actions may mix when one direct mode already exists.
- A new-category plan paired with an existing-category plan returns `PENDING_CLASSIFICATION`, `CROSS_MODE_IDENTITY_CONFLICT`, and **zero signable candidates**. The pending projection also sets `reviewedServiceModes=[]` and both catalog fields to JSON `null`, as required by the current client decoder. The review wrapper copies those four fields but drops `reason`, so the client sees a generic pending state until a later, separately reviewed UI contract carries an explanation.

Single-mode worker reviews and requester `NEED_SERVICE` use the existing path. The function keeps owner check, catalog fingerprint, source-bound hints, handoff, low-risk review, exact/alias lookup, and byte limit. This package does not modify capture, Save, batch, binders, client, ACL or consent wrapper. It does not create or widen category modes during review.

## Fresh predecessor evidence

Read-only DEV SQL on project `leqcwgzvjsxugfgzdmth` at **2026-10-21 07:51:28 UTC** returned:

| Function | `md5(pg_get_functiondef)` | `md5(prosrc)` / access |
| --- | --- | --- |
| `private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)` | `e318d1e43e4a045f09be19138016ccd8` | `f9318f476e32a8233fbb07ccf5d22aeb`; owner `postgres`, ACL `{postgres=X/postgres}`, invoker, `STABLE`, `search_path=pg_catalog, private` |
| `public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)` | `b2c4e3d19cd08ed50cfae32a8ed386a0` | `a237d9a981bba2f6c1d1bf8b73b943f3` |
| `public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)` | `2f70c3c29d4c5054c58844e0eb79d81c` | `f2a96cd428eae103ee7928c0af6f2ef4` |

A second read-only call confirmed `private.taxonomy_review_exact_projection_v1` definition MD5 `a461fef793d82272e73ecdaeab7f4121`, `private.retention_ai_source_ready() = false`, and `private.closure_erasure_binding_v5() IS NOT NULL = false`. These values are a dated predecessor, not a future apply receipt. The candidate requires exact hashes and metadata; current DEV closure gates intentionally stop its preflight. Even if a future preflight passes, replacing a protected function can invalidate the closure digest, so postflight also refuses an unattested result. A complete F01/retention/export/erasure recertification must accompany any eventual forward migration; changing only the hash literal or certificate is insufficient.

## Exact read-only preflight and readback

From the repository root, use a verified read-only connection to the intended project. The commands below are **not executed** here:

```powershell
psql -X -v ON_ERROR_STOP=1 "$env:USKOCI_DEV_READONLY_DSN" -f "supabase/candidates/taxonomy-cross-mode-20261021/preflight_readonly.sql"
```

The same SQL may be pasted into the connected Supabase `execute_sql` tool as a read-only query. Require exact projection/exact-lookup/batch/consent hashes and projection metadata from the table above. Require a freshly reviewed closure source digest and technical binding in the integrated admission plan. If any value changes, regenerate this candidate and its tests from the new predecessor.

After a **future integrated and separately approved/proven** migration, run:

```powershell
psql -X -v ON_ERROR_STOP=1 "$env:USKOCI_DEV_READONLY_DSN" -f "supabase/candidates/taxonomy-cross-mode-20261021/readback_readonly.sql"
```

Readback must show the new projection body, unchanged batch and consent hashes/ACL, matching current closure source digest and certificates, `retention_ready=true`, non-null erasure binding, and no active closure conflict. This SQL alone does not establish signed behavior or full privacy readiness.

## Disposable assertion command — unexecuted

Only after identifying a disposable PG16/17 database with no user data, run the existing synthetic fixture, the current source migration, the function body and focused assertions in one session:

```powershell
psql -X -v ON_ERROR_STOP=1 "$env:USKOCI_DISPOSABLE_PG_DSN" -f "supabase/proofs/dynamic_taxonomy/parent-mode-admission/fixture.sql" -f "supabase/migrations/20261019104047_taxonomy_parent_navigation_and_mode_admission.sql" -f "supabase/candidates/taxonomy-cross-mode-20261021/function_only.sql" -f "supabase/candidates/taxonomy-cross-mode-20261021/assertions.sql"
```

The reduced fixture omits the later consent wrapper, so fixture assertions check it only when present; the live candidate's hard preflight always checks its exact definition. `assertions.sql` rolls back its synthetic review rows. It covers agreeing child/root plans in both mode orders, differing parent/path, exact-only dual-mode reuse, same-ID `REUSE_EXISTING` + `EXTEND_MODE`, mixed existing/new, no review category write, and metadata/batch invariance. The assertions also verify the non-READY envelope fields the client decoder requires. A mismatched pair of existing IDs is structurally rejected earlier by the current exact global identity lookup and cannot be constructed as two valid plans in this fixture; this guard branch has no direct PostgreSQL assertion. These assertions have **not** run against PostgreSQL; no DB PASS is claimed.

## Remaining integration gate

This review-only guard prevents new conflicting reviews from this projection. The batch writer needs its own same-service cross-mode identity check and revalidation of already stored signed `READY` reviews before rollout. Expiry alone is insufficient: a Save made before review expiry can still reach the batch path, and an already committed request can replay its receipt. The new projection only governs newly prepared reviews. The Save, batch and binder paths require an isolated two-mode owner-signed review → Save → atomic admission → readback/replay test in both mode orders, plus negative stale/ACL/consent cases. This package deliberately leaves those writer and consent definitions unchanged.
