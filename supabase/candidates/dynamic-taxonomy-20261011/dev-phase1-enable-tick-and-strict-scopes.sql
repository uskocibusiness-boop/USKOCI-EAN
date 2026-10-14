-- USKOCI controlled DEV-only phase-1 activation. Source is audited, no secrets embedded.
-- Requires prior phase-1 snapshot + legacy self-registration retirement and
-- shared matcher strict scope guard. Old APK client stays on legacy review API,
-- but old unsigned skills are intentionally NOT eligible while strict is on.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('private.dev_phase1_20261014_dispatch_snapshot') IS NULL
  OR to_regclass('private.dev_phase1_20261014_worker_capabilities_snapshot') IS NULL
  OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
  OR position('rpc_taxonomy_ensure_path_service' in
    (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private' AND p.proname='sync_worker_skills_to_taxonomy_capabilities'))>0
  OR position('SIGNED_SERVICE_SCOPE_REQUIRED' in
    (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private' AND p.proname='worker_need_fit_v1'))=0
  OR to_regprocedure('public.rpc_taxonomy_bind_ready_reviews_service(integer)') IS NULL
  OR to_regprocedure('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)') IS NULL
  OR to_regprocedure('public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'DEV_PHASE1_PRECONDITIONS_NOT_MET' USING ERRCODE='PT409'; END IF;
END $preflight$;
UPDATE private.work_taxonomy_review_outbox_control_v1 SET enabled=true WHERE singleton=true;
UPDATE private.work_taxonomy_binding_control_v1 SET enabled=true WHERE singleton=true;
UPDATE private.taxonomy_match_scope_control_v1 SET enabled=true WHERE singleton=true;
DO $assert$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_review_outbox_control_v1 WHERE singleton AND enabled)
 OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_binding_control_v1 WHERE singleton AND enabled)
 OR NOT EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'DEV_PHASE1_GATE_NOT_ENABLED'; END IF;
END $assert$;
-- Existing Vault worker credential is validated by the Edge Function itself;
-- no secret values are copied into stored cron commands.
SELECT cron.schedule(
 'uskoci_taxonomy_postsave_tick_dev','* * * * *',
 $job$
 SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='uskoci_edge_base_url')||'/functions/v1/uskoci-taxonomy-postsave-worker',
  headers := jsonb_build_object('Content-Type','application/json','apikey',
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='uskoci_edge_worker_key')),
  body := '{}'::jsonb,
  timeout_milliseconds := 26000
 ) AS request_id
 WHERE EXISTS(SELECT 1 FROM private.work_taxonomy_review_outbox_control_v1 WHERE singleton AND enabled);
 $job$
);
COMMIT;
