\set ON_ERROR_STOP on
-- Real canonical SQL event builder, fake DB rows, NO external push provider.
BEGIN;
SAVEPOINT real_notification_cases;
UPDATE public.needs SET status='PUBLISHED',revision=1,required_slots=1,
 category='Čišćenje stana',required_skills='{}',approximate_city='Novi Sad',
 execution_location_mode='STATIONARY',schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,urgent=false,urgent_expires_at=NULL,
 remaining_search_closed_at=NULL,response_deadline=NULL,
 requester_account_id='44444444-4444-4444-8444-444444444444'
 WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET profile_status='ACTIVE'
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.worker_match_preferences SET proactive_notifications=true,
 approximate_lat=NULL,approximate_lng=NULL,timezone='Europe/Belgrade'
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
-- Default explicit WORKER opt-in: creates an IN_APP row and a PUSH row,
-- NOT an OS notification; nothing outside PG has received either.
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>1 THEN
  RAISE EXCEPTION 'REAL_NOTIFICATION_FIRST_WAVE_%',wave; END IF;
 IF (SELECT count(*) FROM public.notification_deliveries)<>2
    OR (SELECT count(*) FROM public.user_activity_events)<>1
    OR (SELECT count(*) FROM public.notification_deliveries WHERE state='CREATED')<>2
    OR NOT EXISTS (SELECT 1 FROM public.notification_deliveries
                   WHERE channel='PUSH' AND title='Nova prilika koja ti može odgovarati')
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_TWO_LOCAL_CHANNEL_ROWS'; END IF;
END $real_notification$;
-- Retrying the same revision changes nothing.
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>0
 OR (SELECT count(*) FROM public.notification_deliveries)<>2
 OR (SELECT count(*) FROM public.user_activity_events)<>1
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_DUPLICATE_DETECTED_%',wave; END IF;
END $real_notification$;
-- Disable ONLY the opportunity category: both channel rows get CATEGORY_OFF,
-- while the underlying task opportunity remains available to the worker.
UPDATE public.notification_preferences SET opportunities_enabled=false
 WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND role_context='WORKER';
UPDATE public.needs SET revision=2 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>1
 OR (SELECT count(*) FROM public.notification_deliveries d
     JOIN public.user_activity_events e ON e.id=d.event_id
     WHERE e.entity_version=2 AND d.state='SUPPRESSED'
       AND d.suppression_reason='CATEGORY_OFF')<>2
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_OPPORTUNITIES_OFF_%',wave; END IF;
END $real_notification$;
-- Push disabled but in-app on: only PUSH is suppressed.
UPDATE public.notification_preferences SET opportunities_enabled=true,push_enabled=false
 WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND role_context='WORKER';
UPDATE public.needs SET revision=3 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>1
 OR NOT EXISTS (SELECT 1 FROM public.notification_deliveries d
    JOIN public.user_activity_events e ON e.id=d.event_id
    WHERE e.entity_version=3 AND d.channel='PUSH' AND d.state='SUPPRESSED'
     AND d.suppression_reason='PUSH_OFF')
 OR NOT EXISTS (SELECT 1 FROM public.notification_deliveries d
    JOIN public.user_activity_events e ON e.id=d.event_id
    WHERE e.entity_version=3 AND d.channel='IN_APP' AND d.state='CREATED')
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_PUSH_OFF_%',wave; END IF;
END $real_notification$;
-- Equal quiet start/end is an all-clock quiet range with the canonical
-- midnight-crossing comparison; deterministically suppressed at any hour.
UPDATE public.notification_preferences SET push_enabled=true,
 quiet_hours_enabled=true,quiet_start=time '12:00',
 quiet_end=time '12:00',quiet_timezone='Europe/Belgrade',
 urgent_overrides_quiet_hours=false
 WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND role_context='WORKER';
UPDATE public.needs SET revision=4 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>1
 OR NOT EXISTS(SELECT 1 FROM public.notification_deliveries d
   JOIN public.user_activity_events e ON e.id=d.event_id
   WHERE e.entity_version=4 AND d.channel='PUSH' AND d.state='SUPPRESSED'
    AND d.suppression_reason='QUIET_HOURS')
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_QUIET_HOURS_%',wave; END IF;
END $real_notification$;
-- Explicit urgent opt-in overrides quiet hours only for HITNO.
UPDATE public.notification_preferences SET urgent_overrides_quiet_hours=true
 WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND role_context='WORKER';
UPDATE public.needs SET revision=5,urgent=true,
 urgent_expires_at=statement_timestamp()+interval '2 hours'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_notification$
DECLARE wave jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 IF (wave->>'inserted')::integer<>1
 OR NOT EXISTS(SELECT 1 FROM public.notification_deliveries d
   JOIN public.user_activity_events e ON e.id=d.event_id
   WHERE e.entity_version=5 AND d.channel='PUSH' AND d.state='CREATED'
     AND d.priority='HIGH')
 OR (SELECT count(*) FROM public.notification_deliveries)<>10
 OR (SELECT count(*) FROM public.user_activity_events)<>5
 THEN RAISE EXCEPTION 'REAL_NOTIFICATION_URGENT_OVERRIDE_%',wave; END IF;
END $real_notification$;
-- Nothing survives this transaction. No provider or push token exists in PG16.
ROLLBACK TO SAVEPOINT real_notification_cases;
RELEASE SAVEPOINT real_notification_cases;
ROLLBACK;
