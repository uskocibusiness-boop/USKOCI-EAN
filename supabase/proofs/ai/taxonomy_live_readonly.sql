-- USKOCI CISTO: read-only, repeatable DEV taxonomy / Gemini recovery preflight.
-- Never execute this with writes, never display owner ids, plans, prompt or private locations.
-- Use a restricted test connection and verify DEV project before running.
BEGIN TRANSACTION READ ONLY;

SELECT 'CATALOG_POSTSAVE_OUTBOX' AS surface,purpose,state,binding_state,
 count(*) AS jobs,max(attempts) AS highest_attempts,
 max(binding_attempts) AS highest_binding_attempts,
 count(*) FILTER (WHERE state IN ('PENDING','RETRY') AND retry_after<=now()) AS catalog_due,
 count(*) FILTER (WHERE state='COMMITTED' AND binding_state IN ('PENDING','RETRY')
  AND binding_retry_after<=now()) AS binding_due
FROM private.work_taxonomy_review_outbox_v1
GROUP BY purpose,state,binding_state ORDER BY purpose,state,binding_state;

SELECT 'UNRESOLVED_SIGNED_REVIEWS' AS surface,purpose,classification_state,
 resolution_state,count(*) AS count,
 count(*) FILTER (WHERE saved_at<now()-interval '24 hours') AS older_than_24h
FROM private.work_taxonomy_pending_reviews_v1
GROUP BY purpose,classification_state,resolution_state
ORDER BY purpose,classification_state,resolution_state;

SELECT 'POSTSAVE_CRON' AS surface,j.jobname,j.active,j.schedule,
 count(r.jobid) FILTER (WHERE r.start_time>=now()-interval '24 hours') AS runs_24h,
 count(r.jobid) FILTER (WHERE r.start_time>=now()-interval '24 hours' AND r.status<>'succeeded') AS non_success_24h
FROM cron.job j LEFT JOIN cron.job_run_details r ON r.jobid=j.jobid
WHERE j.jobname='uskoci_taxonomy_postsave_tick_dev'
GROUP BY j.jobname,j.active,j.schedule;

SELECT 'PROVIDER_OBSERVATIONS' AS surface,
 (SELECT count(*) FROM private.ai_need_turn_commands WHERE created_at>now()-interval '24 hours' AND state='SUCCEEDED') AS need_success,
 (SELECT count(*) FROM private.worker_ai_turns WHERE created_at>now()-interval '24 hours' AND state='SUCCEEDED') AS worker_success,
 (SELECT count(*) FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE created_at>now()-interval '24 hours') AS classified_turns,
 (SELECT count(*) FROM private.classification_turn_hints WHERE consumed_at IS NULL) AS open_clarification_hints;

SELECT 'RECOVERY_CODE_PRESENCE' AS surface,
 to_regprocedure('private.taxonomy_reconcile_pending_reviews_v1(integer)') IS NOT NULL AS pending_ledger_reconciler_exists,
 to_regprocedure('public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)') IS NOT NULL AS reviewed_outbox_reconciler_exists,
 to_regprocedure('public.rpc_taxonomy_bind_ready_reviews_service(integer)') IS NOT NULL AS binding_worker_exists;

ROLLBACK;
