BEGIN;
-- Actual captured projection -> signed synthetic Save -> batch -> actual binders.
DO $$
DECLARE action text;scope_order text[];projection jsonb;receipt jsonb;bound jsonb;leaf uuid;parent uuid;
 path text[]:=ARRAY['Digitalni zanati','Projektne discipline','Digitalna proizvodnja','Modeli i prototipi',
  'Modeli objekata','Mini modeli','Personalizovani modeli','3D štampa'];
BEGIN
 FOREACH action IN ARRAY ARRAY['CREATE_NEW_BRANCH','CREATE_CHILD'] LOOP
  FOREACH scope_order SLICE 1 IN ARRAY ARRAY[ARRAY['ON_SITE','REMOTE'],ARRAY['REMOTE','ON_SITE']] LOOP
   PERFORM proof.reset();parent:=CASE action WHEN 'CREATE_CHILD' THEN proof.id(501) ELSE null END;
   projection:=proof.prepare(action,scope_order,path,parent);
   PERFORM proof.require(projection->>'status'='READY','BOTH_SCOPES_VISIBLE_BEFORE_SAVE');
   PERFORM proof.expect_error('select proof.commit_batch()','BATCH_EXISTING_USER_SAVE_REQUIRED');
   PERFORM proof.save();receipt:=proof.commit_batch();leaf:=(receipt#>>'{items,0,categoryId}')::uuid;
   PERFORM proof.require(receipt->>'createdCount'='8' AND receipt->>'catalogVersion'='18'
    AND receipt#>>'{items,1,categoryId}'=leaf::text AND proof.commit_batch()=receipt,'EIGHT_NEW_NODES_ONE_LEAF_ID_AND_IDEMPOTENT_REPLAY');
   PERFORM proof.require((SELECT count(*)=9 FROM private.work_taxonomy_categories)
    AND (SELECT count(*)=18 FROM private.work_taxonomy_category_modes)
    AND (SELECT count(*)=0 FROM private.work_taxonomy_worker_capabilities),
    'ADMISSION_CREATES_ONLY_REVIEWED_TREE_AND_SCOPES_WITHOUT_WORKER_AUTHORITY');
   PERFORM proof.require((WITH RECURSIVE ancestry AS (
    SELECT id,parent_id,1 depth FROM private.work_taxonomy_categories WHERE id=leaf
    UNION ALL SELECT c.id,c.parent_id,a.depth+1 FROM private.work_taxonomy_categories c JOIN ancestry a ON c.id=a.parent_id
   ) SELECT max(depth)=CASE action WHEN 'CREATE_CHILD' THEN 9 ELSE 8 END FROM ancestry),
    'ALL_NEW_LEVELS_PRESERVE_THE_REQUESTED_PARENT_CHAIN');
   bound:=proof.bind_worker();
   PERFORM proof.require(bound->>'status'='BOUND_WORKER_SERVICES' AND bound->>'serviceModeCount'='2'
    AND bound->>'notificationAuthority'='NONE' AND bound->>'dispatchAuthority'='NONE'
    AND proof.bind_worker()=bound,'ACTUAL_WORKER_BINDER_PRESERVES_BOTH_OWNER_SIGNED_MODES');
   PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities WHERE category_id=leaf AND NOT excluded AND NOT allow_related_offers)
    AND (SELECT count(*)=2 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE category_id=leaf AND active)
    AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities),
    'ONLY_EXACT_LEAF_CAPABILITY_NO_PARENT_OR_RELATED_COMPETENCE');
   bound:=proof.bind_need(path[8],'ON_SITE',leaf,10);
   PERFORM proof.require(bound->>'status'='BOUND_NEED_REVISION' AND bound->>'categoryId'=leaf::text,'ACTUAL_ONSITE_NEED_BINDS_SAME_CREATED_LEAF');
   bound:=proof.bind_need(path[8],'REMOTE',leaf,11);
   PERFORM proof.require(bound->>'status'='BOUND_NEED_REVISION' AND bound->>'categoryId'=leaf::text,'ACTUAL_REMOTE_NEED_BINDS_SAME_CREATED_LEAF');
  END LOOP;
 END LOOP;
END $$;

-- A new batch must never use this exception to expand an older category.
DO $$
DECLARE projection jsonb;path text[]:=ARRAY['Izrada test minijatura','Izrada test figurica'];old_node uuid:=proof.id(701);
BEGIN
 PERFORM proof.reset();
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,parent_id,state,source,catalog_version)
 VALUES(old_node,private.taxonomy_normalize_v1(path[1]),path[1],proof.id(501),'ESTABLISHED','OPERATOR',10);
 INSERT INTO private.work_taxonomy_category_modes VALUES(old_node,'ON_SITE','SYNTHETIC',statement_timestamp());
 projection:=proof.prepare('CREATE_CHILD',ARRAY['ON_SITE','REMOTE'],path,proof.id(501));
 PERFORM proof.require(projection->>'status'='READY','NEGATIVE_OLD_INTERMEDIATE_REACHES_THE_WRITER');
 PERFORM proof.save();PERFORM proof.expect_error('select proof.commit_batch()','BATCH_SEMANTIC_OR_MODE_COLLISION');
 PERFORM proof.require((SELECT count(*)=2 FROM private.work_taxonomy_categories)
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes WHERE category_id=old_node AND execution_scope='REMOTE')
  AND (SELECT count(*)=0 FROM private.work_taxonomy_review_batches_v1),'OLD_CATALOG_MODE_NOT_EXPANDED_AND_PARTIAL_LEAF_ROLLED_BACK');

 PERFORM proof.reset();
 DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE';
 projection:=proof.prepare('CREATE_CHILD',ARRAY['ON_SITE','REMOTE'],path,proof.id(501));
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','WRONG_MODE_EXISTING_PARENT_STAYS_UNRESOLVED');

 PERFORM proof.reset();
 projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['ON_SITE'],ARRAY['Izrada test minijatura','Izrada test figurica']);
 PERFORM proof.save();PERFORM proof.commit_batch();PERFORM proof.bind_worker();
 PERFORM proof.require((SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)
  AND NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active AND execution_scope='REMOTE'),
  'ONE_REVIEWED_SCOPE_NEVER_ADDS_SECOND_SCOPE');

 PERFORM proof.reset();projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['ON_SITE','REMOTE'],path);
 PERFORM proof.save();UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{profile,skills}','["Unreviewed changed service"]');
 PERFORM proof.expect_error('select proof.commit_batch()','BATCH_REVIEW_NOT_BOUND');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories),'TAMPERED_REVIEW_CREATES_NOTHING');

 PERFORM proof.reset();projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['ON_SITE','REMOTE'],ARRAY['Digitalni zanati','Izrada test figurica']);
 PERFORM proof.require(projection->>'status'='READY','SAFE_STRUCTURAL_PARENT_IS_NOT_A_COMPETENCE');
 PERFORM proof.reset();projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['ON_SITE','REMOTE'],ARRAY['Izrada eksploziva']);
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','BLOCKED_CATEGORY_REMAINS_UNRESOLVED');
END $$;


-- Natural names do not need a fixed leading verb. Broad names still ask for meaning.
DO $$ DECLARE label text; BEGIN
 FOREACH label IN ARRAY ARRAY['3D štampa','Časovi engleskog','Šetnja pasa','Usluge prevođenja','Časovi muzike'] LOOP
  PERFORM proof.require(private.taxonomy_risk_triage_v1(label)='LOW_RISK_CANDIDATE','NATURAL_SERVICE_CANDIDATE: '||label);
 END LOOP;
 FOREACH label IN ARRAY ARRAY['','Elektronika','Sve usluge','Digitalni zanati','Bilo šta','12345 6789'] LOOP
  PERFORM proof.require(private.taxonomy_risk_triage_v1(label)='NEEDS_CLARIFICATION','VAGUE_LABEL_IS_NOT_A_LEAF: '||label);
 END LOOP;
 PERFORM proof.require(private.taxonomy_risk_triage_v1(null)='NEEDS_CLARIFICATION','NULL_CLARIFIES');
 FOREACH label IN ARRAY ARRAY['Izrada eksploziva','Eksploziv','Usluge oružja'] LOOP
  PERFORM proof.require(private.taxonomy_risk_triage_v1(label)='BLOCKED','ORIGINAL_BLOCKED_POLICY: '||label);
 END LOOP;
 PERFORM proof.require(private.taxonomy_risk_triage_v1('Električne instalacije')='REVIEW_REQUIRED','ORIGINAL_REGULATED_POLICY');
END $$;

-- No unsafe ancestor, broad leaf, wrong owner, stale candidate or coerced JSON node.
DO $$ DECLARE path text[];projection jsonb; BEGIN
 FOREACH path SLICE 1 IN ARRAY ARRAY[
  ARRAY['Usluge oružja','3D štampa'],ARRAY['Električne instalacije','3D štampa'],
  ARRAY['Digitalni zanati','Elektronika'],ARRAY['Digitalni zanati','Digitalne usluge']
 ] LOOP
  PERFORM proof.reset();projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],path);
  PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','UNSAFE_OR_UNCLEAR_PLAN_STAYS_PENDING');
 END LOOP;
 PERFORM proof.reset();PERFORM proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],ARRAY['Digitalni zanati','3D štampa']);
 PERFORM proof.expect_error($q$SELECT private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY','["3D štampa"]','[{"service":"3D štampa","mode":"REMOTE"}]',proof.id(99),proof.id(2))$q$,'TAXONOMY_REVIEW_OWNER_MISMATCH');
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=jsonb_set(proposals,'{0,proposedPath,0}','null');
 projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY','["3D štampa"]','[{"service":"3D štampa","mode":"REMOTE"}]',proof.id(1),proof.id(2));
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','JSON_NULL_INTERMEDIATE_REFUSED');
 UPDATE private.worker_ai_sessions SET revision=revision+1;
 projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY','["3D štampa"]','[{"service":"3D štampa","mode":"REMOTE"}]',proof.id(1),proof.id(2));
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','STALE_HINT_SOURCE_REFUSED');
 PERFORM proof.reset();PERFORM proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],ARRAY['Digitalni zanati','3D štampa','Digitalni zanati','3D štampa']);
 PERFORM proof.save();PERFORM proof.expect_error('SELECT proof.commit_batch()','BATCH_SEMANTIC_OR_MODE_COLLISION');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories),'REPEATED_PATH_ROLLS_BACK_WITHOUT_CYCLE');
END $$;

-- PostSave revalidates the same signed plan; unrelated catalog work is not lost consent.
DO $$ DECLARE envelope_before jsonb;receipt jsonb;bound jsonb;leaf uuid; BEGIN
 PERFORM proof.reset();PERFORM proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Digitalni zanati','3D štampa'],proof.id(501));
 PERFORM proof.save();SELECT envelope INTO envelope_before FROM private.worker_ai_reviews WHERE id=proof.id(4);
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES(proof.id(701),private.taxonomy_normalize_v1('Časovi engleskog'),'Časovi engleskog','ESTABLISHED','SYSTEM',11);
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES(proof.id(701),'ON_SITE','UNRELATED');
 UPDATE private.work_taxonomy_control SET catalog_version=11;
 receipt:=proof.commit_batch();leaf:=(receipt#>>'{items,0,categoryId}')::uuid;bound:=proof.bind_worker();
 PERFORM proof.require(receipt->>'createdCount'='2' AND receipt->>'catalogVersion'='13' AND bound->>'status'='BOUND_WORKER_SERVICES','UNRELATED_CATALOG_CHANGE_REVALIDATES_AND_BINDS');
 PERFORM proof.require((SELECT envelope=envelope_before FROM private.worker_ai_reviews WHERE id=proof.id(4))
  AND (SELECT plans#>>'{0,catalogVersion}'='10' FROM private.work_taxonomy_review_batches_v1)
  AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities WHERE category_id=leaf),'SIGNED_REVIEW_PLAN_VERSION_AND_EXACT_LEAF_REMAIN_UNCHANGED');
 PERFORM proof.require(proof.commit_batch()=receipt,'POSTSAVE_REVALIDATION_REPLAY_IS_EXACT');
END $$;

DO $$ DECLARE projection jsonb; BEGIN
 PERFORM proof.reset();PERFORM proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Digitalni zanati','3D štampa'],proof.id(501));PERFORM proof.save();
 UPDATE private.work_taxonomy_categories SET label='Izrada drugih modela',canonical_key=private.taxonomy_normalize_v1('Izrada drugih modela') WHERE id=proof.id(501);
 PERFORM proof.expect_conflict('SELECT proof.commit_batch()','BATCH_PARENT_IDENTITY_CHANGED');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories),'RENAMED_PARENT_ADMITS_NOTHING');

 PERFORM proof.reset();PERFORM proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Digitalni zanati','3D štampa'],proof.id(501));PERFORM proof.save();
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES(proof.id(501),'sr','3D štampa');
 PERFORM proof.expect_conflict('SELECT proof.commit_batch()','BATCH_ALIAS_OR_KEY_COLLISION');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories) AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_review_batches_v1),'ALIAS_CONFLICT_ROLLS_BACK_EARLIER_PATH_WRITES');

 PERFORM proof.reset();projection:=proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Izrada osnovnih modela'],proof.id(501));PERFORM proof.save();
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES(proof.id(701),private.taxonomy_normalize_v1('Časovi engleskog'),'Časovi engleskog','ESTABLISHED','SYSTEM',11);
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES(proof.id(701),'sr','Izrada osnovnih modela');
 UPDATE private.work_taxonomy_control SET catalog_version=11;
 PERFORM proof.expect_conflict('SELECT proof.commit_batch()','BATCH_SEMANTIC_IDENTITY_MISMATCH');
 DELETE FROM private.work_taxonomy_aliases WHERE category_id=proof.id(701);
 PERFORM proof.require(proof.commit_batch()->>'createdCount'='0','UNCHANGED_EXISTING_ID_REVALIDATES_AFTER_UNRELATED_WRITE');
END $$;

-- Legacy prepare/approve/commit also accepts a deep path without bypassing Save.
DO $$ DECLARE projection jsonb;plan jsonb;prepared jsonb;admission uuid;review_digest text;receipt jsonb; BEGIN
 PERFORM proof.reset();projection:=proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],
 ARRAY['Digitalni zanati','Projektne discipline','Digitalna proizvodnja','Modeli i prototipi',
  'Modeli objekata','Mini modeli','Personalizovani modeli','3D štampa'],proof.id(501));
 plan:=projection#>'{classificationCandidates,0}';
 review_digest:=private.disposable_bind_classification_review('WORKER_CAPABILITY',proof.id(4),plan);
 prepared:=public.rpc_taxonomy_prepare_admission_service(proof.id(1),proof.id(5),'WORKER_CAPABILITY',proof.id(4),plan);
 admission:=(prepared->>'admissionId')::uuid;
 PERFORM proof.expect_error(format('SELECT public.rpc_taxonomy_approve_admission(%L,%L,%L)',admission,prepared->>'planDigest',review_digest),'ADMISSION_REVIEW_SAVE_REQUIRED');
 PERFORM proof.expect_error(format('SELECT public.rpc_taxonomy_commit_admission_service(%L)',admission),'ADMISSION_OWNER_APPROVAL_REQUIRED');
 PERFORM proof.save();PERFORM public.rpc_taxonomy_approve_admission(admission,prepared->>'planDigest',review_digest);
 receipt:=public.rpc_taxonomy_commit_admission_service(admission);
 PERFORM proof.require(receipt->>'createdCount'='8' AND receipt->>'requiresPostSaveBinding'='true'
  AND receipt->>'capabilityAuthority'='NONE' AND public.rpc_taxonomy_commit_admission_service(admission)=receipt,
  'LEGACY_DEEP_ADMISSION_STILL_REQUIRES_SAVE_AND_BINDING');
END $$;

-- Late hints cannot be attached to newer completed state; fresh exact receipts
-- and their replay remain valid. The capture writes hints only, never consent.
DO $$ BEGIN
 PERFORM proof.reset();PERFORM proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],ARRAY['Izrada test figurica']);
 DELETE FROM private.work_taxonomy_gemini_turn_hints_v1;
 UPDATE private.worker_ai_sessions SET revision=2;
 PERFORM proof.expect_error($q$SELECT proof.capture('WORKER_CAPABILITY')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 PERFORM proof.require(NOT EXISTS(SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1),'STALE_WORKER_TURN_WRITES_NO_HINT');
 UPDATE private.worker_ai_turns SET source_revision=1;
 PERFORM proof.require(proof.capture('WORKER_CAPABILITY')->>'action'='HINT_CAPTURED','EXACT_CURRENT_WORKER_COMPLETION_ACCEPTED');
 PERFORM proof.require(proof.capture('WORKER_CAPABILITY')->>'action'='HINT_CAPTURED','CURRENT_WORKER_CAPTURE_REPLAY');
 UPDATE private.worker_ai_turns SET cancelled_at=clock_timestamp();
 PERFORM proof.expect_error($q$SELECT proof.capture('WORKER_CAPABILITY')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 PERFORM proof.reset();PERFORM proof.seed_need_completion();
 INSERT INTO public.ai_messages VALUES(proof.id(46),proof.id(2),proof.id(1),'ASSISTANT',2);
 PERFORM proof.expect_error($q$SELECT proof.capture('NEED_SERVICE')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 DELETE FROM public.ai_messages WHERE id=proof.id(46);
 INSERT INTO private.ai_need_turn_commands VALUES(proof.id(1),proof.id(2),proof.id(51),proof.id(52),proof.id(53),
  'SUCCEEDED',null,'{}',clock_timestamp()+interval '1 second');
 PERFORM proof.expect_error($q$SELECT proof.capture('NEED_SERVICE')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 UPDATE private.ai_need_turn_commands SET state='PROCESSING' WHERE client_request_id=proof.id(51);
 PERFORM proof.expect_error($q$SELECT proof.capture('NEED_SERVICE')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 DELETE FROM private.ai_need_turn_commands WHERE client_request_id=proof.id(51);
 UPDATE public.ai_messages SET account_id=proof.id(99);
 PERFORM proof.expect_error($q$SELECT proof.capture('NEED_SERVICE')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 UPDATE public.ai_messages SET account_id=proof.id(1);
 PERFORM proof.require(proof.capture('NEED_SERVICE')->>'action'='HINT_CAPTURED','EXACT_CURRENT_NEED_RECEIPT_ACCEPTED');
 PERFORM proof.require(proof.capture('NEED_SERVICE')->>'action'='HINT_CAPTURED','CURRENT_NEED_CAPTURE_REPLAY');
 UPDATE private.ai_need_turn_commands SET cancelled_at=clock_timestamp();
 PERFORM proof.expect_error($q$SELECT proof.capture('NEED_SERVICE')$q$,'TAXONOMY_CAPTURE_TURN_UNCONFIRMED');
 PERFORM proof.require(NOT EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
  AND NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1),'CAPTURE_HAS_NO_COMPETENCE_OR_CONSENT_AUTHORITY');
END $$;

SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.function_before b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.proowner<>b.proowner OR p.proacl IS DISTINCT FROM b.proacl OR p.proconfig IS DISTINCT FROM b.proconfig
 OR p.prosecdef<>b.prosecdef),'FUNCTION_OWNER_ACL_SEARCH_PATH_SECURITY_UNCHANGED');
SELECT proof.require((SELECT jsonb_agg(to_jsonb(r) ORDER BY pattern) FROM private.work_taxonomy_risk_rules r)
 IS NOT DISTINCT FROM (SELECT jsonb_agg(to_jsonb(r) ORDER BY pattern) FROM proof.risk_rules_before r),'ORIGINAL_SAFETY_RULES_UNMODIFIED');
ROLLBACK;
SELECT 'NATURAL_BRANCH_CAPTURE_REVIEW_SAVE_COMMIT_BINDING_AND_REVALIDATION_PASS' result;
