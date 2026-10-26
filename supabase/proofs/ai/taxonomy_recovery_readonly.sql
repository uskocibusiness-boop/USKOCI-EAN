-- USKOČI ČISTO: READ ONLY, non-mutating taxonomy recovery observation.
-- Run on canonical DEV only. No secrets, account IDs or service descriptions.
-- No SAVE, no provider calls, no cron execution, no RLS bypass.
-- This reports current state; it cannot prove a full authenticated Gemini E2E run.
SELECT now() AS checked_at,
       (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1) AS saved_taxonomy_jobs,
       (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1 WHERE resolution_state='OPEN') AS open_classification_reviews,
       (SELECT count(*) FROM private.work_taxonomy_need_bindings_v1) AS need_bindings,
       (SELECT count(*) FROM private.work_taxonomy_worker_bindings_v1) AS worker_bindings;

SELECT p.purpose, p.classification_state,p.resolution_state,count(*) AS n,
       count(*) FILTER (WHERE o.id IS NULL) AS not_in_automatic_outbox,
       count(*) FILTER (WHERE o.binding_state='BOUND') AS linked_to_current_binding
FROM private.work_taxonomy_pending_reviews_v1 p
LEFT JOIN private.work_taxonomy_review_outbox_v1 o
  ON o.owner_account_id=p.owner_account_id AND o.request_key=p.request_key
 AND o.source_review_id=p.source_review_id
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT purpose,state,binding_state,count(*) AS n,
       count(*) FILTER(WHERE state IN ('PENDING','RETRY') AND retry_after<=now()) AS ready_catalog_retry,
       count(*) FILTER(WHERE state='COMMITTED' AND binding_state IN('PENDING','RETRY')
           AND binding_retry_after<=now()) AS ready_binding_retry,
       max(attempts) AS max_catalog_attempts,max(binding_attempts) AS max_binding_attempts
FROM private.work_taxonomy_review_outbox_v1
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT jobname,schedule,active FROM cron.job
WHERE jobname IN ('uskoci_taxonomy_postsave_tick_dev','uskoci_edge_workers','uskoci_marketplace_tick')
ORDER BY jobname;

SELECT jobname,status,count(*) n,max(end_time) AS latest_end
FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid
WHERE j.jobname='uskoci_taxonomy_postsave_tick_dev'
  AND d.start_time>=now()-interval '24 hours'
GROUP BY 1,2 ORDER BY 1,2;

SELECT
 (SELECT enabled FROM private.work_taxonomy_pending_control_v1 WHERE singleton) AS pending_ledger_enabled,
 (SELECT enabled FROM private.work_taxonomy_review_outbox_control_v1 WHERE singleton) AS outbox_enabled,
 (SELECT enabled FROM private.work_taxonomy_binding_control_v1 WHERE singleton) AS binding_enabled;
