-- Disposable PostgreSQL fixture. No app/device connections.
\set ON_ERROR_STOP on
CREATE TABLE public.app_profiles (
 account_id uuid PRIMARY KEY, kind text NOT NULL, skills text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS private.work_taxonomy_category_modes (
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 execution_scope text NOT NULL CHECK (execution_scope IN ('ON_SITE','REMOTE')),
 source_ref text NOT NULL,
 PRIMARY KEY(category_id,execution_scope)
);
CREATE TABLE private.work_taxonomy_related_acceptances (
 worker_account_id uuid NOT NULL,
 source_category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 PRIMARY KEY(worker_account_id,source_category_id)
);
-- Do not contact real dispatchers. Test the existing interface only.
CREATE OR REPLACE FUNCTION private.requeue_open_needs_for_worker_v5(p_account_id uuid)
RETURNS integer LANGUAGE sql AS $$ SELECT 0::integer $$;
INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
VALUES
 (private.taxonomy_normalize_v1('Krečenje zidova'),'Krečenje zidova','ESTABLISHED','SYSTEM',1),
 (private.taxonomy_normalize_v1('Izrada prezentacija'),'Izrada prezentacija','ESTABLISHED','SYSTEM',1);
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 SELECT id,CASE WHEN label='Krečenje zidova' THEN 'ON_SITE' ELSE 'REMOTE' END,'DISPOSABLE'
 FROM private.work_taxonomy_categories;
INSERT INTO public.app_profiles(account_id,kind,skills)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WORKER',
ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']);
