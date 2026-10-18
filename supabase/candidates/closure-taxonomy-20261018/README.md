# F01 taxonomy and DEV-copy closure extension

Candidate work only. No DEV application, certificate admission or account deletion has occurred.

## Scope and predecessor

Extend the existing AF-D22 executor, not a second erasure system. The 18 October read-only observation has 76 redaction relations, 52 export datasets (`OWN_ACCOUNT_V5_10`) and 108 source signatures. Both certificates pin `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`; the observed source is `88cab17911f89a7d8d800ae229db568dd2aaed106395ad8acc3207917acd72ec`. Original AI shape/trigger readiness checks pass independently; the source pin is stale. Rebinding it alone would omit personal copies.

The package covers 13 taxonomy-owned tables and seven existing DEV snapshot/backup tables. It preserves shared category/alias records, existing account ownership, scoped holds, the 100-row executor batch and generation/action/attempt identity. It introduces no retention period, provider call, schema migration history entry, manual profile form or new account role.

## Exact replacement seams

- `private.closure_redaction_relations_v5()` — prepend the admitted dependent copies in FK-safe order.
- `private.closure_redaction_scope_v5(text)` — direct account ownership and original/snapshot Need ownership.
- `private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)` — hold-aware copy deletion and terminal queue receipts, retaining the existing patch certificate.
- `private.data_export_dataset_catalog()` and `private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)` — explicit owned projections; no raw JSON dump or lease credentials.
- `private.data_export_policy_binding()` and `private.data_export_projection_sha_v5()` — admit the reviewed 72-dataset `OWN_ACCOUNT_V5_11` projection and include its helper bodies in the projection digest. No policy row is created or changed.
- `private.closure_source_digest_v5()` and `private.closure_erasure_program_digest_v5()` — include the new helpers and the affected exact writers.
- Taxonomy service claim/commit/bind/finalize/reconcile writers — shared closure-account lock before row locks; no new work for a closing account. Existing `private.closure_guard_owned_write()` supports ACCOUNT/NEED ownership and certified erasure and is reused.

The production candidate must leave both certificates and the readiness literal untouched. A separate exact-source admission follows an actual isolated execution and reviewed DEV readback; it must not accept an arbitrary current hash.

## Dependency and proof boundaries

The full candidate depends on the exact current function bodies, table CHECK/FK shapes, installed taxonomy writers and all seven DEV copies. It must refuse an unknown predecessor. The closure test infrastructure has historical predecessor-specific setup; the historical 145/146 or 99/108 proof is not evidence for this extension. Reuse its real executor/Auth/Storage machinery and canary helpers while explicitly assembling and checking the current predecessor.

Required focused evidence: owner export without peer rows; ordinary copied content removed; shared catalog unchanged; held conversation copies retained with no false CLOSED; stale claimed lease cannot recreate data; account-lock race; drift/ACL/unknown-predecessor refusals; actual Auth/Storage completion on a disposable current source. A PostgreSQL-only component proof must be labelled as such and cannot substitute for full Auth/Storage execution.

Open before promotion: full exact-source fixture availability and restore identity translation; scope/hold behavior across removed historical Need rows; minimum metadata retained for replay and global taxonomy audit references; account closure recovery on a second device remains a separate existing N10 item.

## Implemented candidate and executable component proof

`build.mjs` produces `candidate.sql` and `manifest.generated.json` from the exact 34 captured function definitions and 20 table shapes in `predecessor.json`. It changes 24 existing functions, adds 14 private helpers and 40 table guards, expands the redaction roster 76→96 and includes the affected taxonomy triggers/writers in the source/program rosters. Production preflight refuses body/ACL/config drift, column/default/constraint/trigger drift, active closure execution, duplicate installation, missing data classes and conflicting current/archive Need ownership. Existing owner identities, certificate enforcement and retention periods are preserved.

`proof.py` executes that exact candidate in a **disposable loopback PostgreSQL database named `f01_component`**. It reproduces captured CHECK/FK constraints and function bodies/ACLs; supporting Auth, closure context and public tables are narrow disclosed doubles. It exercises actual owned exports and row patches, scoped holds, peer/canary separation, archived Need fallback, queue terminalization, late writes, immutable ownership, positive/negative lease claims and an exclusive account-lock race. Preflight negative controls execute the production refusal paths and roll back. The proof does not invoke Gemini, Supabase DEV, Auth admin deletion or Storage deletion.

Some unexecuted full-stack dependencies are intentionally absent; `check_function_bodies=off` is used only while assembling the component fixture and installing into that fixture. **It is not present in the production candidate.** This proof cannot certify the full executor, full exporter snapshot, Auth/Storage consumers, all live triggers or a closure certificate.

Run source generation consistency:

```sh
node supabase/candidates/closure-taxonomy-20261018/build.mjs --check
```

Run the isolated runtime proof with PostgreSQL/PostGIS available and `PGHOST=127.0.0.1`, `PGDATABASE=f01_component`, matching disposable credentials:

```sh
python3 supabase/candidates/closure-taxonomy-20261018/proof.py
```

The new `closure-taxonomy-component-proof.yml` workflow provisions an empty database from `template0` on the repository's existing `postgis/postgis:16-3.5` image. Only sanitized proof metadata is uploaded. Generated local fixtures, bytecode and reports are ignored.

## Observed dependencies that this package does not silently bypass

- The read-only capture found **zero active retention policy sets** and a null export-policy binding before this work. An owner-admitted policy with existing agreed periods, privacy-document binding and all 72 dataset decisions is required before export activation. This package invents none of those decisions.
- All 112 archived Needs currently lack a live Need row; no current/archive ownership conflicts were found. Indirect archived dispatch therefore resolves through the retained Need snapshot, which is erased last. The component proof includes this concrete orphan case.
- Reset payload export uses named sections and field allowlists, filters explicit foreign embedded account IDs, and projects review/session candidates through the existing exporter. Historical sections lacking embedded owner IDs still rely on the outer snapshot ownership and need full-source fixture validation before promotion.
- Archived portfolio values are projected through the existing scalar-string array exporter, including portfolios inside reset payloads. Arbitrary object fields are not dumped. Any future structured portfolio format needs an explicit admitted projection; its format is not guessed here.
- Shared taxonomy and aliases survive. Tombstones keep owner/request/review IDs and bounded lifecycle metadata; global taxonomy audit references remain as before. Their policy/retention treatment requires admission, not an invented new period.
- The concurrently delivered `rpc_read_worker_ai_context_service` / service-mode reader is neither captured nor replaced here. Any final certificate must recapture the then-current complete source; this earlier observation is not a post-delivery certificate.

Local validation at handoff: deterministic generation check, Python AST, and PostgreSQL SQL parser checks pass. **Runtime PostgreSQL and full Auth/Storage proof remain pending CI / disposable full-stack execution. Nothing in this directory has been applied to DEV.**
