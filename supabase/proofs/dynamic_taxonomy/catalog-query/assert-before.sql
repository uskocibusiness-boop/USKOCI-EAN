SELECT proof.require(to_regprocedure('public.rpc_taxonomy_query_catalog_service(jsonb)') IS NULL,'NEW_RPC_ABSENT_BEFORE_OR_AFTER_ROLLBACK');
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.before_functions b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE md5(pg_get_functiondef(p.oid))<>b.definition_md5 OR p.proowner<>b.proowner OR p.proacl IS DISTINCT FROM b.proacl
 OR p.proconfig IS DISTINCT FROM b.proconfig),'EXACT_EXISTING_FUNCTIONS_RETAINED');
SELECT 'CATALOG_QUERY_BEFORE_OR_ROLLBACK_PASS' result;
