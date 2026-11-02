BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_COMPLETE_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='1276b7b6b562bf0c29534c4ad9bdc7d3' AND to_jsonb(p)-'prosrc'='{"oid":"21158","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_apply_interview_turn_v2_service","prorows":0,"pronargs":6,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_COMPLETE_FUNCTION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='ff2be465f91497787558d9d1a5cecdba' AND to_jsonb(p)-'prosrc'='{"oid":"22494","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_complete_need_turn_v2_service","prorows":0,"pronargs":8,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_client_request_id","p_attempt_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_COMPLETE_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source(uuid)'))) IS DISTINCT FROM '26a2977f90d790d6746df0c7dcfc7635' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source_before_media(uuid)'))) IS DISTINCT FROM 'd6ba809f15d478eb52a7ed288a99760a' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_erasure_program_digest_v5()'))) IS DISTINCT FROM 'e11cc0b1eb33e63d182247424e4027bd' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_schema_digest_v5_139()'))) IS DISTINCT FROM '5165a1c4787401db76b0a5cc894731e0' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_source_digest_v5()'))) IS DISTINCT FROM '3754d150d83b916422e184a50e5bd126' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'))) IS DISTINCT FROM 'c363facdb26d33ae872e25e6a79e4306' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef('private.validate_need_v2_fact(text,jsonb)'::regprocedure))<>'20e2800046e49187eb96349d9b329e2e' THEN RAISE EXCEPTION 'R06_COMPLETE_VALIDATOR_DRIFT';END IF;
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY fact_key) FROM private.need_fact_registry r) IS DISTINCT FROM '[{"fact_key":"need.access_notes","material":true,"value_type":"TEXT","target_owner":"need_sensitive.access_notes","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.category","material":true,"value_type":"TEXT","target_owner":"needs.category","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.critical_conditions","material":true,"value_type":"TEXT_ARRAY","target_owner":"need_requirement_details.critical_conditions","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.description","material":true,"value_type":"TEXT","target_owner":"needs.description","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.ends_at","material":true,"value_type":"TIMESTAMPTZ","target_owner":"needs.ends_at","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.exact_address","material":true,"value_type":"TEXT","target_owner":"need_sensitive.exact_address","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.handoff","material":true,"value_type":"OBJECT","target_owner":"need_requirement_details.handoff","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.minimum_experience_years","material":true,"value_type":"INTEGER","target_owner":"needs.minimum_experience_years","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.people_needed","material":true,"value_type":"INTEGER","target_owner":"needs.required_slots","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.price_basis","material":true,"value_type":"ENUM","target_owner":"needs.price_basis","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.price_mode","material":true,"value_type":"ENUM","target_owner":"needs.mode","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.price_rsd","material":true,"value_type":"INTEGER","target_owner":"needs.requester_price_rsd","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.public_photo_paths","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.public_photo_paths","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_licenses","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_licenses","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_skills","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_skills","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_tools","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_tools","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_vehicles","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_vehicles","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.resolved_location","material":true,"value_type":"OBJECT","target_owner":"need_sensitive.resolved_location","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.schedule_kind","material":true,"value_type":"ENUM","target_owner":"needs.schedule_kind","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.starts_at","material":true,"value_type":"TIMESTAMPTZ","target_owner":"needs.starts_at","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.task_country_code","material":true,"value_type":"TEXT","target_owner":"needs.task_country_code","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.task_geography","material":true,"value_type":"OBJECT","target_owner":"need_geography.public_topology","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.title","material":true,"value_type":"TEXT","target_owner":"needs.title","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.verified_identity_required","material":true,"value_type":"BOOLEAN","target_owner":"needs.verified_identity_required","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false}]'::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_REGISTRY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"5f864f673b792681532c6a4c4e16de1fd9682e6094faca516d749ee0d1c90a14","source":"0801d13b1b112c288143c396ecc44c3dac3b9e405ca5d6f2cd1a1b7ddef45021","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_CLOSURE_DRIFT';END IF;
 END $guard$;
CREATE TEMP TABLE r06_complete_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');
CREATE OR REPLACE FUNCTION public.rpc_ai_apply_interview_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_conv public.ai_conversations%rowtype;
  v_item jsonb;
  v_key text;
  v_value jsonb;
  v_display text;
  v_evidence text;
  v_confidence numeric;
  v_value_type text;
  v_fact_id uuid;
  v_fact_ids uuid[]:='{}'::uuid[];
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb:=coalesce(p_proposals,'[]'::jsonb);
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals)<>'array' or jsonb_array_length(v_proposals)>22 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
  if p_safety='BLOCK' and jsonb_array_length(v_proposals)>0 then raise exception 'BLOCK_CANNOT_PERSIST_PROPOSALS' using errcode='22023'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_CONVERSATION_REQUIRED' using errcode='P0001'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;
    v_key:=nullif(btrim(v_item->>'key'),'');
    v_value:=v_item->'value';
    v_display:=nullif(btrim(v_item->>'displayValue'),'');
    v_evidence:=nullif(btrim(v_item->>'evidence'),'');
    if v_key in('need.resolved_location','need.public_photo_paths') then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
    if v_key is null then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
    if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023',detail=v_key; end if;
    if v_evidence is null or char_length(v_evidence)>500 then raise exception 'V2_FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;
    begin v_confidence:=(v_item->>'confidence')::numeric; exception when others then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;
    if v_confidence is null or v_confidence<0 or v_confidence>1 then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;

    select value_type into v_value_type from private.need_fact_registry where fact_key=v_key;
    if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=v_key; end if;
    perform private.validate_need_v2_fact(v_key,v_value);

    v_fact_id:=extensions.gen_random_uuid();
    with superseded as (
      update public.ai_structured_facts
         set superseded_at=statement_timestamp(),superseded_by=null
       where conversation_id=p_conversation_id
         and fact_key=v_key
         and superseded_at is null
       returning id
    )
    select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

    insert into public.ai_structured_facts(
      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,fact_schema_version,value_type,display_value
    ) values (
      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,v_value,
      'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence,
      'NEED_FACT_V2',v_value_type,v_display
    );

    if cardinality(v_previous_ids)>0 then
      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);
    end if;
    v_fact_ids:=array_append(v_fact_ids,v_fact_id);
  end loop;

  insert into public.ai_messages(account_id,conversation_id,role,body)
  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message))
  returning id into v_user_message_id;

  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids)
  returning id into v_assistant_message_id;

  return jsonb_build_object(
    'conversationId',p_conversation_id,
    'userMessageId',v_user_message_id,
    'assistantMessageId',v_assistant_message_id,
    'proposedCount',cardinality(v_fact_ids),
    'proposedFactIds',to_jsonb(v_fact_ids),
    'schemaVersion','NEED_FACT_V2',
    'safety',p_safety,
    'authoritative',true
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
 continuity_source jsonb;continuity_prior jsonb;continuity_after jsonb;
 continuity_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 if not found or t.conversation_id<>c.id or t.request_hash<>hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.state='SUCCEEDED' then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id or not t.provider_dispatched or t.cancelled_at is not null then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 now_at:=clock_timestamp();
 if c.status<>'OPEN' or t.lease_expires_at<=now_at or t.context_hash is distinct from (private.ai_need_turn_context(c.id)->>'sha256') then
  update private.ai_need_turn_commands set state='FAILED',updated_at=now_at where account_id=p_account_id and client_request_id=p_client_request_id;
  return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
 end if;

 -- Carry only a successful existing classification across a scheduling-only turn.
 -- This is a fresh non-authoritative capture, never mutation of an old receipt.
 IF p_safety IN ('ALLOW','CLARIFY') AND jsonb_typeof(p_proposals)='array'
    AND jsonb_array_length(p_proposals)>0 AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_proposals) p
      WHERE p->>'key' IS NULL OR p->>'key' NOT IN
        ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')) THEN
   BEGIN
     continuity_source:=private.ai_task_review_source(c.id);
   EXCEPTION WHEN SQLSTATE '55000' THEN
     -- Media not ready: preserve the existing completion; do not reuse a hint.
     continuity_source:=NULL;
   END;
   IF continuity_source IS NOT NULL THEN
     -- The new claim is part of the complete source. Reconstruct the exact
     -- previous capture source by removing only this owned incoming turn.
     continuity_prior:=jsonb_set(continuity_source,'{turns}',coalesce((
       SELECT jsonb_agg(x ORDER BY x->>'id')
       FROM jsonb_array_elements(continuity_source->'turns') x
       WHERE x->>'id' IS DISTINCT FROM t.turn_id::text),'[]'::jsonb));
     SELECT h.* INTO continuity_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.purpose='NEED_SERVICE' AND h.account_id=p_account_id AND h.conversation_id=c.id
       AND h.source_fingerprint=encode(extensions.digest(continuity_prior::text,'sha256'),'hex')
       AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
   END IF;
 END IF;

 -- Existing V2 writer owns proposal validation, supersession, provenance and messages.
 raw:=public.rpc_ai_apply_interview_turn_v2_service(p_account_id,c.id,p_user_message,p_assistant_message,p_safety,p_proposals);
 receipt_value:=jsonb_build_object('userMessageId',raw->'userMessageId','assistantMessageId',raw->'assistantMessageId',
  'proposedCount',raw->'proposedCount','safety',raw->'safety','schemaVersion',raw->'schemaVersion','authoritative',raw->'authoritative');
 if raw->>'conversationId' is distinct from c.id::text or raw->>'schemaVersion' is distinct from 'NEED_FACT_V2'
  or raw->'authoritative' is distinct from 'true'::jsonb or raw->>'userMessageId' is null or raw->>'assistantMessageId' is null
  or (raw->>'proposedCount')::integer not between 0 and 22
 then raise exception 'AI_TURN_RECEIPT_INVALID' using errcode='P0001';end if;
 update private.ai_need_turn_commands set state='SUCCEEDED',receipt=receipt_value,updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id;

 IF continuity_hint.id IS NOT NULL AND raw->>'safety' IN ('ALLOW','CLARIFY') THEN
   continuity_after:=private.ai_task_review_source(c.id);
   -- Recheck all non-scheduling fact rows and media/Need/conversation state.
   -- No name, category, mode, handoff, description or ownership relaxation.
   IF (continuity_after-'facts'-'messages'-'turns')=(continuity_source-'facts'-'messages'-'turns')
     AND coalesce((SELECT jsonb_agg(x ORDER BY x->>'fact_key',x->>'id')
       FROM jsonb_array_elements(continuity_after->'facts') x
       WHERE x->>'fact_key' NOT IN ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')),'[]'::jsonb)
       =coalesce((SELECT jsonb_agg(x ORDER BY x->>'fact_key',x->>'id')
       FROM jsonb_array_elements(continuity_source->'facts') x
       WHERE x->>'fact_key' NOT IN ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')),'[]'::jsonb)
     AND continuity_hint.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton) THEN
     PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id,c.id,p_client_request_id,
       t.turn_id,p_attempt_id,'NEED_SERVICE',continuity_hint.catalog_version,continuity_hint.proposals);
   END IF;
 END IF;

 return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
end $function$;
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_COMPLETE_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='db25bcbffbef1d0947c53defb1a6cb05' AND to_jsonb(p)-'prosrc'='{"oid":"21158","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_apply_interview_turn_v2_service","prorows":0,"pronargs":6,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_COMPLETE_FUNCTION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='b867f1c7289fb7513f5acec4a050b8c8' AND to_jsonb(p)-'prosrc'='{"oid":"22494","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_complete_need_turn_v2_service","prorows":0,"pronargs":8,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_client_request_id","p_attempt_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_COMPLETE_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source(uuid)'))) IS DISTINCT FROM '26a2977f90d790d6746df0c7dcfc7635' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source_before_media(uuid)'))) IS DISTINCT FROM 'd6ba809f15d478eb52a7ed288a99760a' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_erasure_program_digest_v5()'))) IS DISTINCT FROM 'e11cc0b1eb33e63d182247424e4027bd' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_schema_digest_v5_139()'))) IS DISTINCT FROM '5165a1c4787401db76b0a5cc894731e0' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_source_digest_v5()'))) IS DISTINCT FROM '3754d150d83b916422e184a50e5bd126' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'))) IS DISTINCT FROM 'c363facdb26d33ae872e25e6a79e4306' THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef('private.validate_need_v2_fact(text,jsonb)'::regprocedure))<>'20e2800046e49187eb96349d9b329e2e' THEN RAISE EXCEPTION 'R06_COMPLETE_VALIDATOR_DRIFT';END IF;
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY fact_key) FROM private.need_fact_registry r) IS DISTINCT FROM '[{"fact_key":"need.access_notes","material":true,"value_type":"TEXT","target_owner":"need_sensitive.access_notes","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.category","material":true,"value_type":"TEXT","target_owner":"needs.category","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.critical_conditions","material":true,"value_type":"TEXT_ARRAY","target_owner":"need_requirement_details.critical_conditions","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.description","material":true,"value_type":"TEXT","target_owner":"needs.description","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.ends_at","material":true,"value_type":"TIMESTAMPTZ","target_owner":"needs.ends_at","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.exact_address","material":true,"value_type":"TEXT","target_owner":"need_sensitive.exact_address","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.handoff","material":true,"value_type":"OBJECT","target_owner":"need_requirement_details.handoff","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.minimum_experience_years","material":true,"value_type":"INTEGER","target_owner":"needs.minimum_experience_years","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.people_needed","material":true,"value_type":"INTEGER","target_owner":"needs.required_slots","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.price_basis","material":true,"value_type":"ENUM","target_owner":"needs.price_basis","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.price_mode","material":true,"value_type":"ENUM","target_owner":"needs.mode","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.price_rsd","material":true,"value_type":"INTEGER","target_owner":"needs.requester_price_rsd","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.public_photo_paths","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.public_photo_paths","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_licenses","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_licenses","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_skills","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_skills","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_tools","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_tools","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.required_vehicles","material":true,"value_type":"TEXT_ARRAY","target_owner":"needs.required_vehicles","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.resolved_location","material":true,"value_type":"OBJECT","target_owner":"need_sensitive.resolved_location","privacy_class":"PRIVATE","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.schedule_kind","material":true,"value_type":"ENUM","target_owner":"needs.schedule_kind","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.starts_at","material":true,"value_type":"TIMESTAMPTZ","target_owner":"needs.starts_at","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false},{"fact_key":"need.task_country_code","material":true,"value_type":"TEXT","target_owner":"needs.task_country_code","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.task_geography","material":true,"value_type":"OBJECT","target_owner":"need_geography.public_topology","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.title","material":true,"value_type":"TEXT","target_owner":"needs.title","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":true},{"fact_key":"need.verified_identity_required","material":true,"value_type":"BOOLEAN","target_owner":"needs.verified_identity_required","privacy_class":"PUBLIC","schema_version":"NEED_FACT_V2","required_for_draft":false}]'::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_REGISTRY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"5f864f673b792681532c6a4c4e16de1fd9682e6094faca516d749ee0d1c90a14","source":"0801d13b1b112c288143c396ecc44c3dac3b9e405ca5d6f2cd1a1b7ddef45021","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_CLOSURE_DRIFT';END IF;
 END $guard$;
DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_complete_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid IN('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure,'public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)'::regprocedure) THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_COMPLETE_UNRELATED_DELTA';END IF;END $delta$;
COMMIT;
