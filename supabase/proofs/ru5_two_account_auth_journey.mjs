import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertRu5TwoAccountLocal } from './ru5_two_account_local_guard.mjs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DB_URL;

assert.ok(url, 'SUPABASE_URL required');
assert.ok(anonKey, 'SUPABASE_ANON_KEY required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY required for fixture-only email confirmation fallback');
assert.ok(dbUrl, 'DB_URL required for disposable fixture setup/verification');
// Refuse nonlocal/test-unauthorized targets before real Auth accounts or SQL.
assertRu5TwoAccountLocal(process.env);

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

const requester = createClient(url, anonKey, clientOptions);
const worker = createClient(url, anonKey, clientOptions);
const fixtureAdmin = createClient(url, serviceRoleKey, clientOptions);

const runId = randomUUID();
const requesterEmail = `ru5-journey-requester-${runId}@proof.invalid`;
const workerEmail = `ru5-journey-worker-${runId}@proof.invalid`;
const password = `Ru5-Proof-${randomUUID()}-Aa1!`;

async function requireOk(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message || result.error.code}`);
  return result.data;
}

async function createRealSession(client, email, metadata) {
  const signed = await client.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (signed.error) throw new Error(`SIGNUP_FAILED:${signed.error.message}`);
  assert.ok(signed.data.user?.id, 'signup user id missing');

  if (!signed.data.session) {
    // Fixture-only authority: local email confirmation may be enabled by the
    // Supabase CLI version. The service role confirms the test account, but it
    // is never used for any marketplace read/command below.
    const confirmed = await fixtureAdmin.auth.admin.updateUserById(signed.data.user.id, {
      email_confirm: true,
    });
    if (confirmed.error) throw new Error(`FIXTURE_CONFIRM_FAILED:${confirmed.error.message}`);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) throw new Error(`LOGIN_FAILED:${login.error?.message ?? 'session missing'}`);
  }

  const current = await client.auth.getUser();
  if (current.error || !current.data.user) throw new Error(`AUTH_SESSION_MISSING:${current.error?.message ?? 'user missing'}`);
  return current.data.user;
}

function psql(sql) {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const requesterUser = await createRealSession(requester, requesterEmail, {
  full_name: 'RU5 Journey Requester',
  city: 'Novi Sad',
});
const workerUser = await createRealSession(worker, workerEmail, {
  full_name: 'RU5 Journey Worker',
  city: 'Novi Sad',
  skills: ['Proof'],
});
assert.notEqual(requesterUser.id, workerUser.id, 'two distinct auth accounts required');

const requesterProfiles = await requireOk(
  'REQUESTER_PROFILE_READ',
  requester.from('app_profiles').select('id,kind,profile_status').eq('account_id', requesterUser.id),
);
const requesterProfile = requesterProfiles.find((p) => p.kind === 'REQUESTER');
assert.ok(requesterProfile?.id, 'requester profile missing');
assert.equal(requesterProfile.profile_status, 'ACTIVE', 'requester profile must be ACTIVE');

const workerProfiles = await requireOk(
  'WORKER_PROFILE_READ',
  worker.from('app_profiles').select('id,kind,profile_status').eq('account_id', workerUser.id),
);
const workerProfile = workerProfiles.find((p) => p.kind === 'WORKER');
assert.ok(workerProfile?.id, 'worker profile missing');

await requireOk(
  'WORKER_PROFILE_UPDATE',
  worker
    .from('app_profiles')
    .update({
      display_name: 'RU5 Journey Worker',
      city: 'Novi Sad',
      skills: ['Proof'],
      tools: ['ProofTool'],
      available_now: true,
      radius_km: 50,
    })
    .eq('id', workerProfile.id),
);
await requireOk(
  'WORKER_PROFILE_ACTIVATE',
  worker.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile.id }),
);
const activeWorker = await requireOk(
  'WORKER_PROFILE_ACTIVE_READ',
  worker.from('app_profiles').select('id,profile_status,team_capacity').eq('id', workerProfile.id).single(),
);
assert.equal(activeWorker.profile_status, 'ACTIVE', 'worker profile activation failed');
assert.ok(Number(activeWorker.team_capacity) >= 1, 'worker team capacity invalid');

// Fixture-only setup. Publication itself is intentionally NOT exercised because
// D0140 production ALLOW remains fail-closed. We seed one PUBLISHED Need directly
// inside this disposable local database, then every journey action uses real
// authenticated anon-key sessions.
const needId = randomUUID();
psql(`
begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
) values (
  '${needId}'::uuid,'${requesterUser.id}'::uuid,'${requesterProfile.id}'::uuid,
  'PUBLISHED','RU5 two-account journey','Disposable authenticated journey proof','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
);
select set_config('uskoci.need_lifecycle','',true);
commit;
`);

// W03 — Worker sees the real public opportunity through RLS using its own JWT.
const w03 = await requireOk(
  'W03_LIST',
  worker
    .from('needs')
    .select('id,title,status,revision,required_slots,covered_slots,mode,requester_profile_id')
    .in('status', ['PUBLISHED', 'SELECTION'])
    .eq('id', needId)
    .single(),
);
assert.equal(w03.id, needId);
assert.equal(w03.status, 'PUBLISHED');
assert.equal(w03.mode, 'OFFERS');
assert.ok(Number(w03.revision) >= 1, 'Need revision missing');

// W04 — exact Need detail is independently readable by the same Worker session.
const w04 = await requireOk(
  'W04_DETAIL',
  worker
    .from('needs')
    .select('id,title,status,revision,required_slots,covered_slots,mode,requester_profile_id')
    .eq('id', needId)
    .single(),
);
assert.equal(w04.id, w03.id);
assert.equal(w04.revision, w03.revision);

// W05 — real authenticated atomic submit. No scope note is supplied because the
// governing bounded-note policy is still decision-required and must not be invented.
const submitKey = `ru5-submit-${randomUUID()}`;
const submitPayload = {
  p_need_id: needId,
  p_need_revision: Number(w04.revision),
  p_worker_profile_id: workerProfile.id,
  p_covered_slots: 1,
  p_price_rsd: 3000,
  p_proposed_start_at: null,
  p_proposed_end_at: null,
  p_scope_note: null,
  p_client_request_id: submitKey,
};
const submitted = await requireOk('W05_SUBMIT', worker.rpc('rpc_submit_response', submitPayload));
assert.ok(submitted?.responseId, 'response id missing');
assert.ok(Number(submitted.version) >= 1, 'response version missing');
assert.match(String(submitted.contentHash ?? ''), /^[0-9a-f]{64}$/);

// Unknown-outcome-safe replay: same key + same semantic payload returns exactly
// the same Application identity/version/hash.
const submitReplay = await requireOk('W05_SUBMIT_REPLAY', worker.rpc('rpc_submit_response', submitPayload));
assert.equal(submitReplay.responseId, submitted.responseId);
assert.equal(submitReplay.version, submitted.version);
assert.equal(submitReplay.contentHash, submitted.contentHash);

// Same key + changed payload must never create a second semantic command.
const submitConflict = await worker.rpc('rpc_submit_response', {
  ...submitPayload,
  p_price_rsd: 3001,
});
assert.ok(submitConflict.error, 'same-key/different-payload submit unexpectedly succeeded');

// W06 — Worker sees only its own authoritative Application projection.
const w06 = await requireOk('W06_MY_APPLICATIONS', worker.rpc('rpc_list_my_applications'));
assert.ok(Array.isArray(w06), 'W06 projection must be an array');
const ownApplication = w06.find((a) => a.applicationId === submitted.responseId);
assert.ok(ownApplication, 'submitted Application absent from W06');
assert.equal(ownApplication.needId, needId);
assert.equal(ownApplication.version, submitted.version);
assert.ok(['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(ownApplication.state), `unexpected preselection W06 state ${ownApplication.state}`);

// R05 owner boundary: Worker must not be able to read Requester candidates.
const foreignCandidateRead = await worker.rpc('rpc_list_need_candidates', { p_need_id: needId });
assert.ok(foreignCandidateRead.error, 'non-owner candidate read unexpectedly succeeded');

// R05 — Requester sees the exact submitted Application version/hash and can select it.
const r05 = await requireOk(
  'R05_CANDIDATES',
  requester.rpc('rpc_list_need_candidates', { p_need_id: needId }),
);
assert.ok(Array.isArray(r05), 'R05 projection must be an array');
const candidate = r05.find((c) => c.responseId === submitted.responseId);
assert.ok(candidate, 'submitted Application absent from R05');
assert.equal(candidate.version, submitted.version);
assert.equal(candidate.contentHash, submitted.contentHash);
assert.equal(candidate.state, 'SELECTABLE');
assert.equal(candidate.canSelect, true);

const selectKey = `ru5-select-${randomUUID()}`;
const selectPayload = {
  p_need_id: needId,
  p_need_revision: Number(w04.revision),
  p_response_id: submitted.responseId,
  p_response_version: submitted.version,
  p_content_hash: submitted.contentHash,
  p_client_request_id: selectKey,
};
const agreementId = await requireOk('R05_SELECT', requester.rpc('rpc_select_response', selectPayload));
assert.match(String(agreementId ?? ''), /^[0-9a-f-]{36}$/i, 'Agreement id missing');

// P0D-02 semantic replay: same Requester selection command is exactly idempotent.
const agreementReplay = await requireOk('R05_SELECT_REPLAY', requester.rpc('rpc_select_response', selectPayload));
assert.equal(agreementReplay, agreementId);

const w06Selected = await requireOk('W06_SELECTED_RELOAD', worker.rpc('rpc_list_my_applications'));
const selectedApplication = w06Selected.find((a) => a.applicationId === submitted.responseId);
assert.ok(selectedApplication, 'selected Application absent from W06 reload');
assert.equal(selectedApplication.state, 'SELECTED');
assert.equal(selectedApplication.agreementId, agreementId);

// Server-side receipt verification is read-only proof, not user authority.
const activationProof = psql(`
select
  a.id::text || '|' || a.requester_account_id::text || '|' || a.beneficiary_account_id::text ||
  '|' || a.worker_account_id::text || '|' || a.units::text || '|' || a.platform_cost_rsd::text ||
  '|' || a.activation_reason || '|' || a.state || '|' || a.policy_key || '|' || a.policy_version::text
from private.connection_activations a
where a.agreement_id='${agreementId}'::uuid;
`);
const activation = activationProof.split('|');
assert.equal(activation.length, 10, `connection activation missing/invalid: ${activationProof}`);
assert.equal(activation[1], requesterUser.id);
assert.equal(activation[2], requesterUser.id);
assert.equal(activation[3], workerUser.id);
assert.equal(activation[4], '1');
assert.equal(activation[5], '0');
assert.equal(activation[6], 'SELECTION');
assert.equal(activation[7], 'SATISFIED');
assert.equal(activation[8], 'REQUESTER_SELECTION_V1');
assert.equal(activation[9], '1');

const agreementBinding = psql(`
select count(*)::text
from public.agreements a
where a.id='${agreementId}'::uuid
  and a.need_id='${needId}'::uuid
  and a.requester_account_id='${requesterUser.id}'::uuid
  and a.worker_account_id='${workerUser.id}'::uuid
  and a.selected_response_id='${submitted.responseId}'::uuid;
`);
assert.equal(agreementBinding, '1', 'Agreement binding mismatch');

console.log([
  'PASS RU5_TWO_ACCOUNT_AUTH_JOURNEY',
  'two_distinct_real_auth_sessions',
  'W03_public_opportunity_read',
  'W04_exact_need_read',
  'W05_authenticated_submit',
  'W05_same_payload_replay',
  'W05_same_key_changed_payload_denied',
  'W06_own_application_projection',
  'R05_owner_only_candidates',
  'R05_exact_version_hash_selectable',
  'R05_authenticated_selection',
  'P0D02_selection_replay',
  'W06_selected_reload',
  'P0D03_REQUESTER_SELECTION_V1_PROMOTIONAL_FREE_HEADCOUNT_0_RSD',
  'disposable_local_db_only',
  'seeded_published_need_not_an_ai_publication',
  'agreement_chat_not_exercised',
  'bounded_note_not_claimed',
  'device_ui_not_claimed',
].join(' '));
