\set ON_ERROR_STOP on
BEGIN;
-- The AI category must never become a wildcard for an unrelated worker.
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'category_cleaner');
SELECT private.check_fit('33333333-3333-4333-8333-333333333333',false,true,false,'category_excludes_mover');
UPDATE public.needs SET category='Nepoznato',required_skills='{}';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',false,true,false,'unknown_category_not_wildcard');
UPDATE public.needs SET category=NULL;
SELECT private.check_fit('33333333-3333-4333-8333-333333333333',false,true,false,'null_category_not_wildcard');
UPDATE public.needs SET category='Čišćenje stana',required_skills=ARRAY['Selidbe'];
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',false,true,false,'explicit_requirement_overrides_category');
SELECT private.check_fit('33333333-3333-4333-8333-333333333333',true,true,true,'explicit_requirement_matches_mover');
UPDATE public.needs SET required_skills='{}',approximate_city='Beograd';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'different_city_blocks');
UPDATE public.needs SET execution_location_mode='REMOTE';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'remote_does_not_require_city');
UPDATE public.needs SET execution_location_mode='ONSITE',approximate_city='Novi Sad';
UPDATE private.synthetic_time SET allowed=false WHERE pid='22222222-2222-4222-8222-222222222222';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,false,'time_blocks');
UPDATE private.synthetic_time SET allowed=true WHERE pid='22222222-2222-4222-8222-222222222222';
UPDATE public.app_profiles SET exclusions=ARRAY['Čišćenje'] WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,false,'exclusion_blocks');
UPDATE public.app_profiles SET exclusions='{}' WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET requester_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,false,'own_task_blocks');
UPDATE public.needs SET requester_account_id='44444444-4444-4444-8444-444444444444';
UPDATE public.app_profiles SET profile_status='SUSPENDED' WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,false,'suspended_worker_blocks');
DO $$ DECLARE doc jsonb; BEGIN
 doc := private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);
 IF (doc->>'service')::boolean IS DISTINCT FROM false OR (doc->>'matches')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'DISPATCH_FIRST_REFUSAL_DIFFERS'; END IF;
END $$;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure)
 <> 'd18c47226723ffbbec474aa4547e1af1' THEN RAISE EXCEPTION 'CANDIDATE_SOURCE_DRIFT'; END IF;
END $$;
ROLLBACK;
