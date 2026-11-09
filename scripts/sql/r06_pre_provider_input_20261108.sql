-- SOURCE-ONLY R06 bounded text preparation contract. The paired Edge path is
-- opt-in and must remain disabled until a controlled schema/runtime promotion.
-- Photos/location replies are deliberately outside this text-only contract.
DO $source_only$ BEGIN RAISE EXCEPTION 'R06_PRE_PROVIDER_SOURCE_ONLY'; END $source_only$;
-- R06_PRE_PROVIDER_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE r06_input_owner_guard(signature text primary key,metadata jsonb) ON COMMIT DROP;
DO $guard$
DECLARE x record;p pg_proc%rowtype;
BEGIN
 FOR x IN SELECT * FROM (VALUES
 ('public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)','fa90211a3fb9297eeebc74463845c7ca'),
 ('public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)','05c6f257e25baec1ea39abbc4246b36f'),
 ('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)','91629b929aae24dc3a9b05b412ab1b2e'),
 ('public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)','584eecfd229477010ae1043257a04227'),
 ('private.ai_need_turn_context(uuid)','972099be9f9429d87bc1566334e7d8f2'),
 ('public.rpc_read_worker_ai_context_service(uuid,uuid)','584ca4ae2d02e33823d9d75a92c14649'),
 ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','8130be4bf875702981ec408a33af62ca'),
 ('private.data_export_dataset_catalog()','45a2458b8e93a33649e885ad1ba41b4d'),
 ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','3b802baedd97cb0ab6e4a227690e7f5e')
 ) v(signature,body_md5) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM x.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR NOT p.prosecdef OR p.proacl::text IS DISTINCT FROM (CASE WHEN x.signature LIKE 'public.%'
    THEN '{postgres=X/postgres,service_role=X/postgres}' ELSE '{postgres=X/postgres}' END)
   THEN RAISE EXCEPTION 'R06_INPUT_PREIMAGE_DRIFT:%',x.signature;END IF;
  INSERT INTO pg_temp.r06_input_owner_guard VALUES(x.signature,to_jsonb(p)-'prosrc');
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid IN('private.ai_need_turn_commands'::regclass,'private.worker_ai_turns'::regclass)
  AND attname IN('prepared_input','prepared_input_sha256','prepared_at','prepared_reservation_id') AND NOT attisdropped)
  OR to_regprocedure('public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)') IS NOT NULL
  OR to_regprocedure('public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)') IS NOT NULL
  OR to_regprocedure('public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'R06_INPUT_ALREADY_PRESENT';END IF;
END $guard$;

DO $columns$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['private.ai_need_turn_commands','private.worker_ai_turns'] LOOP
  EXECUTE format('ALTER TABLE %s ADD COLUMN prepared_input jsonb,ADD COLUMN prepared_input_sha256 text,
   ADD COLUMN prepared_at timestamptz,ADD COLUMN prepared_reservation_id uuid',relation_name);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT r06_prepared_input_shape CHECK (
   ((prepared_at IS NULL)=(prepared_reservation_id IS NULL)) AND
   ((prepared_input IS NULL AND prepared_input_sha256 IS NULL) OR
    (prepared_input IS NOT NULL AND jsonb_typeof(prepared_input)=''object'' AND octet_length(prepared_input::text)<=524288
     AND prepared_input_sha256 IS NOT NULL AND prepared_input_sha256~''^[0-9a-f]{64}$''
     AND prepared_at IS NOT NULL AND prepared_reservation_id IS NOT NULL)))',relation_name);
 END LOOP;
END $columns$;

-- The existing account/session/conversation/command lock order is retained.
-- This private helper exposes no client executor and never extends a lease.
CREATE FUNCTION private.r06_prepared_input_owner_v1(a uuid,c uuid,r uuid,purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE n private.ai_need_turn_commands;w private.worker_ai_turns;s private.worker_ai_sessions;
 parent public.ai_conversations;command jsonb;context jsonb;state_value text;source_identity text;
BEGIN
 IF a IS NULL OR c IS NULL OR r IS NULL OR purpose IS NULL OR purpose NOT IN('NEED_SERVICE','WORKER_CAPABILITY')
 THEN RAISE EXCEPTION 'R06_INPUT_IDENTITY_REQUIRED' USING errcode='22023';END IF;
 PERFORM private.closure_assert_open(a);
 -- A reservation operation is global; serialize preparation across both owners.
 PERFORM pg_advisory_xact_lock(hashtextextended('r06-prepared-operation:'||r::text,0));
 IF purpose='NEED_SERVICE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('w03-account:'||a::text,0));
  SELECT * INTO parent FROM public.ai_conversations WHERE id=c AND account_id=a FOR UPDATE;
  IF NOT FOUND OR parent.purpose<>'NEED_INTAKE' OR parent.fact_schema_version<>'NEED_FACT_V2'
  THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO n FROM private.ai_need_turn_commands WHERE account_id=a AND client_request_id=r FOR UPDATE;
  IF NOT FOUND OR n.conversation_id<>c THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  command:=to_jsonb(n);
  IF parent.status<>'OPEN' OR n.cancelled_at IS NOT NULL THEN state_value:='CLOSED';
  ELSIF n.provider_dispatched THEN state_value:='READ_ONLY';
  ELSIF n.state<>'PROCESSING' OR n.lease_expires_at<=clock_timestamp() THEN state_value:='EXPIRED';
  ELSE
   context:=private.ai_need_turn_context(c);
   source_identity:=context->>'sha256';context:=context->'context';
   state_value:=CASE WHEN n.context_hash IS DISTINCT FROM source_identity THEN 'STALE' ELSE 'READY' END;
  END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||a::text||r::text,0));
  SELECT * INTO s FROM private.worker_ai_sessions WHERE account_id=a AND conversation_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO parent FROM public.ai_conversations pc WHERE pc.id=c AND pc.account_id=a AND pc.purpose='PROFILE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  SELECT * INTO w FROM private.worker_ai_turns WHERE account_id=a AND client_request_id=r FOR UPDATE;
  IF NOT FOUND OR w.conversation_id<>c THEN RAISE EXCEPTION 'R06_INPUT_NOT_OWNED' USING errcode='42501';END IF;
  command:=to_jsonb(w);
  IF parent.status<>'OPEN' OR w.cancelled_at IS NOT NULL THEN state_value:='CLOSED';
  ELSIF w.provider_dispatched THEN state_value:='READ_ONLY';
  ELSIF w.state<>'PROCESSING' OR w.lease_expires_at<=clock_timestamp() THEN state_value:='EXPIRED';
  ELSIF w.source_revision<>s.revision OR s.safety NOT IN('ALLOW','CLARIFY') OR s.base_hash IS DISTINCT FROM private.worker_ai_source_hash(a)
   THEN state_value:='STALE';
  ELSE
   context:=public.rpc_read_worker_ai_context_service(a,c);
   source_identity:=encode(extensions.digest(context::text,'sha256'),'hex');state_value:='READY';
  END IF;
 END IF;
 RETURN jsonb_build_object('state',state_value,'command',command,'context',context,'sourceIdentity',source_identity);
END $function$;
REVOKE ALL ON FUNCTION private.r06_prepared_input_owner_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_ai_prepare_input_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,
 p_attempt_id uuid,p_purpose text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE owned jsonb;command jsonb;request jsonb;item jsonb;part jsonb;reserved jsonb;material jsonb;digest text;
 reservation_id uuid;input_prepared_at timestamptz;input_text text;hash text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 IF p_attempt_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR p_input-array['schemaVersion','model','userText','providerRequest','catalog','runtime']<>'{}'::jsonb
  OR NOT(p_input?&ARRAY['schemaVersion','model','userText','providerRequest','catalog','runtime'])
  OR p_input->>'schemaVersion' IS DISTINCT FROM 'R06_TEXT_INPUT_V1'
  OR p_input->>'model' IS DISTINCT FROM 'gemini-3.8-flash'
  OR jsonb_typeof(p_input->'userText') IS DISTINCT FROM 'string' OR char_length(btrim(p_input->>'userText')) NOT BETWEEN 1 AND 4000
  OR jsonb_typeof(p_input->'runtime') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input#>'{runtime,sourceContext}') IS DISTINCT FROM 'object' OR octet_length(p_input::text)>262144
 THEN RAISE EXCEPTION 'R06_INPUT_INVALID' USING errcode='22023';END IF;
 request:=p_input->'providerRequest';
 IF jsonb_typeof(request) IS DISTINCT FROM 'object' OR request-array['systemInstruction','contents','generationConfig']<>'{}'::jsonb
  OR NOT(request?&ARRAY['systemInstruction','contents','generationConfig'])
  OR jsonb_typeof(request->'systemInstruction') IS DISTINCT FROM 'object'
  OR (request->'systemInstruction')-'parts'<>'{}'::jsonb
  OR jsonb_typeof(request#>'{systemInstruction,parts}') IS DISTINCT FROM 'array'
  OR jsonb_typeof(request->'contents') IS DISTINCT FROM 'array' OR jsonb_array_length(request->'contents') NOT BETWEEN 1 AND 102
  OR jsonb_typeof(request->'generationConfig') IS DISTINCT FROM 'object'
  OR (request->'generationConfig')-ARRAY['temperature','maxOutputTokens','responseMimeType','responseSchema','thinkingConfig']<>'{}'::jsonb
  OR jsonb_typeof(request#>'{generationConfig,temperature}') IS DISTINCT FROM 'number'
  OR NOT((request#>>'{generationConfig,temperature}')::numeric BETWEEN 0 AND 1)
  OR request#>>'{generationConfig,responseMimeType}' IS DISTINCT FROM 'application/json'
  OR request#>'{generationConfig,maxOutputTokens}' IS DISTINCT FROM '2048'::jsonb
  OR request#>'{generationConfig,thinkingConfig}' IS DISTINCT FROM '{"thinkingBudget":0}'::jsonb
  OR jsonb_typeof(request#>'{generationConfig,responseSchema}') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'R06_TEXT_REQUEST_INVALID' USING errcode='22023';END IF;
 -- No inline photo, provider file URL, cache handle or reconstructible-by-guessing input.
 FOR part IN SELECT value FROM jsonb_array_elements(request#>'{systemInstruction,parts}') LOOP
  IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR part-'text'<>'{}'::jsonb OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'R06_TEXT_ONLY_INPUT' USING errcode='22023';END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(request->'contents') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item-array['role','parts']<>'{}'::jsonb
   OR NOT(item?&ARRAY['role','parts']) OR jsonb_typeof(item->'role') IS DISTINCT FROM 'string'
   OR item->>'role' NOT IN('user','model') OR jsonb_typeof(item->'parts') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'R06_TEXT_REQUEST_INVALID' USING errcode='22023';END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(item->'parts') LOOP
   IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR part-'text'<>'{}'::jsonb OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'R06_TEXT_ONLY_INPUT' USING errcode='22023';END IF;
  END LOOP;
 END LOOP;
 -- The final provider message is the claimed text itself, not a different
 -- request supplied alongside the correct hash. Location/media use other paths.
 item:=request->'contents'->-1;
 IF item->>'role' IS DISTINCT FROM 'user' OR jsonb_array_length(item->'parts')<>1
  OR item#>>'{parts,0,text}' IS DISTINCT FROM p_input->>'userText'
 THEN RAISE EXCEPTION 'R06_INPUT_REQUEST_MISMATCH' USING errcode='22023';END IF;
 IF p_input->'catalog'<>'null'::jsonb AND (jsonb_typeof(p_input->'catalog') IS DISTINCT FROM 'object'
  OR (p_input->'catalog')-ARRAY['catalogVersion','catalogFingerprint','categories']<>'{}'::jsonb
  OR NOT(p_input->'catalog'?&ARRAY['catalogVersion','catalogFingerprint','categories'])
  OR jsonb_typeof(p_input#>'{catalog,catalogVersion}') IS DISTINCT FROM 'number'
  OR (p_input#>>'{catalog,catalogVersion}')!~'^[1-9][0-9]*$'
  OR jsonb_typeof(p_input#>'{catalog,catalogFingerprint}') IS DISTINCT FROM 'string'
  OR (p_input#>>'{catalog,catalogFingerprint}')!~'^[0-9a-f]{32}$'
  OR jsonb_typeof(p_input#>'{catalog,categories}') IS DISTINCT FROM 'array')
 THEN RAISE EXCEPTION 'R06_CATALOG_INPUT_INVALID' USING errcode='22023';END IF;
 owned:=private.r06_prepared_input_owner_v1(p_account_id,p_conversation_id,p_client_request_id,p_purpose);command:=owned->'command';
 IF owned->>'state'<>'READY' OR command->>'attempt_id' IS DISTINCT FROM p_attempt_id::text
 THEN RAISE EXCEPTION 'R06_INPUT_NOT_PREPARABLE' USING errcode='55000';END IF;
 -- Reading current ownership here must not silently bind an older Edge-built
 -- request to a newer context. Both initial preparation and replay keep the
 -- exact context used by that request; retries reconstruct it from the snapshot.
 IF p_input#>'{runtime,sourceContext}' IS DISTINCT FROM owned->'context'
 THEN RAISE EXCEPTION 'R06_INPUT_SOURCE_MISMATCH' USING errcode='55000';END IF;
 input_text:=p_input->>'userText';
 hash:=CASE WHEN p_purpose='NEED_SERVICE' THEN private.ai_location_request_hash(p_conversation_id,input_text,null)
  ELSE encode(extensions.digest(input_text,'sha256'),'hex') END;
 IF hash IS DISTINCT FROM (CASE WHEN p_purpose='NEED_SERVICE' THEN command->>'request_hash' ELSE command->>'body_hash' END)
 THEN RAISE EXCEPTION 'R06_INPUT_REQUEST_MISMATCH' USING errcode='22023';END IF;
 IF command->'prepared_input'<>'null'::jsonb THEN
  IF command#>'{prepared_input,input}' IS DISTINCT FROM p_input
   OR command#>>'{prepared_input,attemptId}' IS DISTINCT FROM p_attempt_id::text
   OR command#>>'{prepared_input,sourceIdentity}' IS DISTINCT FROM owned->>'sourceIdentity'
  THEN RAISE EXCEPTION 'R06_INPUT_IMMUTABLE' USING errcode='55000';END IF;
  IF NOT EXISTS(SELECT 1 FROM private.ai_test_reservations_v5 WHERE id=(command->>'prepared_reservation_id')::uuid
   AND operation_id=p_client_request_id AND account_id=p_account_id AND kind='LLM' AND max_cost_microusd=250000 AND settled_microusd IS NULL)
  THEN RETURN jsonb_build_object('state','READ_ONLY');END IF;
  IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
  THEN RAISE EXCEPTION 'R06_INPUT_LEASE_EXPIRED' USING errcode='55000';END IF;
  RETURN jsonb_build_object('state','PREPARED','replay',true,'inputSha256',command->>'prepared_input_sha256');
 END IF;
 IF command->>'prepared_at' IS NOT NULL THEN RAISE EXCEPTION 'R06_INPUT_ERASED' USING errcode='55000';END IF;
 IF (p_purpose='NEED_SERVICE' AND EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE account_id=p_account_id AND client_request_id=p_client_request_id))
  OR (p_purpose='WORKER_CAPABILITY' AND EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE account_id=p_account_id AND client_request_id=p_client_request_id))
 THEN RAISE EXCEPTION 'R06_INPUT_OPERATION_CONFLICT' USING errcode='55000';END IF;
 -- Reserve and persist together. Never adopt/reset an older ambiguous reservation.
 reserved:=public.rpc_ai_test_budget_reserve_service(p_account_id,p_client_request_id,'LLM',250000);
 IF reserved->'admitted' IS DISTINCT FROM 'true'::jsonb OR reserved->'replay' IS DISTINCT FROM 'false'::jsonb
 THEN RAISE EXCEPTION 'R06_INPUT_BUDGET_NOT_ADMITTED' USING errcode='55000';END IF;
 IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
 THEN RAISE EXCEPTION 'R06_INPUT_LEASE_EXPIRED' USING errcode='55000';END IF;
 reservation_id:=(reserved->>'reservationId')::uuid;input_prepared_at:=clock_timestamp();
 material:=jsonb_build_object('schemaVersion','R06_PREPARED_TEXT_V1','purpose',p_purpose,
  'accountId',p_account_id,'conversationId',p_conversation_id,'clientRequestId',p_client_request_id,
  'turnId',command->>'turn_id','attemptId',p_attempt_id,'sourceIdentity',owned->>'sourceIdentity',
  'sourceContext',owned->'context','input',p_input,'reservationId',reservation_id,
  'instructionSha256',encode(extensions.digest((request->'systemInstruction')::text,'sha256'),'hex'),
  'schemaSha256',encode(extensions.digest((request#>'{generationConfig,responseSchema}')::text,'sha256'),'hex'),
  'catalogSha256',encode(extensions.digest((p_input->'catalog')::text,'sha256'),'hex'));
 IF octet_length(material::text)>524288 THEN RAISE EXCEPTION 'R06_PREPARED_INPUT_TOO_LARGE' USING errcode='22001';END IF;
 digest:=encode(extensions.digest(material::text,'sha256'),'hex');
 IF p_purpose='NEED_SERVICE' THEN
  UPDATE private.ai_need_turn_commands SET prepared_input=material,prepared_input_sha256=digest,
   prepared_at=input_prepared_at,prepared_reservation_id=reservation_id
   WHERE account_id=p_account_id AND client_request_id=p_client_request_id;
 ELSE
  UPDATE private.worker_ai_turns SET prepared_input=material,prepared_input_sha256=digest,
   prepared_at=input_prepared_at,prepared_reservation_id=reservation_id
   WHERE account_id=p_account_id AND client_request_id=p_client_request_id;
 END IF;
 RETURN jsonb_build_object('state','PREPARED','replay',false,'inputSha256',digest);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.rpc_ai_read_prepared_input_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE owned jsonb;command jsonb;state_value text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 owned:=private.r06_prepared_input_owner_v1(p_account_id,p_conversation_id,p_client_request_id,p_purpose);command:=owned->'command';
 state_value:=owned->>'state';
 IF state_value IN('CLOSED','READ_ONLY') THEN RETURN jsonb_build_object('state',state_value);END IF;
 IF command->'prepared_input'='null'::jsonb AND command->>'prepared_at' IS NOT NULL
 THEN RETURN jsonb_build_object('state','ERASED');END IF;
 IF state_value<>'READY' THEN RETURN jsonb_build_object('state',state_value);END IF;
 IF command->'prepared_input'='null'::jsonb THEN RETURN jsonb_build_object('state',CASE WHEN command->>'prepared_at' IS NULL THEN 'ABSENT' ELSE 'ERASED' END);END IF;
 IF command#>>'{prepared_input,attemptId}' IS DISTINCT FROM command->>'attempt_id'
  OR command#>>'{prepared_input,sourceIdentity}' IS DISTINCT FROM owned->>'sourceIdentity'
 THEN RETURN jsonb_build_object('state','STALE');END IF;
 IF encode(extensions.digest((command->'prepared_input')::text,'sha256'),'hex') IS DISTINCT FROM command->>'prepared_input_sha256'
 THEN RAISE EXCEPTION 'R06_INPUT_DIGEST_MISMATCH' USING errcode='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.ai_test_reservations_v5 WHERE id=(command->>'prepared_reservation_id')::uuid
  AND operation_id=p_client_request_id AND account_id=p_account_id AND kind='LLM' AND max_cost_microusd=250000 AND settled_microusd IS NULL)
 THEN RETURN jsonb_build_object('state','READ_ONLY');END IF;
 IF (command->>'lease_expires_at')::timestamptz<=clock_timestamp()
 THEN RETURN jsonb_build_object('state','EXPIRED');END IF;
 RETURN jsonb_build_object('state','PREPARED','inputSha256',command->>'prepared_input_sha256','snapshot',command->'prepared_input');
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text) TO service_role;

-- A read is not permission to contact a provider. Revalidate the same snapshot
-- and live admission while holding the existing global budget lock, then call
-- the original owner exactly once in this transaction. No reservation is changed.
CREATE FUNCTION public.rpc_ai_dispatch_prepared_input_service(p_account_id uuid,p_conversation_id uuid,
 p_client_request_id uuid,p_attempt_id uuid,p_purpose text,p_input_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE prepared jsonb;snapshot jsonb;budget private.ai_test_budget_v5;reservation private.ai_test_reservations_v5;
 dispatched boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';END IF;
 IF p_attempt_id IS NULL OR p_input_sha256 IS NULL OR p_input_sha256!~'^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'R06_INPUT_DISPATCH_IDENTITY_REQUIRED' USING errcode='22023';END IF;
 prepared:=public.rpc_ai_read_prepared_input_service(p_account_id,p_conversation_id,p_client_request_id,p_purpose);
 IF prepared->>'state'<>'PREPARED' THEN RETURN jsonb_build_object('state',prepared->>'state','dispatched',false);END IF;
 snapshot:=prepared->'snapshot';
 IF snapshot->>'attemptId' IS DISTINCT FROM p_attempt_id::text OR prepared->>'inputSha256' IS DISTINCT FROM p_input_sha256
 THEN RAISE EXCEPTION 'R06_INPUT_DISPATCH_MISMATCH' USING errcode='55000';END IF;
 SELECT * INTO STRICT budget FROM private.ai_test_budget_v5 WHERE singleton FOR UPDATE;
 -- Use the clock after the lock wait: neither a price window nor a lease can
 -- be extended by a statement that began before it expired.
 IF NOT budget.enabled OR NOT budget.reservation_cap_enforced OR budget.price_valid_until<=clock_timestamp()
  OR budget.reserved_microusd>budget.ceiling_microusd
  OR NOT EXISTS(SELECT 1 FROM private.ai_test_accounts_v5 WHERE account_id=p_account_id AND retired_at IS NULL)
  OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_account_id AND deleted_at IS NULL)
 THEN RETURN jsonb_build_object('state','NOT_ADMITTED','dispatched',false);END IF;
 SELECT * INTO reservation FROM private.ai_test_reservations_v5
  WHERE id=(snapshot->>'reservationId')::uuid FOR UPDATE;
 IF NOT FOUND OR reservation.operation_id IS DISTINCT FROM p_client_request_id
  OR reservation.account_id IS DISTINCT FROM p_account_id OR reservation.kind<>'LLM'
  OR reservation.max_cost_microusd<>250000 OR reservation.settled_microusd IS NOT NULL
 THEN RETURN jsonb_build_object('state','READ_ONLY','dispatched',false);END IF;
 IF p_purpose='NEED_SERVICE' THEN
  dispatched:=public.rpc_ai_dispatch_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id);
 ELSE
  dispatched:=(public.rpc_dispatch_worker_ai_turn_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id)->'dispatched')='true'::jsonb;
 END IF;
 IF dispatched IS DISTINCT FROM true THEN RETURN jsonb_build_object('state','NOT_DISPATCHED','dispatched',false);END IF;
 RETURN jsonb_build_object('state','DISPATCHED','dispatched',true,'inputSha256',p_input_sha256,'snapshot',snapshot);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text) TO service_role;

-- R06_PRIVACY_PATCHES_START
DO $patch$ DECLARE d text; old_text text:=$old$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at,'cancelledAt',t.cancelled_at)$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at,'cancelledAt',t.cancelled_at,'preparedInput',t.prepared_input,'preparedAt',t.prepared_at)$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$select 'taskAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'cancelledAt',t.cancelled_at,'createdAt',t.created_at)$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$select 'taskAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'cancelledAt',t.cancelled_at,'createdAt',t.created_at,'preparedInput',t.prepared_input,'preparedAt',t.prepared_at)$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$"key": "workerAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "state"]$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$"key": "workerAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "preparedAt", "preparedInput", "state"]$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$"key": "taskAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "state"]$old$; BEGIN
 d:=pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$"key": "taskAiTurns", "fields": ["cancelledAt", "conversationId", "createdAt", "id", "preparedAt", "preparedInput", "state"]$new$);
END $patch$;
DO $patch$ DECLARE d text; old_text text:=$old$ -- An operator's note about a person is not audit metadata the subject must live with. The$old$; BEGIN
 d:=pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);
 IF (length(d)-length(replace(d,old_text,'')))<>length(old_text) THEN RAISE EXCEPTION 'R06_INPUT_PATCH_ANCHOR';END IF;
 EXECUTE replace(d,old_text,$new$ if r in('private.ai_need_turn_commands','private.worker_ai_turns') and t?'prepared_input' then
  p:=p||jsonb_build_object('prepared_input',null,'prepared_input_sha256',null);
 end if;
 -- An operator's note about a person is not audit metadata the subject must live with. The$new$);
END $patch$;
DO $metadata$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.r06_input_owner_guard g JOIN pg_proc p ON p.oid=to_regprocedure(g.signature)
  WHERE (to_jsonb(p)-'prosrc') IS DISTINCT FROM g.metadata)
 THEN RAISE EXCEPTION 'R06_INPUT_OWNER_METADATA_CHANGED';END IF;
END $metadata$;
COMMIT;
