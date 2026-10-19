-- Drop only the exact newly introduced read-only RPC. Existing readers remain.
BEGIN;
DO $guard$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_taxonomy_query_catalog_service(jsonb)')) IS DISTINCT FROM '8802eac005d05f406d15249d2f491f67'
 THEN RAISE EXCEPTION 'TAXONOMY_QUERY_ROLLBACK_BODY_DRIFT'; END IF;
END $guard$;
DROP FUNCTION public.rpc_taxonomy_query_catalog_service(jsonb);
COMMIT;
