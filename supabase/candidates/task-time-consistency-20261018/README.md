# Task time consistency — forward candidate, 2026-10-18

## Finding and current evidence

The current DEV functions `rpc_submit_response`, `rpc_select_response` and KEEP/UPDATE in `rpc_resolve_stale_response_after_need_edit` reject an expired `response_deadline`, but omit the generic completion deadline `ends_at`. Start-only FIXED_WINDOW has a separate guard.

The current `private.need_search_time_admitted_v1` already rejects expired completion deadlines, including FLEXIBLE and REMOTE_ANYTIME. The actual manual match wrapper treats worker time fit as a dispatch soft blocker, not a manual application blocker. Both candidate-state readers also omit generic completion expiry. Thus a task with an elapsed completion deadline and no application deadline can still accept a new application and selection before this candidate.

No invalid user command was run on DEV. Read-only current counts: 6 open tasks; 0 open tasks with expired explicit completion and no application deadline; 0 such FLEXIBLE/REMOTE_ANYTIME tasks; 0 expired explicit-completion tasks with a selected agreement. This is an executed-source defect, not a claim that current user data contains a proven invalid agreement.

The executable disposable baseline invokes the captured actual public RPC bodies, actual manual wrapper and calendar wrapper, existing time admission helper and actual price/slot rules. PASS in assert-before.sql means reproducing the old bug, not success of the repaired behavior.

## Exact bounded change: five functions

1. public.rpc_submit_response — new temporal admission after Need lock, own-need and application-deadline guards; committed replay remains earlier.
2. public.rpc_select_response — new temporal admission after lock and existing application-deadline guard; committed and legacy agreement replay remain earlier.
3. public.rpc_resolve_stale_response_after_need_edit — same gate only for KEEP/UPDATE; WITHDRAW and committed replay remain independent.
4. private.need_candidate_states_v5(uuid).
5. private.need_candidate_states_v5(uuid,uuid[]).

The candidate readers classify new unselected expired applications as CLOSED. Their first SELECTED/has_agreement branch remains unchanged, so an already agreed task is not retroactively cancelled.

New deterministic failure: `NEED_EXECUTION_WINDOW_EXPIRED`, SQLSTATE `PT409`. Root owns the companion client error mapping. Existing application-deadline reasons and existing guards retain their meanings. The new RPC checks use `clock_timestamp()` after acquiring the Need row lock, so an old statement timestamp cannot admit a command that waited beyond the task deadline.

Exact predecessor definitions and restrictive ACLs are in before.sql. Manifest distinguishes MD5 of pg_get_functiondef from MD5 of prosrc. candidate.sql is one transaction with predecessor pins, unchanged helper pin and bounded timeouts. revert.sql restores all five captured bodies in one transaction and refuses unexpected current candidate body hashes. CREATE OR REPLACE retains ownership, grants and security/search_path attributes.

No new helper, table, column, recurring schedule field, lifecycle sweep, data repair, event, push send or paid AI call is introduced by deployment.

## Real field semantics

- The Work report's FLEXIBLE_WITH_DEADLINE is a product description, not a supported server enum. Existing server representation is FLEXIBLE plus ends_at.
- applicationsDeadline corresponds to response_deadline, separate from ends_at.
- REMOTE_ANYTIME/FLEXIBLE without end stays unbounded; a non-fixed start alone is not an invented finish.
- FIXED_WINDOW with only starts_at ends new admission at that exact instant. It never fabricates an agreement duration.
- An explicit future ends_at overrides a relative publication-period end in the existing shared helper.
- Both remaining slots and existing confirmed agreements are preserved. A deadline closes new admission, not execution/communication of already agreed work.

## Disposable proof boundary

Run only against a new disposable PostgreSQL 16 or 17 database. Never run fixture/assertion files on DEV.

The fixture uses captured column types/defaults for 18 tables (unrelated geographies, production constraints/triggers and RLS are outside this scoped proof). It executes captured functions for all five targets and 10 real dependencies: source time boundary and relative time zone logic; actual manual eligibility and calendar wrappers; price, slot count, world comparison, exclusion helpers.

Explicit fixture boundaries:
- worker_need_fit_v1 provides deterministic service/area/time inputs; expired time is a NULL tier from the actual shared time helper. The real manual wrapper still decides that these are soft gates. Full taxonomy/area matching remains covered by the already separate captured matcher proof.
- Synthetic world lookup and calendar intervals isolate unrelated account registry and calendar storage.
- Event recording stores only synthetic event identifiers; dispatch enqueue and audit are inert. This proof does not claim real notification delivery or Auth/RLS acceptance.
- Actual application, response version, snapshot, selection, agreement, agreement-version, execution, connection activation and idempotency writes execute in the disposable tables.

Scenarios:
- FLEXIBLE / REMOTE_ANYTIME / WEEK_FLEXIBLE future and expired completion deadlines;
- no application deadline, independent expired application deadline, and application deadline later than an already expired completion;
- exact deadline boundary, unbounded remote/flexible, non-fixed start-only and fixed exact start without finish;
- actual first selection, partial slots, second pending application, then expiry: new work rejected while original agreement/terms/selected slots remain byte-equivalent;
- both candidate readers preserve SELECTED while closing pending candidates;
- submit/select/KEEP/WITHDRAW idempotent replay after expiry;
- KEEP and UPDATE rejected after expiry while WITHDRAW remains available;
- explicit future completion overriding an older publication week;
- a real two-connection lock wait: statement starts before completion deadline, Need lock releases after it, new application fails PT409 and writes nothing;
- exact rollback, bug reproduced again, reapplication, source and ACL assertions.

CI workflow: .github/workflows/task-time-consistency-pg-proof.yml.

Order:
1. node --test source.test.mjs from repository root (use the full repository-relative path).
2. fixture.sql → assert-before.sql.
3. candidate.sql → assert.sql → bash lock-wait-proof.sh.
4. revert.sql → assert-before.sql → candidate.sql → assert.sql → assert-metadata.sql.

Local source checks passed 3/3. No local PostgreSQL is available; CI PostgreSQL execution is pending at handoff.

## Remaining boundaries and deployment receipt

This package does not rewrite existing expire_lifecycle. That older scheduled cleanup still lacks generic FLEXIBLE/REMOTE completion expiry and derives some relative cleanup from publication alone. The new request-time gate prevents the reproduced new admission bug without auto-expiring tasks that already have agreements. A later lifecycle cleanup should use the same boundary while separately preserving agreed work; it must not be slipped into this five-function patch.

The general task-detail manual-match projection may still show an application action until the write RPC rereads the task. The candidate-selection readers are updated here; Root owns client handling of the new conflict. This is not a claim that every Discovery surface is redesigned.

All five targets are ordinary non-trigger functions and absent from the current closure source/program literal rosters. No table/trigger/policy/publication metadata changes here, so direct closure digest impact is expected to be zero. Root must compare actual pre/post digests and ACLs; do not rebind the preexisting closure certificate mismatch.

Root is the sole live writer/committer. Before apply: CI PASS on both PostgreSQL versions, exact predecessor and helper MD5/ACL checks, capture current digests. After apply: exact five-function readback/ACL, existing task/agreement counts and unchanged closure digests. No replay of old UNKNOWN provider or push outcomes is involved.

