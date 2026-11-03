-- Current managed metadata reconstruction, not an application migration.
-- Source: supabase/auth v2.196.0 internal/indexworker/indexworker.go.
-- These four definitions match the immutable DEV catalog capture; the upstream
-- opt-in index worker is disabled by default in this local CLI stack.
-- A fresh empty disposable database permits synchronous, atomic creation.
BEGIN;
-- Use the already admitted local maintenance session; no Auth password is read.
SET LOCAL ROLE supabase_auth_admin;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
DO $r01_auth_index_admission$
BEGIN
  IF current_setting('uskoci.r01.bootstrap', true) IS DISTINCT FROM 'LOCAL_ONLY'
     OR current_user <> 'supabase_auth_admin'
     OR session_user <> 'supabase_admin'
     OR current_database() <> 'postgres'
     OR current_setting('server_version_num') <> '170006'
     OR inet_client_addr() IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relname='needs')
     OR EXISTS (SELECT 1 FROM auth.users)
     OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    JOIN pg_roles r ON r.oid=c.relowner
                    WHERE n.nspname='auth' AND c.relname='users'
                      AND r.rolname=current_user AND c.relkind='r') THEN
    RAISE EXCEPTION 'R01_AUTH_INDEX_NOT_ADMITTED';
  END IF;
END $r01_auth_index_admission$;

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);
CREATE INDEX idx_users_email ON auth.users USING btree (email);
CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);
CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text)))
  WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);
COMMIT;
