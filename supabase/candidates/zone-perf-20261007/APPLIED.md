# ZONE-PERF is APPLIED to canonical DEV (2026-10-07)

The README in this folder was written before the application and still says "SOURCE ONLY, NOT APPLIED"; it is kept byte-identical to the candidate branch (candidate/match-v1-20261007) so a later merge of that branch stays a no-op for these files.

- Applied on the owner's exact word "PRIMENI ZONE-PERF", 2026-10-07; ledger 227 -> 228, version 20261007192233, name `dev_alpha_zone_perf_application`.
- Receipt with every hash, the postflight result, the read-back, the measurement and the revert: `supabase/operations/dev-alpha/ledger/20261007_zone_perf_application.receipt.json`.
- Revert: `revert.sql` (not applied). MATCH-V1 and DISCOVERY-ZAMENE are NOT applied and each needs its own exact word.
