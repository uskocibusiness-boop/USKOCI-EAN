\set ON_ERROR_STOP on
-- Called after parent-mode migration, before the handoff migration.
SELECT proof.require(to_regprocedure('private.taxonomy_handoff_compatible_v1(jsonb,jsonb)') IS NULL,'HANDOFF_MIGRATION_NOT_ALREADY_APPLIED');
CREATE TABLE proof.handoff_function_before AS SELECT oid::regprocedure::text signature,proowner,proconfig,prosecdef,provolatile
FROM pg_proc WHERE oid IN (
'private.validate_need_v2_fact(text,jsonb)'::regprocedure,
'public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure,
'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure,
'public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure,
'public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb)'::regprocedure,
'public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure,
'public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure,
'private.worker_ai_service_mode_context_v1(uuid,uuid)'::regprocedure,
'public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'::regprocedure,
'public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'::regprocedure,
'private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure,
'private.need_publication_fingerprint_snapshot(uuid)'::regprocedure);
SELECT proof.require((SELECT count(*)=12 FROM proof.handoff_function_before),'TWELVE_REAL_REPLACEMENTS_CAPTURED');
INSERT INTO public.needs(id,requester_account_id,revision,status,title,description,category,execution_location_mode)
VALUES(proof.id(900),proof.id(1),1,'DRAFT','Legacy object','Unchanged fixture','Izrada osnovnih modela','REMOTE');
INSERT INTO public.need_requirement_details(need_id,critical_conditions) VALUES(proof.id(900),ARRAY['Sačuvaj original']);
INSERT INTO public.need_sensitive(need_id,exact_address) VALUES(proof.id(900),'Private fixture address');
CREATE TABLE proof.legacy_fingerprint AS SELECT private.need_publication_fingerprint_snapshot(proof.id(900)) value;
-- The real predecessor prepares and caches READY without a handoff fact.
SELECT proof.task_input();
CREATE TABLE proof.legacy_task_review AS SELECT public.rpc_prepare_ai_task_review_taxonomy(proof.id(2)) value;
SELECT proof.require((SELECT value->>'classificationState'='READY' AND value->'canAccept'='true'::jsonb FROM proof.legacy_task_review),'ACTUAL_LEGACY_REVIEW_WAS_READY');
