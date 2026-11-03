// Current completion lifecycle. The old second-provider fixture is preserved in
// fixtures/retired-dual-provider-24ecfca4; no active handler dispatches that model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {singlePassFixture} from './single_pass_edge_fixture.mjs';
const gate=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function observed(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Expected boundary was never reached')),2000);})]);}finally{clearTimeout(timer);}}
const atomic=f=>f.calls.filter(c=>c.name.includes('with_first_plan_service'));
const providers=f=>f.calls.filter(c=>c.url.includes('generativelanguage.googleapis.com'));
const json=value=>Response.json(value);
for(const kind of ['NEED','WORKER']){
 test(kind+' usage settlement cannot hold an authoritative completion', {timeout:5000},async t=>{
  const started=gate(),release=gate();
  const f=singlePassFixture(kind,{rpc:async(name,body)=>{
   if(name!=='rpc_ai_test_record_usage_service')return;
   started.resolve();await release.promise;
   return json({recorded:true,authoritative:true,operationId:body.p_operation_id,promptTokens:body.p_prompt_tokens,outputTokens:body.p_output_tokens,totalTokens:body.p_total_tokens});
  }});
  t.after(async()=>{release.resolve();await f.drain();});
  const events=await f.invoke({waitBackground:false});await observed(started.promise);
  assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,1);assert.equal(providers(f).length,1);
  assert.ok(!f.calls.some(c=>/capture_gemini|publish|save_worker|push/.test(c.name)));
 });
 test(kind+' pending owned completion cannot expose unconfirmed text or a success card',{timeout:5000},async t=>{
  const started=gate(),release=gate();
  const f=singlePassFixture(kind,{rpc:async name=>{if(name.includes('with_first_plan_service')){started.resolve();await release.promise;}}});
  t.after(async()=>{release.resolve();await f.drain();});
  const response=await f.start();const reader=response.body.getReader();
  const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/"kind":"accepted"/);
  await observed(started.promise);let delivered=false;
  const pending=reader.read().then(value=>{delivered=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(delivered,false);
  assert.equal(atomic(f).length,1);assert.equal(providers(f).length,1);
  release.resolve();let text='';for(let part=await pending;!part.done;part=await reader.read())text+=new TextDecoder().decode(part.value);
  assert.match(text,/"kind":"final"/);assert.equal(atomic(f).length,1);
 });
 test(kind+' disconnect after dispatch retains the already obtained answer without another model',{timeout:5000},async t=>{
  const started=gate(),release=gate(),finished=gate();
  const f=singlePassFixture(kind,{rpc:async name=>{if(name.includes('with_first_plan_service')){started.resolve();await release.promise;finished.resolve();}}});
  t.after(async()=>{release.resolve();await f.drain();});
  const response=await f.start();await observed(started.promise);
  f.abort.abort();await response.body.cancel();
  assert.equal(atomic(f).length,1);assert.equal(atomic(f)[0].signal.aborted,false,'phone disconnect cannot abort the pending owned write');
  release.resolve();await observed(finished.promise);await f.drain();
  assert.equal(providers(f).length,1);
  assert.ok(!f.calls.some(c=>/capture_gemini|publish|save_worker|push/.test(c.name)));
 });
}
