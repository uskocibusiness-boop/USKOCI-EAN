\set ON_ERROR_STOP on
-- Disposable source-only auth fixture. No production identities/accounts.
DO $init$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $init$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE TABLE public.app_accounts (id uuid PRIMARY KEY);
CREATE TABLE public.app_profiles (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('WORKER','REQUESTER')),
 profile_status text NOT NULL CHECK(profile_status IN ('DRAFT','ACTIVE','SUSPENDED','CLOSED'))
);
CREATE TABLE private.work_taxonomy_control(singleton boolean PRIMARY KEY,auto_registration_enabled boolean NOT NULL);
INSERT INTO private.work_taxonomy_control VALUES(true,false);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
 SET search_path=pg_catalog
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE ROLE dummy_worker_account NOLOGIN;
INSERT INTO public.app_accounts(id) VALUES
('10000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000002');
INSERT INTO public.app_profiles(id,account_id,kind,profile_status) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','WORKER','ACTIVE'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','WORKER','DRAFT'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','REQUESTER','ACTIVE'),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','WORKER','SUSPENDED');
-- Reproduce Supabase's explicit public default EXECUTE privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;