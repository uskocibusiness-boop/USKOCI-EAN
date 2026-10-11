\set ON_ERROR_STOP on
-- Run ONLY in existing disposable matching/calendar PG fixture after the
-- byte-exact DEV time-tier function is replaced with worker-time-tier.candidate.sql.
-- This must not send events, invoke provider RPCs or update any live account.
BEGIN;
SAVEPOINT bounded_temporal_tiers;
UPDATE public.needs SET schedule_kind='FLEXIBLE',starts_at=NULL,
 ends_at=statement_timestamp()+interval '4 days',
 published_at=statement_timestamp(),task_timezone='Europe/Belgrade',
 category='Čišćenje stana',required_skills='{}',approximate_city='Novi Sad',
 requester_account_id='44444444-4444-4444-8444-444444444444'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET profile_status='ACTIVE',available_now=false,
 skills=ARRAY['Čišćenje'],city='Novi Sad' WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.worker_match_preferences SET timezone='Europe/Belgrade'
WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
DELETE FROM public.profile_availability_rules;
DELETE FROM public.profile_availability_windows;
DELETE FROM private.worker_calendar_events;
CREATE FUNCTION private.assert_deadline_tier(expected integer,label text)
RETURNS void LANGUAGE plpgsql AS $verify$
DECLARE actual integer; dispatched boolean;
BEGIN
 actual:=private.worker_need_time_tier_v1('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
 dispatched:=private.dispatch_cheap_candidate_admitted('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
 IF actual IS DISTINCT FROM expected OR dispatched IS DISTINCT FROM (expected IS NOT NULL)
 THEN RAISE EXCEPTION 'DEADLINE_TIER_%_tier_%_dispatch_%',label,actual,dispatched; END IF;
END $verify$;
SELECT private.assert_deadline_tier(NULL,'END_ONLY_WITHOUT_AVAILABILITY_REFUSED');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
VALUES('22222222-2222-4222-8222-222222222222',
statement_timestamp()+interval '60 minutes',statement_timestamp()+interval '120 minutes','AVAILABLE');
SELECT private.assert_deadline_tier(2,'END_ONLY_FUTURE_WINDOW_ADMITTED');
DELETE FROM public.profile_availability_windows;
UPDATE public.app_profiles SET available_now=true WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_deadline_tier(1,'END_ONLY_AVAILABLE_NOW_PRIORITY');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
VALUES('22222222-2222-4222-8222-222222222222',
statement_timestamp()-interval '5 minutes',statement_timestamp()+interval '30 minutes','UNAVAILABLE');
SELECT private.assert_deadline_tier(NULL,'END_ONLY_CURRENT_BLACKOUT');
DELETE FROM public.profile_availability_windows;
UPDATE public.app_profiles SET available_now=false WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET schedule_kind='WEEK_FLEXIBLE',starts_at=NULL,
 ends_at=statement_timestamp()+interval '4 days' WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'WEEK_DEADLINE_WITHOUT_AVAILABILITY_REFUSED');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
VALUES('22222222-2222-4222-8222-222222222222',
statement_timestamp()+interval '1 hour',statement_timestamp()+interval '2 hours','AVAILABLE');
SELECT private.assert_deadline_tier(2,'WEEK_DEADLINE_BEFORE_CUTOFF_ADMITTED');
UPDATE public.needs SET ends_at=statement_timestamp()-interval '1 minute'
WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'PAST_COMPLETION_DEADLINE_REFUSED');
DELETE FROM public.profile_availability_windows;
UPDATE public.needs SET schedule_kind='FLEXIBLE',starts_at=NULL,ends_at=NULL
WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(1,'UNBOUNDED_FLEXIBILITY_KEPT');
-- Start-only exact beginning; no fabricated finish or full-duration guarantee.
UPDATE public.needs SET schedule_kind='FIXED_WINDOW',
 starts_at=statement_timestamp()+interval '25 hours',ends_at=NULL
 WHERE id='11111111-1111-4111-8111-111111111111';
DELETE FROM public.profile_availability_windows;
DELETE FROM private.worker_calendar_events;
UPDATE public.app_profiles SET available_now=true
 WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_deadline_tier(NULL,'START_ONLY_AVAILABLE_NOW_NOT_FUTURE_PROOF');
UPDATE public.app_profiles SET available_now=false
 WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at-interval '5 minutes',starts_at+interval '5 minutes','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'START_ONLY_KNOWN_FREE_INSTANT');
INSERT INTO private.worker_calendar_events(worker_profile_id,agreement_id,starts_at,ends_at,state)
SELECT '22222222-2222-4222-8222-222222222222',
 '55555555-5555-4555-8555-555555555555',
 starts_at-interval '1 minute',starts_at+interval '1 minute','BLOCKING'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'START_ONLY_BLOCKED_AT_BEGINNING');
DELETE FROM private.worker_calendar_events;
SELECT private.assert_deadline_tier(2,'START_ONLY_UNBLOCK_RECOVERY');
UPDATE public.needs SET starts_at=statement_timestamp()-interval '1 minute'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'START_ONLY_PAST_START_CLOSED');
ROLLBACK TO SAVEPOINT bounded_temporal_tiers;
RELEASE SAVEPOINT bounded_temporal_tiers;
ROLLBACK;
