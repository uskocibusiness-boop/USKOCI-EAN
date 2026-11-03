BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;
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
SELECT 'SINGLE_PASS_POSTIMAGE_MATCH' AS result,false AS release_ready;ROLLBACK;
