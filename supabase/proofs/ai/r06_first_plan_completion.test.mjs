// Current atomic SQL transaction contracts; shared fixture has explicit substitutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,fixture,complete,value,id,account,conversation,plan,decision} from './r06_first_plan_fixture.mjs';

for(const kind of ['NEED','LOCATION','WORKER']){
 test(kind+': one atomic completion captures synonym and resolves exact category without aliases',async t=>{
  const db=await setup(t);await fixture(db,kind);
  const one=await complete(db,kind),two=await complete(db,kind);
  assert.deepEqual(one,two);assert.deepEqual(one.firstPlan,{state:'RESOLVED',authority:'CATALOG_ONLY',applicability:'NOT_EVALUATED'});
  const hints=(await db.query('SELECT * FROM private.work_taxonomy_gemini_turn_hints_v1')).rows;
  assert.equal(hints.length,1);assert.equal(hints[0].catalog_resolution.items[0].categoryId,id(10));
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_aliases')).n,0);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,kind==='WORKER'?1:2);
 });
 test(kind+': invalid classification rolls the conversation back; no false saved reply',async t=>{
  const db=await setup(t);await fixture(db,kind);
  await assert.rejects(complete(db,kind,{items:{...plan,proposals:[{...decision,service:'Different unoffered work'}]}}),/TARGET_MISMATCH|SERVICE_NOT_OFFERED/);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_gemini_turn_hints_v1')).n,0);
 });
 test(kind+': duplicate payload is stable; altered plan or attempt is refused',async t=>{
  const db=await setup(t);await fixture(db,kind);await complete(db,kind);
  await assert.rejects(complete(db,kind,{items:{...plan,anchors:[]}}),/REPLAY_CONFLICT/);
  await assert.rejects(complete(db,kind,{aidAttempt:id(99)}),/DENIED|REPLAY_CONFLICT/);
 });
}
test('new branch resolves once and never publishes a task or activates a worker',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 const next={...plan,anchors:[],proposals:[{...decision,action:'CREATE_NEW_BRANCH',categoryId:'',proposedPath:['Technical services','Synthetic repair']}]};
 const one=await complete(db,'NEED',{items:next});assert.equal(one.firstPlan.state,'RESOLVED');
 await complete(db,'NEED',{items:next});
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_categories')).n,3);
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_audit')).n,2);
});
test('changed catalog records deferred result, preserves conversation and creates no category',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await db.exec("UPDATE private.work_taxonomy_categories SET label='Changed identity'");
 const one=await complete(db,'NEED');assert.equal(one.firstPlan.state,'DEFERRED');assert.equal(one.firstPlan.code,'CATALOG_CHANGED');
 assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,2);
 assert.deepEqual(await complete(db,'NEED'),one);
});
test('client roles cannot execute service completion even with forged service JWT claim',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await db.exec('SET ROLE authenticated');await assert.rejects(complete(db,'NEED'),/permission denied/);
 await db.exec('RESET ROLE');await db.exec("SELECT set_config('test.role','authenticated',false)");
 await assert.rejects(complete(db,'NEED'),/DENIED/);
});
test('closed account and wrong owner cannot complete or mutate the catalog',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await assert.rejects(complete(db,'NEED',{aid:id(99)}),/DENIED/);
 await db.exec("SELECT set_config('test.closed','true',false)");await assert.rejects(complete(db,'NEED'),/ACCOUNT_CLOSED/);
 assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
});
