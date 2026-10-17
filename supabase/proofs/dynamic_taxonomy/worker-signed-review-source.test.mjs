// Source-level, NON-runtime proof for a staged worker review RPC candidate.
// A green result does NOT certify compilation against a full Supabase schema,
// actual owner JWT, real Gemini turn evidence or deploy compatibility.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const candidate = readFileSync(
  'supabase/candidates/dynamic-taxonomy-20261011/worker-review-signed-classification-v1.sql', 'utf8'
);
const at = part => candidate.indexOf(part);

test('new versioned RPC keeps three-argument review protocol and owner/revision locks', () => {
  assert.match(candidate, /FUNCTION public\.rpc_prepare_worker_ai_review_taxonomy\(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false\)/);
  for (const phrase of ['auth.uid() is null', 'private.closure_assert_open(auth.uid())',
    's.revision is distinct from p_expected_revision',
    's.base_hash<>private.worker_ai_source_hash(auth.uid())',
    'private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update']) {
    assert.ok(candidate.includes(phrase), phrase);
  }
});
test('Gemini hints cannot cross owner, conversation, source or catalog version', () => {
  for (const phrase of ["h.purpose='WORKER_CAPABILITY'",'h.account_id=auth.uid()',
    'h.conversation_id=p_conversation_id','h.source_fingerprint=v_source',
    'h.catalog_version=(select catalog_version from private.work_taxonomy_control where singleton=true)',
    'private.taxonomy_review_exact_projection_v1(']) assert.ok(candidate.includes(phrase), phrase);
});
test('mode proposals are signed BEFORE the immutable displayed review digest', () => {
  assert.ok(at("doc:=doc||jsonb_build_object('classificationState'") >= 0);
  assert.ok(at("doc:=doc||jsonb_build_object('displayedContentDigest'") >
    at("doc:=doc||jsonb_build_object('classificationState'"));
  assert.equal((candidate.match(/doc:=doc\|\|jsonb_build_object\('displayedContentDigest'/g)??[]).length, 1);
  assert.ok(candidate.includes("'reviewedServiceModes',v_projection->'reviewedServiceModes'"));
  assert.ok(candidate.includes("envelope->>'classificationState'='READY'"));
});
test('builder only stores a review, never grants taxonomy identity or push authority', () => {
  assert.equal((candidate.match(/insert into /gi)??[]).length, 1);
  assert.match(candidate, /insert into private\.worker_ai_reviews/);
  assert.doesNotMatch(candidate, /insert into private\.work_taxonomy_worker_capabilities/i);
  assert.doesNotMatch(candidate, /perform private\.dispatch_next_wave/i);
});

test('signed builder never replaces legacy worker review endpoint',()=>{
 assert.doesNotMatch(candidate,/CREATE OR REPLACE FUNCTION public\.rpc_prepare_worker_ai_review\(/);
 assert.match(candidate,/FUNCTION public\.rpc_prepare_worker_ai_review_taxonomy\(/);
});

const workerRoute=readFileSync('src/app/(app)/profil/razgovor.tsx','utf8');
const workerBinder=readFileSync('supabase/candidates/dynamic-taxonomy-20261011/owner-reviewed-worker-binder-v1.sql','utf8');
test('signed worker Save never races post-Save atomic mode binder (legacy APK unchanged)',()=>{
  const afterSave=workerRoute.slice(workerRoute.indexOf('const save=async()=>'),
    workerRoute.indexOf('const restart=()=>'));
  assert.ok(afterSave.length>1000,'worker Save handler must remain present');
  assert.match(afterSave,/reviewed\.classificationState===undefined/,
    'only unsigned legacy Save may use standalone mode RPC');
  assert.match(afterSave,/inferWorkerExecutionModes\(reviewed\.profile\.skills,reviewed\.profile\.location\)/,
    'existing APKs retain legacy mode inference');
  assert.doesNotMatch(afterSave,/reviewed\.classificationState==='READY'/,
    'signed READY Save must NOT write global modes after signed receipt');
  assert.doesNotMatch(afterSave,/canonicalWorkerExecutionModes\(/,
    'signed mode data must not bypass the receipt-bound server binder');
  assert.match(workerBinder,/WORKER_BINDER_NEWER_GLOBAL_MODE/,
    'concurrent late client writes must continue to be rejected at SQL boundary');
  assert.match(workerBinder,/INSERT INTO private\.worker_execution_mode_choices/i,
    'binder must atomically write confirmed global mode selection');
  assert.match(workerBinder,/INSERT INTO private\.taxonomy_confirmed_worker_modes_v1/i,
    'binder must atomically write per-service execution consent');
});
