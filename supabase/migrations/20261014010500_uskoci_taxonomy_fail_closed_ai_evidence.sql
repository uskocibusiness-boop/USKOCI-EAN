-- USKOCI V5 / DEV: Safe taxonomy inheritance evidence gate, 2026-10-14.
-- Treat AI-created branches as discovery/navigation, never verified competency.
-- Keep EXACT worker-confirmed category, curated/human evidence and opt-in paths.
-- Does not remove any category, profile, link, notification or task.
-- Refuse to overwrite a changed function until re-reviewed.
DO $before$
BEGIN
  IF (SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='private' AND p.proname='taxonomy_requirement_tier_inherited_v1'
  ) IS DISTINCT FROM 'b39a4380e52b1afd3e9c3190d42ba643' THEN
    RAISE EXCEPTION 'TAXONOMY_TIER_SOURCE_DRIFT: review live SQL before altering matching';
  END IF;
END $before$;

CREATE OR REPLACE FUNCTION private.taxonomy_requirement_tier_inherited_v1(p_req uuid, p_worker_account_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
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
    AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
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
    AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
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
    WHERE e.child_category_id=p_req
      -- AI-created branch ancestry is classification, not a worker competence proof.
      AND left(e.evidence_ref,3) <> 'AI_'
      AND EXISTS (
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
      AND left(e.evidence_ref,3) <> 'AI_'
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
END $function$
;
