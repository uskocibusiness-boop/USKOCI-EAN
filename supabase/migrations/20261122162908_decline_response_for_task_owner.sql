-- USKOČI: the task owner declines an application (swipe left) — candidate 2026-11-22.
-- Owner decision 22.11.2026 (new Dogovor screen): swipe right accepts through the
-- existing selection flow; swipe left declines and the application disappears.
-- Mirrors rpc_withdraw_response: idempotent client request, Need -> Response lock
-- order, revision and version binding, pending deliveries expired, worker event,
-- marketplace audit. No price, agreement or capacity is changed by a decline.
BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.rpc_decline_response(uuid,integer,integer,text)') IS NOT NULL
  OR to_regclass('private.response_decline_commands') IS NOT NULL
  THEN RAISE EXCEPTION 'DECLINE_RESPONSE_ALREADY_PRESENT'; END IF;
END $guard$;

CREATE TABLE private.response_decline_commands (
  requester_account_id uuid NOT NULL,
  client_request_id text NOT NULL CHECK (char_length(btrim(client_request_id)) BETWEEN 8 AND 200),
  request_hash text NOT NULL,
  response_id uuid NOT NULL,
  response_version integer NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (requester_account_id, client_request_id)
);
ALTER TABLE private.response_decline_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.response_decline_commands FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rpc_decline_response(p_response_id uuid, p_need_revision integer, p_response_version integer, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  v_need_id uuid;
  n public.needs;
  r public.marketplace_responses;
  v_command private.response_decline_commands;
  v_request_hash text;
  v_result jsonb;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if private.closure_account_restricted(u) then raise exception using errcode='42501', message='ACCOUNT_CLOSING'; end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'responseId', p_response_id, 'needRevision', p_need_revision, 'responseVersion', p_response_version
  )::text, 'UTF8')), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7243));

  select * into v_command from private.response_decline_commands c
   where c.requester_account_id = u and c.client_request_id = p_client_request_id;
  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Canonical lock order: Need -> Response (selection, submission and withdrawal use it).
  select x.need_id into v_need_id from public.marketplace_responses x where x.id = p_response_id;
  if not found then raise exception using errcode='P0002', message='RESPONSE_NOT_FOUND'; end if;
  select * into n from public.needs where id = v_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  select * into r from public.marketplace_responses x where x.id = p_response_id for update;
  if not found then raise exception using errcode='P0002', message='RESPONSE_NOT_FOUND'; end if;
  if r.need_id <> n.id then raise exception using errcode='P0001', message='RESPONSE_NEED_MISMATCH'; end if;
  if n.requester_account_id <> u then raise exception using errcode='42501', message='NOT_REQUESTER'; end if;

  if r.status = 'NOT_SELECTED' then
    return jsonb_build_object('responseId', r.id, 'needId', n.id, 'needRevision', n.revision, 'version', r.current_version,
      'status', r.status, 'idempotentReplay', true, 'authoritative', true);
  end if;
  if r.status = 'SELECTED' or exists (select 1 from public.agreements a where a.selected_response_id = r.id
      and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;
  if r.status = 'WITHDRAWN' then raise exception using errcode='22023', message='APPLICATION_WITHDRAWN_FINAL'; end if;
  if r.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE') then
    raise exception using errcode='22023', message='RESPONSE_NOT_DECLINABLE';
  end if;
  -- The owner decides on the application and task they actually saw.
  if r.current_version is distinct from p_response_version or n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  update public.notification_deliveries d set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id and e.entity_type = 'RESPONSE' and e.entity_id = r.id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');

  update public.marketplace_responses set status = 'NOT_SELECTED', selected_at = null where id = r.id returning * into r;

  perform private.emit_event(r.worker_account_id, 'WORKER', 'RESPONSE_NOT_SELECTED', 'RESPONSE', r.id, r.current_version,
    'Prijava nije izabrana', 'Vaša prijava za ovaj zadatak nije izabrana.',
    'response-not-selected:' || r.id::text || ':' || r.current_version::text, 'NORMAL',
    jsonb_build_object('needId', n.id, 'needRevision', n.revision), null);

  perform private.audit_marketplace(u, 'RESPONSE_NOT_SELECTED', 'RESPONSE', r.id, r.current_version,
    jsonb_build_object('needId', n.id, 'needRevision', n.revision, 'clientRequestId', p_client_request_id));

  v_result := jsonb_build_object('responseId', r.id, 'needId', n.id, 'needRevision', n.revision, 'version', r.current_version,
    'status', r.status, 'idempotentReplay', false, 'authoritative', true);
  insert into private.response_decline_commands (requester_account_id, client_request_id, request_hash, response_id, response_version, result)
  values (u, p_client_request_id, v_request_hash, r.id, r.current_version, v_result);
  return v_result;
end;
$function$;

REVOKE ALL ON FUNCTION public.rpc_decline_response(uuid,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_decline_response(uuid,integer,integer,text) TO authenticated, service_role;

DO $post$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.rpc_decline_response(uuid,integer,integer,text)', 'EXECUTE')
  OR has_function_privilege('anon', 'public.rpc_decline_response(uuid,integer,integer,text)', 'EXECUTE')
  OR NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.rpc_decline_response(uuid,integer,integer,text)'::regprocedure)
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.response_decline_commands'::regclass)
  THEN RAISE EXCEPTION 'DECLINE_RESPONSE_POSTIMAGE'; END IF;
END $post$;

COMMIT;
