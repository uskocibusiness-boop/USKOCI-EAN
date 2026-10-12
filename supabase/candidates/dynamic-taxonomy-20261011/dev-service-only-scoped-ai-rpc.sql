-- USKOCI: service-role PostgREST entrypoints to private mode-aware previews.
-- These are READ ONLY (STABLE + SECURITY INVOKER), for existing AI Edge
-- functions to call with server-authenticated payloads. No client registration,
-- user/worker writes, publish/dispatch authority or feature activation.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[])') IS NOT NULL
 OR to_regprocedure('public.rpc_taxonomy_worker_scoped_preview_service(text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_RPC_BRIDGE_ALREADY_EXISTS'; END IF;
 IF to_regprocedure('private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[])') IS NULL
 OR to_regprocedure('private.taxonomy_worker_scoped_capability_preview_v1(text,text)') IS NULL
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_RPC_BRIDGE_PRECONDITION_MISMATCH'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_ai_scoped_preview_service(
 p_execution_location_mode text,
 p_ai_category text,
 p_public_description text,
 p_explicit_required_skills text[]
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $fn$
 SELECT private.taxonomy_existing_ai_scoped_preview_v1(
   p_execution_location_mode,p_ai_category,p_public_description,p_explicit_required_skills)
$fn$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_worker_scoped_preview_service(
 p_execution_location_mode text,
 p_skill_label text
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $fn$
 SELECT private.taxonomy_worker_scoped_capability_preview_v1(
   p_execution_location_mode,p_skill_label)
$fn$;

-- Supabase public schema has explicit default EXECUTE grants to anon/authenticated.
-- Revoke those as well as PUBLIC before granting only the service runtime.
REVOKE ALL ON FUNCTION public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_worker_scoped_preview_service(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_worker_scoped_preview_service(text,text) TO service_role;

DO $postflight$
DECLARE a jsonb; w jsonb;
BEGIN
 a:=public.rpc_taxonomy_ai_scoped_preview_service(
   'REMOTE','Izrada logotipa','Potrebna izrada logotipa.',ARRAY[]::text[]);
 w:=public.rpc_taxonomy_worker_scoped_preview_service('STATIONARY','Popravka 3D štampača');
 IF a->>'executionScope'<>'REMOTE' OR a->>'classificationAuthority'<>'NONE'
 OR a->>'notificationAuthority'<>'NONE'
 OR w->>'executionScope'<>'ON_SITE' OR w->>'capabilityAuthority'<>'NONE'
 OR w->>'notificationAuthority'<>'NONE'
 OR has_function_privilege('anon','public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[])','EXECUTE')
 OR has_function_privilege('authenticated','public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[])','EXECUTE')
 OR has_function_privilege('anon','public.rpc_taxonomy_worker_scoped_preview_service(text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.rpc_taxonomy_worker_scoped_preview_service(text,text)','EXECUTE')
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_RPC_BRIDGE_ACCESS_OR_AUTHORITY_FAILED'; END IF;
END $postflight$;
