-- USKOČI: isolated SQL candidate; NEVER applied to live DEV/PROD.
-- End-only FLEXIBLE/REMOTE_ANYTIME/WEEK_FLEXIBLE requires actual availability.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure)
 IS DISTINCT FROM '753027749309ccc110f486cbfb4866e4'
 THEN RAISE EXCEPTION 'TIME_TIER_SOURCE_DRIFT' USING errcode='PT409'; END IF;
END $pre$;
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
     and (n.starts_at is not null or n.ends_at is null)
     and not private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,at_now) then
    return 1;
  end if;
  select timezone into tz from public.worker_match_preferences where worker_profile_id=pid;
  tz:=coalesce(tz,'Europe/Belgrade');
  if not private.availability_timezone_valid(tz) then return null; end if;
  -- START-ONLY FIXED_WINDOW: test availability at the declared start instant.
  -- A one-second probe is ONLY an interval representation for the calendar;
  -- it is not the proposed duration, job finish, or reserved shift.
  if n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is null then
    if not isfinite(n.starts_at) or n.starts_at<=at_now then return null; end if;
    periods:=private.worker_available_periods(pid,n.starts_at,n.starts_at+interval '1 second',tz);
    if periods @> n.starts_at then return 2; end if;
    return null;
  end if;
  -- An end-only task is a completion deadline, not unlimited free time.
  -- Actual availability must intersect the remaining time until that deadline.
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
    return null;
  end if;
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
DO $post$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure)
 IS DISTINCT FROM '2540437fea2ba98f9e950b967666f517'
 THEN RAISE EXCEPTION 'TIME_TIER_POSTFLIGHT_DRIFT' USING errcode='PT409'; END IF;
END $post$;
COMMIT;
