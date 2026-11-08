-- One bounded HTTP read delegates each public projection to the unchanged reader.
-- This removes client network fan-out, not the reader's internal SQL work per id.
DO $guard$
DECLARE v record;
BEGIN
  SELECT md5(p.prosrc) AS body_md5, p.prosecdef AS definer, p.provolatile AS volatility,
    p.proconfig AS config, p.proacl::text AS acl, pg_get_userbyid(p.proowner) AS owner
  INTO v FROM pg_proc p WHERE p.oid = to_regprocedure('public.rpc_get_public_profile(uuid)');
  IF NOT FOUND OR v.body_md5 IS DISTINCT FROM '9ecc0b69096f1167d02e0bb7b9656bc0'
    OR v.definer IS DISTINCT FROM true OR v.volatility IS DISTINCT FROM 's'::"char"
    OR v.config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR v.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
    OR v.owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'PUBLIC_PROFILE_READER_PREIMAGE_CHANGED';
  END IF;
  IF to_regprocedure('public.rpc_get_public_profiles_batch(uuid,uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_PROFILES_BATCH_ALREADY_EXISTS';
  END IF;
END;
$guard$;

CREATE FUNCTION public.rpc_get_public_profiles_batch(p_expected_user_id uuid, p_profile_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_profile_id uuid;
  v_profiles jsonb := '[]'::jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_expected_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'AUTH_CONTEXT_CHANGED' USING ERRCODE = '42501';
  END IF;
  IF p_profile_ids IS NULL OR cardinality(p_profile_ids) > 100
    OR array_ndims(p_profile_ids) > 1
    OR EXISTS (SELECT 1 FROM unnest(p_profile_ids) value WHERE value IS NULL)
    OR cardinality(p_profile_ids) <> (SELECT count(DISTINCT value) FROM unnest(p_profile_ids) value) THEN
    RAISE EXCEPTION 'PUBLIC_PROFILE_BATCH_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  FOREACH v_profile_id IN ARRAY p_profile_ids LOOP
    v_profiles := v_profiles || jsonb_build_array(jsonb_build_object(
      'profileId', v_profile_id,
      'profile', public.rpc_get_public_profile(v_profile_id)
    ));
  END LOOP;
  RETURN jsonb_build_object('schema', 'PUBLIC_PROFILES_BATCH_V1', 'accountId', v_actor,
    'profiles', v_profiles, 'asOf', statement_timestamp(), 'authoritative', true);
END;
$function$;
ALTER FUNCTION public.rpc_get_public_profiles_batch(uuid,uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_public_profiles_batch(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_public_profiles_batch(uuid,uuid[]) TO postgres, service_role, authenticated;
