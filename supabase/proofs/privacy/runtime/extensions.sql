-- Platform prerequisites on a newly created local Docker database only.
-- Existing extension ownership is never rewritten to manufacture parity.
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
DO $r01_platform_admission$
BEGIN
  IF current_setting('uskoci.r01.bootstrap', true) IS DISTINCT FROM 'LOCAL_ONLY'
     OR current_user <> 'supabase_admin'
     OR current_database() <> 'postgres'
     OR current_setting('server_version_num') <> '170006'
     OR inet_client_addr() IS NOT NULL
     OR to_regclass('public.needs') IS NOT NULL THEN
    RAISE EXCEPTION 'R01_PLATFORM_NOT_ADMITTED';
  END IF;
END $r01_platform_admission$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog VERSION '1.6.4';
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public VERSION '0.20.4';
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions VERSION '3.3.7';
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault VERSION '0.3.1';

SET LOCAL ROLE postgres;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions VERSION '1.11';
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions VERSION '1.3';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions VERSION '1.1';
RESET ROLE;
COMMIT;
