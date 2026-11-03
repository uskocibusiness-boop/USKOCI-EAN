-- R08 exact DEV transaction fragment. Use build.mjs --emit forward.
-- Connector target must independently be leqcwgzvjsxugfgzdmth; the local setting is an intent marker, not identity proof.
LOCK TABLE public.app_profiles,private.worker_ai_sessions,private.worker_ai_reviews,private.worker_ai_saves
 IN SHARE ROW EXCLUSIVE MODE;
DO $r08_pre$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r08.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R08_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.worker_need_fit_v1(uuid,uuid,boolean)')
  AND p.oid=27724
  AND md5(pg_get_functiondef(p.oid))='62c7c0a3889c2afd9b5951f6a394fe12'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_complete_worker_profile(uuid)')
  AND p.oid=20904
  AND md5(pg_get_functiondef(p.oid))='ba85aa79219961646c387ab64156a073'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)')
  AND p.oid=30965
  AND md5(pg_get_functiondef(p.oid))='365e33ee8addd418537c713c815ab422'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)')
  AND p.oid=29395
  AND md5(pg_get_functiondef(p.oid))='d8384414376ec427ba2f299610f8964e'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_save_worker_ai_review(uuid,text,uuid)')
  AND p.oid=23031
  AND md5(pg_get_functiondef(p.oid))='06fd3e603d0448766f7678ac4cd78738'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')
  AND p.oid=18060
  AND md5(pg_get_functiondef(p.oid))='2bd9a91b3f4b8179173c622c974270f9'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)')
  AND p.oid=20726
  AND md5(pg_get_functiondef(p.oid))='42cecbc9f0c7195f6d9edb6ccef45ca2'
  AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')
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
IF to_regprocedure('private.complete_worker_profile_v1(uuid,uuid,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_DEV_HELPER_ALREADY_PRESENT'; END IF;
IF to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_DEV_HELPER_ALREADY_PRESENT'; END IF;
IF to_regprocedure('private.worker_remote_review_ready_v1(jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_DEV_HELPER_ALREADY_PRESENT'; END IF;
IF EXISTS(SELECT 1 FROM public.app_profiles
 WHERE kind='WORKER' AND profile_status='ACTIVE' AND char_length(btrim(coalesce(city,'')))<2)
 THEN RAISE EXCEPTION 'R08_DEV_ACTIVE_CITYLESS_REQUIRES_FORWARD_RECOVERY'; END IF;
END; $r08_pre$;
CREATE OR REPLACE FUNCTION private.complete_worker_profile_v1(p_profile_id uuid, p_review_id uuid, p_displayed_digest text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_review private.worker_ai_reviews;
  v_session private.worker_ai_sessions;
  v_profile public.app_profiles%rowtype;
  v_previous_token text :=
    coalesce(current_setting('uskoci.profile_mutation', true), '');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;

  if v_profile.profile_status = 'ACTIVE' then
    return;
  end if;

  if v_profile.profile_status <> 'DRAFT' then
    raise exception 'PROFILE_NOT_ACTIVATABLE'
      using errcode = 'P0001',
            detail = v_profile.profile_status;
  end if;

  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;


  if char_length(btrim(v_profile.city)) < 2
    and private.worker_remote_only_activation_ready_v1(v_uid,v_profile.skills) IS NOT TRUE then
    if p_review_id is null or p_displayed_digest is null then
      raise exception 'CITY_REQUIRED' using errcode='P0001';
    end if;
    select * into v_review from private.worker_ai_reviews
     where id=p_review_id and account_id=v_uid;
    if not found or v_review.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then
      raise exception 'WORKER_AI_DENIED' using errcode='42501';
    end if;
    select * into v_session from private.worker_ai_sessions
     where conversation_id=v_review.conversation_id and account_id=v_uid for update;
    -- Save checked the live source hash BEFORE its own writes. Those writes
    -- change the hash: bind to the locked original session, not a new hash.
    if not found or v_session.profile_id is distinct from p_profile_id
      or v_review.revision is distinct from v_session.revision
      or v_review.base_hash is distinct from v_session.base_hash
      or v_review.envelope->'profile' is distinct from v_session.candidate
      or v_review.envelope->>'profileId' is distinct from p_profile_id::text
      or v_review.envelope->>'accountId' is distinct from v_uid::text
      or v_review.envelope->>'reviewId' is distinct from p_review_id::text
      or v_review.envelope->>'conversationId' is distinct from v_session.conversation_id::text
      or v_review.envelope->'revision' is distinct from to_jsonb(v_session.revision)
      or v_review.envelope->'activate' is distinct from 'true'::jsonb
      or v_review.envelope->'canAccept' is distinct from 'true'::jsonb
      or v_review.expires_at<clock_timestamp()
      or v_session.safety in ('BLOCK','REVIEW')
      or v_profile.display_name is distinct from v_session.candidate->>'displayName'
      or to_jsonb(v_profile.skills) is distinct from v_session.candidate->'skills'
      or p_displayed_digest is distinct from encode(extensions.digest(
        ((v_review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex')
      or exists(select 1 from private.worker_ai_turns where conversation_id=v_session.conversation_id and state='PROCESSING')
    then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
    perform 1 from private.work_taxonomy_control where singleton=true for share;
    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE then
      raise exception 'WORKER_AI_STALE' using errcode='PT409';
    end if;
  end if;


  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config(
    'uskoci.profile_mutation',
    'COMPLETE_WORKER_PROFILE',
    true
  );

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id
     and profile_status = 'DRAFT';

  if not found then
    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;

  perform private.requeue_open_needs_for_worker_v5(v_uid);

  perform set_config(
    'uskoci.profile_mutation',
    v_previous_token,
    true
  );
exception
  when others then
    perform set_config(
      'uskoci.profile_mutation',
      v_previous_token,
      true
    );
    raise;
end;
$function$;
REVOKE ALL ON FUNCTION private.complete_worker_profile_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
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
REVOKE ALL ON FUNCTION private.worker_remote_only_activation_ready_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.worker_remote_review_ready_v1(p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_exact jsonb;v_plans jsonb;
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
   WHERE p->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
     OR (p?'handoff' AND private.taxonomy_handoff_valid_v1(p->'handoff') IS NOT TRUE))
 THEN RETURN false; END IF;
 -- Only today's complete exact canonical/registered-alias set. User-selected
 -- modes never admit a future category or extend an existing category's scope.
 v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
   p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
 SELECT jsonb_agg(p.value-'handoff' ORDER BY p.ord) INTO v_plans
 FROM jsonb_array_elements(p_review->'classificationCandidates') WITH ORDINALITY p(value,ord);
 RETURN v_exact->>'status'='READY'
   AND p_review->'classificationCatalogVersion'=v_exact->'classificationCatalogVersion'
   AND p_review->'classificationCatalogFingerprint'=v_exact->'classificationCatalogFingerprint'
   AND p_review->'reviewedServiceModes'=v_exact->'reviewedServiceModes'
   AND v_plans=v_exact->'classificationCandidates';
END; $function$;
REVOKE ALL ON FUNCTION private.worker_remote_review_ready_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[]:='{}'; svc boolean := false; area boolean; dist numeric; radius numeric; tier integer;
  effective_skills text[]; required_skill text;
  v_tax_tier text;
begin
  select * into n from public.needs where id=nid;
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER';
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  if p.profile_status<>'ACTIVE' then hard:=array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id=p.account_id then hard:=array_append(hard,'OWN_NEED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  IF char_length(btrim(coalesce(p.city,'')))<2 OR EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl
      WHERE ctl.singleton AND ctl.enabled) THEN
    IF NOT private.taxonomy_scope_eligible_v1(n.id,p.account_id) THEN
      RETURN jsonb_build_object('matches',false,'service',false,'area',false,
        'timeTier',null,'distanceKm',null,'effectiveRadiusKm',null,
        'hard',jsonb_build_array('SIGNED_SERVICE_SCOPE_REQUIRED'),
        'taxonomyScope','UNCONFIRMED');
    END IF;
  END IF;

  -- 1. Area filter (radijus / mesto / workAreas)
  radius:=private.effective_radius_km(p.radius_km);
  if n.execution_location_mode='REMOTE' then
    dist:=null; area:=private.taxonomy_handoff_fit_v1(n.id,p.account_id);
  elsif jsonb_array_length(private.worker_saved_areas_v1(p.account_id))>0 then
    radius:=null; dist:=null;
    area:=private.worker_area_fit_v1(private.worker_saved_areas_v1(p.account_id),n.execution_location_mode,n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng);
  else
    select * into pref from public.worker_match_preferences where worker_profile_id=pid;
    dist:=private.haversine_km(n.approximate_lat,n.approximate_lng,pref.approximate_lat,pref.approximate_lng);
    area:=coalesce(case when dist is not null then dist<=radius
      else n.task_country_code is not null
        and n.task_country_code=p.operating_country_code
        and btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);
  end if;
  if p_first_refusal and not area then return jsonb_build_object('matches',false,'area',false); end if;

  -- 2. Service competency matching
  if n.category_id is not null then
    begin
      v_tax_tier := private.taxonomy_requirement_tier_inherited_v1(n.category_id, p.account_id);
      if v_tax_tier in ('EXACT', 'EQUIVALENT', 'RELATED_CONFIRMED', 'INHERITED_STANDARD') then
        svc := true;
      end if;
    exception when others then
      svc := false;
    end;
  end if;

  if not svc and n.category_id is null then
    effective_skills := array_remove(array[n.category]::text[],null);
    svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  end if;

  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  if not svc and n.category_id is null then
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;

  if svc and coalesce(cardinality(n.required_skills),0)>0 then
    foreach required_skill in array n.required_skills loop
      if not (
        coalesce(private.lower_arr(p.skills) && private.lower_arr(array[required_skill]),false)
        or coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(array[required_skill]),false)
      ) then
        svc:=false;
        exit;
      end if;
    end loop;
  end if;

  if p_first_refusal and not svc then return jsonb_build_object('matches',false,'service',false); end if;

  -- 3. Exclusions filter
  if coalesce(cardinality(p.exclusions),0)>0
     and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category,n.required_skills))
          or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category,n.required_skills)))
    then hard:=array_append(hard,'PROFILE_EXCLUSION'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- 4. Time filter
  tier:=private.worker_need_time_tier_v1(nid,pid);
  return jsonb_build_object('matches',cardinality(hard)=0 and svc and area and tier is not null,
    'service',svc,'area',area,'timeTier',tier,'distanceKm',dist,'effectiveRadiusKm',radius,'hard',to_jsonb(hard),
    'taxonomyTier',v_tax_tier);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_complete_worker_profile(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 BEGIN PERFORM private.complete_worker_profile_v1(p_profile_id,NULL,NULL); END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy_confirmed(p_conversation_id uuid, p_expected_revision integer, p_activate boolean, p_selected_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_modes jsonb;v_projection jsonb;
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

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_saved private.worker_ai_saves;v_previous record;v_retained jsonb:='[]'::jsonb;v_count integer;v_category uuid;
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

 -- A new untouched conversation may show the modes the owner already saved.
 -- This is continuity of an exact, current signed binding, not AI inference
 -- from a city, service wording, global flags, or a merely related category.
 if s.revision=0 and v_modes='[]'::jsonb
    and s.candidate=private.worker_ai_initial(auth.uid())
    and not exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id)
    and not exists(select 1 from private.work_taxonomy_gemini_turn_hints_v1
      where account_id=auth.uid() and conversation_id=p_conversation_id)
 then
   select * into v_saved from private.worker_ai_saves saved
    where saved.account_id=auth.uid() and saved.receipt->>'profileId'=s.profile_id::text
    order by saved.created_at desc,saved.review_id desc limit 1;
   if found and v_saved.receipt->'saved'='true'::jsonb
      and v_saved.receipt->'authoritative'='true'::jsonb
      and v_saved.receipt->>'profileStatus'='ACTIVE'
      and not exists(select 1 from private.worker_ai_saves other
        where other.account_id=auth.uid() and other.receipt->>'profileId'=s.profile_id::text
          and other.created_at=v_saved.created_at and other.review_id<>v_saved.review_id)
   then
     -- The profile row is locked above. Lock the exact binding and current
     -- consent rows too, so a withdrawal cannot race the continuity read.
     perform 1 from private.work_taxonomy_worker_bindings_v1 binding
       where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id
         and binding.request_key=v_saved.client_request_id for share;
     perform 1 from private.worker_execution_mode_choices choice
       where choice.worker_profile_id=s.profile_id for share;
     perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
       where mode.worker_account_id=auth.uid() for share;
     perform 1 from private.work_taxonomy_worker_capabilities capability
       where capability.worker_account_id=auth.uid() for share;
     select previous.*, binding.bound_at, batch.result as batch_result
       into v_previous
       from private.worker_ai_reviews previous
       join public.app_profiles profile on profile.id=s.profile_id
         and profile.account_id=auth.uid() and profile.kind='WORKER'
         and profile.profile_status='ACTIVE' and profile.updated_at<=v_saved.created_at
       join private.work_taxonomy_worker_bindings_v1 binding
         on binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id
        and binding.request_key=v_saved.client_request_id and binding.source_review_id=previous.id
       join private.work_taxonomy_review_batches_v1 batch
         on batch.owner_account_id=auth.uid() and batch.request_key=v_saved.client_request_id
        and batch.source_review_id=previous.id and batch.purpose='WORKER_CAPABILITY'
       join private.worker_execution_mode_choices choice
         on choice.worker_profile_id=s.profile_id and choice.worker_account_id=auth.uid()
        and choice.consent_source='EXPLICIT_PROFILE_REVIEW'
        and choice.confirmed_at=binding.bound_at and choice.updated_at=binding.bound_at
       where previous.id=v_saved.review_id and previous.account_id=auth.uid()
         and previous.envelope->>'profileId'=s.profile_id::text
         and previous.envelope->'profile'=s.candidate
         and previous.envelope->>'classificationState'='READY'
         and previous.envelope->'canAccept'='true'::jsonb
         -- Expiration limits the original Save, not the durable saved consent.
         and previous.created_at<=v_saved.created_at and v_saved.created_at<=previous.expires_at
         and binding.bound_at>=v_saved.created_at
         and binding.result->>'status'='BOUND_WORKER_SERVICES'
         and binding.result->>'workerProfileId'=s.profile_id::text
         and batch.result->>'status'='COMMITTED'
         and batch.result->'requiresBinding'='true'::jsonb
         and batch.catalog_version=binding.catalog_version
         and batch.plans=previous.envelope->'classificationCandidates'
         and batch.review_digest=previous.envelope->>'displayedContentDigest'
         and batch.review_digest=encode(extensions.digest(
           ((previous.envelope-'displayedContentDigest')||
             jsonb_build_object('baseHash',previous.base_hash))::text,'sha256'),'hex')
         and jsonb_typeof(previous.envelope->'reviewedServiceModes')='array'
         and jsonb_typeof(batch.result->'items')='array'
         and jsonb_array_length(previous.envelope->'reviewedServiceModes') between 1 and 24
         and jsonb_array_length(previous.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
         and jsonb_array_length(batch.plans)=jsonb_array_length(batch.result->'items')
         and binding.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
         and choice.modes = array(
           select distinct item->>'mode'
           from jsonb_array_elements(previous.envelope->'reviewedServiceModes') item
           order by item->>'mode');
     if found then
       for v_item in select value from jsonb_array_elements(v_previous.envelope->'reviewedServiceModes') loop
         select count(*),min(category.id::text)::uuid into v_count,v_category
         from jsonb_array_elements(v_previous.batch_result->'items') admitted(value)
         join private.work_taxonomy_categories category on category.id::text=admitted.value->>'categoryId'
         join private.work_taxonomy_category_modes scope on scope.category_id=category.id
           and scope.execution_scope=v_item->>'mode'
         join private.taxonomy_confirmed_worker_modes_v1 mode
           on mode.worker_account_id=auth.uid() and mode.category_id=category.id
          and mode.execution_scope=scope.execution_scope and mode.active
          and mode.source_review_id=v_saved.review_id and mode.source_request_key=v_saved.client_request_id
          and mode.confirmed_at=v_previous.bound_at
         join private.work_taxonomy_worker_capabilities capability
           on capability.worker_account_id=auth.uid() and capability.category_id=category.id
          and not capability.excluded and capability.origin='WORKER_CONFIRMED'
          and capability.confirmed_at=v_previous.bound_at and capability.updated_at<=v_previous.bound_at
         where admitted.value->>'service'=v_item->>'service'
           and admitted.value->>'mode'=v_item->>'mode'
           and v_item->>'mode' in ('ON_SITE','REMOTE')
           and exists(select 1 from jsonb_array_elements(s.candidate->'skills') skill(value)
             where skill.value=to_jsonb(v_item->>'service'))
           and category.state='ESTABLISHED'
           and (category.canonical_key=private.taxonomy_normalize_v1(v_item->>'service')
             or exists(select 1 from private.work_taxonomy_aliases alias
               where alias.category_id=category.id
                 and alias.normalized_key=private.taxonomy_normalize_v1(v_item->>'service')));
         if v_count<>1 then v_modes:='[]'::jsonb;v_retained:='[]'::jsonb;exit; end if;
         v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
         v_retained:=v_retained||jsonb_build_array(jsonb_build_object(
           'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_category));
       end loop;
     end if;
   end if;
 end if;
 -- The independent helper requires ALL displayed services, exact established
 -- category+scope and current catalog. Unknown work stays pending.
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 -- Exact projection must resolve to the same retained category in today's
 -- catalog. An alias that moved or became ambiguous cannot grant a new skill.
 if v_retained<>'[]'::jsonb and v_projection->>'status'='READY'
   and exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') projected(value)
     where not exists(select 1 from jsonb_array_elements(v_retained) retained(value)
       where retained.value->>'service'=projected.value->>'service'
         and retained.value->>'mode'=projected.value->>'mode'
         and retained.value->>'categoryId'=projected.value->>'categoryId'))
 then
   v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);
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

CREATE OR REPLACE FUNCTION public.rpc_save_worker_ai_review(p_review_id uuid, p_displayed_digest text, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; cmd private.worker_ai_saves; p public.app_profiles; value jsonb; receipt jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 if p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-save:'||auth.uid()::text||p_client_request_id::text,0));
 select * into r from private.worker_ai_reviews where id=p_review_id and account_id=auth.uid();
 if not found or r.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into s from private.worker_ai_sessions where conversation_id=r.conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into cmd from private.worker_ai_saves where account_id=auth.uid() and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='PT409'; end if;
 select * into cmd from private.worker_ai_saves where review_id=r.id;
 if found then return cmd.receipt; end if;
 perform 1 from public.ai_conversations where id=s.conversation_id and account_id=auth.uid() and purpose='PROFILE' and status='OPEN' for update;
 if not found then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if r.revision<>s.revision or r.base_hash<>private.worker_ai_source_hash(auth.uid()) or r.expires_at<clock_timestamp()
  or r.envelope->'profile'<>s.candidate or r.envelope->'canAccept'<>'true'::jsonb or s.safety in ('BLOCK','REVIEW')
  or exists(select 1 from private.worker_ai_turns where conversation_id=s.conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is not null and (p.id<>s.profile_id or p.profile_status not in ('DRAFT','ACTIVE')) then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 value:=r.envelope->'profile';
 -- WPP01: legacy keys stay on the wire, but may not request a retired-field change.
 -- Compare the reviewed values exactly with the locked current profile (or bootstrap
 -- defaults). Never silently discard a change the owner just reviewed.
 if value->'tools' is distinct from coalesce(to_jsonb(p.tools),'[]'::jsonb)
  or value->'vehicles' is distinct from coalesce(to_jsonb(p.vehicles),'[]'::jsonb)
  or value->'licenses' is distinct from coalesce(to_jsonb(p.licenses),'[]'::jsonb)
  or value->'teamCapacity' is distinct from to_jsonb(coalesce(p.team_capacity,1))
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is null then
  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills'))) returning * into p;
 else
  update public.app_profiles set display_name=value->>'displayName',bio=value->>'bio',
   skills=array(select jsonb_array_elements_text(value->'skills')) where id=p.id;
 end if;
 if value->'location'<>private.worker_location_document(p.id)-array['profileId','accountId','revision'] then
  perform public.rpc_save_worker_location(private.worker_location_document(p.id)->>'revision',value->'location',true);
 end if;
 perform public.rpc_save_worker_availability(private.worker_availability_document(p.id)->>'revision',value->'availability');
 -- WPP01: preserve existing deprecated capacity; new profiles use the stored default.
 if (r.envelope->>'activate')::boolean then perform private.complete_worker_profile_v1(p.id,r.id,p_displayed_digest); end if;
 update public.ai_conversations set status='COMPLETED',completed_at=clock_timestamp() where id=s.conversation_id;
 receipt:=jsonb_build_object('reviewId',r.id,'conversationId',s.conversation_id,'accountId',auth.uid(),'profileId',p.id,
  'profileStatus',(select profile_status from public.app_profiles where id=p.id),'saved',true,'authoritative',true);
 insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values(r.id,auth.uid(),p_client_request_id,receipt);
 return receipt;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_select_response(p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_requested_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_command private.selection_commands%rowtype;
  v_policy private.connection_policy_versions%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selected_by uuid;
  v_legacy_need_revision integer;
  v_legacy_response_id uuid;
  v_legacy_covered_slots integer;
  v_legacy_agreement_id uuid;
  v_legacy_response_version integer;
  v_legacy_content_hash text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode = '22023';
  end if;

  select * into v_requested_ver
    from public.marketplace_response_versions
   where response_id = p_response_id
     and version = p_response_version;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId', uid,
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'responseId', p_response_id,
    'responseVersion', p_response_version,
    'contentHash', p_content_hash,
    'coveredSlots', v_requested_ver.covered_slots
  )::text, 'UTF8')), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':' || p_client_request_id, 7242)
  );

  select * into v_command
    from private.selection_commands c
   where c.requester_account_id = uid
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_command.agreement_id;
  end if;

  -- Pre-P0D-02/P0D-03 historical rows remain authoritative and are not
  -- retroactively charged or given fabricated activation receipts.
  select s.selected_by_account_id,
         s.need_revision,
         s.response_id,
         s.covered_slots,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selected_by,
         v_legacy_need_revision,
         v_legacy_response_id,
         v_legacy_covered_slots,
         v_legacy_agreement_id,
         v_legacy_response_version,
         v_legacy_content_hash
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
    left join public.agreement_versions av
      on av.agreement_id = a.id and av.version = 1
   where s.need_id = p_need_id
     and s.client_request_id = p_client_request_id;

  if found then
    if v_legacy_selected_by <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_need_revision <> p_need_revision
       or v_legacy_response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_covered_slots <> v_requested_ver.covered_slots)
       or (v_legacy_response_version is not null
           and v_legacy_response_version <> p_response_version)
       or (v_legacy_content_hash is not null
           and v_legacy_content_hash <> p_content_hash) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_legacy_agreement_id;
  end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001', hint = 'Rok za prijave je istekao.';
  end if;

  -- Existing agreements and idempotent selection receipts returned above.
  -- Only a NEW selection is refused after the actual task-time boundary.
  if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  select * into v_profile
    from public.app_profiles p
   where p.id = v_resp.worker_profile_id
   for share;

  if not found
     or v_profile.kind <> 'WORKER'
     or v_profile.account_id <> v_resp.worker_account_id
     or v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or (char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)
     or cardinality(v_profile.skills) < 1 then
    raise exception 'WORKER_PROFILE_NOT_READY' using errcode = 'P0001',
      hint = 'Uskocer vise nema vazeci spreman profil za izbor.';
  end if;

  -- WPP01: accept the people committed by this offer, subject to the
  -- existing task remaining-slot, calendar and price checks below.

  if (v_ver.proposed_start_at is null)<>(v_ver.proposed_end_at is null) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
    and (v_need.starts_at is null or not isfinite(v_need.starts_at)
      or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- An old start-only task cannot be selected after its precise beginning.
  if v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is null
     and v_need.starts_at is not null and v_need.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, v_resp.worker_profile_id,
    coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  -- Start-only selection must still reject an existing confirmed Dogovor
  -- that blocks the precise declared start. One microsecond is only a
  -- point-overlap probe, NOT a booked duration or task finish.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and
     private.worker_calendar_conflict(v_resp.worker_profile_id,v_need.starts_at,
       v_need.starts_at+interval '1 microsecond',null) then
    raise exception 'WORKER_CALENDAR_CONFLICT' using errcode='P0001';
  end if;
  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001', hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  -- PKG-033: historical/reconfirmed offers cannot bypass today's fixed-price rule at selection.
  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);

  select * into v_policy
    from private.connection_policy_versions
   where policy_key='REQUESTER_SELECTION_V1' and version=1;
  if not found
     or v_policy.beneficiary_role <> 'REQUESTER'
     or v_policy.activation_reason <> 'SELECTION'
     or v_policy.charge_mode <> 'PROMOTIONAL_FREE'
     or v_policy.unit_basis <> 'HEADCOUNT'
     or v_policy.platform_cost_rsd <> 0 then
    raise exception 'CONNECTION_POLICY_NOT_READY' using errcode='55000';
  end if;

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    p_need_id,v_need.revision,uid,p_client_request_id,v_resp.covered_slots,
    p_response_id,v_resp.worker_account_id,v_resp.worker_profile_id,
    case when v_need.mode='FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
    'SELECTED'
  ) returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd',v_ver.price_rsd,'covered_slots',v_ver.covered_slots,
    -- Agreement calendar terms stay an honest complete pair or BOTH NULL.
    -- A declared start-only moment stays authoritative on the task; it is
    -- not a fabricated booking in private.agreement_calendar_interval().
    'proposed_start_at',coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    'proposed_end_at',coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end),
    'schedule_source',case when v_ver.proposed_start_at is not null then 'APPLICATION_PROPOSAL'
      when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then 'NEED_FIXED_WINDOW' else 'UNSCHEDULED' end,
    'scope_note',v_ver.scope_note,'need_revision',v_need.revision,
    'response_version',v_ver.version
  );
  -- Snapshot the requested exact start separately from the calendar reservation.
  -- Calendar interval uses ONLY a complete proposed_start_at/proposed_end_at pair.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and v_need.starts_at is not null then
    v_terms:=v_terms||jsonb_build_object('declared_start_at',v_need.starts_at);
  end if;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    p_need_id,v_selection_id,p_response_id,v_need.requester_account_id,v_need.requester_profile_id,
    v_resp.worker_account_id,v_resp.worker_profile_id,1,'CONFIRMED'
  ) returning id into v_agreement_id;

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (v_agreement_id,1,'CONFIRMED',v_terms,v_ver.content_hash,uid);

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values (
    v_agreement_id,1,
    -- PKG-029b (deep read 12.7): remote or physical follows the place; the schedule decides only for a task
    -- written before the place had a mode.
    case when coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')
      then 'REMOTE' else 'PHYSICAL' end,
    'CONFIRMED'
  );

  insert into private.connection_activations(
    requester_account_id,beneficiary_account_id,client_request_id,request_hash,
    policy_key,policy_version,policy_snapshot,activation_reason,
    need_id,need_revision,selection_id,agreement_id,response_id,response_version,
    response_content_hash,worker_account_id,worker_profile_id,units,platform_cost_rsd,state
  ) values (
    uid,uid,p_client_request_id,v_request_hash,
    v_policy.policy_key,v_policy.version,v_policy.policy_snapshot,'SELECTION',
    p_need_id,p_need_revision,v_selection_id,v_agreement_id,p_response_id,p_response_version,
    p_content_hash,v_resp.worker_account_id,v_resp.worker_profile_id,v_ver.covered_slots,0,'SATISFIED'
  );

  update public.marketplace_responses
     set status='SELECTED',selected_at=statement_timestamp()
   where id=p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status=case when v_covered+v_resp.covered_slots >= v_need.required_slots
                     then 'ACTIVE' else 'SELECTION' end
   where id=p_need_id;

  insert into private.selection_commands(
    requester_account_id,client_request_id,request_hash,
    need_id,need_revision,response_id,response_version,
    response_content_hash,covered_slots,selection_id,agreement_id
  ) values (
    uid,p_client_request_id,v_request_hash,
    p_need_id,p_need_revision,p_response_id,p_response_version,
    p_content_hash,v_ver.covered_slots,v_selection_id,v_agreement_id
  );

  -- N02: domain event shares the Selection/Agreement/activation transaction.
  -- Preferences, suppression and channel dedupe remain owned by emit_event.
  perform private.emit_event(
    v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED',
    'RESPONSE', v_resp.id, v_ver.version,
    'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
    'response_selected:' || v_selection_id::text,
    'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)
  );

  return v_agreement_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_submit_response(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  if not private.accounts_same_world(n.requester_account_id, u) then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  -- New work uses the same actual task-time boundary as search/dispatch.
  -- Replay already returned above; evaluate after the Need lock was acquired.
  if not private.need_search_time_admitted_v1(n.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or (char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or not isfinite(n.starts_at)
      or (n.ends_at is not null and (not isfinite(n.ends_at) or n.starts_at>=n.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- Start-only appointment cannot accept a new offer after its start while lifecycle tick catches up.
  if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
     and n.starts_at is not null and n.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd,
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'coveredSlots', p_covered_slots,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  -- PRE-V3: persisted version trigger owns Application semantic events.

  return v_result;
end;
$function$;

DO $r08_post$ BEGIN
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
END; $r08_post$;
NOTIFY pgrst,'reload schema';
