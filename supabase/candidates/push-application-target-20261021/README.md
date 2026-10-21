# Exact application push target — prepared source

DEV parser-only step on 2026-10-21: `uskoci-push-transport` v36 is ACTIVE and read back, with the application exact-payload flag absent/off. See `docs/current/PUSH_APPLICATION_EDGE_V36_20261021.md`. SQL, client APK and exact device tap are still pending.

This package is **not installed**. It adds an opaque `eventId` for `RESPONSE_RECEIVED` (the public “Nova prijava” copy) and `RESPONSE_UPDATED`; the ID is a hint only. The authenticated resolver validates the recipient, event, in-app delivery, current response version, Need revision and owner, world, safety, closure, and the same `SELECTABLE` state helper used by the owner candidate read before returning `needId` and `responseId`. The client then checks the candidate through its normal owner-scoped list read before opening it. A completed/cancelled Need, withdrawn/stale/selected response, expired selection window or changed eligibility returns `UNAVAILABLE`; the historical notification remains in the normal Inbox. The push payload has no Need, person, response, URL, offer or message data.

## Source and preflight

Read-only DEV inspection on 2026-10-21 found `public.rpc_begin_push_send(uuid,uuid)` with `md5(prosrc)=380a2f203da2a7ad344bd80f061abd13`; its event-ID branch already admits `MESSAGE_RECEIVED` and `OPPORTUNITY_AVAILABLE`. `candidate.sql` requires this exact body plus its current ACL, security-definer flag, volatility and `search_path`. It changes only that branch to add the two response event types, preserving message/opportunity behavior. The resolver also pins `private.need_candidate_states_v5(uuid,uuid[])` to body MD5 `91e873f74c8df477ab846391dfa53add` and its current metadata. Any drift rolls back the whole transaction. Obtain fresh readback immediately before any application; this dated capture is not a live guarantee.

`preflight.readonly.sql` was run against DEV at 2026-10-21 01:46 UTC: exact begin and candidate-state predecessors, absent resolver, authority dependencies and columns all passed. The exact target SELECT also passed read-only `EXPLAIN`. Neither result is an application or runtime proof.

### Closure certificate coupling

`rpc_begin_push_send` is in the 108-function `private.closure_source_digest_v5()` roster. A body change necessarily changes the closure source digest. DEV read-only values **before** this SQL: actual `e064bf5bd995c9b846495f9f808c2910ba56d21f5fcb56b84ad98514d569bb79`; both source and erasure certificates `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`; `private.retention_ai_source_ready() = false`; `private.closure_erasure_binding_v5() = null`. These are already mismatched, and a fresh `rpc_start_account_closure_execution` checks the null binding and raises `CLOSURE_POLICY_NOT_READY` (`55000`). This is a source/catalog conclusion, not a newly executed end-user closure attempt.

The candidate does not repair or rebind that certificate. Before a release that promises account erasure, a separate reviewed forward migration must reconcile the *final* closure source inventory, the hard-coded digest in `private.retention_ai_source_ready()`, and both source/erasure certificates, then prove `retention_ai_source_ready=true`, non-null erasure binding and the fresh QA closure path. Do not merely stamp a new digest: review the source changes and erasure plan. The push candidate may be tested on DEV with the feature flag off after a fresh preflight, but it is **not a complete release migration** while closure remains unready.

### Post-application QA proof

`postapply.qa.rollback.proof.sql` is source-only and has **not run**. It needs a freshly submitted QA response whose owner candidate state is `SELECTABLE`, plus the owner and a foreign QA account with real active Auth `session_id` claims. The sole structurally eligible pre-existing DEV event found by aggregate inspection is for a `SELECTED` response on a `COMPLETED` Need, so it is a negative historical case and cannot be the positive fixture. Obtain an event ID for a fresh QA response from `user_activity_events` after canonical `rpc_submit_response`; do not put access tokens or credentials in source control.

Run the read-only catalog gate before the migration with `npx supabase db query --project-ref leqcwgzvjsxugfgzdmth --file supabase/candidates/push-application-target-20261021/preflight.readonly.sql`; all exact/dependency/column values must be true. After an authorized application and QA fixture creation, run the rollback proof in one **direct PostgreSQL** `psql` connection (not the Supabase SQL editor or one-command-per-connection CLI):

```powershell
psql $env:USKOCI_QA_DEV_DB_URL -X -v ON_ERROR_STOP=1 `
  -v dev_ref_attested=leqcwgzvjsxugfgzdmth -v qa_rollback_attested=true `
  -v owner_id=$env:USKOCI_QA_OWNER_ID -v owner_session_id=$env:USKOCI_QA_OWNER_SESSION_ID `
  -v foreign_id=$env:USKOCI_QA_FOREIGN_ID -v foreign_session_id=$env:USKOCI_QA_FOREIGN_SESSION_ID `
  -v event_id=$env:USKOCI_QA_RESPONSE_EVENT_ID `
  -f supabase/candidates/push-application-target-20261021/postapply.qa.rollback.proof.sql
```

The proof checks exact owner success, unknown/foreign event, wrong expected account, switched session, suppressed in-app delivery, response version/payload mismatch, withdrawn/stale response, cancelled Need and both parties entering closure. It also rechecks exact owner success after every savepoint restoration. It only updates QA rows inside savepoints and the outer transaction; the last statement is `ROLLBACK`. An assertion error stops `psql`, closes its dedicated connection and rolls back. It never calls the push transport or Expo. Confirm the direct URL is this DEV project and the IDs are disposable QA data before setting the two attestations. `psql` is not currently on this Windows machine's PATH; install or locate the PostgreSQL client before attempting this command. Only a real PASS line after the final rollback counts as runtime proof.

## Required rollout order

1. Ship the updated Edge parser with `EXPO_PUSH_APPLICATION_TARGET_ENABLED` **unset/false**. Verify deployed source/readback and a synthetic leased `RESPONSE_RECEIVED` receipt with `eventId`: exactly one Expo send and completion, with `{kind:'INBOX'}` metadata. The old Edge parser rejects this new begin receipt even when the feature flag is off, so **the SQL must not precede this step**.
2. Apply the pinned SQL only after its fresh preflight matches and the closure certificate coupling above is accounted for. Read back the new `pg_proc` definition/ACL and resolver grants. Exercise the rollback-only QA proof and verify no rows changed before any live use. No such execution is claimed by this source package.
3. Ship and prove the native client: cold and warm OS taps, Auth/account switch, withdrawn or stale response, paging failure/bound and the exact candidate landing. Until this point, keep the Edge flag off so installed clients get generic Inbox metadata.
4. Consider flag activation only when affected registered devices can parse the exact payload. The current flag is global and the begin receipt has no per-device app-version capability. An older installed client may reject a response push with `eventId` rather than show generic Inbox; either retire/upgrade those registrations or add a verified per-device capability gate first. Then enable the flag deliberately and measure real device delivery/tap behavior.

Focused source tests cover the Edge parser/flag/privacy/lease, owner-scoped client receipt, account cancellation, cold return and exact navigation. They do not prove SQL runtime, native device delivery or a DEV deploy.
