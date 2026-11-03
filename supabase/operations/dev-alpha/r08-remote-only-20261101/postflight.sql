BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
DO $r08_readback$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
THEN RAISE EXCEPTION 'R08_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_need_fit_v1(uuid,uuid,boolean)')
  
  AND md5(pg_get_functiondef(p.oid))='0921f754622d5402d653d2cd24a94650'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_profile(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='13651d6a2ce5b60815a1f2537f9a4121'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='30b6a3929d566f384d6b194a75ce8a4d'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)')
  
  AND md5(pg_get_functiondef(p.oid))='9befd52ecc461a4df1fd0fa9de4dcb62'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_save_worker_ai_review(uuid,text,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='4228b28e9741f4cc4b6a033a6349ea11'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')
  
  AND md5(pg_get_functiondef(p.oid))='8a3b3dcd99a2155bc963800b8306dc53'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)')
  
  AND md5(pg_get_functiondef(p.oid))='4d627956f0b8c0b7324cfedfa7ede08b'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.complete_worker_profile_v1(uuid,uuid,text)')
  
  AND md5(pg_get_functiondef(p.oid))='55b1f3c8a52a7bc6fa9b9bf694129adc'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])')
  
  AND md5(pg_get_functiondef(p.oid))='3ab76e9f973658ad21f899d4868ecd77'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_remote_review_ready_v1(jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='a48fba396bc51e6e287e7e4e76e41f89'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('auth.uid()')
  
  AND md5(pg_get_functiondef(p.oid))='ea3b41bf29e2ad573067939329aa088e'
  AND pg_get_userbyid(p.proowner)='supabase_auth_admin' AND p.proacl::text IS NOT DISTINCT FROM '{=X/supabase_auth_admin,supabase_auth_admin=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.digest(bytea,text)')
  
  AND md5(pg_get_functiondef(p.oid))='85b88685f74a398b1ff164ad33eeaaca'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{=X/postgres,postgres=X*/postgres,dashboard_user=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.digest(text,text)')
  
  AND md5(pg_get_functiondef(p.oid))='95de9cf8798b911a1fe38c27bdb570de'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{=X/postgres,postgres=X*/postgres,dashboard_user=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.gen_random_uuid()')
  
  AND md5(pg_get_functiondef(p.oid))='6504babb8130d35e393998bd2856ec61'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{=X/postgres,postgres=X*/postgres,dashboard_user=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.accounts_same_world(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='2d6beb6df93bc8eb6ae2622de8319ac5'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.agreement_calendar_interval(jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='7076de060b68e9d216aff702e8e68bc5'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.assert_application_price_v5(public.needs,integer,integer)')
  
  AND md5(pg_get_functiondef(p.oid))='5bcd4801d14adb03503cfb1233ecde2d'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_assert_open(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='1d0e22224d546c4756f216acfe103246'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.effective_radius_km(integer)')
  
  AND md5(pg_get_functiondef(p.oid))='aaf84a1425262215800ae7cfa2d9ee13'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone)')
  
  AND md5(pg_get_functiondef(p.oid))='d2f2e43a17562e24cadd721cc9c1903d'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.haversine_km(numeric,numeric,numeric,numeric)')
  
  AND md5(pg_get_functiondef(p.oid))='5a5848cbf4f91f2f216290e00cf89f1e'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.identity_admitted(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='48435c7dd78a2ae47bf18376a63d605c'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.lower_arr(text[])')
  
  AND md5(pg_get_functiondef(p.oid))='e5c312154cab99884d794656bb9b2550'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)')
  
  AND md5(pg_get_functiondef(p.oid))='9a1a961940c46c4c2e45f229f7419052'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.need_search_time_admitted_v1(uuid,timestamp with time zone)')
  
  AND md5(pg_get_functiondef(p.oid))='e72b25a26bc41c79bdd5b194844c8950'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.normalize_worker_ai_availability(uuid,uuid,jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='9b5065e302cf16fd4c53ee0a80d68a64'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.requeue_open_needs_for_worker_v5(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='73f0b957bcedd7ed86c369d6124a493f'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_admission_fingerprint_v1()')
  
  AND md5(pg_get_functiondef(p.oid))='4d0ef4615b244b3a8468f54d04ccf855'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_handoff_fit_v1(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='2e6db47c1548ef7c19da33e8926ae0b0'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_handoff_valid_v1(jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='de8d37190d70e0534bfc123d7b247b1f'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_normalize_v1(text)')
  
  AND md5(pg_get_functiondef(p.oid))='8185e305017348588028e92397866b35'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_pending_saved_event_v1()')
  
  AND md5(pg_get_functiondef(p.oid))='d8069f5367fe5c731c1eea192f7370a3'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='475c5bd17a959166dc38e7bee1d6e193'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_queue_review_after_save_v1()')
  
  AND md5(pg_get_functiondef(p.oid))='38dff2c9f6f62d91d97a2db8a172d877'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_requirement_tier_inherited_v1(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='8b5e5f7403efcf58d8e90be7c9ed27e2'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='e318d1e43e4a045f09be19138016ccd8'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='a461fef793d82272e73ecdaeab7f4121'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_scope_eligible_v1(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='e3007d8a8dc5fdb25d6de97457ac5594'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.work_kinds_v5(text[])')
  
  AND md5(pg_get_functiondef(p.oid))='09891e19cad7b45c9553f2d1773985d1'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_area_source_continuity_v1()')
  
  AND md5(pg_get_functiondef(p.oid))='a153a52eddf134bd815e5258d7e2e4e6'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_initial(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='e74f666d636b83d53e5795450a774202'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_ai_source_hash(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='d50edbb9666e5d0e5e12ec2dca18172e'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric)')
  
  AND md5(pg_get_functiondef(p.oid))='89bb9de67e0cae401b0447636a9e0939'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_availability_document(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='c9aa32104844874a5552a32661faf27c'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_calendar_conflict(uuid,timestamp with time zone,timestamp with time zone,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='38cee82310eab26151d2c782e57694ea'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_location_document(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='c9d518a186eac359d3eb9713ab23f8e7'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_need_time_tier_v1(uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='2ec15c30354ecc5c438007437a10d5eb'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_saved_areas_v1(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='4b9e8a4114dc962f58aa5488b2ee9675'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.fn_need_covered_slots(uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='2af495e39320cac525dd15fe16a5e3a6'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_closure_api_guard()')
  
  AND md5(pg_get_functiondef(p.oid))='5058f4c9de3e084477ca618031c53252'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_save_worker_availability(text,jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='1e7f417bb69e334305366ded32cad4ad'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_save_worker_location(text,jsonb,boolean)')
  
  AND md5(pg_get_functiondef(p.oid))='c88c33b42d24eaa86c31df266be5ef9e'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)')
  
  AND md5(pg_get_functiondef(p.oid))='444f894480a032d764d676de20549ebe'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)')
  
  AND md5(pg_get_functiondef(p.oid))='3cd05dc50ec8de32686c3e6e848d89a7'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
 IF (WITH names(name) AS (VALUES ('auth.uid'),('extensions.digest'),('extensions.gen_random_uuid'),('private.accounts_same_world'),('private.agreement_calendar_interval'),('private.assert_application_price_v5'),('private.closure_assert_open'),('private.effective_radius_km'),('private.emit_event'),('private.haversine_km'),('private.identity_admitted'),('private.lower_arr'),('private.match_detail_for_calendar_interval'),('private.need_search_time_admitted_v1'),('private.normalize_worker_ai_availability'),('private.requeue_open_needs_for_worker_v5'),('private.taxonomy_admission_fingerprint_v1'),('private.taxonomy_handoff_fit_v1'),('private.taxonomy_handoff_valid_v1'),('private.taxonomy_normalize_v1'),('private.taxonomy_pending_saved_event_v1'),('private.taxonomy_preserve_review_handoff_v1'),('private.taxonomy_queue_review_after_save_v1'),('private.taxonomy_requirement_tier_inherited_v1'),('private.taxonomy_review_candidate_projection_v2'),('private.taxonomy_review_exact_projection_v1'),('private.taxonomy_scope_eligible_v1'),('private.work_kinds_v5'),('private.worker_ai_area_source_continuity_v1'),('private.worker_ai_initial'),('private.worker_ai_source_hash'),('private.worker_area_fit_v1'),('private.worker_availability_document'),('private.worker_calendar_conflict'),('private.worker_location_document'),('private.worker_need_fit_v1'),('private.worker_need_time_tier_v1'),('private.worker_saved_areas_v1'),('public.fn_need_covered_slots'),('public.rpc_closure_api_guard'),('public.rpc_complete_worker_profile'),('public.rpc_prepare_worker_ai_review_taxonomy'),('public.rpc_prepare_worker_ai_review_taxonomy_confirmed'),('public.rpc_save_worker_ai_review'),('public.rpc_save_worker_availability'),('public.rpc_save_worker_location'),('public.rpc_select_response'),('public.rpc_submit_response'),('public.rpc_taxonomy_bind_reviewed_worker_service'),('public.rpc_taxonomy_commit_reviewed_batch_service')),
f AS(SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN names ON names.name=n.nspname||'.'||p.proname),
tables AS(SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname||'.'||c.relname IN('private.worker_need_fit_v1','public.needs','public.app_profiles','public.worker_match_preferences','private.taxonomy_match_scope_control_v1','private.taxonomy_scope_eligible_v1','private.effective_radius_km','private.taxonomy_handoff_fit_v1','private.worker_saved_areas_v1','private.worker_area_fit_v1','private.haversine_km','private.taxonomy_requirement_tier_inherited_v1','private.lower_arr','private.accounts_same_world','private.identity_admitted','private.work_kinds_v5','private.worker_need_time_tier_v1','public.rpc_complete_worker_profile','private.requeue_open_needs_for_worker_v5','public.rpc_prepare_worker_ai_review_taxonomy_confirmed','private.worker_ai_sessions','private.worker_ai_reviews','private.closure_assert_open','public.ai_conversations','private.worker_ai_source_hash','private.worker_ai_turns','private.worker_ai_initial','private.normalize_worker_ai_availability','private.taxonomy_admission_fingerprint_v1','private.taxonomy_review_candidate_projection_v2','private.taxonomy_preserve_review_handoff_v1','public.rpc_prepare_worker_ai_review_taxonomy','private.worker_ai_saves','private.work_taxonomy_gemini_turn_hints_v1','private.work_taxonomy_control','private.work_taxonomy_worker_bindings_v1','private.worker_execution_mode_choices','private.taxonomy_confirmed_worker_modes_v1','private.work_taxonomy_worker_capabilities','private.work_taxonomy_review_batches_v1','private.work_taxonomy_categories','private.work_taxonomy_category_modes','private.taxonomy_normalize_v1','private.work_taxonomy_aliases','private.taxonomy_review_exact_projection_v1','public.rpc_save_worker_ai_review','private.worker_location_document','public.rpc_save_worker_location','public.rpc_save_worker_availability','private.worker_availability_document','public.rpc_select_response','public.marketplace_responses','public.marketplace_response_versions','private.selection_commands','private.connection_policy_versions','public.need_selections','public.agreements','public.agreement_versions','private.need_search_time_admitted_v1','private.match_detail_for_calendar_interval','private.worker_calendar_conflict','public.fn_need_covered_slots','private.assert_application_price_v5','private.agreement_calendar_interval','public.agreement_execution','private.connection_activations','private.emit_event','public.rpc_submit_response','private.response_submit_commands','private.response_application_snapshots','public.opportunity_deliveries') AND c.relkind IN('r','p','v'))
, capture AS (
SELECT jsonb_build_object('unit','R08_DEV_DEPENDENCIES','captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',f.oid::regprocedure::text,'definition',pg_get_functiondef(f.oid),'definition_md5',md5(pg_get_functiondef(f.oid)),'owner',pg_get_userbyid(f.proowner),'acl',f.proacl::text,'security_definer',f.prosecdef,'config',f.proconfig) ORDER BY f.oid::regprocedure::text) FROM f),
'missing_names',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]'::jsonb) FROM names WHERE NOT EXISTS(SELECT 1 FROM f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname||'.'||f.proname=names.name)),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',t.oid::regclass::text,'owner',pg_get_userbyid(t.relowner),'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'acl',t.relacl::text,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT coalesce(jsonb_agg(pg_get_constraintdef(c.oid,true) ORDER BY c.conname),'[]'::jsonb) FROM pg_constraint c WHERE c.conrelid=t.oid),
'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=t.oid),
'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,'definition',pg_get_triggerdef(g.oid,true),'function_md5',md5(pg_get_functiondef(g.tgfoid))) ORDER BY g.tgname),'[]'::jsonb) FROM pg_trigger g WHERE g.tgrelid=t.oid AND NOT g.tgisinternal)) ORDER BY t.oid::regclass::text) FROM tables t)) AS capture)
SELECT md5((capture->'tables')::text) FROM capture) IS DISTINCT FROM 'b181b977e466acad94828438658a4856'
 THEN RAISE EXCEPTION 'R08_DEV_RELATION_DRIFT'; END IF;

END; $r08_readback$;
SELECT 'R08_DEV_POSTIMAGE_MATCH' AS metadata_result,
 false AS functional_acceptance_proven;
ROLLBACK;
