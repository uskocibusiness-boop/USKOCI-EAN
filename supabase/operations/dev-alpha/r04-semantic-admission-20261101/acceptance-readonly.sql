BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
-- No existing account, business/Auth fixture, provider or push call.
DO $triage$ BEGIN
 IF private.taxonomy_risk_triage_v1('Lektura') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
   RAISE EXCEPTION 'R04_TRIAGE_LEKTURA_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('ostalo') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_OSTALO_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('bilo sta') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_BILO_STA_FAILED';
 END IF;
END;$triage$;
DO $commit_check$ BEGIN
 BEGIN
   PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(NULL, NULL, 'NEED_SERVICE', NULL, '[]'::jsonb);
   RAISE EXCEPTION 'R04_COMMIT_GUARD_FAILED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLSTATE <> '22023' THEN RAISE; END IF;
 END;
END;$commit_check$;

SELECT 'R04_ACTUAL_PG_TRIAGE_AND_AUTH_PASS' result,false authenticated_positive_functional_acceptance,statement_timestamp() checked_at;ROLLBACK;
