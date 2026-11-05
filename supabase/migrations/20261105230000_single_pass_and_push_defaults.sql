-- Migration: 20261105230000_single_pass_and_push_defaults.sql
-- 1. Push notifications enabled by default for new craftsmen and hosts in private.emit_event
-- 2. Respectful domestic persiranje in private.notification_copy_v5
-- 3. Reset provider_dispatched in public.rpc_ai_fail_need_turn_v2_service to prevent turn deadlocks
-- 4. Expired attempt cleanup check in private.ai_need_turn_status
-- 5. Formalized single-pass first plan service RPCs and receipt storage

CREATE OR REPLACE FUNCTION private.notification_copy_v5(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case p_text
    when 'Nova prilika koja može da Vam odgovara' then 'Pojavio se novi zadatak za Vas'
    when 'Nova prilika koja ti može odgovarati' then 'Pojavio se novi zadatak za Vas'
    when 'Pregledajte svoju prijavu pre nastavka.' then 'Pregledajte svoju prijavu pre nastavka.'
    when 'Imate novu prijavu za Zadatak.' then 'Imate novu prijavu za Zadatak.'
    when 'Pregledajte aktuelne uslove prijave.' then 'Pregledajte aktuelne uslove prijave.'
    when 'Potreba je otkazana' then 'Zadatak je otkazan'
    when 'Narucilac je otkazao Potrebu za koju ste poslali prijavu.' then 'Zadatak za koji imate prijavu je otkazan.'
    when 'Naručilac je potvrdio završetak.' then 'Završetak Dogovora je potvrđen.'
    when 'Naručilac je pregledao Vašu prijavu.' then 'Vaša prijava je pregledana.'
    when 'Završetak čeka Vašu potvrdu' then 'Završetak čeka Vašu potvrdu'
    when 'Uskočer je označio Dogovor kao završen.' then 'Dogovor je označen kao završen.'
    when 'Pogledajte predlog i odgovorite u Dogovoru.' then 'Pogledajte predlog i odgovorite u Dogovoru.'
    when 'Otvorite Dogovor da vidite prijavljeni problem.' then 'Otvorite Dogovor da vidite prijavljeni problem.'
    when 'Pogledajte važeće uslove u Dogovoru.' then 'Pogledajte važeće uslove u Dogovoru.'
    when 'Naručilac je odgovorio na Vaše pitanje.' then 'Stigao je odgovor na Vaše pitanje.'
    when 'Uskočer je postavio anonimno pitanje o Zadatku.' then 'Stiglo je anonimno pitanje o Zadatku.'
    when 'Vaša prijava je izabrana' then 'Vaša prijava je izabrana'
    when 'Otvorite Dogovor za detalje zadatka.' then 'Otvorite Dogovor za detalje zadatka.'
    when 'Imate novu poruku u Dogovoru.' then 'Imate novu poruku u Dogovoru.'
    when 'Dobili ste ocenu za završen Dogovor.' then 'Stigla je ocena za završen Dogovor.'
    when 'Prijava je povucena' then 'Prijava je povučena'
    when 'Uskocer je povukao prijavu za Vasu Potrebu.' then 'Jedna prijava za Vaš Zadatak je povučena.'
    when 'Otvorite za trenutne informacije.' then 'Otvorite za trenutne informacije.'
    else p_text
  end;
$function$;

CREATE OR REPLACE FUNCTION private.emit_event(p_recipient uuid, p_role text, p_event_type text, p_entity_type text, p_entity_id uuid, p_entity_version integer, p_title text, p_body text, p_dedupe_key text, p_urgency text DEFAULT 'NORMAL'::text, p_payload jsonb DEFAULT '{}'::jsonb, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event_id uuid;
  v_prefs public.notification_preferences%rowtype;
  v_cat text := private.category_of_event(p_event_type);
  v_cat_on boolean;
  v_quiet boolean;
  v_prio text := case when p_urgency = 'HITNO' then 'HIGH' else 'NORMAL' end;
  v_suppress text;
begin
  p_title := private.notification_copy_v5(p_title);
  p_body := private.notification_copy_v5(p_body);
  -- 1) durable event, idempotentno
  insert into public.user_activity_events
    (recipient_user_id, recipient_role, event_type, entity_type, entity_id,
     entity_version, urgency, payload, dedupe_key)
  values (p_recipient, p_role, p_event_type, p_entity_type, p_entity_id,
     p_entity_version, p_urgency, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return null;  -- vec emitovano; nista se ne duplira
  end if;

  -- 2) preference; ako red ne postoji, vaze podrazumevane vrednosti (push je ukljucen za nove majstore i domacine)
  select * into v_prefs from public.notification_preferences
   where user_id = p_recipient and role_context = p_role;
  if not found then
    v_prefs.in_app_enabled := true;
    v_prefs.push_enabled := coalesce((select np.push_enabled from public.notification_preferences np
                                       where np.user_id = p_recipient order by np.role_context limit 1), true);
    v_prefs.quiet_hours_enabled := false;
    v_prefs.urgent_overrides_quiet_hours := false;
    v_prefs.opportunities_enabled := true; v_prefs.responses_enabled := true;
    v_prefs.dogovor_enabled := true; v_prefs.execution_enabled := true;
    v_prefs.recovery_enabled := true; v_prefs.account_enabled := true;
  end if;

  v_cat_on := case v_cat
    when 'opportunities' then v_prefs.opportunities_enabled
    when 'responses'     then v_prefs.responses_enabled
    when 'dogovor'       then v_prefs.dogovor_enabled
    when 'execution'     then v_prefs.execution_enabled
    when 'recovery'      then v_prefs.recovery_enabled
    else v_prefs.account_enabled end;

  -- 3) IN_APP
  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'IN_APP', v_prio,
     case when v_prefs.in_app_enabled and v_cat_on then 'CREATED' else 'SUPPRESSED' end,
     case when v_prefs.in_app_enabled and v_cat_on then null
          when not v_cat_on then 'CATEGORY_OFF' else 'IN_APP_OFF' end,
     p_title, p_body, p_dedupe_key || ':in_app', p_expires_at)
  on conflict (dedupe_key) do nothing;

  -- 4) PUSH — tihi sati se postuju osim uz izricit opt-in za HITNO
  v_quiet := private.in_quiet_hours(v_prefs);
  v_suppress := case
    when not v_prefs.push_enabled then 'PUSH_OFF'
    when not v_cat_on then 'CATEGORY_OFF'
    when v_quiet and not (p_urgency = 'HITNO' and v_prefs.urgent_overrides_quiet_hours)
      then 'QUIET_HOURS'
    else null end;

  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'PUSH', v_prio,
     case when v_suppress is null then 'CREATED' else 'SUPPRESSED' end,
     v_suppress, p_title, p_body, p_dedupe_key || ':push', p_expires_at)
  on conflict (dedupe_key) do nothing;

  return v_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_ai_fail_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if p_account_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 update private.ai_need_turn_commands set state='FAILED', provider_dispatched=false, updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id and conversation_id=p_conversation_id
 and state='PROCESSING' and attempt_id=p_attempt_id and cancelled_at is null;
 return private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id);
end $function$;

CREATE OR REPLACE FUNCTION private.ai_need_turn_status(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare c public.ai_conversations;t private.ai_need_turn_commands;ready boolean;state_value text;
begin
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for share;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 if p_client_request_id is null then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 ready:=c.status='OPEN' and not exists(select 1 from private.ai_need_turn_commands x where x.conversation_id=c.id
  and x.client_request_id<>p_client_request_id and x.state='PROCESSING' and (x.lease_expires_at is null or x.lease_expires_at > clock_timestamp()));
 state_value:=case when t.turn_id is null then 'ABSENT' else t.state end;
 return jsonb_build_object('conversationId',c.id,'clientRequestId',p_client_request_id,'state',state_value,'turnId',t.turn_id,
  'retryAllowed',ready and (state_value='ABSENT' or (state_value='FAILED' and not t.provider_dispatched and t.cancelled_at is null)),
  'receipt',t.receipt-'location');
end $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_input_digest_v1(p_writer text, p_arguments jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT encode(extensions.digest(jsonb_build_object('writer',p_writer,'arguments',
  p_arguments-array['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id'])::text,'sha256'),'hex');
$function$;

CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_lock_v1(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_purpose text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_state text;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR p_client_request_id IS NULL OR p_attempt_id IS NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_purpose='NEED_SERVICE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id FOR UPDATE;
  SELECT state INTO v_state FROM private.ai_need_turn_commands
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
  PERFORM 1 FROM private.worker_ai_sessions WHERE account_id=p_account_id AND conversation_id=p_conversation_id FOR UPDATE;
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id AND purpose='PROFILE' FOR UPDATE;
  SELECT state INTO v_state FROM private.worker_ai_turns
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF v_state IS NULL THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 RETURN v_state='SUCCEEDED';
END; $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_first_plan_complete_receipt_v1(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_purpose text, p_safety text, p_turn jsonb, p_taxonomy_plan jsonb, p_completion_digest text, p_was_completed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE; captured jsonb;resolved jsonb;
 v_turn_id uuid;v_version bigint;v_proposals jsonb;v_digest text;
 v_input_digest text;
 v_category jsonb;v_geography jsonb;v_handoff jsonb;v_mode text;v_count integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_turn->>'conversationId' IS DISTINCT FROM p_conversation_id::text
 OR p_turn->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text
 OR (p_purpose='WORKER_CAPABILITY' AND p_turn->>'attemptId' IS DISTINCT FROM p_attempt_id::text) THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_turn->>'state' IS DISTINCT FROM 'SUCCEEDED' THEN
  RETURN jsonb_build_object('state','NOT_ELIGIBLE','authority','NONE'); END IF;
 v_turn_id:=(p_turn->>'turnId')::uuid;
 IF v_turn_id IS NULL OR p_was_completed IS NULL OR p_completion_digest IS NULL
 OR p_completion_digest !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_purpose='NEED_SERVICE' THEN
  IF NOT EXISTS(SELECT 1 FROM private.ai_need_turn_commands t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  IF NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.worker_ai_turn_document(v_turn_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF p_purpose='NEED_SERVICE' AND p_turn#>>'{receipt,safety}' IS DISTINCT FROM p_safety THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_SAFETY_INVALID' USING errcode='22023'; END IF;
 IF jsonb_typeof(p_taxonomy_plan) IS DISTINCT FROM 'object'
 OR NOT(p_taxonomy_plan ?& array['catalogVersion','proposals','anchors'])
 OR p_taxonomy_plan-array['catalogVersion','proposals','anchors']<>'{}'::jsonb
 OR jsonb_typeof(p_taxonomy_plan->'catalogVersion') IS DISTINCT FROM 'number'
 OR (p_taxonomy_plan->>'catalogVersion') !~ '^[1-9][0-9]*$'
 OR jsonb_typeof(p_taxonomy_plan->'proposals') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_taxonomy_plan->'anchors') IS DISTINCT FROM 'array'
 OR pg_column_size(p_taxonomy_plan)>18000 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_version:=(p_taxonomy_plan->>'catalogVersion')::bigint;
 v_proposals:=p_taxonomy_plan->'proposals';
 IF jsonb_array_length(v_proposals)<1 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_digest:=encode(extensions.digest(v_proposals::text,'sha256'),'hex');
 v_input_digest:=encode(extensions.digest(p_taxonomy_plan::text,'sha256'),'hex');
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 IF FOUND THEN
  IF h.conversation_id IS DISTINCT FROM p_conversation_id
  OR h.client_request_id IS DISTINCT FROM p_client_request_id
  OR h.attempt_id IS DISTINCT FROM p_attempt_id
  OR h.catalog_version IS DISTINCT FROM v_version OR h.payload_digest IS DISTINCT FROM v_digest
  OR h.proposals IS DISTINCT FROM v_proposals THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  IF h.catalog_resolution IS NULL THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
  IF h.catalog_resolution->>'inputDigest' IS DISTINCT FROM v_input_digest
  OR h.catalog_resolution->>'completionDigest' IS DISTINCT FROM p_completion_digest THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  resolved:=h.catalog_resolution;
  RETURN jsonb_build_object('state',resolved->>'state','authority',
   CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
   ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
 END IF;
 IF p_was_completed THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
 IF p_purpose='NEED_SERVICE' THEN
  SELECT count(*) INTO v_count FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  IF v_count<>1 OR jsonb_array_length(v_proposals)<>1 THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
  SELECT fact_value INTO v_category FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  SELECT fact_value INTO v_geography FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.task_geography';
  SELECT fact_value INTO v_handoff FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.handoff';
  v_mode:=CASE WHEN v_geography->>'mode'='REMOTE' THEN 'REMOTE'
   WHEN v_geography->>'mode' IN('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') THEN 'ON_SITE' END;
  IF jsonb_typeof(v_category) IS DISTINCT FROM 'string' OR v_mode IS NULL
  OR private.taxonomy_normalize_v1(v_proposals#>>'{0,service}') IS DISTINCT FROM private.taxonomy_normalize_v1(v_category#>>'{}')
  OR v_proposals#>>'{0,mode}' IS DISTINCT FROM v_mode
  OR coalesce(v_proposals#>'{0,handoff}','null'::jsonb) IS DISTINCT FROM
     coalesce(CASE WHEN v_mode='REMOTE' THEN v_handoff END,'null'::jsonb) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
 END IF;
 captured:=public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id,p_conversation_id,
  p_client_request_id,v_turn_id,p_attempt_id,p_purpose,v_version,v_proposals);
 IF captured->>'action' IS DISTINCT FROM 'HINT_CAPTURED' OR captured->>'authority' IS DISTINCT FROM 'NONE' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_CAPTURE_RECEIPT_INVALID' USING errcode='55000'; END IF;
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 resolved:=private.taxonomy_resolve_turn_catalog_v1(h.id,v_input_digest,p_taxonomy_plan->'anchors',p_safety);
 resolved:=resolved||jsonb_build_object('completionDigest',p_completion_digest);
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=resolved WHERE id=h.id;
 RETURN jsonb_build_object('state',resolved->>'state','authority',
  CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
  ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb, p_taxonomy_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'NEED_SERVICE');
 completed:=public.rpc_ai_complete_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed,p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_ai_complete_need_turn_with_first_plan_service',
   jsonb_build_object('p_user_message',p_user_message,'p_assistant_message',p_assistant_message,
    'p_safety',p_safety,'p_proposals',p_proposals,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $function$;
