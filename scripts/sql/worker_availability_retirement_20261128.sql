-- SOURCE ONLY: do not apply until reviewed with regression suite and rollback.
DO $source_only$ BEGIN RAISE EXCEPTION 'WEEKLY_AVAILABILITY_RETIREMENT_SOURCE_ONLY'; END $source_only$;
BEGIN;
DO $preflight$ BEGIN
 IF md5(pg_get_functiondef('private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure)) <> '718167c1f20da1e2b3e37b88dd8b6379' THEN
  RAISE EXCEPTION 'LIVE_BASE_CHANGED';
 END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION private.worker_need_time_tier_v1(nid uuid, pid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; at_now timestamptz:=statement_timestamp();
  ws timestamptz; we timestamptz; tz text; day0 date;
  blocked tstzmultirange; remaining tstzmultirange;
begin
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  if not exists(select 1 from public.app_profiles p where p.id=pid and p.kind='WORKER' and p.profile_status='ACTIVE') then return null; end if;
  -- Task deadlines and confirmed agreement conflicts remain authoritative.
  -- No weekly preferences, manually entered windows or current-status flags.
  if not private.need_search_time_admitted_v1(nid,at_now) then return null; end if;
  if n.schedule_kind='FIXED_WINDOW' then
    if n.starts_at is null then return null; end if;
    if n.ends_at is null then
      if exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
        and c.state='BLOCKING' and c.starts_at<=n.starts_at and c.ends_at>n.starts_at) then return null; end if;
    elsif private.worker_calendar_conflict(pid,n.starts_at,n.ends_at,null) then return null;
    end if;
    return 2;
  end if;
  ws:=greatest(coalesce(n.starts_at,at_now),at_now);
  we:=n.ends_at;
  if n.schedule_kind in ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    if n.published_at is null or not isfinite(n.published_at) then return null; end if;
    tz:=case when private.availability_timezone_valid(n.task_timezone) then n.task_timezone else 'Europe/Belgrade' end;
    day0:=(n.published_at at time zone tz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=greatest(ws,(day0+1)::timestamp at time zone tz);
    end if;
    we:=coalesce(we,private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone));
    if we is null then return null; end if;
  end if;
  if we is null then
    -- No known interval to exclude; exact proposed agreement is checked later.
    return case when n.starts_at is null then 1 else 2 end;
  end if;
  if not isfinite(ws) or not isfinite(we) or ws>=we then return null; end if;
  select coalesce(range_agg(tstzrange(greatest(c.starts_at,ws),least(c.ends_at,we),'[)')),'{}'::tstzmultirange)
    into blocked from private.worker_calendar_events c
    where c.worker_profile_id=pid and c.state='BLOCKING'
      and c.starts_at<we and c.ends_at>ws and c.starts_at<c.ends_at;
  remaining:=tstzmultirange(tstzrange(ws,we,'[)'))-blocked;
  if remaining='{}'::tstzmultirange then return null; end if;
  return 2;
end;
$function$;

COMMIT;
