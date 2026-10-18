SELECT proof.context_reset();
SELECT proof.require(proof.mode_context()->>'schemaVersion'='WORKER_SERVICE_MODE_CONTEXT_V1'
 AND proof.mode_context()->'revision'='0'::jsonb
 AND proof.mode_context()->'savedServices'=jsonb_build_array(jsonb_build_object(
  'service','3D štampa','mode','REMOTE','categoryId',proof.category()))
 AND proof.mode_context()->'draftServices'='[]'::jsonb
 AND proof.mode_context()->'unresolvedServices'='[]'::jsonb,'CURRENT_SAVED_REMOTE_BASELINE');
SELECT proof.require((SELECT expires_at<clock_timestamp() FROM private.worker_ai_reviews WHERE id=proof.original()),
 'FIXTURE_ORIGINAL_REVIEW_EXPIRED_AFTER_TIMELY_SAVE');

-- Reproduce the actual seam: a bio-only turn and wrong both-mode draft hints.
UPDATE private.worker_ai_sessions SET revision=1,candidate=jsonb_set(candidate,'{bio}','"Only description changed"')
 WHERE conversation_id=proof.fresh();
INSERT INTO private.worker_ai_turns(conversation_id,account_id,state)
 VALUES(proof.fresh(),proof.owner(),'SUCCEEDED');
SELECT proof.add_current_hint(ARRAY['ON_SITE','REMOTE']);
SELECT proof.require(proof.mode_context()->'savedServices'=jsonb_build_array(jsonb_build_object(
 'service','3D štampa','mode','REMOTE','categoryId',proof.category()))
 AND jsonb_array_length(proof.mode_context()->'draftServices')=2
 AND proof.mode_context()->'revision'='1'::jsonb,'BIO_EDIT_SEPARATES_SAVED_REMOTE_FROM_BOTH_MODE_PROPOSAL');
SELECT proof.require((SELECT count(*)=1 FROM private.worker_ai_saves)
 AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_bindings_v1)
 AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active),
 'CONTEXT_READ_CANNOT_SAVE_BIND_OR_CONFIRM_MODES');

-- Partial coverage: preserve known services without inventing the new one.
UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}','["3D štampa","Nova nepoznata usluga"]')
 WHERE conversation_id=proof.fresh();
SELECT proof.require(jsonb_array_length(proof.mode_context()->'savedServices')=1
 AND proof.mode_context()->'draftServices'='[]'::jsonb
 AND proof.mode_context()->'unresolvedServices'='["Nova nepoznata usluga"]'::jsonb,
 'UNMAPPED_ADDITION_RETAINS_KNOWN_BASELINE_AND_INVALIDATES_STALE_HINT');
UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}','["Fotografisanje"]')
 WHERE conversation_id=proof.fresh();
SELECT proof.require(proof.mode_context()->'savedServices'='[]'::jsonb
 AND proof.mode_context()->'unresolvedServices'='["Fotografisanje"]'::jsonb,'CHANGED_SERVICE_NO_INHERITANCE');
SELECT proof.context_reset();
UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}','["3D štampa","3d stampa"]')
 WHERE conversation_id=proof.fresh();
SELECT proof.expect_no_saved('AMBIGUOUS_DUPLICATE_SKILL_NO_INHERITANCE');

SELECT proof.context_reset(ARRAY['ON_SITE','REMOTE']);
SELECT proof.require(jsonb_array_length(proof.mode_context()->'savedServices')=2,'BOTH_SAVED_EXPLICIT_MODES_SURVIVE');
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE execution_scope='ON_SITE';
SELECT proof.require(proof.mode_context()->'savedServices'=jsonb_build_array(jsonb_build_object(
 'service','3D štampa','mode','REMOTE','categoryId',proof.category())),'REVOKED_MODE_OMITTED_VALID_MODE_RETAINED');
SELECT proof.context_reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false;
SELECT proof.expect_no_saved('REVOKED_REMOTE_NEVER_RESURRECTED');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_worker_capabilities SET excluded=true;
SELECT proof.expect_no_saved('EXCLUDED_CAPABILITY');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_worker_capabilities SET origin='LEGACY';
SELECT proof.expect_no_saved('UNSIGNED_CAPABILITY');
SELECT proof.context_reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_review_id=gen_random_uuid();
SELECT proof.expect_no_saved('WRONG_REVIEW');
SELECT proof.context_reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_request_key=gen_random_uuid();
SELECT proof.expect_no_saved('WRONG_REQUEST');
SELECT proof.context_reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=clock_timestamp();
SELECT proof.expect_no_saved('MODE_TIMESTAMP_MISMATCH');
SELECT proof.context_reset();
UPDATE private.worker_execution_mode_choices SET modes=ARRAY['ON_SITE'],updated_at=clock_timestamp();
SELECT proof.expect_no_saved('WITHDRAWN_GLOBAL_REMOTE');
SELECT proof.context_reset();
UPDATE private.worker_execution_mode_choices SET consent_source='LEGACY';
SELECT proof.expect_no_saved('UNSIGNED_GLOBAL_MODE');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_worker_bindings_v1 SET source_review_id=gen_random_uuid();
SELECT proof.expect_no_saved('WRONG_BINDING');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_review_batches_v1 SET review_digest='forged';
SELECT proof.expect_no_saved('BATCH_DIGEST_MISMATCH');
SELECT proof.context_reset();
UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{profile,bio}','"tampered"') WHERE id=proof.original();
SELECT proof.expect_no_saved('TAMPERED_REVIEW');
SELECT proof.context_reset();
INSERT INTO private.worker_ai_saves SELECT gen_random_uuid(),account_id,gen_random_uuid(),receipt,clock_timestamp()
 FROM private.worker_ai_saves;
SELECT proof.expect_no_saved('NEW_UNBOUND_SAVE_NO_OLDER_FALLBACK');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_categories SET state='RETIRED' WHERE id=proof.category();
SELECT proof.expect_no_saved('RETIRED_CATEGORY');
SELECT proof.context_reset();
DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.category() AND execution_scope='REMOTE';
SELECT proof.expect_no_saved('RETIRED_MODE');
SELECT proof.context_reset();
UPDATE private.work_taxonomy_aliases SET category_id='00000000-0000-4000-8000-000000000003';
SELECT proof.expect_no_saved('MOVED_ALIAS');
SELECT proof.context_reset();
INSERT INTO private.work_taxonomy_aliases VALUES('00000000-0000-4000-8000-000000000003','3D štampa','sr','3d stampa');
SELECT proof.expect_no_saved('AMBIGUOUS_ALIAS');

-- Draft hints never become saved consent and must be exact-source/category/mode.
SELECT proof.context_reset();
SELECT proof.add_current_hint();
SELECT proof.require(jsonb_array_length(proof.mode_context()->'draftServices')=1,'CURRENT_HINT_VISIBLE_AS_DRAFT');
UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET source_fingerprint='stale';
SELECT proof.require(proof.mode_context()->'draftServices'='[]'::jsonb,'STALE_HINT_OMITTED');
SELECT proof.context_reset();
SELECT proof.add_current_hint();
UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET account_id='00000000-0000-4000-8000-000000000099';
SELECT proof.require(proof.mode_context()->'draftServices'='[]'::jsonb,'OTHER_OWNER_HINT_OMITTED');
SELECT proof.context_reset();
SELECT proof.add_current_hint();
UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_version=3;
SELECT proof.require(proof.mode_context()->'draftServices'='[]'::jsonb,'OLD_CATALOG_HINT_OMITTED');
SELECT proof.context_reset();
SELECT proof.add_current_hint();
UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=jsonb_set(proposals,'{0,categoryId}',
 '"00000000-0000-4000-8000-000000000003"');
SELECT proof.require(proof.mode_context()->'draftServices'='[]'::jsonb,'WRONG_CATEGORY_HINT_OMITTED');

-- Existing reader auth/ownership/editability and cancelled-history policy unchanged.
SELECT proof.context_reset();
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT proof.expect_context_error('42501','SERVICE_ROLE_REQUIRED');
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT proof.expect_context_error('42501','WRONG_OWNER_DENIED','00000000-0000-4000-8000-000000000099');
UPDATE public.ai_conversations SET status='COMPLETED' WHERE id=proof.fresh();
SELECT proof.expect_context_error('55000','CLOSED_CONVERSATION');
SELECT proof.context_reset();
UPDATE private.worker_ai_sessions SET safety='REVIEW' WHERE conversation_id=proof.fresh();
SELECT proof.expect_context_error('55000','SAFETY_REVIEW');
SELECT proof.context_reset();
UPDATE public.app_profiles SET bio='Changed outside conversation' WHERE id=proof.profile();
SELECT proof.expect_context_error('55000','STALE_PROFILE_BASE');
UPDATE private.worker_ai_sessions SET base_hash=private.worker_ai_source_hash(proof.owner()),
 candidate=private.worker_ai_initial(proof.owner()) WHERE conversation_id=proof.fresh();
SELECT proof.expect_no_saved('NEW_CURRENT_BASE_CANNOT_REUSE_OLD_PROFILE_SIGNATURE');
SELECT proof.context_reset();
UPDATE public.app_profiles SET bio=bio WHERE id=proof.profile();
UPDATE private.worker_ai_sessions SET base_hash=private.worker_ai_source_hash(proof.owner()) WHERE conversation_id=proof.fresh();
SELECT proof.expect_no_saved('LATER_PROFILE_WRITE_SAME_VALUE_NOT_OLD_SIGNED_BASE');
SELECT proof.context_reset();
INSERT INTO public.ai_messages VALUES
 ('00000000-0000-4000-8000-000000000081',proof.fresh(),'USER','Keep this owned synthetic message',1),
 ('00000000-0000-4000-8000-000000000082',proof.fresh(),'USER','Cancelled synthetic message',2),
 ('00000000-0000-4000-8000-000000000083',proof.fresh(),'ASSISTANT','Kept reply',3);
INSERT INTO private.worker_ai_turns(conversation_id,account_id,state,cancelled_at,user_message_id)
 VALUES(proof.fresh(),proof.owner(),'CANCELLED',clock_timestamp(),'00000000-0000-4000-8000-000000000082');
SELECT proof.require(jsonb_array_length(proof.context()->'messages')=2
 AND proof.context()#>>'{messages,0,body}'='Keep this owned synthetic message'
 AND proof.context()#>>'{messages,1,body}'='Kept reply'
 AND NOT(proof.context()?'saved') AND NOT(proof.context()?'review'),'EXACT_CANCELLED_MESSAGE_FILTER_PRESERVED');

-- Preserve auth surface: only service-role may execute the definer wrapper;
-- helper itself has no direct service/client grant.
SELECT proof.require(has_function_privilege('service_role','public.rpc_read_worker_ai_context_service(uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.rpc_read_worker_ai_context_service(uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('anon','public.rpc_read_worker_ai_context_service(uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('service_role','private.worker_ai_service_mode_context_v1(uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.worker_ai_service_mode_context_v1(uuid,uuid)','EXECUTE')
 AND (SELECT NOT prosecdef AND provolatile='s' FROM pg_proc WHERE oid='private.worker_ai_service_mode_context_v1(uuid,uuid)'::regprocedure),
 'ACL_AND_STABLE_INVOKER_HELPER');

-- Actual Save + binder; then a fresh context and another bio-only draft.
SELECT proof.context_reset();
SELECT set_config('request.jwt.claim.role','authenticated',false);
TRUNCATE proof.context_results;
INSERT INTO proof.context_results VALUES('save-review',proof.review());
SELECT public.rpc_save_worker_ai_review((doc->>'reviewId')::uuid,doc->>'displayedContentDigest',
 '00000000-0000-4000-8000-000000000041') FROM proof.context_results WHERE label='save-review';
INSERT INTO private.work_taxonomy_review_batches_v1(owner_account_id,request_key,purpose,source_review_id,
 review_digest,plans,plans_digest,catalog_version,result)
 SELECT proof.owner(),'00000000-0000-4000-8000-000000000041','WORKER_CAPABILITY',(doc->>'reviewId')::uuid,
 doc->>'displayedContentDigest',doc->'classificationCandidates','fixture-not-used',4,
 jsonb_build_object('status','COMMITTED','requiresBinding',true,'capabilityAuthority','NONE',
 'notificationAuthority','NONE','items',doc->'classificationCandidates')
 FROM proof.context_results WHERE label='save-review';
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.rpc_taxonomy_bind_reviewed_worker_service(proof.owner(),
 '00000000-0000-4000-8000-000000000041',(doc->>'reviewId')::uuid,proof.profile())
 FROM proof.context_results WHERE label='save-review';
INSERT INTO public.ai_conversations VALUES('00000000-0000-4000-8000-000000000022',proof.owner(),'PROFILE','OPEN',null);
INSERT INTO private.worker_ai_sessions(conversation_id,account_id,profile_id,revision,candidate,safety,base_hash)
 VALUES('00000000-0000-4000-8000-000000000022',proof.owner(),proof.profile(),1,
 jsonb_set(private.worker_ai_initial(proof.owner()),'{bio}','"New bio after second Save"'),'ALLOW',private.worker_ai_source_hash(proof.owner()));
SELECT proof.require(public.rpc_read_worker_ai_context_service(proof.owner(),'00000000-0000-4000-8000-000000000022')
 #>'{serviceModeContext,savedServices}'=jsonb_build_array(jsonb_build_object(
 'service','3D štampa','mode','REMOTE','categoryId',proof.category())),'ACTUAL_SAVE_BINDER_NEXT_BIO_EDIT_RETAINS_REMOTE_BASELINE');
SELECT proof.require((SELECT count(*)=2 FROM private.worker_ai_saves)
 AND (SELECT count(*)=2 FROM private.work_taxonomy_worker_bindings_v1)
 AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active),'READ_DID_NOT_CREATE_NEW_CONSENT');
SELECT 'worker mode context: all isolated assertions passed' AS result;
SELECT p.oid::regprocedure::text AS signature,md5(pg_get_functiondef(p.oid)) AS definition_md5,
 p.proacl::text AS acl,p.prosecdef,p.provolatile,p.proconfig
 FROM pg_proc p WHERE p.oid IN (
 'public.rpc_read_worker_ai_context_service(uuid,uuid)'::regprocedure,
 'private.worker_ai_service_mode_context_v1(uuid,uuid)'::regprocedure)
 ORDER BY p.oid::regprocedure::text;
