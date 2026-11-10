-- SOURCE-ONLY incremental R06 terminal-input minimization.
-- The earlier applied dormant package and lifecycle companion stay unchanged.
-- No new user-text deletion deadline, readiness pin, runtime flag or provider call.
DO $source_only$ BEGIN RAISE EXCEPTION 'R06_TERMINAL_INPUT_SOURCE_ONLY'; END $source_only$;
-- R06_TERMINAL_POSTIMAGE private.ai_turn_sweep_v5(timestamp with time zone) 3eb933c2c2cc076cbc7528a7817ed45b
-- R06_TERMINAL_INPUT_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_terminal_owner_guard(metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE p pg_proc%rowtype;
BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('private.ai_turn_sweep_v5(timestamp with time zone)');
 IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM '8228461b045f87eebe7f00c646d99720'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 THEN RAISE EXCEPTION 'R06_TERMINAL_PREIMAGE_DRIFT';END IF;
 INSERT INTO pg_temp.r06_terminal_owner_guard VALUES(to_jsonb(p)-'prosrc');
END $guard$;
CREATE OR REPLACE FUNCTION private.ai_turn_sweep_v5(p_at timestamp with time zone DEFAULT statement_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  -- Maintenance callers can supply an earlier observation time, never a future
  -- authority to fail a live Need, Worker or preselection request.
  v_cutoff timestamptz := least(coalesce(p_at, statement_timestamp()), clock_timestamp()) - interval '10 minutes';
  v_need integer := 0; v_worker integer := 0; v_qa integer := 0; v_review integer := 0; v_errors jsonb := '[]'::jsonb;
begin
  -- A future caller-supplied p_at cannot expire recoverable input. A terminal
  -- request with no canonical copy retains its exact text, not the obsolete
  -- provider prompt, catalog, history and runtime snapshot. No retention
  -- duration, account policy, money, command identity or lease changes here.
  declare
    input_relation text;copy_predicate text;minimize_predicate text;eligible_predicate text;
    candidate record;locked_input record;retained_input jsonb;
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
      -- Only the exact original format and its valid digest are eligible for
      -- minimization. Unknown/corrupt formats remain for explicit diagnosis.
      -- Already minimized rows never consume another bounded cleanup slot.
      minimize_predicate:=$minimize$(t.state<>'PROCESSING' or t.cancelled_at is not null or t.lease_expires_at<=$3)
        and t.prepared_input->>'schemaVersion'='R06_PREPARED_TEXT_V1'
        and jsonb_typeof(t.prepared_input#>'{input,userText}')='string'
        and encode(extensions.digest(t.prepared_input::text,'sha256'),'hex')=t.prepared_input_sha256$minimize$;
      eligible_predicate:=format(
        't.prepared_input is not null and (((t.provider_dispatched or t.state<>''PROCESSING''
         or t.cancelled_at is not null or t.lease_expires_at<=$3) and (%s)) or (%s))',copy_predicate,minimize_predicate);
      for candidate in execute format(
        'select t.account_id,t.conversation_id,t.client_request_id from %s t
         where %s and not private.closure_account_restricted(t.account_id)
          and not exists(select 1 from private.retention_holds h where h.account_id=t.account_id and h.active
            and (h.conversation_id is null or h.conversation_id=t.conversation_id))
         order by (%s) desc nulls last,t.prepared_at,t.turn_id limit 100',input_relation,eligible_predicate,copy_predicate)
         using null::uuid,null::uuid,input_cutoff loop
        -- Preserve the established nonblocking closure -> retention -> row
        -- lock order. Recheck all predicates after acquiring the locks.
        if not pg_try_advisory_xact_lock_shared(private.closure_account_key(candidate.account_id)) then continue;end if;
        if private.closure_account_restricted(candidate.account_id) then continue;end if;
        if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||candidate.account_id::text,0)) then continue;end if;
        if exists(select 1 from private.retention_holds h where h.account_id=candidate.account_id and h.active
          and (h.conversation_id is null or h.conversation_id=candidate.conversation_id)) then continue;end if;
        execute format('select t.prepared_input,t.prepared_input_sha256,(%s) as canonical_copy
          from %s t where t.account_id=$1 and t.client_request_id=$2 and %s for update skip locked',
          copy_predicate,input_relation,eligible_predicate)
          into locked_input using candidate.account_id,candidate.client_request_id,input_cutoff;
        if locked_input.prepared_input is null then continue;end if;
        if locked_input.canonical_copy is true then
          execute format('update %s set prepared_input=null,prepared_input_sha256=null
            where account_id=$1 and client_request_id=$2',input_relation)
            using candidate.account_id,candidate.client_request_id;
        else
          -- The original digest remains an audit reference, not a replacement
          -- provider permission. Read/prepare/dispatch still reject this state;
          -- the retained format has no attempt or source context to replay.
          retained_input:=jsonb_build_object('schemaVersion','R06_RETAINED_TEXT_V1',
            'input',jsonb_build_object('userText',locked_input.prepared_input#>>'{input,userText}'),
            'originalInputSha256',locked_input.prepared_input_sha256);
          execute format('update %s set prepared_input=$3,prepared_input_sha256=$4
            where account_id=$1 and client_request_id=$2',input_relation)
            using candidate.account_id,candidate.client_request_id,retained_input,
              encode(extensions.digest(retained_input::text,'sha256'),'hex');
        end if;
      end loop;
    end loop;
  exception when others then
    -- Roll back this bounded phase on error, preserve the original sweep and
    -- expose no user content in its diagnostic.
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object('turns','PREPARED_INPUT','sqlstate',sqlstate));
  end;
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.
  -- Expiry is still not proof that the provider did not run, so the request itself is never retried:
  -- it stays failed, and only a NEW request from the person can continue the conversation. What changes
  -- is that it stops blocking that conversation and the account's closure forever.
  -- Bound each existing expiry phase and skip busy command rows. A late worker
  -- holding one expired row must not hold the maintenance transaction behind it.
  begin
    with expired as (
      select c.account_id,c.client_request_id from private.ai_need_turn_commands c
       where c.state='PROCESSING' and c.lease_expires_at<v_cutoff
       order by c.lease_expires_at,c.turn_id limit 100 for update skip locked
    )
    update private.ai_need_turn_commands c set state='FAILED',updated_at=clock_timestamp()
     from expired e where c.account_id=e.account_id and c.client_request_id=e.client_request_id
       and c.state='PROCESSING' and c.lease_expires_at<v_cutoff;
    get diagnostics v_need = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'NEED_INTAKE', 'sqlstate', sqlstate));
  end;
  begin
    with expired as (
      select c.turn_id from private.worker_ai_turns c
       where c.state='PROCESSING' and c.lease_expires_at<v_cutoff
       order by c.lease_expires_at,c.turn_id limit 100 for update skip locked
    )
    update private.worker_ai_turns c set state='FAILED'
     from expired e where c.turn_id=e.turn_id and c.state='PROCESSING' and c.lease_expires_at<v_cutoff;
    get diagnostics v_worker = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'WORKER_PROFILE', 'sqlstate', sqlstate));
  end;
  begin
    -- CANCELLED is the existing "this send will never publish anything" state the app already explains.
    with expired as (
      select c.id from private.qa_ai_commands c
       where c.state='PROCESSING' and c.lease_expires_at<v_cutoff
         and not private.closure_account_restricted(c.account_id)
       order by c.lease_expires_at,c.id limit 100 for update skip locked
    )
    update private.qa_ai_commands c set state='CANCELLED',updated_at=clock_timestamp()
     from expired e where c.id=e.id and c.state='PROCESSING' and c.lease_expires_at<v_cutoff
       and not private.closure_account_restricted(c.account_id);
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
 IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM '3eb933c2c2cc076cbc7528a7817ed45b'
  OR (to_jsonb(p)-'prosrc') IS DISTINCT FROM (SELECT metadata FROM pg_temp.r06_terminal_owner_guard)
 THEN RAISE EXCEPTION 'R06_TERMINAL_OWNER_CHANGED';END IF;
END $postflight$;
COMMIT;
