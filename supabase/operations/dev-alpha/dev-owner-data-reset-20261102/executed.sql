-- One-time owner-authorized DEV test-data reset. Not a reusable migration.
-- Backup: encrypted local 4444-row snapshot; SHA256 ECBAB8886B28368B3B1E07ABD312EC19B5A633766FA203D808B81D7ED2F7A50B.
-- Five immutable history triggers are suspended only under transaction locks and restored before commit.
-- Auth/accounts/requester profiles/catalog/billing/legal/privacy policy data remain byte-identical.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='120s';
LOCK TABLE private.account_block_commands,private.account_blocks,private.account_closure_commands,private.account_closure_requests,private.account_lineage_events_v5,private.account_lineage_v5,private.agreement_location_commands,private.agreement_location_points,private.agreement_media_snapshots_v5,private.agreement_photo_uploads_v5,private.agreement_review_comments_v1,private.agreement_reviews,private.agreement_voice_uploads_v1,private.ai_need_open_commands,private.ai_need_turn_commands,private.ai_task_review_commands,private.ai_task_reviews,private.ai_test_accounts_v5,private.ai_test_budget_v5,private.ai_test_reservations_v5,private.ai_test_usage_v5,private.classification_turn_hints,private.closure_actions_v5,private.closure_dataset_catalog_v5,private.closure_erasure_source_v5,private.closure_executions_v5,private.closure_redaction_certificate_v5,private.closure_redaction_steps_v5,private.closure_scope_sources_v5,private.closure_source_v5,private.closure_start_commands_v5,private.connection_activations,private.connection_policy_versions,private.data_export_artifacts,private.dev_phase1_20261014_catalog_snapshot,private.dev_phase1_20261014_dispatch_snapshot,private.dev_phase1_20261014_needs_snapshot,private.dev_phase1_20261014_opportunity_snapshot,private.dev_phase1_20261014_worker_capabilities_snapshot,private.dev_test101_owner_profile_backup_20261014,private.dev_test101_owner_worker_profile_backup,private.dev_worker_profile_reset_snapshots_v1,private.dispatch_schedule,private.gemini_debug_log,private.group_conversations_v5,private.group_memberships_v5,private.group_message_visibility_v5,private.group_messages_v5,private.legal_document_versions,private.location_market_configs,private.marketplace_audit_log,private.marketplace_config,private.media_evidence_gaps_v5,private.media_evidence_refs_v5,private.need_draft_save_commands,private.need_edit_commands,private.need_fact_registry,private.need_publication_decisions,private.need_publish_commands,private.need_revision_events,private.owned_media_assets,private.preselection_qa_answer_versions,private.preselection_qa_commands,private.preselection_qa_materiality_decisions,private.preselection_qa_policy_decisions,private.preselection_qa_questions,private.processor_map_entries,private.processor_map_sets,private.processor_provider_inventory,private.publication_policy_bundles,private.publication_policy_rule_refs,private.push_runtime_readiness,private.qa_ai_commands,private.remaining_search_close_commands,private.requester_identity_commands,private.response_application_snapshots,private.response_revision_resolution_commands,private.response_submit_commands,private.response_withdraw_commands,private.retention_data_classes,private.retention_holds,private.retention_jobs,private.retention_policy_rules,private.retention_policy_sets,private.retention_scan_cursors,private.safety_reports,private.selection_commands,private.support_appeals_v5,private.support_cases_v5,private.support_commands_v5,private.support_decisions_v5,private.support_events_v5,private.support_evidence_v5,private.support_grant_commands_v5,private.support_operator_audit_v5,private.support_operator_grants_v5,private.support_read_markers_v5,private.taxonomy_confirmed_worker_modes_v1,private.taxonomy_match_scope_control_v1,private.work_taxonomy_admissions_v1,private.work_taxonomy_aliases,private.work_taxonomy_audit,private.work_taxonomy_binding_control_v1,private.work_taxonomy_categories,private.work_taxonomy_category_modes,private.work_taxonomy_control,private.work_taxonomy_gemini_turn_hints_v1,private.work_taxonomy_legacy_kind_map,private.work_taxonomy_need_bindings_v1,private.work_taxonomy_need_skills,private.work_taxonomy_need_snapshots,private.work_taxonomy_pending_control_v1,private.work_taxonomy_pending_reviews_v1,private.work_taxonomy_related_acceptances,private.work_taxonomy_relations,private.work_taxonomy_review_batches_v1,private.work_taxonomy_review_outbox_control_v1,private.work_taxonomy_review_outbox_v1,private.work_taxonomy_risk_actions,private.work_taxonomy_risk_rules,private.work_taxonomy_sentence_prefixes,private.work_taxonomy_service_meanings,private.work_taxonomy_service_scopes,private.work_taxonomy_service_verbs,private.work_taxonomy_standard_coverage,private.work_taxonomy_worker_bindings_v1,private.work_taxonomy_worker_capabilities,private.worker_ai_reviews,private.worker_ai_saves,private.worker_ai_sessions,private.worker_ai_turns,private.worker_calendar_events,private.worker_calendar_serialization,private.worker_execution_mode_choices,public.access_grants,public.account_legal_acceptance_events,public.agreement_change_proposals,public.agreement_execution,public.agreement_invalidations_v1,public.agreement_messages,public.agreement_versions,public.agreements,public.ai_action_proposals,public.ai_conversations,public.ai_messages,public.ai_structured_facts,public.app_accounts,public.app_profiles,public.data_export_requests,public.dispatch_rounds,public.gemini_debug_log,public.marketplace_response_versions,public.marketplace_responses,public.need_geography,public.need_requirement_details,public.need_selections,public.need_sensitive,public.needs,public.notification_deliveries,public.notification_preferences,public.notification_push_attempts,public.notification_push_devices,public.opportunity_deliveries,public.profile_availability_rules,public.profile_availability_windows,public.user_activity_events,public.worker_match_preferences IN ACCESS EXCLUSIVE MODE;
SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE reset_rows(relation_oid oid, row_tid tid, data jsonb, PRIMARY KEY(relation_oid,row_tid)) ON COMMIT DROP;
CREATE TEMP TABLE reset_edges ON COMMIT DROP AS SELECT 'public.ai_conversations'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.ai_conversations'::text AS child_name, 'to_jsonb(c)->''bound_need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.profile_availability_windows'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.profile_availability_windows'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.profile_availability_rules'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.profile_availability_rules'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.response_withdraw_commands'::regclass::oid AS child_oid, 'public.marketplace_response_versions'::regclass::oid AS parent_oid, 'private.response_withdraw_commands'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''response_id'' AND to_jsonb(c)->''response_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'public.needs'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.needs'::text AS child_name, 'to_jsonb(c)->''requester_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.need_sensitive'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.need_sensitive'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.need_selections'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.need_selections'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_cases_v5'::regclass::oid AS child_oid, 'private.safety_reports'::regclass::oid AS parent_oid, 'private.support_cases_v5'::text AS child_name, 'to_jsonb(c)->''safety_report_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.marketplace_responses'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.marketplace_responses'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.marketplace_responses'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.marketplace_responses'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.marketplace_response_versions'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'public.marketplace_response_versions'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreements'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.agreements'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreements'::regclass::oid AS child_oid, 'public.need_selections'::regclass::oid AS parent_oid, 'public.agreements'::text AS child_name, 'to_jsonb(c)->''selection_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreements'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'public.agreements'::text AS child_name, 'to_jsonb(c)->''selected_response_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreement_versions'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.agreement_versions'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreement_messages'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.agreement_messages'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreement_execution'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.agreement_execution'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.access_grants'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.access_grants'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_read_markers_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_read_markers_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.ai_structured_facts'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'public.ai_structured_facts'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.ai_structured_facts'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.ai_structured_facts'::text AS child_name, 'to_jsonb(c)->''subject_need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.ai_structured_facts'::regclass::oid AS child_oid, 'public.ai_structured_facts'::regclass::oid AS parent_oid, 'public.ai_structured_facts'::text AS child_name, 'to_jsonb(c)->''superseded_by'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.ai_action_proposals'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'public.ai_action_proposals'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.need_selections'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'public.need_selections'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.need_selections'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.need_selections'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.notification_deliveries'::regclass::oid AS child_oid, 'public.user_activity_events'::regclass::oid AS parent_oid, 'public.notification_deliveries'::text AS child_name, 'to_jsonb(c)->''event_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.notification_push_attempts'::regclass::oid AS child_oid, 'public.notification_deliveries'::regclass::oid AS parent_oid, 'public.notification_push_attempts'::text AS child_name, 'to_jsonb(c)->''delivery_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.worker_match_preferences'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.worker_match_preferences'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.dispatch_rounds'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.dispatch_rounds'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.opportunity_deliveries'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.opportunity_deliveries'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.opportunity_deliveries'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.opportunity_deliveries'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.opportunity_deliveries'::regclass::oid AS child_oid, 'public.dispatch_rounds'::regclass::oid AS parent_oid, 'public.opportunity_deliveries'::text AS child_name, 'to_jsonb(c)->''dispatch_round_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.dispatch_schedule'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.dispatch_schedule'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.response_submit_commands'::regclass::oid AS child_oid, 'public.marketplace_response_versions'::regclass::oid AS parent_oid, 'private.response_submit_commands'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''response_id'' AND to_jsonb(c)->''response_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'public.agreements'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.agreements'::text AS child_name, 'to_jsonb(c)->''requester_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreements'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'public.agreements'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreement_change_proposals'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.agreement_change_proposals'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.ai_messages'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'public.ai_messages'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_publish_commands'::regclass::oid AS child_oid, 'private.need_publication_decisions'::regclass::oid AS parent_oid, 'private.need_publish_commands'::text AS child_name, 'to_jsonb(c)->''decision_sequence'' = p.data->''decision_sequence'''::text AS predicate
UNION ALL
SELECT 'public.need_geography'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.need_geography'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.need_requirement_details'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.need_requirement_details'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_draft_save_commands'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.need_draft_save_commands'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_draft_save_commands'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.need_draft_save_commands'::text AS child_name, 'to_jsonb(c)->''requester_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_draft_save_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.need_draft_save_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_edit_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.need_edit_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_edit_commands'::regclass::oid AS child_oid, 'private.need_revision_events'::regclass::oid AS parent_oid, 'private.need_edit_commands'::text AS child_name, 'to_jsonb(c)->''revision_event_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_publication_decisions'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.need_publication_decisions'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_publish_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.need_publish_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_publish_commands'::regclass::oid AS child_oid, 'private.need_publication_decisions'::regclass::oid AS parent_oid, 'private.need_publish_commands'::text AS child_name, 'to_jsonb(c)->''decision_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.need_revision_events'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.need_revision_events'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.response_revision_resolution_commands'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'private.response_revision_resolution_commands'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.remaining_search_close_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.remaining_search_close_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_questions'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.preselection_qa_questions'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_answer_versions'::regclass::oid AS child_oid, 'private.preselection_qa_questions'::regclass::oid AS parent_oid, 'private.preselection_qa_answer_versions'::text AS child_name, 'to_jsonb(c)->''question_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_policy_decisions'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.preselection_qa_policy_decisions'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_policy_decisions'::regclass::oid AS child_oid, 'private.preselection_qa_questions'::regclass::oid AS parent_oid, 'private.preselection_qa_policy_decisions'::text AS child_name, 'to_jsonb(c)->''question_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_materiality_decisions'::regclass::oid AS child_oid, 'private.preselection_qa_questions'::regclass::oid AS parent_oid, 'private.preselection_qa_materiality_decisions'::text AS child_name, 'to_jsonb(c)->''question_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.preselection_qa_materiality_decisions'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.preselection_qa_materiality_decisions'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.response_application_snapshots'::regclass::oid AS child_oid, 'public.marketplace_response_versions'::regclass::oid AS parent_oid, 'private.response_application_snapshots'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''response_id'' AND to_jsonb(c)->''response_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'private.response_application_snapshots'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.response_application_snapshots'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.selection_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.selection_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.selection_commands'::regclass::oid AS child_oid, 'public.need_selections'::regclass::oid AS parent_oid, 'private.selection_commands'::text AS child_name, 'to_jsonb(c)->''selection_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.selection_commands'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.selection_commands'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.selection_commands'::regclass::oid AS child_oid, 'public.marketplace_response_versions'::regclass::oid AS parent_oid, 'private.selection_commands'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''response_id'' AND to_jsonb(c)->''response_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'private.connection_activations'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.connection_activations'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.connection_activations'::regclass::oid AS child_oid, 'public.need_selections'::regclass::oid AS parent_oid, 'private.connection_activations'::text AS child_name, 'to_jsonb(c)->''selection_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.connection_activations'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.connection_activations'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.connection_activations'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.connection_activations'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.connection_activations'::regclass::oid AS child_oid, 'public.marketplace_response_versions'::regclass::oid AS parent_oid, 'private.connection_activations'::text AS child_name, 'to_jsonb(c)->''response_id'' = p.data->''response_id'' AND to_jsonb(c)->''response_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'private.worker_calendar_events'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.worker_calendar_events'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_calendar_events'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.worker_calendar_events'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_calendar_serialization'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.worker_calendar_serialization'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.requester_identity_commands'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.requester_identity_commands'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.safety_reports'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.safety_reports'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.safety_reports'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.safety_reports'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_reviews'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.agreement_reviews'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_ai_saves'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.worker_ai_saves'::text AS child_name, 'to_jsonb(c)->''review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.ai_task_review_commands'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.ai_task_review_commands'::text AS child_name, 'to_jsonb(c)->''review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_ai_turns'::regclass::oid AS child_oid, 'private.worker_ai_sessions'::regclass::oid AS parent_oid, 'private.worker_ai_turns'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''conversation_id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_media_snapshots_v5'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.agreement_media_snapshots_v5'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_media_snapshots_v5'::regclass::oid AS child_oid, 'public.agreement_versions'::regclass::oid AS parent_oid, 'private.agreement_media_snapshots_v5'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''agreement_id'' AND to_jsonb(c)->''agreement_version'' = p.data->''version'''::text AS predicate
UNION ALL
SELECT 'private.group_conversations_v5'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.group_conversations_v5'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.group_memberships_v5'::regclass::oid AS child_oid, 'private.group_conversations_v5'::regclass::oid AS parent_oid, 'private.group_memberships_v5'::text AS child_name, 'to_jsonb(c)->''group_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.group_memberships_v5'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.group_memberships_v5'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.group_memberships_v5'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.group_memberships_v5'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.group_messages_v5'::regclass::oid AS child_oid, 'private.group_conversations_v5'::regclass::oid AS parent_oid, 'private.group_messages_v5'::text AS child_name, 'to_jsonb(c)->''group_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.group_message_visibility_v5'::regclass::oid AS child_oid, 'private.group_messages_v5'::regclass::oid AS parent_oid, 'private.group_message_visibility_v5'::text AS child_name, 'to_jsonb(c)->''message_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_location_commands'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.agreement_location_commands'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_location_points'::regclass::oid AS child_oid, 'private.agreement_location_commands'::regclass::oid AS parent_oid, 'private.agreement_location_points'::text AS child_name, 'to_jsonb(c)->''actor_account_id'' = p.data->''actor_account_id'' AND to_jsonb(c)->''client_request_id'' = p.data->''client_request_id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_gaps_v5'::regclass::oid AS child_oid, 'private.safety_reports'::regclass::oid AS parent_oid, 'private.media_evidence_gaps_v5'::text AS child_name, 'to_jsonb(c)->''source_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_events_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_events_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_decisions_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_decisions_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_decisions_v5'::regclass::oid AS child_oid, 'private.support_decisions_v5'::regclass::oid AS parent_oid, 'private.support_decisions_v5'::text AS child_name, 'to_jsonb(c)->''prior_decision_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_appeals_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_appeals_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_appeals_v5'::regclass::oid AS child_oid, 'private.support_decisions_v5'::regclass::oid AS parent_oid, 'private.support_appeals_v5'::text AS child_name, 'to_jsonb(c)->''decision_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_appeals_v5'::regclass::oid AS child_oid, 'private.support_decisions_v5'::regclass::oid AS parent_oid, 'private.support_appeals_v5'::text AS child_name, 'to_jsonb(c)->''decision_result_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_evidence_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_evidence_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_evidence_v5'::regclass::oid AS child_oid, 'private.support_events_v5'::regclass::oid AS parent_oid, 'private.support_evidence_v5'::text AS child_name, 'to_jsonb(c)->''event_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.support_commands_v5'::regclass::oid AS child_oid, 'private.support_cases_v5'::regclass::oid AS parent_oid, 'private.support_commands_v5'::text AS child_name, 'to_jsonb(c)->''case_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.agreement_invalidations_v1'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.agreement_invalidations_v1'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_review_comments_v1'::regclass::oid AS child_oid, 'private.agreement_reviews'::regclass::oid AS parent_oid, 'private.agreement_review_comments_v1'::text AS child_name, 'to_jsonb(c)->''review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_need_snapshots'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.work_taxonomy_need_snapshots'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_need_skills'::regclass::oid AS child_oid, 'private.work_taxonomy_need_snapshots'::regclass::oid AS parent_oid, 'private.work_taxonomy_need_skills'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''need_id'' AND to_jsonb(c)->''need_revision'' = p.data->''need_revision'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_related_acceptances'::regclass::oid AS child_oid, 'private.work_taxonomy_worker_capabilities'::regclass::oid AS parent_oid, 'private.work_taxonomy_related_acceptances'::text AS child_name, 'to_jsonb(c)->''worker_account_id'' = p.data->''worker_account_id'' AND to_jsonb(c)->''source_category_id'' = p.data->''category_id'''::text AS predicate
UNION ALL
SELECT 'private.worker_execution_mode_choices'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.worker_execution_mode_choices'::text AS child_name, 'to_jsonb(c)->''worker_profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.taxonomy_confirmed_worker_modes_v1'::regclass::oid AS child_oid, 'private.work_taxonomy_worker_capabilities'::regclass::oid AS parent_oid, 'private.taxonomy_confirmed_worker_modes_v1'::text AS child_name, 'to_jsonb(c)->''worker_account_id'' = p.data->''worker_account_id'' AND to_jsonb(c)->''category_id'' = p.data->''category_id'''::text AS predicate
UNION ALL
SELECT 'private.worker_ai_sessions'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.worker_ai_sessions'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_ai_sessions'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.worker_ai_sessions'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.worker_ai_reviews'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.worker_ai_reviews'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.ai_task_reviews'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.ai_task_reviews'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.ai_need_turn_commands'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.ai_need_turn_commands'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.ai_need_open_commands'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.ai_need_open_commands'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.classification_turn_hints'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.classification_turn_hints'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_gemini_turn_hints_v1'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.work_taxonomy_gemini_turn_hints_v1'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_worker_bindings_v1'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.work_taxonomy_worker_bindings_v1'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_need_bindings_v1'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.work_taxonomy_need_bindings_v1'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_worker_capabilities'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.work_taxonomy_worker_capabilities'::text AS child_name, 'to_jsonb(c)->''worker_account_id'' = p.data->''account_id'''::text AS predicate
UNION ALL
SELECT 'private.owned_media_assets'::regclass::oid AS child_oid, 'public.app_profiles'::regclass::oid AS parent_oid, 'private.owned_media_assets'::text AS child_name, 'to_jsonb(c)->''profile_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.owned_media_assets'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.owned_media_assets'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_refs_v5'::regclass::oid AS child_oid, 'private.owned_media_assets'::regclass::oid AS parent_oid, 'private.media_evidence_refs_v5'::text AS child_name, 'to_jsonb(c)->''asset_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_photo_uploads_v5'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.agreement_photo_uploads_v5'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.agreement_voice_uploads_v1'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.agreement_voice_uploads_v1'::text AS child_name, 'to_jsonb(c)->''agreement_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.qa_ai_commands'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.qa_ai_commands'::text AS child_name, 'to_jsonb(c)->''need_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.retention_jobs'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.retention_jobs'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.retention_scan_cursors'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.retention_scan_cursors'::text AS child_name, 'to_jsonb(c)->''conversation_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_admissions_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_admissions_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_admissions_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_admissions_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_review_batches_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_review_batches_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_review_batches_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_review_batches_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_review_outbox_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_review_outbox_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_review_outbox_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_review_outbox_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_pending_reviews_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_pending_reviews_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_pending_reviews_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_pending_reviews_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_worker_bindings_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_worker_bindings_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_worker_bindings_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_worker_bindings_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_need_bindings_v1'::regclass::oid AS child_oid, 'private.ai_task_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_need_bindings_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.work_taxonomy_need_bindings_v1'::regclass::oid AS child_oid, 'private.worker_ai_reviews'::regclass::oid AS parent_oid, 'private.work_taxonomy_need_bindings_v1'::text AS child_name, 'to_jsonb(c)->''source_review_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.user_activity_events'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'public.user_activity_events'::text AS child_name, 'to_jsonb(c)->''entity_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_refs_v5'::regclass::oid AS child_oid, 'public.needs'::regclass::oid AS parent_oid, 'private.media_evidence_refs_v5'::text AS child_name, 'to_jsonb(c)->''source_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.user_activity_events'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'public.user_activity_events'::text AS child_name, 'to_jsonb(c)->''entity_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_refs_v5'::regclass::oid AS child_oid, 'public.agreements'::regclass::oid AS parent_oid, 'private.media_evidence_refs_v5'::text AS child_name, 'to_jsonb(c)->''source_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.user_activity_events'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'public.user_activity_events'::text AS child_name, 'to_jsonb(c)->''entity_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_refs_v5'::regclass::oid AS child_oid, 'public.marketplace_responses'::regclass::oid AS parent_oid, 'private.media_evidence_refs_v5'::text AS child_name, 'to_jsonb(c)->''source_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'public.user_activity_events'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'public.user_activity_events'::text AS child_name, 'to_jsonb(c)->''entity_id'' = p.data->''id'''::text AS predicate
UNION ALL
SELECT 'private.media_evidence_refs_v5'::regclass::oid AS child_oid, 'public.ai_conversations'::regclass::oid AS parent_oid, 'private.media_evidence_refs_v5'::text AS child_name, 'to_jsonb(c)->''source_id'' = p.data->''id'''::text AS predicate;
INSERT INTO reset_rows SELECT 'public.needs'::regclass,ctid,to_jsonb(n) FROM public.needs n;
INSERT INTO reset_rows SELECT 'public.app_profiles'::regclass,ctid,to_jsonb(p) FROM public.app_profiles p WHERE kind='WORKER';
INSERT INTO reset_rows SELECT 'public.ai_conversations'::regclass,ctid,to_jsonb(c) FROM public.ai_conversations c WHERE purpose IN('NEED_INTAKE','PROFILE');
INSERT INTO reset_rows SELECT 'private.owned_media_assets'::regclass,ctid,to_jsonb(a) FROM private.owned_media_assets a WHERE scope='TASK' ON CONFLICT DO NOTHING;
DO $scope$ DECLARE e record; delta integer; n integer; passes integer:=0; BEGIN
LOOP delta:=0;passes:=passes+1;IF passes>100 THEN RAISE EXCEPTION 'RESET_SCOPE_DID_NOT_CONVERGE'; END IF;
FOR e IN SELECT * FROM reset_edges ORDER BY child_name,parent_oid LOOP
EXECUTE format('INSERT INTO pg_temp.reset_rows SELECT %s,c.ctid,to_jsonb(c) FROM %s c WHERE EXISTS(SELECT 1 FROM pg_temp.reset_rows p WHERE p.relation_oid=%s AND %s) ON CONFLICT DO NOTHING',e.child_oid,e.child_oid::regclass,e.parent_oid,e.predicate);
GET DIAGNOSTICS n=ROW_COUNT;delta:=delta+n;
END LOOP; EXIT WHEN delta=0;END LOOP;
END $scope$;

DO $pre$ DECLARE observed jsonb; BEGIN
IF current_user<>'postgres' OR current_database()<>'postgres' OR current_setting('server_version_num')<>'170006' OR private.closure_source_digest_v5()<>'0801d13b1b112c288143c396ecc44c3dac3b9e405ca5d6f2cd1a1b7ddef45021' THEN RAISE EXCEPTION 'DEV_RESET_CONTEXT_CHANGED'; END IF;
IF EXISTS(SELECT 1 FROM cron.job WHERE active) OR EXISTS(SELECT 1 FROM private.retention_holds WHERE active) OR EXISTS(SELECT 1 FROM private.connection_activations WHERE platform_cost_rsd>0) OR EXISTS(SELECT 1 FROM private.support_cases_v5) OR EXISTS(SELECT 1 FROM private.safety_reports) THEN RAISE EXCEPTION 'DEV_RESET_ACTIVE_HOLD_OR_WORK'; END IF;
IF EXISTS(SELECT 1 FROM private.work_taxonomy_review_outbox_v1 WHERE lease_until>now()) OR EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE lease_expires_at>now()) OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE lease_expires_at>now()) THEN RAISE EXCEPTION 'DEV_RESET_INFLIGHT'; END IF;
SELECT jsonb_agg(x ORDER BY relation) INTO observed FROM(SELECT relation_oid::regclass::text AS relation,count(*) AS rows,md5(string_agg(data::text,E'\n' ORDER BY data::text COLLATE "C")) AS rows_md5 FROM reset_rows GROUP BY relation_oid)x;
IF observed IS DISTINCT FROM '[{"rows":2,"relation":"private.agreement_media_snapshots_v5","rows_md5":"5a44cd15dc4ae2f5bc87b826865fa016"},{"rows":1,"relation":"private.agreement_reviews","rows_md5":"e46a30df165080e1bdd1eb9de72fde82"},{"rows":1,"relation":"private.agreement_voice_uploads_v1","rows_md5":"e7e136992374204ee729190c6cf41a49"},{"rows":106,"relation":"private.ai_need_open_commands","rows_md5":"df4b0e02b45b7d27f3bef7ad8c88f4b3"},{"rows":301,"relation":"private.ai_need_turn_commands","rows_md5":"f8a229599ecc1fddd9598e005e5ba296"},{"rows":35,"relation":"private.ai_task_review_commands","rows_md5":"3157fdb3d3517fd80b512b02b0e26b18"},{"rows":109,"relation":"private.ai_task_reviews","rows_md5":"9ace84ba2dd17c01aee39746b712eef0"},{"rows":2,"relation":"private.classification_turn_hints","rows_md5":"da0accd96e776e06d0b256f8d7a888b5"},{"rows":2,"relation":"private.connection_activations","rows_md5":"0fcb7467177d0a161849280a3d395266"},{"rows":7,"relation":"private.dispatch_schedule","rows_md5":"b501fb9ab6170fd2689ec49bd7b5e58a"},{"rows":33,"relation":"private.need_draft_save_commands","rows_md5":"e8c000ea36962768aed4d19efebef971"},{"rows":2,"relation":"private.need_edit_commands","rows_md5":"d983cc7f066cf10396b887722ba95f38"},{"rows":26,"relation":"private.need_publication_decisions","rows_md5":"d22c54746fbc4a2ed07284d6c08a1b72"},{"rows":23,"relation":"private.need_publish_commands","rows_md5":"25c30c2748713e7896dc324feae50815"},{"rows":2,"relation":"private.need_revision_events","rows_md5":"e343a4ffac9b32576ef6380d2cdd1c9a"},{"rows":22,"relation":"private.owned_media_assets","rows_md5":"2e5920dfdef4f31d0c8fd76daf5dac49"},{"rows":1,"relation":"private.qa_ai_commands","rows_md5":"6731090aaa24fd491c77968171129cee"},{"rows":4,"relation":"private.response_application_snapshots","rows_md5":"16c8c3b4a6fd8640b58142af1cd7fd0a"},{"rows":4,"relation":"private.response_submit_commands","rows_md5":"e5cd59b37439174b72946a9935185572"},{"rows":2,"relation":"private.selection_commands","rows_md5":"49f61635f952471605e65b002d8cb241"},{"rows":5,"relation":"private.taxonomy_confirmed_worker_modes_v1","rows_md5":"82a22cf9754e6fb8cc0f23f85992e5d3"},{"rows":197,"relation":"private.work_taxonomy_gemini_turn_hints_v1","rows_md5":"757bbf2e69e2cccbc1b595e12f010ae4"},{"rows":24,"relation":"private.work_taxonomy_need_bindings_v1","rows_md5":"8158c7431ab29f52a90c89209ad8cb1c"},{"rows":24,"relation":"private.work_taxonomy_need_snapshots","rows_md5":"393d320beab56a96048e2f58e8ea541a"},{"rows":12,"relation":"private.work_taxonomy_pending_reviews_v1","rows_md5":"1ee1f640ae3a9bcc1cfeac24445bc1a2"},{"rows":32,"relation":"private.work_taxonomy_review_batches_v1","rows_md5":"9a403ad687d75dd79096c74e58042237"},{"rows":33,"relation":"private.work_taxonomy_review_outbox_v1","rows_md5":"3e321b2c2e8624ec8852ac772da7e448"},{"rows":6,"relation":"private.work_taxonomy_worker_bindings_v1","rows_md5":"c4e0ede4e4fd4611f4ce04f575c7d0c1"},{"rows":6,"relation":"private.work_taxonomy_worker_capabilities","rows_md5":"ac1300b7362f97354a6eadc5ea9d6792"},{"rows":68,"relation":"private.worker_ai_reviews","rows_md5":"cd1a2e48144cae314d9ef5d5cfa01969"},{"rows":16,"relation":"private.worker_ai_saves","rows_md5":"151e4c52207f8217f7aa4997c2d8e26a"},{"rows":43,"relation":"private.worker_ai_sessions","rows_md5":"24f927a62d639e4c86fe004c2f0895bf"},{"rows":112,"relation":"private.worker_ai_turns","rows_md5":"734f68f2ee2aa5e56b4b835063aa7fde"},{"rows":1,"relation":"private.worker_calendar_events","rows_md5":"7b159fe02afee63db711513d685be696"},{"rows":2,"relation":"private.worker_calendar_serialization","rows_md5":"324e2f987db19570e53abed4f349b4c1"},{"rows":4,"relation":"private.worker_execution_mode_choices","rows_md5":"e6cf44b3f15c9572a2162a9952d8fc9f"},{"rows":2,"relation":"public.agreement_execution","rows_md5":"86e378eb76c3c8f77d0f88e6320eb438"},{"rows":1,"relation":"public.agreement_invalidations_v1","rows_md5":"204d123f3d3a88f902297ca358390538"},{"rows":2,"relation":"public.agreement_messages","rows_md5":"a284d9213c0f768e3ca2fd93fd019e0d"},{"rows":2,"relation":"public.agreement_versions","rows_md5":"5f841f033fcd575a286513f2d8894327"},{"rows":2,"relation":"public.agreements","rows_md5":"09e0bde418391bdaae817aa4130830e4"},{"rows":163,"relation":"public.ai_conversations","rows_md5":"19895bea1610da4700de3f2642cf08e7"},{"rows":790,"relation":"public.ai_messages","rows_md5":"6ca7cc23b195c1b3ccb964d4c8132743"},{"rows":1321,"relation":"public.ai_structured_facts","rows_md5":"519ed0b129dd1f0e08e5cc266e833170"},{"rows":14,"relation":"public.app_profiles","rows_md5":"1f70f0dfd9b02cd5712395139c1c2414"},{"rows":691,"relation":"public.dispatch_rounds","rows_md5":"0ba49610feae4687554c187d8320b3fb"},{"rows":4,"relation":"public.marketplace_response_versions","rows_md5":"1496c52700d65702ca4200ae8bea4608"},{"rows":4,"relation":"public.marketplace_responses","rows_md5":"a7d8a38bb8d93d10ed2053855b6d9173"},{"rows":33,"relation":"public.need_geography","rows_md5":"516aed9228f952a3538c9e5404039e14"},{"rows":11,"relation":"public.need_requirement_details","rows_md5":"236c17d52d141dac49fc8da9b1954fc2"},{"rows":2,"relation":"public.need_selections","rows_md5":"04d60c8733beaf64ff5650ad872eee41"},{"rows":20,"relation":"public.need_sensitive","rows_md5":"ecde862e0c9e9348810781057bae19f0"},{"rows":35,"relation":"public.needs","rows_md5":"b7f5f0b84f0b7a108f58bfafd6505d38"},{"rows":38,"relation":"public.notification_deliveries","rows_md5":"87400e6071c4352e4a6e27b6e327d209"},{"rows":9,"relation":"public.notification_push_attempts","rows_md5":"d90f6839a8d1e1c6bf5a1d9e1c7fdc33"},{"rows":5,"relation":"public.opportunity_deliveries","rows_md5":"f6d43e5943eaac5de360cde7ba66ab74"},{"rows":1,"relation":"public.profile_availability_windows","rows_md5":"c80ced1f45f30daf85243b197b2983c1"},{"rows":19,"relation":"public.user_activity_events","rows_md5":"25e68a47f14396d8eee8132a997f4046"},{"rows":5,"relation":"public.worker_match_preferences","rows_md5":"ec3ede443834e4935c1d483ed31b7c70"}]'::jsonb THEN RAISE EXCEPTION 'DEV_RESET_SNAPSHOT_CHANGED' USING DETAIL=jsonb_build_object('observed',observed)::text; END IF;
END $pre$;
CREATE TEMP TABLE reset_unchanged(relation_oid oid PRIMARY KEY,pre_hash text) ON COMMIT DROP;
DO $keep$ DECLARE r record; h text;BEGIN FOR r IN SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('private','public') AND c.relkind='r' ORDER BY c.oid LOOP
EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' ORDER BY to_jsonb(t)::text COLLATE "C"),'''')) FROM %s t WHERE NOT EXISTS(SELECT 1 FROM pg_temp.reset_rows s WHERE s.relation_oid=%s AND s.row_tid=t.ctid)',r.oid::regclass,r.oid) INTO h;
INSERT INTO reset_unchanged VALUES(r.oid,h);
END LOOP; END $keep$;
CREATE TEMP TABLE reset_contracts ON COMMIT DROP AS SELECT private.closure_source_digest_v5() AS source,private.closure_schema_digest_v5_139() AS schema,private.closure_erasure_program_digest_v5() AS erasure,(SELECT sha256 FROM private.closure_source_v5 WHERE singleton) AS certificate,(SELECT md5(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.oid)) FROM pg_trigger t WHERE tgrelid IN(SELECT relation_oid FROM reset_unchanged)) AS triggers;

ALTER TABLE private.agreement_voice_uploads_v1 DISABLE TRIGGER agreement_voice_asset_guard_v1;
ALTER TABLE private.agreement_reviews DISABLE TRIGGER pre_v3_review_immutable;
ALTER TABLE private.connection_activations DISABLE TRIGGER connection_activations_immutable_trg;
ALTER TABLE private.agreement_media_snapshots_v5 DISABLE TRIGGER media_snapshot_immutable_v5;
ALTER TABLE private.need_publication_decisions DISABLE TRIGGER need_publication_decisions_immutable;
CREATE TEMP TABLE reset_deleted(relation_name text,rows integer) ON COMMIT DROP;
DO $delete$ DECLARE n integer; expected_n integer; rel text; BEGIN
FOREACH rel IN ARRAY ARRAY['private.agreement_media_snapshots_v5','private.agreement_reviews','private.agreement_voice_uploads_v1','private.ai_need_open_commands','private.ai_need_turn_commands','private.ai_task_review_commands','private.classification_turn_hints','private.connection_activations','private.dispatch_schedule','private.need_draft_save_commands','private.need_edit_commands','private.need_publish_commands','private.owned_media_assets','private.qa_ai_commands','private.response_application_snapshots','private.response_submit_commands','private.selection_commands','private.taxonomy_confirmed_worker_modes_v1','private.work_taxonomy_gemini_turn_hints_v1','private.work_taxonomy_need_bindings_v1','private.work_taxonomy_need_snapshots','private.work_taxonomy_pending_reviews_v1','private.work_taxonomy_review_batches_v1','private.work_taxonomy_review_outbox_v1','private.work_taxonomy_worker_bindings_v1','private.worker_ai_saves','private.worker_ai_turns','private.worker_calendar_events','private.worker_calendar_serialization','private.worker_execution_mode_choices','public.agreement_execution','public.agreement_invalidations_v1','public.agreement_messages','public.ai_messages','public.ai_structured_facts','public.need_geography','public.need_requirement_details','public.need_sensitive','public.notification_push_attempts','public.opportunity_deliveries','public.profile_availability_windows','public.worker_match_preferences','private.ai_task_reviews','private.need_publication_decisions','private.need_revision_events','private.work_taxonomy_worker_capabilities','private.worker_ai_reviews','private.worker_ai_sessions','public.agreement_versions','public.dispatch_rounds','public.marketplace_response_versions','public.notification_deliveries','public.user_activity_events','public.agreements','public.ai_conversations','public.need_selections','public.marketplace_responses','public.needs','public.app_profiles'] LOOP
SELECT count(*) INTO expected_n FROM reset_rows WHERE relation_oid=rel::regclass;
EXECUTE format('DELETE FROM %s t USING pg_temp.reset_rows s WHERE s.relation_oid=%s AND t.ctid=s.row_tid',rel::regclass,rel::regclass::oid);
GET DIAGNOSTICS n=ROW_COUNT;
IF n<>expected_n THEN RAISE EXCEPTION 'DEV_RESET_DELETE_COUNT_CHANGED:%:%:%',rel,expected_n,n; END IF;
INSERT INTO reset_deleted VALUES(rel,n);
END LOOP; END $delete$;
ALTER TABLE private.agreement_voice_uploads_v1 ENABLE TRIGGER agreement_voice_asset_guard_v1;
ALTER TABLE private.agreement_reviews ENABLE TRIGGER pre_v3_review_immutable;
ALTER TABLE private.connection_activations ENABLE TRIGGER connection_activations_immutable_trg;
ALTER TABLE private.agreement_media_snapshots_v5 ENABLE TRIGGER media_snapshot_immutable_v5;
ALTER TABLE private.need_publication_decisions ENABLE TRIGGER need_publication_decisions_immutable;
DO $verify$ DECLARE r record;h text;BEGIN
FOR r IN SELECT * FROM reset_unchanged LOOP
EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' ORDER BY to_jsonb(t)::text COLLATE "C"),'''')) FROM %s t',r.relation_oid::regclass) INTO h;
IF h IS DISTINCT FROM r.pre_hash THEN RAISE EXCEPTION 'DEV_RESET_UNEXPECTED_DATA_CHANGE:%',r.relation_oid::regclass;END IF;
END LOOP;
IF EXISTS(SELECT 1 FROM reset_contracts WHERE source IS DISTINCT FROM private.closure_source_digest_v5() OR schema IS DISTINCT FROM private.closure_schema_digest_v5_139() OR erasure IS DISTINCT FROM private.closure_erasure_program_digest_v5() OR certificate IS DISTINCT FROM(SELECT sha256 FROM private.closure_source_v5 WHERE singleton) OR triggers IS DISTINCT FROM(SELECT md5(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.oid)) FROM pg_trigger t WHERE tgrelid IN(SELECT relation_oid FROM reset_unchanged))) THEN RAISE EXCEPTION 'DEV_RESET_SCHEMA_OR_GUARD_CHANGED'; END IF;
IF EXISTS(SELECT 1 FROM public.needs) OR EXISTS(SELECT 1 FROM public.app_profiles WHERE kind='WORKER') OR EXISTS(SELECT 1 FROM public.ai_conversations WHERE purpose IN('NEED_INTAKE','PROFILE')) THEN RAISE EXCEPTION 'DEV_RESET_ROOTS_NOT_EMPTY'; END IF;
END $verify$;
SELECT 'DEV_RESET_VERIFIED' AS result,statement_timestamp() AS checked_at,(SELECT sum(rows) FROM reset_deleted) AS deleted_rows,(SELECT count(*) FROM reset_deleted) AS tables,(SELECT count(*) FROM public.needs) AS needs,(SELECT count(*) FROM public.app_profiles WHERE kind='WORKER') AS worker_profiles,(SELECT count(*) FROM auth.users) AS auth_users,(SELECT count(*) FROM public.app_profiles WHERE kind='REQUESTER') AS requester_profiles,(SELECT count(*) FROM private.work_taxonomy_categories) AS categories,(SELECT count(*) FROM storage.objects) AS retained_storage_objects;
COMMIT;
