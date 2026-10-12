\set ON_ERROR_STOP on
-- Actual canonical candidate loop + 24-hour worker cap; only *synthetic*
-- geography operator/ST_DWithin, synthetic rows, no real PostGIS indexing.
BEGIN;
SAVEPOINT candidate_loop_cases;
UPDATE public.needs SET status='PUBLISHED',revision=9,required_slots=1,
 category='Čišćenje stana',required_skills='{}',approximate_city='Novi Sad',
 approximate_lat=45.2650,approximate_lng=19.8500,
 approx_geog=0::numeric::extensions.geography,
 execution_location_mode='STATIONARY',schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,urgent=false,urgent_expires_at=NULL,
 remaining_search_closed_at=NULL,response_deadline=NULL,
 requester_account_id='44444444-4444-4444-8444-444444444444'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET profile_status='ACTIVE',rating_worker=NULL,
 exclusions='{}',skills=ARRAY['Čišćenje'],city='Novi Sad',radius_km=10
WHERE id IN ('22222222-2222-4222-8222-222222222222',
             '33333333-3333-4333-8333-333333333333');
UPDATE public.worker_match_preferences
 SET proactive_notifications=true,same_day_urgent_notifications=true,
 timezone='Europe/Belgrade',
 approximate_lat=45.2671,approximate_lng=19.8335,
 approximate_geog=case
  when worker_profile_id='22222222-2222-4222-8222-222222222222'
    then 1000::numeric::extensions.geography
  else 2000::numeric::extensions.geography end;
DO $candidate$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY[
   '22222222-2222-4222-8222-222222222222'::uuid,
   '33333333-3333-4333-8333-333333333333'::uuid]
 THEN RAISE EXCEPTION 'CANDIDATE_TWO_NEAREST_IN_ORDER_%',got; END IF;
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids(
  '11111111-1111-4111-8111-111111111111',1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['22222222-2222-4222-8222-222222222222'::uuid]
 THEN RAISE EXCEPTION 'CANDIDATE_LIMIT_ONE_%',got; END IF;
END $candidate$;
-- Actual notify_room_v1b counts NORMAL proactive events during last 24 h.
INSERT INTO public.user_activity_events(recipient_user_id,event_type,
 entity_id,entity_version,dedupe_key,urgency,recipient_role)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OPPORTUNITY_AVAILABLE',
 '11111111-1111-4111-8111-111111111111',1,'test-cap-primary','NORMAL','WORKER');
DO $candidate$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',1,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['33333333-3333-4333-8333-333333333333'::uuid]
 THEN RAISE EXCEPTION 'CANDIDATE_CAP_ONE_SKIPS_PRIMARY_%',got; END IF;
END $candidate$;
-- Urgent events do not consume the NORMAL daily budget.
INSERT INTO public.user_activity_events(recipient_user_id,event_type,
 entity_id,entity_version,dedupe_key,urgency,recipient_role)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','OPPORTUNITY_AVAILABLE',
 '11111111-1111-4111-8111-111111111111',1,'test-cap-urgent','HITNO','WORKER');
DO $candidate$
DECLARE ok boolean;
BEGIN
 ok:=private.worker_notify_room_v1b('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1);
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'CANDIDATE_URGENT_NOT_EXEMPT'; END IF;
END $candidate$;
-- After a NORMAL event on the second worker, cap rejects both.
INSERT INTO public.user_activity_events(recipient_user_id,event_type,
 entity_id,entity_version,dedupe_key,urgency,recipient_role)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','OPPORTUNITY_AVAILABLE',
 '11111111-1111-4111-8111-111111111111',2,'test-cap-normal','NORMAL','WORKER');
DO $candidate$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF coalesce(cardinality(got),0)<>0
 THEN RAISE EXCEPTION 'CANDIDATE_CAP_REJECTS_BOTH_%',got; END IF;
END $candidate$;
DELETE FROM public.user_activity_events;
-- Geometry prefilter's 300-km broad gate uses synthetic one-dimensional meters;
-- actual physical PostGIS correctness is NOT claimed by this test.
UPDATE public.worker_match_preferences
 SET approximate_geog=350001::numeric::extensions.geography
 WHERE worker_profile_id='33333333-3333-4333-8333-333333333333';
DO $candidate$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF got IS DISTINCT FROM ARRAY['22222222-2222-4222-8222-222222222222'::uuid]
 THEN RAISE EXCEPTION 'CANDIDATE_GEO_PREFILTER_%',got; END IF;
END $candidate$;
UPDATE public.worker_match_preferences
 SET approximate_geog=2000::numeric::extensions.geography
 WHERE worker_profile_id='33333333-3333-4333-8333-333333333333';
UPDATE public.needs SET category='Dostava hrane'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $candidate$
DECLARE got uuid[];
BEGIN
 SELECT array(select worker_profile_id FROM private.candidate_profile_ids_v1b(
  '11111111-1111-4111-8111-111111111111',2,1)) INTO got;
 IF coalesce(cardinality(got),0)<>0
 THEN RAISE EXCEPTION 'CANDIDATE_UNRELATED_SKILL_NOT_BLOCKED_%',got; END IF;
END $candidate$;
UPDATE public.needs SET category='Čišćenje stana';
-- One admitted worker for a complete wave using the real candidate SQL,
-- real scorer, real event builder but a FAKE geometry interface.
UPDATE public.app_profiles SET skills=ARRAY['Selidbe']
 WHERE id='33333333-3333-4333-8333-333333333333';
DO $candidate$
DECLARE wave jsonb; recipient uuid;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 SELECT recipient_user_id INTO recipient FROM public.user_activity_events
 WHERE event_type='OPPORTUNITY_AVAILABLE';
 IF (wave->>'inserted')::integer IS DISTINCT FROM 1
 OR recipient IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
 OR (SELECT count(*) FROM public.opportunity_deliveries)<>1
 THEN RAISE EXCEPTION 'CANDIDATE_FULL_LOCAL_WAVE_%_recipient_%',wave,recipient; END IF;
END $candidate$;
ROLLBACK TO SAVEPOINT candidate_loop_cases;
RELEASE SAVEPOINT candidate_loop_cases;
ROLLBACK;
