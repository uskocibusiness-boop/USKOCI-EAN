# Local reliability candidate — 18.10.2026.

**SUPERSEDED: historical initial candidate, not an install entry point.** Later owner authorization allowed DEV application. The first forward exposed a real invoker column-grant regression, recovered by `20261018201253`, then fixed by `20261018201517` with `invoker-fix.cjs`. Do not apply the original `forward.sql` or `revert.sql` to current DEV. See `docs/current/DEV_RELIABILITY_APPLICATION_20261018.md` for the exact sequence and current proof. `taxonomy-proof.cjs` now executes real service bodies; `invoker-fix-proof.cjs` reproduces the missed column-grant boundary. The initial local status and limits below remain historical evidence.

**NOT APPLIED. Do not publish this client before the matching SQL is applied and verified.** The owner approved a local first package only. No live migration, Edge deploy, Git push, OTA, APK build or installation was performed here.

## Exact scope

- Three taxonomy service functions: one deterministic stale-catalog raise each changes from `40001` to `PT409`. Messages, decisions, locks and business writes are unchanged. Actual engine serialization errors are not intercepted.
- Existing `rpc_list_open_tasks_v3`: one exclusive `homePreview: true` filter mode. Requires authentication, limit 3, no bbox, cursor or other filters. Excludes the current requester, full tasks and expired application deadlines **before** limiting. Ordinary discovery/map and exact-ID modes retain their existing semantics.
- No new RPC, private field, table, index, policy or grant. The public function remains SECURITY INVOKER with the same RLS/grants; taxonomy remains service-only SECURITY DEFINER.

`before.json` captures four schema definitions/metadata through a read-only canonical DEV catalog query during this package, not business data. `package.cjs` is a pure generator: four fixed body hashes, unique replacement sites, reversible transformations. `forward.sql` and `revert.sql` are checked against that generator. Each transaction checks complete `pg_proc` metadata/owner/ACL/config/comment preservation and an unchanged closure digest. Drift or repeat application refuses atomically. There is deliberately no relaxed bypass.

## Local proof and limits

`supabase/proofs/home-read-reliability-20261018/local-proof.cjs` executes the real captured public reader body against a disposable PostgreSQL/PGlite fixture. It checks filtering before limit, privacy allowlisting, invoker/RLS behavior, auth, invalid inputs, unchanged ordinary/exact/cursor/bbox fixtures, metadata, atomic drift refusal and byte-exact revert.

Taxonomy dependency schemas are **not** replayed. Their real source is patched and compared byte-for-byte, and their extracted raises execute before/after as `40001`/`PT409`; this is not a successful real taxonomy admission/binding test. Closure is a local stub, not the canonical closure certificate. Geography is a box-backed stand-in, not PostGIS; no spatial performance/correctness or whole migration-chain/PostgREST HTTP proof is claimed.

Reproduce without changing application dependencies:

```sh
proof_dir=$(mktemp -d /tmp/uskoci-sql-proof-XXXXXX)
npm install --prefix "$proof_dir" --no-audit --no-fund @electric-sql/pglite@0.5.10
PGLITE_MODULE="$proof_dir/node_modules/@electric-sql/pglite" node --test supabase/proofs/home-read-reliability-20261018/local-proof.cjs
```

## Handoff before any release

1. Re-read current canonical function bodies and metadata; never weaken preimage guards to fit drift. Rebase/regenerate and repeat checks if another agent changed these targets.
2. Replay/prove against the actual migration chain, real PostGIS/RLS and PostgREST, including stale-catalog HTTP behavior and taxonomy recovery. Check query plan/cost with representative task counts; a three-row response is not a scan-time or device-latency benchmark.
3. Under authority for live changes, create a **new forward migration via Supabase CLI**. Do not edit applied migrations or treat this candidate folder as a migration ledger. Apply backend first; verify definitions, ACL/security/config and unchanged closure.
4. Only then deliver the corresponding client and verify Home/refresh/Back/account switch in the actual APK. This source fails the optional section visibly on the older server; it does not silently substitute the old full-list walk.
5. For rollback, restore the compatible client before `revert.sql`. The exact revert restores the undesirable old `40001` raises too; it is recovery material, not a recommendation to run them through an affected PostgREST gateway.

The broader Home core lists, matching, AI/location flows, chat, icons, motion and screen redesign are not closed by this package.
