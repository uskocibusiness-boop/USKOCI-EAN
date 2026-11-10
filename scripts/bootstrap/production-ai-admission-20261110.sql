-- Production-only AI admission. The reserve RPC is patched only on the pinned
-- empty USKOCI production project. Admission and spend remain disabled until
-- Edge, secrets, Auth and a bounded end-to-end check are ready.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $preflight$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283'
     OR current_user <> 'postgres'
     OR to_regclass('private.ai_production_admission_v1') IS NOT NULL
     OR (SELECT count(*) FROM private.ai_test_budget_v5) <> 0
     OR (SELECT count(*) FROM private.ai_test_reservations_v5) <> 0
     OR (SELECT count(*) FROM auth.users) <> 0
     OR (SELECT count(*) FROM private.ai_test_accounts_v5) <> 0
     OR (SELECT md5(pg_get_functiondef('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'::regprocedure))) <> '8959104d93ae9ca013549a643aa1cc4f'
     OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'::regprocedure) <> 'postgres'
     OR (SELECT proacl::text FROM pg_proc WHERE oid='public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'::regprocedure) <> '{postgres=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'USKOCI_PROD_AI_ADMISSION_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;

CREATE TABLE private.ai_production_admission_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_system_identifier text NOT NULL CHECK (project_system_identifier = '7703760980994770283'),
  admit_authenticated_users boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE private.ai_production_admission_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ai_production_admission_v1 FROM public, anon, authenticated, service_role;
INSERT INTO private.ai_production_admission_v1(singleton,project_system_identifier,admit_authenticated_users)
VALUES (true,'7703760980994770283',false);

INSERT INTO private.ai_test_budget_v5(singleton,enabled,ceiling_microusd,reserved_microusd)
VALUES (true,false,5000000,0);

CREATE OR REPLACE FUNCTION public.rpc_ai_test_budget_reserve_service(p_account_id uuid, p_operation_id uuid, p_kind text, p_max_cost_microusd bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_budget private.ai_test_budget_v5%rowtype;
  v_existing private.ai_test_reservations_v5%rowtype;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_account_id is null or p_operation_id is null or p_kind not in ('LLM','STT') or p_kind is null
    or p_max_cost_microusd is distinct from (case p_kind when 'LLM' then 250000::bigint when 'STT' then 200000::bigint end) then
    raise exception 'AI_TEST_RESERVATION_INVALID';
  end if;

  perform pg_advisory_xact_lock_shared(private.closure_account_key(p_account_id));
  select * into strict v_budget from private.ai_test_budget_v5 where singleton for update;
  select * into v_existing from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if found then
    if v_existing.account_id <> p_account_id or v_existing.kind <> p_kind
      or v_existing.max_cost_microusd <> p_max_cost_microusd then
      raise exception 'AI_TEST_OPERATION_CONFLICT';
    end if;
    return jsonb_build_object('admitted',false,'reservationId',v_existing.id,'replay',true,'code','AI_TEST_OPERATION_REPLAY');
  end if;

  if not v_budget.enabled or not v_budget.reservation_cap_enforced
    or statement_timestamp() >= v_budget.price_valid_until then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_NOT_READY');
  end if;
  if not (
       exists(select 1 from private.ai_test_accounts_v5 where account_id=p_account_id and retired_at is null)
       or exists(select 1 from private.ai_production_admission_v1
         where singleton and admit_authenticated_users
           and project_system_identifier=(select system_identifier::text from pg_control_system()))
     )
     or not exists(select 1 from auth.users where id=p_account_id and deleted_at is null)
     or private.closure_account_restricted(p_account_id) then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_ACCOUNT_NOT_ADMITTED');
  end if;
  if v_budget.reserved_microusd + p_max_cost_microusd > v_budget.ceiling_microusd then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_EXHAUSTED');
  end if;

  insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd)
    values(p_operation_id,p_account_id,p_kind,p_max_cost_microusd) returning id into v_id;
  update private.ai_test_budget_v5 set reserved_microusd=reserved_microusd+p_max_cost_microusd where singleton;
  return jsonb_build_object('admitted',true,'reservationId',v_id,'replay',false,'code','AI_TEST_RESERVED');
end
$function$;

DO $postflight$ BEGIN
  IF (SELECT count(*) FROM private.ai_production_admission_v1 WHERE NOT admit_authenticated_users) <> 1
     OR (SELECT count(*) FROM private.ai_test_budget_v5
         WHERE singleton AND NOT enabled AND ceiling_microusd=5000000
           AND reserved_microusd=0 AND reservation_cap_enforced) <> 1
     OR (SELECT proacl::text FROM pg_proc
         WHERE oid='public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'::regprocedure)
        <> '{postgres=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'USKOCI_PROD_AI_ADMISSION_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
