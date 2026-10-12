\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 only. The six calendar functions in this stage
-- are unchanged, read-only captured canonical DEV definitions, NOT stubs.
-- Task, worker, location and availability data are all synthetic.
BEGIN;
SAVEPOINT true_calendar_cases;
CREATE FUNCTION private.assert_true_calendar(expected_tier integer, expected_dispatch boolean, label text)
RETURNS void LANGUAGE plpgsql AS $cal$
DECLARE tier integer; dispatched boolean;
BEGIN
 tier:=private.worker_need_time_tier_v1(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 dispatched:=private.dispatch_cheap_candidate_admitted(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF tier IS DISTINCT FROM expected_tier OR dispatched IS DISTINCT FROM expected_dispatch THEN
  RAISE EXCEPTION 'TRUE_CALENDAR_PROOF_%_tier_%_dispatch_%',label,tier,dispatched;
 END IF;
END $cal$;
-- "Bilo kad" has no complete future window: real time function returns tier 1.
UPDATE public.needs SET schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,published_at=statement_timestamp(),
 task_timezone='Europe/Belgrade',category='Čišćenje stana',
 required_skills='{}',approximate_city='Novi Sad',
 requester_account_id='44444444-4444-4444-8444-444444444444',
 execution_location_mode='STATIONARY';
UPDATE public.app_profiles SET profile_status='ACTIVE',available_now=false
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.worker_match_preferences SET timezone='Europe/Belgrade'
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_true_calendar(1,true,'flexible_anytime_does_not_need_schedule');
-- No stored availability should reject a future fixed window.
UPDATE public.needs SET schedule_kind='FIXED_WINDOW',
 starts_at=statement_timestamp()+interval '25 hours',
 ends_at=statement_timestamp()+interval '26 hours 30 minutes';
SELECT private.assert_true_calendar(NULL,false,'fixed_future_without_availability');
-- An explicitly available window admits this exact appointment as tier 2.
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at-interval '5 minutes',ends_at+interval '5 minutes','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_true_calendar(2,true,'fixed_future_with_available_window');
-- One blocked Dogovor interval subtracts from real multirange availability.
INSERT INTO private.worker_calendar_events(worker_profile_id,agreement_id,starts_at,ends_at,state)
SELECT '22222222-2222-4222-8222-222222222222',
 '55555555-5555-4555-8555-555555555555',
 starts_at+interval '10 minutes',starts_at+interval '30 minutes','BLOCKING'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_true_calendar(NULL,false,'blocked_agreement_intersects_fixed');
DELETE FROM private.worker_calendar_events;
SELECT private.assert_true_calendar(2,true,'unblocked_agreement_recovers');
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at+interval '15 minutes',starts_at+interval '30 minutes','UNAVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_true_calendar(NULL,false,'unavailable_window_overrides_available');
DELETE FROM public.profile_availability_windows;
-- Weekly rule: future local 10:00-11:00; real weekday and timezone math.
UPDATE public.needs SET
 starts_at=(((statement_timestamp() at time zone 'Europe/Belgrade')::date+2)
             +time '10:00') at time zone 'Europe/Belgrade',
 ends_at=(((statement_timestamp() at time zone 'Europe/Belgrade')::date+2)
           +time '11:00') at time zone 'Europe/Belgrade';
INSERT INTO public.profile_availability_rules(profile_id,weekdays,start_time,end_time,starts_on,active)
SELECT '22222222-2222-4222-8222-222222222222',
 ARRAY[extract(dow from (starts_at at time zone 'Europe/Belgrade'))::integer],
 time '09:00',time '12:00',
 ((statement_timestamp() at time zone 'Europe/Belgrade')::date-1),true
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
SELECT private.assert_true_calendar(2,true,'belgrade_weekly_rule_covers_fixed');
UPDATE public.profile_availability_rules SET active=false;
SELECT private.assert_true_calendar(NULL,false,'disabled_weekly_rule_refuses');
UPDATE public.profile_availability_rules SET active=true;
UPDATE public.worker_match_preferences SET timezone='Invalid/Nonexistent'
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_true_calendar(NULL,false,'unknown_worker_timezone_refuses');
UPDATE public.worker_match_preferences SET timezone='Europe/Belgrade'
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_true_calendar(2,true,'timezone_restored');
DELETE FROM public.profile_availability_rules;
-- An ON-state means a TODAY task can be tier 1, but Dogovor at this instant
-- prevents first-priority; it does not create an imaginary tier-2 schedule.
UPDATE public.needs SET schedule_kind='TODAY_FLEXIBLE',
 starts_at=NULL,ends_at=NULL,published_at=statement_timestamp();
UPDATE public.app_profiles SET available_now=true
 WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.assert_true_calendar(1,true,'today_available_now_tier1');
INSERT INTO private.worker_calendar_events(worker_profile_id,agreement_id,starts_at,ends_at,state)
VALUES ('22222222-2222-4222-8222-222222222222',
 '66666666-6666-4666-8666-666666666666',
 statement_timestamp()-interval '5 minutes',
 statement_timestamp()+interval '30 minutes','BLOCKING');
SELECT private.assert_true_calendar(NULL,false,'today_blocked_by_agreement');
-- Remove every synthetic mutation via transaction rollback.
ROLLBACK TO SAVEPOINT true_calendar_cases;
RELEASE SAVEPOINT true_calendar_cases;
ROLLBACK;
