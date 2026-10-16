-- Disposable PostgreSQL 16/17 proof. Isolated fake tables + fake enqueue only.
-- In this test, no service, push or application user can be contacted.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA private;
CREATE TABLE public.needs(
  id uuid PRIMARY KEY,requester_account_id uuid,revision integer,
  category_id uuid,status text,remaining_search_closed_at timestamptz,
  response_deadline timestamptz
);
CREATE TABLE private.work_taxonomy_need_snapshots(
  need_id uuid,need_revision integer,category_id uuid,
  reviewed_by_requester boolean,classification_state text
);
CREATE TABLE public.app_profiles(
  id uuid,account_id uuid,kind text,profile_status text
);
CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(
  worker_account_id uuid,source_review_id uuid,source_request_key uuid,active boolean
);
CREATE TABLE private.work_taxonomy_need_bindings_v1(
  need_id uuid,need_revision integer,category_id uuid,owner_account_id uuid,
  result jsonb
);
CREATE TABLE private.work_taxonomy_worker_bindings_v1(
  profile_id uuid,owner_account_id uuid,source_review_id uuid,request_key uuid,
  result jsonb
);
CREATE TABLE private.proof_enqueues(cause text,entity uuid);
CREATE FUNCTION private.enqueue_dispatch(nid uuid,at timestamptz) RETURNS void
 LANGUAGE sql AS $$
 INSERT INTO private.proof_enqueues VALUES('NEED',nid);
 $$;
CREATE FUNCTION private.requeue_open_needs_for_worker_v5(acc uuid) RETURNS integer
 LANGUAGE plpgsql AS $$
 BEGIN INSERT INTO private.proof_enqueues VALUES('WORKER',acc); RETURN 1; END $$;
\ir signed-binding-requeue-dev-v1.sql
DO $proof$
DECLARE owner uuid:='11111111-1111-4111-8111-111111111111';
        need uuid:='22222222-2222-4222-8222-222222222222';
        cat uuid:='33333333-3333-4333-8333-333333333333';
        profile uuid:='44444444-4444-4444-8444-444444444444';
        rev uuid:='55555555-5555-4555-8555-555555555555';
        key uuid:='66666666-6666-4666-8666-666666666666';
        ok jsonb:='{"status":"BOUND_NEED_REVISION","dispatchAuthority":"NONE","notificationAuthority":"NONE"}'::jsonb;
        wok jsonb:='{"status":"BOUND_WORKER_SERVICES","dispatchAuthority":"NONE","notificationAuthority":"NONE"}'::jsonb;
BEGIN
 INSERT INTO public.needs(id,requester_account_id,revision,category_id,status)
 VALUES(need,owner,1,cat,'PUBLISHED');
 INSERT INTO private.work_taxonomy_need_snapshots
 VALUES(need,1,cat,true,'CONFIRMED');
 INSERT INTO private.work_taxonomy_need_bindings_v1
 VALUES(need,1,cat,owner,ok);
 IF (SELECT count(*) FROM private.proof_enqueues WHERE cause='NEED')<>1 THEN
  RAISE EXCEPTION 'VALID_SIGNED_NEED_MUST_REQUEUE'; END IF;
 DELETE FROM private.proof_enqueues;
 -- Mismatched category, missing current revision or pending classification
 -- must NOT schedule any work.
 INSERT INTO private.work_taxonomy_need_bindings_v1
 VALUES(need,1,'77777777-7777-4777-8777-777777777777',owner,ok);
 UPDATE private.work_taxonomy_need_snapshots SET classification_state='PENDING_CLASSIFICATION';
 INSERT INTO private.work_taxonomy_need_bindings_v1
 VALUES(need,1,cat,owner,ok);
 IF EXISTS (SELECT 1 FROM private.proof_enqueues) THEN
  RAISE EXCEPTION 'UNCONFIRMED_NEED_SCHEDULED'; END IF;
 UPDATE private.work_taxonomy_need_snapshots SET classification_state='CONFIRMED';
 UPDATE public.needs SET status='DRAFT';
 INSERT INTO private.work_taxonomy_need_bindings_v1 VALUES(need,1,cat,owner,ok);
 IF EXISTS (SELECT 1 FROM private.proof_enqueues) THEN
  RAISE EXCEPTION 'DRAFT_NEED_SCHEDULED'; END IF;
 UPDATE public.needs SET status='SELECTION';
 INSERT INTO private.work_taxonomy_need_bindings_v1 VALUES(need,1,cat,owner,ok);
 IF (SELECT count(*) FROM private.proof_enqueues WHERE cause='NEED')<>1 THEN
  RAISE EXCEPTION 'SIGNED_SELECTION_NEED_MUST_REQUEUE'; END IF;
 DELETE FROM private.proof_enqueues;
 -- Fake signed worker authority can requeue; no signed mode = no requeue.
 INSERT INTO public.app_profiles VALUES(profile,owner,'WORKER','ACTIVE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1
 VALUES(profile,owner,rev,key,wok);
 IF EXISTS (SELECT 1 FROM private.proof_enqueues) THEN
  RAISE EXCEPTION 'WORKER_WITHOUT_SIGNED_MODE_SCHEDULED'; END IF;
 INSERT INTO private.taxonomy_confirmed_worker_modes_v1 VALUES(owner,rev,key,true);
 INSERT INTO private.work_taxonomy_worker_bindings_v1 VALUES(profile,owner,rev,key,wok);
 IF (SELECT count(*) FROM private.proof_enqueues WHERE cause='WORKER')<>1 THEN
  RAISE EXCEPTION 'SIGNED_WORKER_MUST_REQUEUE'; END IF;
 DELETE FROM private.proof_enqueues;
 INSERT INTO private.work_taxonomy_worker_bindings_v1
 VALUES(profile,owner,rev,key,'{"status":"BOUND_WORKER_SERVICES","dispatchAuthority":"SENT","notificationAuthority":"NONE"}');
 IF EXISTS (SELECT 1 FROM private.proof_enqueues) THEN
  RAISE EXCEPTION 'UNSAFE_BINDER_AUTHORITY_SCHEDULED'; END IF;
 RAISE NOTICE 'SIGNED_BINDING_REQUEUE_PG_PROOF_PASS';
END $proof$;
ROLLBACK;
