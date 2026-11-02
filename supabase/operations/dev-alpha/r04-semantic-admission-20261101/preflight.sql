BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
DO $r04_flight$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 
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
END; $r04_flight$;

SELECT 'R04_SEMANTIC_DEV_PREIMAGE_MATCH' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;
