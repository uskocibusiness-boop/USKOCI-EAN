# R06 bounded durable input contract — source-only boundary

## Current continuation — 2026-11-10

The existing opt-in Need/Worker handlers and mobile clients now have an explicit identifier-only recovery route. `CHECK_PREPARED` reads owned capability metadata without a provider call; `RESUME_PREPARED` uses the same frozen input, turn, attempt and one-time dispatch permission. Both cold journals can offer an explicit continuation without storing or reconstructing the original text. Default-off, lease, budget, erasure and unknown-dispatch boundaries remain closed. This is source/local evidence, **not DEV or production activation**.

The current native report is [r06-prepared-dispatch-native-20261110.json](r06-prepared-dispatch-native-20261110.json): 46 SQL scenarios, including witnessed concurrent dispatch, lease/price expiry while blocked and actual usage settlement under the budget lock. The exact original pricing dependency is installed in the fixture. Current DEV metadata is [r06-cold-recovery-dev-readonly-20261110.json](r06-cold-recovery-dev-readonly-20261110.json); the new RPCs are still absent. The active CODEX plan records the client/handler/CI result and remaining controlled promotion gates. Historical paragraphs below describe their dated contract, not an assertion that today's handlers have no prepared path.

## Historical contract and evidence — 2026-11-08/09

This unit implements an isolated database contract for **bounded text input** on the two existing command rows. Updated 2026-11-09: it is rebased over the canonical R10 owned-usage projection and adds an atomic prepared-dispatch wrapper. It is **not active**, is not a canonical migration or deployment package, and does not complete end-to-end Need/Worker restart. No shared Edge handler, `completeFirstPlan.ts`, frontend, budget/usage owner, lease rule or existing dispatch function was changed. No hosted mutation, model call or provider charge was performed.

## What the candidate implements

`scripts/sql/r06_pre_provider_input_20261108.sql` deliberately raises `R06_PRE_PROVIDER_SOURCE_ONLY` if executed whole. The tested slice begins at `-- R06_PRE_PROVIDER_ISOLATED_START`. It guards nine captured function bodies/privileges/owners, adds nullable fields to existing `private.ai_need_turn_commands` and `private.worker_ai_turns`, and installs three service-only RPCs plus a private helper. There is no new journal or job table.

The new fields are `prepared_input`, `prepared_input_sha256`, `prepared_at`, and `prepared_reservation_id`. The RPC input is at most 256 KiB; the complete persisted snapshot, including database-read context, is at most 512 KiB. These are limits of this inactive contract, not new limits on the currently running product.

`rpc_ai_prepare_input_service` validates the existing account/conversation/request/attempt, the command's text hash, source context/revision, closure, state and original lease. The current Need context owner supplies its authorized history/facts; the current Worker context reader supplies owned candidate/history/mode context. The snapshot binds these values to the exact supplied text provider request, model, instruction/schema/catalog digests, runtime data, turn/attempt identities and reservation ID. Provider credentials are never an input field. Photos, external file references and cache handles are outside this text shape.

The existing budget reservation RPC executes **inside the same transaction** as the snapshot update. Same-input replay retains the original reservation, snapshot, attempt and lease. A pre-existing reservation without this snapshot is conservatively refused; the contract does not infer that its provider was never called, adopt it, reset it or refund it. An already settled reservation yields `READ_ONLY` on both replay and read. Failure after reservation, including oversize assembled content or lease expiry while waiting for the budget lock, rolls the entire preparation transaction back.

`rpc_ai_read_prepared_input_service` takes account, conversation, request and purpose. It reads the persisted attempt/input rather than requiring the old process's arguments. Only the same still-valid, unexpired, undispatched command can return `PREPARED`. Changed source, cancellation, closure, expired lease, an erased snapshot or settled reservation cannot grant preparation. A dispatched command is `READ_ONLY`; provider outcome UNKNOWN remains conservative. No lease is renewed.

`rpc_ai_dispatch_prepared_input_service` closes the prepared read-to-dispatch gap for this candidate. It verifies the expected original attempt and snapshot digest, locks the existing global budget row, rechecks enabled/cap/price/account/ceiling admission, and re-reads the same unsettled reservation under that lock. It then delegates to the **unchanged original Need or Worker dispatch owner** in the same transaction. Those owners alone write the provider marker and recheck the original lease using the clock after any wait. The wrapper returns the exact snapshot only when the owner grants permission. It neither creates a reservation nor changes budget, usage, lease or marker directly. A lost acknowledgement is conservative: the next read is `READ_ONLY` and grants no second permission.

Preparation and dispatch remain separate because the committed prepared state is the recoverable point before any permission has been granted. Combining those steps would remove that pre-dispatch recovery window. **The existing dispatch functions remain callable by the old, unprepared path.** No running handler calls the new RPC, and this wrapper is not a mandatory runtime gate. Paired handler integration and removal of any bypass from the selected recovery path still require acceptance before promotion.

## Export and erasure

The current `private.data_export_snapshot` and `private.data_export_dataset_catalog` are patched explicitly: existing `taskAiTurns` and `workerAiTurns` datasets gain `preparedInput` and `preparedAt`. Filtering stays on the command's account. No new export dataset is introduced. The fixture now installs the exact canonical R10 work-area adapter/projector and executes the **entire guarded** `20261108225909_r10_owned_usage_projection_post_r09_20261108.sql` migration before R06. Its original pre/post body, authority and combined projection digest checks pass. The obsolete R06 pins were first reproduced as `R06_INPUT_PREIMAGE_DRIFT`; the candidate now pins the actual R10 postimage instead of accepting either old or new bodies. All 73 datasets and pre-existing fields, owned usage join and decimal-text audio bytes are checked after composition.

The captured `private.closure_redaction_patch_v5` clears the snapshot and content-derived digest after its existing active-retention-hold fence. It retains the opaque reservation ID, preparation timestamp, original command/attempt identity and provider marker. The new shape constraint admits that erased representation. An undispatched erased record reads `ERASED` and cannot repopulate its input or acquire a second reservation. An already dispatched erased record remains `READ_ONLY`.

The change necessarily alters computed export/source/schema digests. It does not rewrite a readiness pin, legal policy, certificate or retention duration to green. Current retention/export readiness was already incomplete; private projection tests do not certify the public export service or the complete closure worker. The 8 MiB complete export artifact cap remains a separate capacity boundary for accounts with many snapshots.

## Proven source/runtime blockers

The actual Need handler accepts up to 7,000,000 base64 photo characters held in request RAM. Its current claim hashes text or the fixed photo placeholder, not immutable photo bytes. No verified owned media reference with content identity and retention is supplied by that request. Reconstructing a photo from the placeholder would invent input, and copying accepted photo payloads wholesale into this bounded text contract would break its stated limit and could exceed the existing export artifact cap. Existing photo input is therefore untouched, and no full photo restart is claimed.

Need currently writes its dispatch marker before catalog/body construction. Worker builds its body first, but stores none of it. Repeated existing claims return status, while budget replay is refused. Merely adding this snapshot API cannot change either handler's actual recovery flow. Their future paired integration must move preparation to the correct point, bind every real input (including media/location, current catalog and runtime decoder), reconstruct processing inputs on same-key resume, and keep one provider invocation. `completeFirstPlan.ts` remains the post-response completion/readback owner.

Known usage settlement and its failure windows are unchanged. The fixture verifies that this input addition leaves current usage/dispatch/budget function bodies and metadata intact; it does not claim new durable provider receipts or reduced billing.

## Evidence and reproduction

The 2026-11-09 report is [r06-pre-provider-input-pglite-20261109.json](r06-pre-provider-input-pglite-20261109.json): **32/32 PASS** (31 scenarios plus parent), completed at **11:44:40 UTC**, candidate SHA-256 `2c69a73d5eeaddc5ce6f6be1ecaf88ce170aa548b922c1c360a6ad94eba15628`. It pins the candidate, fixture, tests, both child-process runners, original captures and canonical R10 dependencies. New file-backed PGlite cases use separate operating-system processes with default durable synchronization: the first acknowledges preparation and exits with code 73 without closing the database; another receives only account/conversation/request IDs and reconstructs the input. A second branch exits with code 74 immediately after dispatch acknowledgement and before the synthetic send. Both branches retain one reservation; the latter remains `READ_ONLY` with zero synthetic sends on retry. No HTTP/provider call exists in either runner. File-backed PGlite process loss proves persisted SQL state across these exits; it does **not** prove native PostgreSQL concurrency, host crash/fsync behavior or deployed Edge restart.

Additional new cases cover exact attempt/digest dispatch binding, settled reservation after read, later enabled/cap/price/allowlist/Auth/ceiling revocation, absent/erased/expired/stale input and one-time permission for both owners. Anonymous/authenticated callers cannot execute any of the three new RPCs. Existing dispatch/reservation/usage bodies and metadata remain byte-identical.

Adjacent regression on the same source: **114/114 PASS**, `node --test scripts/r06-first-plan-replay.test.cjs scripts/r06-provider-dispatch-retention.test.cjs scripts/r06-budget-accounting.test.cjs scripts/r06-reconciliation-qa-usage.test.cjs scripts/r10-work-areas-projection.test.cjs`. No skipped cases. This remains local synthetic SQL/handler evidence; it does not extend the R06 runtime or provider scope.

Native PostgreSQL was not available for the 2026-11-09 continuation and was not installed. The earlier native report below is historical evidence for its earlier candidate hash, **not** validation of this revised wrapper. The native process runner now uses the wrapper; current native held-lock/settlement/price/lease/concurrent-dispatch acceptance remains required before promotion.

Historical verification at **2026-11-08 22:58:50 UTC**: **PGlite 21/21 PASS** (20 scenario cases plus the parent test), **native PostgreSQL 25/25 PASS** (24 scenario cases plus the parent test), with zero failed/skipped cases. Those runs took approximately 6.7 and 6.5 seconds. That candidate source SHA-256 was `bbf3aff6c268136c4a01ecfb07826b7b467f6dcc227b5f27748fe43db9a72a12`. Both reports pin the fixture, test, child-process runner and schema captures too. The native fixture was stopped after completion.

An independent R13 reviewer separately reproduced both held-budget-lock/expired-lease cases on isolated port 55436 against the same candidate hash: each produced SQLSTATE 55000 / `R06_INPUT_LEASE_EXPIRED`, with no snapshot, reservation or reserved-counter increment. Its privacy review found the existing hold fence, account filter and erased representation intact. This independent review does not extend the scope into active runtime recovery.

`r06-pre-provider-input-pglite-20261108.json` and `r06-pre-provider-input-native-20261108.json` record each tested scenario and the exact candidate hash. The native mode uses real isolated PostgreSQL connections and separate Node processes. One process commits preparation and exits with code 73; another starts with only account/conversation/request IDs, reads the persisted provider request and attempt, and invokes the existing atomic SQL dispatch owner. A third process cannot obtain another permission. The fixture's provider-send row is a synthetic invocation decision, not an external provider request or bill.

The held-budget-lock case waits until `pg_blocking_pids` proves the writer is blocked and the original lease has actually expired. Releasing the lock must produce `R06_INPUT_LEASE_EXPIRED`, with no snapshot, reservation or budget-counter increment. No arbitrary lease extension or timing-only sleep stands in for the observed lock.

Other cases cover immutable replay, wrong account/attempt, settled reservation, malformed role/catalog/cost controls, oversize post-reservation atomic rollback, no legacy reservation adoption, changed source/cancellation/closure, export ownership, held redaction and undispatched tombstones for both owners.

```sh
node --test scripts/r06-pre-provider-input.test.cjs
```

Native proof requires the existing local runtime variables and a free isolated port:

```sh
USKOCI_R06_NATIVE=1 \
USKOCI_POSTGRES_ROOT=/workspace/scratch/792f3e12eb9e/pg-runtime/root \
USKOCI_PG_MODULE=/workspace/scratch/792f3e12eb9e/pg-runtime/node/node_modules/pg \
node --test scripts/r06-pre-provider-input.test.cjs
```

Optional `USKOCI_R06_PROOF` names the output JSON report. The default mode proves SQL semantics; only native mode proves separate processes and lock waits. The default fixture port is 55434, with the launcher's existing optional port override.

## Fixture limits

The fixture uses captured real Need context, both dispatch functions, budget reserve/usage definitions and export/closure projection owners. Worker profile hashing, document assembly and service-mode assembly have three explicitly named narrow SQL seams; the current Worker read-context and dispatch bodies execute unchanged. This does not claim complete Worker profile-source projection parity. Synthetic schema/data omit external lifecycle/FK/wake behavior and real Auth sessions. No live customer row is copied.

The preimage and budget-schema captures contain current function/schema metadata, not credentials or customer data. Existing source handlers and production registration remain unchanged. This artifact is a concrete continuation point for implementation and review, not a deployment package or a completed AI-runtime recovery claim.
