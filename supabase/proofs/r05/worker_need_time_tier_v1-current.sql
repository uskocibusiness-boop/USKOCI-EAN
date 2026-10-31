
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
