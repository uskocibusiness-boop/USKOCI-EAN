-- R04 controlled DEV preparation: metadata and technical closure state only.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='25s';
WITH targets(signature) AS (VALUES
 ('private.taxonomy_risk_triage_v1(text)'),
 ('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'),
 ('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'),
 ('private.needs_sync_taxonomy_category_trigger_fn()'),
 ('private.closure_source_digest_v5()'),
 ('private.closure_erasure_program_digest_v5()'),
 ('private.closure_schema_digest_v5_139()'),
 ('private.retention_ai_source_ready()'),
 ('private.closure_erasure_binding_v5()'),
 ('private.data_export_policy_binding()'))
SELECT jsonb_build_object('unit','R04_DEV_PREIMAGE','project_ref','leqcwgzvjsxugfgzdmth',
 'captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
 'database',current_database(),'capture_role',current_user,'server_version_num',current_setting('server_version_num')::int,
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',t.signature,'oid',p.oid,
  'definition',pg_get_functiondef(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid)),
  'body_md5',md5(p.prosrc),'body_lf_md5',md5(replace(p.prosrc,E'\r\n',E'\n')),
  'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'security_definer',p.prosecdef,
  'config',p.proconfig,'attributes',to_jsonb(p)-'prosrc'-'oid') ORDER BY t.signature)
  FROM targets t LEFT JOIN pg_proc p ON p.oid=to_regprocedure(t.signature)),
 'closure',jsonb_build_object('source',private.closure_source_digest_v5(),
  'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
  'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
  'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
  'export_binding',private.data_export_policy_binding())
) AS capture;
ROLLBACK;
