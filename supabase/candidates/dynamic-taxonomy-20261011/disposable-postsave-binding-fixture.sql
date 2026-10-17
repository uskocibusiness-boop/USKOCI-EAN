-- Disposable PG fixture uses the signed worker binder fixture; no DEV writes.
CREATE TABLE private.work_taxonomy_review_outbox_v1(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 owner_account_id uuid NOT NULL,request_key uuid NOT NULL,
 source_review_id uuid NOT NULL,purpose text NOT NULL,state text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp());
CREATE TABLE private.ai_task_review_commands(
 review_id uuid,account_id uuid,client_request_id uuid,
 need_id uuid,need_revision integer,state text,created_at timestamptz);
INSERT INTO private.work_taxonomy_review_outbox_v1
 (id,owner_account_id,request_key,source_review_id,purpose,state) VALUES(
 'aaaa0000-0000-4000-8000-000000000001',
 '11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555',
 '44444444-4444-4444-8444-444444444444',
 'WORKER_CAPABILITY','COMMITTED');
