\set ON_ERROR_STOP on
-- Disposable PostgreSQL ONLY. NEVER execute on any Supabase project.
-- 20,000 fictitious worker identities and 10,000 fictitious requester identities,
-- 10,000 distinct published needs. No auth users, external APIs or push tokens.
-- The exact captured DEV worker matcher, cheap dispatch gate and dispatch_next_wave
-- are installed by the GitHub Actions workflow BEFORE this seed executes.
BEGIN;
CREATE TABLE private.market_load_audit (
  step text PRIMARY KEY,
  result jsonb NOT NULL,
  elapsed_ms numeric NOT NULL,
  at_time timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.app_profiles
  (id,account_id,kind,profile_status,available_now,skills,exclusions,radius_km,city)
SELECT
  ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  'WORKER',
  CASE WHEN i % 29 = 0 THEN 'SUSPENDED' ELSE 'ACTIVE' END,
  i % 7 <> 0,
  ARRAY[kinds[((i-1)%11)+1]]::text[],
  CASE WHEN i%23=0 THEN ARRAY[kinds[((i-1)%11)+1]]::text[] ELSE '{}'::text[] END,
  CASE WHEN i%9=0 THEN 10 ELSE 30 END,
  cities[((i-1)%5)+1]
FROM generate_series(1,20000) s(i)
CROSS JOIN (
 SELECT ARRAY[
  'Čišćenje stana','Molerski radovi','Selidbe','Montaža nameštaja',
  'Električar','Vodoinstalater','Baštovan','Dostava',
  'Sitne popravke','Pranje veša','Fizički poslovi'
 ]::text[] AS kinds,
 ARRAY['Novi Sad','Beograd','Niš','Subotica','Kragujevac']::text[] AS cities
) ref;
INSERT INTO public.worker_match_preferences
 (worker_profile_id,proactive_notifications,timezone)
SELECT p.id, (substring(p.id::text from 25)::numeric % 17 <> 0), 'Europe/Belgrade'
FROM public.app_profiles p
WHERE p.id::text LIKE '00000000-0000-4000-8000-%';
-- The % tests depend on the synthetic numeric suffix; don't parse a UUID as an integer.
-- A matching explicit synthetic availability gate is loaded for every worker.
INSERT INTO private.synthetic_time (pid,allowed)
SELECT p.id, (substring(p.id::text from 25)::numeric % 7 <> 0)
FROM public.app_profiles p WHERE p.id::text LIKE '00000000-0000-4000-8000-%';
INSERT INTO public.needs
 (id,requester_account_id,category,approximate_city,status,
  revision,required_slots,execution_location_mode,schedule_kind,title)
SELECT
 ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 kinds[((i-1)%11)+1], cities[((i-1)%5)+1],
 'PUBLISHED',1,CASE WHEN i%7=0 THEN 3 ELSE 1 END,
 'STATIONARY','FLEXIBLE','Test zadatak broj '||i::text
FROM generate_series(1,10000) s(i)
CROSS JOIN (
 SELECT ARRAY[
  'Čišćenje stana','Molerski radovi','Selidbe','Montaža nameštaja',
  'Električar','Vodoinstalater','Baštovan','Dostava',
  'Sitne popravke','Pranje veša','Fizički poslovi'
 ]::text[] AS kinds,
 ARRAY['Novi Sad','Beograd','Niš','Subotica','Kragujevac']::text[] AS cities
) ref;
UPDATE private.marketplace_config
 SET value='{"mode":"ALL","ceiling":500,"validMinutes":1440,
  "workerDailyCap":1000,"workerNotifyPerTransaction":500,
  "remoteWaves":false}'::jsonb
 WHERE key='match_v1_dispatch';
COMMIT;
-- Ensure 20,000 synthetic workers and 10,000 synthetic task/requester IDs.
DO $prove$
DECLARE w integer; n integer; req integer; pairs integer;
BEGIN
 SELECT count(*) INTO w FROM public.app_profiles
  WHERE id::text LIKE '00000000-0000-4000-8000-%';
 SELECT count(*),count(DISTINCT requester_account_id),
        count(DISTINCT (category,approximate_city))
  INTO n,req,pairs FROM public.needs
  WHERE id::text LIKE '20000000-0000-4000-8000-%';
 IF w<>20000 OR n<>10000 OR req<>10000 OR pairs<>55 THEN
  RAISE EXCEPTION 'MARKET_SEED_INCOMPLETE workers=% needs=% requesters=% pairs=%',
   w,n,req,pairs;
 END IF;
 RAISE NOTICE 'MARKET_SEED_OK workers=% needs=% unique_requesters=% kind_city_pairs=%',
  w,n,req,pairs;
END $prove$;
