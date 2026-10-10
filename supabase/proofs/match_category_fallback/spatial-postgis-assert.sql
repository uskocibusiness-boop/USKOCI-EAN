\set ON_ERROR_STOP on
-- Actual PostGIS ST_DWithin and KNN <-> in a disposable PostgreSQL 16 DB.
-- All points and profiles below are fake examples near Novi Sad, never real
-- user coordinates. The candidate loop and match prefilter use canonical SQL.
BEGIN;
SAVEPOINT postgis_real_search;
UPDATE public.needs SET category='Čišćenje stana',required_skills='{}',
 execution_location_mode='STATIONARY',approximate_city='Novi Sad',
 approximate_lat=45.2650,approximate_lng=19.8500,
 approx_geog=extensions.ST_SetSRID(extensions.ST_MakePoint(19.8500,45.2650),4326)::extensions.geography,
 requester_account_id='44444444-4444-4444-8444-444444444444'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET city='Novi Sad',radius_km=10,
 profile_status='ACTIVE',skills=ARRAY['Čišćenje'],exclusions='{}'
WHERE id IN ('22222222-2222-4222-8222-222222222222',
             '33333333-3333-4333-8333-333333333333');
-- Two real spatial points: second one is MUCH nearer to the task.
UPDATE public.worker_match_preferences SET
 approximate_lat=case
   when worker_profile_id='22222222-2222-4222-8222-222222222222' then 45.2671
   else 45.2651 end,
 approximate_lng=case
   when worker_profile_id='22222222-2222-4222-8222-222222222222' then 19.8335
   else 19.8492 end,
 approximate_geog=case
   when worker_profile_id='22222222-2222-4222-8222-222222222222' then
    extensions.ST_SetSRID(extensions.ST_MakePoint(19.8335,45.2671),4326)::extensions.geography
   else
    extensions.ST_SetSRID(extensions.ST_MakePoint(19.8492,45.2651),4326)::extensions.geography end;
DO $real_geo$
DECLARE got uuid[]; distance_km double precision;
BEGIN
 distance_km := extensions.ST_Distance(
  (select n.approx_geog from public.needs n
    where n.id='11111111-1111-4111-8111-111111111111'),
  (select pref.approximate_geog from public.worker_match_preferences pref
    where pref.worker_profile_id='33333333-3333-4333-8333-333333333333')) / 1000.0;
 IF distance_km <= 0 OR distance_km>=1
 THEN RAISE EXCEPTION 'REAL_POSTGIS_DISTANCE_UNEXPECTED_%',distance_km; END IF;
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY[
   '33333333-3333-4333-8333-333333333333'::uuid,
   '22222222-2222-4222-8222-222222222222'::uuid]
 THEN RAISE EXCEPTION 'REAL_POSTGIS_NEAREST_FIRST_%',got; END IF;
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids(
  '11111111-1111-4111-8111-111111111111',1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['33333333-3333-4333-8333-333333333333'::uuid]
 THEN RAISE EXCEPTION 'REAL_POSTGIS_LIMIT_ONE_%',got; END IF;
END $real_geo$;
-- Exclude nearest via 24h normal notification cap. Fallback picks second worker.
INSERT INTO public.user_activity_events(recipient_user_id,recipient_role,event_type,urgency)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','WORKER',
 'OPPORTUNITY_AVAILABLE','NORMAL');
DO $real_geo$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',1,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['22222222-2222-4222-8222-222222222222'::uuid]
 THEN RAISE EXCEPTION 'REAL_POSTGIS_DAILY_CAP_NEXT_WORKER_%',got; END IF;
END $real_geo$;
DELETE FROM public.user_activity_events;
-- More than 300km from synthetic Novi Sad point => excluded by actual ST_DWithin.
UPDATE public.worker_match_preferences SET
 approximate_lat=48.2,approximate_lng=19.85,
 approximate_geog=extensions.ST_SetSRID(extensions.ST_MakePoint(19.85,48.2),4326)::extensions.geography
WHERE worker_profile_id='33333333-3333-4333-8333-333333333333';
DO $real_geo$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['22222222-2222-4222-8222-222222222222'::uuid]
 THEN RAISE EXCEPTION 'REAL_POSTGIS_300KM_GATE_%',got; END IF;
END $real_geo$;
-- No worker center: real candidate fallback enumerates the active worker,
-- while actual area matcher uses same-city text rather than made-up GPS.
UPDATE public.worker_match_preferences
 SET approximate_lat=NULL,approximate_lng=NULL,approximate_geog=NULL
WHERE worker_profile_id='33333333-3333-4333-8333-333333333333';
DO $real_geo$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY[
   '22222222-2222-4222-8222-222222222222'::uuid,
   '33333333-3333-4333-8333-333333333333'::uuid]
 THEN RAISE EXCEPTION 'REAL_POSTGIS_NO_CENTER_CITY_FALLBACK_%',got; END IF;
END $real_geo$;
UPDATE public.needs SET category='Dostava hrane'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_geo$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF coalesce(cardinality(got),0)<>0
 THEN RAISE EXCEPTION 'REAL_POSTGIS_UNRELATED_SERVICE_ADMITTED_%',got; END IF;
END $real_geo$;
ROLLBACK TO SAVEPOINT postgis_real_search;
RELEASE SAVEPOINT postgis_real_search;
ROLLBACK;
