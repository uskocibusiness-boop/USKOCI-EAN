-- MASTER F0: SELECT-only evidence, DEV leqcwgzvjsxugfgzdmth only.
-- Read metadata/function source/configuration, never invoke the reviewed RPCs.
-- Does not read messages, addresses, user profile rows, or identifying saved cases.
-- This is evidence collection, not a deploy, migration, repair, or runtime call audit.

select now() as observed_at,n.nspname as schema,p.proname,p.oid::regprocedure::text as signature,md5(p.prosrc) as md5,length(p.prosrc) as chars,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text,has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_execute,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.prokind='f' and (p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public[.])?needs' or p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+private[.](work_taxonomy_categories|work_taxonomy_worker_capabilities|taxonomy_confirmed_worker_modes_v1)' or p.proname ~* '(taxonomy.*(bind|admit|pending|postsave|reconcil)|needs_category|signed.*review|save_worker_ai|save_task_review)') order by schema,proname,signature;

select now() as observed_at,t.tgrelid::regclass::text as relation,t.tgname,t.tgenabled,t.tgisinternal,t.tgfoid::regprocedure::text as function,pg_get_triggerdef(t.oid) as definition from pg_trigger t where not t.tgisinternal and (t.tgrelid::regclass::text ~ '(needs|worker|taxonomy|task_review)' or t.tgfoid::regprocedure::text ~ '(taxonomy|worker)') order by relation,t.tgname;

-- Full selected function definitions and exact live-body hashes.
SELECT clock_timestamp()::text AS observed_at,n.nspname AS schema,
 p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.provolatile,p.proconfig,p.proacl::text,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
 md5(p.prosrc) AS body_md5,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256,
 pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.proname IN (
 'needs_sync_taxonomy_category_trigger_fn',
 'rpc_taxonomy_assign_worker_categories_service',
 'sync_worker_skills_to_taxonomy_capabilities',
 'taxonomy_pending_saved_event_v1',
 'taxonomy_queue_review_after_save_v1',
 'rpc_save_worker_ai_review',
 'rpc_taxonomy_bind_reviewed_worker_service',
 'worker_profile_sync_taxonomy_capabilities_trg_fn',
 'rpc_publish_need_canonical',
 'rpc_save_need_draft_from_review',
 'rpc_taxonomy_bind_ready_reviews_service',
 'rpc_taxonomy_bind_reviewed_need_service',
 'rpc_taxonomy_claim_reviewed_batches_service',
 'rpc_taxonomy_commit_admission_service',
 'rpc_taxonomy_commit_reviewed_batch_service',
 'rpc_taxonomy_finalize_reviewed_batch_service',
 'rpc_taxonomy_prepare_admission_service',
 'taxonomy_signed_binding_requeue_v1',
 'rpc_accept_ai_task_review',
 'rpc_confirm_need_edit',
 'rpc_confirm_need_edit_from_review',
 'rpc_publish_accepted_ai_task_review',
 'rpc_taxonomy_approve_admission',
 'rpc_taxonomy_reconcile_reviewed_outbox_service',
 'stage_task_replacement',
 'taxonomy_normalize_v1',
 'taxonomy_reconcile_pending_reviews_v1',
 'taxonomy_register_low_risk_v1',
 'after_need_revision',
 'enqueue_on_need_change',
 'guard_need_write',
 'guard_worker_fact_authority',
 'rpc_confirm_need_edit_from_review_v2',
 'rpc_taxonomy_consume_turn_hint_revision_service',
 'rpc_taxonomy_ensure_path_service',
 'rpc_prepare_ai_task_review',
 'rpc_prepare_worker_ai_review',
 'taxonomy_review_exact_projection_v1',
 'rpc_prepare_ai_task_review_taxonomy',
 'rpc_prepare_worker_ai_review_taxonomy',
 'rpc_prepare_worker_ai_review_taxonomy_confirmed',
 'taxonomy_review_candidate_projection_v2'
)
ORDER BY n.nspname,p.proname,p.oid;

-- ACLs are not effective reachability by themselves: inspect schema USAGE too.
SELECT nspname,nspacl::text,
 has_schema_privilege('anon',oid,'USAGE') AS anon_usage,
 has_schema_privilege('authenticated',oid,'USAGE') AS authenticated_usage,
 has_schema_privilege('service_role',oid,'USAGE') AS service_usage
FROM pg_namespace WHERE nspname IN ('public','private');

SELECT c.oid::regclass::text AS relation,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,c.relacl::text,
 has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
 has_table_privilege('service_role',c.oid,'INSERT') AS service_insert,
 has_table_privilege('service_role',c.oid,'UPDATE') AS service_update
FROM pg_class c WHERE c.oid IN (
 'public.needs'::regclass,'public.app_profiles'::regclass,
 'private.work_taxonomy_categories'::regclass,'private.work_taxonomy_aliases'::regclass,
 'private.work_taxonomy_worker_capabilities'::regclass,
 'private.work_taxonomy_need_snapshots'::regclass,
 'private.taxonomy_confirmed_worker_modes_v1'::regclass,
 'private.work_taxonomy_review_outbox_v1'::regclass);

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('needs','app_profiles')
ORDER BY tablename,cmd,policyname;

SELECT conrelid::regclass::text AS relation,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid IN (
 'public.needs'::regclass,'private.work_taxonomy_categories'::regclass,
 'private.work_taxonomy_aliases'::regclass)
ORDER BY relation,conname;

select a.attname,a.attnotnull from pg_attribute a where a.attrelid='public.needs'::regclass and a.attname in ('category','category_id') and not a.attisdropped;

SELECT 'catalog' AS control,to_jsonb(c) AS settings FROM private.work_taxonomy_control c
UNION ALL SELECT 'binding',to_jsonb(c) FROM private.work_taxonomy_binding_control_v1 c
UNION ALL SELECT 'outbox',to_jsonb(c) FROM private.work_taxonomy_review_outbox_control_v1 c
UNION ALL SELECT 'pending',to_jsonb(c) FROM private.work_taxonomy_pending_control_v1 c
UNION ALL SELECT 'strict_scope',to_jsonb(c) FROM private.taxonomy_match_scope_control_v1 c;

