-- USKOCI — owner-approved DEV-only deployment of tested matcher safety fix.
-- Project: leqcwgzvjsxugfgzdmth. DO NOT deploy to PROD.
-- Only replaces private.worker_need_fit_v1; no users, tasks, cron, queues or notifications touched.
-- SUPABASE APPLY_MIGRATION executes the supplied SQL as an atomic migration.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $uskoci_guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid = 'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure
    AND md5(p.prosrc)='d511b48f7f3b38f52aaffee420108f8a'
    AND p.prosecdef AND p.provolatile='s' AND p.proparallel='u'
    AND pg_get_userbyid(p.proowner)='postgres'
    AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
    AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}'
 ) THEN RAISE EXCEPTION 'USKOCI_REPAIR_PRECISION_PREDECESSOR_OR_ACL_DRIFT' USING errcode='PT409'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.work_kinds_v5(text[])'::regprocedure)
    IS DISTINCT FROM '78fca96231ddc713cf18990f5a2a34ef' THEN
  RAISE EXCEPTION 'USKOCI_REPAIR_PRECISION_WORK_KIND_SOURCE_DRIFT' USING errcode='PT409';
 END IF;
 IF private.closure_source_digest_v5() IS DISTINCT FROM
    'c9ae36c11e535e0e78e047cf99e3a14c860344e1ff98f3317be9e106361a21df' THEN
  RAISE EXCEPTION 'USKOCI_REPAIR_PRECISION_CLOSURE_DRIFT' USING errcode='PT409';
 END IF;
END $uskoci_guard$;

CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1 (owner 2026-10-07): the ONE shared "Odgovara mi" rule = kind of work + area + time, plus the existing hard
-- exceptions (inactive profile, own task, other world, identity, exclusions). Read by match_detail_without_calendar
-- (dispatch and manual application), dispatch_cheap_candidate_admitted (dispatch prefilter) and "Za mene".
-- Tools, vehicles, experience and the minimum fee are NOT conditions: information for the requester only.
-- p_first_refusal=true (the dispatch prefilter, "Za mene"): stop at the first refusal, cheapest checks first, so a worker
-- who is out of the area or does another kind of work costs no kind-of-work registry read and no schedule read.
-- p_first_refusal=false (the detailed matcher): every component, for its blockers, reasons and score. Same expressions.
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[]:='{}'; svc boolean; area boolean; dist numeric; radius numeric; tier integer;
  effective_skills text[]; required_skill text;
begin
  select * into n from public.needs where id=nid;
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER';
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  if p.profile_status<>'ACTIVE' then hard:=array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id=p.account_id then hard:=array_append(hard,'OWN_NEED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;
  -- Area first (the cheapest and the most selective): the worker's circle around the task's public point (a route's START
  -- point), the same city when a point is missing. A task far from the worker costs three index reads and one distance.
  radius:=private.effective_radius_km(p.radius_km);
  if n.execution_location_mode='REMOTE' then
    dist:=null; area:=true;
  else
    select * into pref from public.worker_match_preferences where worker_profile_id=pid;
    dist:=private.haversine_km(n.approximate_lat,n.approximate_lng,pref.approximate_lat,pref.approximate_lng);
    area:=coalesce(case when dist is not null then dist<=radius
      else btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);
  end if;
  if p_first_refusal and not area then return jsonb_build_object('matches',false,'area',false); end if;
  -- The confirmed primary work type is mandatory, even when extra skills
  -- are explicitly requested. Empty additions never mean all workers match.
  effective_skills := array_remove(array[n.category]::text[],null);
  svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;
  -- Use existing canonical aliases for the primary service; NO extras may
  -- compensate when that primary type does not match the worker.
  if not svc then
    -- Interim safety gate: the generic SITNE_POPRAVKE alias is not proof
    -- that a worker can perform every specialist repair. Exact labels
    -- above are still accepted; verified specific identities will
    -- eventually be resolved by the new dynamic taxonomy.
    -- Other legacy alias groups retain their original behavior.
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;
  -- Each explicitly mandatory extra competency is an independent AND gate.
  -- Normal everyday tools must not be added as implied requirements here.
  if svc and coalesce(cardinality(n.required_skills),0)>0 then
    foreach required_skill in array n.required_skills loop
      if not (
        coalesce(private.lower_arr(p.skills) && private.lower_arr(array[required_skill]),false)
        or coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(array[required_skill]),false)
      ) then
        svc:=false;
        exit;
      end if;
    end loop;
  end if;
  if p_first_refusal and not svc then return jsonb_build_object('matches',false,'service',false); end if;
  -- Exclusions (any spelling of the same kind). An empty list can exclude nothing, so its kinds are never read.
  if coalesce(cardinality(p.exclusions),0)>0
     and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category,n.required_skills))
          or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category,n.required_skills)))
    then hard:=array_append(hard,'PROFILE_EXCLUSION'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;
  tier:=private.worker_need_time_tier_v1(nid,pid);
  return jsonb_build_object('matches',cardinality(hard)=0 and svc and area and tier is not null,
    'service',svc,'area',area,'timeTier',tier,'distanceKm',dist,'effectiveRadiusKm',radius,'hard',to_jsonb(hard));
end;
$function$;

DO $uskoci_postflight$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid = 'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure
    AND md5(p.prosrc)='1e698d3d22c887f639e4837a4e588d01'
    AND p.prosecdef AND p.provolatile='s' AND p.proparallel='u'
    AND pg_get_userbyid(p.proowner)='postgres'
    AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
    AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}'
 ) THEN RAISE EXCEPTION 'USKOCI_REPAIR_PRECISION_POSTFLIGHT_HASH_OR_ACL_MISMATCH' USING errcode='PT409'; END IF;
 IF private.closure_source_digest_v5() IS DISTINCT FROM
    'c9ae36c11e535e0e78e047cf99e3a14c860344e1ff98f3317be9e106361a21df' THEN
  RAISE EXCEPTION 'USKOCI_REPAIR_PRECISION_POSTFLIGHT_CLOSURE_DRIFT' USING errcode='PT409';
 END IF;
END $uskoci_postflight$;
