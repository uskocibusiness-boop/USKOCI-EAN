-- USKOČI P2 isolated candidate — NOT DEPLOYED, NOT ENABLED.
-- Correct capability ID is necessary but NOT sufficient for safe matching.
-- Per-SERVICE REMOTE/ON_SITE permission comes only from signed worker Save.
-- This gate must remain OFF until signed mode-binding & need snapshots are LIVE.
BEGIN;
CREATE TABLE IF NOT EXISTS private.taxonomy_match_scope_control_v1 (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.taxonomy_match_scope_control_v1(singleton,enabled)
 VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
REVOKE ALL ON private.taxonomy_match_scope_control_v1 FROM PUBLIC,anon,authenticated;
ALTER TABLE private.taxonomy_match_scope_control_v1 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.taxonomy_confirmed_worker_modes_v1 (
 worker_account_id uuid NOT NULL,
 category_id uuid NOT NULL,
 execution_scope text NOT NULL CHECK(execution_scope IN('REMOTE','ON_SITE')),
 source_review_id uuid NOT NULL,
 source_request_key uuid NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(worker_account_id,category_id,execution_scope),
 FOREIGN KEY(worker_account_id,category_id)
  REFERENCES private.work_taxonomy_worker_capabilities(worker_account_id,category_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(category_id,execution_scope)
  REFERENCES private.work_taxonomy_category_modes(category_id,execution_scope)
  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS taxonomy_worker_mode_by_category_v1
 ON private.taxonomy_confirmed_worker_modes_v1(category_id,execution_scope,worker_account_id)
 WHERE active;
REVOKE ALL ON private.taxonomy_confirmed_worker_modes_v1 FROM PUBLIC,anon,authenticated;
ALTER TABLE private.taxonomy_confirmed_worker_modes_v1 ENABLE ROW LEVEL SECURITY;

-- Restrictive EXACT category-and-scope gate. Does not grant synonym/inherited
-- competence, related offers, need publication, worker skills or push.
CREATE OR REPLACE FUNCTION private.taxonomy_scope_eligible_v1(
 p_need_id uuid,p_worker_account_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,private
AS $eligible$
DECLARE v_category uuid;v_revision integer;v_mode text;v_scope text;
BEGIN
 IF p_need_id IS NULL OR p_worker_account_id IS NULL THEN RETURN false; END IF;
 SELECT n.category_id,n.revision,n.execution_location_mode
  INTO v_category,v_revision,v_mode FROM public.needs n WHERE n.id=p_need_id;
 IF NOT FOUND OR v_category IS NULL OR v_revision IS NULL THEN RETURN false; END IF;
 v_scope:=CASE v_mode WHEN 'REMOTE' THEN 'REMOTE'
   WHEN 'STATIONARY' THEN 'ON_SITE'
   WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
   WHEN 'AREA_BASED' THEN 'ON_SITE'
   ELSE NULL END;
 IF v_scope IS NULL THEN RETURN false; END IF;
 -- Only requester's EXACT signed/current need revision may participate.
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=v_revision
    AND s.category_id=v_category AND s.reviewed_by_requester
    AND s.classification_state='CONFIRMED') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
   WHERE c.id=v_category AND c.state='ESTABLISHED' AND cm.execution_scope=v_scope)
 THEN RETURN false; END IF;
 -- Confirmed worker GLOBAL execution choice is necessary, never sufficient.
 IF NOT EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_account_id=p_worker_account_id
     AND v_scope=ANY(choice.modes) AND choice.confirmed_at IS NOT NULL)
 THEN RETURN false; END IF;
 -- Require saved human consent for this precise worker+service+scope.
 IF NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
  JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id
   AND cap.category_id=m.category_id AND NOT cap.excluded
  JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id
   AND saved.review_id=m.source_review_id
   AND saved.client_request_id=m.source_request_key
  WHERE m.worker_account_id=p_worker_account_id AND m.category_id=v_category
    AND m.execution_scope=v_scope AND m.active)
 THEN RETURN false; END IF;
 RETURN true;
END $eligible$;
REVOKE ALL ON FUNCTION private.taxonomy_scope_eligible_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
COMMIT;
