\set ON_ERROR_STOP on
BEGIN;
-- Seven exact category/area simulations mirroring the anonymized skills of
-- the current test worker. All accounts, UUIDs and tasks here are SYNTHETIC;
-- these words alone are not personal identifiers or live USER row copies.
-- The requester is a DIFFERENT account unless the own-task case says otherwise.
SAVEPOINT owner_profile_match_cases;
UPDATE public.app_profiles SET skills=ARRAY['fizički poslovi','popravke','čišćenje'],
  city='Novi Sad',radius_km=10
WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET category='Čišćenje stana',required_skills='{}',
  approximate_city='Novi Sad', execution_location_mode='STATIONARY'
WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'new-requester-cleaning-same-city');
UPDATE public.needs SET category='Popravka police';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'new-requester-repair-same-city');
UPDATE public.needs SET category='Fizički poslovi';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'new-requester-physical-same-city');
UPDATE public.needs SET category='Dostava hrane';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',false,true,false,'unrelated-delivery-must-not-match');
UPDATE public.needs SET category='Električarske instalacije';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',false,true,false,'unrelated-electrician-must-not-match');
UPDATE public.needs SET category='Selidba nameštaja';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',false,true,false,'unrelated-moving-must-not-match');
UPDATE public.needs SET category='Čišćenje stana',approximate_city='Beograd';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'stationary-different-city-must-not-match');
-- When the worker has no approximate center, 10 km cannot bridge different
-- municipality names: this deliberately documents the current city-only fallback.
UPDATE public.needs SET approximate_city='Petrovaradin';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'petrovaradin_without_center_city_fallback');
UPDATE public.needs SET approximate_city='Novi Sad';
-- The dispatch's own fast-path must produce the SAME admit/deny result.
DO $owner_match$
DECLARE t jsonb;
BEGIN
 t:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',true);
 IF (t->>'matches')::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'QUALIFIED_DIFFERENT_OWNER_DISPATCH_REFUSED'; END IF;
END $owner_match$;
UPDATE public.needs SET category='Dostava hrane';
DO $owner_match$
DECLARE t jsonb;
BEGIN
 t:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',true);
 IF (t->>'matches')::boolean IS DISTINCT FROM false
   OR (t->>'service')::boolean IS DISTINCT FROM false
   THEN RAISE EXCEPTION 'UNRELATED_DIFFERENT_OWNER_DISPATCH_ADMITTED'; END IF;
END $owner_match$;
UPDATE public.needs SET category='Čišćenje stana',
  requester_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,false,'own-need-not-an-opportunity');
DO $owner_match$
DECLARE t jsonb;
BEGIN
 t:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',true);
 IF (t->>'matches')::boolean IS DISTINCT FROM false
   OR NOT (t->'hard' ? 'OWN_NEED')
   THEN RAISE EXCEPTION 'OWN_NEED_DISPATCH_ADMITTED'; END IF;
END $owner_match$;
ROLLBACK TO SAVEPOINT owner_profile_match_cases;
RELEASE SAVEPOINT owner_profile_match_cases;

-- True geographic regression. Radius and Haversine here execute the
-- read-only captured DEV helpers, while all identities/points are SYNTHETIC.
-- This proves city is a fallback ONLY when one of the coordinates is absent.
SAVEPOINT geo_radius_cases;
UPDATE public.app_profiles SET skills=ARRAY['Čišćenje'],city='Novi Sad',radius_km=10
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET requester_account_id='44444444-4444-4444-8444-444444444444',
 category='Čišćenje stana',required_skills='{}',
 execution_location_mode='STATIONARY',approximate_city='Petrovaradin',
 approximate_lat=45.2650,approximate_lng=19.8500
 WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.worker_match_preferences SET approximate_lat=45.2671,approximate_lng=19.8335
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,
 'geographic_petrovaradin_within_10km');
DO $geo_radius$
DECLARE full_doc jsonb; fast_doc jsonb;
BEGIN
 full_doc:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',false);
 fast_doc:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',true);
 IF (full_doc->>'distanceKm')::numeric NOT BETWEEN 0 AND 10
    OR (full_doc->>'effectiveRadiusKm')::numeric IS DISTINCT FROM 10
    OR (fast_doc->>'matches')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'GEOGRAPHIC_WITHIN_RADIUS_DISPATCH_DIFFERS';
 END IF;
END $geo_radius$;
-- A task in the SAME textual city must fail if its actual point is > 10 km away.
UPDATE public.needs SET approximate_city='Novi Sad',approximate_lat=45.3700
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,
 'same_city_but_outside_10km');
DO $geo_radius$
DECLARE doc jsonb;
BEGIN
 doc:=private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',true);
 IF (doc->>'matches')::boolean IS DISTINCT FROM false
    OR (doc->>'area')::boolean IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'GEOGRAPHIC_OUTSIDE_RADIUS_DISPATCH_ADMITTED';
 END IF;
END $geo_radius$;
-- Unset the worker's center: there is NO distance, so municipality text rules.
UPDATE public.worker_match_preferences SET approximate_lat=NULL,approximate_lng=NULL
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET approximate_city='Petrovaradin',approximate_lat=45.2650
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,
 'petrovaradin_without_worker_center_rejected');
UPDATE public.needs SET approximate_city='Novi Sad'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,
 'novi_sad_without_worker_center_city_fallback');
UPDATE public.needs SET execution_location_mode='REMOTE',approximate_city='Petrovaradin'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,
 'remote_task_without_center');
ROLLBACK TO SAVEPOINT geo_radius_cases;
RELEASE SAVEPOINT geo_radius_cases;

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
