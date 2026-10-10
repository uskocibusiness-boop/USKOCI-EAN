-- USKOCI REVERT; PREPARED ONLY. NOT APPLIED to canonical DEV.
-- Function: private.worker_need_fit_v1(uuid,uuid,boolean)
-- Atomically refuse source drift, preserve existing ACL/security settings,
-- and verify the closure program source digest has not changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table match_category_before on commit drop as
select p.prosrc as body, p.proacl::text as acl, p.prosecdef as secdef,
  p.provolatile as volatility, p.proparallel as parallel, p.proconfig::text as settings,
  private.closure_source_digest_v5() as closure_digest
from pg_proc p where p.oid = 'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure;
do $preflight$
begin
 if (select count(*) from match_category_before)<>1 or
    (select md5(body) from match_category_before) is distinct from 'd18c47226723ffbbec474aa4547e1af1' then
   raise exception 'MATCH_CATEGORY_PREDECESSOR_DRIFT' using errcode='PT409';
 end if;
 if private.closure_source_digest_v5() is distinct from
    (select closure_digest from match_category_before) then
   raise exception 'MATCH_CATEGORY_CLOSURE_NOT_READY' using errcode='PT409';
 end if;
end $preflight$;

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
  -- Kind of work, first the same words: the task names none, or worker and task share a word.
  svc:=coalesce(coalesce(cardinality(n.required_skills),0)=0
       or private.lower_arr(p.skills) && private.lower_arr(n.required_skills),false);
  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;
  -- Kind of work in other words: the same hidden kind (PKG-031b / EX-06b), read only when no word is shared.
  if not svc then
    svc:=coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills),false);
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
$function$

do $postflight$
declare oldrow match_category_before%rowtype; newrow record;
begin
 select * into oldrow from match_category_before;
 select p.prosrc as body,p.proacl::text as acl,p.prosecdef as secdef,
   p.provolatile as volatility,p.proparallel as parallel,p.proconfig::text as settings
 into newrow from pg_proc p where p.oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure;
 if md5(newrow.body) is distinct from 'ab221f0091d78856bb42f702ddecd016'
    or (newrow.acl,newrow.secdef,newrow.volatility,newrow.parallel,newrow.settings)
       is distinct from (oldrow.acl,oldrow.secdef,oldrow.volatility,oldrow.parallel,oldrow.settings)
    or private.closure_source_digest_v5() is distinct from oldrow.closure_digest then
    raise exception 'MATCH_CATEGORY_POSTFLIGHT_MISMATCH' using errcode='PT409';
 end if;
end $postflight$;
commit;
