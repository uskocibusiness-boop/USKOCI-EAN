-- Rollback for agreement_personal_periods_20261126: removes the three period commands and their table.
-- Marked periods are private schedule notes; nothing else reads them.
BEGIN;
DROP FUNCTION public.rpc_get_my_agreement_periods(timestamptz, timestamptz);
DROP FUNCTION public.rpc_clear_my_agreement_period(uuid);
DROP FUNCTION public.rpc_set_my_agreement_period(uuid, timestamptz, timestamptz);
DROP TABLE private.agreement_personal_periods;
DO $post$ BEGIN
  IF to_regprocedure('public.rpc_set_my_agreement_period(uuid,timestamptz,timestamptz)') IS NOT NULL
  OR to_regprocedure('public.rpc_clear_my_agreement_period(uuid)') IS NOT NULL
  OR to_regprocedure('public.rpc_get_my_agreement_periods(timestamptz,timestamptz)') IS NOT NULL
  OR to_regclass('private.agreement_personal_periods') IS NOT NULL
  THEN RAISE EXCEPTION 'AGREEMENT_PERIODS_ROLLBACK_POSTIMAGE'; END IF;
END $post$;
COMMIT;
