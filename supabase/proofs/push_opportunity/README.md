# Bounded OPPORTUNITY transport — local behavioral package

**Not deployed and not a promotion/certificate package.** The existing one-device admission accepts only `MESSAGE_RECEIVED`. This candidate extends the same bounded path to a naturally generated `OPPORTUNITY_AVAILABLE`, without enabling the global queue or changing device registration.

`build.py` derives two existing function definitions and one CHECK from `baseline.json`. `manifest.json` pins the exact predecessor and candidate hashes. `candidate.rollback.sql` always rolls back. No Edge function, flag, grant, schedule, profile or live event is changed by this package.

The new admission freezes the opportunity, worker profile, Need and revision. Admission and begin recheck the recipient, active profile, matching result, opportunity state/expiry, Need search state/capacity/time, device/session and existing suppression rules. Begin locks token → Need → delivery → attempt and checks deadlines again after matching. MESSAGE metadata remains separate; OPPORTUNITY does not gain the MESSAGE-only `eventId` response hint. Unknown delivery outcomes never gain another send authorization.

## Local proof

Use an existing disposable PostgreSQL business-schema restore at the pinned predecessor. This is **not** the Supabase Auth/HTTP test environment. Python standard library and `psql` are sufficient; no application dependency is added.

Supply a local password through normal libpq `PGPASSWORD` or `PGPASSFILE`, outside the command and source. The scripts force `127.0.0.1`, discard connection override variables, check the server/database/user, reject optimized Python, and accept only `uskoci_proof_*` or `uskoci_plan_cache_YYYYMMDD` database names. Keep the output directory private: it contains generated synthetic fixture SQL and local diagnostics.

```powershell
python -X utf8 supabase/proofs/push_opportunity/build.py
python -X utf8 supabase/proofs/push_opportunity/proof.local.py --port 55439 --database uskoci_plan_cache_20261009 --output C:/private/opp-proof --confirm-disposable PUSH_OPPORTUNITY_LOCAL_ONLY
```

Add `--psql C:/path/to/psql.exe` when it is not on PATH. The explicit disposable flag is a local target guard, not a request to change DEV.

The serial proof performs one outer transaction and rolls it back:

- creates fresh synthetic account/profile/session/device fixtures with a non-routable token;
- activates the profile through `rpc_complete_worker_profile`, calls the real matcher and `dispatch_next_wave`, and observes the naturally emitted OPPORTUNITY/PUSH delivery;
- proves the MESSAGE-only predecessor refuses that opportunity;
- verifies 26 admission/begin drift cases, 22 strict metadata cases, and 15 actual SQL role/body-guard cases;
- compares MESSAGE transport results for both roles before/after the patch (synthetic event fixtures, **not** natural chat command proof);
- verifies one send authorization, denied second claim/begin, UNKNOWN no-retry and replay after opportunity expiry;
- requires all 33 unique completion markers and compares function metadata, CHECK, Auth stub columns and every public/private/auth table row multiset after rollback. Sequences are observed separately and never reset by this runner.

The local Auth compatibility columns `deleted_at`/`banned_until` are added only inside the rolled-back transaction. No business function is stubbed. Drift fixtures use existing lifecycle guard values to prepare invalid states; they are not claims that every corresponding user command was exercised.

## Cancellation race

Pass the successful serial receipt from the previous step. Its generated `.rollback.sql` sibling is verified against its hash.

```powershell
python -X utf8 supabase/proofs/push_opportunity/race.local.py --port 55439 --parent-database uskoci_plan_cache_20261009 --fixture-receipt C:/private/opp-proof/opportunity-local-RUN.json --output C:/private/opp-proof --confirm-disposable PUSH_OPPORTUNITY_LOCAL_ONLY
```

This runner creates two uniquely named local template clones, commits candidate/fixture state **only inside those clones**, and uses two PostgreSQL connections plus a read-only lock observer. It exercises the actual `rpc_cancel_need` command:

- cancellation obtains the Need first → begin visibly waits → `SUPPRESSED`, send count 0;
- begin obtains the Need first → cancellation visibly waits → one `SEND_STARTED`, send count 1.

The second case establishes the send-authorization boundary; it does not claim an already authorized external send can be recalled. The runner synchronizes the restored audit identity sequence to its copied rows **in each new clone only**, because the partial restore did not preserve that sequence. It removes only clones created by that invocation, without `FORCE`; it never resets or drops the parent database.

## Evidence and remaining promotion work

The sanitized run receipts live in `docs/implementation/ui-ux-pass-20261002/evidence/push-opportunity-local-20261009/`. They are source-bound local SQL evidence: zero HTTP/provider calls and no phone delivery. Earlier fixture/runner failures remain in private diagnostic history; the final receipts identify the exact passing harness bytes.

Still required before DEV application:

1. A complete current 108-function closure surface and a separate **108→108** certificate wrapper. The older single-target installer adds nine signatures and cannot be reused for this already-certified predecessor.
2. Faithful Storage columns, constraints, triggers/functions, RLS/policies, voice bucket and Realtime publication metadata in an isolated certificate environment. The partial local Auth/Storage restore cannot prove full readiness. Do not replace readiness with `true` or copy a new digest into a certificate row as a substitute for proof.
3. Coherent baseline → candidate closes readiness → exact rebind → exact pre-admission revert/reapply, with source-drift, EXECUTING closure and dataset/export invariants. Catalog identity differences must be explicit and separate from semantic differences.
4. Post-admission rollback policy: an OPPORTUNITY journal must not be destroyed or made unreadable by restoring the MESSAGE-only CHECK. Do not use an old pre-admission revert after a real opportunity admission.
5. Remaining profile/preference/calendar/time-boundary and full-capacity selection concurrency cases. Matching currently uses `statement_timestamp()` for some availability decisions; the final clock guard does not claim to solve all those boundaries.
6. Exact live preflight, matching active recipient profile, one current owner device/event, closure-safe application/readback and one bounded provider/phone proof. Owner-confirmed MESSAGE delivery is separate evidence, not acceptance of this new category.

This package does not establish store readiness, sustained traffic capacity, group-message emission or all notification categories.

### Later local certificate evidence, 09 October

The faithful 108-function surface reconstruction, local baseline translation, committed install/revert/reapply and closure/admission refusals have now passed in isolated children. See `docs/implementation/ui-ux-pass-20261002/evidence/push-opportunity-certificate-local-20261009/README.md` for exact scope and source-bound artifacts. This closes the local reconstruction/transition work in items 1–4 above; it does not supply a DEV promotion wrapper or resolve the remaining concurrency and physical delivery requirements. Post-admission exact downgrade is explicitly refused in PENDING, SUPPRESSED and UNKNOWN states, preserving journal metadata.
