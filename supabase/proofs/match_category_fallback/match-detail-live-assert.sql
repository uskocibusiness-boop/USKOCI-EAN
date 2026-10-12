\set ON_ERROR_STOP on
-- Stage 10 exact real DEV match_detail and calendar wrapper, all synthetic
-- rows, full rollback. No local or remote device/provider path.
BEGIN;
SAVEPOINT real_scoring_cases;
UPDATE public.needs SET status='PUBLISHED', revision=1,required_slots=1,
 category='Čišćenje stana',required_skills='{}',approximate_city='Novi Sad',
 execution_location_mode='STATIONARY',schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,urgent=false,urgent_expires_at=NULL,
 remaining_search_closed_at=NULL,response_deadline=NULL,
 requester_account_id='44444444-4444-4444-8444-444444444444'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.app_profiles SET profile_status='ACTIVE',rating_worker=NULL,
 available_now=false,exclusions='{}'
WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.worker_match_preferences SET proactive_notifications=true,
 same_day_urgent_notifications=true,approximate_lat=NULL,approximate_lng=NULL,
 timezone='Europe/Belgrade'
WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'responseAllowed')::boolean IS DISTINCT FROM true
 OR (d->>'dispatchEligible')::boolean IS DISTINCT FROM true
 OR (d->>'timeTier')::integer IS DISTINCT FROM 1
 OR (d->>'score')::numeric IS DISTINCT FROM 75.0
 OR (d->'scoreComponents'->>'capability')::numeric IS DISTINCT FROM 30
 OR (d->'scoreComponents'->>'schedule')::numeric IS DISTINCT FROM 25
 OR (d->'scoreComponents'->>'distanceToStart')::numeric IS DISTINCT FROM 10
 OR (d->'scoreComponents'->>'resources')::numeric IS DISTINCT FROM 0
 OR (d->'reasonCodes' ? 'NEWCOMER_FAIRNESS') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'REAL_SCORE_CLEANER_BASELINE_%',d; END IF;
END $real_score$;
-- Rating and fairness are not a fake constant: verify actual score changes.
UPDATE public.app_profiles SET rating_worker=4.5
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'score')::numeric IS DISTINCT FROM 79.0
 OR (d->'scoreComponents'->>'reliability')::numeric IS DISTINCT FROM 9.0
 THEN RAISE EXCEPTION 'REAL_SCORE_RATING_WEIGHTS_%',d; END IF;
END $real_score$;
INSERT INTO public.opportunity_deliveries(worker_account_id,worker_profile_id,need_id,need_revision)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',999);
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'score')::numeric IS DISTINCT FROM 78.0
 OR (d->'scoreComponents'->>'fairness')::numeric IS DISTINCT FROM 4
 THEN RAISE EXCEPTION 'REAL_SCORE_EXPOSURE_FAIRNESS_%',d; END IF;
END $real_score$;
DELETE FROM public.opportunity_deliveries;
UPDATE public.app_profiles SET rating_worker=NULL, exclusions=ARRAY['Čišćenje']
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'responseAllowed')::boolean IS DISTINCT FROM false
 OR (d->>'dispatchEligible')::boolean IS DISTINCT FROM false
 OR NOT(d->'hardBlockers' ? 'PROFILE_EXCLUSION')
 THEN RAISE EXCEPTION 'REAL_SCORE_EXCLUSION_HARD_REFUSAL_%',d; END IF;
END $real_score$;
UPDATE public.app_profiles SET exclusions='{}'
 WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.needs SET requester_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'responseAllowed')::boolean IS DISTINCT FROM false
 OR NOT(d->'hardBlockers' ? 'OWN_NEED')
 THEN RAISE EXCEPTION 'REAL_SCORE_OWN_NEED_HARD_REFUSAL_%',d; END IF;
END $real_score$;
UPDATE public.needs SET requester_account_id='44444444-4444-4444-8444-444444444444',
 schedule_kind='FIXED_WINDOW',
 starts_at=statement_timestamp()+interval '25 hours',
 ends_at=statement_timestamp()+interval '26 hours',
 revision=2
 WHERE id='11111111-1111-4111-8111-111111111111';
INSERT INTO public.profile_availability_windows(profile_id,starts_at,ends_at,availability_state)
SELECT '22222222-2222-4222-8222-222222222222',
 starts_at-interval '1 hour',ends_at+interval '1 hour','AVAILABLE'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
INSERT INTO private.worker_calendar_events(worker_profile_id,agreement_id,starts_at,ends_at,state)
SELECT '22222222-2222-4222-8222-222222222222',
 '77777777-7777-4777-8777-777777777777',
 starts_at+interval '10 minutes',ends_at-interval '10 minutes','BLOCKING'
FROM public.needs WHERE id='11111111-1111-4111-8111-111111111111';
DO $real_score$
DECLARE d jsonb;
BEGIN
 d:=private.match_detail('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF (d->>'dispatchEligible')::boolean IS DISTINCT FROM false
 OR (d->>'responseAllowed')::boolean IS DISTINCT FROM false
 OR NOT (d->'hardBlockers' ? 'CALENDAR_CONFLICT')
 THEN RAISE EXCEPTION 'REAL_SCORE_CALENDAR_INTERVAL_CONFLICT_%',d; END IF;
END $real_score$;
DELETE FROM private.worker_calendar_events;
DELETE FROM public.profile_availability_windows;
UPDATE public.needs SET schedule_kind='FLEXIBLE',
 starts_at=NULL,ends_at=NULL,revision=3
 WHERE id='11111111-1111-4111-8111-111111111111';
-- Real scoring is now used by the real wave (candidate order is still a
-- synthetic bounded adapter, provider is still local SQL only).
DO $real_score$
DECLARE wave jsonb; row_score numeric; comp jsonb;
BEGIN
 wave:=private.dispatch_next_wave('11111111-1111-4111-8111-111111111111');
 SELECT match_score,score_components INTO row_score,comp
 FROM public.opportunity_deliveries WHERE need_revision=3;
 IF (wave->>'inserted')::integer IS DISTINCT FROM 1
 OR row_score IS DISTINCT FROM 75.0
 OR (comp->>'capability')::numeric IS DISTINCT FROM 30
 OR (comp->>'resources')::numeric IS DISTINCT FROM 0
 OR (SELECT count(*) FROM public.user_activity_events WHERE event_type='OPPORTUNITY_AVAILABLE')<>1
 THEN RAISE EXCEPTION 'REAL_SCORING_IN_WAVE_%_score_%_components_%',wave,row_score,comp; END IF;
END $real_score$;
ROLLBACK TO SAVEPOINT real_scoring_cases;
RELEASE SAVEPOINT real_scoring_cases;
ROLLBACK;
