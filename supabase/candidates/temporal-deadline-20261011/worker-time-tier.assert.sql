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
-- FLEXIBLE_START_BOUND: unconstrained flexibility may match everyone, but
-- a stated earliest start must NOT become an unconditional tier-1 match.
-- The worker's upcoming calendar, NOT today's available-now toggle, admits
-- future starts in FLEXIBLE and REMOTE_ANYTIME.
DELETE FROM public.profile_availability_windows;
DELETE FROM private.worker_calendar_events;
UPDATE public.app_profiles SET available_now=true
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET schedule_kind='FLEXIBLE',
 starts_at=statement_timestamp()+interval '2 days',ends_at=NULL
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'FLEXIBLE_START_ONLY_AVAILABLE_NOW_NOT_FUTURE');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at+interval '1 hour',starts_at+interval '2 hours','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'FLEXIBLE_START_ONLY_SCHEDULED_ADMITTED');
DELETE FROM public.profile_availability_windows;
UPDATE public.needs SET starts_at=statement_timestamp()-interval '5 minutes'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(1,'FLEXIBLE_START_ONLY_AFTER_START_AVAILABLE_NOW');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
VALUES('22222222-2222-4222-8222-222222222222',
 statement_timestamp()-interval '1 minute',statement_timestamp()+interval '1 hour','UNAVAILABLE');
SELECT private.assert_deadline_tier(NULL,'FLEXIBLE_START_ONLY_NOW_BLOCKED');
DELETE FROM public.profile_availability_windows;

-- A bounded flexible interval has both authoritative limits. A worker free
-- now is not evidence for a job starting two days from now.
UPDATE public.needs SET schedule_kind='FLEXIBLE',
 starts_at=statement_timestamp()+interval '2 days',
 ends_at=statement_timestamp()+interval '4 days'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'FLEXIBLE_BOUNDED_FUTURE_NO_WINDOW');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at+interval '20 minutes',starts_at+interval '1 hour','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'FLEXIBLE_BOUNDED_INSIDE_WINDOW');
UPDATE public.profile_availability_windows SET
 starts_at=(SELECT ends_at+interval '1 hour' FROM public.needs
  WHERE id='11111111-1111-4111-8111-111111111111'),
 ends_at=(SELECT ends_at+interval '2 hours' FROM public.needs
  WHERE id='11111111-1111-4111-8111-111111111111');
SELECT private.assert_deadline_tier(NULL,'FLEXIBLE_BOUNDED_AFTER_END_REFUSED');
DELETE FROM public.profile_availability_windows;

-- A remote job is still bound by its explicitly declared earliest start.
UPDATE public.needs SET schedule_kind='REMOTE_ANYTIME',
 starts_at=statement_timestamp()+interval '3 days',ends_at=NULL
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'REMOTE_FUTURE_START_AVAILABLE_NOW_NOT_ENOUGH');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at+interval '5 hours',starts_at+interval '6 hours','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'REMOTE_FUTURE_START_CALENDAR_CONFIRMED');
DELETE FROM public.profile_availability_windows;
-- TODAY_FUTURE_START: "mogu odmah" is false before the requested start,
-- even when the worker toggled Available now. A future calendar slot is valid.
DELETE FROM public.profile_availability_windows;
UPDATE public.app_profiles SET available_now=true
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET schedule_kind='TODAY_FLEXIBLE',
 published_at=statement_timestamp(),task_timezone='Europe/Belgrade',
 starts_at=statement_timestamp()+interval '30 minutes',
 ends_at=statement_timestamp()+interval '2 hours'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TODAY_FUTURE_START_NOT_AVAILABLE_NOW');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at+interval '10 minutes',starts_at+interval '20 minutes','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'TODAY_FUTURE_START_SCHEDULED');
UPDATE public.needs SET starts_at=statement_timestamp()-interval '5 minutes'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(1,'TODAY_ALREADY_STARTED_AVAILABLE_NOW');

-- TOMORROW_END_ONLY: a tomorrow deadline must look inside tomorrow, not
-- accidentally admit current availability or deny a scheduled worker.
DELETE FROM public.profile_availability_windows;
UPDATE public.needs SET schedule_kind='TOMORROW_FLEXIBLE',
 published_at=statement_timestamp(),starts_at=NULL,
 ends_at=(
  ((((statement_timestamp() at time zone 'Europe/Belgrade')::date+1)::timestamp + interval '10 hours')
  at time zone 'Europe/Belgrade'))
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TOMORROW_END_ONLY_NOW_NOT_ENOUGH');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 (d + time '10:00') at time zone 'Europe/Belgrade',
 (d + time '11:00') at time zone 'Europe/Belgrade','AVAILABLE'
FROM (SELECT (statement_timestamp() at time zone 'Europe/Belgrade')::date AS d) today;
SELECT private.assert_deadline_tier(NULL,'TOMORROW_END_ONLY_TODAY_AVAILABILITY_REFUSED');
DELETE FROM public.profile_availability_windows;
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 ends_at-interval '2 hours',ends_at-interval '1 hour','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'TOMORROW_END_ONLY_SCHEDULED_ADMITTED');
UPDATE public.needs SET ends_at=(
 ((((statement_timestamp() at time zone 'Europe/Belgrade')::date+1)::timestamp - interval '1 minute')
 at time zone 'Europe/Belgrade'))
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TOMORROW_END_ONLY_WRONG_DAY_REFUSED');
DELETE FROM public.profile_availability_windows;
-- A tomorrow task with an explicit earliest start but no finishing time must
-- match only after that start, inside the published tomorrow calendar day.
-- "Available now" on the worker is never evidence of tomorrow availability.
DELETE FROM public.profile_availability_windows;
DELETE FROM private.worker_calendar_events;
UPDATE public.app_profiles SET available_now=true
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET schedule_kind='TOMORROW_FLEXIBLE',
 published_at=statement_timestamp(),task_timezone='Europe/Belgrade',
 starts_at=(
    (((statement_timestamp() at time zone 'Europe/Belgrade')::date + 1)::timestamp + interval '10 hours')
    at time zone 'Europe/Belgrade'
 ),ends_at=NULL
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TOMORROW_PARTIAL_NO_SCHEDULE_REFUSED');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at-interval '20 minutes',starts_at-interval '10 minutes','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TOMORROW_PARTIAL_BEFORE_START_REFUSED');
UPDATE public.profile_availability_windows SET
 starts_at=(SELECT starts_at-interval '5 minutes' FROM public.needs
   WHERE id='11111111-1111-4111-8111-111111111111'),
 ends_at=(SELECT starts_at+interval '5 minutes' FROM public.needs
   WHERE id='11111111-1111-4111-8111-111111111111');
SELECT private.assert_deadline_tier(2,'TOMORROW_PARTIAL_AFTER_START_ADMITTED');
UPDATE public.needs SET starts_at=starts_at+interval '2 days'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'TOMORROW_PARTIAL_OUTSIDE_DAY_REFUSED');
-- Week with an explicit earliest start must not accept an unscheduled worker.
-- The disposable fixture anchors its publication to an upcoming Monday so the
-- assertion works even when CI executes late on Sunday or during DST changes.
DELETE FROM public.profile_availability_windows;
UPDATE public.needs SET schedule_kind='WEEK_FLEXIBLE',
 published_at=((date_trunc('week',statement_timestamp() at time zone 'Europe/Belgrade') + interval '7 days') at time zone 'Europe/Belgrade'),
 starts_at=((date_trunc('week',statement_timestamp() at time zone 'Europe/Belgrade') + interval '7 days 1 hour') at time zone 'Europe/Belgrade'),
 ends_at=NULL WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'WEEK_PARTIAL_NO_SCHEDULE_REFUSED');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at-interval '2 minutes', starts_at+interval '15 minutes','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(2,'WEEK_PARTIAL_AFTER_START_ADMITTED');
UPDATE public.needs SET starts_at=starts_at+interval '8 days'
 WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_deadline_tier(NULL,'WEEK_PARTIAL_OUTSIDE_WEEK_REFUSED');
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
