-- Production bootstrap stage 1. Only for the empty USKOCI production project.
-- Source review must precede a single transactional Supabase migration.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$ BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres'
     OR current_setting('server_version_num')::integer / 10000 <> 17
     OR current_setting('supautils.privileged_role', true) <> 'supabase_privileged_role'
     OR NOT pg_has_role('postgres', 'supabase_privileged_role', 'USAGE')
     OR (SELECT rolsuper FROM pg_roles WHERE rolname='postgres') IS DISTINCT FROM false
     OR (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public') <> 'pg_database_owner'
     OR to_regclass('auth.users') IS NULL
     OR to_regclass('storage.objects') IS NULL
     OR to_regclass('realtime.messages') IS NULL THEN
    RAISE EXCEPTION 'USKOCI_PROD_PLATFORM_PREREQUISITE_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','private','rls_private')
      AND c.relkind IN ('r','p','v','m','f','S','c')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
        AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private','rls_private')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
        AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e')
  ) THEN
    RAISE EXCEPTION 'USKOCI_PROD_APPLICATION_TARGET_NOT_EMPTY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES ('pg_cron','1.6.4'),('pg_net','0.20.4'),('postgis','3.3.7')) expected(name,version)
    WHERE EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname=expected.name)
      OR NOT EXISTS (SELECT 1 FROM pg_available_extension_versions v
        WHERE v.name=expected.name AND v.version=expected.version)
  ) THEN
    RAISE EXCEPTION 'USKOCI_PROD_EXTENSION_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;

CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog VERSION '1.6.4';
CREATE EXTENSION pg_net WITH SCHEMA public VERSION '0.20.4';
CREATE EXTENSION postgis WITH SCHEMA extensions VERSION '3.3.7';

DO $postflight$ BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('pg_cron','pg_catalog','1.6.4'),
      ('pg_net','public','0.20.4'),
      ('postgis','extensions','3.3.7')
    ) expected(name,schema,version)
    LEFT JOIN pg_extension e ON e.extname=expected.name
    LEFT JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.oid IS NULL OR e.extversion<>expected.version OR n.nspname<>expected.schema
  ) THEN
    RAISE EXCEPTION 'USKOCI_PROD_EXTENSION_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
