'use strict';
// Isolated per-account SQL/serialization workload; never connects to Supabase.
// This measures first visible-page work against the retained old all-history
// reader. It is not 300k-user, concurrent, network, device or hosted PG evidence.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createReviewFixture}=require('./r08-blind-reviews-fixture.cjs');
const stem=path.join(__dirname,'sql/r09_agreement_groups_20261108');
const activeCount=50,historyCount=1000,iterations=25;
const view={section:'active',role:'all',outcome:'all',confirmationOnly:false,query:''};
const percentile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1];
const stats=values=>({samples:values.length,p50_ms:percentile(values,.5),p95_ms:percentile(values,.95),p99_ms:percentile(values,.99),raw_ms:values});
(async()=>{
 const f=await createReviewFixture();
 try{
  await f.db.exec(f.ratingCandidate);await f.db.exec(fs.readFileSync(stem+'.sql','utf8'));
  for(const statement of JSON.parse(fs.readFileSync(stem+'.fixture-indexes.json','utf8')).indexes)await f.db.exec(statement);
  await f.actor(f.REQUESTER);
  for(let n=0;n<historyCount;n++){const a=await f.agreement({noInterval:true});await f.cancel(a);}
  for(let n=0;n<activeCount;n++)await f.agreement({noInterval:true});
  await f.db.exec('analyze');
  const legacy=async()=>{
   let beforeAt=null,beforeId=null,calls=0,rows=0,bytes=0;
   for(;;){
    const p=await f.value("select public.rpc_list_my_agreements_page('ALL',100,$1,$2) as value",[beforeAt,beforeId]);
    calls++;rows+=p.items.length;bytes+=Buffer.byteLength(JSON.stringify(p));
    if(!p.hasMore)return{calls,rows,bytes};
    beforeAt=p.items.at(-1).sortAt;beforeId=p.items.at(-1).id;
   }
  };
  const paged=async()=>{
   const p=await f.value('select public.rpc_list_my_agreement_groups_page($1,20,null) as value',[view]);
   assert.equal(p.groups.length,20);assert.equal(p.counts.active,activeCount);assert.equal(p.counts.history,historyCount);
   return{calls:1,groups:p.groups.length,rows:p.groups.reduce((n,g)=>n+g.items.length,0),bytes:Buffer.byteLength(JSON.stringify(p))};
  };
  for(let n=0;n<3;n++){await legacy();await paged();}
  const oldTimes=[],newTimes=[];let oldWork,newWork;
  for(let n=0;n<iterations;n++){
   for(const kind of n%2?['new','old']:['old','new']){
    const start=performance.now(),result=await(kind==='old'?legacy():paged());
    const elapsed=Math.round((performance.now()-start)*1000)/1000;
    if(kind==='old'){oldTimes.push(elapsed);oldWork=result;}else{newTimes.push(elapsed);newWork=result;}
   }
  }
  assert.equal(oldWork.rows,activeCount+historyCount);assert.equal(oldWork.calls,11);
  const history=await f.value('select public.rpc_list_my_agreement_groups_page($1,20,null) as value',[{...view,section:'history'}]);
  assert.equal(history.groups.length,20);assert.equal(history.hasMore,true);
  const result={measuredAtUtc:new Date().toISOString(),environment:{node:process.version,postgres:await f.value('select version() as value'),runtime:'PGlite, one process, synthetic local R08 schema fixture'},
   limitations:['One account, one sequential caller; no concurrent 300k-user claim.','Auth and unrelated world/dispatch transport are local fixture substitutes.','Local SQL and JSON serialization wall time, not network/phone latency.','25 measured samples after 3 warmup pairs; p99 is the maximum of this small sample.','Counts and grouping still inspect the owned account rows; unrelated account scale was not measured.','Only the Agreement reader is counted; optional card-capacity/cancellation reads are separate.'],
   fixture:{ownedAgreements:activeCount+historyCount,activeGroups:activeCount,historyGroups:historyCount,pageGroups:20},
   oldAllHistory:{...oldWork,...stats(oldTimes)},newFirstActivePage:{...newWork,...stats(newTimes)},historyFirstPageGroups:history.groups.length};
  const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
 }finally{await f.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
