-- SOURCE-ONLY candidate. Not a migration and not applied to DEV.
-- The classifier can return SELECTABLE only for PUBLISHED or SELECTION tasks.
-- Keep authentication, open-account and ownership checks ahead of this fast path.
CREATE OR REPLACE FUNCTION public.selectable_application_count(n public.needs)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid:=auth.uid(); actual public.needs; result integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;
  -- Only the ID is input. Never trust owner/status/price fields in a caller-supplied composite.
  select * into actual from public.needs t where t.id=n.id and t.requester_account_id=actor;
  if not found then return null; end if;

  -- private.need_candidate_states_v5 emits SELECTABLE only for these two task states.
  -- Drafts, ACTIVE and history cannot have a selectable application; avoid scanning their response graph.
  if actual.status not in ('PUBLISHED','SELECTION') then return 0; end if;

  select count(*)::integer into result from private.need_candidate_states_v5(actual.id) c
    where c.candidate_state='SELECTABLE';
  return result;
end;
$function$;
