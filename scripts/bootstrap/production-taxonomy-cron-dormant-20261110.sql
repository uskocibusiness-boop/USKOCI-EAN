-- A production taxonomy tick is prepared, but cannot run until the reviewed
-- post-save handler, its project key and the independent control are accepted.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $preflight$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283'
     OR current_user <> 'postgres'
     OR (SELECT count(*) FROM cron.job) <> 2
     OR EXISTS (SELECT 1 FROM cron.job WHERE active)
     OR EXISTS (SELECT 1 FROM cron.job WHERE jobname='uskoci_taxonomy_postsave_tick_prod')
     OR EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_control_v1)
     OR (SELECT count(*) FROM vault.decrypted_secrets
          WHERE name='uskoci_edge_base_url'
            AND decrypted_secret='https://fvyqqudqvizjrxaflhex.supabase.co') <> 1
     OR EXISTS (SELECT 1 FROM vault.secrets WHERE name='uskoci_edge_worker_key')
  THEN
    RAISE EXCEPTION 'USKOCI_PROD_TAXONOMY_CRON_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;

INSERT INTO private.work_taxonomy_review_outbox_control_v1(singleton,enabled)
VALUES (true,false);

DO $schedule$ DECLARE v_job bigint;
BEGIN
  v_job := cron.schedule(
    'uskoci_taxonomy_postsave_tick_prod', '* * * * *',
    $cmd$SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets
                WHERE name='uskoci_edge_base_url') || '/functions/v1/uskoci-taxonomy-postsave-worker',
      headers := jsonb_build_object('Content-Type','application/json','apikey',
        (SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name='uskoci_edge_worker_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 26000
    ) AS request_id
    WHERE EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_control_v1
                    WHERE singleton AND enabled);$cmd$
  );
  PERFORM cron.alter_job(job_id => v_job, active => false);
END $schedule$;

DO $postflight$ BEGIN
  IF (SELECT count(*) FROM cron.job) <> 3
     OR EXISTS (SELECT 1 FROM cron.job WHERE active)
     OR (SELECT count(*) FROM cron.job WHERE jobname='uskoci_taxonomy_postsave_tick_prod'
           AND username='postgres' AND schedule='* * * * *'
           AND command LIKE '%/functions/v1/uskoci-taxonomy-postsave-worker%') <> 1
     OR (SELECT count(*) FROM private.work_taxonomy_review_outbox_control_v1
           WHERE singleton AND NOT enabled) <> 1
  THEN
    RAISE EXCEPTION 'USKOCI_PROD_TAXONOMY_CRON_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
