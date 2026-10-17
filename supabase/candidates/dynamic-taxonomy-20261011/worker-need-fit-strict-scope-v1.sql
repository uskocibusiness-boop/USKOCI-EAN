-- SOURCE-ONLY matching candidate built from live DEV worker_need_fit_v1.
-- DO NOT DEPLOY until strict-mode tables, review binder and need snapshots are
-- populated and verified. The private gate defaults OFF and must remain OFF
-- until worker/need/push QA passes. Unknown/snapshot-less tasks stay visible
-- via ordinary discovery; this guard only blocks unsafe personal matching.
BEGIN;
CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1: Dynamic Taxonomy Enhanced Matcher (Guarded against legacy regex pollution)
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[]:='{}'; svc boolean := false; area boolean; dist numeric; radius numeric; tier integer;
  effective_skills text[]; required_skill text;
  v_tax_tier text;
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

  -- 1. Area filter (radijus / mesto)
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

  -- 2. Service competency matching
  -- A. First: Check Dynamic Taxonomy Inheritance if task has category_id
  if n.category_id is not null then
    begin
      v_tax_tier := private.taxonomy_requirement_tier_inherited_v1(n.category_id, p.account_id);
      if v_tax_tier in ('EXACT', 'EQUIVALENT', 'RELATED_CONFIRMED', 'INHERITED_STANDARD') then
        svc := true;
      end if;
    exception when others then
      svc := false;
    end;
  end if;

  -- B. Fallback: Only run legacy skill match if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    effective_skills := array_remove(array[n.category]::text[],null);
    svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  end if;

  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- C. Legacy aliases fallback only if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;

  -- SOURCE-ONLY P2 guard: no canonical work ID alone can grant a worker
  -- a REMOTE/ON_SITE matching scope. Keep feature control disabled until
  -- every saved service mode and need review snapshot is bound and verified.
  if (select enabled from private.taxonomy_match_scope_control_v1 where singleton) is true then
    if not private.taxonomy_scope_eligible_v1(n.id,p.account_id) then
      svc:=false;
      hard:=array_append(hard,'TAXONOMY_SCOPE_NOT_CONFIRMED');
    end if;
  end if;

  -- Extra explicitly required skills (if any)
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

  -- 3. Exclusions filter
  if coalesce(cardinality(p.exclusions),0)>0
     and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category,n.required_skills))
          or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category,n.required_skills)))
    then hard:=array_append(hard,'PROFILE_EXCLUSION'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- 4. Time filter
  tier:=private.worker_need_time_tier_v1(nid,pid);
  return jsonb_build_object('matches',cardinality(hard)=0 and svc and area and tier is not null,
    'service',svc,'area',area,'timeTier',tier,'distanceKm',dist,'effectiveRadiusKm',radius,'hard',to_jsonb(hard),
    'taxonomyTier',v_tax_tier);
end;
$function$;
COMMIT;
