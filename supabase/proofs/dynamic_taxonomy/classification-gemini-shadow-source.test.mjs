import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {singlePassFixture} from '../ai/single_pass_edge_fixture.mjs';
import {taxonomyIntakeEnabled} from '../../functions/_shared/taxonomyRuntimeConfig.mjs';
const worker=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const need=readFileSync(new URL('../../functions/uskoci-ai-interview/index.ts',import.meta.url),'utf8');
const fixtures={};
for(const kind of ['WORKER','NEED']){const f=singlePassFixture(kind);await f.invoke();fixtures[kind]=f;}
const provider=f=>f.calls.filter(call=>call.url.startsWith('https://generativelanguage.googleapis.com/'));
const prompt=f=>provider(f)[0].body.systemInstruction.parts.map(part=>part.text).join('\n');

test('both handlers send one provider request containing conversation and private taxonomy schema',()=>{
 for(const f of Object.values(fixtures)){
  assert.equal(provider(f).length,1);
  const request=provider(f)[0].body;
  assert.ok(request.generationConfig.responseSchema.required.includes('taxonomyDecisions'));
  assert.ok(request.generationConfig.responseSchema.properties.assistantMessage);
  assert.equal(request.tools,undefined,'catalog exploration must not add another model loop');
  assert.match(prompt(f),/private taxonomyDecisions only, never assistantMessage\/title\/description\/bio/);
 }
});
test('need strips private taxonomy fields before strict facts and location parsing',()=>{
 const checked=need.indexOf('const extracted = takeSinglePassTaxonomy(value)');
 const stripped=need.indexOf('value = extracted.output',checked);
 const binding=need.indexOf('const parseFacts=(output:any)=>parseV2Output(output,maxProposals)');
 const strict=need.indexOf('parseFacts(value)',binding);
 const completion=need.indexOf("'rpc_ai_complete_need_turn_with_first_plan_service'");
 assert.ok(checked>0&&stripped>checked&&binding>stripped&&strict>binding&&completion>strict);
 assert.match(need,/parseLocationOutput\(value,locationContext,parseFacts\)/);
 const write=fixtures.NEED.calls.find(call=>call.name==='rpc_ai_complete_need_turn_with_first_plan_service').body;
 assert.ok(write.p_proposals.every(p=>!JSON.stringify(p).includes('taxonomyDecisions')));
 assert.ok(write.p_taxonomy_plan.proposals.length>0,'classification persists separately from business facts');
});
test('need category remains a concrete service and private tree data never becomes a public fact',()=>{
 assert.match(prompt(fixtures.NEED),/need.category: internal natural action\+object, no path\/place\/price\/date\/quantity or generic fallback/);
 assert.match(prompt(fixtures.NEED),/Classify one effective service using typed task_geography, not city alone/);
 assert.match(prompt(fixtures.NEED),/Kategorije\/ID-jevi\/grane idu samo AI→server, bez korisničkog prikaza\/odobrenja/);
});
test('first plan uses one owned completion write, never the retired split capture or business Save',()=>{
 for(const [kind,f] of Object.entries(fixtures)){
  const writes=f.calls.filter(call=>/complete.*turn.*service$/.test(call.name));
  assert.equal(writes.length,1,kind);
  assert.match(writes[0].name,/with_first_plan_service$/);
  for(const key of ['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id','p_taxonomy_plan'])
   assert.ok(Object.hasOwn(writes[0].body,key),kind+': '+key);
  assert.ok(!f.calls.some(call=>/rpc_taxonomy_(capture_gemini_turn_hints|bind_reviewed_worker|bind_reviewed_need|commit_reviewed_batch)_service/.test(call.name)));
 }
 // SQL rollback/atomicity/lost-ACK negatives are exercised in the current R06
 // first-plan and handler tests; this synthetic transport is not DEV proof.
});
const captureSql=readFileSync(new URL('../../candidates/dynamic-taxonomy-20261011/gemini-turn-review-hints-v1.sql',import.meta.url),'utf8');
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

test('single-response rollout retains explicit default-OFF and project-bound server config',()=>{
 const env={USKOCI_TAXONOMY_DUAL_GEMINI:'true',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',SUPABASE_ANON_KEY:'synthetic',
  USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'a'.repeat(20),SUPABASE_URL:'https://'+'a'.repeat(20)+'.supabase.co'};
 assert.equal(taxonomyIntakeEnabled(key=>env[key]),true);
 for(const key of Object.keys(env)){
  const incomplete={...env};delete incomplete[key];
  assert.equal(taxonomyIntakeEnabled(name=>incomplete[name]),false,'missing '+key);
 }
 assert.equal(taxonomyIntakeEnabled(key=>({...env,SUPABASE_URL:'https://'+'b'.repeat(20)+'.supabase.co'})[key]),false);
 for(const source of [worker,need]){
  assert.match(source,/taxonomyIntakeEnabled/);
  assert.match(source,/taxonomyIntakeEnabled\(\(key:string\)=>Deno.env.get\(key\)\)/);
  assert.doesNotMatch(source,/https:\/\/leqcwgzvjsxugfgzdmth\.supabase\.co/);
 }
});
test('worker classifies every offered service and retains current IDs without invented consent',()=>{
 const text=prompt(fixtures.WORKER);
 assert.match(text,/One decision per offered service\/mode/);
 assert.match(text,/preserve unchanged saved\/draft IDs, including mode\/handoff edits/);
 assert.match(text,/Never restore removed services/);
 assert.match(text,/UNKNOWN only for clarification/);
 assert.match(text,/These remain draft choices until explicit Save/);
 assert.match(text,/COMPLETE offered list: preserve unremoved services/);
});
test('unfinished worker review renders preparation reasons and notifications default to unconfirmed',()=>{
 const ui=readFileSync(new URL('../../../src/ui/workerProfile/WorkerAiPresentation.tsx',import.meta.url),'utf8');
 assert.match(ui,/review\.classificationState&&review\.classificationState!=='READY'/);
 assert.match(ui,/classificationPreparationMessage\(review\.classificationState\)/);
 assert.match(ui,/WorkerAiNotificationsNote\(\{matchingReady=false\}/);
 assert.doesNotMatch(ui,/export function WorkerAiModeConfirmation/);
});
