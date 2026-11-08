-- R13/R09: coalesce the existing optional push wake inside its source transaction.
-- The durable notification/attempt ledger and recovery Cron remain authoritative.
-- pg_net enqueues transactionally; this function does not send a provider request.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';

do $guard$
declare v_wake pg_proc%rowtype; v_trigger pg_proc%rowtype; v_definition text;
begin
  select * into v_wake from pg_proc where oid='private.wake_push_worker()'::regprocedure;
  select * into v_trigger from pg_proc where oid='private.trg_wake_push_worker_on_delivery()'::regprocedure;
  if md5(v_wake.prosrc) is distinct from 'c0374f79d5275adada913537549e6bae'
     or md5(v_trigger.prosrc) is distinct from '368b2fa3a66d885edbbd4ed946f644e1' then
    raise exception 'R13_PUSH_WAKE_SOURCE_PREIMAGE_DRIFT';
  end if;
  if pg_get_userbyid(v_wake.proowner)<>'postgres' or pg_get_userbyid(v_trigger.proowner)<>'postgres'
     or not v_wake.prosecdef or not v_trigger.prosecdef
     or v_wake.proconfig is distinct from array['search_path=pg_catalog']::text[]
     or v_trigger.proconfig is distinct from array['search_path=pg_catalog']::text[]
     or v_wake.proacl is not null or v_trigger.proacl is not null then
    raise exception 'R13_PUSH_WAKE_ATTRIBUTES_PREIMAGE_DRIFT';
  end if;
  select pg_get_triggerdef(oid) into v_definition from pg_trigger
    where tgrelid='public.notification_deliveries'::regclass and tgname='trg_wake_push_on_delivery' and tgenabled='O';
  if v_definition is distinct from 'CREATE TRIGGER trg_wake_push_on_delivery AFTER INSERT ON public.notification_deliveries REFERENCING NEW TABLE AS new_table FOR EACH STATEMENT EXECUTE FUNCTION private.trg_wake_push_worker_on_delivery()' then
    raise exception 'R13_PUSH_WAKE_TRIGGER_PREIMAGE_DRIFT';
  end if;
end
$guard$;

create or replace function private.wake_push_worker()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_base text;
  v_key text;
  v_transaction text := pg_current_xact_id()::text;
begin
  -- One best-effort wake per top-level transaction, even for many insert statements.
  -- Transaction-local state rolls back with a savepoint/transaction; it never owns a job.
  if current_setting('uskoci.push_wake_transaction', true) = v_transaction then
    return;
  end if;
  perform set_config('uskoci.push_wake_transaction', v_transaction, true);
  begin
    select s.decrypted_secret into v_base from vault.decrypted_secrets s where s.name='uskoci_edge_base_url';
    select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name='uskoci_edge_worker_key';
    if v_base is null or v_base !~ '^(https://[a-z0-9]{20}[.]supabase[.]co|http://supabase_kong_[a-z0-9_-]+:8000)$' then
      raise warning 'USKOCI_PUSH_WAKE_NOT_CONFIGURED BASE_URL';
      return;
    end if;
    if v_key is null or length(v_key) not between 16 and 4096 or v_key !~ '^[A-Za-z0-9._~-]+$' then
      raise warning 'USKOCI_PUSH_WAKE_NOT_CONFIGURED WORKER_KEY';
      return;
    end if;
    perform net.http_post(
      url := v_base || '/functions/v1/uskoci-push-transport',
      body := '{"action":"tick"}'::jsonb,
      headers := jsonb_build_object('Content-Type','application/json','apikey',v_key),
      -- Same outer transport deadline as recovery Cron; Edge still owns its 50s cap.
      timeout_milliseconds := 60000
    );
  exception when others then
    -- Never expose SQLERRM, URL, headers or provider payloads in logs.
    -- Keep the durable event; the next recovery Cron still handles it.
    raise warning 'USKOCI_PUSH_WAKE_FAILED SQLSTATE=%', SQLSTATE;
  end;
end;
$function$;

-- Both functions are internal postgres-owned trigger helpers, not client APIs.
-- Their prior PUBLIC execute was unnecessary; no schema/table permission is added.
revoke all on function private.wake_push_worker() from public, anon, authenticated, service_role;
revoke all on function private.trg_wake_push_worker_on_delivery() from public, anon, authenticated, service_role;

do $verify$
begin
  if exists(select 1 from pg_proc where oid in ('private.wake_push_worker()'::regprocedure,
       'private.trg_wake_push_worker_on_delivery()'::regprocedure)
       and (pg_get_userbyid(proowner)<>'postgres' or not prosecdef or proconfig is distinct from array['search_path=pg_catalog']::text[]))
     or exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(name)
       where has_function_privilege(r.name,'private.wake_push_worker()','EXECUTE')
          or has_function_privilege(r.name,'private.trg_wake_push_worker_on_delivery()','EXECUTE')) then
    raise exception 'R13_PUSH_WAKE_POSTIMAGE_DRIFT';
  end if;
end
$verify$;
commit;
