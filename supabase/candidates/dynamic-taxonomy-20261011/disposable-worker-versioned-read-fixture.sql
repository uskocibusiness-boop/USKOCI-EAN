-- Disposable PostgreSQL 16/17: subset of the actual worker session/read
-- schema sufficient to execute BOTH old-private and new versioned reads.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.ai_conversations(
 id uuid PRIMARY KEY,account_id uuid NOT NULL,
 purpose text NOT NULL,status text NOT NULL);
CREATE TABLE public.app_profiles(
 id uuid PRIMARY KEY,profile_status text NOT NULL);
CREATE TABLE public.ai_messages(
 id uuid,conversation_id uuid,role text,body text,sequence_no integer);
CREATE TABLE private.worker_ai_sessions(
 conversation_id uuid PRIMARY KEY,account_id uuid NOT NULL,
 profile_id uuid NOT NULL,revision integer NOT NULL,candidate jsonb NOT NULL,
 safety text NOT NULL,base_hash text NOT NULL);
CREATE TABLE private.worker_ai_turns(
 turn_id uuid,conversation_id uuid,created_at timestamptz);
CREATE TABLE private.worker_ai_reviews(
 id uuid PRIMARY KEY,account_id uuid NOT NULL,conversation_id uuid NOT NULL,
 envelope jsonb NOT NULL,created_at timestamptz NOT NULL);
CREATE TABLE private.worker_ai_saves(
 review_id uuid,account_id uuid,receipt jsonb,created_at timestamptz);
CREATE FUNCTION private.worker_ai_source_hash(p_account_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$SELECT 'base-1'::text$$;
CREATE FUNCTION private.worker_ai_turn_document(p_turn_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT NULL::jsonb$$;
INSERT INTO public.ai_conversations VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','PROFILE','COMPLETED'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','PROFILE','COMPLETED');
INSERT INTO public.app_profiles VALUES
 ('22222222-2222-4222-8222-222222222222','ACTIVE');
INSERT INTO private.worker_ai_sessions VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',3,'{"skills":["Casovi matematike"]}'::jsonb,'ALLOW','base-1'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',2,'{"skills":["Casovi matematike"]}'::jsonb,'ALLOW','base-1');
-- First conversation is already saved using the NEW signed review.
INSERT INTO private.worker_ai_reviews VALUES
 ('33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '{"reviewId":"33333333-3333-4333-8333-333333333333",
  "classificationState":"READY","reviewedServiceModes":[{"service":"Casovi matematike","mode":"ON_SITE"}]}'::jsonb,
  statement_timestamp());
INSERT INTO private.worker_ai_saves VALUES(
 '33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 '{"reviewId":"33333333-3333-4333-8333-333333333333","saved":true}'::jsonb,
 statement_timestamp());
-- Second conversation has only a saved OLD-compatible review.
INSERT INTO private.worker_ai_reviews VALUES
 ('44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '{"reviewId":"44444444-4444-4444-8444-444444444444"}'::jsonb,
  statement_timestamp());
INSERT INTO private.worker_ai_saves VALUES(
 '44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 '{"reviewId":"44444444-4444-4444-8444-444444444444","saved":true}'::jsonb,
 statement_timestamp());
