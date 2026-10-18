-- PASS reproduces the current dual-mode creation bug without any live data.
DO $$
DECLARE action text;projection jsonb;parent uuid;
BEGIN
 FOREACH action IN ARRAY ARRAY['CREATE_NEW_BRANCH','CREATE_CHILD'] LOOP
  PERFORM proof.reset();parent:=CASE action WHEN 'CREATE_CHILD' THEN proof.id(501) ELSE null END;
  projection:=proof.prepare(action,ARRAY['ON_SITE','REMOTE'],ARRAY['Izrada test minijatura','Izrada test figurica'],parent);
  IF action='CREATE_CHILD' THEN
   PERFORM proof.require(projection->>'status'='PENDING_CLASSIFICATION',
    'BEFORE_VALID_PARENT_UUID_REJECTED_BY_BROKEN_FOUR_GROUP_REGEX');
   CONTINUE;
  END IF;
  PERFORM proof.require(projection->>'status'='READY' AND jsonb_array_length(projection->'classificationCandidates')=2,
   'BEFORE_BOTH_NEW_ROOT_MODES_ARE_VALID_SIGNED_REVIEW_CANDIDATES');
  PERFORM proof.save();
  PERFORM proof.expect_error('select proof.commit_batch()','BATCH_SEMANTIC_OR_MODE_COLLISION');
  PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories)
   AND (SELECT count(*)=0 FROM private.work_taxonomy_review_batches_v1)
   AND (SELECT catalog_version=10 FROM private.work_taxonomy_control),'BEFORE_FAILURE_ROLLS_BACK_ENTIRE_NEW_BRANCH');
 END LOOP;
END $$;
SELECT 'DUAL_MODE_NEW_BRANCH_FAIL_BEFORE_REPRODUCED' AS result;
