-- R07a/F03 local candidate, outside the applied migration inventory.
-- Requires the matching Edge needTurnPersistenceProposals implementation.
-- Guarded source: read-only DEV body hash verified on 2026-10-28.
-- No new function/grant/role or client payload schema is introduced.
-- A single DO statement keeps replacement and metadata assertions atomic.
DO $r07$
DECLARE
  target oid := 'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure;
  prior record;
BEGIN
  IF current_setting('uskoci.r07.disposable', true) IS DISTINCT FROM 'LOCAL_ONLY' THEN
    RAISE EXCEPTION 'R07_DISPOSABLE_TARGET_REQUIRED';
  END IF;
  SELECT proowner, proacl, prosecdef, proconfig, md5(prosrc) AS body_md5
    INTO STRICT prior FROM pg_catalog.pg_proc WHERE oid=target;
  IF prior.body_md5 IS DISTINCT FROM '14ace04bd1895f4d230d41baf13dd6d6' THEN
    RAISE EXCEPTION 'R07_WRITER_SOURCE_DRIFT';
  END IF;
  EXECUTE $definition$
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
  v_retract_price boolean:=false;
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals)<>'array' then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
  -- Reserved service control, generated after model parsing. It is not a fact.
  -- Only one exact leading control is accepted; normal proposal limits remain 12.
  if (v_proposals->0) ? 'action' then
    if (v_proposals->0) is distinct from '{"action":"INVALIDATE_PRICE","reason":"UNSUPPORTED_CURRENCY"}'::jsonb
      and (v_proposals->0) is distinct from '{"action":"INVALIDATE_PRICE","reason":"AMBIGUOUS_CURRENCY"}'::jsonb
      and (v_proposals->0) is distinct from '{"action":"INVALIDATE_PRICE","reason":"UNSUPPORTED_PRICE_BASIS"}'::jsonb then
      raise exception 'PRICE_RETRACTION_INVALID' using errcode='22023';
    end if;
    if p_safety is distinct from 'CLARIFY' and p_safety is distinct from 'REVIEW' then
      raise exception 'PRICE_RETRACTION_REQUIRES_CLARIFICATION' using errcode='22023';
    end if;
    v_retract_price:=true;
    v_proposals:=v_proposals-0;
    if exists(select 1 from jsonb_array_elements(v_proposals) item
      where item->>'key' in ('need.price_mode','need.price_rsd','need.price_basis')) then
      raise exception 'PRICE_RETRACTION_CONFLICT' using errcode='22023';
    end if;
  end if;
  if jsonb_array_length(v_proposals)>12 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
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

  if v_retract_price then
    -- Keep immutable historical content/confirmation provenance. Removing the
    -- active mode also makes existing required-fact review reject readiness.
    -- A later unrelated ALLOW message cannot restore the old amount or consent.
    update public.ai_structured_facts
       set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=p_conversation_id and account_id=p_account_id
       and fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
       and superseded_at is null;
  end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;
    if v_item ? 'action' then raise exception 'PRICE_RETRACTION_POSITION_INVALID' using errcode='22023'; end if;
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
$definition$;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=target
    AND proowner=prior.proowner AND proacl IS NOT DISTINCT FROM prior.proacl
    AND prosecdef=prior.prosecdef AND proconfig IS NOT DISTINCT FROM prior.proconfig) THEN
    RAISE EXCEPTION 'R07_WRITER_AUTHORITY_DRIFT';
  END IF;
END
$r07$;
