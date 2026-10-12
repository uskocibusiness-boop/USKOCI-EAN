-- Exact canonical DEV function definitions, captured read-only 2026-10-11.
-- Synthetic schema ONLY. Replaces a disposable calendar stub at CI Stage 7.
-- No task, user, device or actual time-window records copied from DEV.
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
$function$;

CREATE OR REPLACE FUNCTION private.availability_is_future(kind text, s timestamp with time zone, e timestamp with time zone, at_now timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(isfinite(s) and isfinite(e) and s<e and e>at_now
    and (s>at_now or kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')),false);
$function$;

CREATE OR REPLACE FUNCTION private.worker_calendar_conflict(p_worker_profile_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_agreement_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_worker_profile_id is null or p_starts_at is null or p_ends_at is null then false
    when p_starts_at >= p_ends_at then false
    else exists (
      select 1
      from private.worker_calendar_events e
      where e.worker_profile_id = p_worker_profile_id
        and e.state = 'BLOCKING'
        and (p_exclude_agreement_id is null or e.agreement_id <> p_exclude_agreement_id)
        and e.starts_at < p_ends_at
        and e.ends_at > p_starts_at
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION private.worker_available_periods(pid uuid, s timestamp with time zone, e timestamp with time zone, tz text)
 RETURNS tstzmultirange
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result tstzmultirange; blocked tstzmultirange; first_day date; last_day date;
begin
  if s is null or e is null or not isfinite(s) or not isfinite(e) or s>=e
    or not private.availability_timezone_valid(tz) then return '{}'::tstzmultirange; end if;
  first_day:=(s at time zone tz)::date; last_day:=(e at time zone tz)::date;
  -- Bound work for malformed/exceptionally broad search inputs, never allocate
  -- or deny an Agreement. Manual response/selection retains its own authority.
  if last_day-first_day>366 then return '{}'::tstzmultirange; end if;
  with days as (select first_day+i as d from generate_series(0,last_day-first_day) i),
  periods as (
    select w.starts_at as a,w.ends_at as b from public.profile_availability_windows w
      where w.profile_id=pid and w.availability_state='AVAILABLE' and w.starts_at<e and w.ends_at>s
    union all
    select (d+r.start_time) at time zone tz,(d+r.end_time) at time zone tz
      from days cross join public.profile_availability_rules r
      where r.profile_id=pid and r.active and extract(dow from d)::integer=any(r.weekdays)
        and r.starts_on<=d and (r.ends_on is null or r.ends_on>=d)
  ) select coalesce(range_agg(tstzrange(greatest(a,s),least(b,e),'[)')),'{}'::tstzmultirange)
      into result from periods where a<b and a<e and b>s;
  select coalesce(range_agg(tstzrange(greatest(a,s),least(b,e),'[)')),'{}'::tstzmultirange)
    into blocked from (
      select w.starts_at as a,w.ends_at as b from public.profile_availability_windows w
        where w.profile_id=pid and w.availability_state='UNAVAILABLE' and w.starts_at<e and w.ends_at>s
      union all
      select c.starts_at,c.ends_at from private.worker_calendar_events c
        where c.worker_profile_id=pid and c.state='BLOCKING' and c.starts_at<e and c.ends_at>s
    ) b;
  return result-blocked;
end;
$function$;

CREATE OR REPLACE FUNCTION private.schedule_fit(pid uuid, s timestamp with time zone, e timestamp with time zone, tz text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare live_now boolean; at_now timestamptz:=statement_timestamp();
begin
  if s is null or e is null then return true; end if;
  if not isfinite(s) or not isfinite(e) or s>=e or not private.availability_timezone_valid(tz) then return false; end if;
  if private.worker_calendar_conflict(pid,s,e,null) or exists(
    select 1 from public.profile_availability_windows w where w.profile_id=pid and w.availability_state='UNAVAILABLE'
      and w.starts_at<e and w.ends_at>s) then return false; end if;
  select available_now into live_now from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  -- Live intent means now, not an invented expiry or arbitrary lead-time. Future
  -- exact appointments must fit the stored weekly/windows schedule even when ON.
  if coalesce(live_now,false) and s<=at_now and at_now<e then return true; end if;
  return private.worker_available_periods(pid,s,e,tz) @> tstzrange(s,e,'[)');
end;
$function$;

CREATE OR REPLACE FUNCTION private.worker_need_time_tier_v1(nid uuid, pid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1 (owner 2026-10-07). The time part of "Odgovara mi" and its order inside the existing waves:
--   1 = first: "Mogu odmah" for a task "danas" or one whose own time has begun ("odmah"); everyone for "bilo kad";
--   2 = by the stored schedule (weekly rules and windows, in the worker's zone, Europe/Belgrade by default);
--   null = the time does not fit (no delivery, not "Za mene"). The order is a priority inside the waves, never exclusivity.
-- needs.schedule_kind has no separate ASAP kind: "odmah" is a task "danas" (TODAY_FLEXIBLE) or a stored window that has
-- already begun. TOMORROW_FLEXIBLE, WEEK_FLEXIBLE and every future stored window keep the EX-06 coverage rule unchanged.
declare
  n public.needs; p public.app_profiles; tz text; wtz text; at_now timestamptz:=statement_timestamp();
  periods tstzmultirange; ws timestamptz; we timestamptz; anchor_day date; live boolean;
begin
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  if not found then return null; end if;
  if n.ends_at is not null and n.ends_at<=at_now then return null; end if;
  -- "bilo kad": FLEXIBLE / REMOTE_ANYTIME without a complete future window. The time does not matter: no zone, no
  -- schedule and no calendar is read for it.
  if n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME')
     and not private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,at_now) then
    return 1;
  end if;
  select timezone into tz from public.worker_match_preferences where worker_profile_id=pid;
  tz:=coalesce(tz,'Europe/Belgrade');
  if not private.availability_timezone_valid(tz) then return null; end if;
  -- "danas": the publication day in the task's zone (Europe/Belgrade when it has none), a stored bound narrows it.
  -- First "Mogu odmah", then a schedule with real available time left in that day.
  if n.schedule_kind='TODAY_FLEXIBLE' then
    if n.published_at is null and (n.starts_at is null or n.ends_at is null) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(coalesce(n.published_at,n.starts_at) at time zone wtz)::date;
    ws:=coalesce(n.starts_at,anchor_day::timestamp at time zone wtz);
    we:=coalesce(n.ends_at,(anchor_day+1)::timestamp at time zone wtz);
    if not isfinite(ws) or not isfinite(we) or ws>=we or we<=at_now then return null; end if;
    -- "Mogu odmah" counts only while nothing blocks this moment (an unavailable window or a Dogovor).
    live:=coalesce(p.available_now,false)
      and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
        and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
      and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
        and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
    if live then return 1; end if;
    if private.worker_available_periods(pid,greatest(ws,at_now),we,tz)<>'{}'::tstzmultirange then return 2; end if;
    return null;
  end if;
  -- Every other kind: the EX-06 rule as before (ex06a: a window-less TOMORROW / WEEK task reads the window its words mean).
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
    return null;
  end if;
  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then return null; end if;
  -- "odmah": the task's own time has begun. First "Mogu odmah" (a fixed window must still fit as before),
  -- then a schedule that covers now and the rest of a fixed window.
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
