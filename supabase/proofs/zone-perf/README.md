# ZONE-PERF disposable proof

Job `zone` of `.github/workflows/match-v1-discovery-zamene-proof.yml` (push to `candidate/match-v1-20261007` on these paths). Fresh chain (live79 -> ... -> EX06e R3, canonical DEV order), loopback database only; no DEV, provider, device or push.

`runtime.proof.mjs`, real Auth + PostgREST + database:

1. Seeds a realistic requester through the product's own writers: 44 tasks (FLEXIBLE, TODAY / TOMORROW / WEEK_FLEXIBLE, FIXED_WINDOW), four workers, 32 applications, 10 agreements (22 applications stay selectable).
2. The readers are measured as they run on DEV: `dev-readers.sql` installs the DEV bodies (md5 verified against DEV) of `rpc_list_my_needs_page` and `private.own_task_counts`, which the historical chain lacks (EX-04 S1); the md5 of every function on the reader path is compared with DEV and reported. BEFORE: the helper costs a catalog scan per call; `rpc_home_attention`, `rpc_list_my_needs_page('ALL', 30)` and `rpc_list_my_tasks` reach it through the matcher (function call counts from `pg_stat_xact_user_functions`), `rpc_list_my_agreements_page` does not (the control). Server execution milliseconds, one cold call in a fresh backend and warm calls.
3. Drift and revert-before-apply refusals are atomic; `candidate.sql` applies: exact post-image, same metadata and ACL, closure certificate unchanged, no new `40001`; a repeated application is refused.
4. AFTER: same four readers, **payloads identical** (only `asOf` is ignored), the helper costs no scan, the matcher-backed readers are faster cold and warm with the same helper call counts; the truth table (27 manifest probes plus about 300 catalog names with case and white space variants) equals an independent oracle, before and after, answer for answer.
5. ORDER: MATCH-V1 on top of ZONE-PERF (leaves the helper alone, reverts exactly) and MATCH-V1 first then ZONE-PERF (both revert exactly): catalog and closure certificate restored each time.
6. `revert.sql`: the readers are slow again.

Output: `zone-report.json`, `zone-summary.md` (also in the job page).
