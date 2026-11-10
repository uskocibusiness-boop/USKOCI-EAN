-- Prepare the two established production ticks without starting any work.
-- The taxonomy post-save worker is DEV-only and must not be scheduled here.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $preflight$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283'
     OR current_user <> 'postgres'
     OR to_regprocedure('private.marketplace_tick(integer,timestamp with time zone)') IS NULL
     OR to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net')
     OR EXISTS (SELECT 1 FROM cron.job)
     OR EXISTS (SELECT 1 FROM vault.secrets WHERE name IN ('uskoci_edge_base_url','uskoci_edge_worker_key'))
  THEN
    RAISE EXCEPTION 'USKOCI_PROD_CRON_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;

-- This address is public, but the current Edge worker reads it through Vault.
SELECT vault.create_secret(
  'https://fvyqqudqvizjrxaflhex.supabase.co',
  'uskoci_edge_base_url',
  'USKOCI-PROD Edge base URL for the existing worker tick'
);

DO $schedule$ DECLARE
  v_marketplace bigint;
  v_edge bigint;
BEGIN
  v_marketplace := cron.schedule(
    'uskoci_marketplace_tick', '* * * * *',
    'select private.marketplace_tick(25);'
  );
  PERFORM cron.alter_job(job_id => v_marketplace, active => false);

  v_edge := cron.schedule(
    'uskoci_edge_workers', '* * * * *',
    'select private.edge_worker_tick_v5()'
  );
  PERFORM cron.alter_job(job_id => v_edge, active => false);
END $schedule$;

DO $postflight$ BEGIN
  IF (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job WHERE NOT active AND username='postgres'
           AND schedule='* * * * *'
           AND ((jobname='uskoci_marketplace_tick'
                 AND command='select private.marketplace_tick(25);')
             OR (jobname='uskoci_edge_workers'
                 AND command='select private.edge_worker_tick_v5()'))) <> 2
     OR (SELECT count(*) FROM vault.decrypted_secrets
           WHERE name='uskoci_edge_base_url'
             AND decrypted_secret='https://fvyqqudqvizjrxaflhex.supabase.co') <> 1
     OR EXISTS (SELECT 1 FROM vault.secrets WHERE name='uskoci_edge_worker_key')
  THEN
    RAISE EXCEPTION 'USKOCI_PROD_CRON_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
