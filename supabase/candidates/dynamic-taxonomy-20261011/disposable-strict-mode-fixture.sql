-- PG16/17 disposable profile/matching fixture only.
\set ON_ERROR_STOP on
ALTER TABLE public.needs ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.needs ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.needs ADD COLUMN IF NOT EXISTS execution_location_mode text;
CREATE TABLE private.worker_execution_mode_choices (
 worker_profile_id uuid PRIMARY KEY,
 worker_account_id uuid NOT NULL UNIQUE,
 modes text[] NOT NULL,
 confirmed_at timestamptz,
 consent_source text
);
INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
VALUES
 (private.taxonomy_normalize_v1('Krečenje zidova'),'Krečenje zidova','ESTABLISHED','SYSTEM',3),
 (private.taxonomy_normalize_v1('Izrada prezentacija'),'Izrada prezentacija','ESTABLISHED','SYSTEM',3);
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 SELECT id,CASE WHEN label='Krečenje zidova' THEN 'ON_SITE' ELSE 'REMOTE' END,
 'DISPOSABLE' FROM private.work_taxonomy_categories
 WHERE label IN('Krečenje zidova','Izrada prezentacija');
INSERT INTO private.worker_execution_mode_choices(
 worker_profile_id,worker_account_id,modes,confirmed_at,consent_source)
VALUES('70000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 ARRAY['ON_SITE','REMOTE'],statement_timestamp(),'WORKER_REVIEW');
INSERT INTO private.work_taxonomy_worker_capabilities(
 worker_account_id,category_id,confirmed_at,excluded,allow_related_offers,origin)
 SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,statement_timestamp(),
 false,false,'WORKER_CONFIRMED' FROM private.work_taxonomy_categories
 WHERE label IN ('Krečenje zidova','Izrada prezentacija');
INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
VALUES('10000000-0000-4000-8000-000000000030',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '20000000-0000-4000-8000-000000000030');
INSERT INTO public.needs(id,category_id,execution_location_mode) VALUES
 ('60000000-0000-4000-8000-000000000001',
 (SELECT id FROM private.work_taxonomy_categories WHERE label='Izrada prezentacija'),'REMOTE'),
 ('60000000-0000-4000-8000-000000000002',
 (SELECT id FROM private.work_taxonomy_categories WHERE label='Krečenje zidova'),'STATIONARY'),
 ('60000000-0000-4000-8000-000000000003',
 (SELECT id FROM private.work_taxonomy_categories WHERE label='Krečenje zidova'),'REMOTE'),
 ('60000000-0000-4000-8000-000000000004',
 (SELECT id FROM private.work_taxonomy_categories WHERE label='Krečenje zidova'),'MULTI_STOP');
INSERT INTO private.work_taxonomy_need_snapshots(
 need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
 source,classification_state,original_category)
 SELECT n.id,1,n.category_id,3,true,'AI_PROPOSED','CONFIRMED',c.label
 FROM public.needs n JOIN private.work_taxonomy_categories c ON c.id=n.category_id
 WHERE n.id IN(
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000004');
