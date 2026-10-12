-- USKOCI SOURCE-ONLY candidate, NOT a live migration. No DEV/PROD writes.
-- Trusted *standard-service* parent -> child coverage. This is NOT lexical
-- similarity, a guessed AI relationship, a global permission or push authority.
-- Apply only after separately approved source-pinned migration and UI consent.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $guard$
BEGIN
 IF to_regclass('private.work_taxonomy_standard_coverage') IS NOT NULL
 OR to_regprocedure('private.taxonomy_capability_tier_inherited_v1(uuid,integer,uuid)') IS NOT NULL
 OR to_regprocedure('private.taxonomy_requirement_tier_inherited_v1(uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'TAXONOMY_COVERAGE_ALREADY_INSTALLED'; END IF;
 IF to_regclass('private.work_taxonomy_category_modes') IS NULL
 OR to_regclass('private.work_taxonomy_worker_capabilities') IS NULL
 OR to_regprocedure('private.taxonomy_capability_tier_v1(uuid,integer,uuid)') IS NULL
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'TAXONOMY_COVERAGE_PRECONDITION'; END IF;
END $guard$;

-- A category's parent is a persistent identity relationship. A verified
-- standard-child edge must never be silently invalidated by reparenting.
-- Existing category IDs and all task/worker rows are left unchanged.
CREATE FUNCTION private.taxonomy_guard_parent_move_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $fn$
BEGIN
 IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
  RAISE EXCEPTION 'TAXONOMY_PARENT_REASSIGNMENT_FORBIDDEN';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER taxonomy_guard_parent_move
BEFORE UPDATE OF parent_id ON private.work_taxonomy_categories
FOR EACH ROW EXECUTE FUNCTION private.taxonomy_guard_parent_move_v1();

CREATE TABLE private.work_taxonomy_standard_coverage (
 parent_category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 child_category_id uuid PRIMARY KEY REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 verification text NOT NULL DEFAULT 'VERIFIED' CHECK (verification='VERIFIED'),
 evidence_ref text NOT NULL CHECK (char_length(btrim(evidence_ref)) BETWEEN 8 AND 240),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 CHECK (parent_category_id<>child_category_id)
);
ALTER TABLE private.work_taxonomy_standard_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_standard_coverage FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.work_taxonomy_standard_coverage TO service_role;
CREATE INDEX work_taxonomy_coverage_parent_idx
 ON private.work_taxonomy_standard_coverage(parent_category_id);

-- Rows are operator/controlled-service verified, never written by public app,
-- AI, or service_role. Each edge must be the true direct parent-child relation,
-- both established and in at least one identical execution scope.
CREATE FUNCTION private.taxonomy_check_standard_coverage_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_categories p ON p.id=NEW.parent_category_id
  WHERE c.id=NEW.child_category_id AND c.parent_id=p.id
    AND c.state='ESTABLISHED' AND p.state='ESTABLISHED'
    AND EXISTS (
      SELECT 1 FROM private.work_taxonomy_category_modes cm
      JOIN private.work_taxonomy_category_modes pm
        ON pm.execution_scope=cm.execution_scope AND pm.category_id=p.id
      WHERE cm.category_id=c.id
    )
 ) THEN RAISE EXCEPTION 'TAXONOMY_COVERAGE_NOT_VERIFIED_PARENT_SCOPE'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER taxonomy_check_standard_coverage
BEFORE INSERT OR UPDATE ON private.work_taxonomy_standard_coverage
FOR EACH ROW EXECUTE FUNCTION private.taxonomy_check_standard_coverage_v1();

-- Read-only requirement evaluation. The first two paths keep the prior
-- exact/equivalent/related contract. Standard descendant coverage is permitted
-- ONLY along uninterrupted, verified, established, same-mode edges.
CREATE FUNCTION private.taxonomy_requirement_tier_inherited_v1(
 p_req uuid,p_worker_account_id uuid
) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog AS $fn$
BEGIN
 IF p_req IS NULL OR p_worker_account_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  WHERE c.id=p_req AND c.state<>'RETIRED'
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND w.excluded
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND NOT w.excluded
 ) THEN RETURN 'EXACT'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND r.relation='EQUIVALENT_VERIFIED' AND r.verification='VERIFIED'
    AND r.evidence_ref IS NOT NULL
 ) THEN RETURN 'EQUIVALENT'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  JOIN private.work_taxonomy_related_acceptances a
    ON a.worker_account_id=w.worker_account_id
      AND a.source_category_id=w.category_id AND a.target_category_id=p_req
      AND a.relationship_version=r.version
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND w.allow_related_offers AND r.relation='CAPABILITY_CONFIRMED'
    AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
 ) THEN RETURN 'RELATED_CONFIRMED'; END IF;

 IF EXISTS (
  WITH RECURSIVE coverage(ancestor_id,visited,depth) AS (
    SELECT e.parent_category_id,
           ARRAY[e.child_category_id,e.parent_category_id]::uuid[],1
    FROM private.work_taxonomy_standard_coverage e
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
         AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE e.child_category_id=p_req AND EXISTS (
      SELECT 1 FROM private.work_taxonomy_category_modes cm
      JOIN private.work_taxonomy_category_modes pm
        ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
      WHERE cm.category_id=c.id
    )
    UNION ALL
    SELECT e.parent_category_id,
           coverage.visited || e.parent_category_id,coverage.depth+1
    FROM coverage
    JOIN private.work_taxonomy_standard_coverage e
      ON e.child_category_id=coverage.ancestor_id
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
        AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE coverage.depth<32
      AND NOT e.parent_category_id=ANY(coverage.visited)
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
  )
  SELECT 1 FROM coverage path
  JOIN private.work_taxonomy_worker_capabilities w
    ON w.category_id=path.ancestor_id
    AND w.worker_account_id=p_worker_account_id AND NOT w.excluded
  WHERE NOT EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities x
    WHERE x.worker_account_id=p_worker_account_id
      AND x.excluded AND x.category_id=ANY(path.visited)
  )
 ) THEN RETURN 'INHERITED_STANDARD'; END IF;
 RETURN 'NO_SAFE_MATCH';
END $fn$;

-- Evaluates the whole confirmed task revision; every mandatory additional
-- skill must pass. NO dispatch, account eligibility, mode consent or push here.
CREATE FUNCTION private.taxonomy_capability_tier_inherited_v1(
 p_need_id uuid,p_need_revision integer,p_worker_account_id uuid
) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog AS $fn$
DECLARE req uuid; tier text; got boolean:=false; worst integer:=4;
 has_inherited boolean:=false;
BEGIN
 IF p_need_id IS NULL OR p_need_revision IS NULL OR p_worker_account_id IS NULL
 OR NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_need_snapshots s
   WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
    AND s.classification_state='CONFIRMED' AND s.reviewed_by_requester
    AND s.category_id IS NOT NULL
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 FOR req IN
  SELECT s.category_id FROM private.work_taxonomy_need_snapshots s
   WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
  UNION ALL
  SELECT x.category_id FROM private.work_taxonomy_need_skills x
   WHERE x.need_id=p_need_id AND x.need_revision=p_need_revision
 LOOP
  got:=true;
  tier:=private.taxonomy_requirement_tier_inherited_v1(req,p_worker_account_id);
  IF tier='NO_SAFE_MATCH' THEN RETURN tier; END IF;
  IF tier='INHERITED_STANDARD' THEN has_inherited:=true; END IF;
  worst:=LEAST(worst,CASE tier
    WHEN 'EXACT' THEN 4 WHEN 'INHERITED_STANDARD' THEN 3
    WHEN 'EQUIVALENT' THEN 2 WHEN 'RELATED_CONFIRMED' THEN 1 ELSE 0 END);
 END LOOP;
 IF NOT got THEN RETURN 'NO_SAFE_MATCH'; END IF;
 RETURN CASE worst WHEN 4 THEN 'EXACT'
    WHEN 3 THEN 'INHERITED_STANDARD'
    WHEN 2 THEN 'EQUIVALENT'
    WHEN 1 THEN 'RELATED_CONFIRMED'
    ELSE 'NO_SAFE_MATCH' END;
END $fn$;
REVOKE ALL ON FUNCTION private.taxonomy_guard_parent_move_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_check_standard_coverage_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_requirement_tier_inherited_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_capability_tier_inherited_v1(uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_requirement_tier_inherited_v1(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_capability_tier_inherited_v1(uuid,integer,uuid) TO service_role;
