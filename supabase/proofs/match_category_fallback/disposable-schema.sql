\set ON_ERROR_STOP on
-- Disposable PostgreSQL test ONLY; synthetic users, no Supabase project.
BEGIN;
CREATE SCHEMA private;
CREATE TABLE public.needs (
 id uuid PRIMARY KEY, requester_account_id uuid NOT NULL, category text,
 required_skills text[] NOT NULL DEFAULT '{}', execution_location_mode text NOT NULL DEFAULT 'ONSITE',
 approximate_lat numeric, approximate_lng numeric, approximate_city text,
 verified_identity_required boolean NOT NULL DEFAULT false);
CREATE TABLE public.app_profiles (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, kind text NOT NULL DEFAULT 'WORKER',
 profile_status text NOT NULL DEFAULT 'ACTIVE', skills text[] NOT NULL DEFAULT '{}',
 exclusions text[] NOT NULL DEFAULT '{}', radius_km integer NOT NULL DEFAULT 30, city text);
CREATE TABLE public.worker_match_preferences (
 worker_profile_id uuid PRIMARY KEY, approximate_lat numeric, approximate_lng numeric);
CREATE TABLE private.marketplace_config (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE private.synthetic_time (pid uuid PRIMARY KEY, allowed boolean NOT NULL);
-- Only the kind classifier and full worker_need_fit body are actual live SQL.
-- All other helpers are synthetic, NOT evidence of production Auth, RLS,
-- geodesic accuracy, availability, event delivery or release readiness.
CREATE FUNCTION private.lower_arr(text[]) RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ select coalesce(array_agg(lower(btrim(v))), '{}'::text[]) from unnest($1) v $$;
CREATE FUNCTION private.effective_radius_km(integer) RETURNS numeric LANGUAGE sql IMMUTABLE
AS $$ select coalesce($1,30)::numeric $$;
CREATE FUNCTION private.haversine_km(numeric,numeric,numeric,numeric) RETURNS numeric LANGUAGE sql IMMUTABLE
AS $$ select case when $1 is null or $2 is null or $3 is null or $4 is null then null::numeric
else abs($1-$3)*111+abs($2-$4)*78 end $$;
CREATE FUNCTION private.accounts_same_world(uuid,uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ select true $$;
CREATE FUNCTION private.identity_admitted(uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ select true $$;
CREATE FUNCTION private.worker_need_time_tier_v1(uuid,uuid) RETURNS integer LANGUAGE sql STABLE
AS $ select case when coalesce((select allowed from private.synthetic_time where pid=$2),false) then 1 else null::integer end $;
-- Disposable-only closure digest stand-in for testing forward/rollback SQL
-- transaction syntax and hash guards. NOT a real erasure certificate!
CREATE FUNCTION private.closure_source_digest_v5() RETURNS text
LANGUAGE sql STABLE AS $ select 'SYNTHETIC_CLOSURE_NOT_CERTIFIED'::text $;

INSERT INTO private.marketplace_config(key,value)
VALUES ('work_kinds_head',jsonb_build_object('schema','WORK_KINDS_HEAD_V1',
'foldVersion','SR_LATIN_CYRILLIC_V1', 'kinds', to_jsonb(ARRAY[
'SELIDBE_PREVOZ','FIZICKI_POSLOVI','MONTAZA_NAMESTAJA','SITNE_POPRAVKE','MOLERSKI_RADOVI',
'ELEKTRO','VODOINSTALATER','CISCENJE','PRANJE_PEGLANJE','BASTA_DVORISTE','DOSTAVA']::text[])));
INSERT INTO private.marketplace_config(key,value)
SELECT 'work_kind:'||kind,jsonb_build_object('schema','WORK_KIND_V1','kind',kind,'stems',to_jsonb(stems))
FROM (VALUES
 ('SELIDBE_PREVOZ',ARRAY['selid','prevoz']::text[]),
 ('FIZICKI_POSLOVI',ARRAY['fizick','nosenj']::text[]),
 ('MONTAZA_NAMESTAJA',ARRAY['montaz','sklapanj']::text[]),
 ('SITNE_POPRAVKE',ARRAY['poprav','majstor']::text[]),
 ('MOLERSKI_RADOVI',ARRAY['moler','krecenj']::text[]),
 ('ELEKTRO',ARRAY['elektr','struj']::text[]),
 ('VODOINSTALATER',ARRAY['vodoinst','slavin']::text[]),
 ('CISCENJE',ARRAY['cisc','usisav']::text[]),
 ('PRANJE_PEGLANJE',ARRAY['pegl','pranj']::text[]),
 ('BASTA_DVORISTE',ARRAY['bast','kosenj']::text[]),
 ('DOSTAVA',ARRAY['dostav','kurir']::text[])
) AS registry(kind,stems);
INSERT INTO public.needs(id,requester_account_id,category,approximate_city)
VALUES ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
 'Čišćenje stana','Novi Sad');
INSERT INTO public.app_profiles(id,account_id,skills,city)
VALUES ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ARRAY['Čišćenje'],'Novi Sad'),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',ARRAY['Selidbe'],'Novi Sad');
INSERT INTO public.worker_match_preferences(worker_profile_id)
VALUES ('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
INSERT INTO private.synthetic_time(pid,allowed)
VALUES ('22222222-2222-4222-8222-222222222222',true),('33333333-3333-4333-8333-333333333333',true);
CREATE FUNCTION private.check_fit(pid uuid, service boolean, area boolean, accepted boolean, case_label text)
RETURNS void LANGUAGE plpgsql AS $$ DECLARE doc jsonb; BEGIN
 doc := private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111',pid,false);
 IF (doc->>'service')::boolean IS DISTINCT FROM service
  OR (doc->>'area')::boolean IS DISTINCT FROM area
  OR (doc->>'matches')::boolean IS DISTINCT FROM accepted THEN
   RAISE EXCEPTION 'CATEGORY_PROOF_FAIL_%',case_label;
 END IF;
END $$;
COMMIT;
