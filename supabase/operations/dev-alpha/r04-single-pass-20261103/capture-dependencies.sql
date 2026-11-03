BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SELECT jsonb_build_object(
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
JOIN pg_class c ON c.oid=to_regclass(n.name))) AS capture;
ROLLBACK;
