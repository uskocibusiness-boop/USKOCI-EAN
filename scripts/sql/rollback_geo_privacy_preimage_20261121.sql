-- USKOCI DEV rollback preimage for scripts/sql/geo_privacy_20261121.candidate.sql, captured read-only 2026-11-21.
-- SOURCE-ONLY. Restore only as a controlled rollback after the owner approves it.
-- Every patched function is restored by the exact inverse anchor and must end on its pinned DEV preimage md5
-- (the forward/inverse round trip was proven on DEV with read-only md5(replace(...)) checks). The verbatim DEV
-- definitions of the four small patched functions follow after COMMIT as a reference comment; the five large ones
-- (rpc_discovery_v1, worker_ai_patch and the three task writers) are restored only by the md5-pinned inverse anchor.
-- Data is NOT reverted: re-publishing the raw labels would re-expose house numbers. The raw preimage stays in
-- private.geo_privacy_20261121_preimage; the sanitized bindings remain valid under the restored functions.
-- check_need_resolved_location_binding stays on the tolerant version while any resolved row already carries a
-- 0.002-degree (non-0.01) public point, because the old check would reject those rows.
DO $source_only$
BEGIN
  RAISE EXCEPTION 'GEO_PRIVACY_20261121_ROLLBACK_SOURCE_ONLY';
END
$source_only$;

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

DROP TRIGGER IF EXISTS need_geography_public_topology_sanitize_trg ON public.need_geography;
DROP FUNCTION IF EXISTS private.sanitize_need_geography_public_topology();

DO $rollback_patch_replacement_writer_sanitize$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_REPLACEMENT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = 'fd9e9aae4ed6de23207d0c07c5c41941' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_REPLACEMENT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '0aafb04eceffd3c9d1efbb329028210e' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_REPLACEMENT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_REPLACEMENT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$, $a$  v_geo:=v_facts->'need.task_geography';$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'fd9e9aae4ed6de23207d0c07c5c41941'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_REPLACEMENT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_replacement_writer_sanitize$;

DO $rollback_patch_edit_writer_sanitize$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_EDIT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '4742520f9660b9ecabbe4a165a660eb5' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_EDIT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '82a6a99c52610f31232461b0e8e19741' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_EDIT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_EDIT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$, $a$  v_geo:=v_facts->'need.task_geography';$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4742520f9660b9ecabbe4a165a660eb5'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_EDIT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_edit_writer_sanitize$;

DO $rollback_patch_draft_writer_sanitize$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DRAFT_WRITER_SANITIZE_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '39a3d39e60e8ab42f7e0269aba965280' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_DRAFT_WRITER_SANITIZE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM 'ffa8678d643a72ace3cad2c321a4210b' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DRAFT_WRITER_SANITIZE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_DRAFT_WRITER_SANITIZE_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');$a$, $a$  v_geo:=v_facts->'need.task_geography';$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '39a3d39e60e8ab42f7e0269aba965280'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DRAFT_WRITER_SANITIZE_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_draft_writer_sanitize$;

DO $rollback_patch_discovery_point_grid$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DISCOVERY_POINT_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = 'dc53bf4f14b1e35fdb1e12ff883d1edb' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_DISCOVERY_POINT_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '52bbc64250f09bc3287aec07eda3484a' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DISCOVERY_POINT_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$point_lat*500<>round(point_lat*500) or point_lng*500<>round(point_lng*500)$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_DISCOVERY_POINT_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$point_lat*500<>round(point_lat*500) or point_lng*500<>round(point_lng*500)$a$, $a$round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'dc53bf4f14b1e35fdb1e12ff883d1edb'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_DISCOVERY_POINT_GRID_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_discovery_point_grid$;

DO $rollback_patch_worker_ai_position_grid$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_AI_POSITION_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '72c241bc11a844f9e5779f046bb56e20' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_WORKER_AI_POSITION_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '85b617d8d64cc542b452f7129ddc11ae' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_AI_POSITION_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$    or (item->>'latitude')::numeric*500<>round((item->>'latitude')::numeric*500)
    or (item->>'longitude')::numeric*500<>round((item->>'longitude')::numeric*500) then$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_AI_POSITION_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$    or (item->>'latitude')::numeric*500<>round((item->>'latitude')::numeric*500)
    or (item->>'longitude')::numeric*500<>round((item->>'longitude')::numeric*500) then$a$, $a$    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '72c241bc11a844f9e5779f046bb56e20'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_AI_POSITION_GRID_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_worker_ai_position_grid$;

DO $rollback_patch_worker_location_grid$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_LOCATION_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '12b4505d1f6a5f97053a48ed72128af3' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_WORKER_LOCATION_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM 'fce3b8b96bbf2e0f35bd4dc9f5c8d6dc' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_LOCATION_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$lat*500<>round(lat*500) or lng*500<>round(lng*500)$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_LOCATION_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$lat*500<>round(lat*500) or lng*500<>round(lng*500)$a$, $a$lat<>round(lat,2) or lng<>round(lng,2)$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '12b4505d1f6a5f97053a48ed72128af3'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_WORKER_LOCATION_GRID_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_worker_location_grid$;

DO $rollback_patch_materialize_grid$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_MATERIALIZE_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = 'cee9fed5ae6fecad3de73e1537bbac99' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_MATERIALIZE_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '77f9d093b970774413047dd2ebd4780c' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_MATERIALIZE_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$    update public.needs set approximate_lat=round(round((anchor->>'latitudeE6')::numeric/2000)/500,3),
      approximate_lng=round(round((anchor->>'longitudeE6')::numeric/2000)/500,3) where id=nid;$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_MATERIALIZE_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$    update public.needs set approximate_lat=round(round((anchor->>'latitudeE6')::numeric/2000)/500,3),
      approximate_lng=round(round((anchor->>'longitudeE6')::numeric/2000)/500,3) where id=nid;$a$, $a$    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2) where id=nid;$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'cee9fed5ae6fecad3de73e1537bbac99'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_MATERIALIZE_GRID_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_materialize_grid$;

DO $rollback_patch_resolved_location_binding_grid$
DECLARE
  target regprocedure := 'private.check_need_resolved_location_binding()'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.needs n JOIN public.need_sensitive s ON s.need_id=n.id
              WHERE s.resolved_location IS NOT NULL AND n.approximate_lat IS NOT NULL
                AND (n.approximate_lat<>round(n.approximate_lat,2) OR n.approximate_lng<>round(n.approximate_lng,2))) THEN
    RAISE NOTICE 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_KEPT_FOR_GRID_ROWS';
    RETURN;
  END IF;
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '002e289036ba9e6bce3592c83fb22824' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '4ff95e9d5235ceb8c688f0de86a6a8da' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  -- GEO-200M: public point on the 0.002-degree grid; points materialized before 2026-11-21 keep the coarser 0.01-degree point.
  if not ((n.approximate_lat is not distinct from round(round((anchor->>'latitudeE6')::numeric/2000)/500,3)
      and n.approximate_lng is not distinct from round(round((anchor->>'longitudeE6')::numeric/2000)/500,3))
    or (n.approximate_lat is not distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
      and n.approximate_lng is not distinct from round((anchor->>'longitudeE6')::numeric/1000000,2))) then$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  -- GEO-200M: public point on the 0.002-degree grid; points materialized before 2026-11-21 keep the coarser 0.01-degree point.
  if not ((n.approximate_lat is not distinct from round(round((anchor->>'latitudeE6')::numeric/2000)/500,3)
      and n.approximate_lng is not distinct from round(round((anchor->>'longitudeE6')::numeric/2000)/500,3))
    or (n.approximate_lat is not distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
      and n.approximate_lng is not distinct from round((anchor->>'longitudeE6')::numeric/1000000,2))) then$a$, $a$  if n.approximate_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
    or n.approximate_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,2) then$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '002e289036ba9e6bce3592c83fb22824'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_RESOLVED_LOCATION_BINDING_GRID_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_resolved_location_binding_grid$;

DO $rollback_patch_normalize_location_point$
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
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_NORMALIZE_LOCATION_POINT_METADATA_DRIFT'; END IF;
  IF actual.body_md5 = '4474c1c9e96f4dd8993992a566fe883e' THEN
    RAISE NOTICE 'ROLLBACK_PATCH_NORMALIZE_LOCATION_POINT_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF actual.body_md5 IS DISTINCT FROM '4f88e8d4655d56227b23d6a576998a8a' THEN RAISE EXCEPTION 'ROLLBACK_PATCH_NORMALIZE_LOCATION_POINT_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d, $a$  return private.public_location_point_sanitize(result);$a$), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ROLLBACK_PATCH_NORMALIZE_LOCATION_POINT_ANCHOR_DRIFT';
  END IF;
  d := replace(d, $a$  return private.public_location_point_sanitize(result);$a$, $a$  return result;$a$);
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4474c1c9e96f4dd8993992a566fe883e'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'ROLLBACK_PATCH_NORMALIZE_LOCATION_POINT_POSTIMAGE_DRIFT'; END IF;
END
$rollback_patch_normalize_location_point$;

DO $rollback_sanitizer_functions$
BEGIN
  -- The sanitizers stay while any live function (for example the kept tolerant binding check) references them.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname IN ('public','private')
                AND p.proname NOT IN ('public_topology_sanitize','public_location_point_sanitize','public_location_text_sanitize')
                AND (position('public_topology_sanitize' in p.prosrc)>0 OR position('public_location_point_sanitize' in p.prosrc)>0)) THEN
    RAISE NOTICE 'GEO_PRIVACY_ROLLBACK_SANITIZER_KEPT_REFERENCED';
    RETURN;
  END IF;
  DROP FUNCTION IF EXISTS private.public_topology_sanitize(jsonb);
  DROP FUNCTION IF EXISTS private.public_location_point_sanitize(jsonb);
  DROP FUNCTION IF EXISTS private.public_location_text_sanitize(text);
END
$rollback_sanitizer_functions$;

COMMIT;

/* Reference only: verbatim DEV preimage definitions (pg_get_functiondef, read-only 2026-11-21).
-- private.normalize_location_point(jsonb) | md5=4474c1c9e96f4dd8993992a566fe883e | owner=postgres | acl={postgres=X/postgres} | security_definer=f | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION private.normalize_location_point(value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare k text; result jsonb:='{}';
begin
  if value is null or value='null'::jsonb then return null; end if;
  if jsonb_typeof(value) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  if value-ARRAY['city','area','label']<>'{}'::jsonb or value='{}'::jsonb then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  foreach k in array ARRAY['city','area','label'] loop
    if value ? k then
      if private.location_text_valid(value->k,case k when 'label' then 240 else 160 end) is distinct from true then
        raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
      end if;
      result:=result||jsonb_build_object(k,btrim(value->>k));
    end if;
  end loop;
  return result;
end;
$function$;

-- private.check_need_resolved_location_binding() | md5=002e289036ba9e6bce3592c83fb22824 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION private.check_need_resolved_location_binding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare nid uuid; n public.needs; s public.need_sensitive; geo jsonb; point jsonb; anchor jsonb;
begin
 if auth.role()='service_role' then
  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then
   if TG_OP='DELETE' then return OLD;end if;return NEW;
  end if;
 end if;

  if tg_table_name='needs' then nid:=new.id; else nid:=new.need_id; end if;
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into s from public.need_sensitive where need_id=nid;
  if not found or s.resolved_location is null then return null; end if;
  select public_topology into geo from public.need_geography where need_id=nid;
  if private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo,s.exact_address,n.requester_account_id) is distinct from true then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  select p into point from jsonb_array_elements(s.resolved_location#>'{value,points}') p where p->>'slot'='start';
  if s.exact_lat is distinct from (point->>'latitudeE6')::numeric/1000000 or s.exact_lng is distinct from (point->>'longitudeE6')::numeric/1000000 then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  select p into anchor from jsonb_array_elements(s.resolved_location#>'{value,points}') p
    where p->>'slot'=case when geo->>'mode'='AREA_BASED' and geo ? 'serviceArea' then 'serviceArea' else 'start' end;
  if n.approximate_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
    or n.approximate_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,2) then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  return null;
end;
$function$;

-- private.materialize_resolved_location(uuid,uuid) | md5=cee9fed5ae6fecad3de73e1537bbac99 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION private.materialize_resolved_location(nid uuid, cid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare n public.needs; s public.need_sensitive; f public.ai_structured_facts; geo jsonb; val jsonb; rec jsonb;
  exact_point jsonb; anchor jsonb; had_resolved boolean;
begin
  select * into n from public.needs where id=nid and requester_account_id=auth.uid() for update;
  if not found or n.status<>'DRAFT' or exists(select 1 from public.agreements where need_id=nid)
    or exists(select 1 from public.need_selections where need_id=nid) then raise exception 'LOCATION_REVIEW_NOT_EDITABLE' using errcode='42501'; end if;
  perform 1 from public.ai_conversations where id=cid and account_id=auth.uid() and status='OPEN' for update;
  if not found then raise exception 'LOCATION_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  select * into s from public.need_sensitive where need_id=nid;
  had_resolved:=s.resolved_location is not null;
  select public_topology into geo from public.need_geography where need_id=nid;
  select * into f from public.ai_structured_facts where conversation_id=cid and fact_key='need.resolved_location' and superseded_at is null;
  if found then
    if f.status<>'CONFIRMED' or f.source<>'EXPLICIT_USER_ANSWER' or f.confirmed_by_user_id is distinct from auth.uid() or f.confirmed_at is null then
      raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
    val:=private.normalize_resolved_location(f.fact_value,n.task_country_code,geo,nullif(btrim(s.exact_address),''));
    rec:=jsonb_build_object('value',val,'confirmedByAccountId',f.confirmed_by_user_id,'confirmedAt',f.confirmed_at);
    if private.resolved_location_record_valid(rec,n.task_country_code,geo,s.exact_address,n.requester_account_id) is distinct from true then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    select p into exact_point from jsonb_array_elements(val->'points') p where p->>'slot'='start';
    select p into anchor from jsonb_array_elements(val->'points') p
      where p->>'slot'=case when geo->>'mode'='AREA_BASED' and geo ? 'serviceArea' then 'serviceArea' else 'start' end;
  end if;
  if rec is not null or had_resolved or (geo->>'mode'='REMOTE' and s.need_id is not null) then
    insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng,resolved_location)
    values(nid,coalesce(s.exact_address,''),coalesce(s.access_notes,''),
      (exact_point->>'latitudeE6')::numeric/1000000,(exact_point->>'longitudeE6')::numeric/1000000,rec)
    on conflict(need_id) do update set resolved_location=excluded.resolved_location,exact_lat=excluded.exact_lat,exact_lng=excluded.exact_lng,updated_at=statement_timestamp();
    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2) where id=nid;
  end if;
end;
$function$;

-- public.rpc_save_worker_location(text,jsonb,boolean) | md5=12b4505d1f6a5f97053a48ed72128af3 | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_save_worker_location(p_expected_revision text, p_value jsonb, p_confirmed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles; before_doc jsonb; wanted jsonb; v_city text; radius integer; coords jsonb; lat numeric; lng numeric; country text; previous_token text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>4096 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if p_value-ARRAY['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb or not (p_value ?& ARRAY['operatingCountryCode','city','radiusKm','approximatePosition'])
    or private.location_text_valid(p_value->'city',160) is distinct from true
    or jsonb_typeof(p_value->'radiusKm') is distinct from 'number' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if (p_value->>'radiusKm')::numeric not between 1 and 200 or trunc((p_value->>'radiusKm')::numeric)<>(p_value->>'radiusKm')::numeric then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  country:=private.require_location_country(p_value->'operatingCountryCode');
  v_city:=btrim(p_value->>'city');radius:=(p_value->>'radiusKm')::numeric::integer;coords:=p_value->'approximatePosition';
  if coords<>'null'::jsonb then
    if jsonb_typeof(coords) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if coords-ARRAY['latitude','longitude']<>'{}'::jsonb or jsonb_typeof(coords->'latitude') is distinct from 'number'
      or jsonb_typeof(coords->'longitude') is distinct from 'number' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    lat:=(coords->>'latitude')::numeric;lng:=(coords->>'longitude')::numeric;
    if lat not between -90 and 90 or lng not between -180 and 180 or lat<>round(lat,2) or lng<>round(lng,2) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
  end if;
  wanted:=jsonb_build_object('operatingCountryCode',country,'city',v_city,'radiusKm',radius,'approximatePosition',coords);
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  before_doc:=private.worker_location_document(p.id);
  if before_doc-ARRAY['revision','accountId','profileId']=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'location',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='PT409'; end if;
  previous_token:=current_setting('uskoci.profile_mutation',true);
  perform set_config('uskoci.profile_mutation','LOCATION_REVIEW',true);
  update public.app_profiles set operating_country_code=country, city=v_city, radius_km=radius where id=p.id;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
    values(p.id,auth.uid(),lat,lng) on conflict(worker_profile_id) do update set approximate_lat=excluded.approximate_lat,approximate_lng=excluded.approximate_lng;
  perform set_config('uskoci.profile_mutation',coalesce(previous_token,''),true);
  perform private.requeue_open_needs_for_worker_v5(p.account_id);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));
end;
$function$;
*/
