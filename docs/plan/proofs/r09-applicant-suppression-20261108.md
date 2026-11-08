# R09 / F20 applicant suppression — isolated proof and integration handoff

Status at this handoff: source candidate and guarded rollback verified locally; **not applied to DEV by this work unit**. The coordinator owns canonical migration registration, DEV review/application/readback, package test registration and commit. No hosted mutation, model invocation or actual provider SEND was used.

Source base is `76dd409a929b7d133fb63da4ed840762778baa27` in `USKOCI-EAN`. The current plan's F20 unit, its R09 admission/transport owners, and Product UX Master S06/S17 are the governing contracts. The verified DEV input is project `leqcwgzvjsxugfgzdmth`, with the migration 364 activation clock behavior retained. Fresh catalog readback at **2026-11-08 22:21:26 UTC** still matched every guarded owner/consumer and its privileges.

## Confirmed problem and change

The captured live SQL reproduces both defects:

- An actual successful `rpc_submit_response` writes a committed `OFFER/SUBMITTED`, but subsequent first dispatch creates an opportunity/event/push for that same worker account and Need revision. There is no prior opportunity row for manual-first application, so opportunity dedupe alone cannot prevent it.
- A synthetic, valid `SELECTED` response plus `CONFIRMED` agreement on a flexible task with two required slots and one selected slot still passes the actual matcher and dispatch gate. Current dispatch invites the selected worker again alongside another eligible worker. A partially filled flexible task is not fully excluded by other owner paths.

Only two existing function bodies change:

| Owner | Added check | Placement |
| --- | --- | --- |
| `private.dispatch_cheap_candidate_admitted(uuid,uuid)` | No active or accepted OFFER for the same `worker_account_id`, `need_id`, `submitted_against_need_revision = needs.revision` | After immutable worker activation timing and before the existing matcher |
| `private.push_suppression(public.notification_deliveries)` | Suppress `OPPORTUNITY_AVAILABLE` / `NEED` / `WORKER` if the same account has an active or accepted OFFER for **the event's** `entity_id` and `entity_version` | After event/recipient identity validation, before preferences lookup and its default-ON early return |

The exact covered statuses are `SUBMITTED`, `DELIVERED`, `VIEWED`, `SHORTLISTED`, `SELECTED`. The coordinator explicitly authorized `SELECTED` after the current-state gap was reproduced: an accepted application to this unchanged publication has no new application action to prompt. Another eligible worker still receives the remaining-place opportunity. There is no independent historical-agreement or different-revision exclusion.

The new reason is `ALREADY_RESPONDED`. Both `notification_deliveries.suppression_reason` and `notification_push_attempts.error_code` are `text`; there is no enum/check vocabulary conflict. The delivery constraint requires a non-null reason in `SUPPRESSED`, which this supplies.

## Existing policies preserved

`DRAFT`, `WITHDRAWN`, `EXPIRED`, `STALE`, `STALE_REVIEW_REQUIRED`, `NOT_SELECTED`, another account, another Need, another submitted revision and legacy response kind `APPLICATION` do not acquire this new exclusion. The actual status constraint contains `SELECTED` and `NOT_SELECTED`; it contains neither a literal `ACCEPTED` nor `REJECTED` value.

The current `rpc_cancel_agreement(uuid,text)` (body MD5 `e592af7aead2172ff769f38aada8e056`) takes Need → Agreement → Execution locks and transitions selected response `SELECTED → NOT_SELECTED`, clears selected time, cancels selection/agreement/execution, revokes grants, expires relevant agreement notifications and may requeue the remaining search. The current withdraw owner rejects selected responses/active agreements. The cancellation definitions are retained in the readback artifact. This unit does not change either writer.

Consequently a cancelled `NOT_SELECTED` response can retain prior admission eligibility, subject to all existing matching/Need guards. If an opportunity already exists for that account/Need/revision, existing dedupe still prevents a second one. A suppressed delivery is terminal; withdrawal/reopen does not resurrect it. A genuinely different publication revision is evaluated independently. Tests of selected/cancelled/withdrawn/revision transitions use explicit synthetic states; they do not claim to execute all selection, cancellation or publication-edit orchestration.

Account identity is deliberate. The current profile constraint allows only one Worker profile per account. A deliberately divergent historical response profile reference proves that changing that reference cannot evade suppression; it is not presented as a state accepted by the current submit writer or as two simultaneous valid Worker profiles.

Discovery/matching and manual-application eligibility are unchanged. The actual old-task manual submit still succeeds while proactive admission remains excluded by the migration 364 activation clock. Existing event/delivery dedupe, token-first begin locking, Need lock ordering, provider leases, receipts, retries and `UNKNOWN` behavior are unchanged.

## Verification

Final checked-in reports:

- `r09-applicant-suppression-pglite-20261108.json`: **40 scenario cases passed; Node 41/41 including the parent test**, 17.4 seconds in the final concurrent run.
- `r09-applicant-suppression-native-20261108.json`: **44 scenario cases passed; Node 45/45 including the parent test**, 11.0 seconds in the final concurrent run. Native PostgreSQL 17.11 / PostGIS 3.5.2; separate isolated server on port 55434 was stopped after the run.
- `r09-applicant-suppression-live-preflight-20261108.json`: read-only current body/owner/ACL/config/status/index evidence.

Both engines execute the captured real matcher, wave/emitter, submit and claim/begin/complete bodies. The fixture reinstalls the live activation predicate before applying this candidate. Coverage includes positive ordinary dispatch; all five suppressed statuses; inactive states; selected/remaining-place positive and negative controls; queued SELECTED suppression; account and event revision identity; missing preferences; unchanged push/category/quiet/expiry/closed checks; real submit; zero duplicate opportunity keys; two devices leased before application; and reversible function-only deployment.

The native run additionally uses separate real PostgreSQL connections and observes `pg_blocking_pids`:

1. Submit holds the Need lock. Dispatch waits; after commit it sees the OFFER and inserts zero opportunities.
2. Dispatch holds the Need lock and creates one opportunity. Submit waits; after dispatch commits it marks that opportunity `RESPONDED`. Subsequent claim suppresses its queued push, with zero sends.
3. Two previously leased devices call begin concurrently after a separately committed application. Both return `SUPPRESSED`, with zero sends and no deadlock.
4. An actual `EXPLAIN (ANALYZE, BUFFERS)` over 10,001 synthetic response rows uses the existing `marketplace_responses_one_live_per_worker_need` partial unique index (Need/account). The recorded lookup touches three shared buffers. No production index is added; this narrow plan evidence is not hosted capacity evidence.

The shipped Edge transport handler runs against actual SQL claim/begin/complete RPC adapters and a mocked provider. Application committed between claim and begin produces **zero provider calls**. A deliberately lost provider acknowledgement produces one `UNKNOWN` send; application plus repeated ticks produces no further SEND. A late receipt settles the original attempt; a known receipt rate rejection cannot retry after the new application suppression recheck.

Forward and rollback preflight reject changed body or unexpected public-role execute privileges before either owner mutation. Readback proves only the two `prosrc` values change, every other captured `pg_proc` field (including OID, owner, ACL, language, security, volatility and search path) remains equal, and no business rows change. Forward → rollback → forward succeeds, retaining the activation clock and unrelated consumers.

## Exact integration artifacts

Candidate: `scripts/sql/r09_applicant_suppression_20261108.sql`.

The whole source file intentionally raises `R09_APPLICANT_SOURCE_ONLY`. Its tested executable transaction begins at **`-- R09_APPLICANT_ISOLATED_MIGRATION_START`**. The coordinator can register that exact slice through the canonical migration workflow after review. It contains nine exact body/owner/ACL/config guards and preserves all function metadata. It changes no scheduler, queue, grant, table, index or data row. Reapplying it to already changed bodies intentionally fails the preimage gate.

Rollback: `scripts/sql/r09_applicant_suppression_20261108.rollback.sql`, executable transaction begins at **`-- R09_APPLICANT_ROLLBACK_ISOLATED_MIGRATION_START`**. It requires the exact candidate postimages and restores the original two body hashes; rollback would restore the original redundant-notification eligibility too.

| Function | Current body MD5 | Candidate body MD5 |
| --- | --- | --- |
| `private.dispatch_cheap_candidate_admitted` | `5f3862949a6b93ab99c29c549ff9a837` | `34dcf47d654d5960fbf7254c28745a04` |
| `private.push_suppression` | `25d3fae40c1f67689e1c50ee1898005b` | `ebd9c03035630bde62bf9fd8a27378c2` |

Candidate executable SHA-256: `18bcc433a36dec266fd4199debad5bbc9337996b9cba46e34b5b26bf97383acf`.

Rollback executable SHA-256: `8f0c630779f186c60e88027ad06dedcafe9ff06c4444fe879c86d25b83982275`.

The complete current definitions and metadata are in `.preimage.json`, current exercised function/table shapes in `.dependencies.json`, and cancellation/withdrawal/remaining-search definitions in `.cancellation-readback.json`, all using the same SQL candidate prefix. They contain catalog/schema data, not production customer rows or secrets.

Register **`scripts/r09-applicant-suppression.test.cjs`** once in the existing `package.json` test command. Default execution is isolated PGlite and needs no Supabase access:

```sh
node --test scripts/r09-applicant-suppression.test.cjs
```

Native race proof uses the existing isolated launcher and explicitly supplied local PostgreSQL/pg dependencies:

```sh
USKOCI_F20_NATIVE=1 \
USKOCI_POSTGRES_ROOT=/workspace/scratch/792f3e12eb9e/pg-runtime/root \
USKOCI_PG_MODULE=/workspace/scratch/792f3e12eb9e/pg-runtime/node/node_modules/pg \
node --test scripts/r09-applicant-suppression.test.cjs
```

Set optional `USKOCI_F20_PROOF` to an absolute report path to record a fresh proof. Reports include source/candidate/rollback/dependency/harness hashes, runtime version, individual cases and limitations. No native run should share its port with another fixture.

## Limits of this proof

The fixture uses synthetic SQL data and narrow Auth users/sessions table shapes; there are no real signed sessions or device deliveries. External safety/closure/lifecycle/response-version event/pg_net wake triggers and foreign keys are not installed. Matcher, wave/emitter and submit/push owner bodies themselves are captured real SQL, not rewritten mocks. Edge readiness/metrics and provider HTTP are mocked. The current ACLs are compared and role execute privileges asserted, but this is not a full Supabase API/RLS integration or provider/device acceptance test.

A committed application visible at the existing suppression recheck blocks the send. This patch does not serialize application commit with the subsequent provider HTTP call or add a Need lock to transport. An application arriving after that recheck may be too late for that attempt. **A provider send that has already started cannot be recalled**, and `UNKNOWN` remains an unknown result without permission for a blind resend. Visible phone delivery, Android permission behavior, Expo/FCM acceptance and current hosted queue capacity remain separate evidence requirements.
