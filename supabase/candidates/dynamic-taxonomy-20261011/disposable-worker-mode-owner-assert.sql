\set ON_ERROR_STOP on
-- Every check executes under the intended PostgreSQL role & fake JWT claim.
DO $access$
BEGIN
 IF has_table_privilege('authenticated','private.worker_execution_mode_choices','SELECT')
 OR has_table_privilege('service_role','private.worker_execution_mode_choices','INSERT')
 OR has_function_privilege('anon','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR has_function_privilege('service_role','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rpc_get_worker_execution_modes(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'WORKER_MODE_PRIVILEGE_LEAK'; END IF;
END $access$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $worker_a$
DECLARE v jsonb; n integer; saved timestamptz;
BEGIN
 v:=public.rpc_get_worker_execution_modes('20000000-0000-4000-8000-000000000001');
 IF v->>'confirmed'<>'false' OR jsonb_array_length(v->'modes')<>0
 THEN RAISE EXCEPTION 'UNCONFIRMED_WORKER_GOT_DEFAULT_MODES_%',v; END IF;
 v:=public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000001',ARRAY['REMOTE']);
 IF v->>'notificationAuthority'<>'NONE' OR v->>'matchingAuthority'<>'NONE'
 OR v->'modes' <> '["REMOTE"]'::jsonb
 THEN RAISE EXCEPTION 'REMOTE_MODE_SAVE_WRONG_%',v; END IF;
 v:=public.rpc_get_worker_execution_modes('20000000-0000-4000-8000-000000000001');
 IF v->>'confirmed'<>'true' OR v->'modes' <> '["REMOTE"]'::jsonb THEN
  RAISE EXCEPTION 'REMOTE_MODE_FETCH_WRONG_%',v; END IF;
 v:=public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000001',ARRAY['REMOTE','ON_SITE']);
 IF v->'modes' <> '["ON_SITE","REMOTE"]'::jsonb THEN
  RAISE EXCEPTION 'BOTH_MODE_CANONICAL_SORT_WRONG_%',v; END IF;
 SELECT count(*) INTO n FROM private.worker_execution_mode_choices
 WHERE worker_account_id='10000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'NEVER_REACH_DIRECT_PRIVATE_SELECT';
EXCEPTION
 WHEN insufficient_privilege THEN
  NULL; -- Direct table read forbidden, while owner RPC is allowed.
END $worker_a$;
-- Assert invalid arrays and unauthorized worker profiles throw.
DO $worker_a_negative$
DECLARE k text;
BEGIN
 FOREACH k IN ARRAY ARRAY['WRONG_ROLE','DUPLICATES','EMPTY','OTHER_OWNER','REQUESTER_PROFILE'] LOOP
  BEGIN
   CASE k
   WHEN 'WRONG_ROLE' THEN
     PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000001',ARRAY['REMOTE','SUSPENDED']);
   WHEN 'DUPLICATES' THEN
     PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000001',ARRAY['REMOTE','REMOTE']);
   WHEN 'EMPTY' THEN
     PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000001',ARRAY[]::text[]);
   WHEN 'OTHER_OWNER' THEN
     PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000002',ARRAY['ON_SITE']);
   WHEN 'REQUESTER_PROFILE' THEN
     PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000003',ARRAY['ON_SITE']);
   END CASE;
   RAISE EXCEPTION 'UNAUTHORIZED_WORKER_MODE_MUTATION_%',k;
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='UNAUTHORIZED_WORKER_MODE_MUTATION_'||k THEN RAISE; END IF;
  END;
 END LOOP;
END $worker_a_negative$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $worker_b$
DECLARE v jsonb;
BEGIN
 v:=public.rpc_get_worker_execution_modes('20000000-0000-4000-8000-000000000002');
 IF v->>'confirmed'<>'false' THEN RAISE EXCEPTION 'B_DRAFT_AUTO_CONFIRMED'; END IF;
 v:=public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000002',ARRAY['ON_SITE']);
 IF v->'modes'<>'["ON_SITE"]'::jsonb THEN RAISE EXCEPTION 'B_DRAFT_CANNOT_OPT_IN'; END IF;
 BEGIN
  PERFORM public.rpc_set_worker_execution_modes('20000000-0000-4000-8000-000000000004',ARRAY['REMOTE']);
  RAISE EXCEPTION 'SUSPENDED_WAS_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='SUSPENDED_WAS_ALLOWED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.rpc_get_worker_execution_modes('20000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'OTHER_USER_PRIVATE_WORKER_MODE_VISIBLE';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='OTHER_USER_PRIVATE_WORKER_MODE_VISIBLE' THEN RAISE; END IF;
 END;
END $worker_b$;
RESET ROLE;
DO $post$
DECLARE a text[]; b text[];
BEGIN
 SELECT modes INTO a FROM private.worker_execution_mode_choices
 WHERE worker_account_id='10000000-0000-4000-8000-000000000001';
 SELECT modes INTO b FROM private.worker_execution_mode_choices
 WHERE worker_account_id='10000000-0000-4000-8000-000000000002';
 IF a<>ARRAY['ON_SITE','REMOTE']::text[]
 OR b<>ARRAY['ON_SITE']::text[]
 OR (SELECT count(*) FROM private.worker_execution_mode_choices)<>2
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 THEN RAISE EXCEPTION 'OWNER_MODES_NOT_PERSISTED_WITH_EXACT_CONSENT'; END IF;
 RAISE NOTICE 'WORKER_MODE_OWNER_BOUND_PASS: remote-only, onsite-only, both, invalid, other-user and suspended denied';
END $post$;