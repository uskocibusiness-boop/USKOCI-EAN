-- Forward migration: Explicit public grants for Oct 30 2026 Supabase policy,
-- work areas matching (evaluate_worker_coverage_v1/worker_area_fit_v1),
-- and worker availability fallback for empty calendar rules.

-- 1. Explicit public table grants (Supabase Oct 30, 2026 policy compliance)
GRANT SELECT ON TABLE public.needs TO authenticated;
GRANT SELECT ON TABLE public.account_legal_acceptance_events TO authenticated;
GRANT SELECT ON TABLE public.data_export_requests TO authenticated;
GRANT SELECT ON TABLE public.notification_push_attempts TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 2. Worker Work Areas Helper Functions
CREATE OR REPLACE FUNCTION private.worker_saved_areas_v1(aid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $f$
 select coalesce((select r.envelope#>'{profile,workAreas}' from private.worker_ai_saves s
 join private.worker_ai_reviews r on r.id=s.review_id and r.account_id=s.account_id
 where s.account_id=aid order by s.created_at desc,s.review_id desc limit 1),'[]'::jsonb);
$f$;
REVOKE ALL ON FUNCTION private.worker_saved_areas_v1(uuid) FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.worker_saved_remote_only_v1(aid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $f$
 select coalesce((select r.envelope->>'classificationState'='READY'
 and jsonb_array_length(r.envelope->'reviewedServiceModes')>0
 and not exists(select 1 from jsonb_array_elements(r.envelope->'reviewedServiceModes') m where m->>'mode'<>'REMOTE')
 from private.worker_ai_saves s join private.worker_ai_reviews r on r.id=s.review_id and r.account_id=s.account_id
 where s.account_id=aid order by s.created_at desc,s.review_id desc limit 1),false);
$f$;
REVOKE ALL ON FUNCTION private.worker_saved_remote_only_v1(uuid) FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.validate_worker_areas_v1(areas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $f$
declare a jsonb; seen text[]:='{}'; key text;
begin
 if jsonb_typeof(areas) is distinct from 'array' or jsonb_array_length(areas)>5 then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if jsonb_typeof(a)<>'object' or a-array['kind','countryCode','label','city','sourceRef','latitude','longitude','radiusKm']<>'{}'
   or not a?&array['kind','countryCode','label','city','sourceRef','latitude','longitude','radiusKm']
   or jsonb_typeof(a->'kind')<>'string' or a->>'kind' not in ('COUNTRY','CITY','RADIUS') or a->>'countryCode' is distinct from 'RS'
   or jsonb_typeof(a->'label')<>'string' or length(a->>'label') not between 2 and 200 or a->>'label'~'[[:cntrl:]]'
  then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
  if a->>'kind'='COUNTRY' then
   if jsonb_array_length(areas)<>1 or a->>'label'<>'Cela Srbija'
    or a->'city'<>'null' or a->'sourceRef'<>'null' or a->'latitude'<>'null' or a->'longitude'<>'null' or a->'radiusKm'<>'null'
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   key:='RS';
  else
   if jsonb_typeof(a->'city')<>'string' or length(a->>'city') not between 2 and 160 or a->>'city'~'[[:cntrl:]]'
    or jsonb_typeof(a->'sourceRef')<>'string' or a->>'sourceRef'!~'^osm:(node|way|relation):[1-9][0-9]{0,19}$'
    or jsonb_typeof(a->'latitude')<>'number' or jsonb_typeof(a->'longitude')<>'number'
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   if (a->>'latitude')::numeric not between -90 and 90 or (a->>'longitude')::numeric not between -180 and 180
    or round((a->>'latitude')::numeric,2)<>(a->>'latitude')::numeric or round((a->>'longitude')::numeric,2)<>(a->>'longitude')::numeric
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   if a->>'kind'='CITY' then
    if a->'radiusKm'<>'null' or a->>'label'<>a->>'city' then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   else
    if jsonb_typeof(a->'radiusKm')<>'number' or a->>'radiusKm'!~'^([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$'
      or a->>'label'<>((a->>'city')||' · do '||(a->>'radiusKm')||' km') then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   end if;
   key:=a->>'sourceRef';
  end if;
  if key=any(seen) then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
  seen:=array_append(seen,key);
 end loop;
 return areas;
end $f$;
REVOKE ALL ON FUNCTION private.validate_worker_areas_v1(jsonb) FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.worker_area_city_key_v1(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $f$
 select regexp_replace(translate(replace(replace(replace(lower(btrim(coalesce(value,''))),'љ','lj'),'њ','nj'),'џ','dz'),
 'абвгдђежзијклмнопрстћуфхцчшčćšžđ','abvgddezzijklmnoprstcufhccsccszd'),'\s+',' ','g');
$f$;
REVOKE ALL ON FUNCTION private.worker_area_city_key_v1(text) FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.worker_area_fit_v1(areas jsonb, mode text, country text, city text, lat numeric, lng numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $f$
declare a jsonb;
begin
 if jsonb_array_length(areas)=0 or mode='REMOTE' then return null; end if;
 if mode is distinct from 'STATIONARY' or country is distinct from 'RS' then return false; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='COUNTRY' then return true; end if;
  if a->>'kind'='CITY' and private.worker_area_city_key_v1(city)<>''
   and private.worker_area_city_key_v1(city)=private.worker_area_city_key_v1(a->>'city') then return true; end if;
  if a->>'kind'='RADIUS' and lat is not null and lng is not null
   and private.haversine_km(lat,lng,(a->>'latitude')::numeric,(a->>'longitude')::numeric)<=(a->>'radiusKm')::numeric then return true; end if;
 end loop;
 return false;
end $f$;
REVOKE ALL ON FUNCTION private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric) FROM public,anon,authenticated,service_role;

-- 3. Return work_areas in worker profile edit RPC
CREATE OR REPLACE FUNCTION public.rpc_get_worker_profile_for_edit()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER';
  if not found then return null; end if;
  if p.profile_status not in ('DRAFT','ACTIVE','SUSPENDED') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'account_id',p.account_id,'kind',p.kind,
    'display_name',p.display_name,'city',p.city,'bio',p.bio,'skills',p.skills,'tools',p.tools,
    'vehicles',p.vehicles,'licenses',p.licenses,'profile_status',p.profile_status,'available_now',p.available_now,
    'radius_km',p.radius_km,'team_capacity',p.team_capacity,
    'capacity_revision',private.worker_capacity_document(p.id)->>'revision',
    'work_areas',private.worker_saved_areas_v1(p.account_id));
end;
$function$;

-- 4. Update private.worker_need_fit_v1 with workAreas support
CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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

  IF EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl
      WHERE ctl.singleton AND ctl.enabled) THEN
    IF NOT private.taxonomy_scope_eligible_v1(n.id,p.account_id) THEN
      RETURN jsonb_build_object('matches',false,'service',false,'area',false,
        'timeTier',null,'distanceKm',null,'effectiveRadiusKm',null,
        'hard',jsonb_build_array('SIGNED_SERVICE_SCOPE_REQUIRED'),
        'taxonomyScope','UNCONFIRMED');
    END IF;
  END IF;

  -- 1. Area filter (radijus / mesto / workAreas)
  radius:=private.effective_radius_km(p.radius_km);
  if n.execution_location_mode='REMOTE' then
    dist:=null; area:=private.taxonomy_handoff_fit_v1(n.id,p.account_id);
  elsif jsonb_array_length(private.worker_saved_areas_v1(p.account_id))>0 then
    radius:=null; dist:=null;
    area:=private.worker_area_fit_v1(private.worker_saved_areas_v1(p.account_id),n.execution_location_mode,n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng);
  else
    select * into pref from public.worker_match_preferences where worker_profile_id=pid;
    dist:=private.haversine_km(n.approximate_lat,n.approximate_lng,pref.approximate_lat,pref.approximate_lng);
    area:=coalesce(case when dist is not null then dist<=radius
      else n.task_country_code is not null
        and n.task_country_code=p.operating_country_code
        and btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);
  end if;
  if p_first_refusal and not area then return jsonb_build_object('matches',false,'area',false); end if;

  -- 2. Service competency matching
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

  if not svc and n.category_id is null then
    effective_skills := array_remove(array[n.category]::text[],null);
    svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  end if;

  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  if not svc and n.category_id is null then
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;

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

-- 5. Update private.worker_need_time_tier_v1 with empty-calendar fallback
CREATE OR REPLACE FUNCTION private.worker_need_time_tier_v1(nid uuid, pid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; tz text; wtz text; at_now timestamptz:=statement_timestamp();
  periods tstzmultirange; ws timestamptz; we timestamptz; anchor_day date; live boolean;
  has_rules boolean;
begin
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  if not found then return null; end if;
  if n.ends_at is not null and n.ends_at<=at_now then return null; end if;

  if n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME')
     and n.starts_at is null and n.ends_at is null then
    return 1;
  end if;
  select timezone into tz from public.worker_match_preferences where worker_profile_id=pid;
  tz:=coalesce(tz,'Europe/Belgrade');
  if not private.availability_timezone_valid(tz) then return null; end if;

  has_rules := exists(select 1 from public.profile_availability_rules r where r.profile_id=pid and r.active);

  if n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME') and n.starts_at is not null then
    if not isfinite(n.starts_at) or
       (n.ends_at is not null and (not isfinite(n.ends_at) or n.ends_at<=n.starts_at)) then
      return null;
    end if;
    if n.starts_at<=at_now then
      live:=coalesce(p.available_now,false)
        and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
          and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
        and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
          and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
      if live then return 1; end if;
    end if;
    ws:=greatest(n.starts_at,at_now);
    we:=coalesce(n.ends_at,ws+interval '30 days');
    if we<=ws then return null; end if;
    if private.worker_available_periods(pid,ws,we,tz)<>'{}'::tstzmultirange then return 2; end if;
    if not has_rules and coalesce(p.available_now,false)
       and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
         and w.availability_state='UNAVAILABLE' and w.starts_at<we and w.ends_at>ws)
       and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
         and c.state='BLOCKING' and c.starts_at<we and c.ends_at>ws)
    then
      return 2;
    end if;
    return null;
  end if;

  if n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is null then
    if not isfinite(n.starts_at) or n.starts_at<=at_now then return null; end if;
    periods:=private.worker_available_periods(pid,n.starts_at,n.starts_at+interval '1 second',tz);
    if periods @> n.starts_at then return 2; end if;
    return null;
  end if;

  if n.starts_at is null and n.ends_at is not null
     and n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME','WEEK_FLEXIBLE') then
    if not isfinite(n.ends_at) or n.ends_at<=at_now then return null; end if;
    live:=coalesce(p.available_now,false)
      and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
        and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
      and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
        and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
    if live then return 1; end if;
    if private.worker_available_periods(pid,at_now,n.ends_at,tz)<>'{}'::tstzmultirange then return 2; end if;
    if not has_rules and coalesce(p.available_now,false)
       and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
         and w.availability_state='UNAVAILABLE' and w.starts_at<n.ends_at and w.ends_at>at_now)
       and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
         and c.state='BLOCKING' and c.starts_at<n.ends_at and c.ends_at>at_now)
    then
      return 2;
    end if;
    return null;
  end if;

  if n.schedule_kind='TOMORROW_FLEXIBLE'
     and n.starts_at is null and n.ends_at is not null then
    if n.published_at is null or not isfinite(n.published_at)
       or not isfinite(n.ends_at) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    ws:=(anchor_day+1)::timestamp at time zone wtz;
    we:=(anchor_day+2)::timestamp at time zone wtz;
    if n.ends_at<=ws or n.ends_at>we or n.ends_at<=at_now then return null; end if;
    if private.worker_available_periods(pid,greatest(ws,at_now),n.ends_at,tz)<>'{}'::tstzmultirange then
      return 2;
    end if;
    if not has_rules and coalesce(p.available_now,false)
       and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
         and w.availability_state='UNAVAILABLE' and w.starts_at<n.ends_at and w.ends_at>greatest(ws,at_now))
       and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
         and c.state='BLOCKING' and c.starts_at<n.ends_at and c.ends_at>greatest(ws,at_now))
    then
      return 2;
    end if;
    return null;
  end if;

  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')
     and n.starts_at is not null and n.ends_at is null then
    if n.published_at is null or not isfinite(n.published_at)
       or not isfinite(n.starts_at) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=(anchor_day+1)::timestamp at time zone wtz;
      we:=(anchor_day+2)::timestamp at time zone wtz;
    else
      ws:=anchor_day::timestamp at time zone wtz;
      we:=(anchor_day+(8-extract(isodow from anchor_day)::integer))::timestamp at time zone wtz;
    end if;
    if n.starts_at<ws or n.starts_at>=we or we<=at_now then return null; end if;
    if private.worker_available_periods(pid,greatest(n.starts_at,at_now),we,tz)<>'{}'::tstzmultirange then
      return 2;
    end if;
    if not has_rules and coalesce(p.available_now,false)
       and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
         and w.availability_state='UNAVAILABLE' and w.starts_at<we and w.ends_at>greatest(n.starts_at,at_now))
       and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
         and c.state='BLOCKING' and c.starts_at<we and c.ends_at>greatest(n.starts_at,at_now))
    then
      return 2;
    end if;
    return null;
  end if;

  ws:=n.starts_at; we:=n.ends_at;
  if n.starts_at is null and n.ends_at is null and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    if n.published_at is null then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=(anchor_day+1)::timestamp at time zone wtz; we:=(anchor_day+2)::timestamp at time zone wtz;
    else
      ws:=anchor_day::timestamp at time zone wtz; we:=(anchor_day+(8-extract(isodow from anchor_day)::integer))::timestamp at time zone wtz;
    end if;
  end if;
  if private.availability_is_future(n.schedule_kind,ws,we,at_now) then
    periods:=private.worker_available_periods(pid,greatest(ws,at_now),we,tz);
    if n.schedule_kind='FIXED_WINDOW' then
      if periods @> tstzrange(ws,we,'[)') then return 2; end if;
      return null;
    end if;
    if periods<>'{}'::tstzmultirange then return 2; end if;
    if not has_rules and coalesce(p.available_now,false)
       and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
         and w.availability_state='UNAVAILABLE' and w.starts_at<we and w.ends_at>greatest(ws,at_now))
       and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
         and c.state='BLOCKING' and c.starts_at<we and c.ends_at>greatest(ws,at_now))
    then
      return 2;
    end if;
    return null;
  end if;
  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then return null; end if;

  live:=coalesce(p.available_now,false)
    and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
      and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
    and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
      and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
  if live then
    if n.schedule_kind='FIXED_WINDOW' and not private.schedule_fit(pid,n.starts_at,n.ends_at,tz) then return null; end if;
    return 1;
  end if;
  if n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is not null and n.starts_at<=at_now
     and private.worker_available_periods(pid,at_now,n.ends_at,tz) @> tstzrange(at_now,n.ends_at,'[)') then
    return 2;
  end if;
  return null;
end;
$function$;
