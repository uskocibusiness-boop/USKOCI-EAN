-- Use the existing owner-bound reviewed admission planner in the AI-only review.
-- Does not create categories/capabilities, grant consent, save a profile or send push.
-- Preserve the complete predecessor function and its ACLs; fail on unexpected drift.
DO $migration$
DECLARE
  original text;
  updated text;
  old_call text := E'v_projection:=private.taxonomy_review_exact_projection_v1(\n   ''WORKER_CAPABILITY'',s.candidate->''skills'',v_modes);';
  new_call text := E'v_projection:=private.taxonomy_review_candidate_projection_v2(\n   ''WORKER_CAPABILITY'',s.candidate->''skills'',v_modes,auth.uid(),p_conversation_id);';
  old_actions text := 'v_item->>''action'' in (''REUSE_EXISTING'',''CREATE_CHILD'')';
  new_actions text := 'v_item->>''action'' in (''REUSE_EXISTING'',''REUSE_ALIAS'',''CREATE_CHILD'',''CREATE_NEW_BRANCH'')';
BEGIN
  original := pg_get_functiondef('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'::regprocedure);
  IF md5(original) <> 'c0f07a6cfac8c55ac05267b09998d5d8'
    OR md5(pg_get_functiondef('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure)) <> '2163c8fe213d39b32a91288e05a132ac'
  THEN RAISE EXCEPTION 'WORKER_AI_REVIEW_CANDIDATE_PREDECESSOR_MISMATCH'; END IF;
  IF cardinality(string_to_array(original,old_call)) <> 2
    OR cardinality(string_to_array(original,old_actions)) <> 2
  THEN RAISE EXCEPTION 'WORKER_AI_REVIEW_CANDIDATE_PATCH_AMBIGUOUS'; END IF;
  updated := replace(replace(original,old_call,new_call),old_actions,new_actions);
  -- Existing saved-consent fallback still uses exact projection. Risk triage,
  -- source fingerprint, owner, catalog version and signed-save guards stay intact.
  EXECUTE updated;
END $migration$;
