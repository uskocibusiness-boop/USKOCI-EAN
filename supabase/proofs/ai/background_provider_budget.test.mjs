// One current inference owns conversation AND taxonomy, with one reservation.
// Old separate-BG-accounting cases are retained under fixtures/retired-dual-provider-24ecfca4.
import test from 'node:test';
import assert from 'node:assert/strict';
import {singlePassFixture,id} from './single_pass_edge_fixture.mjs';
const providers=f=>f.calls.filter(c=>c.url.includes('generativelanguage.googleapis.com'));
const reserves=f=>f.calls.filter(c=>c.name==='rpc_ai_test_budget_reserve_service');
const usages=f=>f.calls.filter(c=>c.name==='rpc_ai_test_record_usage_service');
const providerEnvelope=(output,usage)=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],usageMetadata:usage})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
for(const kind of ['NEED','WORKER']){
 test(kind+' one paid operation includes classification and thinking usage without double charging cache',async()=>{
  const f=singlePassFixture(kind,{usage:{promptTokenCount:100,cachedContentTokenCount:80,candidatesTokenCount:20,thoughtsTokenCount:7,totalTokenCount:127}});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');
  assert.equal(providers(f).length,1);assert.equal(reserves(f).length,1);assert.equal(usages(f).length,1);
  assert.ok(f.calls.indexOf(reserves(f)[0])<f.calls.indexOf(providers(f)[0]));
  assert.equal(reserves(f)[0].body.p_operation_id,id(3));assert.equal(usages(f)[0].body.p_operation_id,id(3));
  assert.equal(usages(f)[0].body.p_prompt_tokens,100);assert.equal(usages(f)[0].body.p_output_tokens,27);assert.equal(usages(f)[0].body.p_total_tokens,127);
  assert.ok(!f.calls.some(c=>/release_unused|settle_audio/.test(c.name)));
 });
 for(const replay of [false,true])test(kind+' denied or replayed reservation cannot dispatch a model; replay='+replay,async()=>{
  const f=singlePassFixture(kind,{rpc:name=>name==='rpc_ai_test_budget_reserve_service'?Response.json({admitted:false,replay,reservationId:replay?id(9):null,code:replay?'AI_TEST_OPERATION_REPLAY':'AI_TEST_BUDGET_EXHAUSTED'}):undefined});
  const response=await f.start();
  if(kind==='WORKER'){
   assert.equal(response.status,503);assert.equal((await response.json()).code,replay?'AI_TEST_OPERATION_REPLAY':'AI_TEST_BUDGET_EXHAUSTED');
  }else{
   assert.equal(response.status,200);const events=(await response.text()).trim().split('\n\n').map(x=>JSON.parse(x.slice(6)));assert.equal(events.at(-1).kind,'safe_error');
  }
  await f.drain();assert.equal(providers(f).length,0);assert.equal(usages(f).length,0);
 });
 for(const mode of ['missing','network'])test(kind+' unknown usage retains its hold without zero accounting or a paid retry: '+mode,async()=>{
  const f=singlePassFixture(kind,{provider:({output})=>{if(mode==='network')throw Error('PRIVATE_TRANSPORT');return providerEnvelope(output,undefined);}});
  const events=await f.invoke();assert.equal(events.at(-1).kind,mode==='missing'?'final':'safe_error');
  assert.equal(reserves(f).length,1);assert.equal(providers(f).length,1);assert.equal(usages(f).length,0);
  assert.ok(!f.calls.some(c=>/release_unused|settle_audio/.test(c.name)));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_TRANSPORT'));
 });
 test(kind+' invalid semantic output still records measured provider use once',async()=>{
  const f=singlePassFixture(kind,{provider:()=>providerEnvelope({invalid:true},{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:7,totalTokenCount:127})});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'safe_error');assert.equal(providers(f).length,1);assert.equal(usages(f).length,1);
  assert.equal(usages(f)[0].body.p_total_tokens,127);assert.ok(!f.calls.some(c=>c.name.includes('with_first_plan_service')));
 });
}
