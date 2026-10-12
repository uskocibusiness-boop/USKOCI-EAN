-- Source-only: service-only RPC for use by Gemini Edge and worker interview
-- AFTER independent migration approval. Strictly READ ONLY and no AI grants.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF to_regprocedure('public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)') IS NOT NULL
 OR to_regprocedure('private.taxonomy_ai_catalog_context_v1(text,integer,text)') IS NULL
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'AI_CATALOG_CONTEXT_SERVICE_RPC_PRECONDITION'; END IF;
END $guard$;

CREATE FUNCTION public.rpc_taxonomy_ai_catalog_context_service(
 p_execution_location_mode text,p_limit integer DEFAULT 80,
 p_after_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog AS $fn$
 SELECT private.taxonomy_ai_catalog_context_v1(
  p_execution_location_mode,p_limit,p_after_key
 )
$fn$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)
 TO service_role;
DO $proof$
DECLARE v jsonb;
BEGIN
 IF has_function_privilege('anon','public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'AI_CATALOG_RPC_PUBLIC_ACCESS'; END IF;
 v:=public.rpc_taxonomy_ai_catalog_context_service('REMOTE',80,NULL);
 IF v->>'action'<>'CATALOG_CONTEXT' OR v->>'scope'<>'REMOTE'
 OR v->>'classificationAuthority'<>'NONE'
 OR v->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'AI_CATALOG_RPC_MISMATCH'; END IF;
END $proof$;
