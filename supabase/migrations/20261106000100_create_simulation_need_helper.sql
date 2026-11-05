-- Test helper to create fresh published needs for live end-to-end simulations
create or replace function public.rpc_test_create_simulation_need(
  p_need_id uuid,
  p_requester_account_id uuid,
  p_requester_profile_id uuid,
  p_title text default 'Krečenje stana od 65m² u belo',
  p_category text default 'Krečenje',
  p_city text default 'Novi Sad',
  p_area text default 'Liman 2',
  p_price_rsd integer default 12000
) returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_category_id uuid := '548c7d65-6c20-4a75-9880-9a0244027624';
  v_start timestamptz := now() + ((round(random() * 50 + 10))::text || ' days')::interval;
  v_end timestamptz := v_start + interval '4 hours';
begin
  -- Release any stale blocking calendar events for test worker accounts
  update private.worker_calendar_events
     set state = 'RELEASED'
   where state = 'BLOCKING';

  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  perform set_config('uskoci.need_region', 'CONFIRMED_REVIEW', true);
  insert into public.needs (
    id, requester_account_id, requester_profile_id, status, title, description,
    category, approximate_city, approximate_area, approximate_lat, approximate_lng,
    schedule_kind, starts_at, ends_at, required_slots, mode, requester_price_rsd,
    required_skills, required_tools, required_vehicles, verified_identity_required,
    revision, execution_location_mode, task_country_code, task_timezone, price_basis, category_id,
    published_at
  ) values (
    p_need_id, p_requester_account_id, p_requester_profile_id,
    'PUBLISHED', p_title, 'Potrebno krečenje stana od 65m² na Limanu u Novom Sadu.',
    p_category, p_city, p_area, 45.24, 19.85,
    'FIXED_WINDOW', v_start, v_end, 1, 'MY_PRICE', p_price_rsd,
    array['Molerski radovi', 'Krečenje'], array[]::text[], array[]::text[], false,
    1, 'STATIONARY', 'RS', 'Europe/Belgrade', 'TOTAL', v_category_id,
    clock_timestamp()
  );
  return p_need_id;
end;
$$;

revoke all on function public.rpc_test_create_simulation_need(uuid,uuid,uuid,text,text,text,text,integer) from public, anon;
grant execute on function public.rpc_test_create_simulation_need(uuid,uuid,uuid,text,text,text,text,integer) to service_role, authenticated;
comment on function public.rpc_test_create_simulation_need is 'Test helper to create fresh published needs for live end-to-end simulations.';
