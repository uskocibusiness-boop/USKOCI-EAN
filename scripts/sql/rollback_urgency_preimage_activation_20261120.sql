-- USKOCI DEV rollback preimage captured 2026-11-20.
-- Restore only as a controlled rollback after reviewing the paired retirement migration.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;
-- rpc_activate_urgent(uuid,integer) | md5=e3d13df0b0cf181334a30efa7576a312 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION public.rpc_activate_urgent(p_need_id uuid, p_expected_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid(); n public.needs; decision jsonb;
  expiry timestamptz; policy_version text; dispatch jsonb;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  select * into n from public.needs where id = p_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  if n.requester_account_id <> u then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  if n.revision <> p_expected_revision then
    raise exception using errcode='PT409', message='NEED_VERSION_MISMATCH';
  end if;

  if n.urgent and n.urgent_expires_at > statement_timestamp() then
    return jsonb_build_object('needId',n.id,'revision',n.revision,'urgent',true,
      'urgentExpiresAt',n.urgent_expires_at,'idempotentReplay',true,'authoritative',true);
  end if;

  decision := private.urgent_activation_decision(n.id, u, statement_timestamp());
  if not coalesce((decision->>'allowed')::boolean,false) then
    raise exception using errcode='55000', message='URGENT_ACTIVATION_NOT_ALLOWED',
      detail = (decision->'reasonCodes')::text;
  end if;
  expiry := (decision->>'candidateExpiresAt')::timestamptz;
  policy_version := decision->>'policyVersion';

  perform set_config('uskoci.urgent_activation_need', n.id::text, true);
  update public.needs set urgent = true,
      urgent_activated_at = statement_timestamp(),
      urgent_expires_at = expiry,
      urgent_policy_version = policy_version
   where id = n.id returning * into n;

  update public.dispatch_rounds set status='STOPPED', stop_reason='URGENT_ACTIVATED'
   where need_id = n.id and need_revision = n.revision and status in ('PLANNED','SENT');

  dispatch := private.dispatch_next_wave(n.id);

  return jsonb_build_object('needId',n.id,'revision',n.revision,'urgent',true,
    'urgentExpiresAt',expiry,'policyVersion',policy_version,'dispatch',dispatch,
    'idempotentReplay',false,'authoritative',true);
end;
$function$


-- rpc_urgent_activation_preview(uuid) | md5=e0d15c6769a737e23041283d20f84db9 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION public.rpc_urgent_activation_preview(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid := auth.uid();
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  return private.urgent_activation_decision(p_need_id, u, statement_timestamp());
end;
$function$

COMMIT;
