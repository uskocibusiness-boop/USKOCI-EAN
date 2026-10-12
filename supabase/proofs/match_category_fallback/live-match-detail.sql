-- Byte-exact read-only canonical DEV match-detail SQL, 2026-10-11.
-- Execute in disposable PostgreSQL 16 ONLY after synthetic score columns.
-- This replaces ONLY the local fake match_detail wrapper in Stage 10.
CREATE OR REPLACE FUNCTION private.match_detail_without_calendar(nid uuid, pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[] := '{}'; disp text[] := '{}'; reasons text[] := '{}';
  tz text; local_day date; fit jsonb; tier integer;
  svc boolean;
  sched boolean; dist numeric; radiusok boolean;
  effective_radius numeric; exposure integer;
  cap numeric := 0; ss numeric := 0; ds numeric := 0; rs numeric := 0;
  rels numeric := 0; fair numeric := 0;
begin
  select * into n from public.needs where id = nid;
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id = pid and kind = 'WORKER';
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  select * into pref from public.worker_match_preferences where worker_profile_id = pid;

  tz := coalesce(nullif(pref.timezone,''), 'Europe/Belgrade');
  local_day := case when n.starts_at is not null then (n.starts_at at time zone tz)::date end;

  -- MATCH-V1 (owner 2026-10-07): "Odgovara mi" = kind of work + area + time, read from the ONE shared rule
  -- private.worker_need_fit_v1 (the dispatch prefilter and "Za mene" use the same rule). Tools, vehicles,
  -- experience and the minimum fee are information for the requester: never a gate and never a score.
  fit := private.worker_need_fit_v1(nid,pid,false);
  svc := (fit->>'service')::boolean;
  tier := (fit->>'timeTier')::integer;
  sched := tier is not null;
  effective_radius := (fit->>'effectiveRadiusKm')::numeric;
  dist := (fit->>'distanceKm')::numeric;
  radiusok := (fit->>'area')::boolean;

  -- TVRDE kapije: blokiraju i rucni odgovor, ne samo automatski dispatch.
  if p.profile_status <> 'ACTIVE' then hard := array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id = p.account_id then hard := array_append(hard,'OWN_NEED'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard := array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  -- MATCH-V1: missing tools, vehicles or experience no longer refuse an application.
  if coalesce(cardinality(p.exclusions),0) > 0 and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
     -- PKG-031b (deep read 9.2/9.3): an exclusion holds for the same kind of work in any spelling
     -- ("selidbe" also keeps out "transport_selidbe").
     or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills)))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;

  -- MEKE kapije: blokiraju samo automatsku isporuku. Rucno pretrazivanje ostaje otvoreno.
  -- MATCH-V1: the time rule, "Mogu odmah" included, lives only in private.worker_need_time_tier_v1
  -- (OUTSIDE_AVAILABILITY below); live intent is no longer a separate gate.
  if not coalesce(pref.proactive_notifications,true) then disp := array_append(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'); end if;
  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;
  if not svc then disp := array_append(disp,'SERVICE_NOT_IN_WORK_PROFILE'); end if;
  if not sched then disp := array_append(disp,'OUTSIDE_AVAILABILITY'); end if;
  if not radiusok then disp := array_append(disp,'OUTSIDE_PREFERRED_RADIUS'); end if;

  -- Bodovanje: donorove tezine 30/25/15/10/5. MATCH-V1 drops the 15 resource points (RESOURCES_MATCH);
  -- 'resources' stays 0 in scoreComponents for wire compatibility.
  if svc then reasons := array_append(reasons,'SERVICE_MATCH'); cap := 30; end if;
  if sched then reasons := array_append(reasons,'SCHEDULE_MATCH'); ss := 25; end if;
  if radiusok then
    reasons := array_append(reasons, case when n.execution_location_mode='REMOTE'
                 then 'REMOTE_LOCATION_NOT_REQUIRED' else 'START_PROXIMITY_MATCH' end);
    ds := case
      when n.execution_location_mode='REMOTE' then 15
      when dist is null or effective_radius is null or effective_radius <= 0 then 10
      else round(15 * (1 - 0.55 * least(1, greatest(0, dist/effective_radius))), 1)
    end;
  end if;

  rels := round(greatest(0, least(100, coalesce(p.rating_worker*20, 50)))/10, 1);
  select count(*) into exposure from public.opportunity_deliveries d
   where d.worker_account_id = p.account_id
     and d.created_at > statement_timestamp() - interval '7 days';
  fair := case when p.rating_worker is null then 5 else greatest(0, 5 - least(5, exposure)) end;
  if p.rating_worker is null then reasons := array_append(reasons,'NEWCOMER_FAIRNESS'); end if;

  return jsonb_build_object(
    'workerAccountId', p.account_id,
    'workerProfileId', p.id,
    'responseAllowed', cardinality(hard) = 0,
    'dispatchEligible', cardinality(hard) = 0 and cardinality(disp) = 0,
    'hardBlockers', to_jsonb(hard),
    'dispatchBlockers', to_jsonb(disp),
    'reasonCodes', to_jsonb(reasons),
    'distanceToStartKm', dist,
    'effectiveRadiusKm', effective_radius,
    'taskLocationMode', n.execution_location_mode,
    'distanceSource', case when dist is null then null else 'GEODESIC' end,
    'routingProvider', null,
    'liveStateDate', local_day,
    'timeTier', tier,
    'score', round(least(100, cap+ss+ds+rs+rels+fair), 1),
    'scoreComponents', jsonb_build_object(
      'capability', cap, 'schedule', ss, 'distanceToStart', ds,
      'resources', rs, 'reliability', rels, 'fairness', fair)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.match_detail_for_calendar_interval(nid uuid, pid uuid, s timestamp with time zone, e timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb; blockers jsonb;
begin
  if (s is null)<>(e is null) or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e)) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  result:=private.match_detail_without_calendar(nid,pid);
  if result is null or not private.worker_calendar_conflict(pid,s,e,null) then return result; end if;
  blockers:=coalesce(result->'hardBlockers','[]'::jsonb);
  if not (blockers @> '["CALENDAR_CONFLICT"]'::jsonb) then blockers:=blockers||'["CALENDAR_CONFLICT"]'::jsonb; end if;
  result:=jsonb_set(result,'{hardBlockers}',blockers,true);
  result:=jsonb_set(result,'{responseAllowed}','false'::jsonb,true);
  return jsonb_set(result,'{dispatchEligible}','false'::jsonb,true);
end;
$function$;

CREATE OR REPLACE FUNCTION private.match_detail(nid uuid, pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s timestamptz; e timestamptz;
begin
  -- A pair of timestamps alone is not evidence of a fixed appointment:
  -- FLEXIBLE/TODAY_FLEXIBLE/TOMORROW_FLEXIBLE/WEEK_FLEXIBLE can have both.
  select n.starts_at,n.ends_at into s,e from public.needs n
    where n.id=nid and n.schedule_kind='FIXED_WINDOW';
  if s is null or e is null then s:=null; e:=null; end if;
  return private.match_detail_for_calendar_interval(nid,pid,s,e);
end;
$function$;
