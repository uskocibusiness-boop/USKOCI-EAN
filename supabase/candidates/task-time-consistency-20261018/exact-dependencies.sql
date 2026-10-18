-- Exact captured DEV functions. Matcher input fixture is documented separately.
CREATE OR REPLACE FUNCTION private.availability_timezone_valid(value text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  -- ZONE-PERF (2026-10-07). The zone catalog pg_timezone_names reads every zone file of the server (1,196 zones, about 52 ms in CI and
  -- 70-110 ms on canonical DEV per call, warm or cold) and this helper runs for every worker x task pair of the matcher, for every
  -- relative deadline and for every availability save. The two names below are the product's own zones and are known to be in the
  -- catalog (the candidate refuses to apply otherwise); they need no scan. Every other value is judged by exactly the expression
  -- used before, so what is accepted and what is refused is unchanged.
  select case
    when value is null or length(value)>100 then false
    when value in ('Europe/Belgrade','UTC') then true
    else (value='UTC' or position('/' in value)>0)
      and value not like 'posix/%' and value not like 'right/%'
      and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=value)
  end;
$function$
;

CREATE OR REPLACE FUNCTION private.relative_schedule_end_v5(p_kind text, p_published_at timestamp with time zone, p_timezone text)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_published_at is null or not isfinite(p_published_at) then null
    when p_kind = 'TODAY_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '1 day') at time zone tz
    when p_kind = 'TOMORROW_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '2 days') at time zone tz
    when p_kind = 'WEEK_FLEXIBLE'
      then (date_trunc('week', p_published_at at time zone tz) + interval '1 week') at time zone tz
  end
  from (select case when private.availability_timezone_valid(p_timezone)
    then p_timezone else 'Europe/Belgrade' end as tz) resolved
$function$
;

CREATE OR REPLACE FUNCTION private.need_search_time_admitted_v1(p_need_id uuid, p_at timestamp with time zone DEFAULT statement_timestamp())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs%rowtype;
  execution_end timestamptz;
begin
  if p_need_id is null or p_at is null or not isfinite(p_at) then return false; end if;
  select * into n from public.needs where id=p_need_id;
  if not found then return false; end if;
  if n.response_deadline is not null
     and (not isfinite(n.response_deadline) or n.response_deadline <= p_at) then return false; end if;
  if n.starts_at is not null and not isfinite(n.starts_at) then return false; end if;
  if n.ends_at is not null then
    if not isfinite(n.ends_at) or n.ends_at <= p_at then return false; end if;
    if n.starts_at is not null and n.starts_at >= n.ends_at then return false; end if;
  end if;
  if n.schedule_kind='FIXED_WINDOW' then
    execution_end := coalesce(n.ends_at,n.starts_at);
    return execution_end is not null and isfinite(execution_end) and p_at < execution_end;
  elsif n.schedule_kind in ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    -- A specified completion deadline wins over a derived publication-period end.
    execution_end := coalesce(n.ends_at,private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone));
    return execution_end is not null and isfinite(execution_end) and p_at < execution_end;
  elsif n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME') then
    -- An explicit generic end is honoured above. A start alone is NOT an invented end.
    return true;
  end if;
  -- Unrecognised time semantics cannot license automatic matching.
  return false;
end
$function$
;

CREATE OR REPLACE FUNCTION public.fn_need_covered_slots(p_need_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(sum(s.covered_slots), 0)::integer
    from public.need_selections s
   where s.need_id = p_need_id
     and s.status = 'SELECTED';
$function$
;

CREATE OR REPLACE FUNCTION private.assert_application_price_v5(n needs, p_covered_slots integer, p_price_rsd integer)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- Owner 2026-10-09: the task total is shared in proportion to this application's headcount.
      -- Use original required_slots, never remaining slots; preserve existing accepted terms.
      if p_price_rsd::numeric is distinct from
         round(n.requester_price_rsd::numeric * p_covered_slots / n.required_slots) then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,required=%s,covered=%s,sent=%s',
            n.requester_price_rsd,n.required_slots,p_covered_slots,p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;

end;
$function$
;

CREATE OR REPLACE FUNCTION private.accounts_same_world(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);
$function$
;

CREATE OR REPLACE FUNCTION private.lower_arr(a text[])
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(array(select lower(btrim(x)) from unnest(coalesce(a,'{}'::text[])) x where x is not null), '{}'::text[]);
$function$
;

CREATE OR REPLACE FUNCTION private.work_kinds_v5(p_values text[])
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE PARALLEL SAFE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  closed constant text[] := array['SELIDBE_PREVOZ', 'FIZICKI_POSLOVI', 'MONTAZA_NAMESTAJA', 'SITNE_POPRAVKE', 'MOLERSKI_RADOVI', 'ELEKTRO', 'VODOINSTALATER', 'CISCENJE', 'PRANJE_PEGLANJE', 'BASTA_DVORISTE', 'DOSTAVA'];
  fold_from constant text :=
    chr(269)||chr(263)||chr(353)||chr(273)||chr(382)||chr(268)||chr(262)||chr(352)||
    chr(272)||chr(381)||chr(1040)||chr(1072)||chr(1041)||chr(1073)||chr(1042)||chr(1074)||
    chr(1043)||chr(1075)||chr(1044)||chr(1076)||chr(1026)||chr(1106)||chr(1045)||chr(1077)||
    chr(1046)||chr(1078)||chr(1047)||chr(1079)||chr(1048)||chr(1080)||chr(1032)||chr(1112)||
    chr(1050)||chr(1082)||chr(1051)||chr(1083)||chr(1052)||chr(1084)||chr(1053)||chr(1085)||
    chr(1054)||chr(1086)||chr(1055)||chr(1087)||chr(1056)||chr(1088)||chr(1057)||chr(1089)||
    chr(1058)||chr(1090)||chr(1035)||chr(1115)||chr(1059)||chr(1091)||chr(1060)||chr(1092)||
    chr(1061)||chr(1093)||chr(1062)||chr(1094)||chr(1063)||chr(1095)||chr(1064)||chr(1096);
  fold_to constant text := 'ccsdzccsdzaabbvvggddddeezzzziijjkkllmmnnoopprrssttccuuffhhccccss';
  folded text[];
begin
  -- EX-06 ex06b (S06). The hidden kinds of work (PKG-031b): a closed set of ELEVEN kinds recognised by word stems. The NAMES of the kinds are fixed HERE (a twelfth kind is an owner decision and
  -- needs a new body, never a data row); the STEMS are data: private.marketplace_config rows work_kind:<KIND> (a JSON array of literal lower-case substrings, at least 4 letters) and the
  -- classification version in the row work_kinds_head. Each value is folded first: lower case, Serbian Latin diacritics and the Serbian Cyrillic alphabet to plain Latin letters (the three
  -- Cyrillic digraph letters first), so one Latin stem serves every spelling. A kind is named when a stem occurs inside ONE value (never across two values). Text that names no kind returns
  -- nothing, so an unknown word never matches another unknown word. A registry that is not exactly the head row and the eleven kind rows is refused loudly, never half used; an extra
  -- row work_kind:<anything else> is ignored, so no data row can ever add a kind.
  if p_values is null or cardinality(p_values) = 0 then return '{}'::text[]; end if;
  if not exists(select 1 from private.marketplace_config c
                 where c.key = 'work_kinds_head' and c.value ->> 'schema' = 'WORK_KINDS_HEAD_V1'
                   and c.value -> 'kinds' = to_jsonb(closed) and c.value ->> 'foldVersion' = 'SR_LATIN_CYRILLIC_V1')
     or (select count(*) from private.marketplace_config c
          where starts_with(c.key, 'work_kind:') and substr(c.key, 11) = any(closed)
            and c.value ->> 'schema' = 'WORK_KIND_V1' and c.value ->> 'kind' = substr(c.key, 11)
            and jsonb_typeof(c.value -> 'stems') = 'array') <> cardinality(closed) then
    raise exception 'WORK_KINDS_REGISTRY_INVALID' using errcode = '55000';
  end if;
  select coalesce(array_agg(lower(translate(replace(replace(replace(replace(replace(replace(btrim(v), chr(1033), 'lj'), chr(1113), 'lj'), chr(1034), 'nj'), chr(1114), 'nj'), chr(1039), 'dz'), chr(1119), 'dz'), fold_from, fold_to))), '{}'::text[]) into folded
    from unnest(p_values) v where v is not null;
  return coalesce((
    select array_agg(distinct r.kind order by r.kind)
      from (select substr(c.key, 11) as kind, c.value -> 'stems' as stems
              from private.marketplace_config c
             where starts_with(c.key, 'work_kind:') and substr(c.key, 11) = any(closed)) r
     cross join lateral jsonb_array_elements_text(r.stems) s(stem)
     where length(s.stem) >= 4 and exists(select 1 from unnest(folded) t where strpos(t, s.stem) > 0)
  ), '{}'::text[]);
end;
$function$
;

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
$function$
;

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
$function$
;

