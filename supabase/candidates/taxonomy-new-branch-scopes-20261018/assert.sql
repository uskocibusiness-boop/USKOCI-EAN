-- Actual captured projection -> signed synthetic Save -> batch -> actual binders.
DO $$
DECLARE action text;scope_order text[];projection jsonb;receipt jsonb;bound jsonb;leaf uuid;parent uuid;
 path text[]:=ARRAY['Izrada test minijatura','Izrada test prototipa','Izrada test dodataka',
  'Izrada test ukrasa','Izrada test maketa','Izrada test figurica'];
BEGIN
 FOREACH action IN ARRAY ARRAY['CREATE_NEW_BRANCH','CREATE_CHILD'] LOOP
  FOREACH scope_order SLICE 1 IN ARRAY ARRAY[ARRAY['ON_SITE','REMOTE'],ARRAY['REMOTE','ON_SITE']] LOOP
   PERFORM proof.reset();parent:=CASE action WHEN 'CREATE_CHILD' THEN proof.id(501) ELSE null END;
   projection:=proof.prepare(action,scope_order,path,parent);
   PERFORM proof.require(projection->>'status'='READY','BOTH_SCOPES_VISIBLE_BEFORE_SAVE');
   PERFORM proof.expect_error('select proof.commit_batch()','BATCH_EXISTING_USER_SAVE_REQUIRED');
   PERFORM proof.save();receipt:=proof.commit_batch();leaf:=(receipt#>>'{items,0,categoryId}')::uuid;
   PERFORM proof.require(receipt->>'createdCount'='6' AND receipt->>'catalogVersion'='16'
    AND receipt#>>'{items,1,categoryId}'=leaf::text AND proof.commit_batch()=receipt,'SIX_NEW_NODES_ONE_LEAF_ID_AND_IDEMPOTENT_REPLAY');
   PERFORM proof.require((SELECT count(*)=7 FROM private.work_taxonomy_categories)
    AND (SELECT count(*)=14 FROM private.work_taxonomy_category_modes)
    AND (SELECT count(*)=0 FROM private.work_taxonomy_worker_capabilities),
    'ADMISSION_CREATES_ONLY_REVIEWED_TREE_AND_SCOPES_WITHOUT_WORKER_AUTHORITY');
   PERFORM proof.require((WITH RECURSIVE ancestry AS (
    SELECT id,parent_id,1 depth FROM private.work_taxonomy_categories WHERE id=leaf
    UNION ALL SELECT c.id,c.parent_id,a.depth+1 FROM private.work_taxonomy_categories c JOIN ancestry a ON c.id=a.parent_id
   ) SELECT max(depth)=CASE action WHEN 'CREATE_CHILD' THEN 7 ELSE 6 END FROM ancestry),
    'ALL_NEW_LEVELS_PRESERVE_THE_REQUESTED_PARENT_CHAIN');
   bound:=proof.bind_worker();
   PERFORM proof.require(bound->>'status'='BOUND_WORKER_SERVICES' AND bound->>'serviceModeCount'='2'
    AND bound->>'notificationAuthority'='NONE' AND bound->>'dispatchAuthority'='NONE'
    AND proof.bind_worker()=bound,'ACTUAL_WORKER_BINDER_PRESERVES_BOTH_OWNER_SIGNED_MODES');
   PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities WHERE category_id=leaf AND NOT excluded AND NOT allow_related_offers)
    AND (SELECT count(*)=2 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE category_id=leaf AND active)
    AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities),
    'ONLY_EXACT_LEAF_CAPABILITY_NO_PARENT_OR_RELATED_COMPETENCE');
   bound:=proof.bind_need(path[6],'ON_SITE',leaf,10);
   PERFORM proof.require(bound->>'status'='BOUND_NEED_REVISION' AND bound->>'categoryId'=leaf::text,'ACTUAL_ONSITE_NEED_BINDS_SAME_CREATED_LEAF');
   bound:=proof.bind_need(path[6],'REMOTE',leaf,11);
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
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','STRUCTURAL_LABEL_POLICY_REMAINS_CONSERVATIVE');
 PERFORM proof.reset();projection:=proof.prepare('CREATE_NEW_BRANCH',ARRAY['ON_SITE','REMOTE'],ARRAY['Izrada eksploziva']);
 PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION','BLOCKED_CATEGORY_REMAINS_UNRESOLVED');
END $$;
SELECT 'NEW_BRANCH_SCOPE_AND_REAL_BINDERS_PASS' AS result;
