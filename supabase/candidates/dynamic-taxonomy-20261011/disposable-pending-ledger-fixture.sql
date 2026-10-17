-- Synthetic fixture only; no live Supabase, app clients or notifications.
\set ON_ERROR_STOP on
CREATE SCHEMA private;
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;
CREATE TABLE private.worker_ai_reviews(id uuid PRIMARY KEY,account_id uuid,envelope jsonb NOT NULL);
CREATE TABLE private.ai_task_reviews(id uuid PRIMARY KEY,account_id uuid,envelope jsonb NOT NULL);
CREATE TABLE private.worker_ai_saves(review_id uuid,account_id uuid,client_request_id uuid,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp());
CREATE TABLE private.ai_task_review_commands(review_id uuid,account_id uuid,client_request_id uuid,
 state text,created_at timestamptz NOT NULL DEFAULT statement_timestamp());