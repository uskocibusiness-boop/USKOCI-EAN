-- DISPOSABLE PostgreSQL only. No DEV account IDs or raw conversation content.
-- Reuse proven real source/projection/Save/binder dependencies and synthetic data.
\ir ../../proofs/dynamic_taxonomy/worker-saved-mode-continuity/fixture.sql
\ir ../../migrations/20261018124717_worker_saved_mode_review_continuity.sql
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.role',true),'')
$f$;
ALTER TABLE private.worker_ai_turns ADD COLUMN account_id uuid,
 ADD COLUMN client_request_id uuid,ADD COLUMN lease_expires_at timestamptz,
 ADD COLUMN attempt_id uuid,ADD COLUMN created_at timestamptz DEFAULT clock_timestamp(),
 ADD COLUMN cancelled_at timestamptz,ADD COLUMN user_message_id uuid;
CREATE TABLE public.ai_messages(id uuid PRIMARY KEY,conversation_id uuid,role text,body text,sequence_no bigint);
\ir exact-context-dependencies.sql
\ir before.sql
CREATE FUNCTION proof.context() RETURNS jsonb LANGUAGE sql AS $f$
 SELECT public.rpc_read_worker_ai_context_service(proof.owner(),proof.fresh())
$f$;
CREATE FUNCTION proof.mode_context() RETURNS jsonb LANGUAGE sql AS $f$
 SELECT proof.context()->'serviceModeContext'
$f$;
CREATE FUNCTION proof.context_reset(p_modes text[] DEFAULT ARRAY['REMOTE']) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM proof.reset(p_modes);
 TRUNCATE public.ai_messages;
 PERFORM set_config('request.jwt.claim.role','service_role',false);
END $f$;
CREATE FUNCTION proof.expect_context_error(p_code text,p_message text,p_account uuid DEFAULT proof.owner())
 RETURNS void LANGUAGE plpgsql AS $f$
DECLARE caught text;
BEGIN
 BEGIN PERFORM public.rpc_read_worker_ai_context_service(p_account,proof.fresh());
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS caught=RETURNED_SQLSTATE;
 END;
 PERFORM proof.require(caught=p_code,p_message);
END $f$;
CREATE FUNCTION proof.add_current_hint(p_modes text[] DEFAULT ARRAY['REMOTE']) RETURNS void LANGUAGE sql AS $f$
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,source_fingerprint,catalog_version,proposals)
 SELECT 'WORKER_CAPABILITY',account_id,conversation_id,
 encode(extensions.digest(convert_to(candidate::text||'|'||revision::text||'|'||base_hash,'UTF8'),'sha256'),'hex'),4,
 (SELECT jsonb_agg(jsonb_build_object('action','REUSE_EXISTING','service','3D štampa','mode',mode,'categoryId',proof.category()))
   FROM unnest(p_modes) mode)
 FROM private.worker_ai_sessions WHERE conversation_id=proof.fresh()
$f$;
CREATE FUNCTION proof.expect_no_saved(p_message text) RETURNS void LANGUAGE sql AS $f$
 SELECT proof.require(proof.mode_context()->'savedServices'='[]'::jsonb,p_message)
$f$;
CREATE TABLE proof.context_results(label text PRIMARY KEY,doc jsonb);
SELECT proof.context_reset();

