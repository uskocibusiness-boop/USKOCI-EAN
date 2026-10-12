\set ON_ERROR_STOP on
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'old_matching_cleaner');
SELECT private.check_fit('33333333-3333-4333-8333-333333333333',true,true,true,'old_incorrectly_matches_mover');
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure)
 <> 'ab221f0091d78856bb42f702ddecd016' THEN RAISE EXCEPTION 'BASELINE_SOURCE_DRIFT'; END IF;
END $$;
