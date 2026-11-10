-- SOURCE-ONLY code rollback for the incremental R06 minimization.
-- Preserves retained text, original hashes and all command/provider identities.
-- It never reconstructs removed provider context or permits another dispatch.
DO $source_only$ BEGIN RAISE EXCEPTION 'R06_TERMINAL_ROLLBACK_SOURCE_ONLY'; END $source_only$;
-- R06_TERMINAL_ROLLBACK_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_terminal_rollback_owner(metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE p pg_proc%rowtype;
BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('private.ai_turn_sweep_v5(timestamp with time zone)');
 IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM '3eb933c2c2cc076cbc7528a7817ed45b'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 THEN RAISE EXCEPTION 'R06_TERMINAL_ROLLBACK_PREIMAGE_DRIFT';END IF;
 INSERT INTO pg_temp.r06_terminal_rollback_owner VALUES(to_jsonb(p)-'prosrc');
END $guard$;
CREATE OR REPLACE FUNCTION private.ai_turn_sweep_v5(p_at timestamp with time zone DEFAULT statement_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_cutoff timestamptz := coalesce(p_at, statement_timestamp()) - interval '10 minutes';
  v_need integer := 0; v_worker integer := 0; v_qa integer := 0; v_review integer := 0; v_errors jsonb := '[]'::jsonb;
begin
  -- Cleanup precedes legacy state transitions. A future caller-supplied p_at
  -- cannot itself expire a still-recoverable snapshot in this new phase.
  declare
    input_relation text;copy_predicate text;candidate record;locked_input boolean;
    input_cutoff timestamptz:=least(coalesce(p_at,statement_timestamp()),clock_timestamp());
  begin
    foreach input_relation in array array['private.ai_need_turn_commands','private.worker_ai_turns'] loop
      copy_predicate:=case when input_relation='private.ai_need_turn_commands' then
        $copy$t.state='SUCCEEDED' and t.receipt->'authoritative'='true'::jsonb
          and exists(select 1 from public.ai_messages m where m.id=case
           when (t.receipt->>'userMessageId')~*'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
           then (t.receipt->>'userMessageId')::uuid else null end
           and m.account_id=t.account_id and m.conversation_id=t.conversation_id and m.role='USER'
           and m.body=t.prepared_input#>>'{input,userText}')$copy$
        else $copy$exists(select 1 from public.ai_messages m where m.id=t.user_message_id
           and m.account_id=t.account_id and m.conversation_id=t.conversation_id and m.role='USER'
           and m.body=t.prepared_input#>>'{input,userText}')$copy$ end;
      for candidate in execute format(
        'select t.account_id,t.conversation_id,t.client_request_id from %s t
         where t.prepared_input is not null and (t.provider_dispatched or t.state<>''PROCESSING''
          or t.cancelled_at is not null or t.lease_expires_at<=$1) and (%s)
          and not private.closure_account_restricted(t.account_id)
          and not exists(select 1 from private.retention_holds h where h.account_id=t.account_id and h.active
            and (h.conversation_id is null or h.conversation_id=t.conversation_id))
         order by t.prepared_at,t.turn_id limit 100',input_relation,copy_predicate) using input_cutoff loop
        -- Closure uses an exclusive account lock; try the same shared lock as
        -- normal writes before retention and row locks, without waiting.
        if not pg_try_advisory_xact_lock_shared(private.closure_account_key(candidate.account_id)) then continue;end if;
        if private.closure_account_restricted(candidate.account_id) then continue;end if;
        if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||candidate.account_id::text,0)) then continue;end if;
        if exists(select 1 from private.retention_holds h where h.account_id=candidate.account_id and h.active
          and (h.conversation_id is null or h.conversation_id=candidate.conversation_id)) then continue;end if;
        execute format('select true from %s t where t.account_id=$1 and t.client_request_id=$2
          and t.prepared_input is not null and (t.provider_dispatched or t.state<>''PROCESSING''
           or t.cancelled_at is not null or t.lease_expires_at<=$3) and (%s) for update skip locked',input_relation,copy_predicate)
          into locked_input using candidate.account_id,candidate.client_request_id,input_cutoff;
        if locked_input is distinct from true then continue;end if;
        execute format('update %s set prepared_input=null,prepared_input_sha256=null
          where account_id=$1 and client_request_id=$2',input_relation)
          using candidate.account_id,candidate.client_request_id;
      end loop;
    end loop;
  exception when others then
    -- Roll back this bounded cleanup phase on error, leave original sweep work
    -- running, and surface a content-free diagnostic for the current owner.
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object('turns','PREPARED_INPUT','sqlstate',sqlstate));
  end;
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.
  -- Expiry is still not proof that the provider did not run, so the request itself is never retried:
  -- it stays failed, and only a NEW request from the person can continue the conversation. What changes
  -- is that it stops blocking that conversation and the account's closure forever.
  begin
    update private.ai_need_turn_commands set state = 'FAILED', updated_at = clock_timestamp()
     where state = 'PROCESSING' and lease_expires_at < v_cutoff;
    get diagnostics v_need = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'NEED_INTAKE', 'sqlstate', sqlstate));
  end;
  begin
    update private.worker_ai_turns set state = 'FAILED'
     where state = 'PROCESSING' and lease_expires_at < v_cutoff;
    get diagnostics v_worker = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'WORKER_PROFILE', 'sqlstate', sqlstate));
  end;
  begin
    -- CANCELLED is the existing "this send will never publish anything" state the app already explains.
    update private.qa_ai_commands set state = 'CANCELLED', updated_at = clock_timestamp()
     where state = 'PROCESSING' and lease_expires_at < v_cutoff
       and not private.closure_account_restricted(account_id);
    get diagnostics v_qa = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'PRESELECTION_QA', 'sqlstate', sqlstate));
  end;
  -- PKG-037: a publication claim cannot complete after its 60-second lease.
  -- End expired attempts without a decision, another paid request or any refund.
  -- Lock only a bounded batch; an in-flight completion wins or is fenced by state.
  begin
    with expired as (
      select c.review_id from private.ai_task_review_commands c
       where c.state = 'EVALUATING'
         and c.lease_expires_at <= least(coalesce(p_at, statement_timestamp()), clock_timestamp())
       order by c.lease_expires_at, c.review_id limit 100 for update skip locked
    )
    update private.ai_task_review_commands c set state = 'EVALUATED',
      evaluation = jsonb_build_object('kind','NOT_READY','needId',c.need_id,
        'needRevision',c.need_revision,'authoritativeDecision',false,'code','EVALUATOR_UNAVAILABLE'),
      evaluation_result_hash = encode(extensions.digest(jsonb_build_object(
        'outcome',null,'rules','[]'::jsonb,'reasons','[]'::jsonb,'provider',null,'model',null,
        'notReady','EVALUATOR_UNAVAILABLE')::text,'sha256'),'hex')
     where c.review_id in (select review_id from expired) and c.state = 'EVALUATING';
    get diagnostics v_review = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns','PUBLICATION_REVIEW','sqlstate',sqlstate));
  end;
  return jsonb_build_object('needTurnsFailed', v_need, 'workerTurnsFailed', v_worker,
    'qaCommandsCancelled', v_qa, 'reviewEvaluationsStopped', v_review, 'graceMinutes', 10, 'errors', v_errors);
end
$function$;

DO $postflight$
DECLARE p pg_proc%rowtype;
BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('private.ai_turn_sweep_v5(timestamp with time zone)');
 IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM '8228461b045f87eebe7f00c646d99720'
  OR (to_jsonb(p)-'prosrc') IS DISTINCT FROM (SELECT metadata FROM pg_temp.r06_terminal_rollback_owner)
 THEN RAISE EXCEPTION 'R06_TERMINAL_ROLLBACK_OWNER_CHANGED';END IF;
END $postflight$;
COMMIT;
