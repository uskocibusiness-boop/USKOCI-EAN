-- Rollback for decline_response_20261122: removes the new decline command and its
-- idempotency table. Applications already declined stay NOT_SELECTED (an existing status).
BEGIN;
DROP FUNCTION public.rpc_decline_response(uuid,integer,integer,text);
DROP TABLE private.response_decline_commands;
DO $post$ BEGIN
  IF to_regprocedure('public.rpc_decline_response(uuid,integer,integer,text)') IS NOT NULL
  OR to_regclass('private.response_decline_commands') IS NOT NULL
  THEN RAISE EXCEPTION 'DECLINE_RESPONSE_ROLLBACK_POSTIMAGE'; END IF;
END $post$;
COMMIT;
