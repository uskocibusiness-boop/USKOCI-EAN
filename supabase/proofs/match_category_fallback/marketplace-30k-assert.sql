\set ON_ERROR_STOP on
-- Real captured matcher, dispatch prefilter, and canonical dispatch_next_wave
-- in a disposable PostgreSQL 16 database. No live Supabase credentials,
-- no Auth fixtures, and NO real push transport. See receipt for boundaries.
\set ECHO errors
\timing on
DO $prove$
DECLARE pair record; need_id uuid; yes_id uuid; no_id uuid; yes_count integer:=0; no_count integer:=0;
BEGIN
 FOR pair IN
  SELECT DISTINCT category,approximate_city AS city
  FROM public.needs WHERE id::text LIKE '20000000-0000-4000-8000-%'
 LOOP
  SELECT n.id INTO need_id FROM public.needs n
   WHERE n.category=pair.category AND n.approximate_city=pair.city
     AND n.id::text LIKE '20000000-0000-4000-8000-%'
   ORDER BY n.id LIMIT 1;
  SELECT p.id INTO yes_id FROM public.app_profiles p
    JOIN public.worker_match_preferences pref ON pref.worker_profile_id=p.id
    JOIN private.synthetic_time t ON t.pid=p.id
   WHERE p.skills=ARRAY[pair.category]::text[] AND p.city=pair.city
     AND p.profile_status='ACTIVE' AND pref.proactive_notifications=true
     AND t.allowed=true AND coalesce(cardinality(p.exclusions),0)=0
     AND p.id::text LIKE '00000000-0000-4000-8000-%'
   ORDER BY p.id LIMIT 1;
  SELECT p.id INTO no_id FROM public.app_profiles p
    JOIN public.worker_match_preferences pref ON pref.worker_profile_id=p.id
    JOIN private.synthetic_time t ON t.pid=p.id
   WHERE p.skills<>ARRAY[pair.category]::text[] AND p.city=pair.city
     AND p.profile_status='ACTIVE' AND pref.proactive_notifications=true
     AND t.allowed=true AND coalesce(cardinality(p.exclusions),0)=0
     AND p.id::text LIKE '00000000-0000-4000-8000-%'
   ORDER BY p.id LIMIT 1;
  IF need_id IS NULL OR yes_id IS NULL OR no_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_REAL_PROFILES_FOR_COMBINATION_%_%',pair.category,pair.city;
  END IF;
  IF NOT private.dispatch_cheap_candidate_admitted(need_id,yes_id) THEN
    RAISE EXCEPTION '30K_FALSE_NEGATIVE_KIND_%_CITY_%',pair.category,pair.city;
  END IF;
  yes_count:=yes_count+1;
  IF private.dispatch_cheap_candidate_admitted(need_id,no_id) THEN
    RAISE EXCEPTION '30K_FALSE_POSITIVE_KIND_%_CITY_%',pair.category,pair.city;
  END IF;
  no_count:=no_count+1;
 END LOOP;
 IF yes_count<>55 OR no_count<>55 THEN
  RAISE EXCEPTION '30K_COMBINATION_COVERAGE expected_55_55 got_%_%',yes_count,no_count;
 END IF;
 RAISE NOTICE 'ACTUAL_MATCHER_30K 55 correct accept + 55 correct reject across all kind/city pairs';
END $prove$;

CREATE OR REPLACE FUNCTION private.prove_dispatch_task(p_need_id uuid, p_step text)
RETURNS void LANGUAGE plpgsql AS $prove$
DECLARE start_at timestamptz; answer jsonb; elapsed numeric;
BEGIN
 start_at:=clock_timestamp();
 answer:=private.dispatch_next_wave(p_need_id);
 elapsed:=round((extract(epoch FROM clock_timestamp()-start_at)*1000)::numeric,1);
 INSERT INTO private.market_load_audit(step,result,elapsed_ms)
 VALUES (p_step,answer,elapsed);
 IF p_step LIKE 'task_%' AND
    (answer->>'status'<>'SENT' OR (answer->>'inserted')::integer<1) THEN
  RAISE EXCEPTION 'ACTUAL_DISPATCH_REJECTED_%_%',p_step,answer;
 END IF;
 RAISE NOTICE 'REAL_DISPATCH_% status=% inserted=% elapsed_ms=%',
  p_step,answer->>'status',answer->>'inserted',elapsed;
END $prove$;

-- \gexec emits 12 separate SQL statements, hence 12 separate transactions.
-- This is vital because canonical dispatch tracks its per-transaction limit.
SELECT format('SELECT private.prove_dispatch_task(%L::uuid,%L);',
 ('20000000-0000-4000-8000-'||lpad(i::text,12,'0')),
 'task_'||i::text)
FROM generate_series(1,12) i
\gexec

DO $prove$
DECLARE n integer; delivered integer; dispatched integer; events integer; duplicate_rows integer;
BEGIN
 SELECT count(*) INTO n FROM private.market_load_audit WHERE step LIKE 'task_%'
 AND result->>'status'='SENT' AND (result->>'inserted')::integer>0;
 IF n<>12 THEN RAISE EXCEPTION '12_REAL_DISPATCH_WAVES_NOT_PROVED_count_%',n; END IF;
 SELECT count(*) INTO delivered FROM public.opportunity_deliveries;
 SELECT count(*) INTO events FROM public.user_activity_events
  WHERE event_type='OPPORTUNITY_AVAILABLE';
 SELECT sum((result->>'inserted')::integer) INTO dispatched
 FROM private.market_load_audit WHERE step LIKE 'task_%';
 IF dispatched<>delivered OR events<>delivered THEN
  RAISE EXCEPTION '30K_DELIVERY_EVENT_COUNTS_WRONG_dispatch_%_delivery_%_events_%',
   dispatched,delivered,events;
 END IF;
 SELECT count(*) INTO duplicate_rows FROM (
  SELECT worker_account_id,need_id,need_revision
  FROM public.opportunity_deliveries
  GROUP BY worker_account_id,need_id,need_revision HAVING count(*)>1
 ) d;
 IF duplicate_rows<>0 THEN RAISE EXCEPTION 'DUPLICATE_DELIVERIES_%',duplicate_rows; END IF;
 IF EXISTS (
  SELECT 1 FROM public.opportunity_deliveries od
  JOIN public.app_profiles p ON p.id=od.worker_profile_id
  LEFT JOIN public.worker_match_preferences pref ON pref.worker_profile_id=p.id
  JOIN public.needs n ON n.id=od.need_id
  LEFT JOIN private.synthetic_time t ON t.pid=p.id
  WHERE p.profile_status<>'ACTIVE' OR coalesce(pref.proactive_notifications,false)=false
   OR coalesce(t.allowed,false)=false
   OR NOT private.worker_need_match_v1(n.id,p.id)
 ) THEN RAISE EXCEPTION 'DISPATCH_SENT_TO_INELIGIBLE_WORKER'; END IF;
 RAISE NOTICE '12_REAL_WAVES_PASS rows=% events=% dupes=0 correct_recipient=YES',
 delivered,events;
END $prove$;

-- Same revision cannot send duplicates, even if the task gets requeued.
SELECT private.prove_dispatch_task('20000000-0000-4000-8000-000000000001','duplicate_revision_1');
DO $prove$ BEGIN
 IF (SELECT (result->>'inserted')::integer FROM private.market_load_audit
  WHERE step='duplicate_revision_1')<>0 THEN
  RAISE EXCEPTION 'SAME_REVISION_SENT_DUPLICATES';
 END IF;
END $prove$;

-- Edit: classification changes from cleaning to delivery; only the new
-- kind's workers may receive revision 2. Synthetic backend source is real.
UPDATE public.needs SET revision=2,category='Dostava'
WHERE id='20000000-0000-4000-8000-000000000001';
SELECT private.prove_dispatch_task('20000000-0000-4000-8000-000000000001','edited_revision_2');
DO $prove$
BEGIN
 IF (SELECT (result->>'inserted')::integer FROM private.market_load_audit
   WHERE step='edited_revision_2')<1 THEN
  RAISE EXCEPTION 'EDITED_REVISION_NO_MATCHES';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.opportunity_deliveries od
   JOIN public.app_profiles p ON p.id=od.worker_profile_id
   WHERE od.need_id='20000000-0000-4000-8000-000000000001'
    AND od.need_revision=2 AND NOT private.worker_need_match_v1(od.need_id,p.id)
 ) THEN RAISE EXCEPTION 'EDIT_REVISION_WRONG_WORKERS'; END IF;
END $prove$;

-- Close remaining search: real dispatch function MUST stop unconditionally.
UPDATE public.needs SET remaining_search_closed_at=statement_timestamp()
WHERE id='20000000-0000-4000-8000-000000000001';
SELECT private.prove_dispatch_task('20000000-0000-4000-8000-000000000001','closed_search');
DO $prove$
BEGIN
 IF (SELECT result->>'reason' FROM private.market_load_audit WHERE step='closed_search')
     <>'REMAINING_SEARCH_CLOSED'
    OR (SELECT (result->>'inserted')::integer FROM private.market_load_audit
        WHERE step='closed_search')<>0 THEN
  RAISE EXCEPTION 'CLOSED_SEARCH_DISPATCH_STILL_RUNNING';
 END IF;
END $prove$;

-- Hard receipt: only disposable PostgreSQL, not any live application service.
SELECT
 'DISPOSABLE_REAL_DISPATCH_30K_PASS' AS verdict,
 20000 AS synthetic_workers,
 10000 AS synthetic_requester_identities,
 10000 AS synthetic_needs,
 12 AS sampled_real_dispatch_waves,
 (SELECT count(*) FROM public.opportunity_deliveries) AS deliveries,
 (SELECT count(*) FROM public.user_activity_events WHERE event_type='OPPORTUNITY_AVAILABLE') AS local_events,
 (SELECT max(elapsed_ms) FROM private.market_load_audit WHERE step LIKE 'task_%') AS max_wave_ms,
 (SELECT round(avg(elapsed_ms),1) FROM private.market_load_audit WHERE step LIKE 'task_%') AS mean_wave_ms,
 'NO REAL AUTH, NO REAL PUSH, NO REAL DOGOVOR, NO API LOAD CLAIM' AS scope_limit;
