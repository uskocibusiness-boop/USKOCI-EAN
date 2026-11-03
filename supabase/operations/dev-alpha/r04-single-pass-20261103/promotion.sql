BEGIN;
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
LOCK TABLE private.ai_need_turn_commands,private.work_taxonomy_aliases,private.work_taxonomy_audit,private.work_taxonomy_categories,private.work_taxonomy_category_modes,private.work_taxonomy_control,private.work_taxonomy_gemini_turn_hints_v1,private.worker_ai_sessions,private.worker_ai_turns IN SHARE ROW EXCLUSIVE MODE;
DO $pre$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'SINGLE_PASS_CONTEXT_REFUSED';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.ai_need_turn_status(uuid, uuid, uuid)')
 AND p.oid=22490
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5005a5ed32bd85188d22cc4ca80c03dd'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.ai_need_turn_status(uuid, uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_inventory_v1()')
 AND p.oid=32209
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='775a1017ec3ddd954690daa6f8b5e500'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_inventory_v1()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_project_v1(text, jsonb, uuid)')
 AND p.oid=32220
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='82340ba6e71035dfdebd77666138c186'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_project_v1(text, jsonb, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_reset_sections_v1()')
 AND p.oid=32211
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='cca95a4042bca96ea1989559f907ce0e'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_reset_sections_v1()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text, jsonb, jsonb, uuid, uuid)')
 AND p.oid=31025
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5ffabf081a7d0eebffe8c3d9767de921'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_review_candidate_projection_v2(text, jsonb, jsonb, uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_risk_triage_v1(text)')
 AND p.oid=28782
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='43422a711aeaca57d4b78e3d55b3333a'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_risk_triage_v1(text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_service_mode_context_v1(uuid, uuid)')
 AND p.oid=31166
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5bf382a91bc8256cc79bd803b38cd086'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_ai_service_mode_context_v1(uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_turn_document(uuid)')
 AND p.oid=23021
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='dcee2f26162a5ac3f9b86990b1838fa3'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_ai_turn_document(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_remote_review_ready_v1(jsonb)')
 AND p.oid=33217
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='77338f594bf811ee41dc43b3e60b0483'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_remote_review_ready_v1(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_location_turn_v1_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)')
 AND p.oid=27168
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='10d26307c5a7ef4c16940fa8e54d4d64'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_location_turn_v1_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid, uuid, uuid, uuid, text, text, text, jsonb)')
 AND p.oid=22494
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='b867f1c7289fb7513f5acec4a050b8c8'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_turn_v2_service(uuid, uuid, uuid, uuid, text, text, text, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_ai_turn_service(uuid, uuid, uuid, uuid, jsonb)')
 AND p.oid=23027
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5f0b6545dcde28bf2fcb4ea0f0393458'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_complete_worker_ai_turn_service(uuid, uuid, uuid, uuid, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid, integer, boolean)')
 AND p.oid=29395
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='ce552930610ca92eff0e8befa0a2c00b'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_prepare_worker_ai_review_taxonomy(uuid, integer, boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid, integer, boolean, jsonb)')
 AND p.oid=30965
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='2c9a6526f65cfa6a5b1dd14bdc3b9491'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid, integer, boolean, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)')
 AND p.oid=29357
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='c363facdb26d33ae872e25e6a79e4306'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)'; END IF;
IF (SELECT capture->'tables' FROM (SELECT jsonb_build_object(
'project_ref','leqcwgzvjsxugfgzdmth',
'captured_at',clock_timestamp(),'server_version_num',current_setting('server_version_num'),'role',current_user,
'closure',jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),
'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),
'erasure_binding',private.closure_erasure_binding_v5(),'export_binding',private.data_export_policy_binding()),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.name,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
'not_null',a.attnotnull,'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(x.oid) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname||'.'||p.tablename=n.name),
'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function_md5',md5(replace(pg_get_functiondef(t.tgfoid),chr(13),''))) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))
ORDER BY n.name) FROM (VALUES('private.work_taxonomy_gemini_turn_hints_v1'),('private.work_taxonomy_control'),('private.work_taxonomy_categories'),
('private.work_taxonomy_category_modes'),('private.work_taxonomy_aliases'),('private.work_taxonomy_audit'),
('private.ai_need_turn_commands'),('private.worker_ai_sessions'),('private.worker_ai_turns')) n(name)
JOIN pg_class c ON c.oid=to_regclass(n.name))) AS capture) x) IS DISTINCT FROM '[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.ai_need_turn_commands","owner":"postgres","columns":[{"acl":null,"name":"account_id","type":"uuid","not_null":true},{"acl":null,"name":"client_request_id","type":"uuid","not_null":true},{"acl":null,"name":"conversation_id","type":"uuid","not_null":true},{"acl":null,"name":"turn_id","type":"uuid","not_null":true},{"acl":null,"name":"request_hash","type":"text","not_null":true},{"acl":null,"name":"state","type":"text","not_null":true},{"acl":null,"name":"context_hash","type":"text","not_null":false},{"acl":null,"name":"attempt_id","type":"uuid","not_null":false},{"acl":null,"name":"lease_expires_at","type":"timestamp with time zone","not_null":false},{"acl":null,"name":"receipt","type":"jsonb","not_null":false},{"acl":null,"name":"attempt_times","type":"timestamp with time zone[]","not_null":true},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true},{"acl":null,"name":"updated_at","type":"timestamp with time zone","not_null":true},{"acl":null,"name":"provider_dispatched","type":"boolean","not_null":true},{"acl":null,"name":"cancelled_at","type":"timestamp with time zone","not_null":false}],"policies":null,"triggers":[{"enabled":"O","definition":"CREATE TRIGGER pre_v3_closure_ai_command BEFORE INSERT OR UPDATE ON private.ai_need_turn_commands FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')","function_md5":"331b1d322cee8e46a0b155524932861b"}],"force_rls":true,"constraints":["CHECK (((cancelled_at IS NULL) OR ((state = ''FAILED''::text) AND (receipt IS NULL))))","CHECK ((cardinality(attempt_times) <= 6))","CHECK (((state = ''SUCCEEDED''::text) = (receipt IS NOT NULL)))","CHECK (((state <> ''PROCESSING''::text) OR ((attempt_id IS NOT NULL) AND (lease_expires_at IS NOT NULL) AND (context_hash IS NOT NULL))))","CHECK (((context_hash IS NULL) OR (context_hash ~ ''^[0-9a-f]{64}$''::text)))","PRIMARY KEY (account_id, client_request_id)","CHECK (((receipt IS NULL) OR ((jsonb_typeof(receipt) = ''object''::text) AND (octet_length((receipt)::text) <= 4096))))","CHECK ((request_hash ~ ''^[0-9a-f]{64}$''::text))","CHECK ((state = ANY (ARRAY[''PROCESSING''::text, ''SUCCEEDED''::text, ''FAILED''::text])))","UNIQUE (turn_id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_aliases","owner":"postgres","columns":[{"acl":null,"name":"id","type":"bigint","not_null":true},{"acl":null,"name":"category_id","type":"uuid","not_null":true},{"acl":null,"name":"locale","type":"text","not_null":true},{"acl":null,"name":"label","type":"text","not_null":true},{"acl":null,"name":"normalized_key","type":"text","not_null":false},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":null,"force_rls":false,"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","CHECK ((locale ~ ''^[a-z]{2}(-[A-Z]{2})?$''::text))","UNIQUE (locale, normalized_key)","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_audit","owner":"postgres","columns":[{"acl":null,"name":"id","type":"bigint","not_null":true},{"acl":null,"name":"action","type":"text","not_null":true},{"acl":null,"name":"category_id","type":"uuid","not_null":false},{"acl":null,"name":"normalized_key","type":"text","not_null":true},{"acl":null,"name":"catalog_version","type":"bigint","not_null":true},{"acl":null,"name":"source_ref","type":"text","not_null":false},{"acl":null,"name":"at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":null,"force_rls":false,"constraints":["CHECK ((action = ANY (ARRAY[''AUTO_CREATED''::text, ''EXISTING_REUSED''::text, ''ALIAS_COLLISION''::text, ''CORRECTED''::text, ''RETIRED''::text, ''MERGED''::text])))","FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id)","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_categories","owner":"postgres","columns":[{"acl":null,"name":"id","type":"uuid","not_null":true},{"acl":null,"name":"canonical_key","type":"text","not_null":true},{"acl":null,"name":"label","type":"text","not_null":true},{"acl":null,"name":"parent_id","type":"uuid","not_null":false},{"acl":null,"name":"state","type":"text","not_null":true},{"acl":null,"name":"source","type":"text","not_null":true},{"acl":null,"name":"catalog_version","type":"bigint","not_null":true},{"acl":null,"name":"superseded_by","type":"uuid","not_null":false},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true},{"acl":null,"name":"updated_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":[{"enabled":"O","definition":"CREATE TRIGGER taxonomy_guard_parent_move BEFORE UPDATE OF parent_id ON private.work_taxonomy_categories FOR EACH ROW EXECUTE FUNCTION private.taxonomy_guard_parent_move_v1()","function_md5":"b0f59e4b13e72d97132490fa237ba90c"}],"force_rls":false,"constraints":["CHECK (((char_length(canonical_key) >= 3) AND (char_length(canonical_key) <= 160)))","UNIQUE (canonical_key)","CHECK ((catalog_version > 0))","CHECK (((superseded_by IS NULL) OR (superseded_by <> id)))","CHECK (((parent_id IS NULL) OR (parent_id <> id)))","CHECK ((canonical_key = private.taxonomy_normalize_v1(label)))","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","FOREIGN KEY (parent_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","PRIMARY KEY (id)","CHECK ((source = ANY (ARRAY[''SYSTEM''::text, ''AI_REVIEWED''::text, ''OPERATOR''::text])))","CHECK ((state = ANY (ARRAY[''AUTO_PROVISIONAL''::text, ''ESTABLISHED''::text, ''RETIRED''::text])))","FOREIGN KEY (superseded_by) REFERENCES private.work_taxonomy_categories(id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_category_modes","owner":"postgres","columns":[{"acl":null,"name":"category_id","type":"uuid","not_null":true},{"acl":null,"name":"execution_scope","type":"text","not_null":true},{"acl":null,"name":"source_ref","type":"text","not_null":true},{"acl":null,"name":"mapped_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":null,"force_rls":false,"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK ((execution_scope = ANY (ARRAY[''ON_SITE''::text, ''REMOTE''::text])))","PRIMARY KEY (category_id, execution_scope)","CHECK (((char_length(source_ref) >= 3) AND (char_length(source_ref) <= 120)))"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_control","owner":"postgres","columns":[{"acl":null,"name":"singleton","type":"boolean","not_null":true},{"acl":null,"name":"auto_registration_enabled","type":"boolean","not_null":true},{"acl":null,"name":"max_auto_creates_per_hour","type":"integer","not_null":true},{"acl":null,"name":"catalog_version","type":"bigint","not_null":true},{"acl":null,"name":"updated_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":null,"force_rls":false,"constraints":["CHECK ((catalog_version > 0))","CHECK (((max_auto_creates_per_hour >= 1) AND (max_auto_creates_per_hour <= 10000)))","PRIMARY KEY (singleton)","CHECK (singleton)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.work_taxonomy_gemini_turn_hints_v1","owner":"postgres","columns":[{"acl":null,"name":"id","type":"uuid","not_null":true},{"acl":null,"name":"purpose","type":"text","not_null":true},{"acl":null,"name":"account_id","type":"uuid","not_null":true},{"acl":null,"name":"conversation_id","type":"uuid","not_null":true},{"acl":null,"name":"client_request_id","type":"uuid","not_null":true},{"acl":null,"name":"turn_id","type":"uuid","not_null":true},{"acl":null,"name":"attempt_id","type":"uuid","not_null":true},{"acl":null,"name":"source_fingerprint","type":"text","not_null":true},{"acl":null,"name":"catalog_version","type":"bigint","not_null":true},{"acl":null,"name":"proposals","type":"jsonb","not_null":true},{"acl":null,"name":"payload_digest","type":"text","not_null":true},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":[{"enabled":"O","definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_gemini_turn_hints_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''account_id'')","function_md5":"4f8e522641d38d2795dd00b45a00f62b"},{"enabled":"O","definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_gemini_turn_hints_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')","function_md5":"331b1d322cee8e46a0b155524932861b"}],"force_rls":false,"constraints":["UNIQUE (purpose, account_id, turn_id)","CHECK ((catalog_version > 0))","CHECK ((payload_digest ~ ''^[a-f0-9]{64}$''::text))","PRIMARY KEY (id)","CHECK (((jsonb_typeof(proposals) = ''array''::text) AND ((jsonb_array_length(proposals) >= 1) AND (jsonb_array_length(proposals) <= 24))))","CHECK ((purpose = ANY (ARRAY[''WORKER_CAPABILITY''::text, ''NEED_SERVICE''::text])))","CHECK ((source_fingerprint ~ ''^[a-f0-9]{64}$''::text))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_sessions","owner":"postgres","columns":[{"acl":null,"name":"conversation_id","type":"uuid","not_null":true},{"acl":null,"name":"account_id","type":"uuid","not_null":true},{"acl":null,"name":"open_request_id","type":"uuid","not_null":true},{"acl":null,"name":"profile_id","type":"uuid","not_null":true},{"acl":null,"name":"base_hash","type":"text","not_null":true},{"acl":null,"name":"candidate","type":"jsonb","not_null":true},{"acl":null,"name":"revision","type":"integer","not_null":true},{"acl":null,"name":"safety","type":"text","not_null":true},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true}],"policies":null,"triggers":null,"force_rls":false,"constraints":["UNIQUE (account_id, open_request_id)","CHECK ((octet_length((candidate)::text) <= 524288))","PRIMARY KEY (conversation_id)","CHECK ((revision >= 0))","CHECK ((safety = ANY (ARRAY[''ALLOW''::text, ''CLARIFY''::text, ''REVIEW''::text, ''BLOCK''::text])))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_turns","owner":"postgres","columns":[{"acl":null,"name":"turn_id","type":"uuid","not_null":true},{"acl":null,"name":"account_id","type":"uuid","not_null":true},{"acl":null,"name":"conversation_id","type":"uuid","not_null":true},{"acl":null,"name":"client_request_id","type":"uuid","not_null":true},{"acl":null,"name":"body_hash","type":"text","not_null":true},{"acl":null,"name":"source_revision","type":"integer","not_null":true},{"acl":null,"name":"attempt_id","type":"uuid","not_null":true},{"acl":null,"name":"state","type":"text","not_null":true},{"acl":null,"name":"lease_expires_at","type":"timestamp with time zone","not_null":true},{"acl":null,"name":"completion_hash","type":"text","not_null":false},{"acl":null,"name":"created_at","type":"timestamp with time zone","not_null":true},{"acl":null,"name":"provider_dispatched","type":"boolean","not_null":true},{"acl":null,"name":"cancelled_at","type":"timestamp with time zone","not_null":false},{"acl":null,"name":"user_message_id","type":"uuid","not_null":false}],"policies":null,"triggers":null,"force_rls":false,"constraints":["CHECK (((cancelled_at IS NULL) OR ((state = ''FAILED''::text) AND (completion_hash IS NULL))))","UNIQUE (account_id, client_request_id)","FOREIGN KEY (conversation_id) REFERENCES private.worker_ai_sessions(conversation_id)","PRIMARY KEY (turn_id)","CHECK ((state = ANY (ARRAY[''PROCESSING''::text, ''SUCCEEDED''::text, ''FAILED''::text])))"]}]'::jsonb THEN RAISE EXCEPTION 'SINGLE_PASS_RELATION_DRIFT';END IF;
IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='private.work_taxonomy_gemini_turn_hints_v1'::regclass AND attname='catalog_resolution' AND NOT attisdropped)
 OR to_regclass('private.work_taxonomy_turn_hints_resolved_v1') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_ALREADY_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_first_plan_complete_receipt_v1(uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_first_plan_input_digest_v1(text, jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_first_plan_lock_v1(uuid, uuid, uuid, uuid, text)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_resolve_turn_catalog_v1(uuid, text, jsonb, text)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('private.taxonomy_turn_category_identity_v1(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('public.rpc_ai_complete_need_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('public.rpc_ai_read_first_plan_completion_service(text, jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
IF to_regprocedure('public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid, uuid, uuid, uuid, jsonb, jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;
 IF (SELECT capture->'closure' FROM (SELECT jsonb_build_object(
'project_ref','leqcwgzvjsxugfgzdmth',
'captured_at',clock_timestamp(),'server_version_num',current_setting('server_version_num'),'role',current_user,
'closure',jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),
'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),
'erasure_binding',private.closure_erasure_binding_v5(),'export_binding',private.data_export_policy_binding()),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.name,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
'not_null',a.attnotnull,'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(x.oid) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname||'.'||p.tablename=n.name),
'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function_md5',md5(replace(pg_get_functiondef(t.tgfoid),chr(13),''))) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))
ORDER BY n.name) FROM (VALUES('private.work_taxonomy_gemini_turn_hints_v1'),('private.work_taxonomy_control'),('private.work_taxonomy_categories'),
('private.work_taxonomy_category_modes'),('private.work_taxonomy_aliases'),('private.work_taxonomy_audit'),
('private.ai_need_turn_commands'),('private.worker_ai_sessions'),('private.worker_ai_turns')) n(name)
JOIN pg_class c ON c.oid=to_regclass(n.name))) AS capture) x) IS DISTINCT FROM '{"schema":"6603130dcd5df2f0493668e318eee0caffe4c7c249e0f15d6b108537caf2cbe9","source":"da67d3b605b7d5b7e3af8d3264bc55aa87d7249c61436e3ef9d17d5791237a81","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'SINGLE_PASS_CLOSURE_DRIFT';END IF;
 END;$pre$;
ALTER TABLE private.work_taxonomy_gemini_turn_hints_v1 ADD COLUMN catalog_resolution jsonb CHECK (((catalog_resolution IS NULL) OR ((jsonb_typeof(catalog_resolution) = 'object'::text) AND (pg_column_size(catalog_resolution) <= 12000) AND ((catalog_resolution ->> 'state'::text) = ANY (ARRAY['RESOLVED'::text, 'DEFERRED'::text])) AND ((catalog_resolution ->> 'inputDigest'::text) ~ '^[0-9a-f]{64}$'::text))));
 CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_complete_receipt_v1(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_purpose text, p_safety text, p_turn jsonb, p_taxonomy_plan jsonb, p_completion_digest text, p_was_completed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE; captured jsonb;resolved jsonb;
 v_turn_id uuid;v_version bigint;v_proposals jsonb;v_digest text;
 v_input_digest text;
 v_category jsonb;v_geography jsonb;v_handoff jsonb;v_mode text;v_count integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_turn->>'conversationId' IS DISTINCT FROM p_conversation_id::text
 OR p_turn->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text
 OR (p_purpose='WORKER_CAPABILITY' AND p_turn->>'attemptId' IS DISTINCT FROM p_attempt_id::text) THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_turn->>'state' IS DISTINCT FROM 'SUCCEEDED' THEN
  RETURN jsonb_build_object('state','NOT_ELIGIBLE','authority','NONE'); END IF;
 v_turn_id:=(p_turn->>'turnId')::uuid;
 IF v_turn_id IS NULL OR p_was_completed IS NULL OR p_completion_digest IS NULL
 OR p_completion_digest !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 -- Need's public receipt deliberately has no attemptId. Bind it to the exact
 -- durable command instead of demanding a Worker-only field from the receipt.
 IF p_purpose='NEED_SERVICE' THEN
  IF NOT EXISTS(SELECT 1 FROM private.ai_need_turn_commands t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  IF NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.worker_ai_turn_document(v_turn_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF p_purpose='NEED_SERVICE' AND p_turn#>>'{receipt,safety}' IS DISTINCT FROM p_safety THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_SAFETY_INVALID' USING errcode='22023'; END IF;
 IF jsonb_typeof(p_taxonomy_plan) IS DISTINCT FROM 'object'
 OR NOT(p_taxonomy_plan ?& array['catalogVersion','proposals','anchors'])
 OR p_taxonomy_plan-array['catalogVersion','proposals','anchors']<>'{}'::jsonb
 OR jsonb_typeof(p_taxonomy_plan->'catalogVersion') IS DISTINCT FROM 'number'
 OR (p_taxonomy_plan->>'catalogVersion') !~ '^[1-9][0-9]*$'
 OR jsonb_typeof(p_taxonomy_plan->'proposals') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_taxonomy_plan->'anchors') IS DISTINCT FROM 'array'
 OR pg_column_size(p_taxonomy_plan)>18000 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_version:=(p_taxonomy_plan->>'catalogVersion')::bigint;
 v_proposals:=p_taxonomy_plan->'proposals';
 IF jsonb_array_length(v_proposals)<1 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_digest:=encode(extensions.digest(v_proposals::text,'sha256'),'hex');
 v_input_digest:=encode(extensions.digest(p_taxonomy_plan::text,'sha256'),'hex');
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 IF FOUND THEN
  IF h.conversation_id IS DISTINCT FROM p_conversation_id
  OR h.client_request_id IS DISTINCT FROM p_client_request_id
  OR h.attempt_id IS DISTINCT FROM p_attempt_id
  OR h.catalog_version IS DISTINCT FROM v_version OR h.payload_digest IS DISTINCT FROM v_digest
  OR h.proposals IS DISTINCT FROM v_proposals THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  -- A legacy completed hint cannot acquire new catalog authority on replay.
  IF h.catalog_resolution IS NULL THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
  IF h.catalog_resolution->>'inputDigest' IS DISTINCT FROM v_input_digest
  OR h.catalog_resolution->>'completionDigest' IS DISTINCT FROM p_completion_digest THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  resolved:=h.catalog_resolution;
  RETURN jsonb_build_object('state',resolved->>'state','authority',
   CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
   ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
 END IF;
 IF p_was_completed THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
 IF p_purpose='NEED_SERVICE' THEN
  SELECT count(*) INTO v_count FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  IF v_count<>1 OR jsonb_array_length(v_proposals)<>1 THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
  SELECT fact_value INTO v_category FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  SELECT fact_value INTO v_geography FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.task_geography';
  SELECT fact_value INTO v_handoff FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.handoff';
  v_mode:=CASE WHEN v_geography->>'mode'='REMOTE' THEN 'REMOTE'
   WHEN v_geography->>'mode' IN('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') THEN 'ON_SITE' END;
  IF jsonb_typeof(v_category) IS DISTINCT FROM 'string' OR v_mode IS NULL
  OR private.taxonomy_normalize_v1(v_proposals#>>'{0,service}') IS DISTINCT FROM private.taxonomy_normalize_v1(v_category#>>'{}')
  OR v_proposals#>>'{0,mode}' IS DISTINCT FROM v_mode
  OR coalesce(v_proposals#>'{0,handoff}','null'::jsonb) IS DISTINCT FROM
     coalesce(CASE WHEN v_mode='REMOTE' THEN v_handoff END,'null'::jsonb) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
 END IF;
 -- Existing writer owns bounded shape, USER-offered worker skills, source hash,
 -- completed attempt, lifecycle lock, idempotency and persistent hint storage.
 captured:=public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id,p_conversation_id,
  p_client_request_id,v_turn_id,p_attempt_id,p_purpose,v_version,v_proposals);
 IF captured->>'action' IS DISTINCT FROM 'HINT_CAPTURED' OR captured->>'authority' IS DISTINCT FROM 'NONE' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_CAPTURE_RECEIPT_INVALID' USING errcode='55000'; END IF;
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 resolved:=private.taxonomy_resolve_turn_catalog_v1(h.id,v_input_digest,p_taxonomy_plan->'anchors',p_safety);
 resolved:=resolved||jsonb_build_object('completionDigest',p_completion_digest);
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=resolved WHERE id=h.id;
 RETURN jsonb_build_object('state',resolved->>'state','authority',
  CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
  ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
END; $function$;
REVOKE ALL ON FUNCTION private.taxonomy_first_plan_complete_receipt_v1(uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_input_digest_v1(p_writer text, p_arguments jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT encode(extensions.digest(jsonb_build_object('writer',p_writer,'arguments',
  p_arguments-array['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id'])::text,'sha256'),'hex');
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_first_plan_input_digest_v1(text, jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_lock_v1(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_purpose text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_state text;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR p_client_request_id IS NULL OR p_attempt_id IS NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_purpose='NEED_SERVICE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id FOR UPDATE;
  SELECT state INTO v_state FROM private.ai_need_turn_commands
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
  PERFORM 1 FROM private.worker_ai_sessions WHERE account_id=p_account_id AND conversation_id=p_conversation_id FOR UPDATE;
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id AND purpose='PROFILE' FOR UPDATE;
  SELECT state INTO v_state FROM private.worker_ai_turns
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF v_state IS NULL THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 RETURN v_state='SUCCEEDED';
END; $function$;
REVOKE ALL ON FUNCTION private.taxonomy_first_plan_lock_v1(uuid, uuid, uuid, uuid, text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_resolve_turn_catalog_v1(p_hint_id uuid, p_input_digest text, p_anchors jsonb, p_safety text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 p jsonb;a jsonb;item jsonb;items jsonb:='[]'::jsonb;result jsonb;
 c private.work_taxonomy_categories%ROWTYPE;anchor_id uuid;parent uuid;category uuid;
 version bigint;label text;key text;mode text;action text;identity text;reason text;
 i integer;j integer;matches integer;last_step integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TURN_CATALOG_DENIED' USING errcode='42501'; END IF;
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE id=p_hint_id FOR UPDATE;
 IF NOT FOUND OR p_input_digest IS NULL OR p_input_digest !~ '^[0-9a-f]{64}$'
 OR jsonb_typeof(p_anchors) IS DISTINCT FROM 'array' OR jsonb_array_length(p_anchors)>384 THEN
  RAISE EXCEPTION 'TURN_CATALOG_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(h.account_id);
 IF h.catalog_resolution IS NOT NULL THEN
  IF h.catalog_resolution->>'inputDigest' IS DISTINCT FROM p_input_digest THEN
   RAISE EXCEPTION 'TURN_CATALOG_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  RETURN h.catalog_resolution;
 END IF;
 -- Missing business details can still produce a useful conversation, but a
 -- safety clarification cannot become a global catalog mutation.
 IF p_safety IS DISTINCT FROM 'ALLOW' THEN
  result:=jsonb_build_object('state','DEFERRED','inputDigest',p_input_digest,'code','SAFETY_UNRESOLVED');
 ELSE
  BEGIN
   SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
   IF version IS NULL OR version<h.catalog_version THEN
    RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
   -- Anchors are derived by Edge from its verified snapshot, not the model.
   FOR a IN SELECT value FROM jsonb_array_elements(p_anchors) LOOP
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR NOT(a ?& array['categoryId','label','parentId'])
    OR a-array['categoryId','label','parentId']<>'{}'::jsonb THEN
     RAISE EXCEPTION 'TURN_CATALOG_INVALID_ANCHOR' USING errcode='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories node
     WHERE node.id::text=a->>'categoryId' AND node.state='ESTABLISHED'
      AND to_jsonb(node.label)=a->'label'
      AND coalesce(to_jsonb(node.parent_id),'null'::jsonb)=a->'parentId'
      AND private.taxonomy_turn_category_identity_v1(node.id) IS NOT NULL) THEN
     RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
   END LOOP;
   FOR i IN 0..jsonb_array_length(h.proposals)-1 LOOP
    p:=h.proposals->i;mode:=p->>'mode';action:=p->>'action';
    key:=private.taxonomy_normalize_v1(p->>'service');
    IF private.taxonomy_risk_triage_v1(p->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
     RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
    anchor_id:=CASE WHEN action IN('REUSE_EXISTING','EXTEND_MODE') THEN (p->>'categoryId')::uuid
      WHEN action='CREATE_CHILD' THEN (p->>'parentId')::uuid END;
    IF anchor_id IS NOT NULL THEN
     SELECT count(*) INTO matches FROM jsonb_array_elements(p_anchors) x
      WHERE x->>'categoryId'=anchor_id::text;
     IF matches<>1 THEN RAISE EXCEPTION 'TURN_CATALOG_ANCHOR_MISSING' USING errcode='22023'; END IF;
    END IF;
    IF action IN('REUSE_EXISTING','EXTEND_MODE') THEN
     category:=anchor_id;
     SELECT * INTO c FROM private.work_taxonomy_categories WHERE id=category AND state='ESTABLISHED';
     IF NOT FOUND OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED') THEN
      RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
     IF private.taxonomy_risk_triage_v1(c.label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
      RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
     -- A natural synonym need not be stored as a global alias. An explicit
     -- conflicting canonical identity is not permission to merge two services.
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories other WHERE other.state<>'RETIRED'
       AND other.id<>category AND (other.canonical_key=key OR EXISTS(
        SELECT 1 FROM private.work_taxonomy_aliases alias WHERE alias.category_id=other.id AND alias.normalized_key=key))) THEN
      RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
       WHERE m.category_id=category AND m.execution_scope=mode) THEN
      IF action<>'EXTEND_MODE' THEN RAISE EXCEPTION 'MODE_UNRESOLVED' USING errcode='PT409'; END IF;
      UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
       WHERE singleton RETURNING catalog_version INTO version;
      INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
       VALUES(category,mode,'TURN_CATALOG_V1');
      INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
       VALUES('CORRECTED',category,c.canonical_key,version,'TURN_CATALOG_V1:'||h.id::text);
     END IF;
    ELSIF action IN('CREATE_CHILD','CREATE_NEW_BRANCH') THEN
     parent:=anchor_id;last_step:=jsonb_array_length(p->'proposedPath')-1;
     IF last_step NOT BETWEEN 0 AND 11 OR private.taxonomy_normalize_v1(p->'proposedPath'->>last_step) IS DISTINCT FROM key THEN
      RAISE EXCEPTION 'TURN_CATALOG_INVALID_PATH' USING errcode='22023'; END IF;
     FOR j IN 0..last_step LOOP
      label:=btrim(p->'proposedPath'->>j);key:=private.taxonomy_normalize_v1(label);
      IF jsonb_typeof(p->'proposedPath'->j) IS DISTINCT FROM 'string'
       OR char_length(label) NOT BETWEEN 3 AND 120 OR label ~ '[<>{}\\]' OR label ~ '[[:cntrl:]]'
       OR char_length(key) NOT BETWEEN 3 AND 160 OR key !~ '[[:alpha:]]'
       OR private.taxonomy_risk_triage_v1(label) IN('BLOCKED','REVIEW_REQUIRED')
       OR (j=last_step AND private.taxonomy_risk_triage_v1(label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE') THEN
       RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
      IF EXISTS(SELECT 1 FROM private.work_taxonomy_aliases alias WHERE alias.normalized_key=key) THEN
       RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
      SELECT * INTO c FROM private.work_taxonomy_categories WHERE canonical_key=key FOR UPDATE;
      IF FOUND THEN
       IF c.state<>'ESTABLISHED' OR c.parent_id IS DISTINCT FROM parent THEN
        RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
       category:=c.id;
       IF j=last_step AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
         WHERE m.category_id=category AND m.execution_scope=mode) THEN
        -- BOTH within this turn, or a concurrent creation after the snapshot.
        -- An older known category needs the explicit EXTEND_MODE action.
        IF c.catalog_version<=h.catalog_version THEN
         RAISE EXCEPTION 'MODE_UNRESOLVED' USING errcode='PT409'; END IF;
        UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
         WHERE singleton RETURNING catalog_version INTO version;
        INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(category,mode,'TURN_CATALOG_V1');
        INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('CORRECTED',category,key,version,'TURN_CATALOG_V1:'||h.id::text);
       END IF;
      ELSE
       UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
        WHERE singleton RETURNING catalog_version INTO version;
       INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,state,source,catalog_version)
        VALUES(key,label,parent,'ESTABLISHED','AI_REVIEWED',version) RETURNING id INTO category;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
        VALUES(category,mode,'TURN_CATALOG_V1');
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
        VALUES('AUTO_CREATED',category,key,version,'TURN_CATALOG_V1:'||h.id::text);
      END IF;
      parent:=category;
     END LOOP;
    ELSE RAISE EXCEPTION 'TURN_CATALOG_INVALID_ACTION' USING errcode='22023'; END IF;
    IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=category AND child.state='ESTABLISHED') THEN
     RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
    FOR j IN 0..jsonb_array_length(items)-1 LOOP
     item:=items->j;
     IF (private.taxonomy_normalize_v1(h.proposals->j->>'service')=private.taxonomy_normalize_v1(p->>'service')
          AND item->>'categoryId'<>category::text)
       OR (item->>'categoryId'=category::text AND h.proposals->j->>'mode'=mode) THEN
      RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
    END LOOP;
    identity:=private.taxonomy_turn_category_identity_v1(category);
    IF identity IS NULL THEN RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
    items:=items||jsonb_build_array(jsonb_build_object('categoryId',category,'identity',identity));
   END LOOP;
   -- A later path in this same response must not turn an earlier service into
   -- a grouping node. Roll the entire catalog batch back on that conflict.
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(items) x JOIN private.work_taxonomy_categories child
      ON child.parent_id=(x->>'categoryId')::uuid AND child.state='ESTABLISHED') THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
   result:=jsonb_build_object('state','RESOLVED','inputDigest',p_input_digest,'catalogVersion',version,'items',items);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason NOT IN('CATALOG_CHANGED','CATALOG_CONFLICT','CATALOG_SAFETY','MODE_UNRESOLVED') THEN RAISE; END IF;
   -- This subtransaction rolls back every catalog write, but keeps the owned
   -- dialogue and captured decision. Never spend another Gemini call here.
   result:=jsonb_build_object('state','DEFERRED','inputDigest',p_input_digest,'code',reason);
  END;
 END IF;
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=result WHERE id=h.id;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION private.taxonomy_resolve_turn_catalog_v1(uuid, text, jsonb, text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_resolved_turn_proposals_v1(h private.work_taxonomy_gemini_turn_hints_v1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE version bigint;i integer;p jsonb;item jsonb;v_category_id uuid;answer jsonb:='[]'::jsonb;
BEGIN
 IF h.catalog_resolution IS NULL THEN RETURN h.proposals; END IF;
 IF h.catalog_resolution->>'state' IS DISTINCT FROM 'RESOLVED'
 OR jsonb_array_length(h.catalog_resolution->'items') IS DISTINCT FROM jsonb_array_length(h.proposals) THEN RETURN '[]'::jsonb; END IF;
 SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton;
 IF version IS NULL THEN RETURN '[]'::jsonb; END IF;
 FOR i IN 0..jsonb_array_length(h.proposals)-1 LOOP
  p:=h.proposals->i;item:=h.catalog_resolution->'items'->i;v_category_id:=(item->>'categoryId')::uuid;
  IF private.taxonomy_turn_category_identity_v1(v_category_id) IS DISTINCT FROM item->>'identity'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=v_category_id AND m.execution_scope=p->>'mode')
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=v_category_id AND child.state='ESTABLISHED')
   OR private.taxonomy_risk_triage_v1(p->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c WHERE c.id=v_category_id
      AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE') THEN RETURN '[]'::jsonb; END IF;
  answer:=answer||jsonb_build_array(p||jsonb_build_object('action','REUSE_EXISTING','categoryId',v_category_id,
   'parentId','','proposedPath','[]'::jsonb,'catalogVersion',version));
 END LOOP;
 RETURN answer;
END $function$;
REVOKE ALL ON FUNCTION private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_turn_category_identity_v1(p_category uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 WITH RECURSIVE ancestry AS (
  SELECT c.id,c.label,c.parent_id,ARRAY[c.id] path FROM private.work_taxonomy_categories c
   WHERE c.id=p_category AND c.state='ESTABLISHED'
  UNION ALL
  SELECT c.id,c.label,c.parent_id,a.path||c.id FROM ancestry a
   JOIN private.work_taxonomy_categories c ON c.id=a.parent_id
   WHERE c.state='ESTABLISHED' AND NOT c.id=ANY(a.path)
 ) SELECT CASE WHEN EXISTS(SELECT 1 FROM ancestry WHERE parent_id IS NULL)
  THEN encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(id,label,parent_id)
   ORDER BY cardinality(path)),'[]'::jsonb)::text,'sha256'),'hex') END FROM ancestry;
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_turn_category_identity_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb, p_location_context jsonb, p_location_action text, p_taxonomy_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'NEED_SERVICE');
 completed:=public.rpc_ai_complete_need_location_turn_v1_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals,p_location_context,p_location_action);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed->'turn',p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_ai_complete_need_location_turn_with_first_plan_service',
   jsonb_build_object('p_user_message',p_user_message,'p_assistant_message',p_assistant_message,
    'p_safety',p_safety,'p_proposals',p_proposals,'p_location_context',p_location_context,
    'p_location_action',p_location_action,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb, p_taxonomy_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'NEED_SERVICE');
 completed:=public.rpc_ai_complete_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed,p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_ai_complete_need_turn_with_first_plan_service',
   jsonb_build_object('p_user_message',p_user_message,'p_assistant_message',p_assistant_message,
    'p_safety',p_safety,'p_proposals',p_proposals,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.rpc_ai_read_first_plan_completion_service(p_writer text, p_arguments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE aid uuid;cid uuid;rid uuid;attempt uuid;v_purpose text;fields text[];
 done boolean;v_turn_id uuid;live boolean;completed jsonb;resolved jsonb;receipt jsonb;digest text;
 h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 fields:=array['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id','p_taxonomy_plan'];
 IF p_writer='rpc_complete_worker_ai_turn_with_first_plan_service' THEN
  v_purpose:='WORKER_CAPABILITY';fields:=fields||array['p_output'];
 ELSIF p_writer IN('rpc_ai_complete_need_turn_with_first_plan_service','rpc_ai_complete_need_location_turn_with_first_plan_service') THEN
  v_purpose:='NEED_SERVICE';fields:=fields||array['p_user_message','p_assistant_message','p_safety','p_proposals'];
  IF p_writer='rpc_ai_complete_need_location_turn_with_first_plan_service' THEN
   fields:=fields||array['p_location_context','p_location_action']; END IF;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF jsonb_typeof(p_arguments) IS DISTINCT FROM 'object' OR pg_column_size(p_arguments)>65536
 OR NOT(p_arguments ?& fields) OR p_arguments-fields<>'{}'::jsonb THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 aid:=(p_arguments->>'p_account_id')::uuid;cid:=(p_arguments->>'p_conversation_id')::uuid;
 rid:=(p_arguments->>'p_client_request_id')::uuid;attempt:=(p_arguments->>'p_attempt_id')::uuid;
 done:=private.taxonomy_first_plan_lock_v1(aid,cid,rid,attempt,v_purpose);
 IF v_purpose='NEED_SERVICE' THEN
  SELECT t.turn_id,t.state='PROCESSING' AND t.provider_dispatched AND t.cancelled_at IS NULL
    AND t.lease_expires_at>clock_timestamp() INTO v_turn_id,live
   FROM private.ai_need_turn_commands t WHERE t.account_id=aid AND t.conversation_id=cid
    AND t.client_request_id=rid AND t.attempt_id=attempt;
 ELSE
  SELECT t.turn_id,t.state='PROCESSING' AND t.provider_dispatched AND t.cancelled_at IS NULL
    AND t.lease_expires_at>clock_timestamp() INTO v_turn_id,live
   FROM private.worker_ai_turns t WHERE t.account_id=aid AND t.conversation_id=cid
    AND t.client_request_id=rid AND t.attempt_id=attempt;
 END IF;
 IF NOT done THEN
  RETURN jsonb_build_object('state',CASE WHEN live THEN 'PENDING' ELSE 'STOPPED' END); END IF;
  digest:=private.taxonomy_first_plan_input_digest_v1(p_writer,p_arguments);
  SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1 x
  WHERE x.account_id=aid AND x.conversation_id=cid AND x.client_request_id=rid
   AND x.turn_id=v_turn_id AND x.attempt_id=attempt AND x.purpose=v_purpose;
 IF NOT FOUND OR h.catalog_resolution IS NULL
 OR h.catalog_resolution->>'completionDigest' IS DISTINCT FROM digest THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
 resolved:=h.catalog_resolution;
 IF v_purpose='WORKER_CAPABILITY' THEN completed:=private.worker_ai_turn_document(v_turn_id);
 ELSIF p_writer='rpc_ai_complete_need_location_turn_with_first_plan_service' THEN
  completed:=private.ai_location_turn_document(aid,cid,rid);
 ELSE completed:=private.ai_need_turn_status(aid,cid,rid); END IF;
 receipt:=jsonb_build_object('state',resolved->>'state','authority',
  CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
  ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
 RETURN jsonb_build_object('state','COMPLETED','envelope',jsonb_build_object('completion',completed,'firstPlan',receipt));
END; $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_read_first_plan_completion_service(text, jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_read_first_plan_completion_service(text, jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_output jsonb, p_taxonomy_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'WORKER_CAPABILITY');
 completed:=public.rpc_complete_worker_ai_turn_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,p_output);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'WORKER_CAPABILITY',p_output->>'safety',completed,p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_complete_worker_ai_turn_with_first_plan_service',
   jsonb_build_object('p_output',p_output,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $function$;
REVOKE ALL ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid, uuid, uuid, uuid, jsonb, jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid, uuid, uuid, uuid, jsonb, jsonb) TO service_role;
 CREATE VIEW private.work_taxonomy_turn_hints_resolved_v1 WITH(security_invoker=true) AS  SELECT id,
    purpose,
    account_id,
    conversation_id,
    client_request_id,
    turn_id,
    attempt_id,
    source_fingerprint,
        CASE
            WHEN catalog_resolution IS NOT NULL THEN ( SELECT work_taxonomy_control.catalog_version
               FROM private.work_taxonomy_control
              WHERE work_taxonomy_control.singleton)
            ELSE catalog_version
        END AS catalog_version,
    private.taxonomy_resolved_turn_proposals_v1(h.*) AS proposals,
    payload_digest,
    created_at,
    catalog_resolution
   FROM private.work_taxonomy_gemini_turn_hints_v1 h;
 REVOKE ALL ON private.work_taxonomy_turn_hints_resolved_v1 FROM PUBLIC,anon,authenticated,service_role;
 CREATE OR REPLACE FUNCTION private.closure_taxonomy_inventory_v1()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ SELECT '[{"relation":"private.work_taxonomy_review_outbox_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyQueue","ownerColumn":"owner_account_id","fields":["id","request_key","source_review_id","purpose","plans","state","binding_state","error_code","binding_error_code","result","binding_result","created_at","updated_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_pending_reviews_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyPendingReviews","ownerColumn":"owner_account_id","fields":["id","request_key","source_review_id","purpose","classification_state","resolution_state","saved_at","created_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_gemini_turn_hints_v1","dataClass":"AI_VOLATILE","key":"taxonomyTurnProposals","ownerColumn":"account_id","fields":["id","purpose","conversation_id","client_request_id","turn_id","proposals","catalog_version","catalog_resolution","created_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_admissions_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyAdmissions","ownerColumn":"owner_account_id","fields":["id","request_key","purpose","source_review_id","plan","status","result","approved_at","committed_at","created_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_review_batches_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyReviewedBatches","ownerColumn":"owner_account_id","fields":["id","request_key","purpose","source_review_id","plans","catalog_version","result","committed_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_related_acceptances","dataClass":"PROFILE_DATA","key":"taxonomyRelatedConsent","ownerColumn":"worker_account_id","fields":["source_category_id","target_category_id","explicitly_confirmed_at","relationship_version"],"mode":"ACCOUNT"},{"relation":"private.taxonomy_confirmed_worker_modes_v1","dataClass":"PROFILE_DATA","key":"taxonomyServiceModes","ownerColumn":"worker_account_id","fields":["category_id","execution_scope","source_review_id","source_request_key","confirmed_at","active","handoff"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_worker_capabilities","dataClass":"PROFILE_DATA","key":"taxonomyCapabilities","ownerColumn":"worker_account_id","fields":["category_id","confirmed_at","allow_related_offers","excluded","origin","updated_at"],"mode":"ACCOUNT"},{"relation":"private.worker_execution_mode_choices","dataClass":"PROFILE_DATA","key":"workerModeConsent","ownerColumn":"worker_account_id","fields":["worker_profile_id","modes","consent_source","confirmed_at","updated_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_need_skills","dataClass":"NEED_PUBLIC","key":"taxonomyTaskSkills","ownerColumn":"need_id","fields":["need_id","need_revision","category_id"],"mode":"NEED"},{"relation":"private.work_taxonomy_need_snapshots","dataClass":"NEED_PUBLIC","key":"taxonomyTaskSnapshots","ownerColumn":"need_id","fields":["need_id","need_revision","category_id","catalog_version","reviewed_by_requester","source","classification_state","original_category","created_at"],"mode":"NEED"},{"relation":"private.work_taxonomy_need_bindings_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyTaskBindings","ownerColumn":"owner_account_id","fields":["request_key","source_review_id","need_id","need_revision","category_id","catalog_version","result","bound_at"],"mode":"ACCOUNT"},{"relation":"private.work_taxonomy_worker_bindings_v1","dataClass":"COMMAND_LEDGERS","key":"taxonomyWorkerBindings","ownerColumn":"owner_account_id","fields":["request_key","source_review_id","profile_id","catalog_version","result","bound_at"],"mode":"ACCOUNT"},{"relation":"private.dev_phase1_20261014_worker_capabilities_snapshot","dataClass":"PROFILE_DATA","key":"archivedWorkerCapabilities","ownerColumn":"worker_account_id","fields":["category_id","confirmed_at","allow_related_offers","excluded","origin","updated_at"],"mode":"ACCOUNT"},{"relation":"private.dev_phase1_20261014_opportunity_snapshot","dataClass":"NOTIFICATION_DELIVERY","key":"archivedOpportunities","ownerColumn":"worker_account_id","fields":["id","worker_profile_id","need_id","need_revision","match_score","reason_codes","status","expires_at","seen_at","responded_at","created_at","updated_at"],"mode":"ACCOUNT"},{"relation":"private.dev_phase1_20261014_dispatch_snapshot","dataClass":"NOTIFICATION_DELIVERY","key":"archivedTaskDispatch","ownerColumn":"need_id","fields":["id","need_id","need_revision","round_no","urgency","status","stop_reason","deadline_at","created_at"],"mode":"NEED"},{"relation":"private.dev_test101_owner_worker_profile_backup","dataClass":"PROFILE_DATA","key":"archivedWorkerProfile","ownerColumn":"account_id","fields":["id","kind","display_name","city","headline","bio","avatar_path","account_type","profile_status","years_experience","portfolio","skills","tools","vehicles","licenses","exclusions","radius_km","operating_country_code","available_now","available_now_expires_at","team_capacity","minimum_fee_rsd","rating_requester","rating_worker","created_at","updated_at"],"mode":"ACCOUNT"},{"relation":"private.dev_test101_owner_profile_backup_20261014","dataClass":"PROFILE_DATA","key":"archivedProfiles","ownerColumn":"account_id","fields":["id","kind","display_name","city","headline","bio","avatar_path","account_type","profile_status","years_experience","portfolio","skills","tools","vehicles","licenses","exclusions","radius_km","operating_country_code","available_now","available_now_expires_at","team_capacity","minimum_fee_rsd","rating_requester","rating_worker","created_at","updated_at"],"mode":"ACCOUNT"},{"relation":"private.dev_worker_profile_reset_snapshots_v1","dataClass":"PROFILE_DATA","key":"archivedWorkerReset","ownerColumn":"account_id","fields":["backup_id","profile_id","backed_up_at","payload"],"mode":"ACCOUNT"},{"relation":"private.dev_phase1_20261014_needs_snapshot","dataClass":"NEED_PUBLIC","key":"archivedTasks","ownerColumn":"requester_account_id","fields":["id","title","description","category","category_id","approximate_city","approximate_area","approximate_lat","approximate_lng","schedule_kind","starts_at","ends_at","required_slots","mode","requester_price_rsd","required_skills","required_tools","required_vehicles","required_licenses","task_country_code","task_timezone","revision","status","created_at","updated_at"],"mode":"ACCOUNT"}]'::jsonb; $function$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_project_v1(r text, t jsonb, a uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE c jsonb;p jsonb:='{}';k text;semantic_key text;v jsonb;s jsonb;entry jsonb;rowvalue jsonb;projected jsonb;sections jsonb:='{}';owner text;
BEGIN
 SELECT x INTO c FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x WHERE x->>'relation'=r;
 IF c IS NULL THEN RAISE EXCEPTION 'F01_EXPORT_RELATION_INVALID';END IF;
 FOR k IN SELECT jsonb_array_elements_text(c->'fields') LOOP
  v:=t->k;
  IF k IN('proposals','plan','plans','result','binding_result','catalog_resolution') THEN v:=private.closure_taxonomy_semantic_v1(v);
  ELSIF k='portfolio' THEN v:=private.data_export_array_v5(v,'string');
  ELSIF k='payload' THEN
   FOR s IN SELECT jsonb_build_object('key',key,'fields',value) FROM jsonb_each(private.closure_taxonomy_reset_sections_v1()) LOOP
    entry:=v->(s->>'key');projected:='[]';
    FOR rowvalue IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(entry)='array' THEN entry WHEN jsonb_typeof(entry)='object' THEN jsonb_build_array(entry) ELSE '[]' END) LOOP
     owner:=coalesce(rowvalue->>'account_id',rowvalue->>'owner_account_id',rowvalue->>'worker_account_id');
     -- Snapshot arrays can contain foreign source copies; never trust only the outer owner.
     IF owner IS NOT NULL AND owner<>a::text THEN CONTINUE;END IF;
     SELECT coalesce(jsonb_object_agg(field,rowvalue->field),'{}') INTO entry FROM jsonb_array_elements_text(s->'fields') field;
     IF entry?'portfolio' THEN entry:=jsonb_set(entry,'{portfolio}',private.data_export_array_v5(entry->'portfolio','string'));END IF;
     IF entry?'candidate' THEN entry:=jsonb_set(entry,'{candidate}',private.data_export_worker_candidate_v5(entry->'candidate'));END IF;
     IF entry?'envelope' THEN entry:=jsonb_set(entry,'{envelope}',jsonb_build_object('profile',private.data_export_worker_candidate_v5(entry#>'{envelope,profile}')));END IF;
     FOR semantic_key IN SELECT unnest(ARRAY['proposals','plan','plans','result','binding_result','catalog_resolution']) LOOP
      IF entry?semantic_key THEN entry:=jsonb_set(entry,ARRAY[semantic_key],private.closure_taxonomy_semantic_v1(entry->semantic_key));END IF;
     END LOOP;
     projected:=projected||jsonb_build_array(entry);
    END LOOP;
    sections:=sections||jsonb_build_object(s->>'key',projected);
   END LOOP;
   v:=sections;
  END IF;
  p:=p||jsonb_build_object(k,v);
 END LOOP;
 RETURN p;
END $function$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_reset_sections_v1()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ SELECT '{"worker_profile":["id","kind","display_name","city","headline","bio","avatar_path","account_type","profile_status","years_experience","portfolio","skills","tools","vehicles","licenses","exclusions","radius_km","operating_country_code","available_now","available_now_expires_at","team_capacity","minimum_fee_rsd","rating_requester","rating_worker","created_at","updated_at"],"worker_messages":["id","conversation_id","role","body","created_at"],"worker_conversations":["id","purpose","status","created_at","completed_at"],"worker_sessions":["conversation_id","profile_id","revision","candidate","created_at"],"worker_reviews":["id","conversation_id","revision","envelope","created_at"],"worker_turns":["id","conversation_id","state","created_at","cancelled_at"],"worker_saves":["review_id","created_at"],"worker_hints":["id","purpose","conversation_id","client_request_id","turn_id","proposals","catalog_version","catalog_resolution","created_at"],"capabilities":["category_id","confirmed_at","allow_related_offers","excluded","origin","updated_at"],"confirmed_modes":["category_id","execution_scope","source_review_id","source_request_key","confirmed_at","active","handoff"],"bindings":["request_key","source_review_id","profile_id","catalog_version","result","bound_at"],"worker_modes":["worker_profile_id","modes","consent_source","confirmed_at","updated_at"],"availability_rules":["id","profile_id","active","weekdays","start_time","end_time","starts_on","ends_on","label"],"availability_windows":["id","profile_id","starts_at","ends_at","state","label"],"worker_preferences":["profile_id","worker_profile_id","available_now","available_until","radius_km"]}'::jsonb; $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_review_candidate_projection_v2(p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_exact jsonb;v_one jsonb;v_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_source text;v_version bigint;v_fingerprint text;v_item jsonb;v_proposal jsonb;
 v_service text;v_mode text;v_key text;v_parent uuid;v_parent_label text;
 v_category uuid;v_category_parent uuid;v_category_label text;v_plan jsonb;
 v_matches integer;v_path jsonb;v_label text;v_step integer;
 v_plans jsonb:='[]'::jsonb;v_visible jsonb:='[]'::jsonb;
 v_semantic jsonb:='[]'::jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_conversation_id IS NULL
   OR p_owner_account_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_OWNER_MISMATCH' USING errcode='42501';
 END IF;
 -- The existing projection validates the complete service/mode selection and
 -- returns the trusted exact/alias plan when the entire request already maps.
 v_exact:=private.taxonomy_review_exact_projection_v1(
   p_purpose,p_services,p_service_modes);
 
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
   WHERE singleton=true;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_fingerprint IS NULL THEN RETURN v_exact; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),
     'sha256'),'hex') INTO v_source
   FROM private.worker_ai_sessions s
   WHERE s.account_id=p_owner_account_id AND s.conversation_id=p_conversation_id;
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,
     'sha256'),'hex') INTO v_source
   FROM public.ai_conversations c
   WHERE c.account_id=p_owner_account_id AND c.id=p_conversation_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN RETURN v_exact; END IF;
 SELECT * INTO v_hint FROM private.work_taxonomy_turn_hints_resolved_v1 h
   WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
     AND h.conversation_id=p_conversation_id
     AND h.source_fingerprint=v_source AND h.catalog_version=v_version
   ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN
      RETURN jsonb_build_object('status',CASE
       WHEN v_hint.catalog_resolution->>'state'='RESOLVED'
         OR v_hint.catalog_resolution->>'code'='CATALOG_CHANGED' THEN 'STALE_CATALOG'
       ELSE 'REVIEW_REQUIRED' END,'classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;
     IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
   v_mode:=v_item->>'mode';
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   SELECT x.value#>>'{}' INTO v_service FROM jsonb_array_elements(p_services) x(value)
     WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1;
   v_visible:=v_visible||jsonb_build_array(jsonb_build_object(
     'service',v_service,'mode',v_mode));
   SELECT count(*),(jsonb_agg(p.value))->0 INTO v_matches,v_proposal
     FROM jsonb_array_elements(v_hint.proposals) p(value)
     WHERE private.taxonomy_normalize_v1(p.value->>'service')=v_key
       AND p.value->>'mode'=v_mode;
   -- Preserve the exact source-bound handoff value even for canonical/alias reuse.
   -- No default shipping or profile-city inference is permitted.
   IF v_matches=1 AND v_proposal?'handoff' AND
      (v_mode<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(v_proposal->'handoff'))
   THEN RAISE EXCEPTION 'TAXONOMY_REVIEW_HANDOFF_INVALID' USING errcode='42501'; END IF;
   v_one:=private.taxonomy_review_exact_projection_v1(p_purpose,
     jsonb_build_array(v_service),jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode)));
   IF v_one->>'status'='READY' THEN
     v_plan:=v_one#>'{classificationCandidates,0}';
     IF v_hint.catalog_resolution->>'state'='RESOLVED' AND (v_matches<>1 OR
       v_plan->>'categoryId' IS DISTINCT FROM v_proposal->>'categoryId') THEN
      RETURN jsonb_build_object('status','STALE_CATALOG','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;
     -- The same worker skill cannot have two different leaf IDs across modes.
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
       WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
         AND x.value->>'categoryId' IS DISTINCT FROM v_plan->>'categoryId')
     THEN RETURN v_exact; END IF;
     IF v_matches=1 AND v_proposal?'handoff' THEN
       v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff');
     END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_one->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
   -- Model-proposed unregistered semantic reuse is verified against safety screening.
   -- Low-risk candidates form a valid plan; sensitive/regulated items enter semantic comparison.
   IF v_matches=1 AND v_proposal->>'action'='REUSE_EXISTING' THEN
     IF jsonb_typeof(v_proposal->'catalogVersion') IS DISTINCT FROM 'number'
       OR (v_proposal->>'catalogVersion')::bigint IS DISTINCT FROM v_version
       OR jsonb_typeof(v_proposal->'categoryId') IS DISTINCT FROM 'string'
       OR (v_proposal->>'categoryId') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId' IS DISTINCT FROM ''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IN ('BLOCKED','NEEDS_CLARIFICATION')
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     -- A canonical/alias spelling anywhere is not a new synonym; it must go
     -- through exact identity or the existing explicit EXTEND_MODE path.
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a
           WHERE a.category_id=c.id AND a.normalized_key=v_key)))
     THEN RETURN v_exact; END IF;
     v_category_label:=NULL;v_category_parent:=NULL;
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
         AND m.execution_scope=v_mode
       WHERE c.id=v_category AND c.state='ESTABLISHED'
         AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
           WHERE child.parent_id=c.id AND child.state='ESTABLISHED');
     IF v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IN ('BLOCKED','NEEDS_CLARIFICATION')
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_plans) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
     THEN RETURN v_exact; END IF;
     IF private.taxonomy_risk_triage_v1(v_service) = 'REVIEW_REQUIRED'
        OR private.taxonomy_risk_triage_v1(v_category_label) = 'REVIEW_REQUIRED' THEN
       v_semantic:=v_semantic||jsonb_build_array(jsonb_build_object(
         'service',v_service,'mode',v_mode,'categoryId',v_category,
         'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version));
     ELSE
       v_plan:=jsonb_build_object('action','REUSE_EXISTING','service',v_service,'mode',v_mode,
         'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version);
       IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
       v_plans:=v_plans||jsonb_build_array(v_plan);
     END IF;
     CONTINUE;
   END IF;
   IF v_matches=1 AND v_proposal->>'action'='EXTEND_MODE' THEN
     IF (v_proposal->>'catalogVersion')::bigint<>v_version
       OR v_proposal->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId'<>''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     SELECT count(DISTINCT c.id) INTO v_matches FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_key));
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c WHERE c.id=v_category AND c.state='ESTABLISHED'
       AND (v_matches=0 OR c.canonical_key=v_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=v_key));
     -- An explicit current-source ID may extend a semantic synonym too. A
     -- conflicting/ambiguous canonical or alias identity still cannot be replaced.
     IF v_matches NOT IN (0,1) OR v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR (v_matches=0 AND EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
         WHERE child.parent_id=v_category AND child.state='ESTABLISHED'))
       OR EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
         WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RETURN v_exact; END IF;
     -- Proposal only: admission still requires the exact signed Save below.
     v_plan:=jsonb_build_object('action','EXTEND_MODE','service',v_service,'mode',v_mode,
       'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
       'reason',v_proposal->>'reason','catalogVersion',v_version);
     IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_matches<>1 OR v_proposal->>'action' NOT IN ('CREATE_CHILD','CREATE_NEW_BRANCH')
      OR v_proposal->>'categoryId'<>''
      OR (v_proposal->>'catalogVersion')::bigint<>v_version
      OR (v_proposal->>'action'='CREATE_CHILD' AND (v_proposal->>'parentId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      OR (v_proposal->>'action'='CREATE_NEW_BRANCH' AND v_proposal->>'parentId'<>'')
   THEN RETURN v_exact; END IF;
   v_path:=v_proposal->'proposedPath';
   IF jsonb_typeof(v_path)<>'array' OR jsonb_array_length(v_path)<1
      OR private.taxonomy_normalize_v1(v_path->>(jsonb_array_length(v_path)-1))<>v_key
      OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
   THEN RETURN v_exact; END IF;
   -- Store the exact owner-reviewed wording as the leaf. The model may have
   -- used another Serbian script, but it cannot change the visible meaning.
   v_path:=jsonb_set(v_path,ARRAY[(jsonb_array_length(v_path)-1)::text],
     to_jsonb(v_service),false);
   IF v_proposal->>'action'='CREATE_CHILD' THEN
     v_parent:=(v_proposal->>'parentId')::uuid;
     SELECT c.label INTO v_parent_label FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.state='ESTABLISHED';
     IF v_parent_label IS NULL OR NOT private.taxonomy_category_path_valid_v1(v_parent)
     THEN RETURN v_exact; END IF;
   ELSE
     v_parent:=NULL;v_parent_label:=NULL;
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.canonical_key=private.taxonomy_normalize_v1(v_path->>0))
     THEN RETURN v_exact; END IF;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_path)-1 LOOP
     v_label:=btrim(v_path->>v_step);
     IF jsonb_typeof(v_path->v_step) IS DISTINCT FROM 'string'
        OR char_length(v_label) NOT BETWEEN 3 AND 120
        OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]'
        OR private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
        OR (v_step=jsonb_array_length(v_path)-1 AND
            private.taxonomy_risk_triage_v1(v_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE')
        OR char_length(private.taxonomy_normalize_v1(v_label)) NOT BETWEEN 3 AND 160
        OR private.taxonomy_normalize_v1(v_label) !~ '[[:alpha:]]'
        OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=private.taxonomy_normalize_v1(v_label))
     THEN RETURN v_exact; END IF;
   END LOOP;
   v_plan:=jsonb_build_object(
     'action',v_proposal->>'action','service',v_service,'mode',v_mode,
     'parentId',v_parent,'parentLabel',v_parent_label,'path',v_path,
     'reason',v_proposal->>'reason','catalogVersion',v_version);
   IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
   v_plans:=v_plans||jsonb_build_array(v_plan);
 END LOOP;
 -- A deep path is bounded by the writer's byte budget, not an arbitrary
 -- number of levels. Never display READY for a batch the writer cannot accept.
 IF pg_column_size(v_plans)>16000 THEN RETURN v_exact; END IF;
 -- The batch writer checks the same fingerprint under a catalog row lock.
 -- Here it protects the owner from accepting a mixed-version review.
 IF v_version IS DISTINCT FROM (SELECT catalog_version
      FROM private.work_taxonomy_control WHERE singleton=true)
    OR v_fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 THEN RETURN v_exact; END IF;
 IF v_semantic<>'[]'::jsonb THEN
   -- Never present a sensitive semantic comparison as accepted. The user must compare and
   -- expressly confirm the exact meaning in a separately signed review.
   RETURN jsonb_build_object('status','REVIEW_REQUIRED',
     'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
     'semanticReviewCandidates',v_semantic,'visibleServices',v_visible,
     'classificationCatalogVersion',v_version,
     'classificationCatalogFingerprint',v_fingerprint,
     'classificationAuthority','NONE','capabilityAuthority','NONE',
     'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_plans,
   'reviewedServiceModes',CASE WHEN p_purpose='WORKER_CAPABILITY'
     THEN v_visible ELSE '[]'::jsonb END,
   'visibleServices',v_visible,'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$;

CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_session private.worker_ai_sessions; v_profile_id uuid;
 v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text; v_turn_resolved boolean:=false;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';

BEGIN
 SELECT * INTO v_session FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR v_session.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(v_session.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_profile_id:=v_session.profile_id;
 -- Read only durable, active bindings for independently surviving services.
 -- A newer pending addition is not authority to erase an older bound service.
 -- Source hash above still ties this context to the current owned profile.
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(v_session.candidate->'skills') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=p_account_id AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=p_account_id
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=p_account_id::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=p_account_id::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=p_account_id AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=p_account_id
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=p_account_id
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=p_account_id
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=p_account_id
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   v_session.candidate::text||'|'||v_session.revision::text||'|'||v_session.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals,coalesce(h.catalog_resolution->>'state'='RESOLVED',false) INTO v_hints,v_turn_resolved FROM private.work_taxonomy_turn_hints_resolved_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_turn_resolved OR (v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId')
     THEN v_draft_services:=v_draft_services||jsonb_build_array(jsonb_build_object(
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
        ||case when v_item ? 'handoff' then jsonb_build_object('handoff',v_item->'handoff') else '{}'::jsonb end);
     END IF;
   END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_saved_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_saved_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_draft_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_draft_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value#>>'{}'),'[]'::jsonb) INTO v_unresolved
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',v_session.revision,
   'savedServices',v_saved_services,'draftServices',v_draft_services,'unresolvedServices',v_unresolved);
END $function$;

CREATE OR REPLACE FUNCTION private.worker_remote_review_ready_v1(p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_exact jsonb;v_plans jsonb;v_plan jsonb;v_service text;v_seen text[]:=ARRAY[]::text[];v_n integer;v_category uuid;v_projection jsonb;v_one jsonb;v_saved_services jsonb;v_profile_id uuid;v_owned uuid;v_source text;v_hints jsonb;
BEGIN
 IF p_review->>'classificationState' IS DISTINCT FROM 'READY'
 OR jsonb_typeof(p_review#>'{profile,skills}') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'reviewedServiceModes') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'classificationCandidates') IS DISTINCT FROM 'array'
 THEN RETURN false; END IF;
 IF jsonb_array_length(p_review->'reviewedServiceModes') NOT BETWEEN 1 AND 12
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
   WHERE m->>'mode' IS DISTINCT FROM 'REMOTE')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p?'handoff' AND private.taxonomy_handoff_valid_v1(p->'handoff') IS NOT TRUE)
 THEN RETURN false; END IF;

 -- New catalog work is activation consent only, never an existing capability.
 -- Reuse the exact prepare validator (including source-bound hints and handoff)
 -- instead of introducing a second action/path parser. The Save activation
 -- owner separately checks account/session/revision/digest/expiry atomically.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IN ('CREATE_CHILD','CREATE_NEW_BRANCH','EXTEND_MODE')) THEN
   IF auth.uid() IS NULL OR p_review->>'accountId' IS DISTINCT FROM auth.uid()::text
     OR jsonb_typeof(p_review->'conversationId') IS DISTINCT FROM 'string'
     OR p_review->>'conversationId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   THEN RETURN false; END IF;
   v_projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes',auth.uid(),
     (p_review->>'conversationId')::uuid);
   -- Activation follows this transaction's own profile writes, so the old
   -- pre-Save source-hash context cannot be re-read here. Preserve only a
   -- separately proven active Save/batch/binding, never supplied JSON alone.
   v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
   IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION')
      OR p_review->'classificationCatalogVersion' IS DISTINCT FROM
        (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
      OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
      OR jsonb_array_length(p_review->'classificationCandidates')<>jsonb_array_length(p_review->'reviewedServiceModes')
   THEN RETURN false; END IF;
   IF v_projection->>'status'='READY'
     AND p_review->'classificationCandidates'=v_projection->'classificationCandidates'
     AND p_review->'reviewedServiceModes'=v_projection->'reviewedServiceModes'
   THEN RETURN true; END IF;
   v_owned:=auth.uid();
   SELECT p.id INTO v_profile_id FROM public.app_profiles p
     WHERE p.account_id=v_owned AND p.kind='WORKER' AND p.id::text=p_review->>'profileId';
   IF v_profile_id IS NULL THEN RETURN false; END IF;
   SELECT encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
     INTO v_source FROM private.worker_ai_sessions s WHERE s.account_id=v_owned
       AND s.conversation_id=(p_review->>'conversationId')::uuid;
   SELECT h.proposals INTO v_hints FROM private.work_taxonomy_turn_hints_resolved_v1 h
     WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=v_owned
       AND h.conversation_id=(p_review->>'conversationId')::uuid AND h.source_fingerprint=v_source
       AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(p_review#>'{profile,skills}') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=v_owned AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=v_owned AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=v_owned
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=v_owned::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=v_owned::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=v_owned AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=v_owned
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=v_owned
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=v_owned
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=v_owned
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;


   FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
     v_service:=v_plan->>'service';
     IF (SELECT count(*) FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
       WHERE m->>'service'=v_service AND m->>'mode'=v_plan->>'mode')<>1
       OR v_service=ANY(v_seen) THEN RETURN false; END IF;
     v_seen:=array_append(v_seen,v_service);
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',jsonb_build_array(v_service),
       jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),v_owned,(p_review->>'conversationId')::uuid);
     IF v_one->>'status'='READY' AND v_one#>'{classificationCandidates,0}'=v_plan THEN CONTINUE; END IF;
     -- No current proposal may be overridden, even when it is invalid or
     -- explicitly clears a previous mode/handoff. Only missing old hints reuse.
     IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
         WHERE private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_service))
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services) saved
         WHERE saved->>'service'=v_service AND saved->>'mode'=v_plan->>'mode'
           AND saved->>'categoryId'=v_plan->>'categoryId'
           AND saved->'handoff' IS NOT DISTINCT FROM v_plan->'handoff')
       OR private.worker_remote_review_ready_v1(p_review||jsonb_build_object(
         'profile',jsonb_build_object('skills',jsonb_build_array(v_service)),
         'reviewedServiceModes',jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),
         'classificationCandidates',jsonb_build_array(v_plan))) IS NOT TRUE
     THEN RETURN false; END IF;
   END LOOP;
   RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IS DISTINCT FROM 'REUSE_EXISTING') THEN RETURN false; END IF;
 -- Only today's complete exact canonical/registered-alias set. User-selected
 -- modes never admit a future category or extend an existing category's scope.
 v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
   p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
 SELECT jsonb_agg(p.value-'handoff' ORDER BY p.ord) INTO v_plans
 FROM jsonb_array_elements(p_review->'classificationCandidates') WITH ORDINALITY p(value,ord);
 IF v_exact->>'status'='READY'
   AND p_review->'classificationCatalogVersion'=v_exact->'classificationCatalogVersion'
   AND p_review->'classificationCatalogFingerprint'=v_exact->'classificationCatalogFingerprint'
   AND p_review->'reviewedServiceModes'=v_exact->'reviewedServiceModes'
   AND v_plans=v_exact->'classificationCandidates' THEN RETURN true; END IF;

 -- No additional AI authority: complete current signed READY only.
 -- The caller validates the immutable owner/revision/source/digest/expiry
 -- and this helper rechecks the existing exact leaf ID, REMOTE scope, witness,
 -- consented service set and catalog fingerprint. No new/extended category
 -- or global alias is approved here.
 IF p_review->'classificationCatalogVersion' IS DISTINCT FROM
     (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
 OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 OR jsonb_array_length(p_review->'classificationCandidates')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 OR jsonb_array_length(p_review->'reviewedServiceModes')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 THEN RETURN false; END IF;
 FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
   IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
     OR v_plan->>'mode' IS DISTINCT FROM 'REMOTE'
     OR jsonb_typeof(v_plan->'service') IS DISTINCT FROM 'string'
     OR length(btrim(v_plan->>'service')) NOT BETWEEN 3 AND 120
     OR v_plan->>'categoryId' IS NULL
     OR char_length(v_plan->>'categoryId') IS DISTINCT FROM 36
     OR v_plan->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
     OR NOT (v_plan ? 'categoryLabel' AND v_plan ? 'categoryParentId')
     OR jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
     OR (v_plan ? 'handoff' AND private.taxonomy_handoff_valid_v1(v_plan->'handoff') IS NOT TRUE)
   THEN RETURN false; END IF;
   v_service:=private.taxonomy_normalize_v1(v_plan->>'service');
   IF v_service IS NULL OR v_service=ANY(v_seen)
      OR private.taxonomy_risk_triage_v1(v_plan->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements_text(p_review#>'{profile,skills}') s(value)
     WHERE private.taxonomy_normalize_v1(s.value)=v_service;
   IF v_n<>1 THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements(p_review->'reviewedServiceModes') m(value)
     WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_service AND m.value->>'mode'='REMOTE';
   IF v_n<>1 THEN RETURN false; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope='REMOTE'
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId'
        AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
          WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
        AND private.taxonomy_category_path_valid_v1(c.id))
   THEN RETURN false; END IF;
   v_seen:=array_append(v_seen,v_service);
 END LOOP;
 RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_context jsonb;v_retained jsonb:='[]'::jsonb;v_plans jsonb:='[]'::jsonb;v_one jsonb;v_saved_item jsonb;v_plan jsonb;
 v_version bigint;v_fingerprint text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  -- City readiness follows the signed service projection below.
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2)
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and s.revision>0 -- untouched sessions revalidate saved consent on every review
  and envelope->>'classificationState'='READY'
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Use only hints bound to the authenticated worker, this conversation, and
 -- the exact CURRENT candidate/revision/base_hash. They are suggestions only.
 v_source:=encode(extensions.digest(
   convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex');
 select h.proposals into v_hints from private.work_taxonomy_turn_hints_resolved_v1 h
 where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid()
   and h.conversation_id=p_conversation_id and h.source_fingerprint=v_source
   and h.catalog_version=(select catalog_version from private.work_taxonomy_control where singleton=true)
 order by h.created_at desc,h.id desc limit 1;
 if jsonb_typeof(v_hints)='array' then
   for v_item in select value from jsonb_array_elements(v_hints) loop
     if v_item->>'mode' in ('ON_SITE','REMOTE')
       and v_item->>'action' in ('REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH') then
       v_modes:=v_modes||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode'));
     end if;
   end loop;
 end if;

 -- Reuse only independently bound, unchanged services from this owner's
 -- current profile. Any current hint for a service (including invalid/null
 -- modes or actions) takes precedence and prevents silent old-mode fallback.
 perform 1 from private.work_taxonomy_worker_bindings_v1 binding
   where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id for share;
 perform 1 from private.worker_execution_mode_choices choice
   where choice.worker_profile_id=s.profile_id for share;
 perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
   where mode.worker_account_id=auth.uid() for share;
 perform 1 from private.work_taxonomy_worker_capabilities capability
   where capability.worker_account_id=auth.uid() for share;
 v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
 for v_item in select value from jsonb_array_elements(v_context->'savedServices') loop
   if not exists(select 1 from jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
     where private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
   and not exists(
     -- Absence in the newest turn cannot undo a prior explicit change in this
     -- conversation. A stale proposal may prevent fallback, never grant it.
     select 1 from (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and h.source_fingerprint is distinct from v_source
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
       order by h.created_at desc,h.id desc limit 1) previous
     where exists(select 1 from jsonb_array_elements(previous.proposals) p
       where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
       and (p->>'action' is distinct from 'REUSE_EXISTING' or not exists(
         select 1 from jsonb_array_elements(v_context->'savedServices') saved
         where saved->>'service'=v_item->>'service' and saved->>'mode'=p->>'mode'
           and saved->>'categoryId'=p->>'categoryId' and saved->'handoff' is not distinct from p->'handoff')))
     or exists(select 1 from jsonb_array_elements(v_context->'savedServices') saved
       where saved->>'service'=v_item->>'service' and not exists(
         select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
           and saved->>'mode'=p->>'mode' and saved->>'categoryId'=p->>'categoryId'
           and saved->'handoff' is not distinct from p->'handoff')))
   then
     v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
     v_retained:=v_retained||jsonb_build_array(v_item);
   end if;
 end loop;
 select coalesce(jsonb_agg(m.value ORDER BY skill.ord,m.value->>'mode'),'[]'::jsonb) into v_modes
 from jsonb_array_elements(v_modes) m(value) join jsonb_array_elements(s.candidate->'skills') with ordinality skill(value,ord)
   on skill.value=to_jsonb(m.value->>'service');
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 if v_projection->>'status' in ('READY','PENDING_CLASSIFICATION') and v_retained<>'[]'::jsonb then
   select catalog_version into v_version from private.work_taxonomy_control where singleton;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   -- Existing per-service projection validates every new plan. Only a verified
   -- saved semantic ID may fill a missing old synonym, without a new model call.
   for v_item in select value from jsonb_array_elements(v_modes) loop
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(v_item),auth.uid(),p_conversation_id);
     select value into v_saved_item from jsonb_array_elements(v_retained) x(value)
       where value->>'service'=v_item->>'service' and value->>'mode'=v_item->>'mode';
     if v_one->>'status'='READY' then
       v_plan:=v_one#>'{classificationCandidates,0}';
       if v_saved_item is not null and v_plan->>'categoryId' is distinct from v_saved_item->>'categoryId' then
         v_plans:='[]'::jsonb;exit;
       end if;
     elsif v_one->>'status'='PENDING_CLASSIFICATION' and v_saved_item is not null then
       select jsonb_build_object('action','REUSE_EXISTING','service',v_item->>'service','mode',v_item->>'mode',
         'categoryId',c.id,'categoryLabel',c.label,'categoryParentId',c.parent_id,
         'reason','Previously saved and bound service identity','catalogVersion',v_version)
       into v_plan from private.work_taxonomy_categories c where c.id::text=v_saved_item->>'categoryId'
         and c.state='ESTABLISHED' and private.taxonomy_category_path_valid_v1(c.id)
         and private.taxonomy_risk_triage_v1(v_item->>'service')='LOW_RISK_CANDIDATE'
         and private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE';
       if v_plan is null then v_plans:='[]'::jsonb;exit;end if;
     else v_plans:='[]'::jsonb;exit;end if;
     if v_saved_item ? 'handoff' then v_plan:=v_plan||jsonb_build_object('handoff',v_saved_item->'handoff');end if;
     v_plans:=v_plans||jsonb_build_array(v_plan);
   end loop;
   if jsonb_array_length(v_plans)=jsonb_array_length(v_modes) and pg_column_size(v_plans)<=16000
      and v_version=(select catalog_version from private.work_taxonomy_control where singleton)
      and v_fingerprint=private.taxonomy_admission_fingerprint_v1() then
     v_projection:=v_projection||jsonb_build_object('status','READY','classificationCandidates',v_plans,
       'reviewedServiceModes',v_modes,'visibleServices',v_modes,
       'classificationCatalogVersion',v_version,'classificationCatalogFingerprint',v_fingerprint);
   else v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);end if;
 end if;
 -- A projected mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   if exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') plan
     join jsonb_array_elements(v_context->'savedServices') saved
       on saved->>'service'=plan->>'service' and saved->>'mode'=plan->>'mode'
         and saved->>'categoryId'=plan->>'categoryId'
     cross join lateral (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
             and p->>'mode'='REMOTE' and p?'handoff')
       order by h.created_at desc,h.id desc limit 1) previous
     where plan->>'mode'='REMOTE' and not(plan?'handoff')
       and exists(select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
           and p->>'mode'='REMOTE' and p?'handoff'
           and p->'handoff' is distinct from saved->'handoff')) then
     v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   end if;
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');

 if p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE then
   if jsonb_typeof(doc->'reviewedServiceModes')='array'
      and jsonb_array_length(doc->'reviewedServiceModes')>0
      and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m
        where m->>'mode' is distinct from 'REMOTE') then
     missing:=missing||'"Potvrda usluga za rad na daljinu"'::jsonb;
   else missing:=missing||'"Mesto rada"'::jsonb; end if;
 end if;
 doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 -- Sign BEFORE storing or returning the owner-visible review.

 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;

DO $post$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'SINGLE_PASS_CONTEXT_REFUSED';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.ai_need_turn_status(uuid, uuid, uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5005a5ed32bd85188d22cc4ca80c03dd'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.ai_need_turn_status(uuid, uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_inventory_v1()')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='0c77ca6e8303f73ce87ad49e8010a6e2'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_inventory_v1()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_project_v1(text, jsonb, uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='524dc46219cde78e5a961fc9df397adf'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_project_v1(text, jsonb, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_taxonomy_reset_sections_v1()')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='2e73e1ed2516f9065ce8a59307520e6c'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.closure_taxonomy_reset_sections_v1()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_first_plan_complete_receipt_v1(uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='0e88345092d21b62c1c140bdaae2e00d'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_first_plan_complete_receipt_v1(uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_first_plan_input_digest_v1(text, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='ee28e221d434fa584ac4576930f9df72'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_first_plan_input_digest_v1(text, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_first_plan_lock_v1(uuid, uuid, uuid, uuid, text)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='e6be34fdb2887bffbb91d473f257f823'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_first_plan_lock_v1(uuid, uuid, uuid, uuid, text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_resolve_turn_catalog_v1(uuid, text, jsonb, text)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='35243079b776b4ee2ed1a944c2887f15'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_resolve_turn_catalog_v1(uuid, text, jsonb, text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='547d43c7108780d54f3d2d9d90dd12e4'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text, jsonb, jsonb, uuid, uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='aeae6f02c0ef0883dde1e220a396f1a2'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_review_candidate_projection_v2(text, jsonb, jsonb, uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_risk_triage_v1(text)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='43422a711aeaca57d4b78e3d55b3333a'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_risk_triage_v1(text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_turn_category_identity_v1(uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='348e4ce86f5859993707e0c6093de83c'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.taxonomy_turn_category_identity_v1(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_service_mode_context_v1(uuid, uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='8c9bce866734738a56c1d331928ee676'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_ai_service_mode_context_v1(uuid, uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_turn_document(uuid)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='dcee2f26162a5ac3f9b86990b1838fa3'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_ai_turn_document(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_remote_review_ready_v1(jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='eff4bf5c05164fe1bf08599b1eefa36c'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','private.worker_remote_review_ready_v1(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_location_turn_v1_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='10d26307c5a7ef4c16940fa8e54d4d64'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_location_turn_v1_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='960f9f020e4f66c1ebb74d2512057149'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid, uuid, uuid, uuid, text, text, text, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='b867f1c7289fb7513f5acec4a050b8c8'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_turn_v2_service(uuid, uuid, uuid, uuid, text, text, text, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5faa3837540dea6ab97287a039ea08b7'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_complete_need_turn_with_first_plan_service(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_read_first_plan_completion_service(text, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='91362567fd674b21fc4632304dfbbf08'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_ai_read_first_plan_completion_service(text, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_ai_turn_service(uuid, uuid, uuid, uuid, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='5f0b6545dcde28bf2fcb4ea0f0393458'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_complete_worker_ai_turn_service(uuid, uuid, uuid, uuid, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid, uuid, uuid, uuid, jsonb, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='f010585363a9afea45b794e5e65cd1a0'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid, uuid, uuid, uuid, jsonb, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid, integer, boolean)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='85f9036f76a0b6d313bb164ba09f72b4'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_prepare_worker_ai_review_taxonomy(uuid, integer, boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid, integer, boolean, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='2c9a6526f65cfa6a5b1dd14bdc3b9491'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid, integer, boolean, jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)')

 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))='c363facdb26d33ae872e25e6a79e4306'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %','public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)'; END IF;
IF ((SELECT capture->'closure' FROM (SELECT jsonb_build_object(
'project_ref','leqcwgzvjsxugfgzdmth',
'captured_at',clock_timestamp(),'server_version_num',current_setting('server_version_num'),'role',current_user,
'closure',jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),
'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),
'erasure_binding',private.closure_erasure_binding_v5(),'export_binding',private.data_export_policy_binding()),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.name,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
'not_null',a.attnotnull,'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(x.oid) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname||'.'||p.tablename=n.name),
'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function_md5',md5(replace(pg_get_functiondef(t.tgfoid),chr(13),''))) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))
ORDER BY n.name) FROM (VALUES('private.work_taxonomy_gemini_turn_hints_v1'),('private.work_taxonomy_control'),('private.work_taxonomy_categories'),
('private.work_taxonomy_category_modes'),('private.work_taxonomy_aliases'),('private.work_taxonomy_audit'),
('private.ai_need_turn_commands'),('private.worker_ai_sessions'),('private.worker_ai_turns')) n(name)
JOIN pg_class c ON c.oid=to_regclass(n.name))) AS capture) x)-'schema'-'source') IS DISTINCT FROM '{"certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'SINGLE_PASS_READINESS_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='private.work_taxonomy_turn_hints_resolved_v1'::regclass AND c.reloptions=ARRAY['security_invoker=true']
 AND c.relacl::text='{postgres=arwdDxtm/postgres}' AND md5(pg_get_viewdef(c.oid,true))='f17fec7b4c7e4c411abd0c6eef8b2432') THEN RAISE EXCEPTION 'SINGLE_PASS_VIEW_ACL_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='private.work_taxonomy_gemini_turn_hints_v1'::regclass AND attname='catalog_resolution'
 AND atttypid='jsonb'::regtype AND NOT attnotnull AND NOT attisdropped AND attacl IS NULL)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='private.work_taxonomy_gemini_turn_hints_v1'::regclass AND pg_get_constraintdef(oid)='CHECK (((catalog_resolution IS NULL) OR ((jsonb_typeof(catalog_resolution) = ''object''::text) AND (pg_column_size(catalog_resolution) <= 12000) AND ((catalog_resolution ->> ''state''::text) = ANY (ARRAY[''RESOLVED''::text, ''DEFERRED''::text])) AND ((catalog_resolution ->> ''inputDigest''::text) ~ ''^[0-9a-f]{64}$''::text))))')
 THEN RAISE EXCEPTION 'SINGLE_PASS_COLUMN_DRIFT';END IF;
 END;$post$;
NOTIFY pgrst,'reload schema';
COMMIT;
