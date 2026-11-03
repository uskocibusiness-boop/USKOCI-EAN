BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
DO $r07_flight$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.application_calendar_conflict_v1(uuid)') AND p.oid=32140
 AND md5(pg_get_functiondef(p.oid))='d0709018ab2179a7b3decc9c4832fbd8'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"application_calendar_conflict_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_response_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.application_calendar_conflict_v1(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.my_application_state(text,integer,integer,text,boolean)') AND p.oid=24408
 AND md5(pg_get_functiondef(p.oid))='c9a5468bc93ebfd125427a3b49965ce0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"my_application_state","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_raw_status","p_submitted_revision","p_current_revision","p_need_status","p_has_agreement"],"proargtypes":["25","23","23","25","16"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"i","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.my_application_state(text,integer,integer,text,boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_application_rows(uuid)') AND p.oid=26585
 AND md5(pg_get_functiondef(p.oid))='e7547da52f5846c0fb7e88ae1f1766c5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_application_rows","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t"],"proargnames":["p_account","application_id","sort_at","need_id","current_need_revision","submitted_against_need_revision","current_version","raw_response_status","price_rsd","covered_slots","scope_note","submitted_at","title","description","raw_need_status","approximate_city","approximate_area","starts_at","ends_at","schedule_kind","execution_location_mode","task_timezone","price_mode","price_basis","required_slots","agreement_id","application_state","application_rank"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","1184","2950","23","23","23","25","23","23","25","1184","25","25","25","25","25","1184","1184","25","25","25","25","25","23","2950","25","23"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.own_application_rows(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_closure_api_guard()') AND p.oid=23208
 AND md5(pg_get_functiondef(p.oid))='5058f4c9de3e084477ca618031c53252'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_closure_api_guard","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"2278","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_closure_api_guard()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)') AND p.oid=26586
 AND md5(pg_get_functiondef(p.oid))='5cefaaea7a837cfaf5707cf5d42bd765'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications_page","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id","p_before_rank"],"proargtypes":["25","23","1184","2950","23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull true :location -1 :constvalue <>})","pronargdefaults":5}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications()') AND p.oid=21652
 AND md5(pg_get_functiondef(p.oid))='e323f8f5d4cc97e141be657074e416b8'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications()'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r07_flight$;

 SELECT 'R07_ATTENTION_DEV_PREIMAGE_MATCH' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;
