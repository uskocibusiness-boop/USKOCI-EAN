// Reviewed owned relations only. Shared categories/aliases are intentionally absent.
const t = (name, dataClass, key, ownerColumn, fields, mode = 'ACCOUNT') => ({
  relation: `private.${name}`, dataClass, key, ownerColumn, fields: fields.split(' '), mode,
});
export const inventory = [
  t('work_taxonomy_review_outbox_v1', 'COMMAND_LEDGERS', 'taxonomyQueue', 'owner_account_id', 'id request_key source_review_id purpose plans state binding_state error_code binding_error_code result binding_result created_at updated_at'),
  t('work_taxonomy_pending_reviews_v1', 'COMMAND_LEDGERS', 'taxonomyPendingReviews', 'owner_account_id', 'id request_key source_review_id purpose classification_state resolution_state saved_at created_at'),
  t('work_taxonomy_gemini_turn_hints_v1', 'AI_VOLATILE', 'taxonomyTurnProposals', 'account_id', 'id purpose conversation_id client_request_id turn_id proposals catalog_version created_at'),
  t('work_taxonomy_admissions_v1', 'COMMAND_LEDGERS', 'taxonomyAdmissions', 'owner_account_id', 'id request_key purpose source_review_id plan status result approved_at committed_at created_at'),
  t('work_taxonomy_review_batches_v1', 'COMMAND_LEDGERS', 'taxonomyReviewedBatches', 'owner_account_id', 'id request_key purpose source_review_id plans catalog_version result committed_at'),
  t('work_taxonomy_related_acceptances', 'PROFILE_DATA', 'taxonomyRelatedConsent', 'worker_account_id', 'source_category_id target_category_id explicitly_confirmed_at relationship_version'),
  t('taxonomy_confirmed_worker_modes_v1', 'PROFILE_DATA', 'taxonomyServiceModes', 'worker_account_id', 'category_id execution_scope source_review_id source_request_key confirmed_at active'),
  t('work_taxonomy_worker_capabilities', 'PROFILE_DATA', 'taxonomyCapabilities', 'worker_account_id', 'category_id confirmed_at allow_related_offers excluded origin updated_at'),
  t('worker_execution_mode_choices', 'PROFILE_DATA', 'workerModeConsent', 'worker_account_id', 'worker_profile_id modes consent_source confirmed_at updated_at'),
  t('work_taxonomy_need_skills', 'NEED_PUBLIC', 'taxonomyTaskSkills', 'need_id', 'need_id need_revision category_id', 'NEED'),
  t('work_taxonomy_need_snapshots', 'NEED_PUBLIC', 'taxonomyTaskSnapshots', 'need_id', 'need_id need_revision category_id catalog_version reviewed_by_requester source classification_state original_category created_at', 'NEED'),
  t('work_taxonomy_need_bindings_v1', 'COMMAND_LEDGERS', 'taxonomyTaskBindings', 'owner_account_id', 'request_key source_review_id need_id need_revision category_id catalog_version result bound_at'),
  t('work_taxonomy_worker_bindings_v1', 'COMMAND_LEDGERS', 'taxonomyWorkerBindings', 'owner_account_id', 'request_key source_review_id profile_id catalog_version result bound_at'),
  t('dev_phase1_20261014_worker_capabilities_snapshot', 'PROFILE_DATA', 'archivedWorkerCapabilities', 'worker_account_id', 'category_id confirmed_at allow_related_offers excluded origin updated_at'),
  t('dev_phase1_20261014_opportunity_snapshot', 'NOTIFICATION_DELIVERY', 'archivedOpportunities', 'worker_account_id', 'id worker_profile_id need_id need_revision match_score reason_codes status expires_at seen_at responded_at created_at updated_at'),
  t('dev_phase1_20261014_dispatch_snapshot', 'NOTIFICATION_DELIVERY', 'archivedTaskDispatch', 'need_id', 'id need_id need_revision round_no urgency status stop_reason deadline_at created_at', 'NEED'),
  t('dev_test101_owner_worker_profile_backup', 'PROFILE_DATA', 'archivedWorkerProfile', 'account_id', 'id kind display_name city headline bio avatar_path account_type profile_status years_experience portfolio skills tools vehicles licenses exclusions radius_km operating_country_code available_now available_now_expires_at team_capacity minimum_fee_rsd rating_requester rating_worker created_at updated_at'),
  t('dev_test101_owner_profile_backup_20261014', 'PROFILE_DATA', 'archivedProfiles', 'account_id', 'id kind display_name city headline bio avatar_path account_type profile_status years_experience portfolio skills tools vehicles licenses exclusions radius_km operating_country_code available_now available_now_expires_at team_capacity minimum_fee_rsd rating_requester rating_worker created_at updated_at'),
  t('dev_worker_profile_reset_snapshots_v1', 'PROFILE_DATA', 'archivedWorkerReset', 'account_id', 'backup_id profile_id backed_up_at payload'),
  // Last: indirect snapshot ownership remains resolvable until its children erase.
  t('dev_phase1_20261014_needs_snapshot', 'NEED_PUBLIC', 'archivedTasks', 'requester_account_id', 'id title description category category_id approximate_city approximate_area approximate_lat approximate_lng schedule_kind starts_at ends_at required_slots mode requester_price_rsd required_skills required_tools required_vehicles required_licenses task_country_code task_timezone revision status created_at updated_at'),
];

export const semanticKeys = 'action service mode reason parentId parentCategoryId existingCategoryId childLabel categoryId categoryIds catalogVersion status profileId needId needRevision services items path rootLabel label canonicalKey executionScope sourceCategoryId targetCategoryId confirmed active verification confidence classificationState proposedPath sourceCanonicalLabel targetCanonicalLabel meaning canonicalAction canonicalObject newRoot'.split(' ');
export const profileFields = inventory.find(x => x.key === 'archivedWorkerProfile').fields;
export const resetSections = {
  worker_profile: profileFields,
  worker_messages: 'id conversation_id role body created_at'.split(' '),
  worker_conversations: 'id purpose status created_at completed_at'.split(' '),
  worker_sessions: 'conversation_id profile_id revision candidate created_at'.split(' '),
  worker_reviews: 'id conversation_id revision envelope created_at'.split(' '),
  worker_turns: 'id conversation_id state created_at cancelled_at'.split(' '),
  worker_saves: 'review_id created_at'.split(' '),
  worker_hints: inventory.find(x => x.key === 'taxonomyTurnProposals').fields,
  capabilities: inventory.find(x => x.key === 'taxonomyCapabilities').fields,
  confirmed_modes: inventory.find(x => x.key === 'taxonomyServiceModes').fields,
  bindings: inventory.find(x => x.key === 'taxonomyWorkerBindings').fields,
  worker_modes: inventory.find(x => x.key === 'workerModeConsent').fields,
  availability_rules: 'id profile_id active weekdays start_time end_time starts_on ends_on label'.split(' '),
  availability_windows: 'id profile_id starts_at ends_at state label'.split(' '),
  worker_preferences: 'profile_id worker_profile_id available_now available_until radius_km'.split(' '),
};
