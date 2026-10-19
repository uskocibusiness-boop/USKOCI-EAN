import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const need=readFileSync(new URL('../../functions/uskoci-ai-interview/index.ts',import.meta.url),'utf8');
test('both worker and need use one shadow schema/inspection module',()=>{
 for(const source of [worker,need]){
  assert.match(source,/classificationGeminiShadow\.mjs/);
  assert.match(source,/withGeminiClassificationShadowSchema/);
  assert.match(source,/inspectGeminiClassificationShadow/);
  assert.match(source,/geminiClassificationShadowInstruction/);
  assert.match(source,/USKOCI_TAXONOMY_UNIFIED_SHADOW/);
 }
});
// The worker's field stripping and mutation boundary run against the actual
// handler in proofs/ai/v5_worker_edge.test.mjs, independent of variable names.
test('need strips new fields before strict facts parser and owner-bound completion',()=>{
 const checked=need.indexOf('inspectGeminiClassificationShadow(value');
 const strict=need.indexOf('parseV2Output(checked.output)');
 const completion=need.indexOf("'rpc_ai_complete_need_turn_v2_service'");
 assert.ok(checked>0&&strict>checked&&completion>strict);
 assert.doesNotMatch(need,/rpc_taxonomy_commit_admission_service/);
});
test('need category is a single service label and taxonomy tree stays in shadow metadata',()=>{
 assert.match(need,/U need\.category upišite SAMO naziv konkretne usluge/);
 assert.match(need,/predložite ih samo u classificationShadowJson/);
 assert.doesNotMatch(need,/možete navesti stablo u formatu Šira grupa/);
});

const captureSql=readFileSync(new URL('../../candidates/dynamic-taxonomy-20261011/gemini-turn-review-hints-v1.sql',import.meta.url),'utf8');
test('both handlers write optional hint receipts only after immutable successful AI turn',()=>{
 const wc=worker.indexOf("rpc('rpc_complete_worker_ai_turn_service'");
 const wh=worker.indexOf("rpc('rpc_taxonomy_capture_gemini_turn_hints_service'");
 const nc=need.indexOf("'rpc_ai_complete_need_turn_v2_service'");
 const nh=need.indexOf("rpc('rpc_taxonomy_capture_gemini_turn_hints_service'");
 assert.ok(wc>0&&wh>wc,'worker hint capture must follow successful turn completion');
 assert.ok(nc>0&&nh>nc,'need hint capture must follow successful turn completion');
 for(const source of [worker,need]){
  assert.match(source,/USKOCI_TAXONOMY_SHADOW_CAPTURE/);
  assert.match(source,/reviewHints|taxonomyReviewHints/);
  assert.match(source,/HINT_CAPTURED/);
  assert.match(source,/authority[^\n]*NONE/);
 }
});
test('hint capture candidate is service-only, private, versioned and has no admission authority',()=>{
 assert.match(captureSql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(captureSql,/REVOKE ALL ON private\.work_taxonomy_gemini_turn_hints_v1/);
 assert.match(captureSql,/auth\.jwt\(\)->>'role'[^\n]*service_role/);
 assert.match(captureSql,/t\.state='SUCCEEDED'/);
 assert.match(captureSql,/UNIQUE\(purpose,account_id,turn_id\)/);
 assert.match(captureSql,/TAXONOMY_CAPTURE_REPLAY_CONFLICT/);
 assert.match(captureSql,/source_fingerprint/);
 assert.doesNotMatch(captureSql,/INSERT INTO private\.work_taxonomy_categories/i);
 assert.doesNotMatch(captureSql,/INSERT INTO public\.needs/i);
 assert.doesNotMatch(captureSql,/INSERT INTO public\.notification_deliveries/i);
});

test('DEV shadow is provider-proven and environment-off remains an immediate rollback gate',()=>{
 const canonicalDev='https://leqcwgzvjsxugfgzdmth.supabase.co';
 const harness=readFileSync(new URL('gemini-real-provider-smoke.mjs',import.meta.url),'utf8');
 assert.match(harness,/WORKER_CAPABILITY/);
 assert.match(harness,/NEED_SERVICE/);
 assert.match(harness,/--provider/);
 assert.match(harness,/classificationShadowJson/);
 for(const source of [worker,need]){
  const start=source.indexOf('const devTaxonomyFlagP1=');
  const end=source.indexOf('};',start);
  assert.ok(start>=0&&end>start,'flag helper must exist');
  const flag=source.slice(start,end+2);
  assert.ok(flag.includes(canonicalDev),'default ON only for canonical DEV');
  assert.match(flag,/const setting=Deno\.env\.get\(name\)/);
  assert.match(flag,/setting!=='false'/,'explicit false is rollback switch');
  assert.match(flag,/setting==='true'/,'explicit on remains supported');
  assert.doesNotMatch(flag,/name===['"]USKOCI_TAXONOMY_UNIFIED_SHADOW['"]/, 'old unconditional shadow block must be retired');
  assert.match(source,/withGeminiClassificationShadowSchema/);
 }
});

const sharedPrompt=readFileSync(new URL('../../functions/_shared/classificationGeminiShadow.mjs',import.meta.url),'utf8');
const workerReviewUI=readFileSync(new URL('../../../src/ui/workerProfile/WorkerAiPresentation.tsx',import.meta.url),'utf8');
test('worker shadow asks for COMPLETE current skills, never partial patch-only suggestions or invented delivery consent',()=>{
  for(const clause of ['compare EACH distinct entry in the resulting skills array',
    'Cover EVERY offered skill','never return only the skills newly mentioned',
    'UNCONFIRMED rather than omitting it or guessing','within the interview limit of up to THREE related questions',
    'never owner consent']) assert.ok(sharedPrompt.includes(clause),clause);
  assert.match(sharedPrompt,/purpose==='WORKER_CAPABILITY'/);
  // The private shadow is advisory. It must never activate auto-notifications.
  assert.doesNotMatch(sharedPrompt,/INSERT INTO public\.notification_deliveries/);
});
test('unfinished worker modes show an actionable reason instead of promising automatic matching',()=>{
  assert.match(workerReviewUI,/review\.classificationState==='SERVICE_MODE_CONFIRMATION_REQUIRED'/);
  // Interaction and user copy are covered by worker-review-parts / worker-conversation-parts.
  // This source boundary only protects honest default authority, not historical wording.
  assert.match(workerReviewUI,/WorkerAiNotificationsNote\(\{matchingReady=false\}/);
  assert.doesNotMatch(workerReviewUI,/export function WorkerAiModeConfirmation/);
});
