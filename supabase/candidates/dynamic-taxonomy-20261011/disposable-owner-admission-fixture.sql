-- Disposable PostgreSQL test fixture for owner-approved P1 admission.
-- Intentionally NO DEV, external APIs, pushes or user data.
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('test.auth_uid',true),'')::uuid $$;
CREATE TABLE IF NOT EXISTS private.work_taxonomy_category_modes (
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 execution_scope text NOT NULL CHECK (execution_scope IN ('REMOTE','ON_SITE')),
 source_ref text NOT NULL,
 mapped_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(category_id,execution_scope)
);
CREATE TABLE private.worker_ai_reviews (
  id uuid PRIMARY KEY,account_id uuid NOT NULL,envelope jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE private.ai_task_reviews (
  id uuid PRIMARY KEY,account_id uuid NOT NULL,envelope jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
-- Persist the same proof identity in a disposable owner-reviewed profile and need review.
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,expires_at) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('a',64)),
  now()+interval '2 hours'
);
INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at) VALUES (
  '10000000-0000-4000-8000-000000000002',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('b',64)),
  now()+interval '2 hours'
);
INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
VALUES(private.taxonomy_normalize_v1('Uređenje prostora'),'Uređenje prostora','ESTABLISHED','SYSTEM',3);
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT id,'ON_SITE','DISPOSABLE_FOUNDER' FROM private.work_taxonomy_categories
WHERE canonical_key=private.taxonomy_normalize_v1('Uređenje prostora');
UPDATE private.work_taxonomy_control SET catalog_version=3 WHERE singleton;
