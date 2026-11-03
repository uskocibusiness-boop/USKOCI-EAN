# R03 own-task page: controlled DEV reader correction

The installed Android flow expects five scopes, first-page counts and canonical
`rpc_read_task` documents. The captured pre-application DEV page body `dad1de...`
returned three scopes and camelCase documents without counts. The real current
client service reproduces `OWN_TASKS_PAGE_INVALID` for both empty and nonempty
replies against that historical body. Its
ordinary whole-list reader succeeds against the same synthetic data. This is a
server contract mismatch; a connection failure is not established.

This package changes only `public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)`
to the existing frozen R03 body `509d6c345c84cc6a597bde46d9ae6b75`. The already
installed `private.own_task_counts(uuid)` is reused unchanged. It creates no
application table/function, changes no owner, grants, RLS or business data, and
does not apply the historical EX04A helper creation. The original LOCAL_ONLY
candidate and its broader rollout guard remain unchanged.

## Why the existing R10 failure is not silently bypassed

The fresh 17:15:38 UTC read-only capture pins all 14 relevant reader/dependency
and closure function definitions and attributes. This page reader is absent from
both exact source and erasure function rosters; its replacement adds no columns,
tables, triggers or ACL delta. Every forward/rollback requires the complete
captured schema/source/erasure digest, certificate, readiness and export/erasure
binding values to remain exactly unchanged before and after the operation.
`source_ready=false` and both NULL bindings must therefore stay false/NULL.
A hidden dependency that changes any digest aborts the entire transaction.

R10 still blocks export/erasure activation and release admission. It would also
block this operation if it changed the captured source/schema/erasure contract.
This bounded reader correction does not recertify anything or reinterpret an
unready export/closure pipeline as ready. The full-function catalog comparison
allows only this one body change; all helper bodies and privileges are preserved.

## Review and execution

1. Run `node --test supabase/operations/dev-alpha/r03-owner-page-20261101/package.test.mjs`
   and `node supabase/operations/dev-alpha/r03-owner-page-20261101/build.mjs --check`.
2. Review `manifest.json`, current capture, exact forward/inverse and this scope.
   Use `preflight.sql` read-only on canonical DEV. Root owns the decision and
   controlled `apply_migration` invocation with exact `promotion.sql` bytes.
   The target GUC is only intent; connector project binding is mandatory.
3. The migration checks current preimages, replaces one body, runs AUTH_REQUIRED
   and exact NULL-owner empty-projection acceptance, checks all catalog/closure
   invariants, then commits. Any failed assertion aborts DDL. No user fixture,
   Auth account, provider, push or business write is made.
4. Run `postflight.sql`, then repeat the signed-in installed Android page:
   open own tasks, switch Active/Drafts/History, inspect nonempty cards and
   details, load further pages where present, refresh and switch accounts.
   Do not collect tokens or unrelated private user data. Positive native evidence
   is tracked separately by the application receipt; the read-only postflight
   does not close this complete functional acceptance checklist.
5. If needed, use reviewed exact `rollback.sql` through the migration procedure.
   It only restores the old reader definition after exact postimage checks;
   there is no data compensation. It intentionally restores the known old
   page incompatibility, so client rollback/kill-switch may also be required.

## Evidence and limits

Six isolated tests pass. They run exact captured reader/count/helper bodies and
the real current `needClientService` (including `mapNeed`/`readPublicNeedDetail`),
`ownTasksPage` and view rules through the existing TypeScript VM loader. All five
scopes, counts, keyset ties at microsecond precision, limits 1/2/30, foreign and
empty owner lists, missing/closed/anonymous refusal, invalid input, public-only
documents, inverse rollback and reapply are exercised. Fixture substitutes are
Auth claims, closure-open state and final candidate-state rows; geographic type
is inert text, and most production constraints/triggers are absent.
The actual catalog-delta SQL also accepts the one reader body change and rejects
an unrelated helper mutation; only the DEV OID is translated to its local OID.

The full DEV migration transaction is not executed by these tests. Generated
read-only preflight has separately passed on actual DEV. The exact new page query
and current count helper are also checked read-only with SQL NULL ownership;
that proves actual PostgreSQL relation/statement compatibility only, not a
positive authenticated account flow. Actual Auth/PostgREST/native acceptance,
historical supported clients, full R01 and R10 release readiness remain separate.

Current status: **APPLIED_EXACT_OPERATION_LEDGER_BYTES** on canonical DEV as
`20261101172612_owner_task_page_contract_v1` at 2026-11-01 17:26:12 UTC. The
[application receipt](../ledger/20261101172612_owner_task_page_contract_v1.receipt.json)
records the controlled application and separate functional evidence. The frozen
manifest and generated files retain their preparation-time state.

An independent read-only ledger query at 17:28:56.760969 UTC confirmed one
statement, 35,453 UTF-8 bytes, MD5 `8374604d7d932fd68c0e1fc3faadba45` and SHA-256
`b10e5c3532378b340d83e9c19b54ac6765c2f5641e9f2f18f296e7c60f16cc24`, matching both
the reviewed promotion and archived ledger SQL. Running the exact frozen
`postflight.sql` independently returned `R03_DEV_POSTIMAGE_MATCH`: all 14 pinned
function definitions and attributes match, with closure readiness and bindings
unchanged. Its `authenticated_positive_functional_acceptance=false` limits this
result to catalog/contract verification. It is not a native E2E, R01 parity, R10
readiness or production admission result.
