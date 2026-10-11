-- USKOCI / PR #6: OPERATOR PRE-FLIGHT, read-only and safe on live DEV.
-- NOT a permission to send, publish, deploy, change cron, or run dispatch.
-- Use only as one snapshot before seeking separate approval for one-target E2E.
-- Provider environment switches, identity of intended target and on-device receipt
-- are intentionally UNKNOWN here: SQL metadata cannot prove any of them.
-- Readiness now ALSO requires all seven time APIs, the matching time tier,
-- discovery expiry and exact-event target resolver/admission. A SQL signature
-- only confirms presence, not live Edge feature flags, Auth/RLS or safe sends.
WITH
source AS (
 SELECT md5(p.prosrc) AS md5
 FROM pg_proc p
 WHERE p.oid = 'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure
),
time_sources AS (
 SELECT
  (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure) AS time_tier_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure) AS discovery_time_md5
),
start_only_bundle AS (
 -- Seven cooperating review/response/candidate RPCs are one release boundary.
 -- A partial deployment must never be described as safe E2E readiness.
 SELECT count(*) FILTER (WHERE p.oid IS NOT NULL AND md5(p.prosrc)=expected.body_md5) = 7 AS all_seven_installed
 FROM (VALUES
  ('public.rpc_save_need_draft_from_review(uuid,uuid,text)','559c9d81ee97caec2ccd9ec19b3e95ca'),
  ('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','8a94e2b748485f0850e477369c3de3d2'),
  ('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)','b058ee01fc16a6f3018969ac911afbe4'),
  ('public.rpc_select_response(uuid,integer,uuid,integer,text,text)','faab1bde1460e904e9a083d2a8382b18'),
  ('public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)','5d8e51d8dbb8d92528d794bd83233dd3'),
  ('private.need_candidate_states_v5(uuid)','3f24c4533d63cefdb6f8421443faf150'),
  ('private.need_candidate_states_v5(uuid,uuid[])','28e1422d1a74b24911242fd4577e4450')
 ) AS expected(signature,body_md5)
 LEFT JOIN pg_proc p ON p.oid = to_regprocedure(expected.signature)
),
targeted_push AS (
 SELECT
  to_regprocedure('public.rpc_resolve_activity_opportunity_v1(uuid,uuid)') IS NOT NULL AS exact_activity_resolver_installed,
  to_regprocedure('private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)') IS NOT NULL AS exact_target_admission_installed
),
dispatch_config AS (
 SELECT value FROM private.marketplace_config WHERE key = 'match_v1_dispatch'
),
queue AS (
 SELECT count(*) AS queued FROM private.dispatch_schedule
),
opportunities AS (
 SELECT count(*) AS created FROM public.opportunity_deliveries
),
events AS (
 SELECT count(*) FILTER (WHERE event_type = 'OPPORTUNITY_AVAILABLE') AS opportunity_events
 FROM public.user_activity_events
),
push_state AS (
 SELECT count(*) AS readiness_rows FROM private.push_runtime_readiness
),
devices AS (
 SELECT count(*) FILTER (WHERE active AND bound_session_id IS NOT NULL) AS active_bound
 FROM public.notification_push_devices
),
cron_state AS (
 SELECT count(*) FILTER (WHERE active AND jobname = 'uskoci_marketplace_tick') AS active_marketplace_crons
 FROM cron.job
),
checks AS (
 SELECT
   (SELECT md5 FROM source) AS live_matcher_md5,
   (SELECT time_tier_md5 FROM time_sources) AS live_time_tier_md5,
   (SELECT discovery_time_md5 FROM time_sources) AS live_discovery_time_md5,
   (SELECT all_seven_installed FROM start_only_bundle) AS start_only_api_bundle_installed,
   (SELECT exact_activity_resolver_installed FROM targeted_push) AS exact_activity_resolver_installed,
   (SELECT exact_target_admission_installed FROM targeted_push) AS exact_target_admission_installed,
   (SELECT value FROM dispatch_config) AS dispatch_switch,
   (SELECT queued FROM queue) AS queued_needs,
   (SELECT created FROM opportunities) AS opportunity_deliveries,
   (SELECT opportunity_events FROM events) AS opportunity_events,
   (SELECT readiness_rows FROM push_state) AS push_readiness_rows,
   (SELECT active_bound FROM devices) AS active_session_bound_devices,
   (SELECT active_marketplace_crons FROM cron_state) AS active_marketplace_crons
)
SELECT
 'READ_ONLY_SNAPSHOT_NOT_E2E_AUTHORIZATION' AS evidence_kind,
 CASE
   WHEN live_matcher_md5 = 'd511b48f7f3b38f52aaffee420108f8a'
    AND live_time_tier_md5 = '34c977e537ce731587a37a0bc1562296'
    AND live_discovery_time_md5 = '0fd72e91c11eeac2c2501f3a8f753734'
    AND start_only_api_bundle_installed
    AND exact_activity_resolver_installed
    AND exact_target_admission_installed
    AND dispatch_switch->>'mode' = 'ALL'
    AND coalesce((dispatch_switch->>'ceiling')::int,10001) <= 1
    AND coalesce((dispatch_switch->>'remoteCeiling')::int,10001) <= 1
    AND coalesce((dispatch_switch->>'workerNotifyPerTransaction')::int,10001) <= 1
    AND queued_needs = 0
    AND active_marketplace_crons = 0
    AND active_session_bound_devices >= 1
   THEN 'MANUAL_GATES_STILL_REQUIRED'
   ELSE 'BLOCKED'
 END AS preflight_state,
 live_matcher_md5,
 (live_matcher_md5 = 'd511b48f7f3b38f52aaffee420108f8a') AS candidate_installed,
 live_time_tier_md5,
 (live_time_tier_md5 = '34c977e537ce731587a37a0bc1562296') AS time_tier_candidate_installed,
 live_discovery_time_md5,
 (live_discovery_time_md5 = '0fd72e91c11eeac2c2501f3a8f753734') AS discovery_time_candidate_installed,
 start_only_api_bundle_installed,
 exact_activity_resolver_installed,
 exact_target_admission_installed,
 dispatch_switch->>'mode' AS dispatch_mode,
 dispatch_switch->>'ceiling' AS task_ceiling,
 dispatch_switch->>'remoteCeiling' AS remote_ceiling,
 dispatch_switch->>'workerNotifyPerTransaction' AS per_transaction_ceiling,
 queued_needs, active_marketplace_crons,
 opportunity_deliveries, opportunity_events,
 push_readiness_rows, active_session_bound_devices,
 'UNKNOWN: provider flags, chosen recipient, Auth/RLS E2E, Expo receipt, HONOR tap' AS manual_gates
FROM checks;
