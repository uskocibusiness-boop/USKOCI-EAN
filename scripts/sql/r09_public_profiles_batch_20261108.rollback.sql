-- Restore the client first if it already depends on the batch RPC. This removes
-- only the new wrapper; the existing public reader and all data stay unchanged.
DO $rollback$
DECLARE v record;
BEGIN
  SELECT md5(p.prosrc) AS body_md5, p.prosecdef AS definer, p.provolatile AS volatility,
    p.proconfig AS config, p.proacl::text AS acl, pg_get_userbyid(p.proowner) AS owner
  INTO v FROM pg_proc p WHERE p.oid = to_regprocedure('public.rpc_get_public_profiles_batch(uuid,uuid[])');
  IF NOT FOUND OR v.body_md5 IS DISTINCT FROM 'a01875f4e9e3349988defde7a288a46a'
    OR v.definer IS DISTINCT FROM false OR v.volatility IS DISTINCT FROM 's'::"char"
    OR v.config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR v.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
    OR v.owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'PUBLIC_PROFILES_BATCH_POSTIMAGE_CHANGED';
  END IF;
  DROP FUNCTION public.rpc_get_public_profiles_batch(uuid,uuid[]);
END;
$rollback$;
