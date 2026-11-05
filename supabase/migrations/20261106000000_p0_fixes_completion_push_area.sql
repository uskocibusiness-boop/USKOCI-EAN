-- ============================================================================
-- Migration: 20261106000000_p0_fixes_completion_push_area.sql
-- Description: Fix P0 blockers identified by 10-subagent comprehensive audit:
--   1. private.push_suppression defaults to enabled when no preferences row exists
--   2. private.sync_need_completion respects remaining_search_closed_at
--   3. private.worker_area_fit_v1 supports all physical on-site modes
-- ============================================================================

-- 1. Push notification suppression fix (default enabled when preferences missing)
create or replace function private.push_suppression(p_delivery public.notification_deliveries)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare
  p public.notification_preferences%rowtype;
  e public.user_activity_events%rowtype;
  enabled boolean;
  local_time time;
begin
  if p_delivery.channel<>'PUSH' or p_delivery.state in ('SUPPRESSED','EXPIRED','READ','DELIVERED','FAILED_FINAL') then
    return 'DELIVERY_CLOSED';
  end if;
  if p_delivery.expires_at<=clock_timestamp() then
    return 'EXPIRED';
  end if;
  select * into e from public.user_activity_events where id=p_delivery.event_id;
  if not found or e.recipient_user_id<>p_delivery.recipient_user_id or e.recipient_role<>p_delivery.recipient_role then
    return 'EVENT_UNAVAILABLE';
  end if;

  select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
  if not found then
    -- When preferences row does not exist yet, default all categories and push to ON
    return null;
  end if;

  if not coalesce(p.push_enabled, true) then
    return 'PUSH_OFF';
  end if;

  enabled:=case private.category_of_event(e.event_type)
    when 'opportunities' then coalesce(p.opportunities_enabled, true)
    when 'responses' then coalesce(p.responses_enabled, true)
    when 'dogovor' then coalesce(p.dogovor_enabled, true)
    when 'execution' then coalesce(p.execution_enabled, true)
    when 'recovery' then coalesce(p.recovery_enabled, true)
    else coalesce(p.account_enabled, true)
  end;
  if not enabled then
    return 'CATEGORY_OFF';
  end if;

  local_time:=(clock_timestamp() at time zone coalesce(p.quiet_timezone, 'UTC'))::time;
  if coalesce(p.quiet_hours_enabled, false)
     and (case when p.quiet_start<p.quiet_end then local_time between p.quiet_start and p.quiet_end else local_time>=p.quiet_start or local_time<=p.quiet_end end)
     and not(e.urgency='HITNO' and coalesce(p.urgent_overrides_quiet_hours, true)) then
    return 'QUIET_HOURS';
  end if;

  return null;
end $fn$;

revoke all on function private.push_suppression(public.notification_deliveries) from public, anon, authenticated;
comment on function private.push_suppression(public.notification_deliveries) is
  'Authoritative push delivery suppression arbiter with safe true-default fallback for accounts without custom preference records.';


-- 2. Parent Need completion aggregator fix for closed remaining search
create or replace function private.sync_need_completion(p_need_id uuid)
returns boolean language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs;
  v_completed_slots integer := 0;
  v_active_selected_slots integer := 0;
  v_effective_required integer := 0;
begin
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    return false;
  end if;

  if n.status = 'COMPLETED' then
    return true;
  end if;

  if n.status not in ('ACTIVE','SELECTION') then
    return false;
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_completed_slots
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
   where s.need_id = p_need_id
     and s.status = 'SELECTED'
     and a.status = 'COMPLETED';

  -- When remaining search was explicitly closed, evaluate against active selected slots
  if n.remaining_search_closed_at is not null then
    select coalesce(sum(s.covered_slots), 0)::integer
      into v_active_selected_slots
      from public.need_selections s
     where s.need_id = p_need_id
       and s.status = 'SELECTED';
    v_effective_required := v_active_selected_slots;
  else
    v_effective_required := n.required_slots;
  end if;

  if v_effective_required < 1 or v_completed_slots < v_effective_required then
    return false;
  end if;

  perform set_config('uskoci.need_lifecycle', 'COMPLETE', true);

  update public.needs
     set status = 'COMPLETED',
         updated_at = statement_timestamp()
   where id = p_need_id
     and status in ('ACTIVE','SELECTION');

  return found;
end;
$$;

revoke all on function private.sync_need_completion(uuid) from public, anon, authenticated;
comment on function private.sync_need_completion(uuid) is
  'Authoritative parent Need completion aggregator. Supports dynamic closure when remaining_search_closed_at is stamped.';


-- 3. Worker work area match fix for all physical on-site modes
create or replace function private.worker_area_fit_v1(areas jsonb, mode text, country text, city text, lat numeric, lng numeric)
 returns boolean
 language plpgsql
 stable
 set search_path to 'pg_catalog'
as $f$
declare a jsonb;
begin
 if jsonb_array_length(areas)=0 or mode='REMOTE' then return null; end if;
 if mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') or country is distinct from 'RS' then return false; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='COUNTRY' then return true; end if;
  if a->>'kind'='CITY' and private.worker_area_city_key_v1(city)<>''
   and private.worker_area_city_key_v1(city)=private.worker_area_city_key_v1(a->>'city') then return true; end if;
  if a->>'kind'='RADIUS' and lat is not null and lng is not null
   and private.haversine_km(lat,lng,(a->>'latitude')::numeric,(a->>'longitude')::numeric)<=(a->>'radiusKm')::numeric then return true; end if;
 end loop;
 return false;
end $f$;

revoke all on function private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric) from public,anon,authenticated,service_role;
comment on function private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric) is
  'Worker area matching with full support for STATIONARY, POINT_TO_POINT, MULTI_STOP, and AREA_BASED physical task modes.';
