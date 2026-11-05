-- Fix edge case where cancelling an agreement on a need with remaining search closed
-- could leave the need in SELECTION even if other slots were already completed.
create or replace function public.rpc_cancel_agreement(
  p_agreement_id uuid,
  p_reason text
) returns void language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  uid uuid := auth.uid();
  v_need_id uuid;
  v_agr public.agreements%rowtype;
  v_covered integer;
  v_need public.needs%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- Discover without locking, authorize, then use the canonical lock order
  -- Need -> Agreement -> Response shared with selection/cancel/withdraw.
  select a.need_id into v_need_id
    from public.agreements a
   where a.id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  select * into v_need
    from public.needs n
   where n.id = v_need_id
   for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_agr from public.agreements
   where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_agr.need_id is distinct from v_need.id then
    raise exception 'AGREEMENT_NEED_MISMATCH' using errcode = 'P0001';
  end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;
  if v_agr.status = 'CANCELLED' then return; end if;
  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
  update public.agreement_execution set state = 'CANCELLED'
   where agreement_id = p_agreement_id;
  update public.need_selections set status = 'CANCELLED'
   where id = v_agr.selection_id;
  update public.marketplace_responses
     set status = 'NOT_SELECTED', selected_at = null
   where id = v_agr.selected_response_id;
  update public.access_grants
     set status = 'REVOKED',
         revoked_at = coalesce(revoked_at, statement_timestamp())
   where agreement_id = p_agreement_id and status = 'GRANTED';
  update public.notification_deliveries d
     set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id
     and e.entity_type = 'AGREEMENT'
     and e.entity_id = p_agreement_id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');

  -- If remaining search was closed and active remaining slots are already completed, sync immediately
  if v_need.remaining_search_closed_at is not null then
    if private.sync_need_completion(v_need.id) then
      return;
    end if;
  end if;

  v_covered := public.fn_need_covered_slots(v_agr.need_id);

  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION') then
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
end;
$$;

revoke all on function public.rpc_cancel_agreement(uuid,text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_agreement(uuid,text) to authenticated;
