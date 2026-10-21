# F01 rebase — verified subset, closure gate still closed

**STATUS: FAIL_CLOSED. NO EXECUTABLE CANDIDATE. NO DEV WRITE OR CERTIFICATE ADMISSION.**

Read-only catalog observation: 21 October 2026, around 06:22 UTC, DEV project
`leqcwgzvjsxugfgzdmth`. This package refreshes only the **34 function signatures
and 20 table shapes captured by the historical F01 prototype**. It does not
establish a complete current closure predecessor, full export or erasure
coverage, legal policy, or permission to deploy. Catalog SELECTs were separate
reads, not an atomic pinned snapshot; a fresh readback is mandatory at apply.

## What the read-only subset proves

| Observation | Result | Local evidence |
| --- | --- | --- |
| Historical F01 functions | 34/34 exist. Current body/definition MD5, owner, ACL, config, language, volatility and SECURITY DEFINER metadata were read. Exactly six body/definition pairs differ from the 18 October capture; 28 exact definitions retain matching hashes. | `readback_manifest.json`, `live_drift_readback.json`, `rebase.mjs`, `verified_subset_snapshot.json` |
| Historical F01 tables | 20/20 exist. Owner, ACL, relation kind, RLS, policies, columns, defaults, CHECK/FK constraints and captured user triggers were read. The single changed table is `private.taxonomy_confirmed_worker_modes_v1`. | Same readback and validation files |
| Changed table | A nullable `handoff jsonb` column **and** `worker_handoff_valid` CHECK were added. The CHECK requires a valid handoff on `REMOTE` rows when the value is present. Other captured shapes match the historical subset. | `readback_manifest.json`; source migration `supabase/migrations/20261019104604_service_handoff_signed_matching.sql:25–27` |
| Closure gate | Observed source digest `e064bf5bd995c9b846495f9f808c2910ba56d21f5fcb56b84ad98514d569bb79`, erasure program digest `90d60aa9529996103b91ca54fb4be94770d6862453fbe521f878c603d6ab3f1e`, both technical certificate hashes `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`, and zero `EXECUTING` generations at observation time. Digest differs from both certificates. | `readback_manifest.json`; `docs/candidates/closure-gate-repair-20261021/REPAIR_SEQUENCE.md` |

Six exact changed signatures and current `md5(prosrc)`:

| Signature | Body MD5 |
| --- | --- |
| `public.rpc_taxonomy_bind_reviewed_need_service(uuid, uuid, uuid, uuid, integer)` | `373eb4f7686f893355b983bda31e00e5` |
| `public.rpc_taxonomy_bind_reviewed_worker_service(uuid, uuid, uuid, uuid)` | `a57b0afcf132c8a71a4a874ee9bcfd2e` |
| `public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)` | `61164e8e21e2f44db125377b9280a700` |
| `public.rpc_taxonomy_commit_admission_service(uuid)` | `cfd385271eee13c94dcc40a71fff16d4` |
| `public.rpc_taxonomy_commit_reviewed_batch_service(uuid, uuid, text, uuid, jsonb)` | `a237d9a981bba2f6c1d1bf8b73b943f3` |
| `public.rpc_taxonomy_prepare_admission_service(uuid, uuid, text, uuid, jsonb)` | `8dd36fe1c3b4475a137908dfd6362b5c` |

The six full definitions are in `live_drift_readback.json`. For the remaining
28, `verified_subset_snapshot.json` reuses historical exact definitions only
after checking current full-definition MD5 and metadata. The snapshot names
itself `VERIFIED_SUBSET_ONLY_NOT_DEPLOYABLE`; its certificate values are
**observations of stale certificates**, not a certification of the snapshot.
`readback_manifest.json` SHA-256 is
`af63ae6dcc18d36b607933f9bc16b3eccc9021ba632993fc598c8488a6b21bd9`.

## Why a new F01 migration was withheld

The 18 October `manifest.mjs:12` export field list for
`taxonomy_confirmed_worker_modes_v1` omits `handoff`; `semanticKeys` also omits
it, while `resetSections.confirmed_modes` inherits the short field list. Regenerating its
SQL with only six updated function bodies would omit an admitted personal copy
from at least the worker-mode export projection. The source migration also
added `public.need_requirement_details.handoff` and its `need_handoff_valid`
CHECK (`20261019104604_service_handoff_signed_matching.sql:22–24`). That table
is **outside** this historical 20-table capture. It requires its own current
schema, ownership, export and erasure review.

At minimum, the following current handoff dependencies are outside the old
34-function capture and must be admitted by exact signature and source:

- `private.taxonomy_handoff_valid_v1(jsonb)`
- `private.taxonomy_handoff_display_v1(jsonb)`
- `private.taxonomy_handoff_compatible_v1(jsonb,jsonb)`
- `private.taxonomy_handoff_fit_v1(uuid,uuid)`
- `private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid)`

These five signatures were observed to exist in read-only `pg_proc` checks,
but their complete definitions and dependency coverage are **not** captured
here. The 19 October handoff migration also changes Need fact validation,
review/claim/publish and matching writers beyond this subset. The historical
builder explicitly expects 108 entries in `closure_source_digest_v5()`
(`supabase/candidates/closure-taxonomy-20261018/build.mjs:89–91`); the old
source roster contains no handoff signatures. A successful 34/20 rebase
therefore cannot prove the current **complete** source digest or its required
retention, export and erasure source rosters. The target 76→96 redaction and
52→72 export counts from the old proposal are proposed counts, not current
verified coverage.

The separate gate report records no active retention policy set/rules or
Privacy/Terms version and null export/policy bindings. A technical fix cannot
invent those approvals. There is no isolated full executor, Auth deletion,
Storage deletion, two-account export/erasure and hold proof for this current
source. No source-literal replacement or certificate hash update is prepared.

## Exact handoff to resume F01

1. Freeze feature scope and take one fresh, pinned current-source readback
   before constructing SQL: every function in the live closure source roster,
   erasure program roster, retention readiness and export projection; full
   `pg_get_functiondef`, owner, ACL, config, volatility and SECURITY DEFINER.
   Include the five handoff helpers above and **all** later altered Need,
   review, binding, matching and writer functions. Compare both certificates,
   readiness literal, program digest and `EXECUTING` count.
2. Capture all owned taxonomy/DEV copies and related Need/AI/Agreement,
   notification and Storage copies, including
   `public.need_requirement_details.handoff` and
   `private.taxonomy_confirmed_worker_modes_v1.handoff`. For each: exact table
   columns/defaults/CHECK/FK/RLS/owner/ACL, enabled trigger definitions,
   ownership key, source of late writes, data class, hold behavior,
   redaction order, and explicitly permitted export fields. Review nested
   reset payloads and historical snapshots for handoff values.
3. Build a **new** forward/rollback candidate from that entire predecessor
   with exact preflight and fail-closed drift refusal. Do not copy this subset
   into a migrations directory or patch the current digest/certificates alone.
4. Run component tests, then an isolated full current Supabase executor with
   disposable owner/peer Auth accounts, Storage objects, canaries, scoped
   holds, late-writer and idempotent replay cases. Compare actual export and
   erasure readbacks for both accounts. Only then consider separate technical
   source admission and DEV rollout using the reviewed manifest. Keep legal
   policy activation as its own owner decision.

## Local validation and scope of proof

`node supabase/candidates/closure-f01-rebase-20261021/rebase.mjs --check`
validates the **saved** catalog readback against the old 34/20 baseline and
the generated subset snapshot. It makes no network request and cannot prove
that DEV is still unchanged. `rebase.mjs` without `--check` only regenerates
the local JSON snapshot. No executable candidate, SQL builder, migration,
DEV execution, commit or push is included in this directory.
