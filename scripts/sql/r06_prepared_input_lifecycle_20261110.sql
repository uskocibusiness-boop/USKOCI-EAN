-- SOURCE-ONLY companion to the bounded R06 prepared-input contract.
-- Recovery input is temporary only after an exact canonical copy of the user
-- text exists. No policy duration, readiness pin or flag is changed.
DO $source_only$ BEGIN RAISE EXCEPTION 'R06_PREPARED_PRIVACY_SOURCE_ONLY'; END $source_only$;
-- R06_LIFECYCLE_POSTIMAGE public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text) 8b57176c233118baea5981673a0c0920
-- R06_LIFECYCLE_POSTIMAGE private.ai_turn_sweep_v5(timestamp with time zone) 8228461b045f87eebe7f00c646d99720
-- R06_LIFECYCLE_POSTIMAGE private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone) 229bae101282b7e283a658da9a2ca597
-- R06_PREPARED_PRIVACY_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_privacy_owner_guard(signature text primary key,metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE x record;p pg_proc%rowtype;
BEGIN
 FOR x IN SELECT * FROM (VALUES
  ('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)','f34a5a16d9a0361c6503d05b46d6f6d7'),
  ('private.ai_turn_sweep_v5(timestamp with time zone)','9d89b9af2e893bc608e7598d175551b7'),
  ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','e38d4cc8b0e780dc49887ba41a8086fa')
 ) v(signature,body_md5) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM x.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR p.proacl::text IS DISTINCT FROM (CASE WHEN x.signature LIKE 'public.%'
    THEN '{postgres=X/postgres,service_role=X/postgres}' ELSE '{postgres=X/postgres}' END)
  THEN RAISE EXCEPTION 'R06_PRIVACY_PREIMAGE_DRIFT:%',x.signature;END IF;
  INSERT INTO pg_temp.r06_privacy_owner_guard VALUES(x.signature,to_jsonb(p)-'prosrc');
 END LOOP;
END $guard$;

-- The old dispatch owner records permission first. The frozen local variable
-- still supplies the exact response to Edge; an unknown ACK remains READ_ONLY.
-- Never wait for a retention lock after command/budget locks. A conflicting
-- hold/cleanup transaction leaves the input for the existing sweep instead.
DO $dispatch$
DECLARE d text;old_text text:=$old$ RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);$old$;
BEGIN
 d:=pg_get_functiondef('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$ IF p_purpose='WORKER_CAPABILITY'
  AND pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0)) THEN
  -- Read held state in a separate volatile statement after acquiring the lock;
  -- a just-committed hold must not be hidden by the pre-acquire snapshot.
  IF NOT EXISTS(SELECT 1 FROM private.retention_holds WHERE account_id=p_account_id AND active
   AND (conversation_id IS NULL OR conversation_id=p_conversation_id))
  AND EXISTS(SELECT 1 FROM private.worker_ai_turns t JOIN public.ai_messages m ON m.id=t.user_message_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id AND t.client_request_id=p_client_request_id
    AND t.attempt_id=p_attempt_id AND m.account_id=t.account_id AND m.conversation_id=t.conversation_id
    AND m.role='USER' AND m.body=snapshot#>>'{input,userText}') THEN
  UPDATE private.worker_ai_turns SET prepared_input=NULL,prepared_input_sha256=NULL
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id AND client_request_id=p_client_request_id
    AND attempt_id=p_attempt_id AND provider_dispatched AND prepared_input_sha256=p_input_sha256;
  END IF;
 END IF;
 RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);$new$);
END $dispatch$;

-- Reuse the existing scheduled sweep; no second scheduler or new retention
-- duration. Cleanup does not settle money, delete command identities, renew a
-- lease, change its state or clear the provider marker. Closure keeps its own
-- certified executor for restricted accounts, and active holds retain copies.
-- Need has no canonical user message until completion. Its unconfirmed text
-- remains retained/exportable here even after dispatch, failure or expiry.
DO $sweep$
DECLARE d text;old_text text:=$old$begin
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.$old$;
BEGIN
 d:=pg_get_functiondef('private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$begin
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
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.$new$);
END $sweep$;

-- The pending user text can exist only in this recovery copy, so preserve its
-- subject-export coverage. Prompts, public catalog/schema, internal runtime and
-- provider reservation metadata are not personal input datasets.
DO $export$
DECLARE d text;old_text text:=$old$'preparedInput',t.prepared_input,'preparedAt',t.prepared_at$old$;
BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>2*length(old_text) THEN RAISE EXCEPTION 'R06_PRIVACY_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$'preparedInput',CASE WHEN t.prepared_input IS NULL THEN NULL ELSE jsonb_build_object('userText',t.prepared_input#>>'{input,userText}') END,'preparedAt',t.prepared_at$new$);
END $export$;

DO $metadata$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.r06_privacy_owner_guard g JOIN pg_proc p ON p.oid=to_regprocedure(g.signature)
  WHERE (to_jsonb(p)-'prosrc') IS DISTINCT FROM g.metadata)
 THEN RAISE EXCEPTION 'R06_PRIVACY_OWNER_METADATA_CHANGED';END IF;
END $metadata$;
COMMIT;
