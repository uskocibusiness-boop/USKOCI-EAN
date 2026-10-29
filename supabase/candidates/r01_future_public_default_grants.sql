-- R01/F21 SOURCE-ONLY. Harden FUTURE public tables/sequences on a disposable
-- current-schema/Auth test runtime. NEVER run on hosted DEV or production.
-- Unlike the present public.needs fix, this cannot retroactively alter an
-- existing table, routine, Storage relation or any historical migration.
--
-- Read-only DEV evidence 2026-10-29: BOTH postgres and supabase_admin own
-- public default ACL entries granting anon/authenticated ALL future table
-- privileges and sequence rwU. postgres is NOT a member of supabase_admin;
-- this separate, tightly constrained action requires the platform owner.
-- Review and current-schema parity, Auth/PostgREST compatibility and rollout
-- gates must be satisfied before promoting it via a newly generated migration.
--
-- Test only with SET uskoci.r01.disposable='LOCAL_ONLY' on an approved
-- ephemeral PostgreSQL 17 database named postgres under supabase_admin.
BEGIN;
SET LOCAL search_path = pg_catalog;
DO $r01_future$
DECLARE
  v_owner text;
  v_type "char";
  v_entry pg_default_acl%ROWTYPE;
  v_unchanged_before jsonb;
  v_unchanged_after jsonb;
  v_owner_count integer;
  v_target_count integer;
BEGIN
  IF current_setting('uskoci.r01.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_database()<>'postgres'
    OR current_user<>'supabase_admin'
    OR to_regrole('cli_login_postgres') IS NOT NULL
    OR current_setting('server_version_num')::integer/10000<>17
  THEN RAISE EXCEPTION 'R01_DEFAULTS_DISPOSABLE_PLATFORM_OWNER_REQUIRED'
    USING errcode='55000'; END IF;

  -- Protect everything other than the four directly reviewed default
  -- entries, including function defaults and all non-public namespaces.
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.defaclrole,d.defaclnamespace,
       d.defaclobjtype),'[]'::jsonb)
  INTO v_unchanged_before FROM pg_default_acl d
  WHERE NOT(d.defaclnamespace='public'::regnamespace AND
            pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
            AND d.defaclobjtype IN ('r','S'));

  SELECT count(*) INTO v_owner_count FROM pg_default_acl d
    WHERE d.defaclnamespace='public'::regnamespace
      AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
      AND d.defaclobjtype IN ('r','S');
  IF v_owner_count<>4
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin' AND rolsuper)
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated')
      AND (rolsuper OR rolbypassrls))
  THEN RAISE EXCEPTION 'R01_DEFAULTS_PLATFORM_PREDECESSOR_DRIFT'
    USING errcode='55000'; END IF;

  FOR v_owner IN SELECT unnest(ARRAY['postgres','supabase_admin']) LOOP
    FOREACH v_type IN ARRAY ARRAY['r'::"char",'S'::"char"] LOOP
      SELECT * INTO v_entry FROM pg_default_acl d
      WHERE d.defaclnamespace='public'::regnamespace
        AND pg_get_userbyid(d.defaclrole)=v_owner
        AND d.defaclobjtype=v_type;
      IF NOT FOUND OR v_entry.defaclacl IS NULL
        OR EXISTS(SELECT 1 FROM aclexplode(v_entry.defaclacl) a
          WHERE a.grantee NOT IN ('postgres'::regrole::oid,
            'supabase_admin'::regrole::oid,'anon'::regrole::oid,
            'authenticated'::regrole::oid,'service_role'::regrole::oid)
            OR a.grantor<>v_entry.defaclrole
            OR a.is_grantable)
        OR NOT EXISTS(SELECT 1 FROM aclexplode(v_entry.defaclacl) a
          WHERE a.grantee='anon'::regrole::oid AND a.privilege_type=
            CASE WHEN v_type='r' THEN 'SELECT' ELSE 'USAGE' END)
        OR NOT EXISTS(SELECT 1 FROM aclexplode(v_entry.defaclacl) a
          WHERE a.grantee='authenticated'::regrole::oid AND a.privilege_type=
            CASE WHEN v_type='r' THEN 'SELECT' ELSE 'USAGE' END)
        OR NOT EXISTS(SELECT 1 FROM aclexplode(v_entry.defaclacl) a
          WHERE a.grantee='service_role'::regrole::oid AND a.privilege_type=
            CASE WHEN v_type='r' THEN 'SELECT' ELSE 'USAGE' END)
      THEN RAISE EXCEPTION 'R01_DEFAULTS_ACL_PREDECESSOR_DRIFT: % %',v_owner,v_type
        USING errcode='55000'; END IF;
    END LOOP;

    -- Explicit per-schema grants are the source of the excessive future
    -- table/sequence rights. Existing objects are unaffected.
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',v_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated',v_owner);
  END LOOP;

  -- Fail closed rather than accepting partial default privilege repair.
  IF EXISTS(SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a
    WHERE d.defaclnamespace='public'::regnamespace
      AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
      AND d.defaclobjtype IN ('r','S')
      AND a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid))
    OR (SELECT count(*) FROM pg_default_acl d
      WHERE d.defaclnamespace='public'::regnamespace
        AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
        AND d.defaclobjtype IN ('r','S'))<>4
    OR EXISTS(SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a
      WHERE d.defaclnamespace='public'::regnamespace
        AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
        AND d.defaclobjtype IN ('r','S')
        AND a.grantee='service_role'::regrole::oid
        AND a.privilege_type=CASE WHEN d.defaclobjtype='r'
          THEN 'SELECT' ELSE 'USAGE' END
        GROUP BY d.defaclrole,d.defaclobjtype
        HAVING count(*)<>1)
  THEN RAISE EXCEPTION 'R01_DEFAULTS_POSTCONDITION_FAILED'
    USING errcode='55000'; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.defaclrole,d.defaclnamespace,
       d.defaclobjtype),'[]'::jsonb)
  INTO v_unchanged_after FROM pg_default_acl d
  WHERE NOT(d.defaclnamespace='public'::regnamespace AND
            pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
            AND d.defaclobjtype IN ('r','S'));
  IF v_unchanged_after IS DISTINCT FROM v_unchanged_before
  THEN RAISE EXCEPTION 'R01_DEFAULTS_UNRELATED_ACL_CHANGED'
    USING errcode='55000'; END IF;
END $r01_future$;
COMMIT;
