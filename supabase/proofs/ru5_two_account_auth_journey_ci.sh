#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE required}"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
# Validate the database before any psql, migration replay or fixture creation.
# A connection-string override must never cause live DEV/production writes.
RU5_TWO_ACCOUNT_LOCAL_ACK='LOCAL_DISPOSABLE_TWO_AUTH_SEEDED_NEED'
export RU5_TWO_ACCOUNT_LOCAL_ACK
DB_URL="$DB_URL" GUARD_MODULE="$GITHUB_WORKSPACE/supabase/proofs/ru5_two_account_local_guard.mjs" \
  node --input-type=module -e '
    const { assertRu5TwoAccountLocal }=await import(process.env.GUARD_MODULE);
    assertRu5TwoAccountLocal({
      RU5_TWO_ACCOUNT_LOCAL_ACK:process.env.RU5_TWO_ACCOUNT_LOCAL_ACK,
      SUPABASE_URL:"http://127.0.0.1:54321",
      DB_URL:process.env.DB_URL,
    });
  '
PROOF_DIR=/tmp/uskoci-ru5-two-account-auth-journey

rm -rf "$PROOF_DIR"
mkdir -p "$PROOF_DIR"
cd "$PROOF_DIR"
supabase init
rm -rf supabase/migrations
mkdir -p supabase/migrations

# Reconstruct the physically proven stable predecessor, then replay each current
# source file under its recorded live alias. This keeps the disposable database
# semantically aligned with the live 79-migration state without rewriting any
# canonical/applied migration history.
cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_predecessor_bootstrap.sql" \
   supabase/migrations/20260825000000_ru5_two_account_live_bootstrap.sql

for f in "$GITHUB_WORKSPACE"/supabase/migrations/*.sql; do
  b="$(basename "$f")"
  case "$b" in
    20260903*|20260904*|20260905*|20260906*) ;;
    20260901105922_clean_completion_and_writer_authenticated_proof.sql|20260901113333_clean_ai_interview_turn_authenticated_proof.sql|20260901114029_clean_ai_fact_supersession_and_human_correction.sql) ;;
    *) cp "$f" "supabase/migrations/$b" ;;
  esac
done

cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901105922_durable_effects.sql" \
   supabase/migrations/20260901105922_clean_completion_and_writer_authenticated_proof.sql
cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901113333_durable_effects.sql" \
   supabase/migrations/20260901113333_clean_ai_interview_turn_authenticated_proof.sql

awk '/^-- Runtime proofs: no retained rows\.$/{exit} {print}' \
  "$GITHUB_WORKSPACE/supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql" \
  > supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql
cat >> supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql <<'SQL'
comment on function public.rpc_ai_confirm_fact(uuid) is 'AUTHENTICATED_RUNTIME_PROVEN: human confirmation stamps confirmed_at and confirmed_by_user_id.';
comment on function public.rpc_ai_correct_fact(uuid,text) is 'AUTHENTICATED_RUNTIME_PROVEN: explicit correction atomically supersedes prior live fact and creates CONFIRMED EXPLICIT_USER_ANSWER provenance.';
comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is 'SERVICE_RUNTIME_PROVEN: repeated canonical keys preserve one-live-fact invariant by superseding before insert; replacement proof rolled back with zero residue.';
SQL

# Full local stack is required here because this proof exercises real GoTrue
# sessions plus PostgREST RPCs, not only direct PostgreSQL role simulation.
# The Supabase CLI pulls about twelve images at once from ghcr.io and gives each one retry. Since
# 2026-09-23 the registry answers bursts with "toomanyrequests" (retry-after in microseconds), which
# failed every proof at this line before any USKOCI code ran. Images already pulled stay in the local
# cache, so each further attempt asks for fewer at once. Nothing the proof checks is changed.
start_supabase_with_registry_retry() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if supabase start; then return 0; fi
    echo "supabase start failed on attempt $attempt; pausing before retrying the image pulls" >&2
    supabase stop --no-backup >/dev/null 2>&1 || true
    sleep $((attempt * 30))
  done
  supabase start
}
start_supabase_with_registry_retry
trap 'cd "$PROOF_DIR" && supabase stop --no-backup >/dev/null 2>&1 || true' EXIT
supabase db reset --local
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from supabase_migrations.schema_migrations where version='20260825000000';"

test "$(psql "$DB_URL" -Atc "select count(*)::text || '/' || max(version) from supabase_migrations.schema_migrations;")" = "56/20260901114029"

apply_live_alias() {
  local source_file="$1" live_version="$2" live_name="$3"
  echo "apply_source=$source_file live_alias=${live_version}_${live_name}"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$GITHUB_WORKSPACE/supabase/migrations/$source_file" >/tmp/ru5-two-account-last-apply.log
  psql "$DB_URL" -v ON_ERROR_STOP=1 \
    -c "insert into supabase_migrations.schema_migrations(version,name) values ('$live_version','$live_name');" >/dev/null
}

apply_live_alias 20260903130355_clean_ru0_authority_closure.sql 20260903160812 clean_ru0_authority_closure
apply_live_alias 20260903165700_clean_ru1_worker_readiness.sql 20260903184545 clean_ru1_worker_readiness
apply_live_alias 20260903190000_clean_ru2_need_v2_draft.sql 20260903222139 clean_ru2_need_v2_draft
apply_live_alias 20260903190100_clean_ru2_ai_fact_transition_guard.sql 20260903222333 clean_ru2_ai_fact_transition_guard
apply_live_alias 20260904090000_clean_ru3_policy_bundle_foundation.sql 20260904090147 clean_ru3_policy_bundle_foundation
apply_live_alias 20260904103000_clean_ru3_need_publication_decision.sql 20260904102429 clean_ru3_need_publication_decision
apply_live_alias 20260904111500_clean_ru3_canonical_publish.sql 20260904182402 clean_ru3_canonical_publish
apply_live_alias 20260904214500_clean_ru4_owner_edit_lock.sql 20260905052130 clean_ru4_owner_edit_lock
apply_live_alias 20260904223000_clean_ru4_close_remaining_search.sql 20260905052224 clean_ru4_close_remaining_search
apply_live_alias 20260904230000_clean_ru4_ai_edit_conversation.sql 20260905052336 clean_ru4_ai_edit_conversation
apply_live_alias 20260904230200_clean_ru4_ai_edit_conversation_live_transfer_reconcile.sql 20260905052651 clean_ru4_ai_edit_conversation_live_transfer_reconcile
apply_live_alias 20260904230500_clean_ru4_ai_edit_replay_boundary.sql 20260905052713 clean_ru4_ai_edit_replay_boundary
apply_live_alias 20260905060000_clean_ru4b_preselection_qa_foundation.sql 20260905070010 clean_ru4b_preselection_qa_foundation
apply_live_alias 20260905060100_clean_ru4b_service_boundary.sql 20260905070029 clean_ru4b_service_boundary
apply_live_alias 20260905060200_clean_ru4b_inbox_event_contract.sql 20260905070046 clean_ru4b_inbox_event_contract
apply_live_alias 20260905133000_clean_ru5_public_profile_projection.sql 20260905163927 clean_ru5_public_profile_projection
apply_live_alias 20260905190000_clean_ru5_atomic_application_submit.sql 20260905190040 clean_ru5_atomic_application_submit
apply_live_alias 20260905211500_clean_ru5_my_applications_projection.sql 20260905200133 clean_ru5_my_applications_projection
apply_live_alias 20260905223000_clean_ru5_candidate_projection.sql 20260905230326 clean_ru5_candidate_projection
apply_live_alias 20260906010000_clean_ru5_selection_eligibility_revalidation.sql 20260906065758 clean_ru5_selection_eligibility_revalidation
apply_live_alias 20260906080000_clean_p0d02_selection_semantic_idempotency.sql 20260906090451 clean_p0d02_selection_semantic_idempotency
apply_live_alias 20260906100000_clean_p0d03_requester_connection_activation_v1.sql 20260906102021 clean_p0d03_requester_connection_activation_v1
apply_live_alias 20260906130000_clean_ru5_fastest_autofill_retirement.sql 20260906141409 clean_ru5_fastest_autofill_retirement

actual="$(psql "$DB_URL" -Atc "select count(*)::text || '/' || max(version) || '_' || (select name from supabase_migrations.schema_migrations order by version desc limit 1) from supabase_migrations.schema_migrations;")"
echo "disposable_live_equivalent=$actual"
test "$actual" = "79/20260906141409_clean_ru5_fastest_autofill_retirement"

# Contract preflight before any test accounts/Need are created.
test "$(psql "$DB_URL" -Atc "select count(*) from private.publication_policy_bundles;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.need_publication_decisions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_questions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_policy_decisions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_commands;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_policy_versions where policy_key='REQUESTER_SELECTION_V1' and version=1 and beneficiary_role='REQUESTER' and activation_reason='SELECTION' and charge_mode='PROMOTIONAL_FREE' and unit_basis='HEADCOUNT' and platform_cost_rsd=0;")" = "1"
test "$(psql "$DB_URL" -Atc "select count(*) from public.needs where mode='FASTEST';")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from public.need_selections where selection_mode='AUTO_FILL';")" = "0"

eval "$(supabase status -o env)"
SUPABASE_URL="${API_URL:-${SUPABASE_URL:-}}"
SUPABASE_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}"

: "${SUPABASE_URL:?local API URL missing}"
: "${SUPABASE_ANON_KEY:?local anon/publishable key missing}"
: "${SUPABASE_SERVICE_ROLE_KEY:?local service role/secret key missing}"

SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
DB_URL="$DB_URL" \
node "$GITHUB_WORKSPACE/supabase/proofs/ru5_two_account_auth_journey.mjs" | tee /tmp/ru5-two-account-auth-journey.log

grep -F "PASS RU5_TWO_ACCOUNT_AUTH_JOURNEY" /tmp/ru5-two-account-auth-journey.log

# Safety/non-scope postflight. The one expected connection activation is free and
# Requester-beneficiary; no gated public activation or retired mode may appear.
test "$(psql "$DB_URL" -Atc "select count(*) from private.publication_policy_bundles;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.need_publication_decisions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_questions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_policy_decisions;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_commands;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from public.needs where mode='FASTEST';")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from public.need_selections where selection_mode='AUTO_FILL';")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations where policy_key='REQUESTER_SELECTION_V1' and policy_version=1 and requester_account_id=beneficiary_account_id and activation_reason='SELECTION' and units=1 and platform_cost_rsd=0 and state='SATISFIED';")" = "1"

echo "PASS RU5_TWO_ACCOUNT_AUTH_JOURNEY_POSTFLIGHT live79 gated_features_unchanged disposable_zero_external_residue"
