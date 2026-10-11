-- Disposable PG assertions: this is capability evaluation ONLY, not delivery.
DO $proof$
DECLARE
 cat_paint uuid; cat_move uuid; cat_clean uuid; cat_handyman uuid;
 cat_equiv uuid; cat_drone uuid;
 worker_paint uuid:=gen_random_uuid();
 worker_move uuid:=gen_random_uuid();
 worker_clean uuid:=gen_random_uuid();
 worker_handyman uuid:=gen_random_uuid();
 worker_equiv uuid:=gen_random_uuid();
 worker_drone uuid:=gen_random_uuid();
 need_paint uuid:=gen_random_uuid();
 need_ambiguous uuid:=gen_random_uuid();
 need_multi uuid:=gen_random_uuid();
 version_now bigint;
 got text;
BEGIN
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=true;
 SELECT (private.taxonomy_register_low_risk_v1('Krečenje zidova','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_paint;
 SELECT (private.taxonomy_register_low_risk_v1('Selidbe nameštaja','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_move;
 SELECT (private.taxonomy_register_low_risk_v1('Čišćenje stanova','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_clean;
 SELECT (private.taxonomy_register_low_risk_v1('Kućni majstor','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_handyman;
 SELECT (private.taxonomy_register_low_risk_v1('Soboslikarski poslovi','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_equiv;
 SELECT (private.taxonomy_register_low_risk_v1('Servis dronova','LOW_RISK_VERIFIED',true)->>'categoryId')::uuid INTO cat_drone;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=false;
 SELECT catalog_version INTO version_now FROM private.work_taxonomy_control;

 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
 VALUES (cat_paint,'sr','Farbanje zidova');
 IF (SELECT category_id FROM private.work_taxonomy_aliases
     WHERE locale='sr' AND normalized_key=private.taxonomy_normalize_v1('Фарбање зидова')) <> cat_paint THEN
  RAISE EXCEPTION 'CROSS_SCRIPT_ALIAS_FAILED';
 END IF;

 INSERT INTO public.needs(id) VALUES (need_paint),(need_ambiguous),(need_multi);
 INSERT INTO private.work_taxonomy_need_snapshots
  (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
 VALUES
  (need_paint,1,cat_paint,version_now,true,'AI_PROPOSED','CONFIRMED'),
  (need_ambiguous,1,NULL,version_now,false,'AI_PROPOSED','NEEDS_CLARIFICATION'),
  (need_multi,1,cat_paint,version_now,true,'REQUESTER_CORRECTED','CONFIRMED');
 INSERT INTO private.work_taxonomy_need_skills(need_id,need_revision,category_id)
 VALUES (need_multi,1,cat_paint),(need_multi,1,cat_drone);

 INSERT INTO private.work_taxonomy_worker_capabilities
 (worker_account_id,category_id,confirmed_at,origin,allow_related_offers)
 VALUES
 (worker_paint,cat_paint,now(),'WORKER_CONFIRMED',false),
 (worker_move,cat_move,now(),'WORKER_CONFIRMED',false),
 (worker_clean,cat_clean,now(),'WORKER_CONFIRMED',false),
 (worker_handyman,cat_handyman,now(),'WORKER_CONFIRMED',false),
 (worker_equiv,cat_equiv,now(),'WORKER_CONFIRMED',false),
 (worker_drone,cat_drone,now(),'WORKER_CONFIRMED',false);

 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_paint)<>'EXACT' THEN
  RAISE EXCEPTION 'DIRECT_MOLER_MISSING'; END IF;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_move)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'UNRELATED_MOVER_MATCHED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_clean)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'UNRELATED_CLEANER_MATCHED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'UNVERIFIED_HANDYMAN_MATCHED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_ambiguous,1,worker_paint)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'UNREVIEWED_TASK_MATCHED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_paint,1,NULL)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'NULL_WORKER_MATCHED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_multi,1,worker_paint)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'SOME_BUT_NOT_ALL_SKILLS_MATCHED'; END IF;

 INSERT INTO private.work_taxonomy_relations
 (source_id,target_id,relation,verification,evidence_ref,version)
 VALUES
 (cat_equiv,cat_paint,'EQUIVALENT_VERIFIED','VERIFIED','synthetic-curator-proof',version_now),
 (cat_handyman,cat_paint,'RELATED_SUGGESTED','PROPOSED',NULL,version_now);
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_equiv)<>'EQUIVALENT' THEN
  RAISE EXCEPTION 'VERIFIED_EQUIVALENT_MISSING'; END IF;
 INSERT INTO private.work_taxonomy_worker_capabilities
 (worker_account_id,category_id,confirmed_at,origin,excluded)
 VALUES (worker_equiv,cat_paint,now(),'WORKER_CONFIRMED',true);
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_equiv)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'EXPLICIT_TARGET_EXCLUSION_BYPASSED_BY_EQUIVALENT'; END IF;
 DELETE FROM private.work_taxonomy_worker_capabilities
 WHERE worker_account_id=worker_equiv AND category_id=cat_paint;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'AI_SUGGESTED_RELATION_BECAME_MATCH'; END IF;
 DELETE FROM private.work_taxonomy_relations
 WHERE source_id=cat_handyman AND target_id=cat_paint;
 INSERT INTO private.work_taxonomy_relations
 (source_id,target_id,relation,verification,evidence_ref,version)
 VALUES
 (cat_handyman,cat_paint,'CAPABILITY_CONFIRMED','VERIFIED','synthetic-scope-review',version_now);
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'RELATION_ALONE_BECAME_MATCH'; END IF;
 INSERT INTO private.work_taxonomy_related_acceptances
 (worker_account_id,source_category_id,target_category_id,explicitly_confirmed_at,relationship_version)
 VALUES (worker_handyman,cat_handyman,cat_paint,now(),version_now);
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'ACCEPTED_BUT_NOT_OPTED_IN'; END IF;
 UPDATE private.work_taxonomy_worker_capabilities SET allow_related_offers=true
 WHERE worker_account_id=worker_handyman AND category_id=cat_handyman;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'RELATED_CONFIRMED' THEN
  RAISE EXCEPTION 'EXPLICITLY_ACCEPTED_RELATED_MISSING'; END IF;
 UPDATE private.work_taxonomy_worker_capabilities SET excluded=true
 WHERE worker_account_id=worker_handyman AND category_id=cat_handyman;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_handyman)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'EXCLUDED_WORKER_MATCHED'; END IF;
 UPDATE private.work_taxonomy_worker_capabilities SET excluded=true
 WHERE worker_account_id=worker_paint AND category_id=cat_paint;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_paint)<>'NO_SAFE_MATCH' THEN
  RAISE EXCEPTION 'EXCLUDED_EXACT_WORKER_MATCHED'; END IF;

 -- Novel work is matched only if THIS worker later confirms that exact skill.
 INSERT INTO private.work_taxonomy_worker_capabilities
 (worker_account_id,category_id,confirmed_at,origin)
 VALUES (worker_drone,cat_paint,now(),'WORKER_CONFIRMED');
 IF private.taxonomy_capability_tier_v1(need_multi,1,worker_drone)<>'EXACT' THEN
  RAISE EXCEPTION 'TWO_EXPLICIT_CONFIRMED_SKILLS_FAILED'; END IF;
 RAISE NOTICE 'DISPOSABLE_CAPABILITY_TIERS_PASS';
END
$proof$;
