'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture,candidate:historicalCandidate}=require('./r09-applicant-suppression-fixture.cjs');

// Exercise the exact two new function definitions on the historical synthetic
// dispatch fixture. This is NOT the live preimage, Auth, native concurrency,
// resolver acceptance, or hosted deployment proof. The full guarded migration
// and its rollback must separately be tested on a current disposable clone.
const sql=fs.readFileSync(path.join(__dirname,'sql/r09_withdrawn_final_20261128.sql'),'utf8');
const defs=[...sql.matchAll(/CREATE OR REPLACE FUNCTION private\.(dispatch_cheap_candidate_admitted|push_suppression)\([\s\S]*?AS \$function\$[\s\S]*?\$function\$;/g)].map(m=>m[0]);
assert.equal(defs.length,2);

test('final withdrawal blocks dispatch and queued pushes without harming other opportunities',async t=>{
 const f=await fixture();
 const run=(name,fn)=>t.test(name,async()=>{await f.reset();await fn();});
 try{
   await f.db.exec(historicalCandidate);
   for(const definition of defs) await f.db.exec(definition);
   await run('first matching opportunity is still admitted',async()=>{
     const pair=await f.addPair();
     assert.equal(await f.gate(pair),true);
     assert.equal((await f.wave(pair)).inserted,1);
     assert.equal((await f.wave(pair)).inserted,0);
   });
   for(const [name,options] of [['ON-SITE',{}],['REMOTE',{worker:{modes:['REMOTE']},need:{mode:'REMOTE'}}]]){
     await run(name+' withdrawn account is not proactively invited',async()=>{
       const pair=await f.addPair(options);
       await f.response(pair,{status:'WITHDRAWN'});
       assert.equal(await f.gate(pair),false);
       assert.equal((await f.wave(pair)).inserted,0);
     });
   }
   await run('new revision does not revive a final withdrawal',async()=>{
     const pair=await f.addPair();
     await f.response(pair,{status:'WITHDRAWN'});
     await f.db.query('update public.needs set revision=2 where id=$1',[pair.need]);
     await f.db.query('update private.work_taxonomy_need_snapshots set need_revision=2 where need_id=$1',[pair.need]);
     assert.equal(await f.gate(pair),false);
     assert.equal((await f.wave(pair)).inserted,0);
   });
   await run('other candidate and other task retain existing eligibility',async()=>{
     const pair=await f.addPair(),other=await f.addPair();
     await f.response(pair,{status:'WITHDRAWN'});
     assert.equal(await f.gate({...other,need:pair.need}),true);
     assert.equal(await f.gate({...pair,need:other.need}),true);
   });
   await run('already queued opportunity is suppressed before claim',async()=>{
     const pair=await f.addPair();await f.device(pair);await f.wave(pair);
     const delivery=await f.pushDelivery(pair);
     await f.response(pair,{status:'WITHDRAWN'});
     assert.equal(await f.suppression(delivery),'ALREADY_RESPONDED');
     assert.equal((await f.claim()).kind,'NONE');
     assert.equal((await f.ledger()).sendCount,0);
   });
   await run('withdrawal committed between claim and begin prevents send',async()=>{
     const pair=await f.addPair();await f.device(pair);await f.wave(pair);
     const lease=await f.claim();assert.equal(lease.kind,'SEND');
     await f.response(pair,{status:'WITHDRAWN'});
     assert.equal((await f.begin(lease)).kind,'SUPPRESSED');
     assert.equal((await f.ledger()).sendCount,0);
   });
   await run('a non-opportunity event is not suppressed by withdrawal',async()=>{
     const pair=await f.addPair();await f.wave(pair);
     const delivery=await f.pushDelivery(pair);
     await f.response(pair,{status:'WITHDRAWN'});
     await f.db.query("update public.user_activity_events set event_type='MESSAGE_RECEIVED',entity_type='AGREEMENT' where recipient_user_id=$1",[pair.user]);
     assert.equal(await f.suppression(delivery),null);
   });
 }finally{await f.db.close();}
});
