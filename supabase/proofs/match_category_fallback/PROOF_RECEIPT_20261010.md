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

## Further isolated dispatch-prefilter proof — source through `233fdab982597550fec5e734503a62d52d461ba6`

- [AI category matching source safety run 38089783058](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38089783058): disposable PostgreSQL 16 **success** and exact source-boundary **success**. Runs `dispatch-prefilter-assert.sql` after candidate/reapply, including full guarded candidate/revert transaction proof. No live DB writes.
- Two **byte-exact current DEV** SQL bodies are now invoked in disposable PostgreSQL: `private.worker_need_match_v1(uuid,uuid)` MD5 `ef94ef7de07a347824ace68789f08c41` and `private.dispatch_cheap_candidate_admitted(uuid,uuid)` MD5 `cec5c0a2c13af6718af53b7a80245f28`. Sources are pinned and verified by `source.test.mjs`.
- The fake schema now includes only the three prefilter inputs needed beyond the matcher (`needs.revision`, `worker_match_preferences.proactive_notifications`, minimal `opportunity_deliveries`). The actual dispatch prefilter SQL is called for matching cleaning, unrelated/null category, OWN_NEED, suspended worker, proactive pause, a **synthetic** time refusal, duplicate current revision, old revision versus new revision, cross-city fallback, REMOTE, and an explicit skill override.
- The earlier distance/radius proof runs the **actual** DEV Haversine and radius SQL bodies, plus actual `lower_arr`, with synthetic map points; the work-kind registry is a read-only snapshot of all eleven current DEV kind rows. It tests a valid 10-km nearby municipality match, a same-city task beyond 10 km, and city-only fallback when the worker lacks a point.
- **Independent canonical DEV read-only observation:** the owner's currently published owned needs were all rejected by the live `dispatch_cheap_candidate_admitted` prefilter (3/3 at that query instant), consistent with `OWN_NEED`. The live matcher itself still uses predecessor MD5 `ab221f0091d78856bb42f702ddecd016`; PR #6 is Draft and NOT applied.
- **NOT PROVED:** actual `dispatch_next_wave` opportunity insert, real weekly availability computation inside this disposable fixture, calendar/identity/world policy tables, end-to-end notifications, queue transport/provider, or HONOR tap. Worker personal data, tokens, user IDs and real points are not copied to the proof. `OPPORTUNITY_AVAILABLE` remains unauthorized for real sending.

**Release gate unchanged:** a faithful disposable full business/Auth/closure/dispatch test, current-source and permissions readback, separate owner approval before any DEV change, then isolated approved second-requester/one-device physical push proof. Do not promote from this synthetic prefilter test alone.

## 2026-10-11 — actual calendar functions and wave orchestrator in disposable PG

- Source commit `d1917c95d2ed095580d7cec0a55f5ee2525e6412`.
- [GitHub disposable PostgreSQL 16 run 38090399610](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38090399610) **SUCCESS**; source-boundary **SUCCESS**. The SQL job explicitly reached **STAGE 7**, **STAGE 8**, rolled back its synthetic scenarios, and emitted `ISOLATED_SQL_PROOF_PASS; production Supabase NOT accessed`.
- Stage 7 loaded six **byte-exact canonical DEV SQL bodies** for `availability_timezone_valid`, `availability_is_future`, `worker_calendar_conflict`, `worker_available_periods`, `schedule_fit` and `worker_need_time_tier_v1`. MD5 digests are pinned in `source.test.mjs`. The only availability, worker, agreement and timezone **row data is invented**. Acceptance cases: anytime tier 1, future fixed slot with/without availability, conflicting Dogovor, explicit UNAVAILABLE override, Belgrade weekly rule and inactive rule, invalid/restored timezone, TODAY available-now priority and blocked-now refusal. The real `dispatch_cheap_candidate_admitted` prefilter was asserted alongside each time-tier.
- Stage 8 loaded the **exact current DEV body** of `dispatch_next_wave(uuid)` (MD5 `d3cdfe2bdd6e5d40a74e6029793c89c5`), `dispatch_config_v1b(jsonb)` (MD5 `7aa34ff0b5f4a3637c433bec317c1c13`) and `need_search_time_admitted_v1(uuid,timestamptz)` (MD5 `b830cd07c2a5db101a3a28096256a75b`).
- This stage executed actual production wave control flow, limits, candidate iteration, opportunity inserts, same-revision deduplication and `emit_event` invocation. **Only three specified adapters were SYNTHETIC:** `candidate_profile_ids_v1b` (bounded eligible fake workers), `match_detail` (real matcher admission with synthetic neutral score), and `emit_event` (inserts only into a disposable local event table; **no push or network capability**).
- Verified in one rolled-back simulated transaction: one eligible recipient / one opportunity event, no second event on the same revision, unrelated category refusal, new revision re-qualification, OWN_NEED refusal, proactive pause refusal, suspended worker refusal, closed remaining-search stop. Synthetic task, account IDs, scores and event sink only.
- **Limitations:** real candidate streaming/geo-KNN, real scoring/details, real `emit_event` preference processing, production Auth/RLS, notifications persistence, provider delivery, Android OS visibility, and push tap navigation **are still NOT tested end-to-end**. The full wave must **never be invoked on real DEV** until explicit bounded approval and authorization controls are proved; mode ALL would otherwise target every admitted worker. No actual database migration was applied.

Current operational boundary: Draft PR #6 only; live matcher still predecessor `ab221f0091d78856bb42f702ddecd016`. Keep push transport disabled; no test task/account/OTA creation, no production traffic.
