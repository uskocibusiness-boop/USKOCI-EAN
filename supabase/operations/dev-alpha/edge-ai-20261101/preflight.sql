-- Metadata-only prerequisite for both complete Edge bundles. Run again after each promotion.
-- External connector project identity and non-secret environment review are separate requirements.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='15s';
DO $edge_ai_preflight$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'EDGE_AI_CONTEXT_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_apply_legacy_need_turn_service(uuid,uuid,text,text,text,jsonb)')
 AND p.oid=22497 AND md5(pg_get_functiondef(p.oid))='3c761f5172063466ce7445fc1016da3e'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_apply_legacy_need_turn_service(uuid,uuid,text,text,text,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)')
 AND p.oid=27167 AND md5(pg_get_functiondef(p.oid))='095dec0dbda8ffded9559bc7ec4567f2'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)')
 AND p.oid=22493 AND md5(pg_get_functiondef(p.oid))='2999a947d41c85145f1efc41845e5621'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)')
 AND p.oid=27168 AND md5(pg_get_functiondef(p.oid))='8132d7d5b85951180515bcac49617fc9'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)')
 AND p.oid=22494 AND md5(pg_get_functiondef(p.oid))='ff2be465f91497787558d9d1a5cecdba'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)')
 AND p.oid=23248 AND md5(pg_get_functiondef(p.oid))='9a97dd0658b52d34f393ec5ba2f40888'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)')
 AND p.oid=22495 AND md5(pg_get_functiondef(p.oid))='059e496acdb47e24a0445e20a4193707'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)')
 AND p.oid=27165 AND md5(pg_get_functiondef(p.oid))='80fdcf88dc6e0cc067090a7bc16c0309'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)')
 AND p.oid=22951 AND md5(pg_get_functiondef(p.oid))='10e80907d1ad1da95e2843f0600dfa74'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)')
 AND p.oid=24275 AND md5(pg_get_functiondef(p.oid))='c5922708e5eab1d26c387bfae3cf56e8'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_test_release_unused_reservation_service(uuid)')
 AND p.oid=24308 AND md5(pg_get_functiondef(p.oid))='ff052d6f2dbb1985531e89689b886044'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_test_release_unused_reservation_service(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)')
 AND p.oid=24318 AND md5(pg_get_functiondef(p.oid))='4ce052d21e6ddab501c38fdd9a596c8f'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_claim_worker_ai_turn_service(uuid,uuid,uuid,text)')
 AND p.oid=23026 AND md5(pg_get_functiondef(p.oid))='67e1829d58d15aaab9c1be93c6f489df'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_claim_worker_ai_turn_service(uuid,uuid,uuid,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)')
 AND p.oid=23027 AND md5(pg_get_functiondef(p.oid))='5f0b6545dcde28bf2fcb4ea0f0393458'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)')
 AND p.oid=23584 AND md5(pg_get_functiondef(p.oid))='4f87aef652f0b2096fcdd8ab4f5b1832'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_fail_worker_ai_turn_service(uuid,uuid,uuid,uuid)')
 AND p.oid=23028 AND md5(pg_get_functiondef(p.oid))='9d1372fc918d145815b0caead814d646'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_fail_worker_ai_turn_service(uuid,uuid,uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_read_worker_ai_context_service(uuid,uuid)')
 AND p.oid=23025 AND md5(pg_get_functiondef(p.oid))='6bd424ebe7d0794386a6eed7d1d80d86'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_read_worker_ai_context_service(uuid,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)')
 AND p.oid=29072 AND md5(pg_get_functiondef(p.oid))='3edb20d40d11ded7b13787431e09877d'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_ai_catalog_context_service(text,integer,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[])')
 AND p.oid=28927 AND md5(pg_get_functiondef(p.oid))='520bcfceddaf1938b1a5d8aced58d64a'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_ai_scoped_preview_service(text,text,text,text[])'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)')
 AND p.oid=29357 AND md5(pg_get_functiondef(p.oid))='c363facdb26d33ae872e25e6a79e4306'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text)')
 AND p.oid=32947 AND md5(pg_get_functiondef(p.oid))='bcbbff3b28009d7ebf8f27aff8cfa1d2'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_fetch_snapshot_v1(integer)')
 AND p.oid=32613 AND md5(pg_get_functiondef(p.oid))='76a9eb7c34fab1c6623cac093bb4ff27'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_fetch_snapshot_v1(integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint)')
 AND p.oid=32632 AND md5(pg_get_functiondef(p.oid))='a1a61b2ec2422ed0eb0c90ad5deabaf6'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_query_catalog_service(jsonb)')
 AND p.oid=31271 AND md5(pg_get_functiondef(p.oid))='b0de0dc1c8128bd8835ef7150745a7a0'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_query_catalog_service(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text)')
 AND p.oid=32631 AND md5(pg_get_functiondef(p.oid))='3a9c40a677e1598381919b0d55dc832a'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%','public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text)'; END IF;
 IF to_regprocedure('public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'EDGE_AI_RECEIPT_RPC_RECAPTURE_REQUIRED'; END IF;
END $edge_ai_preflight$;
SELECT 'EDGE_AI_25_RPC_METADATA_MATCH' AS metadata_result,
 false AS environment_verified,false AS functional_acceptance_proven;
ROLLBACK;
