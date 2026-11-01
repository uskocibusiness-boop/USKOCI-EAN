BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
DO $r04_flight$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_risk_triage_v1(text)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='93d94a6c7e21ce3ecb854cda239b546a'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_risk_triage_v1(text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='116b5c16ca4179459aaa893a7073a611'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.needs_sync_taxonomy_category_trigger_fn()')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='43b0a7f32355ab493c3899a9670c7331'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM NULL)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.needs_sync_taxonomy_category_trigger_fn()'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r04_flight$;

SELECT 'R04_SEMANTIC_DEV_POSTIMAGE_MATCH' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;
