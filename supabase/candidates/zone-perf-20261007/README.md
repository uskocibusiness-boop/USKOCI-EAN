# ZONE-PERF — the shared zone check stops reading the whole zone catalog (owner request 2026-10-07, "why is everything slow")

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI ZONE-PERF`**. Apply it **first**; it is independent of MATCH-V1 and DISCOVERY-ZAMENE (either order works, both are proven). Proof: job `zone` of `.github/workflows/match-v1-discovery-zamene-proof.yml` (disposable database only, never DEV).

## The problem, measured

`private.availability_timezone_valid(text)` (language sql, stable, `search_path=pg_catalog`, not security definer) decides whether a zone name is accepted. Its last condition is `exists(select 1 from pg_catalog.pg_timezone_names z where z.name=value)`. `pg_timezone_names` is a set-returning function that **reads every zone file of the server (1,196 zones) before it returns the first row**, so every call costs the full scan, warm or cold: **about 73 ms on canonical DEV** (read-only measurement of 2026-10-07, against 0.4 ms for `now() at time zone 'Europe/Belgrade'`) and about 52 ms on the CI server.

Who calls it (catalog scan of all function bodies, three levels deep):

- directly: `private.guard_availability_timezone` (trigger on the availability tables), `normalize_worker_ai_availability`, `relative_schedule_end_v5`, `schedule_fit`, `worker_available_periods`, `worker_dispatch_time_admitted` (several times per call), `public.rpc_save_worker_availability`;
- through the matcher, which the **requester's Home and "Moji zadaci" readers run for every selectable application of every open own task**: `rpc_home_attention`, `rpc_list_my_needs_page` and `rpc_list_my_tasks` (via `rpc_read_task`) -> `public.selectable_application_count` -> `private.need_candidate_states_v5` -> `private.match_detail_for_calendar_interval` -> `private.match_detail_without_calendar` -> `private.worker_dispatch_time_admitted` -> the helper. `rpc_list_my_agreements_page` never reaches it (it is the proof's control: it must not change);
- the dispatch: every worker x task pair of the prefilter and of the detailed matcher (the stalled load proof of this work had this root cause), and `expire_lifecycle` through `relative_schedule_end_v5`.

## The change (one body, nothing else)

`private.availability_timezone_valid(text)` keeps its signature, language, volatility, `search_path`, owner and ACL (`{postgres=X/postgres}`); only the body changes:

```sql
select case
  when value is null or length(value)>100 then false
  when value in ('Europe/Belgrade','UTC') then true
  else (value='UTC' or position('/' in value)>0)
    and value not like 'posix/%' and value not like 'right/%'
    and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=value)
end;
```

The two names are the product's own zones (the default of `needs.task_timezone` and of `worker_match_preferences.timezone`, plus UTC). Every other value goes through **exactly the expression of today**, so the truth table is unchanged by construction. Decision record:

- **Why constants and not a cache:** a cached lookup "built from `pg_timezone_names` on first use per session" has to live in a session setting (a custom `set_config` value). Any session can write that setting, so a cache there can be poisoned to make the helper accept a zone the catalog does not know (and a bad zone later raises in `at time zone` for other readers); it also still pays the full scan once per backend. Constants have no state to poison and no first-call cost.
- **Why not `now() at time zone value` in an exception block:** it would accept more than today's helper (any letter case, abbreviations, POSIX rules), which changes the truth table, and it needs plpgsql and a subtransaction per call (a change of language and metadata).
- **If the tz database changed:** the apply refuses unless both names are in `pg_timezone_names` (`ZONE_PERF_TIMEZONE_CATALOG_LACKS_FAST_PATH_NAMES`), and the preflight and postflight report `catalogHasFastPathNames`. PostgreSQL keeps backward-compatible zone names; `Europe/Belgrade` and `UTC` are in every tz database release. A zone that is not one of the two still costs the scan (about 50-110 ms): rare (only a person who saves a different zone in their availability, or an AI-proposed one), and still correct.

## Truth table, and the answer about case and white space

The old helper's behaviour is **preserved exactly, including case and white space**: names are compared byte for byte with the catalog (`europe/belgrade`, ` Europe/Belgrade`, `Europe/Belgrade ` and `UTC ` are refused today and are refused after), `utc` is refused (it has no slash and is not the exact string `UTC`), `EST5EDT`, `GMT` and `Zulu` are refused (no slash) although they are in the catalog, `Etc/Zulu` is accepted, `posix/...` and `right/...` are refused, a value longer than 100 characters is refused, `NULL` is refused (`false`, never `NULL`).

Proof, three layers:

1. **Inside the apply and the revert transaction:** the answers of 27 probes (`truthTableProbes` in the manifest: NULL, empty, `UTC`, `Europe/Belgrade`, `Europe/Paris`, `America/New_York`, `EST5EDT`, `posix/Europe/Belgrade`, `right/UTC`, 101 characters, `Not/AZone`, `europe/belgrade`, ` Europe/Belgrade`, `Europe/Belgrade `, `UTC `, `utc`, `Etc/GMT+1`, `Etc/UTC`, `Asia/Kolkata`, `Europe/Zagreb`, `Europe/Sarajevo`, `GMT`, `Zulu`, `Etc/Zulu`, `Europe/`, `/`, and a 100-character name) are captured from the old helper before the replacement and compared with the new helper after it; any difference aborts and rolls everything back.
2. **`postflight.readonly.sql`:** the same probes against an independent oracle (the old expression written out in full and evaluated against the catalog, which does not call the helper).
3. **The disposable runtime proof:** about 300 values (every 24th catalog name and its lower-case, upper-case, left-padded, right-padded and suffixed variants plus the 27 probes) against the same oracle, before the change and after it, identical answer for answer.

## Certificate

**The closure certificate does not move, and the proof asserts it.** `closure_source_digest_v5` hashes a fixed list of 99 function signatures plus the schema digest and the erasure program digest (read from the DEV function bodies on 2026-10-07); `availability_timezone_valid` is in none of them, and no trigger function, table, constraint, policy or grant changes. The apply and the revert assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` equal before and after (DEV `3a785d42…` / `2027655d…`) and the certificate ready, in the same transaction. No errcode `40001` anywhere (B24).

## Order with the other candidates

Independent of MATCH-V1 and DISCOVERY-ZAMENE. MATCH-V1 no longer replaces this helper; it pins it as a dependency and accepts both bodies (the live one, `013f884c…`, and this one, `be95520d…`). Proven in job `zone`: ZONE-PERF then MATCH-V1 (MATCH-V1 leaves the helper alone, reverts exactly), and MATCH-V1 then ZONE-PERF (ZONE-PERF applies on top, both revert exactly, catalog and certificate restored). Reverting ZONE-PERF while MATCH-V1 is applied is allowed (only slower again). Older, still unapplied candidates that pin this helper's live body (`ex06a`, `ex06d` F5, the WPP02 files) would need their pins regenerated before they could be applied after ZONE-PERF.

## Apply order on the owner's word

1. `preflight.readonly.sql` -> every flag true (ledger 227, helper is the predecessor, certificate ready, both fast names in the catalog).
2. `candidate.sql` as one migration (byte-exact, guarded; `candidate.in-transaction.sql` for a wrapper that adds its own transaction).
3. `postflight.readonly.sql` -> `helperIsPostimage` true, `truthTableMismatches` empty, certificate equal to the preflight value; receipt in `supabase/operations/dev-alpha/ledger/`.

Exact revert: `revert.sql` (restores the live body; code rollback only, nothing else was created or written).

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (exact DEV body, read-only readback), `candidate.sql` / `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`. Offline check: `python supabase/proofs/match-v1/check_source.py`. Runtime proof: `supabase/proofs/zone-perf/runtime.proof.mjs`.

## Evidence

The `zone` job of the proof workflow writes `zone-summary.md` (also in the job page) and `zone-report.json`: the four readers' server-side milliseconds cold and warm before / after / reverted on a seeded requester with 44 tasks of every schedule kind, 32 applications and 10 agreements, helper calls per request, payload identity, truth-table results, the two orders with MATCH-V1, and the exact revert.
