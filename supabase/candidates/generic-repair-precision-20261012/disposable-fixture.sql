\set ON_ERROR_STOP on
-- Disposable PostgreSQL ONLY; no real Auth users or push.
BEGIN;
INSERT INTO public.app_profiles
 (id,account_id,kind,profile_status,available_now,skills,exclusions,radius_km,city)
VALUES
 ('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','WORKER','ACTIVE',true,ARRAY['Popravka laptopa']::text[],'{}',30,'Novi Sad'),
 ('80000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','WORKER','ACTIVE',true,ARRAY['Popravka 3D štampača']::text[],'{}',30,'Novi Sad'),
 ('80000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','WORKER','ACTIVE',true,ARRAY['Sitne popravke']::text[],'{}',30,'Novi Sad');
INSERT INTO public.worker_match_preferences(worker_profile_id,proactive_notifications,timezone)
SELECT id,true,'Europe/Belgrade' FROM public.app_profiles
WHERE id IN ('80000000-0000-4000-8000-000000000001',
 '80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000003');
INSERT INTO private.synthetic_time(pid,allowed)
SELECT id,true FROM public.app_profiles
WHERE id IN ('80000000-0000-4000-8000-000000000001',
 '80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000003');
INSERT INTO public.needs
 (id,requester_account_id,category,approximate_city,status,
  required_slots,execution_location_mode,schedule_kind,title)
VALUES
 ('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',
 'Popravka 3D štampača','Novi Sad','PUBLISHED',1,'STATIONARY','FLEXIBLE','Popravka 3D stampaca'),
 ('82000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002',
 'Popravka laptopa','Novi Sad','PUBLISHED',1,'STATIONARY','FLEXIBLE','Popravka laptopa');
COMMIT;
