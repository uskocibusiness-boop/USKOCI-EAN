-- Automatically grant EXACT_LOCATION access to the selected worker when an Agreement is formed.
-- Revocation on cancellation/completion remains enforced by existing triggers and RPC checks.

create or replace function private.auto_grant_exact_location_on_agreement()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status in ('CONFIRMED', 'AWAITING_REQUESTER') then
    insert into public.access_grants (
      agreement_id,
      channel,
      granted_by_account_id,
      granted_to_account_id,
      status,
      granted_at,
      revoked_at,
      expires_at
    )
    select
      new.id,
      'EXACT_LOCATION',
      new.requester_account_id,
      new.worker_account_id,
      'GRANTED',
      statement_timestamp(),
      null,
      null
    from public.needs n
    join public.need_sensitive ns on ns.need_id = n.id
    where n.id = new.need_id
      and n.execution_location_mode is distinct from 'REMOTE'
      and (ns.exact_address is not null or ns.resolved_location is not null or ns.exact_lat is not null)
    on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)
    do nothing;
  end if;
  return new;
end;
$$;

create or replace trigger trg_auto_grant_exact_location_on_agreement
after insert on public.agreements
for each row
execute function private.auto_grant_exact_location_on_agreement();

-- Backfill any existing active agreements that do not yet have a location grant row
insert into public.access_grants (
  agreement_id,
  channel,
  granted_by_account_id,
  granted_to_account_id,
  status,
  granted_at,
  revoked_at,
  expires_at
)
select
  a.id,
  'EXACT_LOCATION',
  a.requester_account_id,
  a.worker_account_id,
  'GRANTED',
  statement_timestamp(),
  null,
  null
from public.agreements a
join public.needs n on n.id = a.need_id
join public.need_sensitive ns on ns.need_id = n.id
where a.status in ('CONFIRMED', 'AWAITING_REQUESTER')
  and n.execution_location_mode is distinct from 'REMOTE'
  and (ns.exact_address is not null or ns.resolved_location is not null or ns.exact_lat is not null)
on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)
do nothing;