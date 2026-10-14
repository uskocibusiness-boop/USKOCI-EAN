-- Gate A / source-only candidate. DO NOT deploy before disposable PG proof.
-- Stores verified-shape, NON-AUTHORITATIVE Gemini classification hints.
-- No direct category, capability, need, review, matchmaking or push writes.
-- Capturing a succeeded provider turn is not proof the owner saw or approved it.
BEGIN;
CREATE TABLE IF NOT EXISTS private.work_taxonomy_gemini_turn_hints_v1 (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('WORKER_CAPABILITY','NEED_SERVICE')),
  account_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  client_request_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  catalog_version bigint NOT NULL CHECK (catalog_version > 0),
  proposals jsonb NOT NULL CHECK (jsonb_typeof(proposals)='array' AND jsonb_array_length(proposals) BETWEEN 1 AND 12),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE(purpose,account_id,turn_id)
);
CREATE INDEX IF NOT EXISTS work_taxonomy_gemini_hints_conversation_v1
  ON private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,created_at DESC);
ALTER TABLE private.work_taxonomy_gemini_turn_hints_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_gemini_turn_hints_v1 FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE private.work_taxonomy_gemini_turn_hints_v1 IS
 'UNTRUSTED candidate hints only; signed owner review must independently revalidate current source, mode, catalog fingerprint and service meaning before any admission.';

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_capture_gemini_turn_hints_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,
 p_turn_id uuid,p_attempt_id uuid,p_purpose text,
 p_catalog_version bigint,p_proposals jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $capture$
DECLARE
 v_source text;v_digest text;v_existing private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_row jsonb;v_count integer;v_seen text[]:=ARRAY[]::text[];v_normalized text;
BEGIN
 -- Definer privileges alone are not authorization; require the actual JWT role.
 IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_DENIED' USING errcode='42501';
 END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR
    p_client_request_id IS NULL OR p_turn_id IS NULL OR p_attempt_id IS NULL OR
    p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') OR
    coalesce(p_catalog_version,0) < 1 OR
    jsonb_typeof(p_proposals) IS DISTINCT FROM 'array' OR
    pg_column_size(p_proposals)>10000 THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 v_count:=jsonb_array_length(p_proposals);
 IF v_count NOT BETWEEN 1 AND CASE WHEN p_purpose='WORKER_CAPABILITY' THEN 12 ELSE 6 END THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_proposals) LOOP
   IF jsonb_typeof(v_row)<>'object'
      OR NOT (v_row ?& array['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'])
      OR (SELECT count(*) FROM jsonb_object_keys(v_row)) <> 8
      OR jsonb_typeof(v_row->'service') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'reason') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'mode') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'action') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'categoryId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'parentId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'catalogVersion') IS DISTINCT FROM 'number'
      OR char_length(btrim(v_row->>'service')) NOT BETWEEN 3 AND 120
      OR char_length(btrim(v_row->>'reason')) NOT BETWEEN 10 AND 1000
      OR v_row->>'mode' NOT IN ('REMOTE','ON_SITE')
      OR v_row->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD')
      OR (v_row->>'catalogVersion')::bigint IS DISTINCT FROM p_catalog_version
      OR jsonb_typeof(v_row->'proposedPath')<>'array'
      OR jsonb_array_length(v_row->'proposedPath')>6
      OR (v_row->>'action'='REUSE_EXISTING' AND
          (v_row->>'categoryId' IS NULL OR v_row->>'categoryId'=''
           OR v_row->>'parentId'<>'' OR jsonb_array_length(v_row->'proposedPath')<>0))
      OR (v_row->>'action'='CREATE_CHILD' AND
          (v_row->>'categoryId'<>'' OR v_row->>'parentId' IS NULL
           OR v_row->>'parentId'='' OR jsonb_array_length(v_row->'proposedPath')<1))
   THEN RAISE EXCEPTION 'TAXONOMY_CAPTURE_PLAN_INVALID' USING errcode='22023'; END IF;
   -- Identity duplicates cannot be used to smuggle another mode/service.
   -- The canonical normalizer collapses Serbian Cyrillic/Latin variants.
   v_normalized:=private.taxonomy_normalize_v1(v_row->>'service');
   IF v_normalized IS NULL OR char_length(v_normalized)<3 OR v_normalized=ANY(v_seen) THEN
     RAISE EXCEPTION 'TAXONOMY_CAPTURE_DUPLICATE_OR_INVALID_SERVICE' USING errcode='22023';
   END IF;
   v_seen:=array_append(v_seen,v_normalized);
 END LOOP;

 -- Only a DURABLY COMPLETED turn with the exact owner/attempt identity
 -- can produce a hint. A claimed/failed/cancelled or forged turn cannot.
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
   INTO v_source
   FROM private.worker_ai_turns t
   JOIN private.worker_ai_sessions s
     ON s.account_id=t.account_id AND s.conversation_id=t.conversation_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED';
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex')
   INTO v_source
   FROM private.ai_need_turn_commands t
   JOIN public.ai_conversations c ON c.id=t.conversation_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED' AND c.account_id=p_account_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_TURN_UNCONFIRMED' USING errcode='42501';
 END IF;
 -- A succeeded LLM turn is NOT proof that any named service is in the current
 -- worker profile. The candidate's saved skills must contain every proposed
 -- service now, including after a later correction/removal in the same turn.
 -- A partial set is permitted as an untrusted hint, but the eventual owner
 -- review will refuse READY unless it covers ALL current services.
 IF p_purpose='WORKER_CAPABILITY' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_proposals) proposal(value)
    WHERE NOT EXISTS(
      SELECT 1 FROM private.worker_ai_sessions s,
        LATERAL jsonb_array_elements_text(s.candidate->'skills') offered(skill)
      WHERE s.account_id=p_account_id AND s.conversation_id=p_conversation_id
        AND private.taxonomy_normalize_v1(offered.skill)=
            private.taxonomy_normalize_v1(proposal.value->>'service')
    )
 ) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_WORKER_SERVICE_NOT_OFFERED' USING errcode='22023';
 END IF;
 v_digest:=encode(extensions.digest(p_proposals::text,'sha256'),'hex');
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(
   purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,
   source_fingerprint,catalog_version,proposals,payload_digest)
 VALUES(p_purpose,p_account_id,p_conversation_id,p_client_request_id,
   p_turn_id,p_attempt_id,v_source,p_catalog_version,p_proposals,v_digest)
 ON CONFLICT(purpose,account_id,turn_id) DO NOTHING;
 SELECT * INTO v_existing FROM private.work_taxonomy_gemini_turn_hints_v1
   WHERE purpose=p_purpose AND account_id=p_account_id AND turn_id=p_turn_id;
 IF NOT FOUND OR v_existing.client_request_id<>p_client_request_id
   OR v_existing.attempt_id<>p_attempt_id
   OR v_existing.conversation_id<>p_conversation_id
   OR v_existing.source_fingerprint<>v_source
   OR v_existing.catalog_version<>p_catalog_version
   OR v_existing.payload_digest<>v_digest
   OR v_existing.proposals IS DISTINCT FROM p_proposals THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_REPLAY_CONFLICT' USING errcode='22023';
 END IF;
 RETURN jsonb_build_object('action','HINT_CAPTURED','authority','NONE');
END $capture$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_capture_gemini_turn_hints_service(
 uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_capture_gemini_turn_hints_service(
 uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) TO service_role;
COMMIT;
