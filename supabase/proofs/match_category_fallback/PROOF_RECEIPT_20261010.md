# 2026-10-10 — isolated category-matching proof receipt

**State:** disposable SQL behavior PASS, code-only. **Canonical DEV not modified.** No approval or release certification implied.

- Repo: `uskocibusiness-boop/USKOCI-EAN`, Draft PR #6
- Proven source commit: `71fa187be0da9ebd526405f1b71f93e616c31789`
- GitHub Actions: [isolated SQL run 38057881183](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38057881183)
- Job: `disposable-postgresql`, **success**. Separate `source-boundary` job **success**.
- CI log marker: `ISOLATED_SQL_PROOF_PASS; production Supabase NOT accessed`
- Environment: fresh PostgreSQL 16 service container created and disposed within GitHub Actions, synthetic Need/profiles/preferences, no private customer information.
- Actual canonical function definitions loaded byte-exact from the read-only live `private.worker_need_fit_v1` and `private.work_kinds_v5` captures in this PR. The old function body MD5 was `ab221f0091d78856bb42f702ddecd016`, candidate body MD5 `d18c47226723ffbbec474aa4547e1af1`.
- Six stages: schema+current 11-kind helper; baseline (both service matches); candidate (one qualified worker and one rejected); exact source revert; reapply candidate; full original guarded `candidate.sql` transaction then full guarded `revert.sql` transaction. Exact source assertions checked again after each stage.
- Coverage: explicit requirements trump category, recognized category synonyms, unrelated service refusal, unknown/null category no wildcard, same-city fallback, REMOTE work, time block, profile exclusion, own-task and suspended profile, and first-refusal service/response shape.

## Deliberate limits

The worker/Need rows, matching registry stems, time decisions, identity/world access, distance helper and closure-digest stand-in are synthetic. The kind/function source itself is the real SQL; the other helpers are *not*. This does **not** demonstrate full canonical Auth/Storage/RLS/Realtime/cron, calendars, dispatch-to-notification, push transport, concurrent publication/selection, phone navigation or closure certificate parity.

The proof was initially red because it exposed (1) missing SQL function terminators, (2) a wrong test expectation about the first-refusal JSON `matches:false` field, and (3) malformed dollar quotes in a synthetic fixture. All are corrected in this same Draft PR and the final exact run is green. The red runs remain available in Actions as engineering history.

**Before any DEV migration:** recheck exact live predecessor, verify a faithful disposable database/closure proof and all 62-row gates, have an approved state-changing action, apply with safe readback and an exact reversion plan. Push needs its own explicit owner-authorized one-event, one-device test; this candidate grants no right to send.


## Additional matched/unmatched & OWN_NEED scenarios — 2026-10-10

- Test source commit: `d027cc253d09aa8a00a9ba124e39c5cbcef547d6` (candidate/assertion change only; **unchanged SQL function bodies and hashes**).
- [Disposable PostgreSQL 16 run 38064158343](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38064158343): source-boundary PASS, disposable-postgresql PASS; [PRE-P4 run 38064158323](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38064158323): PASS.
- Synthetic active worker has general skill kinds `fizički poslovi`, `popravke`, `čišćenje`, works in `Novi Sad`. The requester in the allowed positive cases is a **different synthetic account**. No real email, auth ID, push token or user data is committed.
- On the **new candidate function**: cleaning, repair and physical work match in Novi Sad; delivery, electrical and moving work do **not**; on-site cleaning in Beograd does not. Checked detailed response AND fast first-refusal dispatch response, including a qualified positive and unrelated negative.
- After switching the synthetic requester to the worker's own account, detailed fit includes `OWN_NEED` and fails; dispatch first-refusal also fails with `OWN_NEED`. Existing task rows are restored via SAVEPOINT after this local batch and then the outer test transaction rolls back.
- **Independent real DEV, read-only observation:** all three currently PUBLISHED tasks at the time of the check belong to the profile's **same account**; the live canonical prefilter refuses them under `OWN_NEED`. No positive real-other-requester task exists in this scope. The older deployed matcher still wrongly treats category-only tasks as service matches. These are different statements, neither implies a delivered opportunity.
- The worker's `available_now=false` is separate from whether a future task's full availability tier permits matching. Owner-device enrollment exists but its registration/consent must be freshly confirmed before any **single-event** push test.
- Zero DEV writes, zero new accounts, zero provider calls, zero Expo sends; the global push flag remains OFF. No inference that the corrected matching code is deployed or that phone has seen the event.
