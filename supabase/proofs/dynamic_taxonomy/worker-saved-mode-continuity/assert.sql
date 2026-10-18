-- Execute against actual replacement review RPC, exact resolver, Save and binder.
-- All mutations in this file are confined to the disposable synthetic fixture.
CREATE TABLE IF NOT EXISTS proof.results(label text PRIMARY KEY,doc jsonb);
TRUNCATE proof.results;
SELECT proof.reset();
INSERT INTO proof.results VALUES('first',proof.review());
SELECT proof.require(doc->>'classificationState'='READY'
 AND doc->'reviewedServiceModes'='[{"service":"3D štampa","mode":"REMOTE"}]'::jsonb
 AND doc#>>'{classificationCandidates,0,categoryId}'=proof.category()::text,
 'SAVED_REMOTE_CONTINUITY_REQUIRED') FROM proof.results WHERE label='first';
SELECT proof.require(doc->>'displayedContentDigest'=encode(extensions.digest(
 ((doc-'displayedContentDigest')||jsonb_build_object('baseHash',private.worker_ai_source_hash(proof.owner())))::text,'sha256'),'hex'),
 'NEW_REVIEW_MUST_HAVE_VALID_CURRENT_BASE_SIGNATURE') FROM proof.results WHERE label='first';
SELECT proof.require((SELECT count(*)=1 FROM private.worker_ai_saves)
 AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_bindings_v1)
 AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1)
 AND (SELECT count(*)=1 FROM private.work_taxonomy_worker_capabilities)
 AND (SELECT count(*)=0 FROM private.worker_ai_turns),'REVIEW_MUST_NOT_WRITE_CAPABILITY_CONSENT_OR_TURNS');
SELECT proof.require(NOT has_function_privilege('anon',
 'public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)','EXECUTE')
 AND NOT has_function_privilege('service_role',
 'public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)','EXECUTE')
 AND has_function_privilege('authenticated',
 'public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)','EXECUTE'),'RPC_ACL_PRESERVED');

-- A READY fresh-session cache must not mask a later withdrawal.
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false;
SELECT proof.expect_pending('CACHED_FRESH_REVIEW_MUST_RECHECK_WITHDRAWAL');
SELECT proof.reset(ARRAY['ON_SITE','REMOTE']);
SELECT proof.require(proof.review()->'reviewedServiceModes'=
 '[{"service":"3D štampa","mode":"ON_SITE"},{"service":"3D štampa","mode":"REMOTE"}]'::jsonb,
 'BOTH_EXPLICIT_SIGNED_MODES_MUST_SURVIVE');

-- Expiry of the original review is deliberately allowed AFTER an in-window Save.
SELECT proof.reset();
SELECT proof.require((SELECT expires_at<clock_timestamp() FROM private.worker_ai_reviews WHERE id=proof.original())
 AND proof.review()->>'classificationState'='READY','SAVED_PROOF_MUST_OUTLIVE_REVIEW_EXPIRATION');

-- No inference from city, legacy modes, related work, or an altered candidate.
SELECT proof.reset();
UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}','["Fotografisanje"]')
 WHERE conversation_id=proof.fresh();
SELECT proof.expect_pending('CHANGED_SERVICE_MUST_NOT_INHERIT');
SELECT proof.reset();
UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{bio}','"New description"')
 WHERE conversation_id=proof.fresh();
SELECT proof.expect_pending('CHANGED_PROFILE_MUST_NOT_INHERIT');
SELECT proof.reset();
UPDATE private.worker_ai_sessions SET revision=1 WHERE conversation_id=proof.fresh();
SELECT proof.expect_pending('EDITED_REVISION_MUST_NOT_INHERIT');
SELECT proof.reset();
INSERT INTO private.worker_ai_turns(conversation_id,state) VALUES(proof.fresh(),'SUCCEEDED');
SELECT proof.expect_pending('A_MODE_CHANGE_TURN_WITH_SAME_CANDIDATE_MUST_NOT_INHERIT');
SELECT proof.reset();
INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,source_fingerprint,catalog_version,proposals)
 VALUES('WORKER_CAPABILITY',proof.owner(),proof.fresh(),'stale-source',4,'[]');
SELECT proof.expect_pending('STALE_HINTS_MUST_NOT_FALL_BACK_TO_OLD_CONSENT');

-- Existing fresh, source-bound hints still work on an edited session.
SELECT proof.reset();
UPDATE private.worker_ai_sessions SET revision=1 WHERE conversation_id=proof.fresh();
INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,source_fingerprint,catalog_version,proposals)
 SELECT 'WORKER_CAPABILITY',account_id,conversation_id,
 encode(extensions.digest(convert_to(candidate::text||'|'||revision::text||'|'||base_hash,'UTF8'),'sha256'),'hex'),4,
 '[{"action":"REUSE_EXISTING","service":"3D štampa","mode":"ON_SITE"}]'::jsonb
 FROM private.worker_ai_sessions WHERE conversation_id=proof.fresh();
SELECT proof.require(proof.review()->'reviewedServiceModes'=
 '[{"service":"3D štampa","mode":"ON_SITE"}]'::jsonb,'CURRENT_HINT_PATH_MUST_REMAIN_AVAILABLE');

-- A profile edit after opening the session still rejects with non-retried PT409.
SELECT proof.reset();
UPDATE public.app_profiles SET bio='Changed outside this session' WHERE id=proof.profile();
DO $f$ BEGIN
 BEGIN
  PERFORM proof.review();
  RAISE EXCEPTION 'STALE_SOURCE_WAS_ACCEPTED';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END $f$;
-- Opening a new base on the changed profile must not inherit stale Save proof.
UPDATE private.worker_ai_sessions SET base_hash=private.worker_ai_source_hash(proof.owner()),
 candidate=private.worker_ai_initial(proof.owner()) WHERE conversation_id=proof.fresh();
SELECT proof.expect_pending('NEW_BASE_AFTER_PROFILE_CHANGE_MUST_NOT_INHERIT_OLD_SAVE');
SELECT proof.reset();
UPDATE public.app_profiles SET bio=bio WHERE id=proof.profile();
UPDATE private.worker_ai_sessions SET base_hash=private.worker_ai_source_hash(proof.owner()),
 candidate=private.worker_ai_initial(proof.owner()) WHERE conversation_id=proof.fresh();
SELECT proof.expect_pending('LATER_PROFILE_WRITE_MUST_NOT_REUSE_OLD_SAVE_EVEN_IF_TEXT_EQUAL');

SELECT proof.reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false;
SELECT proof.expect_pending('REVOKED_MODE_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.work_taxonomy_worker_capabilities SET excluded=true;
SELECT proof.expect_pending('EXCLUDED_CAPABILITY_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.work_taxonomy_worker_capabilities SET origin='LEGACY';
SELECT proof.expect_pending('LEGACY_CAPABILITY_MUST_NOT_CERTIFY_SERVICE');
SELECT proof.reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_review_id=gen_random_uuid();
SELECT proof.expect_pending('WRONG_SOURCE_REVIEW_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_request_key=gen_random_uuid();
SELECT proof.expect_pending('WRONG_SOURCE_REQUEST_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=confirmed_at+interval '1 second';
SELECT proof.expect_pending('MODE_TIMESTAMP_MISMATCH_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.work_taxonomy_worker_bindings_v1 SET source_review_id=gen_random_uuid();
SELECT proof.expect_pending('MISMATCHED_BINDING_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.work_taxonomy_review_batches_v1 SET review_digest='forged';
SELECT proof.expect_pending('MISMATCHED_BATCH_DIGEST_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{profile,bio}','"tampered"') WHERE id=proof.original();
SELECT proof.expect_pending('TAMPERED_SIGNED_REVIEW_MUST_FAIL_CLOSED');

SELECT proof.reset();
UPDATE private.worker_execution_mode_choices SET modes=ARRAY['ON_SITE'],updated_at=clock_timestamp();
SELECT proof.expect_pending('NEW_EXPLICIT_GLOBAL_CHOICE_MUST_NOT_INHERIT_OLD_REMOTE');
SELECT proof.reset();
UPDATE private.worker_execution_mode_choices SET updated_at=clock_timestamp();
SELECT proof.expect_pending('NEW_CHOICE_EVEN_SAME_MODES_REQUIRES_CURRENT_BINDING');
SELECT proof.reset();
UPDATE private.worker_execution_mode_choices SET consent_source='LEGACY';
SELECT proof.expect_pending('LEGACY_GLOBAL_CHOICES_ARE_NOT_CONSENT');
SELECT proof.reset();
INSERT INTO private.worker_ai_saves SELECT gen_random_uuid(),account_id,gen_random_uuid(),receipt,clock_timestamp()
 FROM private.worker_ai_saves WHERE review_id=proof.original();
SELECT proof.expect_pending('NEWER_SAVE_WITHOUT_BOUND_PROOF_MUST_NOT_INHERIT_OLDER_PROOF');

SELECT proof.reset();
UPDATE private.work_taxonomy_categories SET state='RETIRED' WHERE id=proof.category();
SELECT proof.expect_pending('RETIRED_CATEGORY_MUST_FAIL_CLOSED');
SELECT proof.reset();
DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.category() AND execution_scope='REMOTE';
SELECT proof.expect_pending('RETIRED_CATALOG_MODE_MUST_FAIL_CLOSED');
SELECT proof.reset();
UPDATE private.work_taxonomy_aliases SET category_id='00000000-0000-4000-8000-000000000003';
SELECT proof.expect_pending('MOVED_ALIAS_MUST_NOT_GRANT_DIFFERENT_CATEGORY');
SELECT proof.reset();
INSERT INTO private.work_taxonomy_aliases VALUES('00000000-0000-4000-8000-000000000003','3D štampa','sr','3d stampa');
SELECT proof.expect_pending('AMBIGUOUS_ALIAS_MUST_FAIL_CLOSED');
SELECT proof.reset(ARRAY['ON_SITE','REMOTE']);
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE execution_scope='ON_SITE';
SELECT proof.expect_pending('INCOMPLETE_SIGNED_SET_MUST_NOT_RETURN_HALF_AUTHORITY');

SELECT proof.reset();
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false);
DO $f$ BEGIN
 BEGIN
  PERFORM proof.review();
  RAISE EXCEPTION 'OTHER_OWNER_WAS_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $f$;
SELECT proof.reset();

-- Real Save + real binder + new session proves durability across another Save.
TRUNCATE proof.results;
INSERT INTO proof.results VALUES('save-review',proof.review());
SELECT public.rpc_save_worker_ai_review((doc->>'reviewId')::uuid,doc->>'displayedContentDigest',
 '00000000-0000-4000-8000-000000000041') FROM proof.results WHERE label='save-review';
SELECT proof.require((SELECT status='COMPLETED' FROM public.ai_conversations WHERE id=proof.fresh())
 AND (SELECT count(*)=2 FROM private.worker_ai_saves)
 AND (SELECT base_hash<>private.worker_ai_source_hash(proof.owner()) FROM private.worker_ai_sessions WHERE conversation_id=proof.fresh()),
 'ACTUAL_SAVE_MUST_COMPLETE_AND_ADVANCE_PROFILE_BASE');
-- Admission is fixture material: the actual binder consumes the exact newly
-- signed plans and saved receipt, and writes the actual current mode proof.
INSERT INTO private.work_taxonomy_review_batches_v1(owner_account_id,request_key,purpose,source_review_id,
 review_digest,plans,plans_digest,catalog_version,result)
 SELECT proof.owner(),'00000000-0000-4000-8000-000000000041','WORKER_CAPABILITY',(doc->>'reviewId')::uuid,
 doc->>'displayedContentDigest',doc->'classificationCandidates','fixture-not-used',4,
 jsonb_build_object('status','COMMITTED','requiresBinding',true,'capabilityAuthority','NONE',
 'notificationAuthority','NONE','items',doc->'classificationCandidates')
 FROM proof.results WHERE label='save-review';
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT public.rpc_taxonomy_bind_reviewed_worker_service(proof.owner(),
 '00000000-0000-4000-8000-000000000041',(doc->>'reviewId')::uuid,proof.profile())
 FROM proof.results WHERE label='save-review';
SELECT set_config('request.jwt.claim.role','authenticated',false);
INSERT INTO public.ai_conversations VALUES('00000000-0000-4000-8000-000000000022',proof.owner(),'PROFILE','OPEN',null);
INSERT INTO private.worker_ai_sessions(conversation_id,account_id,profile_id,revision,candidate,safety,base_hash)
 VALUES('00000000-0000-4000-8000-000000000022',proof.owner(),proof.profile(),0,
 private.worker_ai_initial(proof.owner()),'ALLOW',private.worker_ai_source_hash(proof.owner()));
INSERT INTO proof.results VALUES('reopened',
 public.rpc_prepare_worker_ai_review_taxonomy('00000000-0000-4000-8000-000000000022',0,true));
SELECT proof.require(doc->>'classificationState'='READY'
 AND doc->'reviewedServiceModes'='[{"service":"3D štampa","mode":"REMOTE"}]'::jsonb,
 'REAL_SAVE_BINDER_REOPEN_MUST_KEEP_REMOTE') FROM proof.results WHERE label='reopened';
SELECT proof.require((SELECT count(*)=2 FROM private.worker_ai_saves)
 AND (SELECT count(*)=2 FROM private.work_taxonomy_worker_bindings_v1)
 AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)
 AND (SELECT count(*)=0 FROM private.work_taxonomy_gemini_turn_hints_v1),
 'REOPEN_MUST_NOT_SAVE_OR_REBIND_OR_CALL_AI');
SELECT 'worker saved-mode continuity: all isolated assertions passed' AS result;

