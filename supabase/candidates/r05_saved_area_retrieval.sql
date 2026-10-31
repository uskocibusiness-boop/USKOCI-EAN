-- R05/F18: 300km prefilter rescue for saved worker workAreas, LOCAL_ONLY.
-- The dispatch retrieval is a superset of the authoritative worker_area_fit_v1;
-- no extension of manual application, no guessed GPS, no false notification.
-- Both original candidate_profile_ids and capped v1b require the same gap fix.
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
 THEN RAISE EXCEPTION 'R05_SAVED_AREA_SOURCE_DRIFT' USING errcode='55000'; END IF;
END; $admit$;

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
        from public.worker_match_preferences pref
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
        from public.worker_match_preferences pref
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
