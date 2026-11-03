LOCK TABLE auth.users,private.account_lineage_v5,private.dispatch_schedule,private.taxonomy_confirmed_worker_modes_v1,private.work_taxonomy_gemini_turn_hints_v1,private.work_taxonomy_related_acceptances,private.work_taxonomy_review_batches_v1,private.work_taxonomy_review_outbox_v1,private.work_taxonomy_worker_bindings_v1,private.work_taxonomy_worker_capabilities,private.worker_ai_reviews,private.worker_ai_saves,private.worker_ai_sessions,private.worker_execution_mode_choices,public.ai_conversations,public.app_accounts,public.app_profiles IN SHARE ROW EXCLUSIVE MODE;
DO $r08_acceptance_surface$ BEGIN
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('auth.users') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('auth.users')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER on_uskoci_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_uskoci_auth_user_created()","signature":"public.handle_uskoci_auth_user_created()","md5":"615ed4cdd12d6c0576a39b1a886c69c6","enabled":"O"},{"definition":"CREATE TRIGGER on_uskoci_auth_user_updated AFTER UPDATE OF email, phone ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_uskoci_auth_user_updated()","signature":"public.handle_uskoci_auth_user_updated()","md5":"49549df579363a582c6c544dc27b8da8","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('auth.users') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.account_lineage_v5') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.account_lineage_v5')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[],"rules":[]}'::jsonb
   OR to_regclass('private.account_lineage_v5') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.dispatch_schedule') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.dispatch_schedule')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[],"rules":[]}'::jsonb
   OR to_regclass('private.dispatch_schedule') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.taxonomy_confirmed_worker_modes_v1') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.taxonomy_confirmed_worker_modes_v1')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.taxonomy_confirmed_worker_modes_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''worker_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.taxonomy_confirmed_worker_modes_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''worker_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.taxonomy_confirmed_worker_modes_v1') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_gemini_turn_hints_v1') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_gemini_turn_hints_v1')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_gemini_turn_hints_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_gemini_turn_hints_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_gemini_turn_hints_v1') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_related_acceptances') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_related_acceptances')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_related_acceptances FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''worker_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_related_acceptances FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''worker_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_related_acceptances') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_review_batches_v1') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_review_batches_v1')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_review_batches_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''owner_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_review_batches_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''owner_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_review_batches_v1') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_review_outbox_v1') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_review_outbox_v1')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_review_outbox_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''owner_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_review_outbox_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''owner_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_review_outbox_v1') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_worker_bindings_v1') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_worker_bindings_v1')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_worker_bindings_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''owner_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_worker_bindings_v1 FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''owner_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"},{"definition":"CREATE TRIGGER taxonomy_signed_worker_bound_requeue_v1 AFTER INSERT ON private.work_taxonomy_worker_bindings_v1 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_signed_binding_requeue_v1()","signature":"private.taxonomy_signed_binding_requeue_v1()","md5":"ce3044e3291ae866b15a4d2dfa0396fc","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_worker_bindings_v1') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.work_taxonomy_worker_capabilities') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.work_taxonomy_worker_capabilities')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.work_taxonomy_worker_capabilities FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''worker_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.work_taxonomy_worker_capabilities FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''worker_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.work_taxonomy_worker_capabilities') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.worker_ai_reviews') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.worker_ai_reviews')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER worker_ai_review_immutable BEFORE UPDATE ON private.worker_ai_reviews FOR EACH ROW EXECUTE FUNCTION private.ai_task_review_immutable()","signature":"private.ai_task_review_immutable()","md5":"1d8a898da488db23c65c7debd9c0ebfb","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.worker_ai_reviews') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.worker_ai_saves') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.worker_ai_saves')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER taxonomy_enqueue_worker_saved_v1 AFTER INSERT ON private.worker_ai_saves FOR EACH ROW EXECUTE FUNCTION private.taxonomy_queue_review_after_save_v1()","signature":"private.taxonomy_queue_review_after_save_v1()","md5":"38dff2c9f6f62d91d97a2db8a172d877","enabled":"O"},{"definition":"CREATE TRIGGER taxonomy_pending_worker_save_v1 AFTER INSERT ON private.worker_ai_saves FOR EACH ROW EXECUTE FUNCTION private.taxonomy_pending_saved_event_v1()","signature":"private.taxonomy_pending_saved_event_v1()","md5":"d8069f5367fe5c731c1eea192f7370a3","enabled":"O"},{"definition":"CREATE TRIGGER worker_ai_area_source_continuity_v1 AFTER INSERT ON private.worker_ai_saves FOR EACH ROW EXECUTE FUNCTION private.worker_ai_area_source_continuity_v1()","signature":"private.worker_ai_area_source_continuity_v1()","md5":"a153a52eddf134bd815e5258d7e2e4e6","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.worker_ai_saves') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.worker_ai_sessions') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.worker_ai_sessions')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[],"rules":[]}'::jsonb
   OR to_regclass('private.worker_ai_sessions') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('private.worker_execution_mode_choices') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('private.worker_execution_mode_choices')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON private.worker_execution_mode_choices FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(''worker_account_id'')","signature":"private.closure_taxonomy_owner_immutable_v1()","md5":"4f8e522641d38d2795dd00b45a00f62b","enabled":"O"},{"definition":"CREATE TRIGGER closure_f01_owned BEFORE INSERT OR DELETE OR UPDATE ON private.worker_execution_mode_choices FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''worker_account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('private.worker_execution_mode_choices') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.ai_conversations') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('public.ai_conversations')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER guard_need_edit_base_marker_trg BEFORE INSERT OR UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION private.guard_need_edit_base_marker()","signature":"private.guard_need_edit_base_marker()","md5":"903f80c9b2ac6f65cb20a2aa5c423d89","enabled":"O"},{"definition":"CREATE TRIGGER guard_retention_ai_origin_trg BEFORE INSERT OR UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION private.guard_retention_ai_origin()","signature":"private.guard_retention_ai_origin()","md5":"cbaa2a0ca12bcf431bd61cea7be01d78","enabled":"O"},{"definition":"CREATE TRIGGER pre_v3_closure_ai_conversation BEFORE INSERT OR UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('public.ai_conversations') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.app_accounts') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('public.app_accounts')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER app_accounts_set_updated_at BEFORE UPDATE ON public.app_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()","signature":"public.set_updated_at()","md5":"76dba26be9f6e6877b90230b92840d5b","enabled":"O"},{"definition":"CREATE TRIGGER pre_v3_closure_account BEFORE UPDATE ON public.app_accounts FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('public.app_accounts') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.app_profiles') AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass('public.app_profiles')),'[]'::jsonb))) IS DISTINCT FROM '{"triggers":[{"definition":"CREATE TRIGGER app_profiles_set_updated_at BEFORE UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()","signature":"public.set_updated_at()","md5":"76dba26be9f6e6877b90230b92840d5b","enabled":"O"},{"definition":"CREATE TRIGGER guard_profile_write_trg BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_profile_write()","signature":"private.guard_profile_write()","md5":"acd34f3abcf44d62a643f304ed97d7bb","enabled":"O"},{"definition":"CREATE TRIGGER guard_worker_equipment_retired_v1 BEFORE INSERT OR UPDATE OF tools, vehicles ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_worker_equipment_retired_v1()","signature":"private.guard_worker_equipment_retired_v1()","md5":"997da33b7cb10c24e275d2e18298536a","enabled":"O"},{"definition":"CREATE TRIGGER pre_v3_closure_profile BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')","signature":"private.closure_guard_owned_write()","md5":"331b1d322cee8e46a0b155524932861b","enabled":"O"},{"definition":"CREATE TRIGGER pre_v3_requester_identity BEFORE UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_requester_identity_writer()","signature":"private.guard_requester_identity_writer()","md5":"082342fbc0f7948be5f201fdc012a5cf","enabled":"O"},{"definition":"CREATE TRIGGER pre_v3_worker_fact_authority BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_worker_fact_authority()","signature":"private.guard_worker_fact_authority()","md5":"7cdb6e7b18d4cf73827df1a5560f5f9b","enabled":"O"},{"definition":"CREATE TRIGGER worker_profile_sync_taxonomy_capabilities_trg AFTER INSERT OR UPDATE OF skills ON public.app_profiles FOR EACH ROW WHEN ((new.kind = ''WORKER''::text)) EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn()","signature":"private.worker_profile_sync_taxonomy_capabilities_trg_fn()","md5":"16015b90ea1099d5ae804953a6fae4d4","enabled":"O"},{"definition":"CREATE TRIGGER z_w02_persistent_availability BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_persistent_availability()","signature":"private.guard_persistent_availability()","md5":"d7f65761d65c0aa26272d8ca98a352eb","enabled":"O"}],"rules":[]}'::jsonb
   OR to_regclass('public.app_profiles') IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.account_lineage(uuid)')))
  IS DISTINCT FROM '8fb2092aa40b93b733f5e7181c355c55' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.account_visibility_world(uuid)')))
  IS DISTINCT FROM '109bc82d7b7b466218fb6823493fda4e' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.closure_account_restricted(uuid)')))
  IS DISTINCT FROM '9ce14bacf456210147ba14235d7ba8de' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.closure_assert_open(uuid,uuid)')))
  IS DISTINCT FROM '1d0e22224d546c4756f216acfe103246' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.closure_taxonomy_profile_erasing_v1(uuid)')))
  IS DISTINCT FROM '1fccce74691ebc5a435c4a990ecca321' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.enqueue_dispatch(uuid,timestamp with time zone)')))
  IS DISTINCT FROM '9b7e2a55fd7fc5a119725eb5e1d60bcc' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.requeue_open_needs_for_worker_v5(uuid)')))
  IS DISTINCT FROM '73f0b957bcedd7ed86c369d6124a493f' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])')))
  IS DISTINCT FROM '0f245dd2acda5719218e240d45523887' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)')))
  IS DISTINCT FROM 'e318d1e43e4a045f09be19138016ccd8' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)')))
  IS DISTINCT FROM 'a461fef793d82272e73ecdaeab7f4121' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.validate_need_v2_fact(text,jsonb)')))
  IS DISTINCT FROM '20e2800046e49187eb96349d9b329e2e' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.worker_ai_document(uuid)')))
  IS DISTINCT FROM '8d796caef6b4039c89c6bf16a9e6c020' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('private.worker_ai_service_mode_context_v1(uuid,uuid)')))
  IS DISTINCT FROM '439e4897c32a097908019ca252f1809a' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('public.metadata_text_array(jsonb)')))
  IS DISTINCT FROM 'c4269750a7ea119c9b85736b8f32e5c9' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
IF md5(pg_get_functiondef(to_regprocedure('public.rpc_read_worker_ai_taxonomy(uuid)')))
  IS DISTINCT FROM 'a6e7e1c87b1863a92a1095f252777c7f' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;
END;$r08_acceptance_surface$;
