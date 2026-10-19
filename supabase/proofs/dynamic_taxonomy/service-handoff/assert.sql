\set ON_ERROR_STOP on
BEGIN;
-- Each workflow psql invocation is a new connection; restore the fixture session.
SELECT set_config('test.auth_uid',proof.id(1)::text,false);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SELECT proof.require(auth.uid()=proof.id(1) AND auth.jwt()->>'role'='service_role','FIXTURE_AUTH_SESSION_PRESENT');
-- Function identity/configuration remain stable; the table migration is additive.
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.handoff_function_before b JOIN pg_proc p ON p.oid=b.signature::regprocedure
 WHERE p.proowner<>b.proowner OR p.proconfig IS DISTINCT FROM b.proconfig OR p.prosecdef<>b.prosecdef OR p.provolatile<>b.provolatile),'REPLACEMENT_EXECUTION_PROPERTIES_PRESERVED');
SELECT proof.require(NOT has_function_privilege('anon','private.taxonomy_handoff_compatible_v1(jsonb,jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.taxonomy_handoff_compatible_v1(jsonb,jsonb)','EXECUTE')
 AND has_function_privilege('service_role','private.taxonomy_handoff_compatible_v1(jsonb,jsonb)','EXECUTE'),'PRIVATE_HANDOFF_HELPER_GRANTS');
SELECT proof.require((SELECT required_for_draft=false AND material AND privacy_class='PUBLIC' AND target_owner='need_requirement_details.handoff'
 FROM private.need_fact_registry WHERE fact_key='need.handoff'),'OPTIONAL_FACT_CONDITIONAL_REMOTE_REQUIREMENT');

-- Canonical fingerprint: null preserves historical identity, typed change is material.
DO $$ DECLARE old jsonb;fresh jsonb;physical jsonb; BEGIN
 SELECT value INTO old FROM proof.legacy_fingerprint;
 fresh:=private.need_publication_fingerprint_snapshot(proof.id(900));
 PERFORM proof.require(fresh=old,'LEGACY_NULL_HANDOFF_FINGERPRINT_UNCHANGED');
 UPDATE public.need_requirement_details SET handoff='{"required":false}' WHERE need_id=proof.id(900);
 fresh:=private.need_publication_fingerprint_snapshot(proof.id(900));
 PERFORM proof.require(fresh->>'canonicalFingerprint'<>old->>'canonicalFingerprint'
  AND fresh->>'privateMaterialityMarker'=old->>'privateMaterialityMarker','HANDOFF_ALONE_CHANGES_PUBLICATION_FINGERPRINT');
 UPDATE public.need_requirement_details SET handoff='{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}' WHERE need_id=proof.id(900);
 physical:=private.need_publication_fingerprint_snapshot(proof.id(900));
 PERFORM proof.require(physical->>'canonicalFingerprint'<>fresh->>'canonicalFingerprint','DIGITAL_TO_PHYSICAL_IS_MATERIAL');
 UPDATE public.need_requirement_details SET handoff=jsonb_set(handoff,'{localExchange,city}','"Beograd"') WHERE need_id=proof.id(900);
 PERFORM proof.require(private.need_publication_fingerprint_snapshot(proof.id(900))->>'canonicalFingerprint'<>physical->>'canonicalFingerprint','PICKUP_CITY_CHANGE_IS_MATERIAL');
 PERFORM proof.require(physical::text NOT LIKE '%Private fixture address%','FINGERPRINT_RECEIPT_DOES_NOT_REVEAL_PRIVATE_ADDRESS');
 UPDATE public.need_requirement_details SET handoff=NULL WHERE need_id=proof.id(900);
 PERFORM proof.require(private.need_publication_fingerprint_snapshot(proof.id(900))=old,'REMOVING_OPTIONAL_FACT_RESTORES_IDENTICAL_LEGACY_INPUT');
END $$;

-- Actual cached legacy READY is not returned. Pending state remains decodable.
DO $$ DECLARE r jsonb;legacy jsonb; BEGIN
 SELECT value INTO legacy FROM proof.legacy_task_review;
 r:=public.rpc_prepare_ai_task_review_taxonomy(proof.id(2));
 PERFORM proof.require(r->>'reviewId'<>legacy->>'reviewId' AND r->>'classificationState'='PENDING_CLASSIFICATION'
  AND r->'canAccept'='false'::jsonb AND r->'missingRequired' ? 'need.handoff','LEGACY_REMOTE_CACHE_WITHOUT_HANDOFF_REQUIRES_NEW_REVIEW');
 PERFORM proof.require(r->'classificationCandidates'='[]'::jsonb AND r->'classificationCatalogVersion'='null'::jsonb
  AND r->'classificationCatalogFingerprint'='null'::jsonb,'PENDING_CLASSIFICATION_HAS_NO_READY_METADATA');
 PERFORM proof.reject($q$SELECT public.rpc_save_need_draft_from_review(proof.id(2),proof.id(3),'old-review-save')$q$,'HANDOFF_REQUIRED','22023');
 PERFORM proof.require(NOT EXISTS(SELECT 1 FROM private.need_draft_save_commands),'REJECTED_OLD_SAVE_HAS_NO_COMMAND_WRITE');
 INSERT INTO public.needs(id,requester_account_id,revision,status,category,execution_location_mode)
 VALUES(proof.id(910),proof.id(1),1,'DRAFT','Izrada osnovnih modela','REMOTE');
 UPDATE public.ai_conversations SET bound_need_id=proof.id(910),need_edit_base_fingerprint='synthetic-edit-base' WHERE id=proof.id(2);
 PERFORM proof.reject($q$SELECT public.rpc_confirm_need_edit_from_review(proof.id(910),1,proof.id(2),'old-review-edit')$q$,'HANDOFF_REQUIRED','22023');
 PERFORM proof.require((SELECT revision=1 FROM public.needs WHERE id=proof.id(910)) AND NOT EXISTS(SELECT 1 FROM private.need_edit_commands),'REJECTED_OLD_EDIT_DOES_NOT_MUTATE_NEED');
 UPDATE public.ai_conversations SET bound_need_id=NULL,need_edit_base_fingerprint=NULL WHERE id=proof.id(2);
 INSERT INTO public.ai_structured_facts(conversation_id,fact_schema_version,status,fact_key,fact_value)
 VALUES(proof.id(2),'NEED_FACT_V2','CONFIRMED','need.handoff','{"required":false}');
 r:=public.rpc_prepare_ai_task_review_taxonomy(proof.id(2));
 PERFORM proof.require(r->>'classificationState'='READY' AND r->'canAccept'='true'::jsonb
  AND r#>'{classificationCandidates,0,handoff}'='{"required":false}'::jsonb
  AND NOT(r->'missingRequired' ? 'need.handoff'),'EXPLICIT_DIGITAL_FACT_CAN_PREPARE_READY');
 PERFORM proof.require(EXISTS(SELECT 1 FROM jsonb_array_elements(r->'publicProjection') f
  WHERE f->>'key'='need.handoff' AND f->>'displayValue'='Bez fizičke predaje'),'REVIEW_PUBLIC_DISPLAY_DERIVED_FROM_TYPED_FACT');
END $$;

-- Real validator/constraints, no addresses or malformed shapes accepted.
DO $$ DECLARE v jsonb; BEGIN
 FOR v IN SELECT value FROM jsonb_array_elements('[{"required":false},{"required":true,"shippingCountries":["RS","BA"]},{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}},{"required":true,"shippingCountries":["RS"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}]') LOOP
  PERFORM private.validate_need_v2_fact('need.handoff',v);
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements('[null,{},[],{"required":true},{"required":false,"shippingCountries":["RS"]},{"required":true,"shippingCountries":["RS","RS"]},{"required":true,"shippingCountries":["rs"]},{"required":true,"localExchange":{"countryCode":"RS","city":"Adresa 23"}},{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad","address":"secret"}}]') LOOP
  PERFORM proof.reject(format('SELECT private.validate_need_v2_fact(''need.handoff'',%L::jsonb)',v::text),'HANDOFF_INPUT_INVALID','22023');
 END LOOP;
 PERFORM proof.require(private.taxonomy_handoff_display_v1('{"required":true,"shippingCountries":["BA","RS"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}')=
 'Slanje: BA, RS ili Lično preuzimanje: Novi Sad (RS)','DISPLAY_PARITY_AND_COUNTRY_ORDER');
 PERFORM proof.require(private.taxonomy_handoff_display_v1(NULL) IS NULL,'UNKNOWN_NOT_MISLABELED_DIGITAL');
END $$;

-- Shipping and pickup are alternatives; no inherited consent, false != unknown.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT * FROM (VALUES
 ('legacy unknown',NULL::jsonb,NULL::jsonb,true),
 ('digital legacy worker','{"required":false}'::jsonb,NULL::jsonb,true),
 ('digital agreed','{"required":false}','{"required":false}',true),
 ('digital physical worker','{"required":false}','{"required":true,"shippingCountries":["RS"]}',false),
 ('physical unknown','{"required":true,"shippingCountries":["RS"]}',NULL,false),
 ('physical digital','{"required":true,"shippingCountries":["RS"]}','{"required":false}',false),
 ('shared country','{"required":true,"shippingCountries":["RS","BA"]}','{"required":true,"shippingCountries":["BA"]}',true),
 ('different countries','{"required":true,"shippingCountries":["RS"]}','{"required":true,"shippingCountries":["BA"]}',false),
 ('same city normalized','{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"localExchange":{"countryCode":"RS","city":"novi sad"}}',true),
 ('different city','{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"localExchange":{"countryCode":"RS","city":"Beograd"}}',false),
 ('same city other country','{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"localExchange":{"countryCode":"BA","city":"Novi Sad"}}',false),
 ('shipping no pickup consent','{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"shippingCountries":["RS"]}',false),
 ('pickup alternative','{"required":true,"shippingCountries":["BA"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}',true),
 ('shipping alternative','{"required":true,"shippingCountries":["RS"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}','{"required":true,"shippingCountries":["RS"],"localExchange":{"countryCode":"RS","city":"Beograd"}}',true),
 ('invalid need','{}','{"required":false}',false),
 ('JSON null not absent','null','{"required":false}',false)
 ) cases(label,need_value,worker_value,expected) LOOP
  PERFORM proof.require(private.taxonomy_handoff_compatible_v1(t.need_value,t.worker_value)=t.expected,'COMPATIBILITY: '||t.label);
 END LOOP;
END $$;

-- Real worker admission/binding and durable saved-context chain.
DO $$ DECLARE p jsonb;r jsonb;c jsonb;without_handoff jsonb;h jsonb:='{"required":true,"shippingCountries":["BA","RS"],"localExchange":{"countryCode":"RS","city":"Novi Sad"}}'; BEGIN
 PERFORM proof.handoff_reset();
 p:=proof.prepare_mode('Izrada osnovnih modela','REMOTE','REUSE_EXISTING',proof.id(501),h,true);
 PERFORM proof.require(p->>'status'='READY' AND p#>'{classificationCandidates,0,handoff}'=h,'WORKER_SIGNED_PROJECTION_PRESERVES_EXACT_HANDOFF');
 PERFORM proof.require(NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1),'REVIEW_ALONE_GRANTS_NO_PERMISSION');
 PERFORM proof.expect_error('SELECT proof.commit_batch()','BATCH_EXISTING_USER_SAVE_REQUIRED');
 PERFORM proof.saved_profile_boundary();PERFORM proof.commit_batch();r:=proof.bind_worker();
 PERFORM proof.require(r->>'notificationAuthority'='NONE' AND r->>'dispatchAuthority'='NONE'
  AND (SELECT handoff=h AND execution_scope='REMOTE' AND active FROM private.taxonomy_confirmed_worker_modes_v1),'WORKER_BINDER_PERSISTS_ONLY_SIGNED_HANDOFF_WITH_NO_DISPATCH');
 PERFORM proof.require(proof.bind_worker()=r AND (SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1),'BINDER_REPLAY_IS_IDEMPOTENT');
 c:=private.worker_ai_service_mode_context_v1(proof.id(1),proof.id(2));
 PERFORM proof.require(c#>'{savedServices,0,handoff}'=h,'ACTUAL_SAVED_CHAIN_RETURNS_HANDOFF');
 without_handoff:=jsonb_set(p,'{classificationCandidates,0}',(p#>'{classificationCandidates,0}')-'handoff');
 UPDATE private.worker_ai_sessions SET candidate=candidate||'{"bio":"Samo izmena opisa"}',revision=2;
 c:=private.taxonomy_preserve_review_handoff_v1(without_handoff,proof.id(1),proof.id(2));
 PERFORM proof.require(c#>'{classificationCandidates,0,handoff}'=h,'BIO_ONLY_REVIEW_PRESERVES_SAVED_HANDOFF');
 c:=private.taxonomy_preserve_review_handoff_v1(jsonb_set(p,'{classificationCandidates,0,handoff}','{"required":false}'),proof.id(1),proof.id(2));
 PERFORM proof.require(c#>'{classificationCandidates,0,handoff}'='{"required":false}'::jsonb,'EXPLICIT_NEW_PLAN_NOT_OVERWRITTEN_BY_BASELINE');
 PERFORM proof.require(private.taxonomy_preserve_review_handoff_v1('{"status":"PENDING_CLASSIFICATION"}',proof.id(1),proof.id(2))='{"status":"PENDING_CLASSIFICATION"}'::jsonb,'PENDING_STAYS_PENDING');
 PERFORM proof.need_boundary(h,h);PERFORM proof.bind_handoff_need();
 PERFORM proof.require(private.taxonomy_handoff_fit_v1(proof.id(110),proof.id(1)),'EXACT_SAVED_PHYSICAL_HANDOFF_GATE_PASSES');
 PERFORM proof.require(NOT private.taxonomy_handoff_fit_v1(proof.id(110),proof.id(99)),'OTHER_ACCOUNT_HAS_NO_PHYSICAL_HANDOFF_PERMISSION');
 UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false;
 PERFORM proof.require(NOT private.taxonomy_handoff_fit_v1(proof.id(110),proof.id(1)),'WITHDRAWN_PERMISSION_BLOCKS_HANDOFF_GATE');
 c:=private.taxonomy_preserve_review_handoff_v1(without_handoff,proof.id(1),proof.id(2));
 PERFORM proof.require(NOT(c#>'{classificationCandidates,0}'?'handoff'),'REVOKED_BASELINE_IS_NOT_REINTRODUCED');
 UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=true,source_request_key=proof.id(999);
 PERFORM proof.require(NOT private.taxonomy_handoff_fit_v1(proof.id(110),proof.id(1)),'UNBACKED_MODE_ROW_CANNOT_AUTHORIZE_SHIPMENT');
END $$;

-- Draft proposal data is not a substitute for an accepted owner review.
DO $$ DECLARE p jsonb;c jsonb; BEGIN
 PERFORM proof.handoff_reset();
 p:=proof.prepare_mode('Izrada osnovnih modela','REMOTE','REUSE_EXISTING',proof.id(501),'{"required":true,"shippingCountries":["RS"]}',true);
 c:=private.worker_ai_service_mode_context_v1(proof.id(1),proof.id(2));
 PERFORM proof.require(c->'savedServices'='[]'::jsonb AND c#>'{draftServices,0,handoff}'='{"required":true,"shippingCountries":["RS"]}'::jsonb,'DRAFT_HAS_INFORMATION_ONLY_NOT_SAVED_AUTHORITY');
 p:=jsonb_set(p,'{classificationCandidates,0}',(p#>'{classificationCandidates,0}')-'handoff');
 c:=private.taxonomy_preserve_review_handoff_v1(p,proof.id(1),proof.id(2));
 PERFORM proof.require(NOT(c#>'{classificationCandidates,0}'?'handoff'),'DRAFT_HINT_CANNOT_FILL_SAVED_BASELINE');
END $$;

-- Real need binder requires exact saved signed parity, including legacy-null rejection.
DO $$ DECLARE h jsonb:='{"required":true,"localExchange":{"countryCode":"RS","city":"Novi Sad"}}';r jsonb; BEGIN
 PERFORM proof.handoff_reset();PERFORM proof.need_boundary(h,h);r:=proof.bind_handoff_need();
 PERFORM proof.require(r->>'status'='BOUND_NEED_REVISION' AND r->>'notificationAuthority'='NONE'
  AND (SELECT category_id=proof.id(501) AND status='DRAFT' FROM public.needs WHERE id=proof.id(110)),'NEED_BINDING_PRESERVES_DRAFT_AND_EXACT_CATEGORY');
 PERFORM proof.require(proof.bind_handoff_need()=r,'NEED_BINDER_REPLAY_IDEMPOTENT');
 PERFORM proof.handoff_reset();PERFORM proof.need_boundary(h,'{"required":true,"shippingCountries":["RS"]}');
 PERFORM proof.reject('SELECT proof.bind_handoff_need()','NEED_BINDER_HANDOFF_STALE','PT409');
 PERFORM proof.require((SELECT category_id IS NULL FROM public.needs WHERE id=proof.id(110))
  AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots) AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_bindings_v1),'HANDOFF_MISMATCH_HAS_NO_PARTIAL_BINDING');
 PERFORM proof.handoff_reset();PERFORM proof.need_boundary(NULL,NULL);
 PERFORM proof.reject('SELECT proof.bind_handoff_need()','NEED_BINDER_HANDOFF_STALE','PT409');
 PERFORM proof.handoff_reset();PERFORM proof.need_boundary('{"required":false}','{"required":false}');
 PERFORM proof.require(proof.bind_handoff_need()->>'status'='BOUND_NEED_REVISION','EXPLICIT_FALSE_IS_VALID_NOT_UNKNOWN');
END $$;

-- New storage constraints enforce validity even if a caller bypasses the helper.
DO $$ DECLARE code text; BEGIN
 BEGIN INSERT INTO public.need_requirement_details(need_id,handoff) VALUES(proof.id(777),'{}');
 EXCEPTION WHEN check_violation THEN code:=SQLSTATE; END;
 PERFORM proof.require(code='23514','TABLE_REJECTS_MALFORMED_HANDOFF');code:=NULL;
 BEGIN INSERT INTO private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,execution_scope,handoff)
 VALUES(proof.id(777),proof.id(501),'ON_SITE','{"required":false}');
 EXCEPTION WHEN check_violation THEN code:=SQLSTATE; END;
 PERFORM proof.require(code='23514','ONSITE_CANNOT_STORE_REMOTE_HANDOFF');
END $$;
SELECT 'PASS: service handoff assertions (synthetic upstream boundary; no full Save/publication proof)' AS result;
ROLLBACK;
