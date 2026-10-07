# DISCOVERY-ZAMENE: the optional filter key forMe in public.rpc_discovery_v1(jsonb) (one anchored edit of the body, P6 rollout v3 md5 1c602244... to dc69802e...) narrows PAGE, MAP, PLACES and their counts to the caller's "Odgovara mi" = private.worker_need_match_v1 (kind of work + area + time, the same rule as the notifications after MATCH-V1); plus two NEW authenticated-only helpers public.discovery_for_me_state_v1() and public.discovery_for_me_v1(uuid). Absent or false: the request, filterKey, anchors, cursors and response are identical to before. The map and the list still show ALL tasks by default. No table, column, constraint, trigger, policy or grant on an existing object changed. is APPLIED to canonical DEV (2026-10-07)

The README in this folder was written before the application and still says "SOURCE ONLY, NOT APPLIED"; it is kept byte-identical to the candidate branch (candidate/match-v1-20261007) so a later merge of that branch stays a no-op for these files.

- Applied on: the owner's standing order of 2026-10-07 ("DA, PRIMENJUJ DOKAZANE PAKETE SAM"); ledger 231 -> 232, version 20261007204555, name `dev_alpha_discovery_zamene_application`.
- Receipt with every hash, the postflight result, the read-back and the revert: `supabase/operations/dev-alpha/ledger/20261007_discovery_zamene_application.receipt.json`.
- Revert: `revert.sql` (not applied).
