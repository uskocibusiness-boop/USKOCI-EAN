-- USKOCI rollback of publication_pre_evaluation_20261121.candidate.sql.
-- The candidate modifies no existing function; rollback drops only the objects it created.
-- Deploy the previous uskoci-publication-evaluate first (or keep USKOCI_PUBLICATION_PRE_EVALUATION_ENABLED unset):
-- the tap path only reads the stored decision and evaluates as before when the RPC is absent.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION IF EXISTS public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text);
DROP FUNCTION IF EXISTS public.rpc_complete_ai_task_review_pre_evaluation_service(uuid,text,uuid,text,text[],text[],text);
DROP FUNCTION IF EXISTS public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.rpc_preview_ai_task_review_publication_context(uuid,text);
DROP TABLE IF EXISTS private.ai_task_review_pre_evaluations;
DO $rollback_postflight$
BEGIN
  IF to_regclass('private.ai_task_review_pre_evaluations') IS NOT NULL
  OR to_regprocedure('public.rpc_preview_ai_task_review_publication_context(uuid,text)') IS NOT NULL
  THEN RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_ROLLBACK_INCOMPLETE'; END IF;
END
$rollback_postflight$;
COMMIT;
