\set ON_ERROR_STOP on
-- Read the ACTUAL USKOCI matcher and dispatch logic against disposable-only rows.
-- This fixture explicitly illustrates WHY the new UUID-based taxonomy MUST
-- be integrated before trusting near-category push on unknown work.
-- NEVER run against any canonical DEV, production or user project.
BEGIN;
INSERT INTO public.app_profiles
 (id,account_id,kind,profile_status,available_now,skills,exclusions,radius_km,city)
VALUES
 ('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
  'WORKER','ACTIVE',true,ARRAY['Podešavanje 3D štampača']::text[],'{}',30,'Novi Sad'),
 ('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',
  'WORKER','ACTIVE',true,ARRAY['Popravka laptopa']::text[],'{}',30,'Novi Sad');
INSERT INTO public.worker_match_preferences(worker_profile_id,proactive_notifications,timezone)
VALUES
 ('40000000-0000-4000-8000-000000000001',true,'Europe/Belgrade'),
 ('40000000-0000-4000-8000-000000000002',true,'Europe/Belgrade');
INSERT INTO private.synthetic_time(pid,allowed)
VALUES ('40000000-0000-4000-8000-000000000001',true),
 ('40000000-0000-4000-8000-000000000002',true);
INSERT INTO public.needs
 (id,requester_account_id,category,approximate_city,status,revision,
  required_slots,execution_location_mode,schedule_kind,title)
VALUES
 ('60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
  'Podešavanje 3D štampača','Novi Sad','PUBLISHED',1,1,'STATIONARY','FLEXIBLE',
  'Podešavanje 3D štampača u radionici'),
 ('60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002',
  'Popravka 3D štampača','Novi Sad','PUBLISHED',1,1,'STATIONARY','FLEXIBLE',
  'Popravka 3D štampača');
COMMIT;

DO $assert$
DECLARE novel uuid := '60000000-0000-4000-8000-000000000001';
 bad uuid := '60000000-0000-4000-8000-000000000002';
 expert uuid := '40000000-0000-4000-8000-000000000001';
 laptop uuid := '40000000-0000-4000-8000-000000000002';
BEGIN
 IF NOT private.dispatch_cheap_candidate_admitted(novel,expert) THEN
  RAISE EXCEPTION 'UNKNOWN_KIND_EXACT_CONFIRMED_WORKER_NOT_MATCHED';
 END IF;
 IF private.dispatch_cheap_candidate_admitted(novel,laptop) THEN
  RAISE EXCEPTION 'UNKNOWN_KIND_UNRELATED_WORKER_NOT_BLOCKED';
 END IF;
 -- EXPECTED CURRENT DEFECT: both strings fold to the legacy generic
 -- SITNE_POPRAVKE bucket, though the worker never confirmed 3D printers.
 IF NOT private.dispatch_cheap_candidate_admitted(bad,laptop) THEN
  RAISE EXCEPTION 'LEGACY_11_KIND_GAP_CHANGED_REEVALUATE_BEFORE_RELEASING';
 END IF;
 RAISE NOTICE 'NOVEL_WORK_EXACT_MATCH_PASS; UNRELATED_EXCLUDED_PASS';
 RAISE NOTICE 'KNOWN_GAP: Popravka laptopa incorrectly matched to Popravka 3D stampaca by legacy SITNE_POPRAVKE alias bucket';
END $assert$;

-- One real captured dispatch_next_wave call, on a never-seen novel label.
-- Sends to LOCAL TEST EVENT SINK only, not push/Expo/FCM.
SELECT private.dispatch_next_wave('60000000-0000-4000-8000-000000000001') AS novel_dispatch;
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.opportunity_deliveries
    WHERE need_id='60000000-0000-4000-8000-000000000001')<>1 THEN
   RAISE EXCEPTION 'NOVEL_WORK_DISPATCH_NOT_EXACTLY_ONE';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_deliveries
    WHERE need_id='60000000-0000-4000-8000-000000000001'
     AND worker_account_id='50000000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'NOVEL_WORK_DISPATCH_WRONG_WORKER';
 END IF;
 RAISE NOTICE 'NOVEL_WORK_DISPATCH_PASS: exact worker receives local synthetic event';
END $assert$;

-- This assertion purposefully demonstrates the known bug; it does NOT
-- certify the dynamic taxonomy, semantic understanding or general matching.
SELECT 'NOVEL_EXACT_DISPATCH_PASS_BUT_LEGACY_GENERIC_KIND_FALSE_POSITIVE' AS verdict;
