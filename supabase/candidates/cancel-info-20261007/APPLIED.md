# CANCEL-INFO: two NEW read functions, private.agreement_cancellation_facts_v1(uuid) and public.rpc_agreement_cancellation_v1(uuid[]) (EXECUTE: authenticated only). When, by which side and why a Dogovor was cancelled, read from what the only writer public.rpc_cancel_agreement(uuid,text) already leaves behind (status + updated_at, the AGREEMENT_CANCELLED event, the canceller's reason message). No existing function, table, column, trigger, policy or grant changed; no data row. is APPLIED to canonical DEV (2026-10-07)

The README in this folder was written before the application and still says "SOURCE ONLY, NOT APPLIED"; it is kept byte-identical to the candidate branch (candidate/profile-trust-20261007) so a later merge of that branch stays a no-op for these files.

- Applied on: the owner's standing order of 2026-10-07 ("DA, PRIMENJUJ DOKAZANE PAKETE SAM"); ledger 228 -> 229, version 20261007201845, name `dev_alpha_cancel_info_application`.
- Receipt with every hash, the postflight result, the read-back and the revert: `supabase/operations/dev-alpha/ledger/20261007_cancel_info_application.receipt.json`.
- Revert: `revert.sql` (not applied).
