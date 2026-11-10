-- R06 dormant DEV package. Project leqcwgzvjsxugfgzdmth; source SHA256 7c1aa14468a63bfb9f7ccf83c5cbd7ac84497900b38e483fa59420c80d10f0e4.
-- Lifecycle companion SHA256 c1a34b4788591119bd2132d7b0f6a6e053a5e5da9a40a886a4326dcf8436cb7d.
-- No Edge toggle, secret, budget, Cron, policy certification or provider call.
-- Keep USKOCI_AI_PREPARED_INPUT_ENABLED off until separate hosted/lifecycle acceptance.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $r06_project$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres'
  OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '7676203829645141156'
 THEN RAISE EXCEPTION 'R06_DEV_PROJECT_MISMATCH' USING errcode='55000'; END IF;
END $r06_project$;
LOCK TABLE private.ai_need_turn_commands,private.worker_ai_turns IN ACCESS EXCLUSIVE MODE;
LOCK TABLE private.retention_holds,public.ai_messages IN ACCESS SHARE MODE;
DO $r06_drain$ BEGIN
 IF EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
  OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'R06_DEV_ACTIVE_TURN_DRAIN_REQUIRED' USING errcode='55000'; END IF;
END $r06_drain$;
DO $r06_project$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres'
  OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '7676203829645141156'
 THEN RAISE EXCEPTION 'R06_DEV_PROJECT_MISMATCH' USING errcode='55000'; END IF;
END $r06_project$;
DO $r06_functions$ DECLARE expected jsonb; actual jsonb; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements($r06_function_data$[{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"boolean","strict":false,"body_md5":"fa90211a3fb9297eeebc74463845c7ca","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid","leakproof":false,"signature":"public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"05c6f257e25baec1ea39abbc4246b36f","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid","leakproof":false,"signature":"public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog, public, private"],"result":"jsonb","strict":false,"body_md5":"91629b929aae24dc3a9b05b412ab1b2e","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_operation_id uuid, p_kind text, p_max_cost_microusd bigint","leakproof":false,"signature":"public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"584eecfd229477010ae1043257a04227","language":"plpgsql","parallel":"u","arguments":"p_operation_id uuid, p_model text, p_prompt_tokens integer, p_output_tokens integer, p_total_tokens integer","leakproof":false,"signature":"public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"972099be9f9429d87bc1566334e7d8f2","language":"plpgsql","parallel":"u","arguments":"p_conversation_id uuid","leakproof":false,"signature":"private.ai_need_turn_context(uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"584ca4ae2d02e33823d9d75a92c14649","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid","leakproof":false,"signature":"public.rpc_read_worker_ai_context_service(uuid,uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text","strict":false,"body_md5":"8130be4bf875702981ec408a33af62ca","language":"sql","parallel":"u","arguments":"p_account_id uuid, p_receipt_id uuid, p_binding jsonb, p_cutoff timestamp with time zone","leakproof":false,"signature":"private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"45a2458b8e93a33649e885ad1ba41b4d","language":"sql","parallel":"u","arguments":"","leakproof":false,"signature":"private.data_export_dataset_catalog()","volatility":"i","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"3b802baedd97cb0ab6e4a227690e7f5e","language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid, g uuid","leakproof":false,"signature":"private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"9d89b9af2e893bc608e7598d175551b7","language":"plpgsql","parallel":"u","arguments":"p_at timestamp with time zone","leakproof":false,"signature":"private.ai_turn_sweep_v5(timestamp with time zone)","volatility":"v","security_definer":true,"argument_defaults":"statement_timestamp()"},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"bigint","strict":false,"body_md5":"87ad940334ae78be5a3c0b19983d5981","language":"sql","parallel":"u","arguments":"p_prompt_tokens integer, p_output_tokens integer","leakproof":false,"signature":"private.ai_test_price_microusd(integer,integer)","volatility":"i","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"bigint","strict":true,"body_md5":"2dde6ad2462255b188e4f03ffe88edcd","language":"sql","parallel":"u","arguments":"a uuid","leakproof":false,"signature":"private.closure_account_key(uuid)","volatility":"i","security_definer":false,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"boolean","strict":false,"body_md5":"f4999250c315e0253374d4611291c7ad","language":"sql","parallel":"u","arguments":"a uuid","leakproof":false,"signature":"private.closure_account_restricted(uuid)","volatility":"s","security_definer":true,"argument_defaults":null}]$r06_function_data$::jsonb) LOOP
  SELECT jsonb_build_object('signature',expected->>'signature','body_md5',md5(p.prosrc),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'security_definer',p.prosecdef,
 'config',p.proconfig,'language',l.lanname,'volatility',p.provolatile,'strict',p.proisstrict,
 'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'cost',p.procost,'rows',p.prorows,
 'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'argument_defaults',pg_get_expr(p.proargdefaults,0),'definition',pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(expected->>'signature') INTO actual;
  IF (actual-'definition') IS DISTINCT FROM (expected-'definition')
  THEN RAISE EXCEPTION 'R06_DEV_PREIMAGE_FUNCTION_DRIFT:%',expected->>'signature' USING errcode='55000'; END IF;
 END LOOP;
END $r06_functions$;
DO $r06_tables$ DECLARE expected jsonb; actual jsonb; additions jsonb; shape text; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements($r06_table_data$[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"client_request_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"turn_id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"request_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"state","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"context_hash","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"attempt_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"name":"lease_expires_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""},{"name":"receipt","type":"jsonb","default":null,"identity":"","not_null":false,"generated":""},{"name":"attempt_times","type":"timestamp with time zone[]","default":"'{}'::timestamp with time zone[]","identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"provider_dispatched","type":"boolean","default":"false","identity":"","not_null":true,"generated":""},{"name":"cancelled_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"policies":[],"relation":"private.ai_need_turn_commands","triggers":[{"name":"pre_v3_closure_ai_command","enabled":"O","function":"private.closure_guard_owned_write()","internal":false,"definition":"CREATE TRIGGER pre_v3_closure_ai_command BEFORE INSERT OR UPDATE ON private.ai_need_turn_commands FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write('ACCOUNT', 'account_id')"}],"force_rls":true,"constraints":[{"name":"ai_need_turn_cancelled_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cancelled_at IS NULL OR state = 'FAILED'::text AND receipt IS NULL)"},{"name":"ai_need_turn_commands_attempt_times_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cardinality(attempt_times) <= 6)"},{"name":"ai_need_turn_commands_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((state = 'SUCCEEDED'::text) = (receipt IS NOT NULL))"},{"name":"ai_need_turn_commands_check1","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state <> 'PROCESSING'::text OR attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL AND context_hash IS NOT NULL)"},{"name":"ai_need_turn_commands_context_hash_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (context_hash IS NULL OR context_hash ~ '^[0-9a-f]{64}$'::text)"},{"name":"ai_need_turn_commands_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (account_id, client_request_id)"},{"name":"ai_need_turn_commands_receipt_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (receipt IS NULL OR jsonb_typeof(receipt) = 'object'::text AND octet_length(receipt::text) <= 4096)"},{"name":"ai_need_turn_commands_request_hash_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (request_hash ~ '^[0-9a-f]{64}$'::text)"},{"name":"ai_need_turn_commands_state_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text]))"},{"name":"ai_need_turn_commands_turn_id_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (turn_id)"}]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"turn_id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"client_request_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"body_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"source_revision","type":"integer","default":null,"identity":"","not_null":true,"generated":""},{"name":"attempt_id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"state","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"lease_expires_at","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""},{"name":"completion_hash","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"provider_dispatched","type":"boolean","default":"false","identity":"","not_null":true,"generated":""},{"name":"cancelled_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""},{"name":"user_message_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""}],"policies":[],"relation":"private.worker_ai_turns","triggers":[],"force_rls":false,"constraints":[{"name":"worker_ai_turn_cancelled_fence","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cancelled_at IS NULL OR state = 'FAILED'::text AND completion_hash IS NULL)"},{"name":"worker_ai_turns_account_id_client_request_id_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (account_id, client_request_id)"},{"name":"worker_ai_turns_conversation_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (conversation_id) REFERENCES private.worker_ai_sessions(conversation_id)"},{"name":"worker_ai_turns_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (turn_id)"},{"name":"worker_ai_turns_state_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text]))"}]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"hold_key","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"name":"active","type":"boolean","default":null,"identity":"","not_null":true,"generated":""},{"name":"revision","type":"bigint","default":null,"identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""}],"policies":[],"relation":"private.retention_holds","triggers":[{"name":"media_hold_evidence_v5","enabled":"O","function":"private.capture_case_media_trigger_v5()","internal":false,"definition":"CREATE TRIGGER media_hold_evidence_v5 AFTER INSERT OR UPDATE ON private.retention_holds FOR EACH ROW EXECUTE FUNCTION private.capture_case_media_trigger_v5()"}],"force_rls":true,"constraints":[{"name":"retention_holds_account_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"retention_holds_account_id_hold_key_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (account_id, hold_key)"},{"name":"retention_holds_hold_key_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (char_length(hold_key) >= 8 AND char_length(hold_key) <= 128)"},{"name":"retention_holds_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"retention_holds_revision_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (revision > 0)"}]},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"owner":"postgres","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"sequence_no","type":"bigint","default":null,"identity":"a","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"role","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"body","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"safety","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"proposed_fact_ids","type":"uuid[]","default":"'{}'::uuid[]","identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"statement_timestamp()","identity":"","not_null":true,"generated":""}],"policies":[{"name":"ai_messages_own_read","check":null,"roles":["authenticated"],"using":"(account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":["authenticated"],"using":"public.rpc_storage_account_open()","command":"r","permissive":false}],"relation":"public.ai_messages","triggers":[{"name":"guard_retention_ai_messages_trg","enabled":"O","function":"private.guard_retention_ai_child()","internal":false,"definition":"CREATE TRIGGER guard_retention_ai_messages_trg BEFORE INSERT OR DELETE OR UPDATE ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION private.guard_retention_ai_child()"},{"name":"pre_v3_closure_ai_message","enabled":"O","function":"private.closure_guard_owned_write()","internal":false,"definition":"CREATE TRIGGER pre_v3_closure_ai_message BEFORE INSERT ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write('CONVERSATION', 'conversation_id')"}],"force_rls":false,"constraints":[{"name":"ai_messages_account_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"ai_messages_body_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 4000)"},{"name":"ai_messages_conversation_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE"},{"name":"ai_messages_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"ai_messages_role_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (role = ANY (ARRAY['USER'::text, 'ASSISTANT'::text]))"},{"name":"ai_messages_safety_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (safety IS NULL OR (safety = ANY (ARRAY['ALLOW'::text, 'CLARIFY'::text, 'REVIEW'::text, 'BLOCK'::text])))"},{"name":"ai_messages_sequence_no_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (sequence_no)"}]}]$r06_table_data$::jsonb) LOOP
  SELECT jsonb_build_object(
 'relation',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
 'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'definition',pg_get_constraintdef(x.oid,true),'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled,'internal',t.tgisinternal,'function',t.tgfoid::regprocedure::text) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid)
 ) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass(expected->>'relation') INTO actual;

  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R06_DEV_TABLE_DRIFT:%',expected->>'relation' USING errcode='55000'; END IF;
 END LOOP;
END $r06_tables$;
DO $r06_absent$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['private.r06_prepared_input_owner_v1(uuid,uuid,uuid,text)','public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)','public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)','public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)'] LOOP
  IF to_regprocedure(signature) IS NOT NULL THEN RAISE EXCEPTION 'R06_DEV_ALREADY_INSTALLED:%',signature; END IF;
 END LOOP;
END $r06_absent$;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_input_owner_guard(signature text primary key,metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE x record;p pg_proc%rowtype;
BEGIN
 FOR x IN SELECT * FROM (VALUES
 ('public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)','fa90211a3fb9297eeebc74463845c7ca'),
 ('public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)','05c6f257e25baec1ea39abbc4246b36f'),
 ('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)','91629b929aae24dc3a9b05b412ab1b2e'),
 ('public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)','584eecfd229477010ae1043257a04227'),
 ('private.ai_need_turn_context(uuid)','972099be9f9429d87bc1566334e7d8f2'),
 ('public.rpc_read_worker_ai_context_service(uuid,uuid)','584ca4ae2d02e33823d9d75a92c14649'),
 ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','8130be4bf875702981ec408a33af62ca'),
 ('private.data_export_dataset_catalog()','45a2458b8e93a33649e885ad1ba41b4d'),
 ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','3b802baedd97cb0ab6e4a227690e7f5e')
 ) v(signature,body_md5) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM x.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR NOT p.prosecdef OR p.proacl::text IS DISTINCT FROM (CASE WHEN x.signature LIKE 'public.%'
    THEN '{postgres=X/postgres,service_role=X/postgres}' ELSE '{postgres=X/postgres}' END)
   THEN RAISE EXCEPTION 'R06_INPUT_PREIMAGE_DRIFT:%',x.signature;END IF;
  INSERT INTO pg_temp.r06_input_owner_guard VALUES(x.signature,to_jsonb(p)-'prosrc');
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid IN('private.ai_need_turn_commands'::regclass,'private.worker_ai_turns'::regclass)
  AND attname IN('prepared_input','prepared_input_sha256','prepared_at','prepared_reservation_id') AND NOT attisdropped)
  OR to_regprocedure('public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)') IS NOT NULL
  OR to_regprocedure('public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)') IS NOT NULL
  OR to_regprocedure('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'R06_INPUT_ALREADY_PRESENT';END IF;
END $guard$;

DO $columns$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['private.ai_need_turn_commands','private.worker_ai_turns'] LOOP
  EXECUTE format('ALTER TABLE %s ADD COLUMN prepared_input jsonb,ADD COLUMN prepared_input_sha256 text,
   ADD COLUMN prepared_at timestamptz,ADD COLUMN prepared_reservation_id uuid',relation_name);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT r06_prepared_input_shape CHECK (
   ((prepared_at IS NULL)=(prepared_reservation_id IS NULL)) AND
   ((prepared_input IS NULL AND prepared_input_sha256 IS NULL) OR
    (prepared_input IS NOT NULL AND jsonb_typeof(prepared_input)=''object'' AND octet_length(prepared_input::text)<=524288
     AND prepared_input_sha256 IS NOT NULL AND prepared_input_sha256~''^[0-9a-f]{64}$''
     AND prepared_at IS NOT NULL AND prepared_reservation_id IS NOT NULL)))',relation_name);
 END LOOP;
END $columns$;

-- The existing account/session/conversation/command lock order is retained.
-- This private helper exposes no client executor and never extends a lease.
CREATE FUNCTION private.r06_prepared_input_owner_v1(a uuid,c uuid,r uuid,purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE n private.ai_need_turn_commands;w private.worker_ai_turns;s private.worker_ai_sessions;
 parent public.ai_conversations;command jsonb;context jsonb;state_value text;source_identity text;
BEGIN
 IF a IS NULL OR c IS NULL OR r IS NULL OR purpose IS NULL OR purpose NOT IN('NEED_SERVICE','WORKER_CAPABILITY')
 THEN RAISE EXCEPTION 'R06_INPUT_IDENTITY_REQUIRED' USING errcode='22023';END IF;
 PERFORM private.closure_assert_open(a);
 -- A reservation operation is global; serialize preparation across both owners.
 PERFORM pg_advisory_xact_lock(hashtextextended('r06-prepared-operation:'||r::text,0));
 IF purpose='NEED_SERVICE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('w03-account:'||a::text,0));
  SELECT * INTO parent FROM public.ai_conversations WHERE id=c AND account_id=a FOR UPDATE;
  IF NOT FOUND OR parent.purpose<>'NEED_INTAKE' OR parent.fact_schema_version<>'NEED_FACT_V2'
  THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO n FROM private.ai_need_turn_commands WHERE account_id=a AND client_request_id=r FOR UPDATE;
  IF NOT FOUND OR n.conversation_id<>c THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  command:=to_jsonb(n);
  IF parent.status<>'OPEN' OR n.cancelled_at IS NOT NULL THEN state_value:='CLOSED';
  ELSIF n.provider_dispatched THEN state_value:='READ_ONLY';
  ELSIF n.state<>'PROCESSING' OR n.lease_expires_at<=clock_timestamp() THEN state_value:='EXPIRED';
  ELSE
   context:=private.ai_need_turn_context(c);
   source_identity:=context->>'sha256';context:=context->'context';
   state_value:=CASE WHEN n.context_hash IS DISTINCT FROM source_identity THEN 'STALE' ELSE 'READY' END;
  END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||a::text||r::text,0));
  SELECT * INTO s FROM private.worker_ai_sessions WHERE account_id=a AND conversation_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO parent FROM public.ai_conversations pc WHERE pc.id=c AND pc.account_id=a AND pc.purpose='PROFILE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO w FROM private.worker_ai_turns WHERE account_id=a AND client_request_id=r FOR UPDATE;
  IF NOT FOUND OR w.conversation_id<>c THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  command:=to_jsonb(w);
  IF parent.status<>'OPEN' OR w.cancelled_at IS NOT NULL THEN state_value:='CLOSED';
  ELSIF w.provider_dispatched THEN state_value:='READ_ONLY';
  ELSIF w.state<>'PROCESSING' OR w.lease_expires_at<=clock_timestamp() THEN state_value:='EXPIRED';
  ELSIF w.source_revision<>s.revision OR s.safety NOT IN('ALLOW','CLARIFY') OR s.base_hash IS DISTINCT FROM private.worker_ai_source_hash(a)
   THEN state_value:='STALE';
  ELSE
   context:=public.rpc_read_worker_ai_context_service(a,c);
   source_identity:=encode(extensions.digest(context::text,'sha256'),'hex');state_value:='READY';
  END IF;
 END IF;
 RETURN jsonb_build_object('state',state_value,'command',command,'context',context,'sourceIdentity',source_identity);
END $function$;
REVOKE ALL ON FUNCTION private.r06_prepared_input_owner_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_ai_prepare_input_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,
 p_attempt_id uuid,p_purpose text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE owned jsonb;command jsonb;request jsonb;item jsonb;part jsonb;reserved jsonb;material jsonb;digest text;
 reservation_id uuid;input_prepared_at timestamptz;input_text text;hash text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 IF p_attempt_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR p_input-array['schemaVersion','model','userText','providerRequest','catalog','runtime']<>'{}'::jsonb
  OR NOT(p_input?&ARRAY['schemaVersion','model','userText','providerRequest','catalog','runtime'])
  OR p_input->>'schemaVersion' IS DISTINCT FROM 'R06_TEXT_INPUT_V1'
  OR p_input->>'model' IS DISTINCT FROM 'gemini-3.8-flash'
  OR jsonb_typeof(p_input->'userText') IS DISTINCT FROM 'string' OR char_length(btrim(p_input->>'userText')) NOT BETWEEN 1 AND 4000
  OR jsonb_typeof(p_input->'runtime') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input#>'{runtime,sourceContext}') IS DISTINCT FROM 'object' OR octet_length(p_input::text)>262144
 THEN RAISE EXCEPTION 'R06_INPUT_INVALID' USING errcode='22023';END IF;
 request:=p_input->'providerRequest';
 IF jsonb_typeof(request) IS DISTINCT FROM 'object' OR request-array['systemInstruction','contents','generationConfig']<>'{}'::jsonb
  OR NOT(request?&ARRAY['systemInstruction','contents','generationConfig'])
  OR jsonb_typeof(request->'systemInstruction') IS DISTINCT FROM 'object'
  OR (request->'systemInstruction')-'parts'<>'{}'::jsonb
  OR jsonb_typeof(request#>'{systemInstruction,parts}') IS DISTINCT FROM 'array'
  OR jsonb_typeof(request->'contents') IS DISTINCT FROM 'array' OR jsonb_array_length(request->'contents') NOT BETWEEN 1 AND 102
  OR jsonb_typeof(request->'generationConfig') IS DISTINCT FROM 'object'
  OR (request->'generationConfig')-ARRAY['temperature','maxOutputTokens','responseMimeType','responseSchema','thinkingConfig']<>'{}'::jsonb
  OR jsonb_typeof(request#>'{generationConfig,temperature}') IS DISTINCT FROM 'number'
  OR NOT((request#>>'{generationConfig,temperature}')::numeric BETWEEN 0 AND 1)
  OR request#>>'{generationConfig,responseMimeType}' IS DISTINCT FROM 'application/json'
  OR request#>'{generationConfig,maxOutputTokens}' IS DISTINCT FROM '2048'::jsonb
  OR request#>'{generationConfig,thinkingConfig}' IS DISTINCT FROM '{"thinkingBudget":0}'::jsonb
  OR jsonb_typeof(request#>'{generationConfig,responseSchema}') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'R06_TEXT_REQUEST_INVALID' USING errcode='22023';END IF;
 -- No inline photo, provider file URL, cache handle or reconstructible-by-guessing input.
 FOR part IN SELECT value FROM jsonb_array_elements(request#>'{systemInstruction,parts}') LOOP
  IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR part-'text'<>'{}'::jsonb OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'R06_TEXT_ONLY_INPUT' USING errcode='22023';END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(request->'contents') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item-array['role','parts']<>'{}'::jsonb
   OR NOT(item?&ARRAY['role','parts']) OR jsonb_typeof(item->'role') IS DISTINCT FROM 'string'
   OR item->>'role' NOT IN('user','model') OR jsonb_typeof(item->'parts') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'R06_TEXT_REQUEST_INVALID' USING errcode='22023';END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(item->'parts') LOOP
   IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR part-'text'<>'{}'::jsonb OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'R06_TEXT_ONLY_INPUT' USING errcode='22023';END IF;
  END LOOP;
 END LOOP;
 -- The final provider message is the claimed text itself, not a different
 -- request supplied alongside the correct hash. Location/media use other paths.
 item:=request->'contents'->-1;
 IF item->>'role' IS DISTINCT FROM 'user' OR jsonb_array_length(item->'parts')<>1
  OR item#>>'{parts,0,text}' IS DISTINCT FROM p_input->>'userText'
 THEN RAISE EXCEPTION 'R06_INPUT_REQUEST_MISMATCH' USING errcode='22023';END IF;
 IF p_input->'catalog'<>'null'::jsonb AND (jsonb_typeof(p_input->'catalog') IS DISTINCT FROM 'object'
  OR (p_input->'catalog')-ARRAY['catalogVersion','catalogFingerprint','categories']<>'{}'::jsonb
  OR NOT(p_input->'catalog'?&ARRAY['catalogVersion','catalogFingerprint','categories'])
  OR jsonb_typeof(p_input#>'{catalog,catalogVersion}') IS DISTINCT FROM 'number'
  OR (p_input#>>'{catalog,catalogVersion}')!~'^[1-9][0-9]*$'
  OR jsonb_typeof(p_input#>'{catalog,catalogFingerprint}') IS DISTINCT FROM 'string'
  OR (p_input#>>'{catalog,catalogFingerprint}')!~'^[0-9a-f]{32}$'
  OR jsonb_typeof(p_input#>'{catalog,categories}') IS DISTINCT FROM 'array')
 THEN RAISE EXCEPTION 'R06_CATALOG_INPUT_INVALID' USING errcode='22023';END IF;
 owned:=private.r06_prepared_input_owner_v1(p_account_id,p_conversation_id,p_client_request_id,p_purpose);command:=owned->'command';
 IF owned->>'state'<>'READY' OR command->>'attempt_id' IS DISTINCT FROM p_attempt_id::text
 THEN RAISE EXCEPTION 'R06_INPUT_NOT_PREPARABLE' USING errcode='55000';END IF;
 -- Reading current ownership here must not silently bind an older Edge-built
 -- request to a newer context. Both initial preparation and replay keep the
 -- exact context used by that request; retries reconstruct it from the snapshot.
 IF p_input#>'{runtime,sourceContext}' IS DISTINCT FROM owned->'context'
 THEN RAISE EXCEPTION 'R06_INPUT_SOURCE_MISMATCH' USING errcode='55000';END IF;
 input_text:=p_input->>'userText';
 hash:=CASE WHEN p_purpose='NEED_SERVICE' THEN private.ai_location_request_hash(p_conversation_id,input_text,null)
  ELSE encode(extensions.digest(input_text,'sha256'),'hex') END;
 IF hash IS DISTINCT FROM (CASE WHEN p_purpose='NEED_SERVICE' THEN command->>'request_hash' ELSE command->>'body_hash' END)
 THEN RAISE EXCEPTION 'R06_INPUT_REQUEST_MISMATCH' USING errcode='22023';END IF;
 IF command->'prepared_input'<>'null'::jsonb THEN
  IF command#>'{prepared_input,input}' IS DISTINCT FROM p_input
   OR command#>>'{prepared_input,attemptId}' IS DISTINCT FROM p_attempt_id::text
   OR command#>>'{prepared_input,sourceIdentity}' IS DISTINCT FROM owned->>'sourceIdentity'
  THEN RAISE EXCEPTION 'R06_INPUT_IMMUTABLE' USING errcode='55000';END IF;
  IF NOT EXISTS(SELECT 1 FROM private.ai_test_reservations_v5 WHERE id=(command->>'prepared_reservation_id')::uuid
   AND operation_id=p_client_request_id AND account_id=p_account_id AND kind='LLM' AND max_cost_microusd=250000 AND settled_microusd IS NULL)
  THEN RETURN jsonb_build_object('state','READ_ONLY');END IF;
  IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
  THEN RAISE EXCEPTION 'R06_INPUT_LEASE_EXPIRED' USING errcode='55000';END IF;
  RETURN jsonb_build_object('state','PREPARED','replay',true,'inputSha256',command->>'prepared_input_sha256');
 END IF;
 IF command->>'prepared_at' IS NOT NULL THEN RAISE EXCEPTION 'R06_INPUT_ERASED' USING errcode='55000';END IF;
 IF (p_purpose='NEED_SERVICE' AND EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE account_id=p_account_id AND client_request_id=p_client_request_id))
  OR (p_purpose='WORKER_CAPABILITY' AND EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE account_id=p_account_id AND client_request_id=p_client_request_id))
 THEN RAISE EXCEPTION 'R06_INPUT_OPERATION_CONFLICT' USING errcode='55000';END IF;
 -- Reserve and persist together. Never adopt/reset an older ambiguous reservation.
 reserved:=public.rpc_ai_test_budget_reserve_service(p_account_id,p_client_request_id,'LLM',250000);
 IF reserved->'admitted' IS DISTINCT FROM 'true'::jsonb OR reserved->'replay' IS DISTINCT FROM 'false'::jsonb
 THEN RAISE EXCEPTION 'R06_INPUT_BUDGET_NOT_ADMITTED' USING errcode='55000';END IF;
 IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
 THEN RAISE EXCEPTION 'R06_INPUT_LEASE_EXPIRED' USING errcode='55000';END IF;
 reservation_id:=(reserved->>'reservationId')::uuid;input_prepared_at:=clock_timestamp();
 material:=jsonb_build_object('schemaVersion','R06_PREPARED_TEXT_V1','purpose',p_purpose,
  'accountId',p_account_id,'conversationId',p_conversation_id,'clientRequestId',p_client_request_id,
  'turnId',command->>'turn_id','attemptId',p_attempt_id,'sourceIdentity',owned->>'sourceIdentity',
  'sourceContext',owned->'context','input',p_input,'reservationId',reservation_id,
  'instructionSha256',encode(extensions.digest((request->'systemInstruction')::text,'sha256'),'hex'),
  'schemaSha256',encode(extensions.digest((request#>'{generationConfig,responseSchema}')::text,'sha256'),'hex'),
  'catalogSha256',encode(extensions.digest((p_input->'catalog')::text,'sha256'),'hex'));
 IF octet_length(material::text)>524288 THEN RAISE EXCEPTION 'R06_PREPARED_INPUT_TOO_LARGE' USING errcode='22001';END IF;
 digest:=encode(extensions.digest(material::text,'sha256'),'hex');
 IF p_purpose='NEED_SERVICE' THEN
  UPDATE private.ai_need_turn_commands SET prepared_input=material,prepared_input_sha256=digest,
   prepared_at=input_prepared_at,prepared_reservation_id=reservation_id
   WHERE account_id=p_account_id AND client_request_id=p_client_request_id;
 ELSE
  UPDATE private.worker_ai_turns SET prepared_input=material,prepared_input_sha256=digest,
   prepared_at=input_prepared_at,prepared_reservation_id=reservation_id
   WHERE account_id=p_account_id AND client_request_id=p_client_request_id;
 END IF;
 RETURN jsonb_build_object('state','PREPARED','replay',false,'inputSha256',digest);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.rpc_ai_read_prepared_input_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE owned jsonb;command jsonb;state_value text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 owned:=private.r06_prepared_input_owner_v1(p_account_id,p_conversation_id,p_client_request_id,p_purpose);command:=owned->'command';
 state_value:=owned->>'state';
 IF state_value IN('CLOSED','READ_ONLY') THEN RETURN jsonb_build_object('state',state_value);END IF;
 IF command->'prepared_input'='null'::jsonb AND command->>'prepared_at' IS NOT NULL
 THEN RETURN jsonb_build_object('state','ERASED');END IF;
 IF state_value<>'READY' THEN RETURN jsonb_build_object('state',state_value);END IF;
 IF command->'prepared_input'='null'::jsonb THEN RETURN jsonb_build_object('state',CASE WHEN command->>'prepared_at' IS NULL THEN 'ABSENT' ELSE 'ERASED' END);END IF;
 IF command#>>'{prepared_input,attemptId}' IS DISTINCT FROM command->>'attempt_id'
  OR command#>>'{prepared_input,sourceIdentity}' IS DISTINCT FROM owned->>'sourceIdentity'
 THEN RETURN jsonb_build_object('state','STALE');END IF;
 IF encode(extensions.digest((command->'prepared_input')::text,'sha256'),'hex') IS DISTINCT FROM command->>'prepared_input_sha256'
 THEN RAISE EXCEPTION 'R06_INPUT_DIGEST_MISMATCH' USING errcode='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.ai_test_reservations_v5 WHERE id=(command->>'prepared_reservation_id')::uuid
  AND operation_id=p_client_request_id AND account_id=p_account_id AND kind='LLM' AND max_cost_microusd=250000 AND settled_microusd IS NULL)
 THEN RETURN jsonb_build_object('state','READ_ONLY');END IF;
 IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
 THEN RETURN jsonb_build_object('state','EXPIRED');END IF;
 RETURN jsonb_build_object('state','PREPARED','inputSha256',command->>'prepared_input_sha256','snapshot',command->'prepared_input');
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text) TO service_role;

-- A read is not permission to contact a provider. Revalidate the same snapshot
-- and live admission while holding the existing global budget lock, then call
-- the original owner exactly once in this transaction. No reservation is changed.
CREATE FUNCTION public.rpc_ai_dispatch_prepared_input_service(p_account_id uuid,p_conversation_id uuid,
 p_client_request_id uuid,p_attempt_id uuid,p_purpose text,p_input_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE prepared jsonb;snapshot jsonb;budget private.ai_test_budget_v5;reservation private.ai_test_reservations_v5;
 dispatched boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 IF p_attempt_id IS NULL OR p_input_sha256 IS NULL OR p_input_sha256!~'^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'R06_INPUT_DISPATCH_IDENTITY_REQUIRED' USING errcode='22023';END IF;
 prepared:=public.rpc_ai_read_prepared_input_service(p_account_id,p_conversation_id,p_client_request_id,p_purpose);
 IF prepared->>'state'<>'PREPARED' THEN RETURN jsonb_build_object('state',prepared->>'state','dispatched',false);END IF;
 snapshot:=prepared->'snapshot';
 IF snapshot->>'attemptId' IS DISTINCT FROM p_attempt_id::text OR prepared->>'inputSha256' IS DISTINCT FROM p_input_sha256
 THEN RAISE EXCEPTION 'R06_INPUT_DISPATCH_MISMATCH' USING errcode='55000';END IF;
 SELECT * INTO STRICT budget FROM private.ai_test_budget_v5 WHERE singleton FOR UPDATE;
 -- Use the clock after the lock wait: neither a price window nor a lease can
 -- be extended by a statement that began before it expired.
 IF NOT budget.enabled OR NOT budget.reservation_cap_enforced OR budget.price_valid_until<=clock_timestamp()
  OR budget.reserved_microusd>budget.ceiling_microusd
  OR NOT EXISTS(SELECT 1 FROM private.ai_test_accounts_v5 WHERE account_id=p_account_id AND retired_at IS NULL)
  OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_account_id AND deleted_at IS NULL)
 THEN RETURN jsonb_build_object('state','NOT_ADMITTED','dispatched',false);END IF;
 SELECT * INTO reservation FROM private.ai_test_reservations_v5
  WHERE id=(snapshot->>'reservationId')::uuid FOR UPDATE;
 IF NOT FOUND OR reservation.operation_id IS DISTINCT FROM p_client_request_id
  OR reservation.account_id IS DISTINCT FROM p_account_id OR reservation.kind<>'LLM'
  OR reservation.max_cost_microusd<>250000 OR reservation.settled_microusd IS NOT NULL
 THEN RETURN jsonb_build_object('state','READ_ONLY','dispatched',false);END IF;
 IF p_purpose='NEED_SERVICE' THEN
  dispatched:=public.rpc_ai_dispatch_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id);
 ELSE
  dispatched:=(public.rpc_dispatch_worker_ai_turn_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id)->'dispatched')='true'::jsonb;
 END IF;
 IF dispatched IS DISTINCT FROM true THEN RETURN jsonb_build_object('state','NOT_DISPATCHED','dispatched',false);END IF;
 RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text) TO service_role;

-- R06_PRIVACY_PATCHES_START
DO $patch$ DECLARE d text; old_text text:=$old$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at,'cancelledAt',t.cancelled_at)$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at,'cancelledAt',t.cancelled_at,'preparedInput',t.prepared_input,'preparedAt',t.prepared_at)$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$select 'taskAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'cancelledAt',t.cancelled_at,'createdAt',t.created_at)$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$select 'taskAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'cancelledAt',t.cancelled_at,'createdAt',t.created_at,'preparedInput',t.prepared_input,'preparedAt',t.prepared_at)$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$"key": "workerAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "state"]$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$"key": "workerAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "preparedAt", "preparedInput", "state"]$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$"key": "taskAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "state"]$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$"key": "taskAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "preparedAt", "preparedInput", "state"]$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$ -- An operator's note about a person is not audit metadata the subject must live with. The$old$; BEGIN
 d:=pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$ if r in('private.ai_need_turn_commands','private.worker_ai_turns') and t?'prepared_input' then
  p:=p||jsonb_build_object('prepared_input',null,'prepared_input_sha256',null);
 end if;
 -- An operator's note about a person is not audit metadata the subject must live with. The$new$);
END $patch$;
DO $metadata$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.r06_input_owner_guard g JOIN pg_proc p ON p.oid=to_regprocedure(g.signature)
  WHERE (to_jsonb(p)-'prosrc') IS DISTINCT FROM g.metadata)
 THEN RAISE EXCEPTION 'R06_INPUT_OWNER_METADATA_CHANGED';END IF;
END $metadata$;

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_privacy_owner_guard(signature text primary key,metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE x record;p pg_proc%rowtype;
BEGIN
 FOR x IN SELECT * FROM (VALUES
  ('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)','f34a5a16d9a0361c6503d05b46d6f6d7'),
  ('private.ai_turn_sweep_v5(timestamp with time zone)','9d89b9af2e893bc608e7598d175551b7'),
  ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','e38d4cc8b0e780dc49887ba41a8086fa')
 ) v(signature,body_md5) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM x.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR p.proacl::text IS DISTINCT FROM (CASE WHEN x.signature LIKE 'public.%'
    THEN '{postgres=X/postgres,service_role=X/postgres}' ELSE '{postgres=X/postgres}' END)
  THEN RAISE EXCEPTION 'R06_PRIVACY_PREIMAGE_DRIFT:%',x.signature;END IF;
  INSERT INTO pg_temp.r06_privacy_owner_guard VALUES(x.signature,to_jsonb(p)-'prosrc');
 END LOOP;
END $guard$;

-- The old dispatch owner records permission first. The frozen local variable
-- still supplies the exact response to Edge; an unknown ACK remains READ_ONLY.
-- Never wait for a retention lock after command/budget locks. A conflicting
-- hold/cleanup transaction leaves the input for the existing sweep instead.
DO $dispatch$
DECLARE d text;old_text text:=$old$ RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);$old$;
BEGIN
 d:=pg_get_functiondef('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$ IF p_purpose='WORKER_CAPABILITY'
  AND pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0)) THEN
  -- Read held state in a separate volatile statement after acquiring the lock;
  -- a just-committed hold must not be hidden by the pre-acquire snapshot.
  IF NOT EXISTS(SELECT 1 FROM private.retention_holds WHERE account_id=p_account_id AND active
   AND (conversation_id IS NULL OR conversation_id=p_conversation_id))
  AND EXISTS(SELECT 1 FROM private.worker_ai_turns t JOIN public.ai_messages m ON m.id=t.user_message_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id AND t.client_request_id=p_client_request_id
    AND t.attempt_id=p_attempt_id AND m.account_id=t.account_id AND m.conversation_id=t.conversation_id
    AND m.role='USER' AND m.body=snapshot#>>'{input,userText}') THEN
  UPDATE private.worker_ai_turns SET prepared_input=NULL,prepared_input_sha256=NULL
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id AND client_request_id=p_client_request_id
    AND attempt_id=p_attempt_id AND provider_dispatched AND prepared_input_sha256=p_input_sha256;
  END IF;
 END IF;
 RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);$new$);
END $dispatch$;

-- Reuse the existing scheduled sweep; no second scheduler or new retention
-- duration. Cleanup does not settle money, delete command identities, renew a
-- lease, change its state or clear the provider marker. Closure keeps its own
-- certified executor for restricted accounts, and active holds retain copies.
-- Need has no canonical user message until completion. Its unconfirmed text
-- remains retained/exportable here even after dispatch, failure or expiry.
DO $sweep$
DECLARE d text;old_text text:=$old$begin
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.$old$;
BEGIN
 d:=pg_get_functiondef('private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$begin
  -- Cleanup precedes legacy state transitions. A future caller-supplied p_at
  -- cannot itself expire a still-recoverable snapshot in this new phase.
  declare
    input_relation text;copy_predicate text;candidate record;locked_input boolean;
    input_cutoff timestamptz:=least(coalesce(p_at,statement_timestamp()),clock_timestamp());
  begin
    foreach input_relation in array array['private.ai_need_turn_commands','private.worker_ai_turns'] loop
      copy_predicate:=case when input_relation='private.ai_need_turn_commands' then
        $copy$t.state='SUCCEEDED' and t.receipt->'authoritative'='true'::jsonb
          and exists(select 1 from public.ai_messages m where m.id=case
           when (t.receipt->>'userMessageId')~*'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
           then (t.receipt->>'userMessageId')::uuid else null end
           and m.account_id=t.account_id and m.conversation_id=t.conversation_id and m.role='USER'
           and m.body=t.prepared_input#>>'{input,userText}')$copy$
        else $copy$exists(select 1 from public.ai_messages m where m.id=t.user_message_id
           and m.account_id=t.account_id and m.conversation_id=t.conversation_id and m.role='USER'
           and m.body=t.prepared_input#>>'{input,userText}')$copy$ end;
      for candidate in execute format(
        'select t.account_id,t.conversation_id,t.client_request_id from %s t
         where t.prepared_input is not null and (t.provider_dispatched or t.state<>''PROCESSING''
          or t.cancelled_at is not null or t.lease_expires_at<=$1) and (%s)
          and not private.closure_account_restricted(t.account_id)
          and not exists(select 1 from private.retention_holds h where h.account_id=t.account_id and h.active
            and (h.conversation_id is null or h.conversation_id=t.conversation_id))
         order by t.prepared_at,t.turn_id limit 100',input_relation,copy_predicate) using input_cutoff loop
        -- Closure uses an exclusive account lock; try the same shared lock as
        -- normal writes before retention and row locks, without waiting.
        if not pg_try_advisory_xact_lock_shared(private.closure_account_key(candidate.account_id)) then continue;end if;
        if private.closure_account_restricted(candidate.account_id) then continue;end if;
        if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||candidate.account_id::text,0)) then continue;end if;
        if exists(select 1 from private.retention_holds h where h.account_id=candidate.account_id and h.active
          and (h.conversation_id is null or h.conversation_id=candidate.conversation_id)) then continue;end if;
        execute format('select true from %s t where t.account_id=$1 and t.client_request_id=$2
          and t.prepared_input is not null and (t.provider_dispatched or t.state<>''PROCESSING''
           or t.cancelled_at is not null or t.lease_expires_at<=$3) and (%s) for update skip locked',input_relation,copy_predicate)
          into locked_input using candidate.account_id,candidate.client_request_id,input_cutoff;
        if locked_input is distinct from true then continue;end if;
        execute format('update %s set prepared_input=null,prepared_input_sha256=null
          where account_id=$1 and client_request_id=$2',input_relation)
          using candidate.account_id,candidate.client_request_id;
      end loop;
    end loop;
  exception when others then
    -- Roll back this bounded cleanup phase on error, leave original sweep work
    -- running, and surface a content-free diagnostic for the current owner.
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object('turns','PREPARED_INPUT','sqlstate',sqlstate));
  end;
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.$new$);
END $sweep$;

-- The pending user text can exist only in this recovery copy, so preserve its
-- subject-export coverage. Prompts, public catalog/schema, internal runtime and
-- provider reservation metadata are not personal input datasets.
DO $export$
DECLARE d text;old_text text:=$old$'preparedInput',t.prepared_input,'preparedAt',t.prepared_at$old$;
BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>2*length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$'preparedInput',CASE WHEN t.prepared_input IS NULL THEN NULL ELSE jsonb_build_object('userText',t.prepared_input#>>'{input,userText}') END,'preparedAt',t.prepared_at$new$);
END $export$;

DO $metadata$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.r06_privacy_owner_guard g JOIN pg_proc p ON p.oid=to_regprocedure(g.signature)
  WHERE (to_jsonb(p)-'prosrc') IS DISTINCT FROM g.metadata)
 THEN RAISE EXCEPTION 'R06_PRIVACY_OWNER_METADATA_CHANGED';END IF;
END $metadata$;

DO $r06_project$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres'
  OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '7676203829645141156'
 THEN RAISE EXCEPTION 'R06_DEV_PROJECT_MISMATCH' USING errcode='55000'; END IF;
END $r06_project$;
DO $r06_functions$ DECLARE expected jsonb; actual jsonb; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements($r06_function_data$[{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"boolean","strict":false,"body_md5":"fa90211a3fb9297eeebc74463845c7ca","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid","leakproof":false,"signature":"public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"05c6f257e25baec1ea39abbc4246b36f","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid","leakproof":false,"signature":"public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog, public, private"],"result":"jsonb","strict":false,"body_md5":"91629b929aae24dc3a9b05b412ab1b2e","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_operation_id uuid, p_kind text, p_max_cost_microusd bigint","leakproof":false,"signature":"public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"584eecfd229477010ae1043257a04227","language":"plpgsql","parallel":"u","arguments":"p_operation_id uuid, p_model text, p_prompt_tokens integer, p_output_tokens integer, p_total_tokens integer","leakproof":false,"signature":"public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)","volatility":"v","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"972099be9f9429d87bc1566334e7d8f2","language":"plpgsql","parallel":"u","arguments":"p_conversation_id uuid","leakproof":false,"signature":"private.ai_need_turn_context(uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"584ca4ae2d02e33823d9d75a92c14649","language":"plpgsql","parallel":"u","arguments":"p_account_id uuid, p_conversation_id uuid","leakproof":false,"signature":"public.rpc_read_worker_ai_context_service(uuid,uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text","strict":false,"body_md5":"229bae101282b7e283a658da9a2ca597","language":"sql","parallel":"u","arguments":"p_account_id uuid, p_receipt_id uuid, p_binding jsonb, p_cutoff timestamp with time zone","leakproof":false,"signature":"private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"91ca08529dad0631846463ee68c5181c","language":"sql","parallel":"u","arguments":"","leakproof":false,"signature":"private.data_export_dataset_catalog()","volatility":"i","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"4dc63d33c8d69482f3ea883be75d9817","language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid, g uuid","leakproof":false,"signature":"private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)","volatility":"s","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"body_md5":"8228461b045f87eebe7f00c646d99720","language":"plpgsql","parallel":"u","arguments":"p_at timestamp with time zone","leakproof":false,"signature":"private.ai_turn_sweep_v5(timestamp with time zone)","volatility":"v","security_definer":true,"argument_defaults":"statement_timestamp()"},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"bigint","strict":false,"body_md5":"87ad940334ae78be5a3c0b19983d5981","language":"sql","parallel":"u","arguments":"p_prompt_tokens integer, p_output_tokens integer","leakproof":false,"signature":"private.ai_test_price_microusd(integer,integer)","volatility":"i","security_definer":true,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"bigint","strict":true,"body_md5":"2dde6ad2462255b188e4f03ffe88edcd","language":"sql","parallel":"u","arguments":"a uuid","leakproof":false,"signature":"private.closure_account_key(uuid)","volatility":"i","security_definer":false,"argument_defaults":null},{"acl":"{postgres=X/postgres}","cost":100,"kind":"f","rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"boolean","strict":false,"body_md5":"f4999250c315e0253374d4611291c7ad","language":"sql","parallel":"u","arguments":"a uuid","leakproof":false,"signature":"private.closure_account_restricted(uuid)","volatility":"s","security_definer":true,"argument_defaults":null}]$r06_function_data$::jsonb) LOOP
  SELECT jsonb_build_object('signature',expected->>'signature','body_md5',md5(p.prosrc),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'security_definer',p.prosecdef,
 'config',p.proconfig,'language',l.lanname,'volatility',p.provolatile,'strict',p.proisstrict,
 'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'cost',p.procost,'rows',p.prorows,
 'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'argument_defaults',pg_get_expr(p.proargdefaults,0),'definition',pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(expected->>'signature') INTO actual;
  IF (actual-'definition') IS DISTINCT FROM (expected-'definition')
  THEN RAISE EXCEPTION 'R06_DEV_POSTIMAGE_FUNCTION_DRIFT:%',expected->>'signature' USING errcode='55000'; END IF;
 END LOOP;
END $r06_functions$;
DO $r06_tables$ DECLARE expected jsonb; actual jsonb; additions jsonb; shape text; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements($r06_table_data$[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"client_request_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"turn_id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"request_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"state","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"context_hash","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"attempt_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"name":"lease_expires_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""},{"name":"receipt","type":"jsonb","default":null,"identity":"","not_null":false,"generated":""},{"name":"attempt_times","type":"timestamp with time zone[]","default":"'{}'::timestamp with time zone[]","identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"provider_dispatched","type":"boolean","default":"false","identity":"","not_null":true,"generated":""},{"name":"cancelled_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""}],"policies":[],"relation":"private.ai_need_turn_commands","triggers":[{"name":"pre_v3_closure_ai_command","enabled":"O","function":"private.closure_guard_owned_write()","internal":false,"definition":"CREATE TRIGGER pre_v3_closure_ai_command BEFORE INSERT OR UPDATE ON private.ai_need_turn_commands FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write('ACCOUNT', 'account_id')"}],"force_rls":true,"constraints":[{"name":"ai_need_turn_cancelled_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cancelled_at IS NULL OR state = 'FAILED'::text AND receipt IS NULL)"},{"name":"ai_need_turn_commands_attempt_times_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cardinality(attempt_times) <= 6)"},{"name":"ai_need_turn_commands_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((state = 'SUCCEEDED'::text) = (receipt IS NOT NULL))"},{"name":"ai_need_turn_commands_check1","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state <> 'PROCESSING'::text OR attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL AND context_hash IS NOT NULL)"},{"name":"ai_need_turn_commands_context_hash_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (context_hash IS NULL OR context_hash ~ '^[0-9a-f]{64}$'::text)"},{"name":"ai_need_turn_commands_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (account_id, client_request_id)"},{"name":"ai_need_turn_commands_receipt_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (receipt IS NULL OR jsonb_typeof(receipt) = 'object'::text AND octet_length(receipt::text) <= 4096)"},{"name":"ai_need_turn_commands_request_hash_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (request_hash ~ '^[0-9a-f]{64}$'::text)"},{"name":"ai_need_turn_commands_state_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text]))"},{"name":"ai_need_turn_commands_turn_id_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (turn_id)"}]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"turn_id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"client_request_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"body_hash","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"source_revision","type":"integer","default":null,"identity":"","not_null":true,"generated":""},{"name":"attempt_id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"state","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"lease_expires_at","type":"timestamp with time zone","default":null,"identity":"","not_null":true,"generated":""},{"name":"completion_hash","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"provider_dispatched","type":"boolean","default":"false","identity":"","not_null":true,"generated":""},{"name":"cancelled_at","type":"timestamp with time zone","default":null,"identity":"","not_null":false,"generated":""},{"name":"user_message_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""}],"policies":[],"relation":"private.worker_ai_turns","triggers":[],"force_rls":false,"constraints":[{"name":"worker_ai_turn_cancelled_fence","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (cancelled_at IS NULL OR state = 'FAILED'::text AND completion_hash IS NULL)"},{"name":"worker_ai_turns_account_id_client_request_id_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (account_id, client_request_id)"},{"name":"worker_ai_turns_conversation_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (conversation_id) REFERENCES private.worker_ai_sessions(conversation_id)"},{"name":"worker_ai_turns_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (turn_id)"},{"name":"worker_ai_turns_state_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text]))"}]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"owner":"postgres","columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"hold_key","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":false,"generated":""},{"name":"active","type":"boolean","default":null,"identity":"","not_null":true,"generated":""},{"name":"revision","type":"bigint","default":null,"identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","identity":"","not_null":true,"generated":""}],"policies":[],"relation":"private.retention_holds","triggers":[{"name":"media_hold_evidence_v5","enabled":"O","function":"private.capture_case_media_trigger_v5()","internal":false,"definition":"CREATE TRIGGER media_hold_evidence_v5 AFTER INSERT OR UPDATE ON private.retention_holds FOR EACH ROW EXECUTE FUNCTION private.capture_case_media_trigger_v5()"}],"force_rls":true,"constraints":[{"name":"retention_holds_account_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"retention_holds_account_id_hold_key_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (account_id, hold_key)"},{"name":"retention_holds_hold_key_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (char_length(hold_key) >= 8 AND char_length(hold_key) <= 128)"},{"name":"retention_holds_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"retention_holds_revision_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (revision > 0)"}]},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"owner":"postgres","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","identity":"","not_null":true,"generated":""},{"name":"sequence_no","type":"bigint","default":null,"identity":"a","not_null":true,"generated":""},{"name":"account_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"conversation_id","type":"uuid","default":null,"identity":"","not_null":true,"generated":""},{"name":"role","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"body","type":"text","default":null,"identity":"","not_null":true,"generated":""},{"name":"safety","type":"text","default":null,"identity":"","not_null":false,"generated":""},{"name":"proposed_fact_ids","type":"uuid[]","default":"'{}'::uuid[]","identity":"","not_null":true,"generated":""},{"name":"created_at","type":"timestamp with time zone","default":"statement_timestamp()","identity":"","not_null":true,"generated":""}],"policies":[{"name":"ai_messages_own_read","check":null,"roles":["authenticated"],"using":"(account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":["authenticated"],"using":"public.rpc_storage_account_open()","command":"r","permissive":false}],"relation":"public.ai_messages","triggers":[{"name":"guard_retention_ai_messages_trg","enabled":"O","function":"private.guard_retention_ai_child()","internal":false,"definition":"CREATE TRIGGER guard_retention_ai_messages_trg BEFORE INSERT OR DELETE OR UPDATE ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION private.guard_retention_ai_child()"},{"name":"pre_v3_closure_ai_message","enabled":"O","function":"private.closure_guard_owned_write()","internal":false,"definition":"CREATE TRIGGER pre_v3_closure_ai_message BEFORE INSERT ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write('CONVERSATION', 'conversation_id')"}],"force_rls":false,"constraints":[{"name":"ai_messages_account_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"ai_messages_body_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 4000)"},{"name":"ai_messages_conversation_id_fkey","type":"f","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE"},{"name":"ai_messages_pkey","type":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"ai_messages_role_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (role = ANY (ARRAY['USER'::text, 'ASSISTANT'::text]))"},{"name":"ai_messages_safety_check","type":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (safety IS NULL OR (safety = ANY (ARRAY['ALLOW'::text, 'CLARIFY'::text, 'REVIEW'::text, 'BLOCK'::text])))"},{"name":"ai_messages_sequence_no_key","type":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (sequence_no)"}]}]$r06_table_data$::jsonb) LOOP
  SELECT jsonb_build_object(
 'relation',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
 'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'definition',pg_get_constraintdef(x.oid,true),'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled,'internal',t.tgisinternal,'function',t.tgfoid::regprocedure::text) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid)
 ) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass(expected->>'relation') INTO actual;
  IF expected->>'relation'=ANY(ARRAY['private.ai_need_turn_commands','private.worker_ai_turns']) THEN
  SELECT jsonb_agg(value ORDER BY ordinality) INTO additions FROM jsonb_array_elements(actual->'columns') WITH ORDINALITY WHERE value->>'name'=ANY(ARRAY['prepared_input','prepared_input_sha256','prepared_at','prepared_reservation_id']);
  IF additions IS DISTINCT FROM $r06_columns$[{"name":"prepared_input","type":"jsonb","not_null":false,"default":null,"identity":"","generated":""},{"name":"prepared_input_sha256","type":"text","not_null":false,"default":null,"identity":"","generated":""},{"name":"prepared_at","type":"timestamp with time zone","not_null":false,"default":null,"identity":"","generated":""},{"name":"prepared_reservation_id","type":"uuid","not_null":false,"default":null,"identity":"","generated":""}]$r06_columns$::jsonb THEN RAISE EXCEPTION 'R06_DEV_ADDED_COLUMN_DRIFT:%',expected->>'relation'; END IF;
  SELECT pg_get_constraintdef(oid) INTO shape FROM pg_constraint WHERE conrelid=to_regclass(expected->>'relation') AND conname='r06_prepared_input_shape' AND contype='c' AND convalidated;
  IF shape IS NULL OR md5(shape) IS DISTINCT FROM '5e2c512104597153b399405de57b9a21'
  THEN RAISE EXCEPTION 'R06_DEV_CONSTRAINT_DRIFT:%',expected->>'relation'; END IF;
  actual:=jsonb_set(actual,'{columns}',(SELECT jsonb_agg(value ORDER BY ordinality) FROM jsonb_array_elements(actual->'columns') WITH ORDINALITY WHERE NOT(value->>'name'=ANY(ARRAY['prepared_input','prepared_input_sha256','prepared_at','prepared_reservation_id']))));
  actual:=jsonb_set(actual,'{constraints}',(SELECT coalesce(jsonb_agg(value ORDER BY value->>'name'),'[]'::jsonb) FROM jsonb_array_elements(actual->'constraints') WHERE value->>'name'<>'r06_prepared_input_shape'));
  END IF;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R06_DEV_TABLE_DRIFT:%',expected->>'relation' USING errcode='55000'; END IF;
 END LOOP;
END $r06_tables$;
DO $r06_new$ DECLARE item record; p pg_proc%rowtype; BEGIN
 FOR item IN SELECT * FROM (VALUES ('private.r06_prepared_input_owner_v1(uuid,uuid,uuid,text)','23a586e503f7a35d8e59862fbfd3f978','{postgres=X/postgres}'),('public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)','01a90ce540fef339484325d63c3312c2','{postgres=X/postgres,service_role=X/postgres}'),('public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)','d4181201ee4c2704b225f50b8ab878f9','{postgres=X/postgres,service_role=X/postgres}'),('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)','8b57176c233118baea5981673a0c0920','{postgres=X/postgres,service_role=X/postgres}')) AS x(signature,body_md5,acl) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(item.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM item.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR p.proacl::text IS DISTINCT FROM item.acl OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u' OR p.prokind<>'f' OR p.provolatile<>'v'
   OR p.prorettype<>'jsonb'::regtype OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   OR p.provariadic<>0 OR p.pronargdefaults<>0
  THEN RAISE EXCEPTION 'R06_DEV_NEW_FUNCTION_DRIFT:%',item.signature; END IF;
 END LOOP;
END $r06_new$;
SELECT 'R06_DEV_INSTALLED_DORMANT_ONLY' AS status;
COMMIT;
