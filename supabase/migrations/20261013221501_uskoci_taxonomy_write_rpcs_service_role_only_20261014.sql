-- USKOCI V5 DEV security hotfix: 2026-10-14.
-- Applied to DEV leqcwgzvjsxugfgzdmth as Supabase migration 20261013221501.
-- Dynamic taxonomy creation and worker capability writes must be service-owned:
-- the AI Edge handler uses service_role after verifying the user and binding
-- the AI turn, while authenticated clients must never grant themselves skills
-- or mutate the whole taxonomy catalog with arbitrary parameters.
--
-- Idempotent grant hardening; no categories, profiles or task data are modified.
REVOKE EXECUTE ON FUNCTION public.rpc_taxonomy_ensure_path_service(text[], text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_categories_service(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_skills_service(uuid, text[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_ensure_path_service(text[], text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_categories_service(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_skills_service(uuid, text[]) TO service_role;
