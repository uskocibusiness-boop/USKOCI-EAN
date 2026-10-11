\set ON_ERROR_STOP on
-- End-to-end server preview contract with existing AI's need.category and
-- worker skill labels. Synthetic curated leaf only, zero real account writes.
DO $proof$
DECLARE
 v_remote uuid;
 v_leaf uuid;
 v jsonb;
 w jsonb;
BEGIN
 SELECT id INTO STRICT v_remote FROM private.work_taxonomy_categories
  WHERE canonical_key=private.taxonomy_normalize_v1('Digitalne usluge');
 INSERT INTO private.work_taxonomy_categories
   (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Izrada logotipa'),
   'Izrada logotipa',v_remote,'OPERATOR',2,'ESTABLISHED')
 RETURNING id INTO v_leaf;
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(v_leaf,'REMOTE','ISOLATED_APPROVED_FIXTURE');
 -- Reuse existing SAME service identity, but mode must match.
 v:=private.taxonomy_existing_ai_scoped_preview_v1('REMOTE',
     'Izrada logotipa','Potrebna izrada logotipa za mali posao.',ARRAY[]::text[]);
 IF v->>'action'<>'SUGGEST_EXISTING_SERVICE'
  OR v->>'executionScope'<>'REMOTE'
  OR v->>'categoryId'<>v_leaf::text
  OR v->>'classificationAuthority'<>'NONE'
  OR v->>'notificationAuthority'<>'NONE'
  OR v->>'requiresRequesterReview'<>'true'
 THEN RAISE EXCEPTION 'REMOTE_EXACT_AI_PROPOSAL_FAILED_%',v; END IF;
 v:=private.taxonomy_existing_ai_scoped_preview_v1('STATIONARY',
     'Izrada logotipa','Potrebna izrada logotipa za mali posao.',ARRAY[]::text[]);
 IF v->>'action'<>'CLARIFY' OR v->>'reason'<>'CATEGORY_NOT_IN_EXECUTION_SCOPE'
 THEN RAISE EXCEPTION 'REMOTE_SERVICE_LEAKED_ONSITE_%',v; END IF;
 w:=private.taxonomy_worker_scoped_capability_preview_v1('REMOTE','Izrada logotipa');
 IF w->>'action'<>'REUSE_EXISTING' OR w->>'executionScope'<>'REMOTE'
 OR w->>'requiresExplicitWorkerConfirmation'<>'true'
 OR w->>'capabilityAuthority'<>'NONE' OR w->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'REMOTE_WORKER_PROPOSAL_BAD_%',w; END IF;
 w:=private.taxonomy_worker_scoped_capability_preview_v1('STATIONARY','Izrada logotipa');
 IF w->>'action'<>'CLARIFY' OR w->>'reason'<>'SKILL_NOT_IN_WORKER_MODE'
 THEN RAISE EXCEPTION 'REMOTE_WORKER_SKILL_LEAKED_ONSITE_%',w; END IF;
 v:=private.taxonomy_existing_ai_scoped_preview_v1('STATIONARY',
     'Montaža nameštaja','Potrebna montaža nameštaja.',ARRAY[]::text[]);
 IF v->>'action'<>'CLARIFY' OR v->>'reason'<>'CHOOSE_SPECIFIC_SERVICE'
 THEN RAISE EXCEPTION 'FAMILY_USED_AS_LEAF_TASK_%',v; END IF;
 w:=private.taxonomy_worker_scoped_capability_preview_v1('STATIONARY','Montaža nameštaja');
 IF w->>'action'<>'CLARIFY' OR w->>'reason'<>'CONFIRM_SPECIFIC_WORK_TYPE'
 THEN RAISE EXCEPTION 'FAMILY_USED_AS_CONFIRMED_CAPABILITY_%',w; END IF;
 RAISE NOTICE 'AI_WORKER_TWO_SCOPE_EXACT_LEAF_AND_FAMILY_BLOCK_PASS';
END $proof$;

DO $proof$
DECLARE
 v jsonb;
 w jsonb;
BEGIN
 v:=private.taxonomy_existing_ai_scoped_preview_v1('REMOTE',
  'Dresiranje pasa','Želim online savet o dresuri psa.',ARRAY[]::text[]);
 IF v->>'action'<>'NOVEL_SERVICE_REVIEW'
 OR v->>'executionScope'<>'REMOTE'
 OR v->>'requiresModeBinding'<>'true'
 OR v->>'classificationAuthority'<>'NONE'
 OR v->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'NOVEL_REMOTE_JOB_NOT_FOR_REVIEW_%',v; END IF;
 v:=private.taxonomy_existing_ai_scoped_preview_v1('WRONG',
  'Dresiranje pasa','Dresura psa.',ARRAY[]::text[]);
 IF v->>'action'<>'CLARIFY' OR v->>'reason'<>'EXECUTION_MODE_REQUIRED'
 THEN RAISE EXCEPTION 'INVALID_MODE_AI_GRANTED_%',v; END IF;
 v:=private.taxonomy_existing_ai_scoped_preview_v1('REMOTE',
  'Dresiranje pasa','Dresura psa.',NULL);
 IF v->>'action'<>'CLARIFY' OR v->>'reason'<>'EXPLICIT_REQUIREMENTS_UNKNOWN'
 THEN RAISE EXCEPTION 'MISSING_SKILLS_UNKNOWN_NOT_CLOSED_%',v; END IF;
 w:=private.taxonomy_worker_scoped_capability_preview_v1('REMOTE','Dresiranje pasa');
 IF w->>'action'<>'PROPOSE_AUTO_PROVISIONAL'
 OR w->>'requiresExplicitWorkerConfirmation'<>'true'
 OR w->>'capabilityAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'NOVEL_WORKER_AUTO_CONFIRMED_%',w; END IF;
 w:=private.taxonomy_worker_scoped_capability_preview_v1('INVALID','Izrada logotipa');
 IF w->>'action'<>'CLARIFY' OR w->>'reason'<>'WORKER_MODE_REQUIRED'
 THEN RAISE EXCEPTION 'WORKER_INVALID_MODE_AUTO_CONFIRMED_%',w; END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 OR (SELECT count(*) FROM private.work_taxonomy_worker_capabilities)<>0
 OR (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>0
 OR has_function_privilege('anon',
 'private.taxonomy_worker_scoped_capability_preview_v1(text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
 'private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[])','EXECUTE')
 THEN RAISE EXCEPTION 'SCOPE_BRIDGE_ACCIDENTALLY_ACTIVATED'; END IF;
 RAISE NOTICE 'AI_WORKER_NOVEL_SCOPE_FAIL_CLOSED_PASS';
END $proof$;
