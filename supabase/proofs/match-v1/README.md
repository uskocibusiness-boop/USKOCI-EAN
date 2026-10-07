# MATCH-V1 + DISCOVERY-ZAMENE disposable proof

Run by `.github/workflows/match-v1-discovery-zamene-proof.yml` (push to `candidate/match-v1-20261007` on these paths, or `workflow_dispatch` once the file is on the default branch). Three independent jobs, each from its own fresh chain: `zone` (ZONE-PERF, see `supabase/proofs/zone-perf/README.md`), `behavior` and `load`. Loopback database only; no DEV, provider, device or push.

1. `check_source.py` — both generators byte-exact (`--check`), every SQL file, DO block and function body parsed (pglast 8.4), rule boundaries: no tool/vehicle/experience/fee gate, no `40001`, no trigger/table/policy/index statement.
2. `chain.mjs` — live79 → source147 → PKG027…PKG042 → PKG042a…PKG050a → Discovery P0 → PKG045b (P0) → P6 rollout v3 → EX04d → EX06a → EX06b → WPP01 → EX06e R2 alignment → EX06e R3, in canonical DEV order.
3. `fidelity.mjs` — the 23 relevant bodies equal the captured DEV bodies (only an exact B24 `40001`→`PT409` conversion is admitted). Bounded relevant-body fidelity, not global DEV equivalence.
4. `runtime.proof.mjs` — real Auth + PostgREST: BEFORE (DEV bodies: the old gates hold), drift and order refusals (atomic), ZONE-PERF applied first as planned, MATCH-V1 applied (every case flips), DISCOVERY-ZAMENE applied ("Za mene" = exactly the rule set, default unchanged byte for byte), exact reverts (catalog and certificate restored), REVERTED (old behaviour again).
5. `load.proof.mjs` (job `load`) - 300 active workers, 3,000 draft profiles and 1,000 open tasks as synthetic SQL rows (triggers off, labelled `MV1 ...`), `ANALYZE`d. The same rows are measured in four states: OLD (the live DEV bodies), OLD_TZ (live bodies with only ZONE-PERF applied, to separate the zone fix from the rule rewrite), NEW (ZONE-PERF + MATCH-V1) and NEW_DZ (plus DISCOVERY-ZAMENE). Every statement runs under `statement_timeout` 90 s in chunks under a 180 s budget per measurement; a timeout is recorded with its partial rows and milliseconds (`timedOut`, `budgetExhausted`, `chunks done/planned`) instead of aborting, and a NEW measurement that does not complete fails the run. `track_functions` profiles show where the time goes (calls and self time per function), `EXPLAIN` shows how the prefilter treats a draft profile, and a rule that starts in 2015 is compared with one that starts today. Output: `load-report.json`, `load-summary.md` (also in the job page).

## Dispatch policy proofs (owner 2026-10-07: everyone at once, the ladder behind one row)

`runtime.proof.mjs` (real Auth, real PostgREST): thirteen real workers (plus one "late" worker in Nis) share one unique skill, so a "bilo kad" task is matched by the same thirteen in every state.
BEFORE (the live bodies): the ladder, groups 5, 5, 3 and one tick reaches five. After MATCH-V1 (mode ALL): one tick reaches all thirteen in ONE round (events 13, notification rows 26, valid 24 h, the
round window is the check time); the ceiling (set to 5): five, then `DELIVERY_CEILING_REACHED` with no new round, raised to 20: the rest; bad switch rows are `DISPATCH_CONFIG_INVALID`, no row is the ladder;
the tick time budget (set to 1 ms): one task started, two released and still due, the next tick finishes them; an urgent task is valid only until the end of its urgency; a late worker is reached by the next wave
even after three applications (no stop after N responses). The documented one-row script switches the ladder on: the same groups of the same workers as the live ladder, the stop after three responses, one
tick reaches only the first group, 15-minute validity; the existing wave cases (`matchingCases`) run in both modes. The revert restores today's ladder (groups 5, 5, 4 on fourteen workers).

`load.proof.mjs`: the single-wave table: one task sent to 300 and to 1,000 matching workers (ceiling 500 and raised to 1,000), the ladder's first group and first four groups on the same task, a tick of 5 tasks x 300 and of 25 tasks x 500
(time budget), what each creates (deliveries, events, notification rows, rounds) and where the time goes (function self time).
