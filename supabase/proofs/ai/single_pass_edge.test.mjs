// Actual handlers, synthetic I/O; no deployed/provider proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {singlePassFixture as fixture,id,decision,category,service} from './single_pass_edge_fixture.mjs';
import {withUnresolvedSinglePassReply} from '../../functions/_shared/singlePassTaxonomy.mjs';
const providers=f=>f.calls.filter(c=>c.url.includes('generativelanguage.googleapis.com'));
const atomic=f=>f.calls.filter(c=>c.name.includes('with_first_plan_service'));
for(const kind of ['NEED','WORKER']){
 test(kind+' single response sends complete catalog and atomically retains the resolved category',async()=>{
  const f=fixture(kind),events=await f.invoke();assert.equal(events.at(-1).kind,'final',JSON.stringify(f.logs));
  assert.equal(providers(f).length,1);assert.equal(atomic(f).length,1);
  const model=providers(f)[0].body;assert.ok(model.generationConfig.responseSchema.required.includes('taxonomyDecisions'));
  assert.ok(JSON.stringify(model.systemInstruction).includes(category));assert.equal(model.tools,undefined);
  const plan=atomic(f)[0].body.p_taxonomy_plan;assert.equal(plan.proposals[0].categoryId,category);
  assert.deepEqual(plan.anchors,[{categoryId:category,label:service,parentId:null}]);
  assert.equal(f.calls.filter(c=>c.name==='rpc_ai_test_budget_reserve_service').length,1);
  assert.equal(f.calls.filter(c=>c.name==='rpc_ai_test_record_usage_service').length,1);
  assert.ok(!f.calls.some(c=>/capture_gemini|query_catalog|rpc_save_worker|publish|push/.test(c.name)));
  assert.ok(!JSON.stringify(events).includes('taxonomyDecisions'));assert.ok(!JSON.stringify(events).includes(category));
 });
 for(const option of ['lostAck','pendingFirst','malformed'])test(kind+' exact completion recovery keeps one provider: '+option,async()=>{
  const f=fixture(kind,{[option]:true}),events=await f.invoke();assert.equal(events.at(-1).kind,'final',JSON.stringify(f.logs));
  assert.equal(providers(f).length,1);assert.equal(atomic(f).length,option==='pendingFirst'?2:1);
  const reads=f.calls.filter(c=>c.name==='rpc_ai_read_first_plan_completion_service');assert.equal(reads.length,1);
  assert.deepEqual(reads[0].body.p_arguments,atomic(f)[0].body);
 });
 test(kind+' server refusal cannot emit success or retry a paid answer',async()=>{
  const f=fixture(kind,{refused:true}),events=await f.invoke();assert.equal(events.at(-1).kind,'safe_error');
  assert.equal(providers(f).length,1);assert.equal(atomic(f).length,1);
  assert.ok(!events.some(e=>e.kind==='text_delta'||e.kind==='final'));
 });
 for(const options of [{catalogUnavailable:true},{decisions:[]},{decisions:[{...decision(),categoryId:id(99)}]}])
 test(kind+' incomplete catalog evidence keeps facts without an invented catalog write: '+JSON.stringify(options),async()=>{
  const f=fixture(kind,options),events=await f.invoke();assert.equal(events.at(-1).kind,'final',JSON.stringify(f.logs));
  assert.equal(providers(f).length,1);assert.equal(atomic(f).length,0);
 });
}
for(const decisions of [[decision('REMOTE')],[decision('REMOTE'),decision('ON_SITE')]])test('WORKER BOTH is complete or unresolved: '+decisions.length,async()=>{
 const f=fixture('WORKER',{modes:['ON_SITE','REMOTE'],decisions}),events=await f.invoke();assert.equal(events.at(-1).kind,'final');
 assert.equal(atomic(f).length,decisions.length===2?1:0);assert.equal(providers(f).length,1);
});
test('WORKER invented consent cannot grant a mode',async()=>{
 const f=fixture('WORKER',{evidence:'Izjava koja ne postoji u korisničkom razgovoru.'});await f.invoke();
 assert.equal(atomic(f).length,0);assert.equal(providers(f).length,1);
});

test('technical classification uncertainty preserves user facts without another human question',()=>{
 const turn={safety:'ALLOW',assistantMessage:'Vaš opis je zabeležen.',dialogue:{next:'REVIEW',questionKey:'NONE'}};
 const technical=withUnresolvedSinglePassReply(turn,null,null);
 assert.match(technical.assistantMessage,/povezivanje usluge trenutno nije potvrđeno/);
 assert.match(technical.assistantMessage,/nije potrebno da ponavljate opis/);
 assert.equal(technical.dialogue.next,'ACK');
 const question='Da li radite na terenu ili na daljinu?';
 const business=withUnresolvedSinglePassReply(turn,{clarifications:[{ambiguityPrompt:question}]},null);
 assert.equal(business.assistantMessage,question);
 assert.equal(business.dialogue.next,'CLARIFY');
});
