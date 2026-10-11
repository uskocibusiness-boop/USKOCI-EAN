-- USKOCI SQL CANDIDATE, NOT CONNECTED TO LIVE DISPATCH.
-- A purely capability-level tier, not full dispatch eligibility. Never sends.
BEGIN;
CREATE TABLE private.work_taxonomy_related_acceptances (
 worker_account_id uuid NOT NULL,
 source_category_id uuid NOT NULL,
 target_category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 explicitly_confirmed_at timestamptz NOT NULL,
 relationship_version bigint NOT NULL CHECK (relationship_version > 0),
 PRIMARY KEY(worker_account_id,source_category_id,target_category_id),
 FOREIGN KEY(worker_account_id,source_category_id)
  REFERENCES private.work_taxonomy_worker_capabilities(worker_account_id,category_id),
 CHECK (source_category_id<>target_category_id)
);
CREATE INDEX work_taxonomy_related_target_idx
 ON private.work_taxonomy_related_acceptances(target_category_id,worker_account_id);
ALTER TABLE private.work_taxonomy_related_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_related_acceptances FROM PUBLIC;
-- Verified related acceptance must be written only through a later identity-bound flow.
GRANT SELECT ON private.work_taxonomy_related_acceptances TO service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_capability_tier_v1(
 p_need_id uuid, p_need_revision integer, p_worker_account_id uuid
) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, private
AS $function$
DECLARE
 req uuid;
 found_requirement boolean := false;
 match_rank integer;
 overall_rank integer := 3;
BEGIN
 IF p_worker_account_id IS NULL OR p_need_id IS NULL OR p_need_revision IS NULL THEN
  RETURN 'NO_SAFE_MATCH';
 END IF;
 -- A snapshot is never an entitlement unless explicitly confirmed by publisher.
 IF NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
    AND s.classification_state='CONFIRMED' AND s.reviewed_by_requester
    AND s.category_id IS NOT NULL
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 -- Explicit required skills take precedence. If none, match the reviewed category.
 -- Every explicit requirement must be satisfied; never turn an empty list into a wildcard.
 FOR req IN
  SELECT x.category_id FROM private.work_taxonomy_need_skills x
  WHERE x.need_id=p_need_id AND x.need_revision=p_need_revision
  UNION ALL
  SELECT s.category_id FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
    AND NOT EXISTS (
     SELECT 1 FROM private.work_taxonomy_need_skills x
     WHERE x.need_id=s.need_id AND x.need_revision=s.need_revision
    )
 LOOP
  found_requirement := true;
  IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories c
                 WHERE c.id=req AND c.state<>'RETIRED') THEN
   RETURN 'NO_SAFE_MATCH';
  END IF;
  match_rank := 0;
  -- EXACT: the worker personally confirmed the canonical skill.
  IF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    WHERE w.worker_account_id=p_worker_account_id
      AND w.category_id=req AND NOT w.excluded
  ) THEN match_rank := 3;
  -- EQUIVALENT: a trusted, verified directed equivalence, not fuzzy AI proximity.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
      AND r.relation='EQUIVALENT_VERIFIED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 2;
  -- RELATED: BOTH a verified competence relationship AND THIS worker's
  -- explicit acceptance of this exact source -> target work, with opt-in.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    JOIN private.work_taxonomy_related_acceptances a
      ON a.worker_account_id=w.worker_account_id
     AND a.source_category_id=w.category_id AND a.target_category_id=req
     AND a.relationship_version=r.version
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
      AND w.allow_related_offers
      AND r.relation='CAPABILITY_CONFIRMED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 1;
  END IF;
  IF match_rank=0 THEN RETURN 'NO_SAFE_MATCH'; END IF;
  overall_rank := LEAST(overall_rank,match_rank);
 END LOOP;
 IF NOT found_requirement THEN RETURN 'NO_SAFE_MATCH'; END IF;
 RETURN CASE overall_rank WHEN 3 THEN 'EXACT'
                           WHEN 2 THEN 'EQUIVALENT'
                           WHEN 1 THEN 'RELATED_CONFIRMED'
                           ELSE 'NO_SAFE_MATCH' END;
END
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_capability_tier_v1(uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_capability_tier_v1(uuid,integer,uuid) TO service_role;
COMMIT;
