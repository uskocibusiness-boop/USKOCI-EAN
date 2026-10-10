-- LIVE DEV code captured READ ONLY 2026-10-11. Run ONLY in disposable PostgreSQL.
-- PostGIS spatial types/operators replaced by EXPLICIT SYNTHETIC stand-ins;
-- no physical geo-index or full PostGIS accuracy can be claimed here.
CREATE OR REPLACE FUNCTION private.worker_notify_room_v1b(uid uuid, p_cap integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- MATCH-V1B (owner 2026-10-07): may this worker still get a PROACTIVE new-task notification today?
  -- It counts the worker's own OPPORTUNITY_AVAILABLE events of normal urgency created in the last 24 hours: the event the
  -- dispatch wave emits for every notified worker (private.dispatch_next_wave -> private.emit_event). Urgent (HITNO) events and
  -- every other event type (responses, agreements, messages, reviews ...) are NOT counted. A null cap means "no cap".
  -- Index-friendly: one range on an existing recipient index (activity_recipient_idx: recipient_user_id, recipient_role, created_at; the
  -- inbox index activity_inbox_page_idx serves the same range), and the count stops at the cap, so at most p_cap matching rows are read
  -- however long the worker's history is.
  select p_cap is null or (
    select count(*) from (
      select 1
        from public.user_activity_events e
       where e.recipient_user_id = uid
         and e.recipient_role = 'WORKER'
         and e.created_at > statement_timestamp() - interval '24 hours'
         and e.event_type = 'OPPORTUNITY_AVAILABLE'
         and e.urgency = 'NORMAL'
       limit p_cap
    ) counted
  ) < p_cap;
$function$;

CREATE OR REPLACE FUNCTION private.candidate_profile_ids(nid uuid, p_limit integer)
 RETURNS TABLE(worker_profile_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; admitted integer := 0; c record; task_geog extensions.geography;
begin
  select * into n from public.needs where id = nid;
  if not found or p_limit is null or p_limit < 1 then return; end if;

  if n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')
     and n.approx_geog is not null then
    task_geog := n.approx_geog;

    for c in
      select pref.worker_profile_id as pid
      from public.worker_match_preferences pref
      where pref.approximate_geog is not null
        and extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
      order by pref.approximate_geog OPERATOR(extensions.<->) task_geog, pref.worker_profile_id
    loop
      if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
        worker_profile_id := c.pid; return next;
        admitted := admitted + 1;
        exit when admitted >= p_limit;
      end if;
    end loop;

    if admitted < p_limit then
      for c in
        select p.id as pid
        from public.app_profiles p
        left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
        where p.kind = 'WORKER' and p.profile_status = 'ACTIVE' -- MATCH-V1: a draft or suspended profile is never admitted, never visit it
          and (pref.worker_profile_id is null or pref.approximate_geog is null)
        order by p.id
      loop
        if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
          worker_profile_id := c.pid; return next;
          admitted := admitted + 1;
          exit when admitted >= p_limit;
        end if;
      end loop;
    end if;
    return;
  end if;

  -- Nefizicka Potreba ili bez koordinata: rotacija zasejana ID-jem Potrebe,
  -- da isti radnici ne budu uvek prvi.
  for c in
    select p.id as pid from public.app_profiles p
    where p.kind = 'WORKER' and p.profile_status = 'ACTIVE' -- MATCH-V1: a draft or suspended profile is never admitted, never visit it
    order by case when p.id >= n.id then 0 else 1 end, p.id
  loop
    if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
      worker_profile_id := c.pid; return next;
      admitted := admitted + 1;
      exit when admitted >= p_limit;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.candidate_profile_ids_v1b(nid uuid, p_limit integer, p_cap integer)
 RETURNS TABLE(worker_profile_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; admitted integer := 0; c record; task_geog extensions.geography;
begin
  -- MATCH-V1B (owner 2026-10-07): the candidates of private.candidate_profile_ids, minus the workers who already got p_cap
  -- proactive new-task notifications in the last 24 hours. Such a worker is skipped here and does NOT use up a place of p_limit
  -- (the ceiling), so the next worker takes it; he still sees the task on the map, the list and in "Za mene", and a later wave
  -- takes him when his count has room again. A null cap (an urgent task, or the ladder) is exactly the MATCH-V1 function.
  if p_cap is null then
    return query select * from private.candidate_profile_ids(nid, p_limit);
    return;
  end if;
  select * into n from public.needs where id = nid;
  if not found or p_limit is null or p_limit < 1 then return; end if;

  if n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')
     and n.approx_geog is not null then
    task_geog := n.approx_geog;

    for c in
      select pref.worker_profile_id as pid, pref.worker_account_id as uid
      from public.worker_match_preferences pref
      where pref.approximate_geog is not null
        and extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
      order by pref.approximate_geog OPERATOR(extensions.<->) task_geog, pref.worker_profile_id
    loop
      if private.worker_notify_room_v1b(c.uid, p_cap) and private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
        worker_profile_id := c.pid; return next;
        admitted := admitted + 1;
        exit when admitted >= p_limit;
      end if;
    end loop;

    if admitted < p_limit then
      for c in
        select p.id as pid, p.account_id as uid
        from public.app_profiles p
        left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
        where p.kind = 'WORKER' and p.profile_status = 'ACTIVE'
          and (pref.worker_profile_id is null or pref.approximate_geog is null)
        order by p.id
      loop
        if private.worker_notify_room_v1b(c.uid, p_cap) and private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
          worker_profile_id := c.pid; return next;
          admitted := admitted + 1;
          exit when admitted >= p_limit;
        end if;
      end loop;
    end if;
    return;
  end if;

  -- a task without a place: the rotation seeded by the id of the task, so that the same workers are not always first
  for c in
    select p.id as pid, p.account_id as uid from public.app_profiles p
    where p.kind = 'WORKER' and p.profile_status = 'ACTIVE'
    order by case when p.id >= n.id then 0 else 1 end, p.id
  loop
    if private.worker_notify_room_v1b(c.uid, p_cap) and private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
      worker_profile_id := c.pid; return next;
      admitted := admitted + 1;
      exit when admitted >= p_limit;
    end if;
  end loop;
end;
$function$;
