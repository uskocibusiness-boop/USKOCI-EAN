# MATCH-V1 — one "Odgovara mi" rule (owner decisions 2026-10-07)

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI MATCH-V1`**. Proof: `.github/workflows/match-v1-discovery-zamene-proof.yml` (disposable database only). Gaps closed: G1, G2, G3, G6 of `docs/implementation/ui-ux-pass-20261002/ZAVRSNA_PROVERA_20261007.md`.

## Behaviour

- **"Odgovara mi" = kind of work + area + time.** One shared rule, `private.worker_need_fit_v1` / `private.worker_need_match_v1`, is read by the detailed matcher (`match_detail_without_calendar`: dispatch and manual application), by the dispatch prefilter (`dispatch_cheap_candidate_admitted`) and, with DISCOVERY-ZAMENE, by "Za mene".
- **Tools, vehicles, experience and the minimum fee are no condition** — not for the notification, not for a manual application, not for selection (`rpc_submit_response` / `rpc_select_response` read `responseAllowed`), and no score: `RESOURCES_MATCH` (+15) is gone; `scoreComponents.resources` stays `0` on the wire. The codes `MISSING_REQUIRED_TOOL`, `MISSING_REQUIRED_VEHICLE`, `INSUFFICIENT_EXPERIENCE`, `BELOW_MINIMUM_FEE` and `CURRENT_AVAILABILITY_PAUSED` are no longer produced (the client may keep its copy for them).
- **Kept hard exceptions:** inactive profile, own task, identity requirement, profile exclusions (`hardBlockers`, they also refuse a manual application); other world (prefilter + rule); a Dogovor that blocks a fixed window (`CALENDAR_CONFLICT`); "Ne javljaj mi" (`PROACTIVE_NOTIFICATIONS_PAUSED`) and the dormant same-day urgent switch stay notification-only preferences.
- **Time** (`private.worker_need_time_tier_v1`, 1 = first, 2 = by schedule, null = no):
  - `FLEXIBLE` / `REMOTE_ANYTIME` ("bilo kad") without a complete future window → everyone (1).
  - `TODAY_FLEXIBLE` ("danas"; the publication day in the task's zone, Europe/Belgrade by default) → "Mogu odmah" first (1), then a weekly rule / window with real available time left today (2).
  - "odmah": the schema has no ASAP kind — it is "danas" or a stored window that has already begun → "Mogu odmah" first (1, a fixed window must still fit as before), then a schedule covering now and the rest of a fixed window (2).
  - `TOMORROW_FLEXIBLE`, `WEEK_FLEXIBLE` and every future stored window → the EX-06 coverage rule unchanged (2).
  - "First" is the wave order (`dispatch_next_wave` orders by `timeTier`, then score), inside the unchanged waves [5,5,10,20], 15-minute windows and stop at 3 responses — never exclusivity. Limit: the priority applies within the bounded candidate budget (≥ 40 nearest admitted workers per wave).
- **Manual profile edits re-queue open tasks.** `dispatch_tick` first calls `private.requeue_changed_worker_profiles_v1`: an ACTIVE worker profile whose `updated_at` moved since the watermark (one row `private.marketplace_config` key `match_v1_profile_requeue`; cutoff 30 s behind the tick) re-queues the same open set as `requeue_open_needs_for_worker_v5` (own world, never own tasks, ≤ 200), once per change; a task already reconsidered after the change or inside a running wave window is left alone, so no wave is pulled forward. No trigger, no new table. Lag ≤ ~90 s.

## Exact boundaries

| Function | Change |
| --- | --- |
| `private.match_detail_without_calendar(uuid,uuid)` | reads the shared rule; tool/vehicle/experience/fee gates, the live-intent gate and `RESOURCES_MATCH` removed; adds `timeTier` |
| `private.dispatch_cheap_candidate_admitted(uuid,uuid)` | = rule + notifications on + not yet delivered |
| `private.worker_dispatch_time_admitted(uuid,uuid)` | wrapper: `worker_need_time_tier_v1(...) is not null` |
| `private.dispatch_next_wave(uuid)` | one `order by`: `timeTier`, then score |
| `private.dispatch_tick(integer,timestamptz)` | calls the profile re-queue first; reports `profileRequeue` |
| new `private.worker_need_time_tier_v1`, `private.worker_need_fit_v1`, `private.worker_need_match_v1`, `private.requeue_changed_worker_profiles_v1` | SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres}` |
| data | one `private.marketplace_config` row (`match_v1_profile_requeue`) |

Predecessor pins (DEV, 2026-10-07, ledger 227, latest `20261005101102`): `match_detail_without_calendar` `ef5de901…`, `dispatch_cheap_candidate_admitted` `e51de37e…`, `worker_dispatch_time_admitted` `4f0beb65…`, `dispatch_next_wave` `2b58d696…`, `dispatch_tick` `8798cb6b…`, plus 17 unchanged dependencies (`manifest.json`). Every edit is anchored once; metadata, OIDs and comments are asserted unchanged.

**Closure certificate: does not move.** None of these bodies is in `closure_erasure_program_digest_v5` (fixed list + trigger functions of the redaction relations + table/trigger state) or `closure_schema_digest_v5_139`; no table, column, constraint, trigger, policy or grant on an existing object changes; the transaction asserts the digest, the erasure-program digest and readiness before and after (DEV `3a785d42…`). An `AFTER UPDATE` trigger on `app_profiles` was deliberately NOT used: it would move both digests and need a recertification.

No errcode `40001` anywhere (B24: deterministic conflicts are `PT409`); this package raises only `55000` guards.

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (exact DEV bodies, read-only readback), `candidate.sql` / `candidate.in-transaction.sql`, `revert.sql` (exact inverse; refuses while DISCOVERY-ZAMENE is applied; code rollback only), `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`. Offline check: `python supabase/proofs/match-v1/check_source.py`.

## Apply order on the owner's word

1. `preflight.readonly.sql` → every flag true (ledger 227, pins, certificate ready, nothing pre-existing).
2. `candidate.sql` as one migration (byte-exact, guarded).
3. `postflight.readonly.sql` → bodies, ACLs, watermark, certificate unchanged; receipt in `supabase/operations/dev-alpha/ledger/`.
