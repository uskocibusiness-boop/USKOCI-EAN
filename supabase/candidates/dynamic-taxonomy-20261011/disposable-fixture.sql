-- Disposable PostgreSQL ONLY. There is intentionally no outbound API/Edge/push.
CREATE SCHEMA IF NOT EXISTS private;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   CREATE ROLE service_role NOLOGIN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   CREATE ROLE authenticated NOLOGIN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   CREATE ROLE anon NOLOGIN;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.needs (id uuid PRIMARY KEY);
