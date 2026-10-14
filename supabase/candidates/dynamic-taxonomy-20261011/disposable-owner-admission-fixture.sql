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
  base_hash text NOT NULL DEFAULT 'disposable-base-hash',
  expires_at timestamptz NOT NULL
);
CREATE TABLE private.ai_task_reviews (
 id uuid PRIMARY KEY,account_id uuid NOT NULL,envelope jsonb NOT NULL,
 policy_binding jsonb NOT NULL DEFAULT '{}'::jsonb,
 expires_at timestamptz NOT NULL
);
CREATE TABLE private.worker_ai_saves(
 review_id uuid NOT NULL, account_id uuid NOT NULL, client_request_id uuid NOT NULL,
 receipt jsonb NOT NULL DEFAULT '{}'::jsonb,PRIMARY KEY(review_id,account_id,client_request_id)
);
CREATE TABLE private.ai_task_review_commands(
 review_id uuid NOT NULL, account_id uuid NOT NULL,client_request_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'ACCEPTED', PRIMARY KEY(review_id,account_id,client_request_id)
);
-- ONLY the isolated fixture simulates a review prepared from a fully built
-- server-owned envelope. Production must extend the two canonical review
-- preparers BEFORE their displayedContentDigest is calculated.
CREATE OR REPLACE FUNCTION private.disposable_bind_classification_review(
 p_purpose text,p_review_id uuid,p_plan jsonb
) RETURNS text LANGUAGE plpgsql AS $bind$
DECLARE e jsonb;b text;pol jsonb;d text;
BEGIN
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT envelope,base_hash INTO STRICT e,b FROM private.worker_ai_reviews
  WHERE id=p_review_id;
  e:=(e-'displayedContentDigest')||jsonb_build_object('classificationProposal',p_plan);
  d:=encode(extensions.digest((e||jsonb_build_object('baseHash',b))::text,'sha256'),'hex');
  UPDATE private.worker_ai_reviews SET envelope=e||jsonb_build_object('displayedContentDigest',d)
  WHERE id=p_review_id;
 ELSIF p_purpose='NEED_SERVICE' THEN
  SELECT envelope,policy_binding INTO STRICT e,pol FROM private.ai_task_reviews
  WHERE id=p_review_id;
  e:=(e-'displayedContentDigest')||jsonb_build_object('classificationProposal',p_plan);
  d:=encode(extensions.digest(jsonb_build_object('envelope',e,'policy',pol)::text,'sha256'),'hex');
  UPDATE private.ai_task_reviews SET envelope=e||jsonb_build_object('displayedContentDigest',d)
  WHERE id=p_review_id;
 ELSE RAISE EXCEPTION 'UNKNOWN_FIXTURE_PURPOSE'; END IF;
 RETURN d;
END $bind$;

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
-- Separate immutable review IDs for each negative scenario.
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,expires_at) VALUES
 ('10000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('c',64)),now()+interval '2 hours');
INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at) VALUES
 ('10000000-0000-4000-8000-000000000004',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('d',64)),now()+interval '2 hours'),
 ('10000000-0000-4000-8000-000000000005',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('e',64)),now()+interval '2 hours'),
 ('10000000-0000-4000-8000-000000000006',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('f',64)),now()+interval '2 hours');
INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
VALUES(private.taxonomy_normalize_v1('Uređenje prostora'),'Uređenje prostora','ESTABLISHED','SYSTEM',3);
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT id,'ON_SITE','DISPOSABLE_FOUNDER' FROM private.work_taxonomy_categories
WHERE canonical_key=private.taxonomy_normalize_v1('Uređenje prostora');
UPDATE private.work_taxonomy_control SET catalog_version=3 WHERE singleton;
