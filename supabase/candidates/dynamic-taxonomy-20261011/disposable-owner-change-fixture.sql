\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
-- Match only the auth.uid() signature; never use real Supabase Auth users.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
SET search_path=pg_catalog AS $fn$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$fn$;
ALTER TABLE public.needs
 ADD COLUMN requester_account_id uuid,
 ADD COLUMN revision integer NOT NULL DEFAULT 1,
 ADD COLUMN status text NOT NULL DEFAULT 'DRAFT',
 ADD COLUMN category text NOT NULL DEFAULT 'Izrada 3D modela',
 ADD COLUMN execution_location_mode text NOT NULL DEFAULT 'REMOTE';
GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;
GRANT USAGE ON SCHEMA auth TO authenticated;
-- Saved DRAFT needs, one per real-looking synthetic requester.
INSERT INTO public.needs(id,requester_account_id,revision,status,category,execution_location_mode) VALUES
 ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',4,'DRAFT','Izrada 3D modela','REMOTE'),
 ('a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',2,'DRAFT','Krečenje fasade','STATIONARY'),
 ('a0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001',1,'PUBLISHED','Izrada 3D modela','REMOTE'),
 ('a0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001',1,'DRAFT','Molerski radovi','STATIONARY'),
 ('a0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001',1,'DRAFT','Popravka električnih instalacija','STATIONARY'),
 ('a0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000001',1,'DRAFT','Servis municije','STATIONARY'),
 ('a0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000001',1,'DRAFT','Izrada logotipa','STATIONARY'),
 ('a0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000001',1,'DRAFT','Pravljenje kolača','REMOTE');

-- Verify server-specific explicit default grants are undone.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
