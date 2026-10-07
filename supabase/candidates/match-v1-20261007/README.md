# MATCH-V1 — one "Odgovara mi" rule (owner decisions 2026-10-07)

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI MATCH-V1`**. Proof: `.github/workflows/match-v1-discovery-zamene-proof.yml` (disposable database only). Gaps closed: G1, G2, G3, G6 of `docs/implementation/ui-ux-pass-20261002/ZAVRSNA_PROVERA_20261007.md`.

## The live speed problem is fixed by ZONE-PERF, apply that FIRST (found 2026-10-07)

The first load proof of this package stalled for 600 s on the **old, live** bodies. Root cause, measured read-only on canonical DEV: `private.availability_timezone_valid(text)` checks a zone name with `exists(select 1 from pg_catalog.pg_timezone_names ...)`. That view reads **every zone file of the server** (1,196 zones) on every call: about 52 ms in CI, **70-110 ms per call on DEV**, warm or cold. The helper runs inside `worker_dispatch_time_admitted`, so the live prefilter and the live detailed matcher cost about **80-110 ms per worker x task pair**; the Home / "Moji zadaci" readers reach it through `selectable_application_count` for every application of every open own task.

- **The fix is its own, independent candidate: `supabase/candidates/zone-perf-20261007/` (owner word `PRIMENI ZONE-PERF`).** It replaces only the body of that one helper and is proven on its own (job `zone`). This package no longer touches the helper: it calls it unchanged and **accepts it in either of its two known states** (the live body, or the ZONE-PERF body). Both orders are proven (job `zone`: ZONE-PERF then MATCH-V1, and MATCH-V1 then ZONE-PERF, each reverting exactly). Without ZONE-PERF this package is correct but the matching stays as slow as it is today; apply ZONE-PERF first.
- The rule itself stops at the first refusal, cheapest check first (status, area, shared word, world, kind registry, exclusions, time) and never reads a zone for "bilo kad".
- `private.candidate_profile_ids` no longer visits DRAFT profiles in its two fallback loops (every requester-only account has one; `dispatch_cheap_candidate_admitted` refuses a profile that is not ACTIVE, so the admitted workers and their order are unchanged).
- Hypothesis checked and **not** the cause: the age of a weekly availability rule. `worker_available_periods` expands only the days of the asked window, never from `starts_on` (the load proof measures a 2015 rule against one that starts today).

Evidence and numbers: the `load` job of the proof workflow (`supabase/proofs/match-v1/load.proof.mjs`, summary table in the job page and `load-summary.md` in its artifact; its "OLD + ZONE-PERF only" column is the live bodies with only ZONE-PERF applied).

## Behaviour

- **"Odgovara mi" = kind of work + area + time.** One shared rule, `private.worker_need_fit_v1` / `private.worker_need_match_v1`, is read by the detailed matcher (`match_detail_without_calendar`: dispatch and manual application), by the dispatch prefilter (`dispatch_cheap_candidate_admitted`) and, with DISCOVERY-ZAMENE, by "Za mene".
- **Tools, vehicles, experience and the minimum fee are no condition** — not for the notification, not for a manual application, not for selection (`rpc_submit_response` / `rpc_select_response` read `responseAllowed`), and no score: `RESOURCES_MATCH` (+15) is gone; `scoreComponents.resources` stays `0` on the wire. The codes `MISSING_REQUIRED_TOOL`, `MISSING_REQUIRED_VEHICLE`, `INSUFFICIENT_EXPERIENCE`, `BELOW_MINIMUM_FEE` and `CURRENT_AVAILABILITY_PAUSED` are no longer produced (the client may keep its copy for them).
- **Kept hard exceptions:** inactive profile, own task, identity requirement, profile exclusions (`hardBlockers`, they also refuse a manual application); other world (prefilter + rule); a Dogovor that blocks a fixed window (`CALENDAR_CONFLICT`); "Ne javljaj mi" (`PROACTIVE_NOTIFICATIONS_PAUSED`) and the dormant same-day urgent switch stay notification-only preferences.
- **Time** (`private.worker_need_time_tier_v1`, 1 = first, 2 = by schedule, null = no):
  - `FLEXIBLE` / `REMOTE_ANYTIME` ("bilo kad") without a complete future window → everyone (1).
  - `TODAY_FLEXIBLE` ("danas"; the publication day in the task's zone, Europe/Belgrade by default) → "Mogu odmah" first (1), then a weekly rule / window with real available time left today (2).
  - "odmah": the schema has no ASAP kind — it is "danas" or a stored window that has already begun → "Mogu odmah" first (1, a fixed window must still fit as before), then a schedule covering now and the rest of a fixed window (2).
  - `TOMORROW_FLEXIBLE`, `WEEK_FLEXIBLE` and every future stored window → the EX-06 coverage rule unchanged (2).
  - "First" is the order inside a wave (`dispatch_next_wave` orders by `timeTier`, then score) — never exclusivity. In mode ALL (the default, below) every admitted worker is in the one wave, so the order only decides in which sequence the rows are written (all rows of one wave carry the same creation time, so it does not order the pushes); in mode LADDER it decides who gets into the first group of 5, inside the unchanged waves [5,5,10,20], 15-minute windows and stop at 3 responses (the priority applies within the bounded candidate budget, ≥ 40 nearest admitted workers per wave).
- **Manual profile edits re-queue open tasks.** `dispatch_tick` first calls `private.requeue_changed_worker_profiles_v1`: an ACTIVE worker profile whose `updated_at` moved since the watermark (one row `private.marketplace_config` key `match_v1_profile_requeue`; cutoff 30 s behind the tick) re-queues the same open set as `requeue_open_needs_for_worker_v5` (own world, never own tasks, ≤ 200), once per change; a task already reconsidered after the change is left alone, and in mode LADDER so is a task inside a running wave window (no wave is pulled forward); in mode ALL there is no wave window to wait for, so a changed profile re-queues the task even right after its wave. At most 100 profiles per tick, in `(updated_at, account_id)` order with a keyset cursor, so a bulk update neither floods one tick nor loses profiles that share a timestamp. Cost when idle: one config row and one pass over `app_profiles` (no index: an index on `updated_at` would make every worker update non-HOT). No trigger, no new table. Lag ≤ ~90 s. Assumption: a profile write commits within 30 s of its `updated_at` (the transaction start time).

## Dispatch policy (owner 2026-10-07): everyone at once, the ladder kept and switched by ONE row

The owner's decision: all workers a task fits get an equal chance to apply, so the default is **one wave to every worker the shared rule admits** — not 5 then 5 then 10 then 20. The ladder (waves of 5, 5, 10, 20, 15-minute windows, stop at 3 responses) is "for later, when there are many workers": it stays fully implemented and is switched on by changing one value, with no code change. One data row decides, `private.marketplace_config` key **`match_v1_dispatch`**, written by the candidate:

```json
{"mode": "ALL", "ceiling": 500, "validMinutes": 1440, "tickBudgetSeconds": 40, "owner": "MATCH-V1 2026-10-07"}
```

- **`mode: "ALL"` (the default)** — in the first tick after a task is published (or its revision changes) `dispatch_next_wave` sends the opportunity to **every admitted worker, nearest first, in one round**: no cap of 40, no waiting window between groups, no stop after 3 responses (a stop would starve later workers of their notification). `dispatch_rounds` gets one row (`batch_size` = the room left under the ceiling, `budget_source` `FIXED`, an allowed value of its check constraint), each worker gets one `opportunity_deliveries` row, one `OPPORTUNITY_AVAILABLE` event and its two notification rows (IN_APP, PUSH). The tick checks the task again after the usual window (15 min, urgent 3 min), then by its existing back-off (5 min … 6 h); a worker who became eligible in between is reached by that wave (a worker already notified for the revision is never notified twice). A changed or new profile re-queues the open tasks at once (`requeue_open_needs_for_worker_v5`; direct profile writes through the tick, see above).
- **`ceiling` (default 500) — the safety ceiling per task revision.** At most `ceiling` workers are notified for one revision of one task. **Above it**: nobody more is notified for that revision, the task stays on the map and the list for everyone and applying stays open, the wave answers `DELIVERY_CEILING_REACHED` without writing a round, the tick records that reason in `private.dispatch_schedule.last_reason` and keeps its normal back-off check (one count query per check, at most every 6 h), and **raising the ceiling continues with the workers not yet notified, nearest first**, at the next check (or at once after `select private.enqueue_dispatch('<task id>', statement_timestamp())`). A task edit (new revision) starts a new count. Valid range 1..10000.
- **`validMinutes` (default 1440 = 24 h)** — how long a delivery and its notification (in-app and push) stay valid. In the ladder they live one window (15 minutes) and `private.push_suppression` refuses a push past `expires_at`: with hundreds of recipients a 15-minute life would let the push transport expire the last notifications unsent. An urgent task (HITNO) is valid only until the end of its urgency (`urgent_expires_at`). Valid range 1..10080.
- **`tickBudgetSeconds` (default 40)** — one wave to hundreds of workers takes seconds. After this many seconds a tick starts no further task: the claimed tasks it did not start are released (`locked_until` cleared, still due, first in line next minute) and reported as `deferred`, so one heavy minute can never run into the statement timeout, roll back and repeat for ever. The first task of a tick is always handled. Range 0.001..100.
- **`mode: "LADDER"` (or no row at all)** — today's dispatch, unchanged byte for byte in effect: `dispatch_normal` / `dispatch_urgent` waves, windows and thresholds, the candidate budget (40 base, up to 120), stop after `targetResponses`, `WAVES_EXHAUSTED`. Proven: the same groups of the same workers as the live ladder (`runtime.proof.mjs`).
- **A bad row is a named configuration error**, not a silent change: an unknown mode, a ceiling or validity outside its range, or a value that is not a number raises `DISPATCH_CONFIG_INVALID` (the tick files it as an ERROR for that task and retries in 10 minutes), like the other dispatch settings.

**Turn the ladder on later (no code change), and back** — two scripts in this directory, each guarded to start from the expected mode, one `update` of one row, closure certificate not involved, a state-changing write on DEV: only on the owner's exact word.

```sql
-- ladder ON  (switch-ladder-on.sql)
update private.marketplace_config set value = jsonb_set(value,'{mode}','"LADDER"'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
-- ladder OFF, everyone at once again  (switch-ladder-off.sql)
update private.marketplace_config set value = jsonb_set(value,'{mode}','"ALL"'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
-- other knobs, same way, e.g. the ceiling:
update private.marketplace_config set value = jsonb_set(value,'{ceiling}','1000'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
```

A switch affects the waves that start after it; workers already notified stay notified. **The package revert** (`revert.sql`) restores the six predecessor bodies and deletes both configuration rows, i.e. the ladder of today (proven: after the revert the same thirteen workers come in groups 5, 5, 3 again).

What to know before applying: (1) the volume is four rows per notified worker per task (delivery, event, in-app and push notification) — 1,200 rows for a task with 300 matching workers, 2,000 for the ceiling of 500 — and, once pushes are on, one push per matching worker per new task; the ladder reached at most 40 workers per task. (2) Right after the apply the next tick sends every open task that is due to **all** its matching workers: on canonical DEV (read 2026-10-07) that is 5 active worker profiles and 11 open tasks, 10 of them queued. (3) Timing per task, measured on the disposable server (run 37662617758, ZONE-PERF applied first): see "Measured cost" below.

## Measured cost (disposable server, run 37662617758, job `load`; CI hardware varies by about 1.5x between runs)

Single wave, mode ALL, one rolled-back transaction per row (server time): 1,000 workers fit the kind of work, 300 of them also fit task A.

| one task | workers reached | events | notification rows | ms | ms per worker |
| --- | --- | --- | --- | --- | --- |
| 300 matching workers | 300 | 300 | 600 | 1,148 | 3.8 |
| 1,000 matching, ceiling 500 (default) | 500 | 500 | 1,000 | 1,056 | 2.1 |
| 1,000 matching, ceiling raised to 1,000 | 1,000 | 1,000 | 2,000 | 2,009 | 2.0 |
| ladder (mode LADDER): first group | 5 | 5 | 10 | 180 | 36 |
| ladder: first four groups (40 workers, 45 minutes of real time) | 40 | 40 | 80 | 558 | 14 |
| tick of 5 tasks x 300 workers | 1,500 | 1,500 | 3,000 | 5,586 | 3.7 |
| tick of 25 tasks x 500 workers (the tick batch, ceiling reached) | 12,500 | 12,500 | 25,000 | 23,821 | 1.9 |

A task costs about **1.1 s** at 300 and 500 matching workers and about 2.0 s at 1,000 (if the ceiling is raised); a whole tick of 25 such tasks takes about 24 s, under the 40 s budget (`deferred` 0). Where the time goes (300-worker wave, self time): kind-of-work registry reads for the workers who do not fit (`work_kinds_v5`, 206 ms), world checks (`account_lineage`, `account_visibility_world`, 256 ms), `emit_event` (117 ms for 300 events), the rule (`worker_need_fit_v1`, 91 ms). Above the ceiling the second wave creates nothing.

The same rows, per pair and per task, old against new (the ladder's wave, so the same work): zone helper 53 -> 0.01 ms per call; prefilter 57.6 -> 0.66 (ZONE-PERF only) -> 0.32 ms per pair; detailed matcher 57.5 -> 0.77 -> 0.94 ms; candidate retrieval of 40 workers 17.5 s -> 409 ms -> 132 ms per task; one ladder wave 19.1 s -> 422 ms -> 196 ms; the profile re-queue costs 0.34 ms per idle call and 301 ms for a full batch of 100 changed profiles; "Za mene" (DISCOVERY-ZAMENE) at 1,000 open tasks 137 ms against 63 ms for the default read.

## Exact boundaries

| Function | Change |
| --- | --- |
| `private.match_detail_without_calendar(uuid,uuid)` | reads the shared rule; tool/vehicle/experience/fee gates, the live-intent gate and `RESOURCES_MATCH` removed; adds `timeTier` |
| `private.dispatch_cheap_candidate_admitted(uuid,uuid)` | = rule + notifications on + not yet delivered; the rule gets the row columns (`n.id, p.id`), so it is a join filter behind the ACTIVE-status filter, never a one-time filter run for every draft profile |
| `private.worker_dispatch_time_admitted(uuid,uuid)` | wrapper: `worker_need_time_tier_v1(...) is not null` |
| `private.dispatch_next_wave(uuid)` | `order by`: `timeTier`, then score; reads the switch row: mode ALL = one wave to every admitted worker up to the ceiling, validity `validMinutes`; mode LADDER / no row = the live code path unchanged (every ladder statement is kept, guarded by `not all_mode`) |
| `private.dispatch_tick(integer,timestamptz)` | calls the profile re-queue first; time budget (`tickBudgetSeconds`) releases the tasks it did not start; reports `deferred` and `profileRequeue` |
| `private.candidate_profile_ids(uuid,integer)` | the two fallback loops visit ACTIVE profiles only (same admitted workers, same order) |
| new `private.worker_need_time_tier_v1`, `private.worker_need_fit_v1(uuid,uuid,boolean)`, `private.worker_need_match_v1`, `private.requeue_changed_worker_profiles_v1` | SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres}`. `fit(..., true)` (prefilter, "Za mene") stops at the first refusal, cheapest first: status/own task → shared word → area → world/identity → kind registry → exclusions (only when the list is not empty) → schedule; `fit(..., false)` (detailed matcher) computes every component. Same expressions, same answer. |
| data | two `private.marketplace_config` rows: `match_v1_profile_requeue` (watermark and keyset cursor) and `match_v1_dispatch` (the switch above) |

Predecessor pins (DEV, 2026-10-07, ledger 227, latest `20261005101102`): `match_detail_without_calendar` `ef5de901…`, `dispatch_cheap_candidate_admitted` `e51de37e…`, `worker_dispatch_time_admitted` `4f0beb65…`, `dispatch_next_wave` `2b58d696…`, `dispatch_tick` `8798cb6b…`, `candidate_profile_ids` `dca4ddc8…`, plus 16 unchanged dependencies (`manifest.json`), among them the shared zone helper `availability_timezone_valid`, accepted as `013f884c…` (live) **or** the ZONE-PERF body. Older, still unapplied candidates that pin `candidate_profile_ids` (`ex06a`, `ex06d` F5, the WPP02 files) would need their pins regenerated before they could ever be applied after MATCH-V1; those that pin the zone helper need the same after ZONE-PERF. Every edit is anchored once; metadata, OIDs and comments are asserted unchanged.

**Closure certificate: does not move.** None of these bodies is in `closure_erasure_program_digest_v5` (fixed list + trigger functions of the redaction relations + table/trigger state) or `closure_schema_digest_v5_139`; no table, column, constraint, trigger, policy or grant on an existing object changes; the transaction asserts the digest, the erasure-program digest and readiness before and after (DEV `3a785d42…`); the two configuration rows are data, not schema. An `AFTER UPDATE` trigger on `app_profiles` was deliberately NOT used: it would move both digests and need a recertification.

No errcode `40001` anywhere (B24: deterministic conflicts are `PT409`); this package raises only `55000` guards.

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (exact DEV bodies, read-only readback), `candidate.sql` / `candidate.in-transaction.sql`, `revert.sql` (exact inverse; refuses while DISCOVERY-ZAMENE is applied; code rollback only), `switch-ladder-on.sql` / `switch-ladder-off.sql` (the one-row dispatch switch), `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`. Offline check: `python supabase/proofs/match-v1/check_source.py`.

## Apply order on the owner's word

0. Recommended: apply ZONE-PERF first (`supabase/candidates/zone-perf-20261007/`, its own owner word). `preflight.readonly.sql` reports `zoneHelperState`.
1. `preflight.readonly.sql` → every flag true (ledger 227, pins, certificate ready, nothing pre-existing).
2. `candidate.sql` as one migration (byte-exact, guarded).
3. `postflight.readonly.sql` → bodies, ACLs, watermark, certificate unchanged; receipt in `supabase/operations/dev-alpha/ledger/`.
