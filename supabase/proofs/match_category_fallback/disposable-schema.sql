\set ON_ERROR_STOP on
-- Disposable PostgreSQL test ONLY; synthetic users, no Supabase project.
BEGIN;
CREATE SCHEMA private;
CREATE TABLE public.needs (
 id uuid PRIMARY KEY, requester_account_id uuid NOT NULL, revision integer NOT NULL DEFAULT 1, category text,
 required_skills text[] NOT NULL DEFAULT '{}', execution_location_mode text NOT NULL DEFAULT 'ONSITE',
 approximate_lat numeric, approximate_lng numeric, approximate_city text,
 verified_identity_required boolean NOT NULL DEFAULT false);
CREATE TABLE public.app_profiles (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, kind text NOT NULL DEFAULT 'WORKER',
 profile_status text NOT NULL DEFAULT 'ACTIVE', skills text[] NOT NULL DEFAULT '{}',
 exclusions text[] NOT NULL DEFAULT '{}', radius_km integer NOT NULL DEFAULT 30, city text);
CREATE TABLE public.worker_match_preferences (
 worker_profile_id uuid PRIMARY KEY, approximate_lat numeric, approximate_lng numeric,
 proactive_notifications boolean NOT NULL DEFAULT true);
-- Minimum synthetic projection consumed by the REAL dispatch prefilter.
CREATE TABLE public.opportunity_deliveries (
 worker_account_id uuid NOT NULL, need_id uuid NOT NULL, need_revision integer NOT NULL);
CREATE TABLE private.marketplace_config (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE private.synthetic_time (pid uuid PRIMARY KEY, allowed boolean NOT NULL);
-- Worker matcher and 11-kind classifier have real canonical function bodies.
-- Radius and Haversine definitions below come from read-only canonical DEV
-- pg_get_functiondef on 2026-10-10. Other helpers and data are still SYNTHETIC,
-- not evidence of full Auth, RLS, calendar, notification or closure readiness.
CREATE OR REPLACE FUNCTION private.lower_arr(a text[])
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(array(select lower(btrim(x)) from unnest(coalesce(a,'{}'::text[])) x where x is not null), '{}'::text[]);
$function$;
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

-- Public, non-personal work-kind registry captured read-only from
-- canonical DEV on 2026-10-10. Data snapshot, not a live registry migration.
INSERT INTO private.marketplace_config(key,value) VALUES
 ('work_kind:BASTA_DVORISTE', '{"kind":"BASTA_DVORISTE","stems":["bast","dvorist","kosenj","travnjak","garden","lawn"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:CISCENJE', '{"kind":"CISCENJE","stems":["cisc","odrzavanj","clean","usisav"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:DOSTAVA', '{"kind":"DOSTAVA","stems":["dostav","kurir","delivery","courier"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:ELEKTRO', '{"kind":"ELEKTRO","stems":["elektr","electr","struj","uticnic","prekidac","rasvet","sijalic"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:FIZICKI_POSLOVI', '{"kind":"FIZICKI_POSLOVI","stems":["fizick","nosenj","nosac","utovar","istovar","iznosenj","unosenj","labor","labour","loading"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:MOLERSKI_RADOVI', '{"kind":"MOLERSKI_RADOVI","stems":["moler","krecenj","farbanj","gletovanj","painting","painter","ofarb"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:MONTAZA_NAMESTAJA', '{"kind":"MONTAZA_NAMESTAJA","stems":["montaz","namestaj","ikea","furniture","assembl","ikee","ikei","ikeu","ikeom"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:PRANJE_PEGLANJE', '{"kind":"PRANJE_PEGLANJE","stems":["pegl","pranje vesa","laundry","ironing"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:SELIDBE_PREVOZ', '{"kind":"SELIDBE_PREVOZ","stems":["selid","prevoz","transport","kombi","moving","removal"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:SITNE_POPRAVKE', '{"kind":"SITNE_POPRAVKE","stems":["popravk","majstor","handyman","repair"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kind:VODOINSTALATER', '{"kind":"VODOINSTALATER","stems":["vodoinst","vodovod","slavin","odvod","bojler","plumb"],"schema":"WORK_KIND_V1"}'::jsonb),
 ('work_kinds_head', '{"kinds":["SELIDBE_PREVOZ","FIZICKI_POSLOVI","MONTAZA_NAMESTAJA","SITNE_POPRAVKE","MOLERSKI_RADOVI","ELEKTRO","VODOINSTALATER","CISCENJE","PRANJE_PEGLANJE","BASTA_DVORISTE","DOSTAVA"],"schema":"WORK_KINDS_HEAD_V1","package":"EX-06 ex06b","previous":"PKG-031b hard-coded regular expressions, body md5 2113eb46ab7ea968b873e76d1de12377","foldVersion":"SR_LATIN_CYRILLIC_V1","classificationVersion":"WK-1"}'::jsonb);
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
