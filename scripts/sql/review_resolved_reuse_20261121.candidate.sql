-- USKOCI 2026-11-21: Need review projection reuses the latest server-RESOLVED decision
-- of the same conversation when the current conversation source has no decision.
-- SOURCE-ONLY CANDIDATE. No DEV/PROD execution is authorized by this file.
-- Cause (DEV private.ai_task_reviews PENDING_CLASSIFICATION): the projection looked up a
-- Gemini decision only for the exact current source fingerprint; any later turn without a
-- decision (finish, price, map, CLARIFY) changed the source and the review fell back to an
-- exact-label lookup. Owner rule 21.11.2026: a ready task always shows its review card.
-- Scope: private.taxonomy_review_candidate_projection_v2, NEED_SERVICE only. Ownership
-- (auth.uid), catalog version/fingerprint, risk, leaf, mode and handoff checks are unchanged;
-- WORKER_CAPABILITY and the current-source path are byte-for-byte the same.
-- Preimage: scripts/sql/rollback_review_resolved_reuse_preimage_20261121.sql (read-only DEV
-- snapshot 2026-11-21, functiondef md5 aeae6f02c0ef0883dde1e220a396f1a2).
DO $source_only$
BEGIN
  RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_SOURCE_ONLY';
END
$source_only$;

-- Remove the guard only in a disposable PG17 fixture or after a separately reviewed
-- Supabase CLI migration has been prepared. Never run this script in the SQL editor.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $review_resolved_reuse$
DECLARE
  target regprocedure := 'private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl,
         p.prosecdef, p.proconfig, p.prokind, p.provolatile, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'f439455e1d5edb63ae4297a5c922a3c5'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM false
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, private']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
     OR actual.provolatile IS DISTINCT FROM 's'
  THEN RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,$old$ IF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN$old$),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_ANCHOR_DRIFT';
  END IF;
  d := replace(d,$old$ IF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN$old$,$new$ IF NOT FOUND AND p_purpose='NEED_SERVICE' THEN
   -- A later turn without a decision changes the conversation source. Reuse only
   -- the latest server-RESOLVED decision of this owner's conversation that covers
   -- every requested normalized service+mode exactly once. The resolved view
   -- revalidates the bound identity, mode, leaf and risk against the current
   -- catalog (same lineage); an invalid binding yields [] and is skipped.
   SELECT * INTO v_hint FROM private.work_taxonomy_turn_hints_resolved_v1 h
     WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
       AND h.conversation_id=p_conversation_id AND h.catalog_version=v_version
       AND h.catalog_resolution->>'state'='RESOLVED'
       AND jsonb_typeof(h.proposals)='array' AND jsonb_array_length(h.proposals)>0
       AND jsonb_typeof(p_service_modes)='array' AND jsonb_array_length(p_service_modes)>0
       AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_service_modes) want(value)
         WHERE (SELECT count(*) FROM jsonb_array_elements(h.proposals) p(value)
           WHERE private.taxonomy_normalize_v1(p.value->>'service')
               =private.taxonomy_normalize_v1(want.value->>'service')
             AND p.value->>'mode'=want.value->>'mode')<>1)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
   IF NOT FOUND THEN RETURN v_exact; END IF;
   -- Fail closed: any later decision (resolved, deferred or pending) for a
   -- requested service+mode supersedes it, and two resolved decisions with
   -- different categories for the same service+mode are ambiguous.
   IF EXISTS(SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1 later
       CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(later.proposals)='array'
         THEN later.proposals ELSE '[]'::jsonb END) lp(value)
       JOIN jsonb_array_elements(p_service_modes) want(value)
         ON private.taxonomy_normalize_v1(lp.value->>'service')
           =private.taxonomy_normalize_v1(want.value->>'service')
        AND lp.value->>'mode'=want.value->>'mode'
       WHERE later.purpose=p_purpose AND later.account_id=p_owner_account_id
         AND later.conversation_id=p_conversation_id
         AND (later.created_at,later.id)>(v_hint.created_at,v_hint.id))
     OR EXISTS(SELECT 1 FROM private.work_taxonomy_turn_hints_resolved_v1 other
       CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(other.proposals)='array'
         THEN other.proposals ELSE '[]'::jsonb END) op(value)
       JOIN jsonb_array_elements(v_hint.proposals) mine(value)
         ON private.taxonomy_normalize_v1(op.value->>'service')
           =private.taxonomy_normalize_v1(mine.value->>'service')
        AND op.value->>'mode'=mine.value->>'mode'
       WHERE other.purpose=p_purpose AND other.account_id=p_owner_account_id
         AND other.conversation_id=p_conversation_id
         AND other.catalog_resolution->>'state'='RESOLVED'
         AND op.value->>'categoryId' IS DISTINCT FROM mine.value->>'categoryId')
   THEN RETURN v_exact; END IF;
 ELSIF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN$new$);
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, p.proacl::text acl, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM 'a98a0b2228095b1db7236836633d09a7'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.metadata IS DISTINCT FROM original_metadata
     OR position('ELSIF NOT FOUND THEN RETURN v_exact; END IF;' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_POSTIMAGE_DRIFT'; END IF;
END
$review_resolved_reuse$;

COMMIT;
