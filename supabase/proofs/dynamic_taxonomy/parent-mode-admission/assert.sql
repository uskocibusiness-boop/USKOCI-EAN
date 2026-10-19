BEGIN;
-- The new helpers are private; the public RPC continues to require service_role.
SELECT proof.require(NOT has_function_privilege('anon','private.taxonomy_handoff_valid_v1(jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.taxonomy_handoff_valid_v1(jsonb)','EXECUTE')
 AND NOT has_function_privilege('service_role','private.taxonomy_handoff_valid_v1(jsonb)','EXECUTE'),'HANDOFF_HELPER_PRIVATE');
DO $$ DECLARE v_handoff jsonb; BEGIN
 FOR v_handoff IN SELECT item.value FROM jsonb_array_elements('[{"required":false},{"required":true,"shippingCountries":["RS","BA"]},{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}},{"required":true,"shippingCountries":["RS"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}]'::jsonb) item(value) LOOP
  PERFORM proof.require(private.taxonomy_handoff_valid_v1(v_handoff),'VALID_HANDOFF');
 END LOOP;
 FOR v_handoff IN SELECT item.value FROM jsonb_array_elements('[null,[],{},{"required":null},{"required":false,"shippingCountries":["RS"]},{"required":true},{"required":true,"shippingCountries":[]},{"required":true,"shippingCountries":["RS","RS"]},{"required":true,"shippingCountries":["rs"]},{"required":true,"shippingCountries":[42]},{"required":true,"localExchange":null},{"required":true,"localExchange":{"countryCode":"RS","city":" Novi Sad"}},{"required":true,"localExchange":{"countryCode":"RS","city":"Ulica 23"}},{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad","address":"hidden"}},{"required":true,"shippingCountries":["RS"],"extra":true}]'::jsonb) item(value) LOOP
  PERFORM proof.require(NOT private.taxonomy_handoff_valid_v1(v_handoff),'MALFORMED_HANDOFF_REFUSED');
 END LOOP;
END $$;

DO $$ BEGIN
 PERFORM proof.require(NOT private.taxonomy_handoff_valid_v1(jsonb_build_object('required',true,'localExchange',
  jsonb_build_object('countryCode','RS','city',chr(160)||'Novi Sad'))),'UNICODE_EDGE_SPACE_REFUSED');
 PERFORM proof.require(NOT private.taxonomy_handoff_valid_v1(jsonb_build_object('required',true,'localExchange',
  jsonb_build_object('countryCode','RS','city','Novi'||chr(133)||'Sad'))),'C1_CONTROL_REFUSED');
END $$;

-- A REMOTE workshop service under an ON_SITE-only parent: no ancestor writes,
-- no artificial root, and no capability until the real binder executes.
DO $$
DECLARE p jsonb;r jsonb;b jsonb;leaf uuid;
 handoff jsonb:='{"required":true,"shippingCountries":["RS","BA"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}';
BEGIN
 PERFORM proof.reset();
 DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE';
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','CREATE_CHILD',proof.id(501),handoff,true);
 PERFORM proof.require(p->>'status'='READY' AND p#>'{classificationCandidates,0,handoff}'=handoff,'NEW_REMOTE_LEAF_HAS_EXACT_HANDOFF_IN_SIGNED_PLAN');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories)
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities),'CHAT_AND_REVIEW_DO_NOT_WRITE_CATALOG_OR_COMPETENCE');
 PERFORM proof.expect_error('SELECT proof.commit_batch()','BATCH_EXISTING_USER_SAVE_REQUIRED');
 PERFORM proof.save();r:=proof.commit_batch();leaf:=(r#>>'{items,0,categoryId}')::uuid;
 PERFORM proof.require(r->>'createdCount'='1' AND (SELECT parent_id=proof.id(501) FROM private.work_taxonomy_categories WHERE id=leaf),'ONE_CHILD_UNDER_ORIGINAL_UUID');
 PERFORM proof.require(NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE')
  AND (SELECT plans#>'{0,handoff}'=handoff FROM private.work_taxonomy_review_batches_v1),'PARENT_MODE_UNCHANGED_HANDOFF_UNMODIFIED');
 PERFORM proof.require(private.taxonomy_ai_catalog_context_v1('REMOTE',100,null)->>'action'='CATALOG_CONTEXT','OLD_READER_DIRECT_REMOTE_WITH_OTHER_MODE_ANCESTOR');
 PERFORM proof.require(public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','EXACT','text','Restauracija muzičkih kutija'))->>'count'='1','NEW_READER_GLOBAL_EXACT');
 PERFORM proof.require(public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','CHILDREN','scope','REMOTE','categoryId',proof.id(501)))->>'count'='1','OTHER_MODE_ANCHOR_CAN_NAVIGATE_DIRECT_REMOTE_CHILD');
 PERFORM proof.require(public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','EXACT','text','Restauracija muzičkih kutija'))#>'{items,0,modes}'='["REMOTE"]'::jsonb,'LEAF_MODES_ARE_DIRECT_NOT_INHERITED');
 b:=proof.bind_worker();
 PERFORM proof.require(b->>'serviceModeCount'='1' AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active AND execution_scope='REMOTE'),'ONLY_SIGNED_LEAF_MODE_BOUND');
 b:=proof.bind_need('Restauracija muzičkih kutija','REMOTE',leaf);
 PERFORM proof.require(b->>'status'='BOUND_NEED_REVISION' AND private.taxonomy_scope_eligible_v1(proof.id(110),proof.id(1)),'EXACT_REMOTE_NEED_AND_WORKER_MATCH_GATE');
 PERFORM proof.require(proof.commit_batch()=r AND proof.bind_worker()->>'status'='BOUND_WORKER_SERVICES','REPLAY_RETAINS_RECEIPTS');
END $$;

-- Existing intermediate nodes may organize a new service without gaining a mode.
DO $$ DECLARE p jsonb;r jsonb;leaf uuid; BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service('Izrada test minijatura');
 p:=proof.prepare('CREATE_CHILD',ARRAY['ON_SITE','REMOTE'],
  ARRAY['Izrada test minijatura','Izrada test figurica'],proof.id(501));
 PERFORM proof.require(p->>'status'='READY','MIXED_MODE_PATH_REVIEW_READY');
 PERFORM proof.save();r:=proof.commit_batch();leaf:=(r#>>'{items,0,categoryId}')::uuid;
 PERFORM proof.require(r->>'createdCount'='1' AND r#>>'{items,1,categoryId}'=leaf::text
  AND (SELECT count(*)=2 FROM private.work_taxonomy_category_modes WHERE category_id=leaf)
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes WHERE category_id IN(proof.id(501),proof.id(601)) AND execution_scope='REMOTE'),
  'BOTH_EXPLICIT_LEAF_MODES_SAME_UUID_NO_ANCESTOR_MODE_PROPAGATION');
 PERFORM proof.bind_worker();
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities)
  AND (SELECT count(*)=2 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active),'NO_ANCESTOR_OR_RELATED_CAPABILITY');
END $$;

-- EXTEND_MODE retains category identity, requires Save, changes no old worker
-- scopes, and remains insufficient without exact per-worker mode consent.
DO $$ DECLARE p jsonb;r jsonb;fp text;old_modes jsonb; BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service();
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,created_at,receipt)
 VALUES(proof.id(91),proof.id(9),proof.id(92),clock_timestamp(),'{}');
 INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin)
 VALUES(proof.id(9),proof.id(601),clock_timestamp(),'WORKER_CONFIRMED');
 INSERT INTO private.worker_execution_mode_choices VALUES(proof.id(93),proof.id(9),ARRAY['ON_SITE','REMOTE'],'SYNTHETIC',clock_timestamp(),clock_timestamp());
 INSERT INTO private.taxonomy_confirmed_worker_modes_v1 VALUES(proof.id(9),proof.id(601),'ON_SITE',proof.id(91),proof.id(92),clock_timestamp(),true);
 SELECT jsonb_agg(to_jsonb(m)) INTO old_modes FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE worker_account_id=proof.id(9);
 fp:=private.taxonomy_admission_fingerprint_v1();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601),'{"required":true,"shippingCountries":["RS"]}',true);
 PERFORM proof.require(p->>'status'='READY' AND p#>>'{classificationCandidates,0,action}'='EXTEND_MODE'
  AND p#>>'{classificationCandidates,0,categoryId}'=proof.id(601)::text
  AND p#>>'{classificationCandidates,0,categoryParentId}'=proof.id(501)::text,'EXTENSION_SIGNED_WITH_SERVER_IDENTITY_WITNESS');
 PERFORM proof.require((SELECT count(*)=2 FROM private.work_taxonomy_category_modes),'NO_MODE_ADDED_BY_CHAT_OR_REVIEW');
 PERFORM proof.expect_error('SELECT proof.commit_batch()','BATCH_EXISTING_USER_SAVE_REQUIRED');
 PERFORM proof.save();r:=proof.commit_batch();
 PERFORM proof.require(r->>'createdCount'='0' AND r#>>'{items,0,categoryId}'=proof.id(601)::text
  AND r->>'catalogVersion'='11' AND fp<>private.taxonomy_admission_fingerprint_v1()
  AND (SELECT count(*)=2 FROM private.work_taxonomy_categories)
  AND (SELECT count(*)=2 FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(601))
  AND (SELECT count(*)=1 FROM private.work_taxonomy_audit WHERE action='CORRECTED'),'SAME_UUID_ONE_DIRECT_MODE_ADDED_WITH_VERSION_AND_AUDIT');
 PERFORM proof.require(old_modes=(SELECT jsonb_agg(to_jsonb(m)) FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE worker_account_id=proof.id(9))
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE'),'OLD_WORKER_AND_PARENT_MODES_UNCHANGED');
 PERFORM proof.bind_worker();PERFORM proof.bind_need('Restauracija muzičkih kutija','REMOTE',proof.id(601));
 PERFORM proof.require(private.taxonomy_scope_eligible_v1(proof.id(110),proof.id(1))
  AND NOT private.taxonomy_scope_eligible_v1(proof.id(110),proof.id(9)),'GLOBAL_CHOICES_DO_NOT_GRANT_OLD_WORKER_NEW_SERVICE_MODE');
 UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE worker_account_id=proof.id(1);
 PERFORM proof.require(NOT private.taxonomy_scope_eligible_v1(proof.id(110),proof.id(1)),'REVOKED_SERVICE_MODE_STILL_BLOCKS');
 PERFORM proof.require(proof.commit_batch()=r,'EXTENSION_REPLAY_DOES_NOT_ADD_MODE_OR_AUDIT_AGAIN');
END $$;

-- Canonical and stored aliases keep exact handoff data; legacy absence stays absent.
DO $$ DECLARE p jsonb;handoff jsonb;service text; BEGIN
 FOREACH service IN ARRAY ARRAY['Restauracija muzičkih kutija','Popravka muzičkih kutija'] LOOP
  PERFORM proof.reset();PERFORM proof.seed_service();
  INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES(proof.id(601),'sr','Popravka muzičkih kutija');
  p:=proof.prepare_mode(service,'REMOTE','EXTEND_MODE',proof.id(601),'{"required":false}',true);
  PERFORM proof.require(p->>'status'='READY' AND p#>'{classificationCandidates,0,handoff}'='{"required":false}'::jsonb,'ALIAS_EXTEND_RETAINS_EXACT_FALSE_NOT_UNKNOWN');
  PERFORM proof.save();PERFORM proof.commit_batch();PERFORM proof.bind_worker();
  PERFORM proof.reset();PERFORM proof.seed_service();
  INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES(proof.id(601),'sr','Popravka muzičkih kutija');
  INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES(proof.id(601),'REMOTE','SYNTHETIC');
  handoff:='{"required":true,"shippingCountries":["BA","RS"]}';
  p:=proof.prepare_mode(service,'REMOTE','REUSE_EXISTING',proof.id(601),handoff,true);
  PERFORM proof.require(p->>'status'='READY' AND p#>>'{classificationCandidates,0,action}'='REUSE_EXISTING'
   AND p#>'{classificationCandidates,0,handoff}'=handoff,'EXACT_READY_SHORTCUT_DOES_NOT_DROP_HANDOFF');
  PERFORM proof.save();PERFORM proof.commit_batch();
  PERFORM proof.require((SELECT plans#>'{0,handoff}'=handoff FROM private.work_taxonomy_review_batches_v1),'SIGNED_BATCH_PRESERVES_COUNTRY_ORDER');
 END LOOP;
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','ON_SITE','REUSE_EXISTING',proof.id(601));
 PERFORM proof.require(p->>'status'='READY' AND NOT(p#>'{classificationCandidates,0}'?'handoff'),'LEGACY_MISSING_HANDOFF_IS_NOT_FALSE_OR_SHIPPING');
 PERFORM proof.reset();PERFORM proof.seed_service();
 PERFORM proof.expect_error($q$SELECT proof.prepare_mode('Restauracija muzičkih kutija','ON_SITE','REUSE_EXISTING',proof.id(601),'{"required":false}',true)$q$,'TAXONOMY_CAPTURE_PLAN_INVALID');
 PERFORM proof.reset();PERFORM proof.seed_service();
 PERFORM proof.expect_error($q$SELECT proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601),'null',true)$q$,'TAXONOMY_CAPTURE_PLAN_INVALID');
END $$;

-- Identity/safety/source checks are not relaxed by the new mode action.
DO $$ DECLARE p jsonb;label text; BEGIN
 FOREACH label IN ARRAY ARRAY['Izrada eksploziva','Električne instalacije','Elektronika'] LOOP
  PERFORM proof.reset();PERFORM proof.seed_service(label);
  p:=proof.prepare_mode(label,'REMOTE','EXTEND_MODE',proof.id(601));
  PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','BLOCKED_REGULATED_OR_BROAD_MODE_EXTENSION_NOT_READY');
 END LOOP;
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','REUSE_EXISTING',proof.id(601));
 PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','REUSE_CANNOT_SILENTLY_EXTEND_MODE');
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Druga precizna usluga','REMOTE','EXTEND_MODE',proof.id(601));
 PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','UNREGISTERED_IDENTITY_CANNOT_EXTEND');
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(501));
 PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','WRONG_REAL_CATEGORY_CANNOT_EXTEND');
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601));
 UPDATE private.worker_ai_sessions SET revision=revision+1;
 p:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY','["Restauracija muzičkih kutija"]',
  '[{"service":"Restauracija muzičkih kutija","mode":"REMOTE"}]',proof.id(1),proof.id(2));
 PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','STALE_SOURCE_CANNOT_EXTEND');
 PERFORM proof.expect_error($q$SELECT private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY','["Restauracija muzičkih kutija"]','[{"service":"Restauracija muzičkih kutija","mode":"REMOTE"}]',proof.id(99),proof.id(2))$q$,'TAXONOMY_REVIEW_OWNER_MISMATCH');
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601));
 PERFORM proof.save();
 UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{classificationCandidates,0,reason}','"Tampered handoff after signing."');
 PERFORM proof.expect_error('SELECT proof.commit_batch()','BATCH_REVIEW_NOT_BOUND');
 PERFORM proof.require((SELECT count(*)=2 FROM private.work_taxonomy_category_modes),'TAMPERED_SIGNED_REVIEW_WRITES_NO_MODE');
END $$;

-- Saved outbox revalidation: unrelated changes and the exact concurrent addition
-- can recover; changed identity, alias collision or ancestry cannot be accepted.
DO $$ DECLARE p jsonb;r jsonb;scenario text; BEGIN
 FOREACH scenario IN ARRAY ARRAY['unrelated','concurrent','rename','reparent','alias_collision','cycle'] LOOP
  PERFORM proof.reset();PERFORM proof.seed_service();
  p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601));
  PERFORM proof.save();
  INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
   VALUES(proof.id(701),'izrada drugog modela','Izrada drugog modela','ESTABLISHED','OPERATOR',11);
  INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES(proof.id(701),'ON_SITE','SYNTHETIC');
  UPDATE private.work_taxonomy_control SET catalog_version=11;
  IF scenario='concurrent' THEN
   INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES(proof.id(601),'REMOTE','OTHER_SIGNED_SAVE');
  ELSIF scenario='rename' THEN
   UPDATE private.work_taxonomy_categories
    SET label='Promenjeno značenje',canonical_key=private.taxonomy_normalize_v1('Promenjeno značenje')
    WHERE id=proof.id(601);
   -- Keep the original service as a registered alias of the SAME UUID. Identity
   -- lookup can still succeed; the signed categoryLabel witness must reject it.
   INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
    VALUES(proof.id(601),'sr','Restauracija muzičkih kutija');
  ELSIF scenario='reparent' THEN UPDATE private.work_taxonomy_categories SET parent_id=proof.id(701) WHERE id=proof.id(601);
  ELSIF scenario='alias_collision' THEN INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES(proof.id(701),'sr','Restauracija muzičkih kutija');
  ELSIF scenario='cycle' THEN UPDATE private.work_taxonomy_categories SET parent_id=proof.id(601) WHERE id=proof.id(501);
  END IF;
  IF scenario IN('unrelated','concurrent') THEN
   r:=proof.commit_batch();
   PERFORM proof.require(r->>'status'='COMMITTED' AND r#>>'{items,0,categoryId}'=proof.id(601)::text,'SAVED_EXACT_EXTENSION_REVALIDATES_AFTER_UNRELATED_CHANGE');
  ELSIF scenario='alias_collision' THEN
   PERFORM proof.reject('SELECT proof.commit_batch()','BATCH_SEMANTIC_IDENTITY_MISMATCH','PT409');
  ELSE PERFORM proof.reject('SELECT proof.commit_batch()','BATCH_EXTENSION_IDENTITY_CHANGED','PT409');
  END IF;
 END LOOP;
END $$;

-- Cycle and missing/retired ancestry are still integrity failures, not just
-- absent search hits. Old and new readers must never invent a valid path.
DO $$ DECLARE p jsonb; BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service();
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES(proof.id(601),'REMOTE','SYNTHETIC');
 UPDATE private.work_taxonomy_categories SET parent_id=proof.id(601) WHERE id=proof.id(501);
 PERFORM proof.require(NOT private.taxonomy_category_path_valid_v1(proof.id(601)),'CYCLE_FAILS_PATH_VALIDATION');
 PERFORM proof.reject($q$SELECT public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"Restauracija muzičkih kutija"}')$q$,'TAXONOMY_QUERY_PARENT_OR_MODE_INTEGRITY','55000');
 PERFORM proof.require(private.taxonomy_ai_catalog_context_v1('REMOTE',100,null)->>'action'='CLARIFY','OLD_READER_STILL_REJECTS_CYCLE');
 PERFORM proof.reset();PERFORM proof.seed_service();
 UPDATE private.work_taxonomy_categories SET state='RETIRED' WHERE id=proof.id(501);
 PERFORM proof.require(NOT private.taxonomy_category_path_valid_v1(proof.id(601)),'RETIRED_ANCESTOR_NOT_VALID');
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601));
 PERFORM proof.expect_error($q$SELECT public.rpc_taxonomy_prepare_admission_service(proof.id(1),proof.id(5),'WORKER_CAPABILITY',proof.id(4),(SELECT projection#>'{classificationCandidates,0}' FROM proof.current_review))$q$,'ADMISSION_PLAN_REVIEW_REQUIRED');
END $$;

-- Actual task capture/projection/commit/binder accepts the same explicit mode
-- extension. This remains an owner-accepted synthetic command, never publishing.
DO $$ DECLARE hint jsonb;p jsonb;e jsonb;r jsonb;BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service();PERFORM proof.seed_need_completion();
 hint:=jsonb_build_object('service','Restauracija muzičkih kutija','mode','REMOTE','action','EXTEND_MODE',
  'categoryId',proof.id(601),'parentId','','proposedPath','[]'::jsonb,
  'reason','Repair takes place at the provider workshop and the restored object is delivered.',
  'catalogVersion',10,'handoff','{"required":true,"shippingCountries":["RS"]}'::jsonb);
 PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(proof.id(1),proof.id(2),proof.id(41),
  proof.id(42),proof.id(43),'NEED_SERVICE',10,jsonb_build_array(hint));
 p:=private.taxonomy_review_candidate_projection_v2('NEED_SERVICE','["Restauracija muzičkih kutija"]',
  '[{"service":"Restauracija muzičkih kutija","mode":"REMOTE"}]',proof.id(1),proof.id(2));
 PERFORM proof.require(p->>'status'='READY' AND p#>>'{classificationCandidates,0,action}'='EXTEND_MODE'
  AND p#>'{classificationCandidates,0,handoff}'=hint->'handoff','TASK_EXPLICIT_EXTENSION_AND_HANDOFF_REVIEW');
 e:=(p-'status'-'visibleServices')||jsonb_build_object('canAccept',true,'classificationState','READY',
  'publicProjection','[{"key":"need.category","value":"Restauracija muzičkih kutija"}]'::jsonb,
  'location','{"geography":{"mode":"REMOTE"}}'::jsonb);
 INSERT INTO private.ai_task_reviews(id,account_id,envelope,policy_binding,expires_at)
 VALUES(proof.id(14),proof.id(1),e||jsonb_build_object('displayedContentDigest',
  encode(extensions.digest(jsonb_build_object('envelope',e,'policy','{}'::jsonb)::text,'sha256'),'hex')),
  '{}',clock_timestamp()+interval '1 hour');
 PERFORM proof.expect_error($q$SELECT public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(1),proof.id(214),'NEED_SERVICE',proof.id(14),(SELECT envelope->'classificationCandidates' FROM private.ai_task_reviews WHERE id=proof.id(14)))$q$,'BATCH_EXISTING_USER_SAVE_REQUIRED');
 INSERT INTO public.needs VALUES(proof.id(114),proof.id(1),1,'DRAFT','Restauracija muzičkih kutija','REMOTE',null);
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state,created_at,need_id,need_revision)
 VALUES(proof.id(14),proof.id(1),proof.id(214),'ACCEPTED',clock_timestamp(),proof.id(114),1);
 r:=public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(1),proof.id(214),'NEED_SERVICE',proof.id(14),p->'classificationCandidates');
 PERFORM proof.require(r#>>'{items,0,categoryId}'=proof.id(601)::text AND r->>'createdCount'='0','TASK_EXTENDS_SAME_UUID_AFTER_ACCEPT_ONLY');
 r:=public.rpc_taxonomy_bind_reviewed_need_service(proof.id(1),proof.id(214),proof.id(14),proof.id(114),1);
 PERFORM proof.require(r->>'status'='BOUND_NEED_REVISION'
  AND NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1),'TASK_BINDING_DOES_NOT_GRANT_WORKER_COMPETENCE');
END $$;

-- MULTI_STOP is an existing ON_SITE execution shape; signed task admission
-- must agree with the same mode mapping already used by the need binder.
DO $$ DECLARE p jsonb;e jsonb;r jsonb;BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service();
 p:=private.taxonomy_review_exact_projection_v1('NEED_SERVICE','["Restauracija muzičkih kutija"]',
  '[{"service":"Restauracija muzičkih kutija","mode":"ON_SITE"}]');
 PERFORM proof.require(p->>'status'='READY','EXISTING_ONSITE_SERVICE_REVIEW');
 e:=(p-'status'-'visibleServices')||jsonb_build_object('canAccept',true,'classificationState','READY',
  'publicProjection','[{"key":"need.category","value":"Restauracija muzičkih kutija"}]'::jsonb,
  'location','{"geography":{"mode":"MULTI_STOP"}}'::jsonb);
 INSERT INTO private.ai_task_reviews(id,account_id,envelope,policy_binding,expires_at)
 VALUES(proof.id(14),proof.id(1),e||jsonb_build_object('displayedContentDigest',
  encode(extensions.digest(jsonb_build_object('envelope',e,'policy','{}'::jsonb)::text,'sha256'),'hex')),
  '{}',clock_timestamp()+interval '1 hour');
 INSERT INTO public.needs VALUES(proof.id(114),proof.id(1),1,'DRAFT','Restauracija muzičkih kutija','MULTI_STOP',null);
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state,created_at,need_id,need_revision)
 VALUES(proof.id(14),proof.id(1),proof.id(214),'ACCEPTED',clock_timestamp(),proof.id(114),1);
 r:=public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(1),proof.id(214),'NEED_SERVICE',proof.id(14),p->'classificationCandidates');
 PERFORM proof.require(r->>'status'='COMMITTED' AND r#>>'{items,0,mode}'='ON_SITE','MULTI_STOP_ACCEPTS_REVIEWED_ONSITE_MODE');
 r:=public.rpc_taxonomy_bind_reviewed_need_service(proof.id(1),proof.id(214),proof.id(14),proof.id(114),1);
 PERFORM proof.require(r->>'status'='BOUND_NEED_REVISION','MULTI_STOP_BINDER_ACCEPTS_SAME_MODE_MAPPING');
END $$;

-- Legacy single admission remains closed for EXTEND_MODE but its supported
-- CREATE_CHILD path follows the same organizational ancestor semantics.
DO $$ DECLARE p jsonb;e jsonb;proposal jsonb;prepared jsonb;r jsonb;BEGIN
 PERFORM proof.reset();PERFORM proof.seed_service('Izrada test minijatura');
 p:=proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Izrada test minijatura','Izrada novih figurica'],proof.id(501));
 proposal:=p#>'{classificationCandidates,0}';
 SELECT (envelope-'displayedContentDigest')||jsonb_build_object('classificationProposal',proposal)
  INTO e FROM private.worker_ai_reviews WHERE id=proof.id(4);
 UPDATE private.worker_ai_reviews SET envelope=e||jsonb_build_object('displayedContentDigest',
  encode(extensions.digest((e||jsonb_build_object('baseHash','synthetic-base'))::text,'sha256'),'hex'))
 WHERE id=proof.id(4);
 prepared:=public.rpc_taxonomy_prepare_admission_service(proof.id(1),proof.id(5),'WORKER_CAPABILITY',proof.id(4),proposal);
 PERFORM proof.require(prepared->>'status'='PENDING','LEGACY_CHILD_CAN_BE_PREPARED_WITH_OTHER_MODE_ANCESTOR');
 PERFORM proof.expect_error(format('SELECT public.rpc_taxonomy_commit_admission_service(%L::uuid)',prepared->>'admissionId'),'ADMISSION_OWNER_APPROVAL_REQUIRED');
 PERFORM proof.save();
 PERFORM public.rpc_taxonomy_approve_admission((prepared->>'admissionId')::uuid,prepared->>'planDigest',
  (SELECT envelope->>'displayedContentDigest' FROM private.worker_ai_reviews WHERE id=proof.id(4)));
 r:=public.rpc_taxonomy_commit_admission_service((prepared->>'admissionId')::uuid);
 PERFORM proof.require(r->>'createdCount'='1'
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes WHERE category_id IN(proof.id(501),proof.id(601)) AND execution_scope='REMOTE'),
  'LEGACY_LEAF_ONLY_NO_ANCESTOR_PROPAGATION');
END $$;

SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.mode_before b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.proowner<>b.proowner OR p.proacl IS DISTINCT FROM b.proacl OR p.proconfig IS DISTINCT FROM b.proconfig
 OR p.prosecdef<>b.prosecdef OR p.provolatile<>b.provolatile),'EXISTING_FUNCTION_SECURITY_METADATA_UNCHANGED');
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.mode_before b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE b.signature IN('private.taxonomy_scope_eligible_v1(uuid,uuid)','private.taxonomy_risk_triage_v1(text)',
 'private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)','private.taxonomy_admission_fingerprint_v1()')
 AND md5(pg_get_functiondef(p.oid))<>b.definition_md5),'STRICT_MATCHER_RISK_EXACT_PROJECTION_FINGERPRINT_UNCHANGED');
SELECT proof.require((SELECT jsonb_agg(to_jsonb(r) ORDER BY pattern) FROM private.work_taxonomy_risk_rules r)
 IS NOT DISTINCT FROM (SELECT jsonb_agg(to_jsonb(r) ORDER BY pattern) FROM proof.risk_rules_before r),'ORIGINAL_SAFETY_RULES_UNMODIFIED');
ROLLBACK;
SELECT 'PARENT_NAVIGATION_SIGNED_MODE_ADMISSION_HANDOFF_PASS' result;
