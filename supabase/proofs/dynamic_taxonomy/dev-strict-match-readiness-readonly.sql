-- USKOCI DEV Gate A/B/C: repeatable READ-ONLY readiness audit.
-- Purpose: fail visibly when strict matching is ON but current signed Need
-- revisions / explicitly confirmed worker service modes have not been bound.
-- Output is aggregate-only; never log personal identities or private locations.
-- Do NOT relax strict matching, forge confirmation, or auto-grant parent skills.
-- Passing this query is NOT phone / push / actual per-pair E2E proof.
WITH controls AS (
 SELECT
  coalesce((SELECT enabled FROM private.taxonomy_match_scope_control_v1 WHERE singleton),false) AS strict_match_enabled,
  coalesce((SELECT enabled FROM private.work_taxonomy_binding_control_v1 WHERE singleton),false) AS binding_enabled,
  coalesce((SELECT enabled FROM private.work_taxonomy_review_outbox_control_v1 WHERE singleton),false) AS outbox_enabled,
  coalesce((SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton),false) AS legacy_auto_registration_enabled
), counts AS (
 SELECT
  (SELECT count(*) FROM public.needs WHERE status='PUBLISHED') AS published_needs,
  (SELECT count(*) FROM public.needs WHERE status='PUBLISHED' AND category_id IS NULL) AS published_without_category_id,
  (SELECT count(*) FROM public.needs n JOIN private.work_taxonomy_need_snapshots s
      ON s.need_id=n.id AND s.need_revision=n.revision AND s.category_id=n.category_id
      WHERE n.status='PUBLISHED' AND s.classification_state='CONFIRMED' AND s.reviewed_by_requester) AS published_with_signed_current_snapshot,
  (SELECT count(*) FROM public.app_profiles WHERE kind='WORKER' AND profile_status='ACTIVE') AS active_worker_profiles,
  (SELECT count(*) FROM private.work_taxonomy_worker_capabilities WHERE excluded=false) AS nonexcluded_worker_capabilities,
  (SELECT count(*) FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active) AS active_confirmed_worker_modes,
  (SELECT count(*) FROM private.work_taxonomy_worker_bindings_v1) AS signed_worker_bindings,
  (SELECT count(*) FROM private.work_taxonomy_need_bindings_v1) AS signed_need_bindings,
  (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE state='COMMITTED') AS committed_outbox_rows,
  (SELECT count(*) FROM private.worker_calendar_events WHERE state='BLOCKING') AS blocking_calendar_events
)
SELECT controls.*, counts.*,
 CASE WHEN controls.strict_match_enabled
   AND counts.published_needs > 0
   AND (counts.published_with_signed_current_snapshot = 0 OR counts.active_confirmed_worker_modes = 0)
   THEN 'P0_BLOCKED_STRICT_MATCH_HAS_NO_SIGNED_PAIR'
 WHEN controls.strict_match_enabled AND counts.published_needs > 0
   AND counts.nonexcluded_worker_capabilities = 0
   THEN 'P0_BLOCKED_NO_CONFIRMED_WORKER_CAPABILITIES'
 WHEN controls.strict_match_enabled AND counts.published_needs > 0
   THEN 'REQUIRES_PER_PAIR_MATCHER_AND_AUTH_E2E'
 ELSE 'NO_PUBLISHED_NEED_OR_STRICT_MATCH_OFF'
 END AS readiness_verdict
FROM controls CROSS JOIN counts;
