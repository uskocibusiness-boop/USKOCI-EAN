// Actual recovery helper; synthetic RPC transport, no model or hosted writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../../functions/_shared/completeFirstPlan.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {completeFirstPlan}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const writer='rpc_complete_worker_ai_turn_with_first_plan_service';
const args={p_account_id:'owned',p_attempt_id:'attempt',p_output:{patch:{skills:['Lektura']}}};
const envelope={saved:true};
const decode=value=>{assert.deepEqual(value,envelope);return value;};
const ok=data=>({ok:true,status:200,data});
function scenario(replies){const calls=[];return {calls,run:()=>completeFirstPlan({writer,args,decode,
 rpc:async(name,body,signal,timeout)=>{calls.push({name,body,signal,timeout});
  assert.ok(replies.length,'unexpected RPC');const reply=replies.shift();if(reply instanceof Error)throw reply;return reply;}})};}
test('confirmed atomic response uses one write and no readback',async()=>{
 const f=scenario([ok(envelope)]);assert.deepEqual(await f.run(),envelope);assert.equal(f.calls.length,1);
});
for(const lost of [new Error('PRIVATE transport'),{ok:false,status:504,data:null},ok(null)])
test('lost/malformed completion resolves exact durable result without another write: '+String(lost.status??lost.data),async()=>{
 const f=scenario([lost,ok({state:'COMPLETED',envelope})]);assert.deepEqual(await f.run(),envelope);
 assert.deepEqual(f.calls.map(c=>c.name),[writer,'rpc_ai_read_first_plan_completion_service']);
 assert.deepEqual(f.calls[1].body,{p_writer:writer,p_arguments:args});
});
test('only unknown transport plus owned PENDING permits one identical replay',async()=>{
 const f=scenario([new Error('lost'),ok({state:'PENDING'}),new Error('lost again'),ok({state:'COMPLETED',envelope})]);
 assert.deepEqual(await f.run(),envelope);assert.equal(f.calls.length,4);
 assert.deepEqual(f.calls[0].body,f.calls[2].body);assert.notEqual(f.calls[0].body,f.calls[2].body);
});
for(const state of ['PENDING','CANCELLED','UNKNOWN','STALE'])test('decoded invalid response cannot authorize replay: '+state,async()=>{
 const f=scenario([ok(null),ok({state})]);await assert.rejects(f.run());assert.equal(f.calls.length,2);
});
for(const refusal of [{ok:false,status:403,data:null},{ok:false,status:400,data:{code:'PT409'}},
 {ok:false,status:503,data:{code:'42501'}}])test('authorization/domain refusal is not transport recovery: '+refusal.status,async()=>{
 const f=scenario([refusal]);await assert.rejects(f.run(),/WRITE_REFUSED/);assert.equal(f.calls.length,1);
});
test('two unconfirmed writes stop without a third attempt',async()=>{
 const f=scenario([new Error('lost'),ok({state:'PENDING'}),new Error('lost'),ok({state:'PENDING'})]);
 await assert.rejects(f.run(),/NOT_CONFIRMED/);assert.equal(f.calls.length,4);
});
test('unconfirmed read cannot grant a replay',async()=>{
 const f=scenario([new Error('lost'),{ok:false,status:503,data:null}]);await assert.rejects(f.run(),/READ_UNCONFIRMED/);
 assert.equal(f.calls.length,2);
});
test('malformed readback cannot masquerade as a completed operation',async()=>{
 const f=scenario([new Error('lost'),ok({state:'COMPLETED',envelope,unexpected:true})]);await assert.rejects(f.run());
 assert.equal(f.calls.length,2);
});
test('arguments are frozen before asynchronous I/O; caller mutation cannot change a replay',async()=>{
 const input=structuredClone(args),calls=[];
 await completeFirstPlan({writer,args:input,decode,rpc:async(name,body)=>{
  calls.push({name,body});input.p_output.patch.skills.push('Transport');
  if(calls.length===1)throw new Error('lost');
  return ok(calls.length===2?{state:'PENDING'}:envelope);
 }});
 assert.deepEqual(calls[0].body,calls[2].body);assert.deepEqual(calls[2].body.p_output.patch.skills,['Lektura']);
});
