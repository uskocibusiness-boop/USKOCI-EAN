DO $r04_pre$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r04.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_risk_triage_v1(text)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='49db026affac1bdde145622f12f4b47f'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"28782","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"taxonomy_risk_triage_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":false,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_label"],"proargtypes":["25"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_risk_triage_v1(text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='f9318f476e32a8233fbb07ccf5d22aeb'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"31025","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"taxonomy_review_candidate_projection_v2","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_purpose","p_services","p_service_modes","p_owner_account_id","p_conversation_id"],"proargtypes":["25","3802","3802","2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.needs_sync_taxonomy_category_trigger_fn()')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='3244c0fd784d722ece2e3ace8688bfe7'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM NULL
 AND to_jsonb(p)-'prosrc'='{"oid":"29147","proacl":null,"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"needs_sync_taxonomy_category_trigger_fn","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"2279","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.needs_sync_taxonomy_category_trigger_fn()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='757a754bd2310d07eb0587e1f8279b2b'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29415","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_commit_reviewed_batch_service","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_owner_account_id","p_request_key","p_purpose","p_source_review_id","p_plans"],"proargtypes":["2950","2950","25","2950","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='a209973be36f4fe57e8963eefdf7bceb'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29486","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_bind_reviewed_worker_service","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_owner_account_id","p_request_key","p_source_review_id","p_profile_id"],"proargtypes":["2950","2950","2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_remote_review_ready_v1(jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='284aa750a1a5c3e6367eaf10df1a410f'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"33217","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_remote_review_ready_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_review"],"proargtypes":["3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_remote_review_ready_v1(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='8bfb57431cd6a6fcff2e1e80fe8b5fbc'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29153","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"sync_worker_skills_to_taxonomy_capabilities","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_skills"],"proargtypes":["2950","1009"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='37d1e3c244ab0880d17afaac1b5e2f0f'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"33216","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_remote_only_activation_ready_v1","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account","p_skills"],"proargtypes":["2950","1009"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_remote_only_activation_ready_v1(uuid,text[])'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_get_worker_execution_modes(uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='d7770879ae958a1136c961537f22ad17'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"28953","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_get_worker_execution_modes","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_worker_profile_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_get_worker_execution_modes(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_ai_service_mode_context_v1(uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='58a9fc44a3caf09d14c2b13579afd882'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"31166","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_ai_service_mode_context_v1","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id"],"proargtypes":["2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_ai_service_mode_context_v1(uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='cdf0ad45a118c0bd30110f9b011fa8c7'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29395","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_worker_ai_review_taxonomy","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_expected_revision","p_activate"],"proargtypes":["2950","23","16"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 16 :consttypmod -1 :constcollid 0 :constlen 1 :constbyval true :constisnull false :location -1 :constvalue 1 [ 0 0 0 0 0 0 0 0 ]})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='54409302013cce5673fc1d493dd4eaac'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"30965","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_worker_ai_review_taxonomy_confirmed","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_expected_revision","p_activate","p_selected_modes"],"proargtypes":["2950","23","16","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='af9cd22b779037a8c9f7fad5c8543cfe'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29453","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_finalize_reviewed_batch_service","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_outbox_id","p_lease_token","p_error_code"],"proargtypes":["2950","2950","25"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='41747bdfdba0af1d941bf4fb91f1a887'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29454","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_reconcile_reviewed_outbox_service","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_limit"],"proargtypes":["23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 50 0 0 0 0 0 0 0 ]})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r04_pre$;
CREATE TEMP TABLE r04_semantic_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');
CREATE OR REPLACE FUNCTION private.taxonomy_risk_triage_v1(p_label text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_key text;
BEGIN
 v_key:=private.taxonomy_normalize_v1(p_label);
 -- Screening is not semantic classification or proof of safety. Apply the
 -- enabled server rules before ambiguity checks so broad or single-word
 -- labels cannot hide a regulated/prohibited meaning behind CLARIFY.
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='BLOCKED' AND v_key ~ pattern)
 THEN RETURN 'BLOCKED'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='REVIEW_REQUIRED' AND v_key ~ pattern)
 THEN RETURN 'REVIEW_REQUIRED'; END IF;
 IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 3 AND 120
    OR p_label ~ '[<>{}\\]' OR p_label ~ '[[:cntrl:]]'
    OR v_key IS NULL OR char_length(v_key)<3 OR v_key !~ '^[[:alnum:]]'
    OR v_key !~ '[[:alpha:]]' THEN
   RETURN 'NEEDS_CLARIFICATION';
 END IF;
 IF v_key ~ '(^|[[:space:]])(ostalo|drugo|razno|sve|svasta)($|[[:space:]])'
    OR v_key IN ('digitalni zanati','digitalne usluge','kucne usluge',
      'zanatske usluge','fizicki poslovi','rucni rad','bilo sta','klima','namestaj','nameštaj')
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 -- Natural noun phrases (3D stampa, casovi engleskog, setnja pasa) must not
 -- depend on the first word being in a small Serbian action-verb allowlist.
 -- Existing model semantic/safety review and owner-signed Save are still
 -- required. A candidate result grants no competence or catalog authority.
 RETURN 'LOW_RISK_CANDIDATE';
END
$function$;
CREATE OR REPLACE FUNCTION private.taxonomy_review_candidate_projection_v2(p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_exact jsonb;v_one jsonb;v_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_source text;v_version bigint;v_fingerprint text;v_item jsonb;v_proposal jsonb;
 v_service text;v_mode text;v_key text;v_parent uuid;v_parent_label text;
 v_category uuid;v_category_parent uuid;v_category_label text;v_plan jsonb;
 v_matches integer;v_path jsonb;v_label text;v_step integer;
 v_plans jsonb:='[]'::jsonb;v_visible jsonb:='[]'::jsonb;
 v_semantic jsonb:='[]'::jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_conversation_id IS NULL
   OR p_owner_account_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_OWNER_MISMATCH' USING errcode='42501';
 END IF;
 -- The existing projection validates the complete service/mode selection and
 -- returns the trusted exact/alias plan when the entire request already maps.
 v_exact:=private.taxonomy_review_exact_projection_v1(
   p_purpose,p_services,p_service_modes);
 IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
   WHERE singleton=true;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_fingerprint IS NULL THEN RETURN v_exact; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),
     'sha256'),'hex') INTO v_source
   FROM private.worker_ai_sessions s
   WHERE s.account_id=p_owner_account_id AND s.conversation_id=p_conversation_id;
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,
     'sha256'),'hex') INTO v_source
   FROM public.ai_conversations c
   WHERE c.account_id=p_owner_account_id AND c.id=p_conversation_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN RETURN v_exact; END IF;
 SELECT * INTO v_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
   WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
     AND h.conversation_id=p_conversation_id
     AND h.source_fingerprint=v_source AND h.catalog_version=v_version
   ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_exact; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
   v_mode:=v_item->>'mode';
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   SELECT x.value#>>'{}' INTO v_service FROM jsonb_array_elements(p_services) x(value)
     WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1;
   v_visible:=v_visible||jsonb_build_array(jsonb_build_object(
     'service',v_service,'mode',v_mode));
   SELECT count(*),(jsonb_agg(p.value))->0 INTO v_matches,v_proposal
     FROM jsonb_array_elements(v_hint.proposals) p(value)
     WHERE private.taxonomy_normalize_v1(p.value->>'service')=v_key
       AND p.value->>'mode'=v_mode;
   -- Preserve the exact source-bound handoff value even for canonical/alias reuse.
   -- No default shipping or profile-city inference is permitted.
   IF v_matches=1 AND v_proposal?'handoff' AND
      (v_mode<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(v_proposal->'handoff'))
   THEN RAISE EXCEPTION 'TAXONOMY_REVIEW_HANDOFF_INVALID' USING errcode='42501'; END IF;
   v_one:=private.taxonomy_review_exact_projection_v1(p_purpose,
     jsonb_build_array(v_service),jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode)));
   IF v_one->>'status'='READY' THEN
     v_plan:=v_one#>'{classificationCandidates,0}';
     -- The same worker skill cannot have two different leaf IDs across modes.
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
       WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
         AND x.value->>'categoryId' IS DISTINCT FROM v_plan->>'categoryId')
     THEN RETURN v_exact; END IF;
     IF v_matches=1 AND v_proposal?'handoff' THEN
       v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff');
     END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_one->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
   -- Model-proposed unregistered semantic reuse is verified against safety screening.
   -- Low-risk candidates form a valid plan; sensitive/regulated items enter semantic comparison.
   IF v_matches=1 AND v_proposal->>'action'='REUSE_EXISTING' THEN
     IF jsonb_typeof(v_proposal->'catalogVersion') IS DISTINCT FROM 'number'
       OR (v_proposal->>'catalogVersion')::bigint IS DISTINCT FROM v_version
       OR jsonb_typeof(v_proposal->'categoryId') IS DISTINCT FROM 'string'
       OR (v_proposal->>'categoryId') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId' IS DISTINCT FROM ''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IN ('BLOCKED','NEEDS_CLARIFICATION')
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     -- A canonical/alias spelling anywhere is not a new synonym; it must go
     -- through exact identity or the existing explicit EXTEND_MODE path.
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a
           WHERE a.category_id=c.id AND a.normalized_key=v_key)))
     THEN RETURN v_exact; END IF;
     v_category_label:=NULL;v_category_parent:=NULL;
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
         AND m.execution_scope=v_mode
       WHERE c.id=v_category AND c.state='ESTABLISHED'
         AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
           WHERE child.parent_id=c.id AND child.state='ESTABLISHED');
     IF v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IN ('BLOCKED','NEEDS_CLARIFICATION')
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_plans) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
     THEN RETURN v_exact; END IF;
     IF private.taxonomy_risk_triage_v1(v_service) = 'REVIEW_REQUIRED'
        OR private.taxonomy_risk_triage_v1(v_category_label) = 'REVIEW_REQUIRED' THEN
       v_semantic:=v_semantic||jsonb_build_array(jsonb_build_object(
         'service',v_service,'mode',v_mode,'categoryId',v_category,
         'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version));
     ELSE
       v_plan:=jsonb_build_object('action','REUSE_EXISTING','service',v_service,'mode',v_mode,
         'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version);
       IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
       v_plans:=v_plans||jsonb_build_array(v_plan);
     END IF;
     CONTINUE;
   END IF;
   IF v_matches=1 AND v_proposal->>'action'='EXTEND_MODE' THEN
     IF (v_proposal->>'catalogVersion')::bigint<>v_version
       OR v_proposal->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId'<>''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     SELECT count(DISTINCT c.id) INTO v_matches FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_key));
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c WHERE c.id=v_category AND c.state='ESTABLISHED'
       AND (v_matches=0 OR c.canonical_key=v_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=v_key));
     -- An explicit current-source ID may extend a semantic synonym too. A
     -- conflicting/ambiguous canonical or alias identity still cannot be replaced.
     IF v_matches NOT IN (0,1) OR v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR (v_matches=0 AND EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
         WHERE child.parent_id=v_category AND child.state='ESTABLISHED'))
       OR EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
         WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RETURN v_exact; END IF;
     -- Proposal only: admission still requires the exact signed Save below.
     v_plan:=jsonb_build_object('action','EXTEND_MODE','service',v_service,'mode',v_mode,
       'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
       'reason',v_proposal->>'reason','catalogVersion',v_version);
     IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_matches<>1 OR v_proposal->>'action' NOT IN ('CREATE_CHILD','CREATE_NEW_BRANCH')
      OR v_proposal->>'categoryId'<>''
      OR (v_proposal->>'catalogVersion')::bigint<>v_version
      OR (v_proposal->>'action'='CREATE_CHILD' AND (v_proposal->>'parentId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      OR (v_proposal->>'action'='CREATE_NEW_BRANCH' AND v_proposal->>'parentId'<>'')
   THEN RETURN v_exact; END IF;
   v_path:=v_proposal->'proposedPath';
   IF jsonb_typeof(v_path)<>'array' OR jsonb_array_length(v_path)<1
      OR private.taxonomy_normalize_v1(v_path->>(jsonb_array_length(v_path)-1))<>v_key
      OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
   THEN RETURN v_exact; END IF;
   -- Store the exact owner-reviewed wording as the leaf. The model may have
   -- used another Serbian script, but it cannot change the visible meaning.
   v_path:=jsonb_set(v_path,ARRAY[(jsonb_array_length(v_path)-1)::text],
     to_jsonb(v_service),false);
   IF v_proposal->>'action'='CREATE_CHILD' THEN
     v_parent:=(v_proposal->>'parentId')::uuid;
     SELECT c.label INTO v_parent_label FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.state='ESTABLISHED';
     IF v_parent_label IS NULL OR NOT private.taxonomy_category_path_valid_v1(v_parent)
     THEN RETURN v_exact; END IF;
   ELSE
     v_parent:=NULL;v_parent_label:=NULL;
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.canonical_key=private.taxonomy_normalize_v1(v_path->>0))
     THEN RETURN v_exact; END IF;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_path)-1 LOOP
     v_label:=btrim(v_path->>v_step);
     IF jsonb_typeof(v_path->v_step) IS DISTINCT FROM 'string'
        OR char_length(v_label) NOT BETWEEN 3 AND 120
        OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]'
        OR private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
        OR (v_step=jsonb_array_length(v_path)-1 AND
            private.taxonomy_risk_triage_v1(v_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE')
        OR char_length(private.taxonomy_normalize_v1(v_label)) NOT BETWEEN 3 AND 160
        OR private.taxonomy_normalize_v1(v_label) !~ '[[:alpha:]]'
        OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=private.taxonomy_normalize_v1(v_label))
     THEN RETURN v_exact; END IF;
   END LOOP;
   v_plan:=jsonb_build_object(
     'action',v_proposal->>'action','service',v_service,'mode',v_mode,
     'parentId',v_parent,'parentLabel',v_parent_label,'path',v_path,
     'reason',v_proposal->>'reason','catalogVersion',v_version);
   IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
   v_plans:=v_plans||jsonb_build_array(v_plan);
 END LOOP;
 -- A deep path is bounded by the writer's byte budget, not an arbitrary
 -- number of levels. Never display READY for a batch the writer cannot accept.
 IF pg_column_size(v_plans)>16000 THEN RETURN v_exact; END IF;
 -- The batch writer checks the same fingerprint under a catalog row lock.
 -- Here it protects the owner from accepting a mixed-version review.
 IF v_version IS DISTINCT FROM (SELECT catalog_version
      FROM private.work_taxonomy_control WHERE singleton=true)
    OR v_fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 THEN RETURN v_exact; END IF;
 IF v_semantic<>'[]'::jsonb THEN
   -- Never present a sensitive semantic comparison as accepted. The user must compare and
   -- expressly confirm the exact meaning in a separately signed review.
   RETURN jsonb_build_object('status','REVIEW_REQUIRED',
     'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
     'semanticReviewCandidates',v_semantic,'visibleServices',v_visible,
     'classificationCatalogVersion',v_version,
     'classificationCatalogFingerprint',v_fingerprint,
     'classificationAuthority','NONE','capabilityAuthority','NONE',
     'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_plans,
   'reviewedServiceModes',CASE WHEN p_purpose='WORKER_CAPABILITY'
     THEN v_visible ELSE '[]'::jsonb END,
   'visibleServices',v_visible,'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$;
CREATE OR REPLACE FUNCTION private.needs_sync_taxonomy_category_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
  v_leaf text;
BEGIN
  IF NEW.category IS NOT NULL AND btrim(NEW.category) <> '' THEN
    SELECT id INTO NEW.category_id
    FROM private.work_taxonomy_categories
    WHERE canonical_key = private.taxonomy_normalize_v1(NEW.category)
      AND state <> 'RETIRED'
    ORDER BY (parent_id IS NOT NULL) DESC, created_at ASC
    LIMIT 1;

    IF NEW.category_id IS NULL THEN
      SELECT c.id INTO NEW.category_id
      FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_aliases a ON a.category_id = c.id
      WHERE a.normalized_key = private.taxonomy_normalize_v1(NEW.category)
        AND c.state <> 'RETIRED'
      ORDER BY (c.parent_id IS NOT NULL) DESC, c.created_at ASC
      LIMIT 1;
    END IF;

    IF NEW.category_id IS NULL AND NEW.category LIKE '%/%' THEN
      v_leaf := btrim(reverse(split_part(reverse(NEW.category), '/', 1)));
      SELECT id INTO NEW.category_id
      FROM private.work_taxonomy_categories
      WHERE canonical_key = private.taxonomy_normalize_v1(v_leaf)
        AND state <> 'RETIRED'
      ORDER BY (parent_id IS NOT NULL) DESC, created_at ASC
      LIMIT 1;

      IF NEW.category_id IS NULL THEN
        SELECT c.id INTO NEW.category_id
        FROM private.work_taxonomy_categories c
        JOIN private.work_taxonomy_aliases a ON a.category_id = c.id
        WHERE a.normalized_key = private.taxonomy_normalize_v1(v_leaf)
          AND c.state <> 'RETIRED'
        ORDER BY (c.parent_id IS NOT NULL) DESC, c.created_at ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_reviewed_batch_service(p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plans jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_id uuid;v_old private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review jsonb;v_review_digest text;v_computed_digest text;
 v_expiry timestamptz;v_saved_at timestamptz;v_review_fingerprint text;
 v_version bigint;v_review_version bigint;v_fingerprint text;v_plans_digest text;
 v_catalog_changed boolean;
 v_plan jsonb;v_service text;v_mode text;v_action text;
 v_parent uuid;v_category uuid;v_canonical uuid;v_current_parent uuid;
 v_label text;v_key text;v_ref text;v_count integer;v_created integer:=0;
 v_index integer;v_step integer;v_duplicate text;
 v_seen_services text[]:=ARRAY[]::text[];
 v_seen_targets text[]:=ARRAY[]::text[];
 v_created_ids uuid[]:=ARRAY[]::uuid[];
 v_bound boolean;v_visible_mode boolean;v_found boolean;
 v_items jsonb:='[]'::jsonb;v_result jsonb;
BEGIN
 PERFORM private.closure_assert_open(p_owner_account_id);
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_plans)<>'array'
    OR (p_purpose='WORKER_CAPABILITY' AND jsonb_array_length(p_plans) NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND jsonb_array_length(p_plans)<>1)
    OR pg_column_size(p_plans)>16000
 THEN RAISE EXCEPTION 'BATCH_INPUT_INVALID' USING errcode='22023'; END IF;
 v_plans_digest:=encode(extensions.digest(convert_to(p_plans::text,'UTF8'),'sha256'),'hex');

 SELECT * INTO v_old FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_old.purpose<>p_purpose OR v_old.source_review_id<>p_source_review_id
    OR v_old.plans_digest<>v_plans_digest OR v_old.plans IS DISTINCT FROM p_plans
  THEN RAISE EXCEPTION 'BATCH_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_old.result;
 END IF;

 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope,w.envelope->>'displayedContentDigest',w.expires_at,
   encode(extensions.digest(((w.envelope-'displayedContentDigest')
     ||jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.worker_ai_reviews w
   WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id FOR SHARE;
  SELECT min(s.created_at) INTO v_saved_at FROM private.worker_ai_saves s
    WHERE s.review_id=p_source_review_id AND s.account_id=p_owner_account_id
      AND s.client_request_id=p_request_key;
  v_bound:=v_saved_at IS NOT NULL;
 ELSE
  SELECT t.envelope,t.envelope->>'displayedContentDigest',t.expires_at,
   encode(extensions.digest(jsonb_build_object('envelope',
     t.envelope-'displayedContentDigest','policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.ai_task_reviews t
   WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id FOR SHARE;
  SELECT min(c.created_at) INTO v_saved_at FROM private.ai_task_review_commands c
    WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
      AND c.client_request_id=p_request_key
      AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED');
  v_bound:=v_saved_at IS NOT NULL;
 END IF;
 IF NOT coalesce(v_bound,false) THEN
  RAISE EXCEPTION 'BATCH_EXISTING_USER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 -- Approval must have happened WHILE the review was valid.
 -- Outbox retries may run later; expiring the review AFTER a successful human
 -- Save/Accept must not silently discard a confirmed service.
 IF v_review IS NULL OR v_review->'canAccept' IS DISTINCT FROM 'true'::jsonb
    OR v_saved_at>v_expiry OR v_review_digest IS NULL
    OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_computed_digest IS DISTINCT FROM v_review_digest
    OR v_review->'classificationCandidates' IS DISTINCT FROM p_plans
 THEN RAISE EXCEPTION 'BATCH_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_review_fingerprint:=v_review->>'classificationCatalogFingerprint';
 IF v_review_fingerprint IS NULL OR
    v_review_fingerprint !~ '^[0-9a-f]{32}$' THEN
   RAISE EXCEPTION 'BATCH_CATALOG_FINGERPRINT_REQUIRED' USING errcode='42501'; END IF;

 -- Single serialized admission pass: intermediate catalog bumps do NOT make
 -- later items in the SAME reviewed batch stale.
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
  WHERE singleton FOR UPDATE;
 IF v_version IS NULL THEN RAISE EXCEPTION 'BATCH_CATALOG_MISSING'; END IF;
 -- The immutable signed plan keeps its original version. A successful Save
 -- remains authority after an unrelated catalog write, but every identity,
 -- mode and path below must still validate against the locked CURRENT catalog.
 -- Never rewrite the review, its fingerprint or the reviewed semantic plan.
 IF jsonb_typeof(v_review->'classificationCatalogVersion') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'BATCH_REVIEW_CATALOG_VERSION_INVALID' USING errcode='42501'; END IF;
 v_review_version:=(v_review->>'classificationCatalogVersion')::bigint;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_review_version<1 OR v_version<v_review_version OR v_fingerprint IS NULL THEN
   RAISE EXCEPTION 'BATCH_STALE_CATALOG' USING errcode='PT409'; END IF;
 v_catalog_changed:=v_fingerprint IS DISTINCT FROM v_review_fingerprint
   OR v_version IS DISTINCT FROM v_review_version;
 FOR v_index IN 0..jsonb_array_length(p_plans)-1 LOOP
  v_plan:=p_plans->v_index;
  IF jsonb_typeof(v_plan)<>'object'
     OR v_plan ?& array['action','service','mode','catalogVersion','reason'] IS NOT TRUE
     OR jsonb_typeof(v_plan->'catalogVersion')<>'number'
     OR (v_plan->>'catalogVersion')::bigint<> (v_review->>'classificationCatalogVersion')::bigint
     OR (v_plan->>'catalogVersion')::bigint<>v_review_version
     OR jsonb_typeof(v_plan->'reason')<>'string'
     OR char_length(btrim(v_plan->>'reason')) NOT BETWEEN 10 AND 1000
  THEN RAISE EXCEPTION 'BATCH_INVALID_OR_STALE_PLAN' USING errcode='22023'; END IF;
  v_service:=btrim(v_plan->>'service');
  v_mode:=v_plan->>'mode';
  v_action:=v_plan->>'action';
  IF char_length(v_service) NOT BETWEEN 3 AND 120 OR
     v_mode NOT IN ('ON_SITE','REMOTE') OR
     v_action NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
  THEN RAISE EXCEPTION 'BATCH_SCOPE_OR_SERVICE_INVALID' USING errcode='22023'; END IF;
  IF v_plan?'handoff' AND (v_mode<>'REMOTE'
     OR NOT private.taxonomy_handoff_valid_v1(v_plan->'handoff')) THEN
    RAISE EXCEPTION 'BATCH_HANDOFF_INVALID' USING errcode='22023'; END IF;
  v_key:=private.taxonomy_normalize_v1(v_service);
  v_duplicate:=v_key||'|'||v_mode;
  IF v_duplicate=ANY(v_seen_services) THEN
   RAISE EXCEPTION 'BATCH_DUPLICATE_SERVICE' USING errcode='22023'; END IF;
  v_seen_services:=array_append(v_seen_services,v_duplicate);

  -- Require the service to be a HUMAN-REVIEWED meaning in the existing
  -- profile/need content. A model may not add undeclared worker skills.
  IF p_purpose='WORKER_CAPABILITY' THEN
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements_text(
       coalesce(v_review#>'{profile,skills}','[]'::jsonb)) x(service)
       WHERE private.taxonomy_normalize_v1(x.service)=v_key);
    v_visible_mode:=EXISTS(SELECT 1 FROM jsonb_array_elements(
      coalesce(v_review->'reviewedServiceModes','[]'::jsonb)) x(item)
       WHERE private.taxonomy_normalize_v1(x.item->>'service')=v_key
         AND x.item->>'mode'=v_mode);
  ELSE
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements(
       coalesce(v_review->'publicProjection','[]'::jsonb)) x(fact)
       WHERE x.fact->>'key'='need.category'
         AND private.taxonomy_normalize_v1(x.fact->>'value')=v_key);
    v_visible_mode:=(CASE v_review#>>'{location,geography,mode}'
      WHEN 'REMOTE' THEN 'REMOTE'
      WHEN 'STATIONARY' THEN 'ON_SITE'
      WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
      WHEN 'MULTI_STOP' THEN 'ON_SITE'
      WHEN 'AREA_BASED' THEN 'ON_SITE'
      ELSE 'UNCONFIRMED' END)=v_mode;
  END IF;
  IF NOT coalesce(v_found,false) OR NOT coalesce(v_visible_mode,false)
   THEN RAISE EXCEPTION 'BATCH_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;

  IF v_action IN ('REUSE_EXISTING','EXTEND_MODE') THEN
   IF (v_plan->>'categoryId') IS NULL OR
      v_plan ? 'parentId' OR v_plan ? 'path' THEN
    RAISE EXCEPTION 'BATCH_REUSE_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    WHERE c.id=v_category AND c.state='ESTABLISHED'
      AND (v_action='EXTEND_MODE' OR EXISTS(
        SELECT 1 FROM private.work_taxonomy_category_modes m
        WHERE m.category_id=c.id AND m.execution_scope=v_mode));
   IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CATEGORY_OR_MODE_MISSING' USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;

   SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_count,v_canonical
     FROM private.work_taxonomy_categories c
     WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS (
       SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=v_key));

   IF v_action = 'REUSE_EXISTING' AND (v_plan ? 'categoryLabel' OR v_plan ? 'categoryParentId') THEN
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id = v_category
         AND (NOT v_plan ? 'categoryLabel' OR c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel')
         AND (NOT v_plan ? 'categoryParentId' OR coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
         AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
           WHERE child.parent_id = c.id AND child.state = 'ESTABLISHED')
     ) THEN
       RAISE EXCEPTION 'BATCH_CATEGORY_IDENTITY_CHANGED' USING errcode='PT409';
     END IF;
   END IF;

   IF v_count = 1 AND v_canonical = v_category THEN
     NULL;
   ELSIF v_action IN ('REUSE_EXISTING', 'EXTEND_MODE') AND v_count = 0 THEN
     -- Human-reviewed semantic synonym reuse or mode extension of an established leaf.
     -- Verified through safety triage and valid category path.
     -- Logged in audit as EXISTING_REUSED without creating a global alias.
     IF jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
         WHERE c.id = v_category
           AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
           AND (NOT v_plan ? 'categoryParentId' OR coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
           AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
             WHERE child.parent_id = c.id AND child.state = 'ESTABLISHED')
       ) THEN
       RAISE EXCEPTION 'BATCH_CATEGORY_IDENTITY_CHANGED' USING errcode='PT409';
     END IF;
     IF private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR private.taxonomy_risk_triage_v1(v_plan->>'categoryLabel') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category) THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_SAFETY_REVIEW_REQUIRED' USING errcode='42501';
     END IF;
     IF v_action = 'REUSE_EXISTING' THEN
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('EXISTING_REUSED',v_category,v_key,v_version,'REVIEWED_BATCH:'||p_request_key::text);
     END IF;
   ELSE
     RAISE EXCEPTION 'BATCH_SEMANTIC_IDENTITY_MISMATCH'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '42501' END;
   END IF;

   IF v_action='EXTEND_MODE' THEN
     IF jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
       OR NOT(v_plan?'categoryParentId')
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
         WHERE c.id=v_category AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
           AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
       OR NOT private.taxonomy_category_path_valid_v1(v_category) THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
     -- SQL screens risk and signed identity; it does not prove physical
     -- feasibility. The captured AI reason + visible owner review are retained.
     IF private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR private.taxonomy_risk_triage_v1(v_plan->>'categoryLabel') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       UPDATE private.work_taxonomy_control
         SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
         WHERE singleton RETURNING catalog_version INTO v_version;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_MODE_EXTENSION_V1');
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('CORRECTED',v_category,private.taxonomy_normalize_v1(v_plan->>'categoryLabel'),v_version,
           'REVIEWED_MODE_EXTENSION_V1:'||p_request_key::text);
     ELSIF NOT v_catalog_changed THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_MODE_ALREADY_PRESENT' USING errcode='22023';
     END IF;
   END IF;
  ELSE
   IF v_plan ? 'categoryId' OR jsonb_typeof(v_plan->'path')<>'array'
      OR jsonb_array_length(v_plan->'path')<1
      OR (v_action='CREATE_CHILD' AND (v_plan->>'parentId') IS NULL)
      OR (v_action='CREATE_NEW_BRANCH' AND
          (v_plan->'parentId' IS DISTINCT FROM 'null'::jsonb
           OR v_plan->'parentLabel' IS DISTINCT FROM 'null'::jsonb)) THEN
    RAISE EXCEPTION 'BATCH_CHILD_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   -- A newly created leaf must be exactly the reviewed human service meaning.
   IF private.taxonomy_normalize_v1(v_plan->'path'->>(jsonb_array_length(v_plan->'path')-1))
       <>private.taxonomy_normalize_v1(v_service) THEN
      RAISE EXCEPTION 'BATCH_SERVICE_LEAF_MISMATCH' USING errcode='42501'; END IF;
   IF v_action='CREATE_CHILD' THEN
     v_parent:=(v_plan->>'parentId')::uuid;
     PERFORM 1 FROM private.work_taxonomy_categories c
      WHERE c.id=v_parent AND c.state='ESTABLISHED'
        AND private.taxonomy_category_path_valid_v1(c.id);
     IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_PARENT_OR_MODE_MISSING'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
     -- The signed parent label anchors the reviewed organization as well as UUID.
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.label IS NOT DISTINCT FROM v_plan->>'parentLabel') THEN
       RAISE EXCEPTION 'BATCH_PARENT_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
   ELSE
     v_parent:=NULL;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_plan->'path')-1 LOOP
    v_label:=btrim(v_plan->'path'->>v_step);
    IF jsonb_typeof(v_plan->'path'->v_step) IS DISTINCT FROM 'string' OR
       char_length(v_label) NOT BETWEEN 3 AND 120 OR
       v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' OR
       private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
    THEN RAISE EXCEPTION 'BATCH_UNSAFE_CATEGORY' USING errcode='42501'; END IF;
    IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       private.taxonomy_risk_triage_v1(v_label)<>'LOW_RISK_CANDIDATE'
    THEN RAISE EXCEPTION 'BATCH_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
    v_key:=private.taxonomy_normalize_v1(v_label);
    IF char_length(v_key) NOT BETWEEN 3 AND 160 OR v_key !~ '[[:alpha:]]' OR
       EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=v_key)
    THEN RAISE EXCEPTION 'BATCH_ALIAS_OR_KEY_COLLISION'
      USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
    v_category:=NULL;v_current_parent:=NULL;
    SELECT c.id,c.parent_id INTO v_category,v_current_parent
      FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
      FOR UPDATE;
    IF FOUND THEN
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_category AND c.state='ESTABLISHED') THEN
       RAISE EXCEPTION 'BATCH_PATH_CATEGORY_RETIRED' USING errcode='PT409'; END IF;
     IF v_current_parent IS DISTINCT FROM v_parent THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
     END IF;
     IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       -- Only nodes born in THIS atomic, owner-signed batch may receive a
       -- second explicitly reviewed scope. Older catalog entries remain closed.
       IF NOT (v_category=ANY(v_created_ids)) THEN
         RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
       END IF;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     END IF;
    ELSE
     UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
     INSERT INTO private.work_taxonomy_categories
       (canonical_key,label,parent_id,state,source,catalog_version)
     VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
      RETURNING id INTO v_category;
     INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
      VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
      VALUES('AUTO_CREATED',v_category,v_key,v_version,
        'REVIEWED_BATCH_V1:'||p_request_key::text);
     v_created:=v_created+1;
     v_created_ids:=array_append(v_created_ids,v_category);
    END IF;
    v_parent:=v_category;
   END LOOP;
  END IF;
  v_ref:=v_category::text||'|'||v_mode;
  IF v_ref=ANY(v_seen_targets) THEN
    RAISE EXCEPTION 'BATCH_DUPLICATE_CANONICAL_ID' USING errcode='22023'; END IF;
  v_seen_targets:=array_append(v_seen_targets,v_ref);
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'service',v_service,'mode',v_mode,'categoryId',v_category));
 END LOOP;
 -- All category changes and ONE receipt share the same DB transaction.
 v_result:=jsonb_build_object('status','COMMITTED','items',v_items,
  'createdCount',v_created,'catalogVersion',v_version,
  'capabilityAuthority','NONE','needRevisionAuthority','NONE',
  'notificationAuthority','NONE','requiresBinding',true);
 INSERT INTO private.work_taxonomy_review_batches_v1
 (owner_account_id,request_key,purpose,source_review_id,review_digest,
  plans_digest,plans,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,
  v_review_digest,v_plans_digest,p_plans,v_version,v_result);
 RETURN v_result;
END $function$;
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.worker_ai_reviews%ROWTYPE;
 v_save private.worker_ai_saves%ROWTYPE;
 v_profile public.app_profiles%ROWTYPE;
 v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
 v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
 v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
 v_result jsonb;v_count integer:=0;v_skills jsonb;
BEGIN
 PERFORM private.closure_assert_open(p_owner_account_id);
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL
   OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 -- Replays are read-only and bound to the very same worker/review/request.
 SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
  THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
   AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
  FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.plans)<>'array'
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
   OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
 THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
 SELECT * INTO v_review FROM private.worker_ai_reviews
  WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
   OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
       <>jsonb_array_length(v_batch.plans)
   OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
 THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_digest:=encode(extensions.digest(
  ((v_review.envelope-'displayedContentDigest')
    ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
 IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
   RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
 SELECT * INTO v_save FROM private.worker_ai_saves
  WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
    AND client_request_id=p_request_key FOR SHARE;
 IF NOT FOUND OR v_save.created_at>v_review.expires_at
   OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
   OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
   OR v_save.receipt->>'profileStatus'<>'ACTIVE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
 -- A delayed outbox command from an OLD Save must never re-enable modes
 -- superseded by a newer user-confirmed worker review for this same profile.
 IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
   WHERE newer.account_id=p_owner_account_id
     AND newer.created_at>v_save.created_at
     AND newer.receipt->>'profileId'=p_profile_id::text)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
 -- Hold current worker profile throughout the transaction. Reject any edit
 -- after the reviewed Save, even if the new skill text happens to be identical.
 SELECT * INTO v_profile FROM public.app_profiles
  WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
  FOR UPDATE;
 v_skills:=v_review.envelope#>'{profile,skills}';
 IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
   OR v_profile.updated_at>v_save.created_at
   OR jsonb_typeof(v_skills)<>'array'
   OR to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills
 THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
 -- Make every scope and category EXACT. A related branch never certifies ability.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_plan:=v_batch.plans->v_count;
   v_item:=v_batch.result->'items'->v_count;
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   v_mode:=v_item->>'mode';
   IF v_plan->>'mode' IS DISTINCT FROM v_mode
     OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
     OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
     OR v_mode NOT IN ('ON_SITE','REMOTE')
     OR jsonb_typeof(v_item->'categoryId')<>'string'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
       WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        v_review.envelope->'reviewedServiceModes') m(value)
       WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
         AND m.value->>'mode'=v_mode)
     OR v_key||'|'||v_mode=ANY(v_seen)
   THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
   v_seen:=array_append(v_seen,v_key||'|'||v_mode);
   v_category:=(v_item->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND cm.execution_scope=v_mode
        AND (
          c.canonical_key=v_key OR EXISTS(
            SELECT 1 FROM private.work_taxonomy_aliases a
            WHERE a.category_id=c.id AND a.normalized_key=v_key)
          OR (
            -- Signed category witness: not model authority, but the same
            -- human-reviewed COMMITTED plan and Save already checked above.
            v_plan->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
            AND v_plan ? 'categoryLabel'
            AND v_plan ? 'categoryParentId'
          )
        )
        AND (
          -- Metadata supplied by an exact/alias or semantic plan is binding.
          -- Do not bypass a rename merely because canonical_key stayed intact.
          NOT (v_plan ? 'categoryLabel' OR v_plan ? 'categoryParentId')
          OR (
            v_plan->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
            AND v_plan ? 'categoryLabel'
            AND v_plan ? 'categoryParentId'
            AND jsonb_typeof(v_plan->'categoryLabel')='string'
            AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
            AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
                IS NOT DISTINCT FROM v_plan->'categoryParentId'
            AND NOT EXISTS(
              SELECT 1 FROM private.work_taxonomy_categories child
              WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
            AND private.taxonomy_category_path_valid_v1(c.id)
          )
        ))
   THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
   -- A past withdrawal (excluded=true) is NOT permanent: the owner may
   -- deliberately offer this service again in a NEW signed Save. ONLY this
   -- binder may restore it, with zero inherited related-offer consent.
   IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
 END LOOP;
 -- A recent explicit global-mode change must not be overwritten by a delayed
 -- binder from an older review. All updates below are ONE DB transaction.
 IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
 IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
 IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
 INSERT INTO private.worker_execution_mode_choices(
   worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
   statement_timestamp(),statement_timestamp())
 ON CONFLICT(worker_profile_id) DO UPDATE
   SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
       confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
 -- Catalog identities and per-service scope are granted only AFTER the
 -- signed review, saved receipt and current profile all passed.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_item:=v_batch.result->'items'->v_count;
   v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
   INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
   VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
   ON CONFLICT(worker_account_id,category_id) DO UPDATE
     SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
         excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
   INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
     worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
     confirmed_at,active,handoff)
   VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
     statement_timestamp(),true,v_batch.plans->v_count->'handoff')
   ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
    SET source_review_id=excluded.source_review_id,
        source_request_key=excluded.source_request_key,
        confirmed_at=statement_timestamp(),active=true,handoff=excluded.handoff;
 END LOOP;
 -- The CURRENT complete review replaces old per-service permission. Retain
 -- history, but deactivate obsolete modes; never manufacture a related opt-in.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 old
 SET active=false
 WHERE old.worker_account_id=p_owner_account_id AND old.active
   AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
     WHERE (item.value->>'categoryId')::uuid=old.category_id
       AND item.value->>'mode'=old.execution_scope);
 v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
   'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
   'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
   'notificationAuthority','NONE','relatedOfferAuthority','NONE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1(
   owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
   v_batch.catalog_version,v_result);
 RETURN v_result;
END $function$;
CREATE OR REPLACE FUNCTION private.worker_remote_review_ready_v1(p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_exact jsonb;v_plans jsonb;v_plan jsonb;v_service text;v_seen text[]:=ARRAY[]::text[];v_n integer;v_category uuid;v_projection jsonb;v_one jsonb;v_saved_services jsonb;v_profile_id uuid;v_owned uuid;v_source text;v_hints jsonb;
BEGIN
 IF p_review->>'classificationState' IS DISTINCT FROM 'READY'
 OR jsonb_typeof(p_review#>'{profile,skills}') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'reviewedServiceModes') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'classificationCandidates') IS DISTINCT FROM 'array'
 THEN RETURN false; END IF;
 IF jsonb_array_length(p_review->'reviewedServiceModes') NOT BETWEEN 1 AND 12
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
   WHERE m->>'mode' IS DISTINCT FROM 'REMOTE')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p?'handoff' AND private.taxonomy_handoff_valid_v1(p->'handoff') IS NOT TRUE)
 THEN RETURN false; END IF;

 -- New catalog work is activation consent only, never an existing capability.
 -- Reuse the exact prepare validator (including source-bound hints and handoff)
 -- instead of introducing a second action/path parser. The Save activation
 -- owner separately checks account/session/revision/digest/expiry atomically.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IN ('CREATE_CHILD','CREATE_NEW_BRANCH','EXTEND_MODE')) THEN
   IF auth.uid() IS NULL OR p_review->>'accountId' IS DISTINCT FROM auth.uid()::text
     OR jsonb_typeof(p_review->'conversationId') IS DISTINCT FROM 'string'
     OR p_review->>'conversationId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   THEN RETURN false; END IF;
   v_projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes',auth.uid(),
     (p_review->>'conversationId')::uuid);
   -- Activation follows this transaction's own profile writes, so the old
   -- pre-Save source-hash context cannot be re-read here. Preserve only a
   -- separately proven active Save/batch/binding, never supplied JSON alone.
   v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
   IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION')
      OR p_review->'classificationCatalogVersion' IS DISTINCT FROM
        (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
      OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
      OR jsonb_array_length(p_review->'classificationCandidates')<>jsonb_array_length(p_review->'reviewedServiceModes')
   THEN RETURN false; END IF;
   IF v_projection->>'status'='READY'
     AND p_review->'classificationCandidates'=v_projection->'classificationCandidates'
     AND p_review->'reviewedServiceModes'=v_projection->'reviewedServiceModes'
   THEN RETURN true; END IF;
   v_owned:=auth.uid();
   SELECT p.id INTO v_profile_id FROM public.app_profiles p
     WHERE p.account_id=v_owned AND p.kind='WORKER' AND p.id::text=p_review->>'profileId';
   IF v_profile_id IS NULL THEN RETURN false; END IF;
   SELECT encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
     INTO v_source FROM private.worker_ai_sessions s WHERE s.account_id=v_owned
       AND s.conversation_id=(p_review->>'conversationId')::uuid;
   SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=v_owned
       AND h.conversation_id=(p_review->>'conversationId')::uuid AND h.source_fingerprint=v_source
       AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(p_review#>'{profile,skills}') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=v_owned AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=v_owned AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=v_owned
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=v_owned::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=v_owned::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=v_owned AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=v_owned
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=v_owned
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=v_owned
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=v_owned
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;


   FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
     v_service:=v_plan->>'service';
     IF (SELECT count(*) FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
       WHERE m->>'service'=v_service AND m->>'mode'=v_plan->>'mode')<>1
       OR v_service=ANY(v_seen) THEN RETURN false; END IF;
     v_seen:=array_append(v_seen,v_service);
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',jsonb_build_array(v_service),
       jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),v_owned,(p_review->>'conversationId')::uuid);
     IF v_one->>'status'='READY' AND v_one#>'{classificationCandidates,0}'=v_plan THEN CONTINUE; END IF;
     -- No current proposal may be overridden, even when it is invalid or
     -- explicitly clears a previous mode/handoff. Only missing old hints reuse.
     IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
         WHERE private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_service))
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services) saved
         WHERE saved->>'service'=v_service AND saved->>'mode'=v_plan->>'mode'
           AND saved->>'categoryId'=v_plan->>'categoryId'
           AND saved->'handoff' IS NOT DISTINCT FROM v_plan->'handoff')
       OR private.worker_remote_review_ready_v1(p_review||jsonb_build_object(
         'profile',jsonb_build_object('skills',jsonb_build_array(v_service)),
         'reviewedServiceModes',jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),
         'classificationCandidates',jsonb_build_array(v_plan))) IS NOT TRUE
     THEN RETURN false; END IF;
   END LOOP;
   RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IS DISTINCT FROM 'REUSE_EXISTING') THEN RETURN false; END IF;
 -- Only today's complete exact canonical/registered-alias set. User-selected
 -- modes never admit a future category or extend an existing category's scope.
 v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
   p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
 SELECT jsonb_agg(p.value-'handoff' ORDER BY p.ord) INTO v_plans
 FROM jsonb_array_elements(p_review->'classificationCandidates') WITH ORDINALITY p(value,ord);
 IF v_exact->>'status'='READY'
   AND p_review->'classificationCatalogVersion'=v_exact->'classificationCatalogVersion'
   AND p_review->'classificationCatalogFingerprint'=v_exact->'classificationCatalogFingerprint'
   AND p_review->'reviewedServiceModes'=v_exact->'reviewedServiceModes'
   AND v_plans=v_exact->'classificationCandidates' THEN RETURN true; END IF;

 -- No additional AI authority: complete current signed READY only.
 -- The caller validates the immutable owner/revision/source/digest/expiry
 -- and this helper rechecks the existing exact leaf ID, REMOTE scope, witness,
 -- consented service set and catalog fingerprint. No new/extended category
 -- or global alias is approved here.
 IF p_review->'classificationCatalogVersion' IS DISTINCT FROM
     (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
 OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 OR jsonb_array_length(p_review->'classificationCandidates')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 OR jsonb_array_length(p_review->'reviewedServiceModes')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 THEN RETURN false; END IF;
 FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
   IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
     OR v_plan->>'mode' IS DISTINCT FROM 'REMOTE'
     OR jsonb_typeof(v_plan->'service') IS DISTINCT FROM 'string'
     OR length(btrim(v_plan->>'service')) NOT BETWEEN 3 AND 120
     OR v_plan->>'categoryId' IS NULL
     OR char_length(v_plan->>'categoryId') IS DISTINCT FROM 36
     OR v_plan->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
     OR NOT (v_plan ? 'categoryLabel' AND v_plan ? 'categoryParentId')
     OR jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
     OR (v_plan ? 'handoff' AND private.taxonomy_handoff_valid_v1(v_plan->'handoff') IS NOT TRUE)
   THEN RETURN false; END IF;
   v_service:=private.taxonomy_normalize_v1(v_plan->>'service');
   IF v_service IS NULL OR v_service=ANY(v_seen)
      OR private.taxonomy_risk_triage_v1(v_plan->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements_text(p_review#>'{profile,skills}') s(value)
     WHERE private.taxonomy_normalize_v1(s.value)=v_service;
   IF v_n<>1 THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements(p_review->'reviewedServiceModes') m(value)
     WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_service AND m.value->>'mode'='REMOTE';
   IF v_n<>1 THEN RETURN false; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope='REMOTE'
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId'
        AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
          WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
        AND private.taxonomy_category_path_valid_v1(c.id))
   THEN RETURN false; END IF;
   v_seen:=array_append(v_seen,v_service);
 END LOOP;
 RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
END; $function$;
CREATE OR REPLACE FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(p_account_id uuid, p_skills text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_saved_skills text[];v_profile_id uuid;
 v_skill text;v_norm text;v_cat_id uuid;v_match_count integer;
 v_retained_ids uuid[]:=ARRAY[]::uuid[];
 v_unmapped_labels text[]:=ARRAY[]::text[];
 v_revoked integer:=0;v_revoked_acceptances integer:=0;
BEGIN
 IF private.closure_taxonomy_profile_erasing_v1(p_account_id) THEN
 RETURN jsonb_build_object('success',true,'workerAccountId',p_account_id,'assignedCount',0,'assignedCategoryIds','[]'::jsonb,
 'retainedExistingCategoryCount',0,'retainedExistingCategoryIds','[]'::jsonb,'revokedCount',0,'revokedRelatedAcceptances',0,
 'unmappedSkillLabels','[]'::jsonb,'openNeedsRequeued',0,'newCapabilityAuthority','NONE','notificationAuthority','NONE');END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_account_id IS NULL THEN
   RAISE EXCEPTION 'WORKER_ACCOUNT_REQUIRED' USING errcode='22023';
 END IF;
 SELECT COALESCE(p.skills,ARRAY[]::text[]),p.id INTO v_saved_skills,v_profile_id
 FROM public.app_profiles p
 WHERE p.account_id=p_account_id AND p.kind='WORKER'
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_REQUIRED' USING errcode='55000'; END IF;
 IF v_saved_skills IS DISTINCT FROM COALESCE(p_skills,ARRAY[]::text[]) THEN
   RAISE EXCEPTION 'TAXONOMY_PROFILE_SKILLS_MISMATCH' USING errcode='22023';
 END IF;
 -- A canonical/registered-alias match is used ONLY to decide which already
 -- confirmed capability is still mentioned by the worker. This is not consent.
 -- No invented ON_SITE mode, no nearest-parent inference and no new records.
 FOREACH v_skill IN ARRAY v_saved_skills LOOP
   v_skill:=btrim(COALESCE(v_skill,''));
   IF char_length(v_skill) NOT BETWEEN 3 AND 120 THEN
     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);
     CONTINUE;
   END IF;
   v_norm:=private.taxonomy_normalize_v1(v_skill);
   SELECT count(DISTINCT c.id),min(c.id::text)::uuid
      INTO v_match_count,v_cat_id
   FROM private.work_taxonomy_categories c
   WHERE c.state='ESTABLISHED'
     AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
       WHERE m.category_id=c.id)
     AND (c.canonical_key=v_norm OR EXISTS(
       SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=v_norm));
   -- Retain only an ALREADY ACTIVE capability certified by this owner's
   -- saved review and successful binder. Natural wording is local to that
   -- signed service, never a global alias or permission to create/revive skills.
   -- Keep canonical/alias ambiguity fail-closed; fallback applies to no match.
   IF v_match_count=0 THEN
     SELECT count(DISTINCT c.id),min(c.id::text)::uuid
       INTO v_match_count,v_cat_id
     FROM private.work_taxonomy_worker_capabilities cap
     JOIN private.taxonomy_confirmed_worker_modes_v1 mode
       ON mode.worker_account_id=cap.worker_account_id AND mode.category_id=cap.category_id
     JOIN private.work_taxonomy_categories c ON c.id=cap.category_id
     JOIN private.work_taxonomy_category_modes cm
       ON cm.category_id=c.id AND cm.execution_scope=mode.execution_scope
     JOIN private.worker_ai_saves saved
       ON saved.account_id=mode.worker_account_id AND saved.review_id=mode.source_review_id
       AND saved.client_request_id=mode.source_request_key
     JOIN private.work_taxonomy_worker_bindings_v1 binding
       ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
       AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile_id
     JOIN private.worker_ai_reviews review
       ON review.id=saved.review_id AND review.account_id=saved.account_id
     JOIN private.work_taxonomy_review_batches_v1 batch
       ON batch.owner_account_id=saved.account_id AND batch.request_key=saved.client_request_id
       AND batch.source_review_id=saved.review_id AND batch.purpose='WORKER_CAPABILITY'
     CROSS JOIN LATERAL jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
     WHERE cap.worker_account_id=p_account_id AND cap.excluded IS FALSE
       AND cap.origin='WORKER_CONFIRMED' AND mode.active IS TRUE
       AND mode.confirmed_at=cap.confirmed_at AND mode.confirmed_at=binding.bound_at
       AND c.state='ESTABLISHED' AND private.taxonomy_category_path_valid_v1(c.id)
       AND binding.result->>'status'='BOUND_WORKER_SERVICES'
       AND saved.receipt->>'profileId'=v_profile_id::text
       AND saved.receipt->>'profileStatus'='ACTIVE'
       AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
       AND saved.created_at<=review.expires_at
       AND review.envelope->>'profileId'=v_profile_id::text
       AND review.envelope->'canAccept'='true'::jsonb
       AND review.envelope->>'classificationState'='READY'
       AND review.envelope->'classificationCandidates'=batch.plans
       AND review.envelope->>'displayedContentDigest'=batch.review_digest
       AND batch.review_digest=encode(extensions.digest(
         ((review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',review.base_hash))::text,'sha256'),'hex')
       AND batch.result->>'status'='COMMITTED'
       AND batch.result->'requiresBinding'='true'::jsonb
       AND plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
       AND plan.value->>'categoryId'=c.id::text
       AND plan.value->>'mode'=mode.execution_scope
       AND private.taxonomy_normalize_v1(plan.value->>'service')=v_norm
       AND plan.value ? 'categoryLabel' AND plan.value ? 'categoryParentId'
       AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
       AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
           IS NOT DISTINCT FROM plan.value->'categoryParentId'
       AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
         WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
       AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
       AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=mode.execution_scope
       AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=v_norm
       AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(review.envelope#>'{profile,skills}') skill(value)
         WHERE private.taxonomy_normalize_v1(skill.value)=v_norm)
       AND EXISTS(SELECT 1 FROM jsonb_array_elements(review.envelope->'reviewedServiceModes') consent(value)
         WHERE private.taxonomy_normalize_v1(consent.value->>'service')=v_norm
           AND consent.value->>'mode'=mode.execution_scope);
   END IF;
   IF v_match_count<>1 OR v_cat_id IS NULL THEN
     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);
     CONTINUE;
   END IF;
   IF NOT v_cat_id=ANY(v_retained_ids) THEN
     v_retained_ids:=array_append(v_retained_ids,v_cat_id);
   END IF;
 END LOOP;
 -- Explicitly removed or now-ambiguous worker services lose existing legacy
 -- eligibility and related opt-ins. Retained rows are NOT refreshed/revived.
 UPDATE private.work_taxonomy_worker_capabilities w
 SET excluded=true,allow_related_offers=false,updated_at=statement_timestamp()
 WHERE w.worker_account_id=p_account_id
   AND NOT (w.category_id=ANY(v_retained_ids))
   AND (NOT w.excluded OR w.allow_related_offers);
 GET DIAGNOSTICS v_revoked=ROW_COUNT;
 DELETE FROM private.work_taxonomy_related_acceptances a
 WHERE a.worker_account_id=p_account_id
   AND NOT (a.source_category_id=ANY(v_retained_ids));
 GET DIAGNOSTICS v_revoked_acceptances=ROW_COUNT;
 -- Deliberately NO requeue: Save is not a taxonomy binder receipt. A signed
 -- reconciler may later schedule matching only after both sides are bound.
 RETURN jsonb_build_object(
   'success',true,'workerAccountId',p_account_id,
   'assignedCount',0,'assignedCategoryIds','[]'::jsonb,
   'retainedExistingCategoryCount',cardinality(v_retained_ids),
   'retainedExistingCategoryIds',to_jsonb(v_retained_ids),
   'revokedCount',v_revoked,
   'revokedRelatedAcceptances',v_revoked_acceptances,
   'unmappedSkillLabels',to_jsonb(v_unmapped_labels),
   'openNeedsRequeued',0,
   'newCapabilityAuthority','NONE',
   'notificationAuthority','NONE'
 );
END $function$;
CREATE OR REPLACE FUNCTION private.worker_remote_only_activation_ready_v1(p_account uuid, p_skills text[])
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_skill text;v_norm text;v_category uuid;v_matches bigint;v_profile uuid;
BEGIN
 IF p_account IS NULL OR p_skills IS NULL OR cardinality(p_skills)=0 THEN RETURN false; END IF;
 SELECT id INTO v_profile FROM public.app_profiles
 WHERE account_id=p_account AND kind='WORKER' AND skills=p_skills;
 IF v_profile IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
   JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id AND cap.category_id=m.category_id
   WHERE m.worker_account_id=p_account AND m.active
    AND cap.excluded IS FALSE AND m.execution_scope IS DISTINCT FROM 'REMOTE')
 THEN RETURN false; END IF;
 FOREACH v_skill IN ARRAY p_skills LOOP
  IF v_skill IS NULL OR char_length(btrim(v_skill)) NOT BETWEEN 3 AND 120 THEN RETURN false; END IF;
  v_norm:=private.taxonomy_normalize_v1(v_skill);
  IF v_norm IS NULL OR v_norm='' THEN RETURN false; END IF;
  SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
  FROM private.work_taxonomy_categories c
  WHERE c.state='ESTABLISHED' AND
    (c.canonical_key=v_norm OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
      WHERE a.category_id=c.id AND a.normalized_key=v_norm));

  IF v_matches=0 THEN
   -- No spelling authority exists. Resolve only the same service/mode at the
   -- same ordinal in the immutable reviewed plan and its committed result.
   -- Existing/ambiguous canonical or alias matches cannot take this fallback.
   SELECT count(*),min(c.id::text)::uuid INTO v_matches,v_category
   FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   JOIN private.work_taxonomy_categories c ON c.id=cap.category_id
   JOIN private.work_taxonomy_category_modes cm
    ON cm.category_id=m.category_id AND cm.execution_scope=m.execution_scope
   JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id AND saved.review_id=m.source_review_id
    AND saved.client_request_id=m.source_request_key
   JOIN private.worker_ai_reviews review
    ON review.id=saved.review_id AND review.account_id=saved.account_id
   JOIN private.work_taxonomy_worker_bindings_v1 binding
    ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
    AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile
   JOIN private.work_taxonomy_review_batches_v1 batch
    ON batch.owner_account_id=saved.account_id AND batch.source_review_id=saved.review_id
    AND batch.request_key=saved.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(batch.plans)='array'
     THEN batch.plans ELSE '[]'::jsonb END) WITH ORDINALITY plan(value,ord)
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(batch.result->'items')='array'
     THEN batch.result->'items' ELSE '[]'::jsonb END) WITH ORDINALITY item(value,ord)
   WHERE cap.worker_account_id=p_account
    AND cap.excluded IS FALSE AND cap.origin='WORKER_CONFIRMED'
    AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at=cap.confirmed_at AND m.confirmed_at=binding.bound_at
    AND binding.result->>'status'='BOUND_WORKER_SERVICES'
    AND binding.result->>'workerProfileId'=v_profile::text
    AND binding.bound_at>=saved.created_at
    AND saved.receipt->>'accountId'=p_account::text
    AND saved.receipt->>'reviewId'=review.id::text
    AND saved.receipt->>'profileId'=v_profile::text
    AND saved.receipt->>'profileStatus'='ACTIVE'
    AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
    AND review.envelope->>'accountId'=p_account::text
    AND review.envelope->>'reviewId'=review.id::text
    AND review.envelope->>'profileId'=v_profile::text
    AND review.envelope->>'classificationState'='READY'
    AND review.envelope->'canAccept'='true'::jsonb
    AND review.created_at<=saved.created_at AND saved.created_at<=review.expires_at
    AND review.envelope->>'displayedContentDigest'=encode(extensions.digest(
      ((review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',review.base_hash))::text,
      'sha256'),'hex')
    AND batch.review_digest=review.envelope->>'displayedContentDigest'
    AND batch.plans=review.envelope->'classificationCandidates'
    AND batch.plans_digest=encode(extensions.digest(convert_to(batch.plans::text,'UTF8'),'sha256'),'hex')
    AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
    AND batch.result->>'capabilityAuthority'='NONE'
    AND batch.result->>'notificationAuthority'='NONE'
    AND batch.catalog_version=binding.catalog_version
    AND jsonb_array_length(CASE WHEN jsonb_typeof(batch.plans)='array'
      THEN batch.plans ELSE '[]'::jsonb END) BETWEEN 1 AND 24
    AND binding.result->'serviceModeCount'=to_jsonb(jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END))
    AND jsonb_array_length(CASE WHEN jsonb_typeof(batch.result->'items')='array'
      THEN batch.result->'items' ELSE '[]'::jsonb END)=jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END)
    AND jsonb_array_length(CASE WHEN jsonb_typeof(review.envelope->'reviewedServiceModes')='array'
      THEN review.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END)=jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END)
    AND (SELECT count(*) FROM jsonb_array_elements_text(CASE
      WHEN jsonb_typeof(review.envelope#>'{profile,skills}')='array'
      THEN review.envelope#>'{profile,skills}' ELSE '[]'::jsonb END) skill(value)
      WHERE private.taxonomy_normalize_v1(skill.value)=v_norm)=1
    AND (SELECT count(*) FROM jsonb_array_elements(CASE
      WHEN jsonb_typeof(review.envelope->'reviewedServiceModes')='array'
      THEN review.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END) selected(value)
      WHERE private.taxonomy_normalize_v1(selected.value->>'service')=v_norm
        AND selected.value->>'mode'='REMOTE')=1
    AND plan.ord=item.ord AND plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
    AND plan.value->>'mode'='REMOTE' AND item.value->>'mode'='REMOTE'
    AND private.taxonomy_normalize_v1(plan.value->>'service')=v_norm
    AND private.taxonomy_normalize_v1(item.value->>'service')=v_norm
    AND plan.value->>'categoryId'=c.id::text AND item.value->>'categoryId'=c.id::text
    AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
    AND (NOT(plan.value?'handoff') OR private.taxonomy_handoff_valid_v1(plan.value->'handoff') IS TRUE)
    AND jsonb_typeof(plan.value->'categoryLabel')='string'
    AND plan.value?'categoryParentId'
    AND c.state='ESTABLISHED' AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
    AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM plan.value->'categoryParentId'
    AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
      WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
    AND private.taxonomy_category_path_valid_v1(c.id);
  END IF;

  IF v_matches<>1 OR v_category IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   JOIN private.work_taxonomy_category_modes cm
    ON cm.category_id=m.category_id AND cm.execution_scope=m.execution_scope
   JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id AND saved.review_id=m.source_review_id
    AND saved.client_request_id=m.source_request_key
   JOIN private.work_taxonomy_worker_bindings_v1 binding
    ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
    AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile
   WHERE cap.worker_account_id=p_account AND cap.category_id=v_category
    AND cap.excluded IS FALSE AND cap.origin='WORKER_CONFIRMED'
    AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at=cap.confirmed_at AND m.confirmed_at=binding.bound_at
    AND binding.result->>'status'='BOUND_WORKER_SERVICES'
    AND saved.receipt->>'profileId'=v_profile::text
    AND saved.receipt->>'profileStatus'='ACTIVE'
    AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
  ) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END; $function$;
CREATE OR REPLACE FUNCTION public.rpc_get_worker_execution_modes(p_worker_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_account uuid:=auth.uid(); v_profile public.app_profiles; v_modes text[]; v_at timestamptz; v_services jsonb;
BEGIN
 IF v_account IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 SELECT p.* INTO v_profile FROM public.app_profiles p
 WHERE p.id=p_worker_profile_id AND p.account_id=v_account AND p.kind='WORKER';
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_NOT_OWNED' USING errcode='42501'; END IF;
 SELECT m.modes,m.confirmed_at INTO v_modes,v_at
 FROM private.worker_execution_mode_choices m
 WHERE m.worker_profile_id=p_worker_profile_id AND m.worker_account_id=v_account;

 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key,min(ord) AS ord
  FROM unnest(v_profile.skills) WITH ORDINALITY n(skill,ord) GROUP BY skill
 ), latest AS (
  -- A malformed/newer Save must not silently fall back to an older review.
  SELECT s.* FROM private.worker_ai_saves s
  WHERE s.account_id=v_account AND s.receipt->>'profileId'=p_worker_profile_id::text
  ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=v_account AND s.receipt->>'profileId'=p_worker_profile_id::text
   AND (s.review_id IN (SELECT review_id FROM latest) OR EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=v_account
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=v_account::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=p_worker_profile_id::text AND r.envelope->>'accountId'=v_account::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')
 ), current_saved AS (
  SELECT s.* FROM saved s JOIN latest l ON l.review_id=s.review_id
  WHERE NOT EXISTS(SELECT 1 FROM private.worker_ai_saves tie WHERE tie.account_id=v_account
   AND tie.receipt->>'profileId'=p_worker_profile_id::text AND tie.created_at=s.created_at AND tie.review_id<>s.review_id)
 ), requested AS (
  SELECT n.service,m.value->>'mode' AS mode,
   CASE WHEN m.value->>'mode'='REMOTE' AND private.taxonomy_handoff_valid_v1(plan.value->'handoff')
    THEN plan.value->'handoff' ELSE NULL END AS handoff,
   s.review_id,s.client_request_id
  FROM names n JOIN current_saved s ON s.envelope#>'{profile,skills}' @> jsonb_build_array(n.service)
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.envelope->'reviewedServiceModes')='array'
   THEN s.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END) m(value)
  LEFT JOIN LATERAL (SELECT p.value FROM jsonb_array_elements(CASE
   WHEN jsonb_typeof(s.envelope->'classificationCandidates')='array' THEN s.envelope->'classificationCandidates'
   ELSE '[]'::jsonb END) p(value) WHERE p.value->>'service'=n.service AND p.value->>'mode'=m.value->>'mode'
   LIMIT 1) plan ON true
  WHERE m.value->>'service'=n.service AND m.value->>'mode' IN ('ON_SITE','REMOTE')
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (SELECT count(*) FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') duplicate
    WHERE duplicate->>'service'=n.service AND duplicate->>'mode'=m.value->>'mode')=1
 ), bound AS (
  -- Per-service survival is independent of newer unrelated edits. Current mode
  -- and capability rows remain the authority; a pending addition cannot erase them.
  SELECT n.service,m.execution_scope AS mode,m.handoff
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=v_account AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=v_account
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=v_account
   AND b.profile_id=p_worker_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=p_worker_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=v_account
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND v_at IS NOT NULL AND m.execution_scope=ANY(v_modes)
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )
 ), mode_rows AS (
  SELECT b.service,b.mode,'CONFIRMED'::text AS status,b.handoff FROM bound b
  UNION ALL
  SELECT r.service,r.mode,CASE WHEN EXISTS(SELECT 1 FROM private.work_taxonomy_worker_bindings_v1 b
   WHERE b.owner_account_id=v_account AND b.profile_id=p_worker_profile_id
    AND b.source_review_id=r.review_id AND b.request_key=r.client_request_id)
   THEN 'UNCONFIRMED' ELSE 'PENDING' END,r.handoff
  FROM requested r WHERE NOT EXISTS(SELECT 1 FROM bound b WHERE b.service=r.service AND b.mode=r.mode
   AND b.handoff IS NOT DISTINCT FROM r.handoff)
 ), projected AS (
  SELECT n.service,n.ord,coalesce((SELECT jsonb_agg(jsonb_build_object('mode',m.mode,'status',m.status,'handoff',m.handoff)
   ORDER BY m.mode,m.status) FROM mode_rows m WHERE m.service=n.service),'[]'::jsonb) AS modes,
   CASE WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='PENDING') THEN 'PENDING'
    WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='UNCONFIRMED') THEN 'UNCONFIRMED'
    WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='CONFIRMED') THEN 'CONFIRMED'
    WHEN EXISTS(SELECT 1 FROM current_saved s WHERE s.envelope#>'{profile,skills}' @> jsonb_build_array(n.service)
     AND s.envelope->>'classificationState' IN ('PENDING_CLASSIFICATION','SERVICE_MODE_CONFIRMATION_REQUIRED',
      'REVIEW_REQUIRED','CATALOG_UNAVAILABLE','STALE_CATALOG')) THEN 'PENDING'
    ELSE 'UNCONFIRMED' END AS status
  FROM names n
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('service',service,'modes',modes,'status',status) ORDER BY ord),'[]'::jsonb)
 INTO v_services FROM projected;
 RETURN jsonb_build_object('workerProfileId',p_worker_profile_id,'modes',to_jsonb(coalesce(v_modes,ARRAY[]::text[])),
  'confirmed',v_at IS NOT NULL,'confirmedAt',v_at,'matchingAuthority','NONE','notificationAuthority','NONE',
  'servicesVersion','WORKER_SAVED_SERVICES_V1','services',v_services);
END $function$;
CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_session private.worker_ai_sessions; v_profile_id uuid;
 v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';

BEGIN
 SELECT * INTO v_session FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR v_session.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(v_session.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_profile_id:=v_session.profile_id;
 -- Read only durable, active bindings for independently surviving services.
 -- A newer pending addition is not authority to erase an older bound service.
 -- Source hash above still ties this context to the current owned profile.
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(v_session.candidate->'skills') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=p_account_id AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=p_account_id
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=p_account_id::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=p_account_id::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=p_account_id AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=p_account_id
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=p_account_id
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=p_account_id
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=p_account_id
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   v_session.candidate::text||'|'||v_session.revision::text||'|'||v_session.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId'
     THEN v_draft_services:=v_draft_services||jsonb_build_array(jsonb_build_object(
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
        ||case when v_item ? 'handoff' then jsonb_build_object('handoff',v_item->'handoff') else '{}'::jsonb end);
     END IF;
   END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_saved_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_saved_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_draft_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_draft_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value#>>'{}'),'[]'::jsonb) INTO v_unresolved
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',v_session.revision,
   'savedServices',v_saved_services,'draftServices',v_draft_services,'unresolvedServices',v_unresolved);
END $function$;
CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_context jsonb;v_retained jsonb:='[]'::jsonb;v_plans jsonb:='[]'::jsonb;v_one jsonb;v_saved_item jsonb;v_plan jsonb;
 v_version bigint;v_fingerprint text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  -- City readiness follows the signed service projection below.
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2)
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and s.revision>0 -- untouched sessions revalidate saved consent on every review
  and envelope->>'classificationState'='READY'
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Use only hints bound to the authenticated worker, this conversation, and
 -- the exact CURRENT candidate/revision/base_hash. They are suggestions only.
 v_source:=encode(extensions.digest(
   convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex');
 select h.proposals into v_hints from private.work_taxonomy_gemini_turn_hints_v1 h
 where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid()
   and h.conversation_id=p_conversation_id and h.source_fingerprint=v_source
   and h.catalog_version=(select catalog_version from private.work_taxonomy_control where singleton=true)
 order by h.created_at desc,h.id desc limit 1;
 if jsonb_typeof(v_hints)='array' then
   for v_item in select value from jsonb_array_elements(v_hints) loop
     if v_item->>'mode' in ('ON_SITE','REMOTE')
       and v_item->>'action' in ('REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH') then
       v_modes:=v_modes||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode'));
     end if;
   end loop;
 end if;

 -- Reuse only independently bound, unchanged services from this owner's
 -- current profile. Any current hint for a service (including invalid/null
 -- modes or actions) takes precedence and prevents silent old-mode fallback.
 perform 1 from private.work_taxonomy_worker_bindings_v1 binding
   where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id for share;
 perform 1 from private.worker_execution_mode_choices choice
   where choice.worker_profile_id=s.profile_id for share;
 perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
   where mode.worker_account_id=auth.uid() for share;
 perform 1 from private.work_taxonomy_worker_capabilities capability
   where capability.worker_account_id=auth.uid() for share;
 v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
 for v_item in select value from jsonb_array_elements(v_context->'savedServices') loop
   if not exists(select 1 from jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
     where private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
   and not exists(
     -- Absence in the newest turn cannot undo a prior explicit change in this
     -- conversation. A stale proposal may prevent fallback, never grant it.
     select 1 from (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and h.source_fingerprint is distinct from v_source
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
       order by h.created_at desc,h.id desc limit 1) previous
     where exists(select 1 from jsonb_array_elements(previous.proposals) p
       where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
       and (p->>'action' is distinct from 'REUSE_EXISTING' or not exists(
         select 1 from jsonb_array_elements(v_context->'savedServices') saved
         where saved->>'service'=v_item->>'service' and saved->>'mode'=p->>'mode'
           and saved->>'categoryId'=p->>'categoryId' and saved->'handoff' is not distinct from p->'handoff')))
     or exists(select 1 from jsonb_array_elements(v_context->'savedServices') saved
       where saved->>'service'=v_item->>'service' and not exists(
         select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
           and saved->>'mode'=p->>'mode' and saved->>'categoryId'=p->>'categoryId'
           and saved->'handoff' is not distinct from p->'handoff')))
   then
     v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
     v_retained:=v_retained||jsonb_build_array(v_item);
   end if;
 end loop;
 select coalesce(jsonb_agg(m.value ORDER BY skill.ord,m.value->>'mode'),'[]'::jsonb) into v_modes
 from jsonb_array_elements(v_modes) m(value) join jsonb_array_elements(s.candidate->'skills') with ordinality skill(value,ord)
   on skill.value=to_jsonb(m.value->>'service');
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 if v_projection->>'status' in ('READY','PENDING_CLASSIFICATION') and v_retained<>'[]'::jsonb then
   select catalog_version into v_version from private.work_taxonomy_control where singleton;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   -- Existing per-service projection validates every new plan. Only a verified
   -- saved semantic ID may fill a missing old synonym, without a new model call.
   for v_item in select value from jsonb_array_elements(v_modes) loop
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(v_item),auth.uid(),p_conversation_id);
     select value into v_saved_item from jsonb_array_elements(v_retained) x(value)
       where value->>'service'=v_item->>'service' and value->>'mode'=v_item->>'mode';
     if v_one->>'status'='READY' then
       v_plan:=v_one#>'{classificationCandidates,0}';
       if v_saved_item is not null and v_plan->>'categoryId' is distinct from v_saved_item->>'categoryId' then
         v_plans:='[]'::jsonb;exit;
       end if;
     elsif v_one->>'status'='PENDING_CLASSIFICATION' and v_saved_item is not null then
       select jsonb_build_object('action','REUSE_EXISTING','service',v_item->>'service','mode',v_item->>'mode',
         'categoryId',c.id,'categoryLabel',c.label,'categoryParentId',c.parent_id,
         'reason','Previously saved and bound service identity','catalogVersion',v_version)
       into v_plan from private.work_taxonomy_categories c where c.id::text=v_saved_item->>'categoryId'
         and c.state='ESTABLISHED' and private.taxonomy_category_path_valid_v1(c.id)
         and private.taxonomy_risk_triage_v1(v_item->>'service')='LOW_RISK_CANDIDATE'
         and private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE';
       if v_plan is null then v_plans:='[]'::jsonb;exit;end if;
     else v_plans:='[]'::jsonb;exit;end if;
     if v_saved_item ? 'handoff' then v_plan:=v_plan||jsonb_build_object('handoff',v_saved_item->'handoff');end if;
     v_plans:=v_plans||jsonb_build_array(v_plan);
   end loop;
   if jsonb_array_length(v_plans)=jsonb_array_length(v_modes) and pg_column_size(v_plans)<=16000
      and v_version=(select catalog_version from private.work_taxonomy_control where singleton)
      and v_fingerprint=private.taxonomy_admission_fingerprint_v1() then
     v_projection:=v_projection||jsonb_build_object('status','READY','classificationCandidates',v_plans,
       'reviewedServiceModes',v_modes,'visibleServices',v_modes,
       'classificationCatalogVersion',v_version,'classificationCatalogFingerprint',v_fingerprint);
   else v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);end if;
 end if;
 -- A projected mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   if exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') plan
     join jsonb_array_elements(v_context->'savedServices') saved
       on saved->>'service'=plan->>'service' and saved->>'mode'=plan->>'mode'
         and saved->>'categoryId'=plan->>'categoryId'
     cross join lateral (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
             and p->>'mode'='REMOTE' and p?'handoff')
       order by h.created_at desc,h.id desc limit 1) previous
     where plan->>'mode'='REMOTE' and not(plan?'handoff')
       and exists(select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
           and p->>'mode'='REMOTE' and p?'handoff'
           and p->'handoff' is distinct from saved->'handoff')) then
     v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   end if;
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');

 if p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE then
   if jsonb_typeof(doc->'reviewedServiceModes')='array'
      and jsonb_array_length(doc->'reviewedServiceModes')>0
      and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m
        where m->>'mode' is distinct from 'REMOTE') then
     missing:=missing||'"Potvrda usluga za rad na daljinu"'::jsonb;
   else missing:=missing||'"Mesto rada"'::jsonb; end if;
 end if;
 doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 -- Sign BEFORE storing or returning the owner-visible review.

 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy_confirmed(p_conversation_id uuid, p_expected_revision integer, p_activate boolean, p_selected_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_modes jsonb;v_projection jsonb;v_ordinary jsonb;v_context jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  -- City readiness follows the signed service projection below.
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2)
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and envelope->>'classificationState'='READY'
  and envelope->'reviewedServiceModes'=p_selected_modes
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Reject missing or unbounded selections. Never infer a mode from skills,
 -- location, model hints or the global worker execution-mode default.
 IF jsonb_typeof(p_selected_modes) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_selected_modes) NOT BETWEEN 1 AND 24
 OR pg_column_size(p_selected_modes)>8000
 THEN RAISE EXCEPTION 'WORKER_EXPLICIT_MODES_INVALID' USING errcode='22023'; END IF;
 v_modes:=p_selected_modes;
 -- Exact/alias reuse or a validated new child. The signed review contains the
 -- proposed parent and full path, which the owner sees before saving.
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 -- Selecting a mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
   if exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') plan
     join jsonb_array_elements(v_context->'savedServices') saved
       on saved->>'service'=plan->>'service' and saved->>'mode'=plan->>'mode'
         and saved->>'categoryId'=plan->>'categoryId'
     cross join lateral (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
             and p->>'mode'='REMOTE' and p?'handoff')
       order by h.created_at desc,h.id desc limit 1) previous
     where plan->>'mode'='REMOTE' and not(plan?'handoff')
       and exists(select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
           and p->>'mode'='REMOTE' and p?'handoff'
           and p->'handoff' is distinct from saved->'handoff')) then
     v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   end if;
 end if;
 -- Reuse the ordinary owner's fresh signed continuity only for the identical
 -- complete selection. A changed mode, stale source/catalog or unresolved plan
 -- must continue through this explicit selection's original result.
 if v_projection->>'status'='PENDING_CLASSIFICATION' then
   v_ordinary:=public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id,p_expected_revision,p_activate);
   if v_ordinary->>'classificationState'='READY' and v_ordinary->'canAccept'='true'::jsonb
      and v_ordinary->'reviewedServiceModes'=p_selected_modes then
     return v_ordinary;
   end if;
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');

 if p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE then
   if jsonb_typeof(doc->'reviewedServiceModes')='array'
      and jsonb_array_length(doc->'reviewedServiceModes')>0
      and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m
        where m->>'mode' is distinct from 'REMOTE') then
     missing:=missing||'"Potvrda usluga za rad na daljinu"'::jsonb;
   else missing:=missing||'"Mesto rada"'::jsonb; end if;
 end if;
 doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 -- Sign BEFORE storing or returning the owner-visible review.

 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(p_outbox_id uuid, p_lease_token uuid, p_error_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v private.work_taxonomy_review_outbox_v1%ROWTYPE;v_receipt jsonb;
 v_status text;v_retry timestamptz;
BEGIN
 PERFORM private.closure_assert_open(owner_account_id)
 FROM private.work_taxonomy_review_outbox_v1 WHERE id=p_outbox_id;
 SELECT * INTO v FROM private.work_taxonomy_review_outbox_v1
 WHERE id=p_outbox_id FOR UPDATE;
 IF NOT FOUND OR v.state<>'CLAIMED' OR v.lease_token IS DISTINCT FROM p_lease_token
    OR v.lease_until<=statement_timestamp()
 THEN RAISE EXCEPTION 'OUTBOX_STALE_LEASE' USING errcode='42501'; END IF;
 IF p_error_code IS NOT NULL AND p_error_code !~ '^[A-Z][A-Z0-9_]{2,79}$' THEN
  RAISE EXCEPTION 'OUTBOX_ERROR_CODE_INVALID' USING errcode='22023'; END IF;

 -- Transport failure is not rollback. Read the same immutable batch receipt
 -- before exhausting retries; a different owner/key/review/plan is no evidence.
 SELECT b.result INTO v_receipt FROM private.work_taxonomy_review_batches_v1 b
 WHERE b.owner_account_id=v.owner_account_id AND b.request_key=v.request_key
   AND b.source_review_id=v.source_review_id AND b.purpose=v.purpose
   AND b.plans IS NOT DISTINCT FROM v.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(v.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED';
 IF v_receipt IS NOT NULL THEN
  v_status:='COMMITTED';v_retry:=statement_timestamp();
 ELSIF p_error_code IS NULL THEN
  RAISE EXCEPTION 'OUTBOX_COMMIT_RECEIPT_MISSING' USING errcode='42501';
 ELSIF p_error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
   AND v.attempts<5 THEN
  v_status:='RETRY';
  v_retry:=statement_timestamp()+make_interval(secs=>LEAST(1800,15*power(2,LEAST(v.attempts,7)))::integer);
 ELSE
  -- Without a committed receipt, keep the existing permanent/max-attempt denial.
  v_status:='REVIEW_REQUIRED';v_retry:=statement_timestamp();
 END IF;
 UPDATE private.work_taxonomy_review_outbox_v1
 SET state=v_status,lease_token=NULL,lease_until=NULL,retry_after=v_retry,
   error_code=CASE WHEN v_status='COMMITTED' THEN NULL ELSE p_error_code END,
   result=v_receipt,updated_at=statement_timestamp()
 WHERE id=v.id;
 RETURN jsonb_build_object('status',v_status,'outboxId',v.id);
END $function$;
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_reconcile_reviewed_outbox_service(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_enabled boolean;v_count integer;v_repaired integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'OUTBOX_RECOVERY_LIMIT_INVALID' USING errcode='22023'; END IF;
 SELECT enabled INTO v_enabled FROM private.work_taxonomy_review_outbox_control_v1
 WHERE singleton;
 IF v_enabled IS DISTINCT FROM true THEN RETURN 0; END IF;

 -- Match receipts BEFORE limiting: old absent/mismatched receipts cannot starve
 -- later recoverable work. Preserve the existing closure-before-row lock order.
 WITH candidates AS MATERIALIZED (
  SELECT q.id,q.owner_account_id FROM private.work_taxonomy_review_outbox_v1 q
  JOIN private.work_taxonomy_review_batches_v1 b
    ON b.owner_account_id=q.owner_account_id AND b.request_key=q.request_key
   AND b.source_review_id=q.source_review_id AND b.purpose=q.purpose
   AND b.plans IS NOT DISTINCT FROM q.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(q.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED'
  WHERE q.state='REVIEW_REQUIRED'
    AND q.error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
    AND NOT private.closure_account_restricted(q.owner_account_id)
  ORDER BY q.created_at,q.id LIMIT p_limit
 ),
 admitted AS MATERIALIZED (
  SELECT id FROM candidates WHERE private.closure_taxonomy_try_owner_v1(owner_account_id)
 ),
 selected AS (
  SELECT q.id,b.result FROM private.work_taxonomy_review_outbox_v1 q
  JOIN admitted a ON a.id=q.id
  JOIN private.work_taxonomy_review_batches_v1 b
    ON b.owner_account_id=q.owner_account_id AND b.request_key=q.request_key
   AND b.source_review_id=q.source_review_id AND b.purpose=q.purpose
   AND b.plans IS NOT DISTINCT FROM q.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(q.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED'
  WHERE q.state='REVIEW_REQUIRED'
    AND q.error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
  FOR UPDATE OF q SKIP LOCKED
 ),
 repaired AS (
  UPDATE private.work_taxonomy_review_outbox_v1 q
  SET state='COMMITTED',result=s.result,error_code=NULL,updated_at=statement_timestamp()
  FROM selected s WHERE q.id=s.id RETURNING q.id
 )
 SELECT count(*)::integer INTO v_repaired FROM repaired;

 -- Keep the existing missing-save recovery and share its original mutation
 -- budget; the Edge contract requires total reconciled <= requested limit.
 WITH accepted AS (
   SELECT s.account_id,s.client_request_id,s.review_id,
      'WORKER_CAPABILITY'::text AS purpose,
      w.envelope->'classificationCandidates' AS plans,s.created_at
   FROM private.worker_ai_saves s
   JOIN private.worker_ai_reviews w ON w.id=s.review_id AND w.account_id=s.account_id
   WHERE w.envelope->'canAccept'='true'::jsonb
     AND w.envelope->>'classificationCatalogFingerprint' IS NOT NULL
     AND CASE WHEN jsonb_typeof(w.envelope->'classificationCandidates')='array'
       THEN jsonb_array_length(w.envelope->'classificationCandidates') BETWEEN 1 AND 24
       ELSE false END
   UNION ALL
   SELECT c.account_id,c.client_request_id,c.review_id,
      'NEED_SERVICE'::text AS purpose,
      t.envelope->'classificationCandidates' AS plans,c.created_at
   FROM private.ai_task_review_commands c
   JOIN private.ai_task_reviews t ON t.id=c.review_id AND t.account_id=c.account_id
   WHERE c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')
     AND t.envelope->'canAccept'='true'::jsonb
     AND t.envelope->>'classificationCatalogFingerprint' IS NOT NULL
     AND CASE WHEN jsonb_typeof(t.envelope->'classificationCandidates')='array'
       THEN jsonb_array_length(t.envelope->'classificationCandidates')=1
       ELSE false END
 ),
 missing AS MATERIALIZED (
   SELECT a.* FROM accepted a
   WHERE NOT private.closure_account_restricted(a.account_id) AND NOT EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_v1 q
     WHERE q.owner_account_id=a.account_id AND q.request_key=a.client_request_id)
   ORDER BY a.created_at,a.review_id LIMIT greatest(0,p_limit-v_repaired)
 ),
 admitted AS MATERIALIZED (SELECT * FROM missing WHERE private.closure_taxonomy_try_owner_v1(account_id)),
 inserted AS (
   INSERT INTO private.work_taxonomy_review_outbox_v1
     (owner_account_id,request_key,source_review_id,purpose,plans)
   SELECT account_id,client_request_id,review_id,purpose,plans FROM admitted
   ON CONFLICT(owner_account_id,request_key) DO NOTHING
   RETURNING id
 )
 SELECT count(*)::integer INTO v_count FROM inserted;
 RETURN v_repaired+v_count;
END $function$;
-- No existing account, business/Auth fixture, provider or push call.
DO $triage$ BEGIN
 IF private.taxonomy_risk_triage_v1('Lektura') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
   RAISE EXCEPTION 'R04_TRIAGE_LEKTURA_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('ostalo') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_OSTALO_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('bilo sta') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_BILO_STA_FAILED';
 END IF;
END;$triage$;
DO $commit_check$ BEGIN
 BEGIN
   PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(NULL, NULL, 'NEED_SERVICE', NULL, '[]'::jsonb);
   RAISE EXCEPTION 'R04_COMMIT_GUARD_FAILED';
 EXCEPTION WHEN OTHERS THEN
    -- The real closure guard rejects a NULL owner before input validation.
    -- An unrelated permission error or a later input error is not this proof.
    IF SQLSTATE <> '42501' OR SQLERRM <> 'CLOSURE_CONTEXT_INVALID' THEN RAISE; END IF;
 END;
END;$commit_check$;
DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r04_semantic_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid IN (
   to_regprocedure('private.taxonomy_risk_triage_v1(text)'),
   to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'),
   to_regprocedure('private.needs_sync_taxonomy_category_trigger_fn()'),
   to_regprocedure('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'),
   to_regprocedure('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'),
   to_regprocedure('private.worker_remote_review_ready_v1(jsonb)'),
   to_regprocedure('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'),
   to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])'),
   to_regprocedure('public.rpc_get_worker_execution_modes(uuid)'),
   to_regprocedure('private.worker_ai_service_mode_context_v1(uuid,uuid)'),
   to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'),
   to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'),
   to_regprocedure('public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)'),
   to_regprocedure('public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)')
 ) THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;
DO $r04_post$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r04.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_risk_triage_v1(text)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='93d94a6c7e21ce3ecb854cda239b546a'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"28782","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"taxonomy_risk_triage_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":false,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_label"],"proargtypes":["25"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_risk_triage_v1(text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='7a95c7ca99b864d854bd0ec4bcea3338'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"31025","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"taxonomy_review_candidate_projection_v2","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_purpose","p_services","p_service_modes","p_owner_account_id","p_conversation_id"],"proargtypes":["25","3802","3802","2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.needs_sync_taxonomy_category_trigger_fn()')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='43b0a7f32355ab493c3899a9670c7331'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM NULL
 AND to_jsonb(p)-'prosrc'='{"oid":"29147","proacl":null,"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"needs_sync_taxonomy_category_trigger_fn","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"2279","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.needs_sync_taxonomy_category_trigger_fn()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='f1122a1dcbfa7bedbee5ecae2d6d9a3c'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29415","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_commit_reviewed_batch_service","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_owner_account_id","p_request_key","p_purpose","p_source_review_id","p_plans"],"proargtypes":["2950","2950","25","2950","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='156107382ec4aea5fda5348a6fc86f2d'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29486","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_bind_reviewed_worker_service","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_owner_account_id","p_request_key","p_source_review_id","p_profile_id"],"proargtypes":["2950","2950","2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_remote_review_ready_v1(jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='180865e9904e486adbe6dd79dca8f3b7'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"33217","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_remote_review_ready_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_review"],"proargtypes":["3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_remote_review_ready_v1(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='caf743cb4f9cb15dcb953b66f58b0f66'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29153","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"sync_worker_skills_to_taxonomy_capabilities","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_skills"],"proargtypes":["2950","1009"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='e6b5ddedcf9ab407fdb4cc1290261cff'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"33216","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_remote_only_activation_ready_v1","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account","p_skills"],"proargtypes":["2950","1009"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_remote_only_activation_ready_v1(uuid,text[])'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_get_worker_execution_modes(uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='0542f05ac69faa91e1c35c41be76bbe0'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"28953","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_get_worker_execution_modes","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_worker_profile_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_get_worker_execution_modes(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.worker_ai_service_mode_context_v1(uuid,uuid)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='7ce619ec7f03ec7a7970820c0e0a3ae1'
 AND p.prosecdef=false
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"31166","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"worker_ai_service_mode_context_v1","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id"],"proargtypes":["2950","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','private.worker_ai_service_mode_context_v1(uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='da686899f27ccccf73cbac91a4631fec'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29395","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_worker_ai_review_taxonomy","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_expected_revision","p_activate"],"proargtypes":["2950","23","16"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 16 :consttypmod -1 :constcollid 0 :constlen 1 :constbyval true :constisnull false :location -1 :constvalue 1 [ 0 0 0 0 0 0 0 0 ]})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='77d1f1620b0eebf3c4d8511a081bc656'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"30965","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_worker_ai_review_taxonomy_confirmed","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_expected_revision","p_activate","p_selected_modes"],"proargtypes":["2950","23","16","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='4d31769bfcb6b46a88ad3f46d2d3044e'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29453","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_finalize_reviewed_batch_service","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_outbox_id","p_lease_token","p_error_code"],"proargtypes":["2950","2950","25"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)')
 AND md5(replace(p.prosrc,E'\r\n',E'\n'))='d726b561c1f1585151592bec6177ea66'
 AND p.prosecdef=true
 AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND to_jsonb(p)-'prosrc'='{"oid":"29454","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_taxonomy_reconcile_reviewed_outbox_service","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog, private"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_limit"],"proargtypes":["23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 50 0 0 0 0 0 0 0 ]})","pronargdefaults":1}'::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%','public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"2f2d9ffa9bb33c8b3b2486d6ed2a71411e333c877ecb128e8b4950966b154d92","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r04_post$;
NOTIFY pgrst,'reload schema';
