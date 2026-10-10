\set ON_ERROR_STOP on
-- Stage 8: transactionally execute exact canonical DEV dispatch_next_wave SQL.
-- Everything below is a fake account/need and a fake event sink in disposable PG.
BEGIN;
SAVEPOINT synthetic_wave_cases;
UPDATE public.needs SET status='PUBLISHED',revision=1,required_slots=1,
 category='Čišćenje stana',required_skills='{}',approximate_city='Novi Sad',
 execution_location_mode='STATIONARY',schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,remaining_search_closed_at=NULL,
 response_deadline=NULL,urgent=false,requester_account_id='44444444-4444-4444-8444-444444444444'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET profile_status='ACTIVE',available_now=false
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.worker_match_preferences SET proactive_notifications=true,
 timezone='Europe/Belgrade',approximate_lat=NULL,approximate_lng=NULL
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
-- Should notify EXACTLY one eligible synthetic worker for the new task.
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF result->>'status'<>'SENT' OR (result->>'inserted')::integer<>1 OR result->>'mode'<>'ALL'
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_FIRST_SEND_%',result; END IF;
 IF (SELECT count(*) FROM public.opportunity_deliveries)<>1
    OR (SELECT count(*) FROM public.user_activity_events WHERE event_type='OPPORTUNITY_AVAILABLE')<>1
    OR EXISTS(SELECT 1 FROM public.user_activity_events
       WHERE recipient_user_id<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_WRONG_RECIPIENT_OR_COUNT'; END IF;
END $wave$;
-- Same need revision MUST NOT yield a second opportunity or event.
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>0
    OR (SELECT count(*) FROM public.user_activity_events)<>1
    OR (SELECT count(*) FROM public.opportunity_deliveries)<>1
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_DUPLICATE_%',result; END IF;
END $wave$;
-- A new revision with an UNRELATED category must not notify the worker.
UPDATE public.needs SET revision=2,category='Dostava hrane'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>0 OR (SELECT count(*) FROM public.user_activity_events)<>1
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_UNRELATED_%',result; END IF;
END $wave$;
-- New matching revision is allowed, but generates a DIFFERENT revision key.
UPDATE public.needs SET revision=3,category='Čišćenje stana'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>1
    OR (SELECT count(*) FROM public.user_activity_events)<>2
    OR (SELECT count(*) FROM public.opportunity_deliveries)<>2
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_NEW_REVISION_%',result; END IF;
END $wave$;
-- OWN_NEED is always refused even with correct skills/city/clock.
UPDATE public.needs SET revision=4,requester_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>0 OR (SELECT count(*) FROM public.user_activity_events)<>2
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_OWN_TASK_%',result; END IF;
END $wave$;
-- Suspended/not-proactive worker is excluded by canonical fast prefilter.
UPDATE public.needs SET revision=5,requester_account_id='44444444-4444-4444-8444-444444444444'
 WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.worker_match_preferences SET proactive_notifications=false
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>0 OR (SELECT count(*) FROM public.user_activity_events)<>2
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_PROACTIVE_DISABLED_%',result; END IF;
END $wave$;
UPDATE public.worker_match_preferences SET proactive_notifications=true
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
UPDATE public.app_profiles SET profile_status='SUSPENDED'
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (result->>'inserted')::integer<>0 OR (SELECT count(*) FROM public.user_activity_events)<>2
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_SUSPENDED_%',result; END IF;
END $wave$;
UPDATE public.app_profiles SET profile_status='ACTIVE'
 WHERE id='22222222-2222-4222-8222-222222222222';
-- User closed remaining search: function returns STOPPED before inserting anything.
UPDATE public.needs SET remaining_search_closed_at=statement_timestamp()
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $wave$
DECLARE result jsonb;
BEGIN
 result:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF result->>'reason'<>'REMAINING_SEARCH_CLOSED'
    OR (result->>'inserted')::integer<>0
 THEN RAISE EXCEPTION 'LIVE_WAVE_SIM_CLOSED_SEARCH_%',result; END IF;
END $wave$;
-- Everything is discarded; this file cannot create a live notification.
ROLLBACK TO SAVEPOINT synthetic_wave_cases;
RELEASE SAVEPOINT synthetic_wave_cases;
ROLLBACK;
