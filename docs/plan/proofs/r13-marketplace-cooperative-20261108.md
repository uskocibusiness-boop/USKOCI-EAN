# R13 marketplace cooperative source proof — 2026-11-08

## Result and scope

The new **source-only** procedure preserves the existing six marketplace phases and their arguments, while committing between phases. Dispatch retains its separate per-profile and per-Need commits. No hosted procedure, migration, Cron command, user data, push transport, Storage object or paid provider operation was changed by this work.

- Wiring/recovery suite: **5/5 PASS**, PGlite.
- Captured-owner integration: **4/4 PASS**, isolated native PostgreSQL 17.11 / PostGIS 3.5.2.
- Native evidence: [r13-marketplace-native-20261108.json](r13-marketplace-native-20261108.json).
- Native source base: a9d77308f2bd471348384710e89cf5bcba2cfcf3. The proof records SHA-256 hashes of the candidate, dispatch candidate, preimage, fixture, harness and F20 overlay. The base identifies the checkout; the hashes identify the then-uncommitted source tested.

This closes the previous **omitted maintenance phase wiring** gap at the isolated source boundary. It does **not** close the remaining internally unbounded maintenance, full hosted trigger/security graph, diagnostic result or Cron promotion gates.

## Preserved phase and argument contracts

| Order | Existing owner called by the candidate | Preserved limit / time contract | Transaction boundary |
|---|---|---|---|
| 1 | private.expire_lifecycle(p_at) | Exact supplied p_at; expiry and urgent work have no row cap | One phase transaction |
| 2 | CALL private.dispatch_cooperative_candidate(p_batch,p_at) | Dispatch accepts 1–200, otherwise defaults to 25; existing dispatch time budget/counters remain inside dispatch | One profile/cursor per commit, then one Need per commit |
| 3 | public.rpc_tick_auto_completion() | Independent limit 100; owner uses its own statement time | One completion batch transaction |
| 4 | private.data_export_maintenance(p_batch) | Raw batch forwarded; owner clamps to 1–100, NULL defaults to 25; clock-based expiry unchanged | One export batch transaction |
| 5 | private.retention_maintenance(p_batch) | Raw batch forwarded; owner clamps to 1–25, NULL defaults to 25 | One retention batch transaction |
| 6 | private.ai_turn_sweep_v5(p_at) | Same p_at; three command updates remain bulk; publication review limit 100 | One AI sweep transaction |

The outer procedure does not normalize p_batch: input 201 means dispatch 25, export 100 and retention 25. Its result is procedure completion, not the JSON returned by the current private function. The active function and caller remain unchanged.

Both cooperative procedures are SECURITY INVOKER, have no procedure-level SET clause, require current_user = postgres, and revoke execute from PUBLIC, anon, authenticated and service_role. Each phase sets transaction-local search_path = pg_catalog; function calls are qualified. The complete candidate raises R13_MARKETPLACE_COOPERATIVE_SOURCE_ONLY before DDL. Tests deliberately extract the marked isolated section.

## Native non-idle evidence

The fixture uses the captured R09 matcher/activation/emitter graph and current F20 overlay. Its admission body is asserted to equal MD5 34dcf47d654d5960fbf7254c28745a04. The 22 maintenance/guard/dependency bodies are loaded unchanged from the read-only capture, with their captured role grants and body hashes.

The fixture uses 20 supplemental current relation definitions and their NOT NULL/default/identity/PK/UNIQUE/CHECK constraints. It captures and enforces the standalone active-policy, open-export-request and export-replay indexes. All export artifacts share one explicitly synthetic policy with NULL retention execution; a second active policy is rejected by the actual retention_policy_one_active_uq index. No valid legal execution certificate is fabricated.

Ten selected actual lifecycle/timestamp triggers are installed: Need write, urgent, enqueue, revision and timestamp; response remaining-search and timestamp; agreement, execution and selection timestamp. Actual maintenance exercises the Need, response, agreement and execution update paths. Selections are seeded before trigger installation and are not updated in these scenarios.

### Late failure and retry

One cycle starts with an expiring Need and response, a dispatchable Need, an agreement awaiting automatic completion, an expired export artifact, stale and fresh AI commands, an expired publication review and an abandoned conversation.

A fixture-only export trigger raises an error during the real export owner. The resulting state proves:

- Need/response/opportunity expiry and queue removal committed.
- The current F20 matcher produced the new dispatch opportunity in a separate transaction.
- Agreement execution, agreement, Need completion and the worker event committed in a third transaction.
- The export snapshot purge rolled back together with the failing export request update.
- AI work did not run after that exception.

After removing the injected failure, a normal call expires the export, clears its snapshot and download grant, writes exactly one audit event, and processes stale AI records. Need and Worker commands become FAILED; QA becomes CANCELLED; review becomes EVALUATED with EVALUATOR_UNAVAILABLE. Three fresh leases remain PROCESSING, and provider-dispatched flags remain true. No request is retried or refunded.

Actual effect probes show ordered expiry, dispatch, completion, export and AI effects with five distinct transaction IDs. Retention makes no mutation because its real owner returns NOT_READY / POLICY_NOT_READY; the abandoned conversation remains present. The separate wiring test observes all six call boundaries, including retention.

A further normal call leaves the business snapshot identical and the completion event count at one.

### Differing caps and state fences

- Export input 0 processes one of 101 requests; input 201 processes the remaining 100.
- An expired snapshot with an active unverified lease remains present; after verification the actual owner clears it. Storage deletion remains false.
- AI publication review processes 100 of 101 expired attempts, then the remaining one, with no reported errors.
- With outer wrapper batch 1, 101 eligible agreements complete as 100 then one on the next call. The first 100 share one completion transaction; the remaining one commits in another. Exactly 101 worker completion events exist.
- A native explicit outer transaction rejects internal COMMIT with SQLSTATE 2D000; provisional expiry rolls back.
- All application roles lack execution privilege, and the whole-file sentinel rejects application.

## Precise remaining gates

1. **Internal work bounds:** expiry/urgent owners and three AI command updates are still bulk operations. Separating phases is not a total latency bound and does not make a large phase cooperative.
2. **Full trigger/dependency parity:** the fixture omits foreign keys and external closure, safety, group/calendar, connection activation and invalidation triggers. Their exact non-idle behavior across committed phases is not established here. This is a defined proof boundary, not evidence that these paths are impossible.
3. **Positive retention execution:** the actual closed policy gate is tested; deletion under an approved policy and exact source/closure digest remains outside this unit. Current legal/policy readiness is not bypassed.
4. **Diagnostic result contract:** current marketplace_tick returns the six owners' results, including AI errors and retention NOT_READY/code. This void candidate discards them. Preserve them or deliberately define their operational replacement before claiming complete marketplace parity. The existing function remains intact.
5. **Hosted scheduler acceptance:** native PG 17.11 differs from the hosted minor version. Hosted owner/ACL/role/settings, direct top-level CALL, scheduler connection behavior, failure/restart overlap and controlled Cron change/readback remain unexecuted.
6. **Fleet/runtime acceptance:** local transaction/ledger evidence does not establish hosted throughput, a fleet-global quota, 300,000-user capacity, push delivery or Android behavior.

Current Cron remains **select private.marketplace_tick(25);**. Keep both source-only sentinels until remaining source and hosted acceptance is complete.

Independent read-only review found no blocking wrapper role/SET/transaction/order/batch defect. It confirmed completion establishes its own COMPLETE lifecycle token after expiry's prior COMMIT, and identified the diagnostic-result difference above.

## Reproduction

From the repository:

~~~sh
node --test scripts/r13-marketplace-cooperative.test.cjs

USKOCI_POSTGRES_ROOT=/workspace/scratch/792f3e12eb9e/pg-runtime/root \
USKOCI_PG_MODULE=/workspace/scratch/792f3e12eb9e/pg-runtime/node/node_modules/pg \
USKOCI_PG_FIXTURE_PORT=55435 \
node scripts/r13-marketplace-native.cjs
~~~

The launcher creates a fresh isolated database directory and checks its identity before clients connect or cleanup stops it. Port 55435 avoids the independent F20 fixture. Pass another output path to record a rerun without replacing the dated proof.

