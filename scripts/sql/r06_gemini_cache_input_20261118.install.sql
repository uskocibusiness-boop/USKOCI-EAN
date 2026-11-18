BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;

-- Project-bound R06 extension. The preimage guard refuses to replace a different
-- prepared-input authority; this migration changes only its accepted request shape.
DO $guard$
DECLARE actual_md5 text;actual_owner text;actual_security_definer boolean;actual_config text[];actual_acl text;
BEGIN
 SELECT md5(p.prosrc),pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text
 INTO actual_md5,actual_owner,actual_security_definer,actual_config,actual_acl
 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)');
 IF NOT FOUND OR actual_md5 IS DISTINCT FROM '01a90ce540fef339484325d63c3312c2'
  OR actual_owner IS DISTINCT FROM 'postgres'
  OR actual_security_definer IS DISTINCT FROM true
  OR actual_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
  OR actual_acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 THEN RAISE EXCEPTION 'R06_GEMINI_CACHE_GUARD_DRIFT';END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.rpc_ai_prepare_input_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_purpose text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE owned jsonb;command jsonb;request jsonb;item jsonb;part jsonb;reserved jsonb;material jsonb;digest text;
 reservation_id uuid;input_prepared_at timestamptz;input_text text;hash text;has_inline boolean;has_cached boolean;
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
 has_inline:=false;has_cached:=false;
 IF jsonb_typeof(request)='object' THEN
  has_inline:=request-array['systemInstruction','contents','generationConfig']='{}'::jsonb
   AND request?&ARRAY['systemInstruction','contents','generationConfig']
   AND jsonb_typeof(request->'systemInstruction')='object'
   AND (request->'systemInstruction')-'parts'='{}'::jsonb
   AND jsonb_typeof(request#>'{systemInstruction,parts}')='array';
  has_cached:=request-array['cachedContent','contents','generationConfig']='{}'::jsonb
   AND request?&ARRAY['cachedContent','contents','generationConfig']
   AND jsonb_typeof(request->'cachedContent')='string'
   AND request->>'cachedContent'~'^cachedContents/[A-Za-z0-9_-]{1,200}$';
 END IF;
 IF jsonb_typeof(request) IS DISTINCT FROM 'object' OR NOT(has_inline OR has_cached)
  OR (has_cached AND jsonb_typeof(p_input->'catalog') IS DISTINCT FROM 'object')
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
 -- Inline instructions are validated part-by-part. A cache reference is accepted
 -- only as a server-generated immutable Google resource name bound to this snapshot.
 IF has_inline THEN
  FOR part IN SELECT value FROM jsonb_array_elements(request#>'{systemInstruction,parts}') LOOP
   IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR part-'text'<>'{}'::jsonb OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'R06_TEXT_ONLY_INPUT' USING errcode='22023';END IF;
  END LOOP;
 END IF;
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
  'instructionSha256',CASE WHEN has_inline THEN encode(extensions.digest((request->'systemInstruction')::text,'sha256'),'hex') ELSE encode(extensions.digest((request->>'cachedContent'),'sha256'),'hex') END,
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

DO $post$
DECLARE actual_md5 text;actual_owner text;actual_security_definer boolean;actual_config text[];actual_acl text;
BEGIN
 SELECT md5(p.prosrc),pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text
 INTO actual_md5,actual_owner,actual_security_definer,actual_config,actual_acl
 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)');
 IF NOT FOUND OR actual_md5 IS DISTINCT FROM '308166baa3a16c79f5adf6f202566107'
  OR actual_owner IS DISTINCT FROM 'postgres'
  OR actual_security_definer IS DISTINCT FROM true
  OR actual_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
  OR actual_acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 THEN RAISE EXCEPTION 'R06_GEMINI_CACHE_POST_DRIFT';END IF;
END
$post$;
COMMIT;
