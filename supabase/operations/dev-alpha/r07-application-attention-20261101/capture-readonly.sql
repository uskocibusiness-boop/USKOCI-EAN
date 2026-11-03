BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'project_ref','leqcwgzvjsxugfgzdmth',
 'captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
 'database',current_database(),'capture_role',current_user,'server_version_num',current_setting('server_version_num')::integer,
 'closure',jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding()),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',s.signature,'oid',p.oid,
 'definition',pg_get_functiondef(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid)),
 'body_md5',md5(p.prosrc),'body_lf_md5',md5(replace(p.prosrc,E'\r\n',E'\n')),
 'attributes',to_jsonb(p)-'prosrc'-'oid') ORDER BY s.signature)
 FROM unnest(ARRAY['private.own_application_rows(uuid)','public.rpc_list_my_applications()','public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)','private.my_application_state(text,integer,integer,text,boolean)','private.application_calendar_conflict_v1(uuid)','private.closure_source_digest_v5()','private.closure_erasure_program_digest_v5()','private.closure_schema_digest_v5_139()','private.retention_ai_source_ready()','private.closure_erasure_binding_v5()','private.data_export_policy_binding()','public.rpc_closure_api_guard()']) AS s(signature)
 JOIN pg_proc p ON p.oid=to_regprocedure(s.signature)),
 'status_constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conname)
 FROM pg_constraint WHERE conrelid IN ('public.agreements'::regclass,'public.agreement_execution'::regclass)
 AND contype='c' AND (pg_get_constraintdef(oid) LIKE '%status%' OR pg_get_constraintdef(oid) LIKE '%state%'))
) AS capture;ROLLBACK;
