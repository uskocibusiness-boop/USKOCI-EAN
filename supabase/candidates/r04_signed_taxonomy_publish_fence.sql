-- R04/F05 SOURCE ONLY / UNAPPLIED: server-side signed-review publication fence.
-- DEV predecessor prosrc MD5 610a2f0eb6a8cf5ba5e53cd750bdc438.
-- Preserve existing legacy reviews, accepted private DRAFT, owner and receipt.
BEGIN;
DO $r04$
BEGIN
 IF current_setting('uskoci.r04.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_user<>'postgres' OR current_database()<>'postgres'
    OR to_regrole('cli_login_postgres') IS NOT NULL THEN
    RAISE EXCEPTION 'R04_PUBLISH_DISPOSABLE_ONLY' USING errcode='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p
   WHERE p.oid=to_regprocedure('public.rpc_publish_accepted_ai_task_review(uuid,uuid)')
    AND md5(p.prosrc)='610a2f0eb6a8cf5ba5e53cd750bdc438'
    AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
    AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
    AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R04_PUBLISH_SOURCE_OR_METADATA_DRIFT' USING errcode='55000'; END IF;
 IF private.retention_ai_source_ready() IS DISTINCT FROM TRUE OR
    private.closure_source_digest_v5() IS DISTINCT FROM
      (SELECT sha256 FROM private.closure_source_v5 WHERE singleton) THEN
    RAISE EXCEPTION 'R04_PUBLISH_CLOSURE_NOT_READY' USING errcode='55000'; END IF;
END; $r04$;
CREATE TEMP TABLE r04_publish_before ON COMMIT DROP AS
 SELECT oid,to_jsonb(p) attributes FROM pg_proc
 WHERE oid='public.rpc_publish_accepted_ai_task_review(uuid,uuid)'::regprocedure;
CREATE OR REPLACE FUNCTION public.rpc_publish_accepted_ai_task_review(p_review_id uuid, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); r private.ai_task_reviews; c private.ai_task_review_commands; v_published jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=u;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into c from private.ai_task_review_commands where review_id=r.id and account_id=u for update;
 if not found or c.client_request_id is distinct from p_client_request_id then raise exception 'TASK_REVIEW_COMMAND_MISMATCH' using errcode='42501'; end if;
 if c.state='PUBLISHED' then return private.ai_task_review_command_document(r.id); end if;
 -- R04/F05: a signed taxonomy review that is not READY may save a PRIVATE
 -- draft, but never publish for matching even if a stale/evaluated command
 -- previously obtained ALLOW. Legacy reviews without this additive field keep
 -- their existing compatibility path; no model hint overrides its own review.
 if r.envelope ? 'classificationState'
   and r.envelope->>'classificationState' is distinct from 'READY' then
   raise exception 'TASK_CLASSIFICATION_NOT_READY' using errcode='55000';
 end if;
 if c.state<>'EVALUATED' or c.evaluation#>>'{decision,outcome}' is distinct from 'ALLOW' then raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='55000'; end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='PT409'; end if;
 v_published:=public.rpc_publish_need_canonical(c.need_id,c.need_revision,(c.evaluation#>>'{decision,decisionSequence}')::bigint,
  (r.envelope->>'responseDeadline')::timestamptz,'v5-publish:'||r.id::text);
 update private.ai_task_review_commands set state='PUBLISHED',published=v_published where review_id=r.id;
 return private.ai_task_review_command_document(r.id);
end $function$
DO $r04$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM r04_publish_before b JOIN pg_proc p ON p.oid=b.oid
    WHERE to_jsonb(p)-'prosrc' IS NOT DISTINCT FROM b.attributes-'prosrc') THEN
    RAISE EXCEPTION 'R04_PUBLISH_ATTRIBUTES_CHANGED' USING errcode='55000'; END IF;
 IF private.retention_ai_source_ready() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'R04_PUBLISH_CLOSURE_MOVED' USING errcode='55000'; END IF;
END; $r04$;
COMMIT;
