'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,A,C,R,ATT,TEXT}=require('./r06-terminal-fixture.cjs');
const dormant=require('./r06-prepared-dev-package.cjs');
const terminal=require('./r06-terminal-dev-package.cjs');
const retry=require('./r06-prepared-retry-dev-package.cjs');
const native=process.env.USKOCI_R06_RETRY_NATIVE==='1',baseline=process.env.USKOCI_R06_RETRY_BASELINE==='1';
const runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const other='b1000000-0000-4000-8000-000000000002';
const report={recordedAt:new Date().toISOString(),scope:'R06_PREPARED_TERMINAL_RETRY_IDENTITY',native,baseline,cases:[],failures:[],limitations:[
 'Actual captured status, claim, prepared, dispatch, budget and sweep SQL; reduced existing R06 context/closure fixture.',
 'The unused location-review dependency raises if called: only text claim is tested here.',
 'No hosted mutation, provider call, runtime activation, policy certification or Android proof.',
]};

async function captureFixture(f){
 await f.db.exec('alter table private.retention_holds enable row level security;alter table public.ai_messages enable row level security;set search_path=pg_catalog');
 const system_identifier=await f.value('select system_identifier::text as value from pg_control_system()');
 const tables=[],functions=[];
 for(const relation of dormant.GUARDED_TABLES)tables.push((await f.db.query(dormant.tableSql(quote(relation)))).rows[0].jsonb_build_object);
 for(const {signature}of dormant.sourceContract().pins)functions.push((await f.db.query(dormant.functionSql(quote(signature)))).rows[0].jsonb_build_object);
 return {projectRef:dormant.PROJECT,database:'postgres',system_identifier,tables,functions};
}

test('R06 terminal prepared Need keeps its original attempt instead of advertising an impossible retry',async t=>{
 const f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
 const run=(name,fn)=>t.test(name,async()=>{try{await fn();report.cases.push({name,status:'PASS'});}catch(e){report.failures.push({name,error:e.message});throw e;}});
 const row=()=>f.value('select to_jsonb(t) as value from private.ai_need_turn_commands t where account_id=$1 and client_request_id=$2',[A,R]);
 const status=()=>f.value('select private.ai_need_turn_status($1,$2,$3) as value',[A,C,R]);
 const claim=(request=R,text=TEXT,account=A)=>f.value('select public.rpc_ai_claim_need_turn_v2_service($1,$2,$3,$4) as value',[account,C,request,text]);
 const money=()=>f.value("select jsonb_build_object('budget',(select to_jsonb(b) from private.ai_test_budget_v5 b),'reservations',(select jsonb_agg(to_jsonb(r) order by id) from private.ai_test_reservations_v5 r),'usage',(select count(*) from private.ai_test_usage_v5)) as value");
 const reject=async(sql,pattern)=>{await assert.rejects(f.db.exec(sql),pattern);await f.db.exec('rollback');};
 const failed=async()=>{await f.seed();await f.prepare();await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");};
 try{
  const capture=await captureFixture(f),first=dormant.buildPackage(capture),second=terminal.buildPackage(capture,f.terminalDependencies);
  const operation=retry.buildPackage(capture,f.terminalDependencies);
  // PostgreSQL plans this expression even for p_location_context=NULL. It must
  // never execute in this text-only regression, hence an explicit rejecting seam.
  await f.db.exec("create function private.ai_location_review_matches(uuid,jsonb) returns boolean language plpgsql as $$begin raise exception 'LOCATION_PATH_NOT_UNDER_TEST';end$$");
  await f.db.exec(first.install);await f.db.exec(second.install);
  await run('negative control: old status rotates the command attempt behind the immutable prepared snapshot',async()=>{
   await failed();const prior=await row(),budget=await money();
   assert.equal((await status()).retryAllowed,true);
   const result=await claim();assert.ok(result.claim);
   const after=await row();assert.notEqual(after.attempt_id,prior.attempt_id);
   assert.equal(after.prepared_input.attemptId,prior.attempt_id);
   assert.deepEqual(await f.read(),{state:'STALE'});assert.deepEqual(await money(),budget);
  });
  await run('read-only preflight verifies the current owner; wrong project, metadata and active turn stop installation',async()=>{
   await f.seed();const before=await row();await f.db.exec(operation.preflight);
   assert.deepEqual(await row(),before);
   await reject(operation.install,/R06_RETRY_ACTIVE_TURN_DRAIN_REQUIRED/);
   const foreign=retry.buildPackage({...capture,system_identifier:String(BigInt(capture.system_identifier)+1n)},f.terminalDependencies);
   await reject(foreign.install,/R06_DEV_PROJECT_MISMATCH/);
   await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
   await f.db.exec(`grant execute on function ${retry.signature} to service_role`);
   await reject(operation.install,/R06_RETRY_OWNER_DRIFT/);
   await f.db.exec(`revoke execute on function ${retry.signature} from service_role`);
  });
  await run('the increment changes only the status body and leaves data, admission and full function metadata intact',async()=>{
   await failed();const prior=await row(),budget=await money();
   const metadata=await f.value(`select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='${retry.signature}'::regprocedure`);
   if(baseline)return;
   await f.db.exec(operation.install);await f.db.exec(operation.postflight);
   assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   assert.deepEqual(await f.value(`select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='${retry.signature}'::regprocedure`),metadata);
   await reject(operation.install,/R06_RETRY_OWNER_DRIFT/);
  });
  for(const variant of ['FAILED','SWEPT','MINIMIZED','ERASED']){
   await run(`${variant}: same request cannot acquire a new attempt or replace its original reservation`,async()=>{
    await failed();
    if(variant==='SWEPT')await f.db.exec("update private.ai_need_turn_commands set state='PROCESSING',lease_expires_at=clock_timestamp()-interval '11 minutes'");
    if(variant==='SWEPT'||variant==='MINIMIZED')assert.deepEqual((await f.value('select private.ai_turn_sweep_v5() as value')).errors,[]);
    if(variant==='ERASED')await f.db.exec('update private.ai_need_turn_commands set prepared_input=null,prepared_input_sha256=null');
    const prior=await row(),budget=await money();assert.ok(prior.prepared_at);assert.equal(prior.state,'FAILED');
    assert.equal((await status()).retryAllowed,false);
    for(let i=0;i<2;i++){
     const result=await claim();assert.equal(result.claim,null);assert.equal(result.turn.retryAllowed,false);
    }
    assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   });
  }
  await run('an active prepared request still resumes the same attempt and grants provider dispatch at most once',async()=>{
   await f.seed();const prepared=await f.prepare(),prior=await row(),budget=await money();
   assert.equal((await claim()).claim,null);assert.equal((await f.read()).state,'PREPARED');
   assert.equal((await f.prepare()).replay,true);assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   assert.equal((await f.dispatchPrepared('NEED_SERVICE',prepared.inputSha256)).dispatched,true);
   assert.deepEqual(await f.dispatchPrepared('NEED_SERVICE',prepared.inputSha256),{state:'READ_ONLY',dispatched:false});
   assert.equal((await row()).attempt_id,ATT);assert.deepEqual(await money(),budget);
  });
  await run('legacy failed input without a prepared marker keeps its original bounded retry behavior',async()=>{
   await f.seed();await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
   const prior=await row();assert.equal(prior.prepared_at,null);assert.equal((await status()).retryAllowed,true);
   const result=await claim();assert.ok(result.claim);assert.notEqual(result.claim.attemptId,prior.attempt_id);
   assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),0);
  });
  await run('an explicit new request can proceed after the old terminal prepared request without mutating the old identity',async()=>{
   await failed();const prior=await row(),budget=await money();
   const result=await claim(other);assert.ok(result.claim);assert.equal(result.turn.clientRequestId,other);
   assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
  });
  await run('unknown dispatched, cancelled and closed requests remain fenced',async()=>{
   for(const variant of ['DISPATCHED','CANCELLED','CLOSED']){
    await f.seed();await f.prepare();
    if(variant==='DISPATCHED')await f.dispatch();
    await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
    if(variant==='CANCELLED')await f.db.exec('update private.ai_need_turn_commands set cancelled_at=clock_timestamp()');
    if(variant==='CLOSED')await f.db.exec("update public.ai_conversations set status='ABANDONED'");
    const prior=await row(),budget=await money();assert.equal((await status()).retryAllowed,false);
    assert.equal((await claim()).claim,null);assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   }
  });
  await run('changed text, another account and account closure cannot bypass ownership checks',async()=>{
   await failed();const prior=await row(),budget=await money();
   await assert.rejects(claim(R,TEXT+' changed'),/AI_REQUEST_ID_REUSED/);
   await assert.rejects(claim(R,TEXT,other),/CONVERSATION_NOT_FOUND/);
   await f.db.query("insert into private.account_closure_requests(account_id,state) values($1,'READY')",[A]);
   await assert.rejects(claim(),/ACCOUNT_CLOSING/);
   assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
  });
  if(native)await run('two real concurrent claim connections return the same terminal identity without mutation',async()=>{
   await failed();const prior=await row(),budget=await money(),client=await runtime.connectFixtureClient();
   try{
    await client.query("select set_config('request.jwt.claim.role','service_role',false)");
    const results=await Promise.all([claim(),client.query('select public.rpc_ai_claim_need_turn_v2_service($1,$2,$3,$4) as value',[A,C,R,TEXT]).then(r=>r.rows[0].value)]);
    for(const result of results){assert.equal(result.claim,null);assert.equal(result.turn.turnId,prior.turn_id);}
    assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   }finally{await client.end();}
  });
  await run('code rollback preserves all state and the operation can be installed again',async()=>{
   if(baseline)return;
   await failed();const prior=await row(),budget=await money();
   await f.db.exec(operation.rollback);await f.db.exec(operation.preflight);
   assert.deepEqual(await row(),prior);assert.deepEqual(await money(),budget);
   assert.equal((await status()).retryAllowed,true);
   await f.db.exec(operation.install);await f.db.exec(operation.postflight);
   assert.equal((await status()).retryAllowed,false);assert.deepEqual(await row(),prior);
  });
 }finally{
  if(native)await runtime.stopFixture();else await f.db.close();
  report.finishedAt=new Date().toISOString();report.passed=report.failures.length===0;
  if(process.env.USKOCI_R06_RETRY_PROOF)fs.writeFileSync(process.env.USKOCI_R06_RETRY_PROOF,JSON.stringify(report,null,2)+'\n');
 }
});
