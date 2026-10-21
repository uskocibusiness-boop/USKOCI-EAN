-- For a future integrated migration only; result is not a PASS by itself.
SELECT current_timestamp AT TIME ZONE 'UTC' AS checked_utc,
 md5(pg_get_functiondef('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure)) AS projection_definition_md5,
 md5(pg_get_functiondef('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure)) AS batch_definition_md5,
 md5(pg_get_functiondef('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'::regprocedure)) AS consent_definition_md5,
 (SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text,'securityDefiner',prosecdef,
  'volatility',provolatile,'config',proconfig) FROM pg_proc
  WHERE oid='private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure) AS projection_metadata,
 private.retention_ai_source_ready() AS retention_ready,
 private.closure_erasure_binding_v5() IS NOT NULL AS erasure_binding_present,
 private.closure_source_digest_v5() AS closure_source_digest;
