-- USKOCI / PR #6: OPERATOR PRE-FLIGHT, read-only and safe on live DEV.
-- NOT a permission to send, publish, deploy, change cron, or run dispatch.
-- Use only as one snapshot before seeking separate approval for one-target E2E.
-- Provider environment switches, identity of intended target and on-device receipt
-- are intentionally UNKNOWN here: SQL metadata cannot prove any of them.
WITH
source AS (
 SELECT md5(p.prosrc) AS md5
 FROM pg_proc p
 WHERE p.oid = 'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure
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
   WHEN live_matcher_md5 = 'd18c47226723ffbbec474aa4547e1af1'
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
 (live_matcher_md5 = 'd18c47226723ffbbec474aa4547e1af1') AS candidate_installed,
 dispatch_switch->>'mode' AS dispatch_mode,
 dispatch_switch->>'ceiling' AS task_ceiling,
 dispatch_switch->>'remoteCeiling' AS remote_ceiling,
 dispatch_switch->>'workerNotifyPerTransaction' AS per_transaction_ceiling,
 queued_needs, active_marketplace_crons,
 opportunity_deliveries, opportunity_events,
 push_readiness_rows, active_session_bound_devices,
 'UNKNOWN: provider flags, chosen recipient, Auth/RLS E2E, Expo receipt, HONOR tap' AS manual_gates
FROM checks;
