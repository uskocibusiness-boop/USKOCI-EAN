-- Exact predecessor source restore after approved candidate, NOT APPLIED.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$
BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure)
   IS DISTINCT FROM '0fd72e91c11eeac2c2501f3a8f753734'
 THEN RAISE EXCEPTION 'NEED_TIME_SOURCE_DRIFT' USING errcode='PT409'; END IF;
END $pre$;
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
    execution_end := private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone);
    return execution_end is not null and isfinite(execution_end) and p_at < execution_end;
  elsif n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME') then
    -- An explicit generic end is honoured above. A start alone is NOT an invented end.
    return true;
  end if;
  -- Unrecognised time semantics cannot license automatic matching.
  return false;
end
$function$;

DO $post$
BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure)
   IS DISTINCT FROM 'b830cd07c2a5db101a3a28096256a75b'
 THEN RAISE EXCEPTION 'NEED_TIME_REVERT_DRIFT' USING errcode='PT409'; END IF;
END $post$;
COMMIT;
