-- R05/F18: 300km prefilter rescue for saved worker workAreas, LOCAL_ONLY.
-- The dispatch retrieval is a superset of the authoritative worker_area_fit_v1;
-- no extension of manual application, no guessed GPS, no false notification.
-- Both original candidate_profile_ids and capped v1b require the same gap fix.
-- Index only derived expressions over existing review rows: no copied location,
-- new Save owner, projection table, trigger, or independent retention lifecycle.
-- Review-index hits become authority only through the latest owned Save below.
-- p_limit still bounds outputs, not every final-gate rejection. This removes the
-- global far-profile/area-reader scan; it is not a persisted dispatch cursor or
-- a claim of a fixed total work budget. Real PostGIS/dispatch acceptance is open.
-- Never run on DEV, migrations, production or managed Auth without R01 approval.
BEGIN;
DO $admit$
BEGIN
 IF current_setting('uskoci.r05.saved_area_retrieval.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_database()<>'postgres' OR current_user<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL
 THEN RAISE EXCEPTION 'R05_SAVED_AREA_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.candidate_profile_ids(uuid,integer)')))
    IS DISTINCT FROM '665d3bcba58ea4a930a5ac5801383a84'
 OR md5(pg_get_functiondef(to_regprocedure('private.candidate_profile_ids_v1b(uuid,integer,integer)')))
    IS DISTINCT FROM '60b8eae4b4efa8a6b05b81c6c08b0021'
 OR md5(pg_get_functiondef(to_regprocedure('private.worker_saved_areas_v1(uuid)')))
    IS DISTINCT FROM '4b9e8a4114dc962f58aa5488b2ee9675'
 OR md5(pg_get_functiondef(to_regprocedure('private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric)')))
    IS DISTINCT FROM '89bb9de67e0cae401b0447636a9e0939'
 OR md5(pg_get_functiondef(to_regprocedure('private.dispatch_cheap_candidate_admitted(uuid,uuid)')))
    IS DISTINCT FROM '3a29aaf12ec94c4a83743944a973dc09'
 OR md5(pg_get_functiondef(to_regprocedure('private.worker_notify_room_v1b(uuid,integer)')))
    IS DISTINCT FROM '591a2c4ca91722217a098e05f2bbb9ab'
 OR md5(pg_get_functiondef(to_regprocedure('private.validate_worker_areas_v1(jsonb)')))
    IS DISTINCT FROM '22233ee6f1029842db9fe465ddb5398f'
 OR md5(pg_get_functiondef(to_regprocedure('private.worker_area_city_key_v1(text)')))
    IS DISTINCT FROM '6ea6e5923e7aaf8934ac277a864b9067'
 OR md5(pg_get_functiondef(to_regprocedure('private.haversine_km(numeric,numeric,numeric,numeric)')))
    IS DISTINCT FROM '5a5848cbf4f91f2f216290e00cf89f1e'
 THEN RAISE EXCEPTION 'R05_SAVED_AREA_SOURCE_DRIFT' USING errcode='55000'; END IF;
END; $admit$;

-- INDEXED SOURCE BEGINS:
-- Invalid/erased/legacy JSON contributes no keys. A review is still not a Save.
CREATE FUNCTION private.worker_area_retrieval_keys_v1(areas jsonb)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path TO 'pg_catalog'
AS $f$
declare a jsonb; keys text[]:='{}';
begin
 if areas is null or jsonb_typeof(areas) is distinct from 'array' then return keys; end if;
 perform private.validate_worker_areas_v1(areas);
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='COUNTRY' then keys:=array_append(keys,'COUNTRY:RS');
  elsif a->>'kind'='CITY' then
   keys:=array_append(keys,'CITY:'||private.worker_area_city_key_v1(a->>'city'));
  end if;
 end loop;
 return keys;
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then return '{}'::text[];
end; $f$;
REVOKE ALL ON FUNCTION private.worker_area_retrieval_keys_v1(jsonb) FROM public,anon,authenticated,service_role;

CREATE FUNCTION private.worker_area_radius_centers_v1(areas jsonb)
RETURNS extensions.geography LANGUAGE plpgsql IMMUTABLE SET search_path TO 'pg_catalog'
AS $f$
declare a jsonb; points extensions.geometry[]:='{}';
begin
 if areas is null or jsonb_typeof(areas) is distinct from 'array' then return null; end if;
 perform private.validate_worker_areas_v1(areas);
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='RADIUS' then
   points:=array_append(points,extensions.ST_SetSRID(extensions.ST_MakePoint(
    (a->>'longitude')::double precision,(a->>'latitude')::double precision),4326));
  end if;
 end loop;
 if cardinality(points)=0 then return null; end if;
 return extensions.ST_Collect(points)::extensions.geography;
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then return null;
end; $f$;
REVOKE ALL ON FUNCTION private.worker_area_radius_centers_v1(jsonb) FROM public,anon,authenticated,service_role;

CREATE INDEX r05_worker_review_area_keys_idx ON private.worker_ai_reviews
 USING gin (private.worker_area_retrieval_keys_v1(envelope#>'{profile,workAreas}'));
CREATE INDEX r05_worker_review_radius_centers_idx ON private.worker_ai_reviews
 USING gist (private.worker_area_radius_centers_v1(envelope#>'{profile,workAreas}'));
CREATE INDEX r05_worker_saves_latest_idx ON private.worker_ai_saves
 (account_id,created_at DESC,review_id DESC);

CREATE FUNCTION private.worker_saved_area_candidates_v1(country text,city text,lat numeric,lng numeric)
RETURNS TABLE(worker_account_id uuid) LANGUAGE sql STABLE SET search_path TO 'pg_catalog'
AS $f$
 with area_reviews as materialized (
  select r.id,r.account_id from private.worker_ai_reviews r
  where country='RS' and private.worker_area_retrieval_keys_v1(r.envelope#>'{profile,workAreas}')
   && (array['COUNTRY:RS']::text[] || case when private.worker_area_city_key_v1(city)<>''
       then array['CITY:'||private.worker_area_city_key_v1(city)] else '{}'::text[] end)
  union
  select r.id,r.account_id from private.worker_ai_reviews r
  where country='RS' and lat is not null and lng is not null
   and extensions.ST_DWithin(private.worker_area_radius_centers_v1(r.envelope#>'{profile,workAreas}'),
    case when lat between -90 and 90 and lng between -180 and 180 then
     extensions.ST_SetSRID(extensions.ST_MakePoint(lng::double precision,lat::double precision),4326)::extensions.geography
     else null end,
    201000.0,false)
  -- Validator caps each explicit radius at 200 km. 201 km on the PostGIS
  -- sphere is a conservative superset of the existing 6371-km haversine,
  -- including its rounding to 0.01 km. The exact radius remains area-fit's job.
 )
 select distinct r.account_id from area_reviews r
 join private.worker_ai_saves s on s.review_id=r.id and s.account_id=r.account_id
 where s.review_id=(
  select latest.review_id from private.worker_ai_saves latest
  join private.worker_ai_reviews owned on owned.id=latest.review_id and owned.account_id=latest.account_id
  where latest.account_id=s.account_id
  order by latest.created_at desc,latest.review_id desc limit 1
 );
$f$;
REVOKE ALL ON FUNCTION private.worker_saved_area_candidates_v1(text,text,numeric,numeric) FROM public,anon,authenticated,service_role;
-- INDEXED SOURCE ENDS.

-- PATCH BEGINS:
-- exact source owner, kept apart from the admission guard for synthetic SQL tests.
DO $patch$
DECLARE v_sig text;v_old text;v_new text;v_anchor text;v_decl text;v_extra text;
BEGIN
 v_decl:='c record; task_geog extensions.geography;';
 v_anchor:=E'    if admitted < p_limit then\n      for c in\n        select p.id as pid';
 FOR v_sig IN SELECT unnest(ARRAY[
   'private.candidate_profile_ids(uuid,integer)',
   'private.candidate_profile_ids_v1b(uuid,integer,integer)'
 ]) LOOP
   v_old:=pg_get_functiondef(to_regprocedure(v_sig));
   IF v_old IS NULL OR length(v_old)-length(replace(v_old,v_decl,''))<>length(v_decl)
   OR length(v_old)-length(replace(v_old,v_anchor,''))<>length(v_anchor)
   THEN RAISE EXCEPTION 'R05_SAVED_AREA_ANCHOR_DRIFT' USING errcode='55000'; END IF;
   v_new:=replace(v_old,v_decl,v_decl||' v_areas jsonb;');
   IF v_sig='private.candidate_profile_ids_v1b(uuid,integer,integer)' THEN
     v_extra:=$cap$
    -- R05_SAVED_AREA_300KM_RESCUE: a far legacy pin cannot veto the signed area.
    if admitted < p_limit then
      for c in
        select pref.worker_profile_id as pid,pref.worker_account_id as uid
        from private.worker_saved_area_candidates_v1(n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng) saved
        join public.worker_match_preferences pref on pref.worker_account_id=saved.worker_account_id
        join public.app_profiles p on p.id=pref.worker_profile_id and p.account_id=pref.worker_account_id
        where p.kind='WORKER' and p.profile_status='ACTIVE'
          and pref.approximate_geog is not null
          and not extensions.ST_DWithin(pref.approximate_geog,task_geog,300000.0)
        order by pref.worker_profile_id
      loop
        v_areas:=private.worker_saved_areas_v1(c.uid);
        if jsonb_typeof(v_areas)='array' and jsonb_array_length(v_areas)>0
          and private.worker_area_fit_v1(v_areas,n.execution_location_mode,n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng) IS TRUE
          and private.worker_notify_room_v1b(c.uid,p_cap)
          and private.dispatch_cheap_candidate_admitted(n.id,c.pid) then
          worker_profile_id:=c.pid;return next;
          admitted:=admitted+1;exit when admitted>=p_limit;
        end if;
      end loop;
    end if;

$cap$;
   ELSE
     v_extra:=$plain$
    -- R05_SAVED_AREA_300KM_RESCUE: a far legacy pin cannot veto the signed area.
    if admitted < p_limit then
      for c in
        select pref.worker_profile_id as pid,pref.worker_account_id as uid
        from private.worker_saved_area_candidates_v1(n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng) saved
        join public.worker_match_preferences pref on pref.worker_account_id=saved.worker_account_id
        join public.app_profiles p on p.id=pref.worker_profile_id and p.account_id=pref.worker_account_id
        where p.kind='WORKER' and p.profile_status='ACTIVE'
          and pref.approximate_geog is not null
          and not extensions.ST_DWithin(pref.approximate_geog,task_geog,300000.0)
        order by pref.worker_profile_id
      loop
        v_areas:=private.worker_saved_areas_v1(c.uid);
        if jsonb_typeof(v_areas)='array' and jsonb_array_length(v_areas)>0
          and private.worker_area_fit_v1(v_areas,n.execution_location_mode,n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng) IS TRUE
          and private.dispatch_cheap_candidate_admitted(n.id,c.pid) then
          worker_profile_id:=c.pid;return next;
          admitted:=admitted+1;exit when admitted>=p_limit;
        end if;
      end loop;
    end if;

$plain$;
   END IF;
   v_new:=replace(v_new,v_anchor,v_extra||v_anchor);
   EXECUTE v_new;
   IF position('R05_SAVED_AREA_300KM_RESCUE' in pg_get_functiondef(to_regprocedure(v_sig)))=0
     OR position('v_areas jsonb;' in pg_get_functiondef(to_regprocedure(v_sig)))=0
   THEN RAISE EXCEPTION 'R05_SAVED_AREA_PATCH_NOT_APPLIED' USING errcode='55000'; END IF;
 END LOOP;
END; $patch$;
-- PATCH ENDS.
COMMIT;
