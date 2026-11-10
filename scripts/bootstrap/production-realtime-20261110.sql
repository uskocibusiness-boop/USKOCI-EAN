-- Match the active DEV agreement invalidation publication on empty PROD.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $preflight$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283'
     OR current_user <> 'postgres'
     OR to_regclass('public.agreement_invalidations_v1') IS NULL
     OR (SELECT relrowsecurity FROM pg_class WHERE oid='public.agreement_invalidations_v1'::regclass) IS DISTINCT FROM true
     OR NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     OR EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'USKOCI_PROD_REALTIME_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agreement_invalidations_v1;
DO $postflight$ BEGIN
  IF (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename='agreement_invalidations_v1') <> 1
     OR (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime') <> 1 THEN
    RAISE EXCEPTION 'USKOCI_PROD_REALTIME_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
