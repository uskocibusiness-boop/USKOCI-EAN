-- USKOCI DEV: public location labels without house numbers and ~200 m public grid (owner decision 2026-11-20).
-- Source: scripts/sql/geo_privacy_20261121.candidate.sql; rollback: scripts/sql/rollback_geo_privacy_preimage_20261121.sql.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

DO $new_function_guard$
DECLARE
  expected jsonb := '{"private.public_location_text_sanitize(text)":"165d3e8e8168191c7b6809fc62f0ddd6","private.public_location_point_sanitize(jsonb)":"6dd664f344b39da250e58170d67a696e","private.public_topology_sanitize(jsonb)":"8710f3c4e4e3c81bf6dae0a10ee3b9a0","private.sanitize_need_geography_public_topology()":"0118429cce7073bbbf1d2da0ff5c9681"}'::jsonb;
  k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    IF to_regprocedure(k) IS NOT NULL
       AND (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(k)) IS DISTINCT FROM expected->>k THEN
      RAISE EXCEPTION 'GEO_PRIVACY_NEW_FUNCTION_DRIFT %', k;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.need_geography'::regclass
      AND tgname='need_geography_public_topology_sanitize_trg'
      AND tgfoid IS DISTINCT FROM to_regprocedure('private.sanitize_need_geography_public_topology()')) THEN
    RAISE EXCEPTION 'GEO_PRIVACY_TRIGGER_DRIFT';
  END IF;
END
$new_function_guard$;

-- GEO_PRIVACY_SANITIZER_FUNCTIONS_START
CREATE OR REPLACE FUNCTION private.public_location_text_sanitize(value text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO 'pg_catalog'
AS $fn$
declare t text := value;
begin
  -- GEO-PRIVACY 2026-11-21: public place text never carries a house number or a coordinate.
  -- Kept: street/POI/area names, ordinal street names ("27. marta"), "Blok 45", 5-digit postal codes, road codes ("E-75").
  t := regexp_replace(t, '(?<![[:alnum:]])-?\d{1,3}[.,]\d{3,}(?![[:alnum:]])', ' ', 'g');
  t := regexp_replace(t, '(?<![[:alpha:]])(br|broj|ulaz|stan|sprat|lokal|бр|број|улаз|стан|спрат|локал)\.?\s*\d{1,4}([[:alpha:]](?![[:alpha:]]))?(?![[:alnum:]])', ' ', 'gi');
  t := regexp_replace(t, '(?<![[:alnum:]-])(?<!blok )(?<!блок )\d{1,4}([[:alpha:]](?![[:alpha:]]))?(\s*[/-]\s*\d{1,4}([[:alpha:]](?![[:alpha:]]))?)?(?![[:alnum:]])(?!\.\s*[[:alpha:]])', ' ', 'gi');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := regexp_replace(t, '\s+([,;.])(?=\s|$|[,;])', '\1', 'g');
  t := regexp_replace(t, '([,;])(\s*[,;.])+', '\1', 'g');
  t := regexp_replace(t, '^[\s,;./-]+|[\s,;/-]+$', '', 'g');
  return t;
end
$fn$;

CREATE OR REPLACE FUNCTION private.public_location_point_sanitize(value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $fn$
declare k text; clean text; result jsonb;
begin
  if value is null or jsonb_typeof(value) is distinct from 'object' then return value; end if;
  result := value;
  foreach k in array ARRAY['label','area','city'] loop
    if jsonb_typeof(value->k) = 'string' then
      clean := private.public_location_text_sanitize(value->>k);
      if coalesce(clean,'') = '' then result := result - k;
      else result := jsonb_set(result, ARRAY[k], to_jsonb(clean)); end if;
    end if;
  end loop;
  if value <> '{}'::jsonb and not (result ?| ARRAY['label','area','city']) then
    raise exception 'LOCATION_PUBLIC_LABEL_INVALID' using errcode='22023';
  end if;
  return result;
end
$fn$;

CREATE OR REPLACE FUNCTION private.public_topology_sanitize(value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $fn$
declare k text; result jsonb;
begin
  -- Shape is preserved: every slot (A->B start/end, waypoints, serviceArea) stays; REMOTE has no slot.
  if value is null or jsonb_typeof(value) is distinct from 'object' then return value; end if;
  result := value;
  foreach k in array ARRAY['start','end','serviceArea'] loop
    if jsonb_typeof(value->k) = 'object' then
      result := jsonb_set(result, ARRAY[k], private.public_location_point_sanitize(value->k));
    end if;
  end loop;
  if jsonb_typeof(value->'waypoints') = 'array' then
    result := jsonb_set(result, ARRAY['waypoints'], (select coalesce(jsonb_agg(
      case when jsonb_typeof(w) = 'object' then private.public_location_point_sanitize(w) else w end order by o), '[]'::jsonb)
      from jsonb_array_elements(value->'waypoints') with ordinality x(w, o)));
  end if;
  return result;
end
$fn$;

CREATE OR REPLACE FUNCTION private.sanitize_need_geography_public_topology()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $fn$
begin
 if auth.role()='service_role' then
  if TG_OP='UPDATE' and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),to_jsonb(NEW)) then
   return NEW;
  end if;
 end if;
  -- Chokepoint for every writer: the market-readable topology carries no house number; the exact address stays in need_sensitive.
  new.public_topology := private.public_topology_sanitize(new.public_topology);
  return new;
end
$fn$;
-- GEO_PRIVACY_SANITIZER_FUNCTIONS_END

REVOKE ALL ON FUNCTION private.public_location_text_sanitize(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.public_location_point_sanitize(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.public_topology_sanitize(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.sanitize_need_geography_public_topology() FROM PUBLIC, anon, authenticated, service_role;

DO $new_function_postimage$
DECLARE
  expected jsonb := '{"private.public_location_text_sanitize(text)":"165d3e8e8168191c7b6809fc62f0ddd6","private.public_location_point_sanitize(jsonb)":"6dd664f344b39da250e58170d67a696e","private.public_topology_sanitize(jsonb)":"8710f3c4e4e3c81bf6dae0a10ee3b9a0","private.sanitize_need_geography_public_topology()":"0118429cce7073bbbf1d2da0ff5c9681"}'::jsonb;
  definer jsonb := '{"private.public_location_text_sanitize(text)":false,"private.public_location_point_sanitize(jsonb)":false,"private.public_topology_sanitize(jsonb)":false,"private.sanitize_need_geography_public_topology()":true}'::jsonb;
  k text;
  actual record;
BEGIN
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl, prosecdef, proconfig
      INTO actual FROM pg_proc WHERE oid=to_regprocedure(k);
    IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM expected->>k OR actual.owner IS DISTINCT FROM 'postgres'
       OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
       OR actual.prosecdef IS DISTINCT FROM (definer->>k)::boolean
       OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] THEN
      RAISE EXCEPTION 'GEO_PRIVACY_NEW_FUNCTION_POSTIMAGE_DRIFT %', k;
    END IF;
  END LOOP;
  IF private.public_location_text_sanitize('Omladinskih brigada 11, Beograd') IS DISTINCT FROM 'Omladinskih brigada, Beograd'
     OR private.public_location_text_sanitize('Bulevar oslobođenja 12a') IS DISTINCT FROM 'Bulevar oslobođenja'
     OR private.public_location_text_sanitize('Novi Sad') IS DISTINCT FROM 'Novi Sad'
     OR private.public_location_text_sanitize('Bulevar 27. marta 15') IS DISTINCT FROM 'Bulevar 27. marta' THEN
    RAISE EXCEPTION 'GEO_PRIVACY_SANITIZER_BEHAVIOR_DRIFT';
  END IF;
END
$new_function_postimage$;

DO $patch_normalize_location_point$
DECLARE
  target regprocedure := 'private.normalize_location_point(jsonb)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM false
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_NORMALIZE_LOCATION_POINT_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '4f88e8d4655d56227b23d6a576998a8a' THEN
    RAISE NOTICE 'PATCH_NORMALIZE_LOCATION_POINT_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '4474c1c9e96f4dd8993992a566fe883e' THEN RAISE EXCEPTION 'PATCH_NORMALIZE_LOCATION_POINT_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  return result;$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_NORMALIZE_LOCATION_POINT_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  return result;$a$, $a$  return private.public_location_point_sanitize(result);$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4f88e8d4655d56227b23d6a576998a8a'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_NORMALIZE_LOCATION_POINT_POSTIMAGE_DRIFT'; END IF;
END
$patch_normalize_location_point$;

DO $patch_resolved_location_binding_grid$
DECLARE
  target regprocedure := 'private.check_need_resolved_location_binding()'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_RESOLVED_LOCATION_BINDING_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '4ff95e9d5235ceb8c688f0de86a6a8da' THEN
    RAISE NOTICE 'PATCH_RESOLVED_LOCATION_BINDING_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '002e289036ba9e6bce3592c83fb22824' THEN RAISE EXCEPTION 'PATCH_RESOLVED_LOCATION_BINDING_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  if n.approximate_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
    or n.approximate_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,2) then$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_RESOLVED_LOCATION_BINDING_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  if n.approximate_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
    or n.approximate_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,2) then$a$, $a$  -- GEO-200M: public point on the 0.002-degree grid; points materialized before 2026-11-21 keep the coarser 0.01-degree point.
  if not ((n.approximate_lat is not distinct from round(round((anchor->>'latitudeE6')::numeric/2000)/500,3)
      and n.approximate_lng is not distinct from round(round((anchor->>'longitudeE6')::numeric/2000)/500,3))
    or (n.approximate_lat is not distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
      and n.approximate_lng is not distinct from round((anchor->>'longitudeE6')::numeric/1000000,2))) then$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4ff95e9d5235ceb8c688f0de86a6a8da'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_RESOLVED_LOCATION_BINDING_GRID_POSTIMAGE_DRIFT'; END IF;
END
$patch_resolved_location_binding_grid$;

DO $patch_materialize_grid$
DECLARE
  target regprocedure := 'private.materialize_resolved_location(uuid,uuid)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_MATERIALIZE_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '77f9d093b970774413047dd2ebd4780c' THEN
    RAISE NOTICE 'PATCH_MATERIALIZE_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM 'cee9fed5ae6fecad3de73e1537bbac99' THEN RAISE EXCEPTION 'PATCH_MATERIALIZE_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2) where id=nid;$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_MATERIALIZE_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2) where id=nid;$a$, $a$    update public.needs set approximate_lat=round(round((anchor->>'latitudeE6')::numeric/2000)/500,3),
      approximate_lng=round(round((anchor->>'longitudeE6')::numeric/2000)/500,3) where id=nid;$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '77f9d093b970774413047dd2ebd4780c'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_MATERIALIZE_GRID_POSTIMAGE_DRIFT'; END IF;
END
$patch_materialize_grid$;

DO $patch_worker_location_grid$
DECLARE
  target regprocedure := 'public.rpc_save_worker_location(text,jsonb,boolean)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_WORKER_LOCATION_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = 'fce3b8b96bbf2e0f35bd4dc9f5c8d6dc' THEN
    RAISE NOTICE 'PATCH_WORKER_LOCATION_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '12b4505d1f6a5f97053a48ed72128af3' THEN RAISE EXCEPTION 'PATCH_WORKER_LOCATION_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$lat<>round(lat,2) or lng<>round(lng,2)$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_WORKER_LOCATION_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$lat<>round(lat,2) or lng<>round(lng,2)$a$, $a$lat*500<>round(lat*500) or lng*500<>round(lng*500)$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'fce3b8b96bbf2e0f35bd4dc9f5c8d6dc'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_WORKER_LOCATION_GRID_POSTIMAGE_DRIFT'; END IF;
END
$patch_worker_location_grid$;

DO $patch_worker_ai_position_grid$
DECLARE
  target regprocedure := 'private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_WORKER_AI_POSITION_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '85b617d8d64cc542b452f7129ddc11ae' THEN
    RAISE NOTICE 'PATCH_WORKER_AI_POSITION_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '72c241bc11a844f9e5779f046bb56e20' THEN RAISE EXCEPTION 'PATCH_WORKER_AI_POSITION_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_WORKER_AI_POSITION_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then$a$, $a$    or (item->>'latitude')::numeric*500<>round((item->>'latitude')::numeric*500)
    or (item->>'longitude')::numeric*500<>round((item->>'longitude')::numeric*500) then$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '85b617d8d64cc542b452f7129ddc11ae'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_WORKER_AI_POSITION_GRID_POSTIMAGE_DRIFT'; END IF;
END
$patch_worker_ai_position_grid$;

DO $patch_discovery_point_grid$
DECLARE
  target regprocedure := 'public.rpc_discovery_v1(jsonb)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM false
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_DISCOVERY_POINT_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '52bbc64250f09bc3287aec07eda3484a' THEN
    RAISE NOTICE 'PATCH_DISCOVERY_POINT_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM 'dc53bf4f14b1e35fdb1e12ff883d1edb' THEN RAISE EXCEPTION 'PATCH_DISCOVERY_POINT_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_DISCOVERY_POINT_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng$a$, $a$point_lat*500<>round(point_lat*500) or point_lng*500<>round(point_lng*500)$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '52bbc64250f09bc3287aec07eda3484a'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_DISCOVERY_POINT_GRID_POSTIMAGE_DRIFT'; END IF;
END
$patch_discovery_point_grid$;

DO $patch_draft_writer_sanitize$
DECLARE
  target regprocedure := 'public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_DRAFT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = 'ffa8678d643a72ace3cad2c321a4210b' THEN
    RAISE NOTICE 'PATCH_DRAFT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '39a3d39e60e8ab42f7e0269aba965280' THEN RAISE EXCEPTION 'PATCH_DRAFT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=v_facts->'need.task_geography';$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_DRAFT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=v_facts->'need.task_geography';$a$, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'ffa8678d643a72ace3cad2c321a4210b'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_DRAFT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$patch_draft_writer_sanitize$;

DO $patch_edit_writer_sanitize$
DECLARE
  target regprocedure := 'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_EDIT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '82a6a99c52610f31232461b0e8e19741' THEN
    RAISE NOTICE 'PATCH_EDIT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '4742520f9660b9ecabbe4a165a660eb5' THEN RAISE EXCEPTION 'PATCH_EDIT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=v_facts->'need.task_geography';$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_EDIT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=v_facts->'need.task_geography';$a$, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '82a6a99c52610f31232461b0e8e19741'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_EDIT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$patch_edit_writer_sanitize$;

DO $patch_replacement_writer_sanitize$
DECLARE
  target regprocedure := 'private.stage_task_replacement(uuid,uuid,text,jsonb)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PATCH_REPLACEMENT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '0aafb04eceffd3c9d1efbb329028210e' THEN
    RAISE NOTICE 'PATCH_REPLACEMENT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM 'fd9e9aae4ed6de23207d0c07c5c41941' THEN RAISE EXCEPTION 'PATCH_REPLACEMENT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=v_facts->'need.task_geography';$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PATCH_REPLACEMENT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=v_facts->'need.task_geography';$a$, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '0aafb04eceffd3c9d1efbb329028210e'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'PATCH_REPLACEMENT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$patch_replacement_writer_sanitize$;

DO $geography_sanitize_trigger$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.need_geography'::regclass
      AND tgname='need_geography_public_topology_sanitize_trg') THEN
    CREATE TRIGGER need_geography_public_topology_sanitize_trg
      BEFORE INSERT OR UPDATE OF public_topology ON public.need_geography
      FOR EACH ROW EXECUTE FUNCTION private.sanitize_need_geography_public_topology();
  END IF;
  IF (SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.need_geography'::regclass
      AND tgname='need_geography_public_topology_sanitize_trg') IS DISTINCT FROM 'O'
     OR position('BEFORE INSERT OR UPDATE OF public_topology' in (SELECT pg_get_triggerdef(oid) FROM pg_trigger
      WHERE tgrelid='public.need_geography'::regclass AND tgname='need_geography_public_topology_sanitize_trg'))=0 THEN
    RAISE EXCEPTION 'GEO_PRIVACY_TRIGGER_POSTIMAGE_DRIFT';
  END IF;
END
$geography_sanitize_trigger$;

DO $backfill_existing_rows$
DECLARE
  r record;
  rl jsonb;
  clean jsonb;
  clean_binding jsonb;
  geo_fix boolean;
  binding_fix boolean;
  fixed_geography integer := 0;
  fixed_binding integer := 0;
  skipped_closed integer := 0;
BEGIN
  -- Private, owner-only preimage of every row this block changes (the raw label may hold a house number).
  CREATE TABLE IF NOT EXISTS private.geo_privacy_20261121_preimage(
    need_id uuid PRIMARY KEY,
    public_topology jsonb NOT NULL,
    resolved_location jsonb,
    captured_at timestamptz NOT NULL DEFAULT statement_timestamp());
  REVOKE ALL ON TABLE private.geo_privacy_20261121_preimage FROM PUBLIC, anon, authenticated, service_role;
  ALTER TABLE private.geo_privacy_20261121_preimage ENABLE ROW LEVEL SECURITY;

  IF (SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.need_sensitive'::regclass
      AND tgname='guard_need_resolved_location_write_trg') IS DISTINCT FROM 'O' THEN
    RAISE EXCEPTION 'GEO_PRIVACY_SENSITIVE_GUARD_STATE_DRIFT';
  END IF;
  -- The owner/DRAFT guard cannot authorize a migration; it is re-enabled below in the same transaction and the
  -- deferred LOCATION_BINDING constraint triggers still re-validate every touched row at COMMIT.
  ALTER TABLE public.need_sensitive DISABLE TRIGGER guard_need_resolved_location_write_trg;

  FOR r IN SELECT g.need_id, g.public_topology, n.requester_account_id
             FROM public.need_geography g JOIN public.needs n ON n.id=g.need_id
            ORDER BY g.need_id FOR UPDATE OF g LOOP
    clean := private.public_topology_sanitize(r.public_topology);
    geo_fix := clean IS DISTINCT FROM r.public_topology;
    rl := NULL;
    SELECT s.resolved_location INTO rl FROM public.need_sensitive s WHERE s.need_id=r.need_id FOR UPDATE;
    clean_binding := CASE WHEN rl IS NULL THEN NULL ELSE private.normalize_task_geography(clean) END;
    binding_fix := rl IS NOT NULL AND rl#>'{value,binding,geography}' IS DISTINCT FROM clean_binding;
    CONTINUE WHEN NOT geo_fix AND NOT binding_fix;
    IF private.closure_account_restricted(r.requester_account_id) THEN
      -- Closed/closing accounts are hidden by v5_closed_account_visibility and fenced by closure guards.
      skipped_closed := skipped_closed + 1;
      CONTINUE;
    END IF;
    INSERT INTO private.geo_privacy_20261121_preimage(need_id, public_topology, resolved_location)
      VALUES (r.need_id, r.public_topology, rl)
      ON CONFLICT (need_id) DO NOTHING;
    IF geo_fix THEN
      UPDATE public.need_geography SET public_topology=clean, updated_at=statement_timestamp() WHERE need_id=r.need_id;
      fixed_geography := fixed_geography + 1;
    END IF;
    IF binding_fix THEN
      -- Only a sanitization-only difference may be rewritten; any other mismatch is a real binding change.
      IF private.normalize_task_geography(rl#>'{value,binding,geography}') IS DISTINCT FROM clean_binding THEN
        RAISE EXCEPTION 'GEO_PRIVACY_BINDING_NOT_SANITIZATION_ONLY %', r.need_id;
      END IF;
      UPDATE public.need_sensitive
         SET resolved_location=jsonb_set(resolved_location, '{value,binding,geography}', clean_binding)
       WHERE need_id=r.need_id AND resolved_location IS NOT DISTINCT FROM rl;
      IF NOT FOUND THEN RAISE EXCEPTION 'GEO_PRIVACY_BINDING_RACE %', r.need_id; END IF;
      fixed_binding := fixed_binding + 1;
    END IF;
  END LOOP;

  -- Run the deferred LOCATION_BINDING checks for the rewritten rows now, so the guard can be re-enabled in this transaction.
  SET CONSTRAINTS ALL IMMEDIATE;
  ALTER TABLE public.need_sensitive ENABLE TRIGGER guard_need_resolved_location_write_trg;
  RAISE NOTICE 'GEO_PRIVACY_BACKFILL geography=% binding=% skipped_closed=%', fixed_geography, fixed_binding, skipped_closed;
END
$backfill_existing_rows$;

DO $postflight$
BEGIN
  IF (SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.need_sensitive'::regclass
      AND tgname='guard_need_resolved_location_write_trg') IS DISTINCT FROM 'O' THEN
    RAISE EXCEPTION 'GEO_PRIVACY_POSTFLIGHT_SENSITIVE_GUARD';
  END IF;
  IF EXISTS (SELECT 1 FROM public.need_geography g JOIN public.needs n ON n.id=g.need_id
              WHERE NOT private.closure_account_restricted(n.requester_account_id)
                AND private.public_topology_sanitize(g.public_topology) IS DISTINCT FROM g.public_topology) THEN
    RAISE EXCEPTION 'GEO_PRIVACY_POSTFLIGHT_PUBLIC_LABEL';
  END IF;
  IF EXISTS (SELECT 1 FROM public.need_sensitive s JOIN public.needs n ON n.id=s.need_id
              LEFT JOIN public.need_geography g ON g.need_id=s.need_id
              WHERE s.resolved_location IS NOT NULL AND NOT private.closure_account_restricted(n.requester_account_id)
                AND private.resolved_location_record_valid(s.resolved_location, n.task_country_code, g.public_topology,
                      s.exact_address, n.requester_account_id) IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'GEO_PRIVACY_POSTFLIGHT_BINDING';
  END IF;
END
$postflight$;

COMMIT;
