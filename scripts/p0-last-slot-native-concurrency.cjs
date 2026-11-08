'use strict';
// Opt-in native PostgreSQL test. Three genuinely overlapping two-connection
// selection scenarios; no hosted mutations and no changes to production SQL.
// Auth, eligibility, calendars, notifications/audit remain explicit R07 seams.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {startFixture,stopFixture,connectFixtureClient}=require('./p0-discovery-native-benchmark.cjs');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/p0_last_slot_concurrency_20261108.source.json'),'utf8'));
const writerSql='select public.rpc_select_response($1,$2,$3,$4,$5,$6) as value';
const clients=[];
async function priceFixture(NativeFixture){
 const mod={exports:{}};
 const injected=name=>name==='@electric-sql/pglite'?{PGlite:NativeFixture}:require(name);
 new Function('require','__dirname','module','exports',fs.readFileSync(path.join(__dirname,'r07-price-fixture.cjs'),'utf8'))(injected,__dirname,mod,mod.exports);
 return mod.exports.createPriceFixture();
}
function launch(client,args){
 const run={started:process.hrtime.bigint(),result:null};
 run.settled=client.query(writerSql,args).then(result=>({ok:true,agreementId:result.rows[0].value}),
  error=>({ok:false,code:error.code,message:error.message})).then(result=>{
   run.result={...result,elapsedMs:Number(process.hrtime.bigint()-run.started)/1e6};return run.result;
  });
 return run;
}
async function main(){
 const f=await startFixture(priceFixture),{db,value}=f;
 await db.exec(f.candidate); // Existing reviewed R07 price snapshot, local only.
 // Replace the fixture counter with the exact current DEV counter, including
 // SECURITY DEFINER and named input. The selection writer is never substituted.
 await db.exec('drop function public.fn_need_covered_slots(uuid)');await db.exec(source.counter.definition);
 const hashes=await f.rows(`select p.oid::regprocedure::text as signature,md5(prosrc) as body_md5
  from pg_proc p where oid=any($1::regprocedure[]) order by 1`,[[source.writer.signature,'public.fn_need_covered_slots(uuid)']]);
 assert.equal(hashes.find(x=>x.signature.startsWith('rpc_select_response')).body_md5,source.writer.body_md5);
 assert.equal(hashes.find(x=>x.signature.startsWith('fn_need_covered_slots')).body_md5,source.counter.body_md5);
 const secondProfile='66666666-6666-4666-8666-666666666666';
 await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
  values($1,$2,'WORKER','Drugi test radnik','Novi Sad',array['Selidbe'],'ACTIVE')`,[secondProfile,f.FOREIGN]);
 const gatePid=Number(await value('select pg_backend_pid() as value'));
 const connect=async(label)=>{
  const client=await connectFixtureClient();clients.push(client);
  await client.query("select set_config('application_name',$1,false),set_config('request.jwt.claim.sub',$2,false)",[label,f.REQUESTER]);
  await client.query("set role authenticated;set statement_timeout='5s';set lock_timeout='2s'");
  return {client,pid:Number((await client.query('select pg_backend_pid() as pid')).rows[0].pid)};
 };
 const a=await connect('uskoci-last-slot-A'),b=await connect('uskoci-last-slot-B');
 assert.notEqual(a.pid,b.pid);assert.notEqual(a.pid,gatePid);assert.notEqual(b.pid,gatePid);
 const prepare=async()=>{
  const need=await f.need('HOURLY',1200,1);
  await f.actor(f.WORKER);const first=await f.submit(need,1200,1);
  await f.actor(f.FOREIGN);const second=await f.submit(need,1200,1,1,randomUUID(),secondProfile);
  const args=receipt=>[need,receipt.needRevision,receipt.responseId,receipt.version,receipt.contentHash,randomUUID()];
  return {need,receipts:[first,second],args:[args(first),args(second)]};
 };
 const snapshot=need=>value(`select jsonb_build_object(
  'requiredSlots',(select required_slots from public.needs where id=$1),
  'needStatus',(select status from public.needs where id=$1),
  'coveredSlots',public.fn_need_covered_slots($1),
  'selectedRows',(select count(*) from public.need_selections where need_id=$1 and status='SELECTED'),
  'agreements',(select count(*) from public.agreements where need_id=$1),
  'agreementVersions',(select count(*) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.need_id=$1),
  'executionRows',(select count(*) from public.agreement_execution e join public.agreements a on a.id=e.agreement_id where a.need_id=$1),
  'selectionCommands',(select count(*) from private.selection_commands where need_id=$1),
  'activations',(select count(*) from private.connection_activations where need_id=$1),
  'responseRows',(select count(*) from public.marketplace_responses where need_id=$1),
  'responseVersions',(select count(*) from public.marketplace_response_versions v join public.marketplace_responses r on r.id=v.response_id where r.need_id=$1),
  'selectedResponses',(select count(*) from public.marketplace_responses where need_id=$1 and status='SELECTED'),
  'proposals',(select count(*) from public.agreement_change_proposals p join public.agreements a on a.id=p.agreement_id where a.need_id=$1)
 ) as value`,[need]);
 const assertSingle=facts=>{
  assert.deepEqual(facts,{requiredSlots:1,needStatus:'ACTIVE',coveredSlots:1,selectedRows:1,agreements:1,agreementVersions:1,
   executionRows:1,selectionCommands:1,activations:1,responseRows:2,responseVersions:2,selectedResponses:1,proposals:0});
 };
 const lockState=async()=>{
  await db.query('select pg_stat_clear_snapshot()');
  return f.rows(`select pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers
   from pg_stat_activity where pid=any($1::integer[]) order by pid`,[[a.pid,b.pid]]);
 };
 const waitForOverlap=async runs=>{
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){
   const states=await lockState();
   if(states.length===2&&states.every(x=>x.state==='active'&&x.wait_event_type==='Lock'&&x.blockers.length>0))return states;
   if(runs.some(run=>run.result))throw new Error('RPC settled before genuine overlap: '+JSON.stringify(runs.map(run=>run.result)));
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  throw new Error('Two concurrent lock waits were not observed');
 };
 const scenarios=[];
 let gateOpen=false;
 try{
  for(const kind of ['two different workers for one place','one lock timeout and another successful selection','concurrent identical command replay']){
   const setup=await prepare();
   await a.client.query("set lock_timeout='2s'");await b.client.query("set lock_timeout='2s'");
   if(kind.includes('timeout'))await a.client.query("set lock_timeout='300ms'");
   const argsB=kind.includes('identical')?setup.args[0]:setup.args[1];
   await db.exec('begin');gateOpen=true;
   await db.query('select id from public.needs where id=$1 for update',[setup.need]);
   // Both RPC promises are launched before any result is awaited.
   const first=launch(a.client,setup.args[0]),second=launch(b.client,argsB);
   const overlap=await waitForOverlap([first,second]);
   let timeoutObserved=null;
   if(kind.includes('timeout')){
    timeoutObserved=await first.settled;assert.equal(timeoutObserved.ok,false);assert.equal(timeoutObserved.code,'55P03');
    assert.ok(timeoutObserved.elapsedMs>=250);
    const waiting=(await lockState()).find(x=>x.pid===b.pid);assert.equal(waiting.wait_event_type,'Lock');
    const pending=await snapshot(setup.need);assert.equal(pending.coveredSlots,0);assert.equal(pending.agreements,0);assert.equal(pending.selectionCommands,0);
   }
   await db.exec('commit');gateOpen=false;
   const outcomes=await Promise.all([first.settled,second.settled]);
   if(kind.includes('identical')){
    assert.ok(outcomes.every(x=>x.ok));assert.equal(outcomes[0].agreementId,outcomes[1].agreementId);
   }else{
    assert.equal(outcomes.filter(x=>x.ok).length,1);const refused=outcomes.find(x=>!x.ok);
    assert.equal(refused.code,kind.includes('timeout')?'55P03':'P0001');
    if(!kind.includes('timeout'))assert.equal(refused.message,'NEED_NOT_OPEN');
   }
   const facts=await snapshot(setup.need);assertSingle(facts);
   // A repeated successful command returns its original Agreement and cannot
   // duplicate rows; the rejected distinct intent stays rejected after unlock.
   for(const [index,connection,args]of[[0,a.client,setup.args[0]],[1,b.client,argsB]]){
    const replay=await launch(connection,args).settled;
    if(outcomes[index].ok){assert.equal(replay.ok,true);assert.equal(replay.agreementId,outcomes[index].agreementId);}
    else{assert.equal(replay.ok,false);assert.equal(replay.message,'NEED_NOT_OPEN');}
   }
   assert.deepEqual(await snapshot(setup.need),facts);
   scenarios.push({name:kind,overlap,timeoutObserved,outcomes,facts,idempotentReplayUnchanged:true});
  }
 }finally{if(gateOpen)await db.exec('rollback');}
 const result={capturedAt:new Date().toISOString(),postgres:await value('select version() as value'),
  writerSource:hashes,backendPids:{gate:gatePid,writerA:a.pid,writerB:b.pid},writerRole:'authenticated',
  transport:'Three separate native PostgreSQL TCP connections; both actual writer calls overlap before releasing the controlling Need-row lock.',
  scenarios,limitations:['Local synthetic fixture; not hosted JWT/PostgREST, complete RLS/trigger/FK replay, push delivery, or Android E2E.',
   'Exact current selection writer and covered-slots helper execute, including their real locks, constraints, selection/Agreement/command/activation writes.',
   'Existing R07 Auth identity, eligibility/calendar, notification/audit and dispatch seams remain bounded substitutes; no production logic is edited.',
   'Elapsed times include an intentional synchronization barrier and the intentional300ms lock timeout; these are concurrency proofs, not product latency measurements.']};
 const output=process.argv[2];if(!output)throw new Error('Pass a receipt path');
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 await Promise.all(clients.map(client=>client.end()));await stopFixture();
});
