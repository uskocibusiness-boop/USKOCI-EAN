-- Proof fixture, disposable chain only: the DEV bodies (read-only readback 2026-10-07) of two functions that the historical chain lacks or carries in an older form,
-- so that the reader public.rpc_list_my_needs_page is measured as it runs on canonical DEV (an item per rpc_read_task, the tab counts per private.own_task_counts).
-- Installed by supabase/proofs/zone-perf/runtime.proof.mjs only when the chain body differs from the DEV md5; exact text, language, volatility, security, search_path, ACL.
-- Never applied to DEV: it is the DEV body already.
create or replace function private.own_task_counts(a uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog'
as $function$
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')),
    'drafts', count(*) filter (where n.status = 'DRAFT'),
    'history', count(*) filter (where n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')),
    'waiting', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')
      and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
      and coalesce(public.selectable_application_count(n), 0) > 0))
  from public.needs n where n.requester_account_id = a
$function$;
revoke all on function private.own_task_counts(uuid) from public, anon, authenticated, service_role;
create or replace function public.rpc_list_my_needs_page(p_scope text, p_limit integer, p_before_at timestamp with time zone, p_before_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','DRAFTS','HISTORY','WAITING') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;

  -- EX-04 S1 (A09). Every item IS the rpc_read_task document that rpc_list_my_tasks returns, so the card, the price basis and the selectable count
  -- cannot drift from the ordinary read; sortAt is the keyset value. The scopes are the client's own sections: Aktivni = PUBLISHED, SELECTION, ACTIVE;
  -- Nacrti = DRAFT; Istorija = COMPLETED, CANCELLED, EXPIRED, ARCHIVED; WAITING = an active task with a place left and a selectable application.
  with page as materialized (
    select n.created_at, n.id
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
      and case p_scope
            when 'ALL' then true
            when 'ACTIVE' then n.status in ('PUBLISHED','SELECTION','ACTIVE')
            when 'DRAFTS' then n.status = 'DRAFT'
            when 'HISTORY' then n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
            else n.status in ('PUBLISHED','SELECTION','ACTIVE')
              and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
              and coalesce(public.selectable_application_count(n), 0) > 0
          end
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(public.rpc_read_task(p.id) || jsonb_build_object('sortAt', p.created_at) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_items from page p;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    -- The five counts of the tabs ride with the first page; a later page does not pay for them again.
    'counts', case when p_before_at is null then private.own_task_counts(v_uid) end,
    'asOf', statement_timestamp());
end
$function$;
revoke all on function public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid) from public, anon, service_role;
grant execute on function public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid) to authenticated;
