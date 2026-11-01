BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
DO $r03_flight$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 
 THEN RAISE EXCEPTION 'R03_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.need_candidate_states_v5(uuid)') AND p.oid=25184
 AND md5(pg_get_functiondef(p.oid))='f87f872758b5caa618ab96864fe96ade'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"need_candidate_states_v5","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t"],"proargnames":["p_need_id","response_id","candidate_state"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","25"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.need_candidate_states_v5(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_task_counts(uuid)') AND p.oid=26483
 AND md5(pg_get_functiondef(p.oid))='4d0829799f882b287f7ec8f5c65d6917'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_task_counts","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["a"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.own_task_counts(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.covered_slots(public.needs)') AND p.oid=20877
 AND md5(pg_get_functiondef(p.oid))='72ea2b656f8820051ea944e127f49c41'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"covered_slots","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=public, pg_temp"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.covered_slots(public.needs)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)') AND p.oid=24409
 AND md5(pg_get_functiondef(p.oid))='dae2f244c3ab670656faa14b6802dfdf'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_needs_page","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id"],"proargtypes":["25","23","1184","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":4}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_tasks()') AND p.oid=25284
 AND md5(pg_get_functiondef(p.oid))='1d66fe6d246a74b28cd8694bdbd59a65'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_tasks","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_tasks()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_read_task(uuid)') AND p.oid=25283
 AND md5(pg_get_functiondef(p.oid))='abd68dacd327eeb6bd65956ed38db661'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_read_task","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_read_task(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_storage_account_open()') AND p.oid=23212
 AND md5(pg_get_functiondef(p.oid))='04337720544e1f60b8ba635ea01e4814'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_storage_account_open","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_storage_account_open()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.selectable_application_count(public.needs)') AND p.oid=25187
 AND md5(pg_get_functiondef(p.oid))='1e7a5030bb534aa2fd7874e6ae5fa8af'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"selectable_application_count","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.selectable_application_count(public.needs)'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R03_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r03_flight$;

 SELECT 'R03_DEV_POSTIMAGE_MATCH' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;
