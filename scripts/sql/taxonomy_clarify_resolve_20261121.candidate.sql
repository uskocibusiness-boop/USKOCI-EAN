-- USKOCI 2026-11-21: place a service into the taxonomy tree also when the AI turn's safety is CLARIFY.
-- SOURCE-ONLY CANDIDATE. No DEV/PROD execution is authorized by this file.
-- Owner decision 21.11.2026: an ordinary clarifying question ("Za koji datum?") must not defer the
-- server's catalog placement. ALLOW and CLARIFY resolve; REVIEW, BLOCK, NULL and any unknown value
-- remain DEFERRED/SAFETY_UNRESOLVED. private.taxonomy_risk_triage_v1 per service/path label stays the
-- real catalog safety gate (CATALOG_SAFETY). The caller private.taxonomy_first_plan_complete_receipt_v1
-- already admits only ALLOW/CLARIFY; Edge (uskoci-ai-interview, uskoci-worker-interview) already builds
-- the plan for ALLOW/CLARIFY, so no Edge change is required.
-- Ownership, ACL (postgres only), service_role JWT check, replay/idempotency and catalog checks are unchanged.
-- Preimage: scripts/sql/rollback_taxonomy_clarify_resolve_preimage_20261121.sql (read-only DEV snapshot 2026-11-21).
DO $source_only$
BEGIN
  RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_SOURCE_ONLY';
END
$source_only$;

-- Remove the guard only in a disposable PG17 fixture or after a separately reviewed
-- Supabase CLI migration has been prepared. Never run this script in the SQL editor.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $resolve_clarify$
DECLARE
  target regprocedure := 'private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl,
         p.prosecdef, p.proconfig, p.prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '639983846b4f6b51cfe62c91afe4b0d6'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM false
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,$old$
 -- Missing business details can still produce a useful conversation, but a
 -- safety clarification cannot become a global catalog mutation.
 IF p_safety IS DISTINCT FROM 'ALLOW' THEN
$old$),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_ANCHOR_DRIFT';
  END IF;
  d := replace(d,$old$
 -- Missing business details can still produce a useful conversation, but a
 -- safety clarification cannot become a global catalog mutation.
 IF p_safety IS DISTINCT FROM 'ALLOW' THEN
$old$,$new$
 -- An ordinary CLARIFY question is not a safety concern. REVIEW/BLOCK (and any
 -- unknown value) stay deferred; per-label risk triage below remains the gate.
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
$new$);
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, p.proacl::text acl, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM 'f468d6019b2586f62cc69809b54761af'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.metadata IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_POSTIMAGE_DRIFT'; END IF;
END
$resolve_clarify$;

COMMIT;
