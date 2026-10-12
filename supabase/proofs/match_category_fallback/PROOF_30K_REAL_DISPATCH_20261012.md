# USKOČI — 30k synthetic identities, REAL SQL matcher and dispatch proof

**Proof timestamp (Europe/Belgrade): 2026-10-12.** Result: **PASS**.

**Source of truth:** [GitHub Actions run 38180061476](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38180061476), job `114590524280`; branch `fix/match-ai-category-fallback-20261010`, source commit `3f2c38de462795fd354b5098412c02174a2ce10b`.

## Executed, not just generated

A fresh GitHub Actions PostgreSQL 16 service was populated with:
- **20,000 synthetic worker profiles** across 11 work kinds, 5 cities, variable availability, exclusions, suspended states, notification preferences and radii.
- **10,000 distinct synthetic requester UUIDs** (not Supabase Auth accounts).
- **10,000 task records** covering all 55 kind/city combinations.
- **55 actual SQL calls to `private.dispatch_next_wave`**, one for each distinct kind/city combination and one per transaction to respect the real per-transaction notification budget.
- The byte-exact current/candidate function bodies of `private.worker_need_fit_v1`, `private.dispatch_cheap_candidate_admitted`, `private.worker_need_match_v1`, and the captured canonical `private.dispatch_next_wave` were executed; `private.work_kinds_v5` from the captured DEV snapshot was used for classification.

Checks:
- **55 correct accepts and 55 correct rejects**, covering all kind/city pairs.
- **55/55 waves SENT**, with **14,904 synthetic opportunity_delivery rows and 14,904 local in-app event rows**; no duplicate need+revision+worker delivery; no ineligible recipients by the actual matcher on the 55 tasks.
- Re-queue same revision: **0** new deliveries.
- Edit first task to `Dostava`, increment revision to 2: **271** additional appropriately matched deliveries.
- Close remaining search: **STOPPED / REMAINING_SEARCH_CLOSED**, **0** new deliveries.
- **Total 15,175** local delivery rows/events after revision edit.
- Wave runtime on this disposable runner: **2,339.3 ms mean** and **2,386.1 ms maximum** over 55 waves. These are NOT production latency/throughput SLOs.

## Critically important limitations

This is more than a JavaScript counter model, because real PL/pgSQL matching, dispatch prefilter and dispatch_next_wave were executed against populated PostgreSQL tables. However it is **NOT** a full live USKOČI E2E or a 30,000 concurrent-user benchmark:

1. `private.candidate_profile_ids_v1b` is a **disposable local adapter**, not the complete PostGIS KNN/geospatial candidate stream. Radius/city fallback is evaluated by the real matcher, but indexed geographic ranking is NOT proven at this volume.
2. `private.match_detail` is a local score-shape adapter, so true scoring order and fairness are NOT load-proven here.
3. `private.emit_event` writes only to a local event sink. There were **no HTTP calls, provider push notifications, Expo/FCM receipts or Android taps**.
4. `private.worker_need_time_tier_v1`, auth/world/identity/calendar helpers are disposable stubs, not the real availability/Auth/RLS semantics.
5. Only **55 of the 10,000 seeded jobs were dispatched** in this run. No claim about 10,000 simultaneous waves is made.
6. No actual registration, AI worker interview, user submissions, response/selection, agreement/chat, cancellation, deletion or full multi-user API transactions were exercised in this workload.
7. **Canonical DEV `leqcwgzvjsxugfgzdmth` was not modified by this run.** No production environments, credentials or real accounts were used.

## Reproducible sources

- `.github/workflows/marketplace-30k-real-dispatch-proof.yml`
- `supabase/proofs/match_category_fallback/marketplace-30k-seed.sql`
- `supabase/proofs/match_category_fallback/marketplace-30k-assert.sql`
- Supporting captured real function definitions: `live-work-kinds-v5.sql`, `live-dispatch-prefilter.sql`, `live-wave-entry.sql` and `supabase/candidates/match-category-fallback-20261010/candidate.sql`.

## Next release gates

1. Full native PostGIS/KNN and calendar/score candidate selection at increased load in isolated test DB.
2. Real Auth/RLS, AI-generated worker onboarding, responses, picks, Dogovori, cancellation/reopen/delete in a dedicated sandbox with capped quotas.
3. Concurrent HTTP/RPC load testing on an isolated stack (not full-scale on shared Free DEV), with p50/p95/p99, throughput, rejection and data-integrity checks.
4. Controlled FCM enrollment and exact-target push proof on HONOR; then an independently audited preview APK.

Do not use this proof as permission to launch 30k load against the live project.
