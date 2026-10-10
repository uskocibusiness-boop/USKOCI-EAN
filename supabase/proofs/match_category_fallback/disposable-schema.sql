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
-- Worker matcher and 11-kind classifier have real canonical function bodies.
-- Radius and Haversine definitions below come from read-only canonical DEV
-- pg_get_functiondef on 2026-10-10. Other helpers and data are still SYNTHETIC,
-- not evidence of full Auth, RLS, calendar, notification or closure readiness.
CREATE FUNCTION private.lower_arr(text[]) RETURNS text[] LANGUAGE sql IMMUTABLE
AS $ select coalesce(array_agg(lower(btrim(v))), '{}'::text[]) from unnest($1) v $;
CREATE OR REPLACE FUNCTION private.effective_radius_km(base_radius integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select greatest(1, least(300, coalesce(base_radius, 15)))::numeric;
$function$;
CREATE OR REPLACE FUNCTION private.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else round((6371.0 * 2 * asin(least(1, sqrt(
        power(sin(radians((lat2-lat1)::double precision)/2),2) +
        cos(radians(lat1::double precision))*cos(radians(lat2::double precision)) *
        power(sin(radians((lng2-lng1)::double precision)/2),2)
      ))))::numeric, 2)
  end;
$function$;
CREATE FUNCTION private.accounts_same_world(uuid,uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ select true $$;
CREATE FUNCTION private.identity_admitted(uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ select true $$;
CREATE FUNCTION private.worker_need_time_tier_v1(uuid,uuid) RETURNS integer LANGUAGE sql STABLE
AS $$ select case when coalesce((select allowed from private.synthetic_time where pid=$2),false) then 1 else null::integer end $$;
-- Disposable-only closure digest stand-in for testing forward/rollback SQL
-- transaction syntax and hash guards. NOT a real erasure certificate!
CREATE FUNCTION private.closure_source_digest_v5() RETURNS text
LANGUAGE sql STABLE AS $$ select 'SYNTHETIC_CLOSURE_NOT_CERTIFIED'::text $$;

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
