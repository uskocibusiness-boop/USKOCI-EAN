# R07 — compatible response price-unit columns

PREPARED_NOT_APPLIED. The current mobile `readApplicationCommandState` selects
`marketplace_responses.price_basis`; DEV lacks it and returns SQLSTATE 42703.
This package adds nullable `text` columns to that table and its version table,
with `TOTAL | HOURLY` constraints. Existing NULL means the historical aggregate
application amount. No inferred backfill from the mutable task is permitted.

Only two columns and their checks are added. There is no writer, RPC, owner,
grant, RLS, trigger, index, billing, row, certificate or readiness update. Current
writers explicitly name their columns and can continue omitting the new unit.
The live price validator still rejects HOURLY with UNKNOWN_PRICE_BASIS. This
does NOT ship hourly applications, hourly Agreements or the old full R07b SQL.

## Proof and promotion boundary

- Current DEV table metadata and 48 referring/dependent function definition
  hashes are pinned in preimage.json. Capture contains no business row content.
- Seven isolated PostgreSQL checks exercise the generated guarded transaction:
  missing-column reproduction, legacy rows/hashes/inserts, constrained units,
  row access, no client UPDATE, idempotent apply, guarded rollback/reapply and
  drift rejection. Auth and closed-account context are explicit fixtures;
  hosted Auth, requester/participant policies and two-user E2E are NOT proven.
- Existing mobile command-state and interval readers: 2 suites / 51 PASS.
- Full CI on the finished source and fresh DEV preflight are required before
  promotion. The exact source/CI/apply receipt goes in the existing ledger.

Commands:

    node --test supabase/proofs/ai/r07_response_price_schema.test.mjs
    node supabase/operations/dev-alpha/r07-response-price-schema-20261102/build.mjs --check

The schema and therefore closure-source digests intentionally change. The
forecast runs READ ONLY under the existing digest function's `pg_catalog`
search_path; isolated real DDL is compared with that forecast. The generated
postflight pins the exact expected hashes. The existing certificate stays
unchanged, source_ready stays false, both bindings stay NULL. This does not
re-certify R10 or waive R01; public launch remains blocked by their open work.

Locks use 5-second lock / 30-second statement timeouts. Both ALTERs and all
postconditions commit together; PostgREST receives a schema-cache notification.
Rollback requires the exact postimage and NULL units in BOTH tables. It uses
DROP RESTRICT and refuses to erase any recorded unit or unexpected dependency.
Do not execute rollback after a later hourly writer rollout without a new plan.

After promotion, verify both zero-row selects through SQL and real end-user
HTTP, then the ordinary application readback. An empty HTTP result proves
column availability and permissions only, not a successful two-party job.

The old LOCAL_ONLY hourly candidate must be rebased separately against these
columns, current R08 REMOTE eligibility, current R07 lifecycle readers and the
prepared R06 edit-resume fix. Its stale function pins must not be merely updated.
