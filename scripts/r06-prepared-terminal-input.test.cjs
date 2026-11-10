'use strict';

// Runs the actual captured owners and the incremental sweep change. No hosted
// write, policy change, provider call, or deletion of the only user text.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,candidate,A,C,R,T,TEXT}=require('./r06-pre-provider-input-fixture.cjs');
const privacySource=fs.readFileSync(path.join(__dirname,'sql/r06_prepared_input_lifecycle_20261110.sql'),'utf8');
const privacyCandidate=privacySource.slice(privacySource.indexOf('-- R06_PREPARED_PRIVACY_ISOLATED_START'));
const source=fs.readFileSync(path.join(__dirname,'sql/r06_prepared_terminal_input_20261110.sql'),'utf8');
const terminalCandidate=source.slice(source.indexOf('-- R06_TERMINAL_INPUT_ISOLATED_START'));
const rollbackSource=fs.readFileSync(path.join(__dirname,'sql/r06_prepared_terminal_input_20261110.rollback.sql'),'utf8');
const rollbackCandidate=rollbackSource.slice(rollbackSource.indexOf('-- R06_TERMINAL_ROLLBACK_ISOLATED_START'));
const baseline=process.env.USKOCI_R06_TERMINAL_BASELINE==='1';
const native=process.env.USKOCI_R06_TERMINAL_NATIVE==='1';
const runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const purposes=['NEED_SERVICE','WORKER_CAPABILITY'];
const relation=p=>p==='NEED_SERVICE'?'private.ai_need_turn_commands':'private.worker_ai_turns';
const dataset=p=>p==='NEED_SERVICE'?'taskAiTurns':'workerAiTurns';
const foreign='b1000000-0000-4000-8000-000000000002';
const report={recordedAt:new Date().toISOString(),scope:'SOURCE_ONLY_TERMINAL_INPUT_MINIMIZATION',native,baseline,
 sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),rollbackSha256:crypto.createHash('sha256').update(rollbackSource).digest('hex'),cases:[],failures:[],limits:[
  'Exact captured SQL owners with existing reduced context/closure fixture; not the complete hosted schema or policy execution.',
  'No live provider, Android, final user-text retention period or public export/closure acceptance.',
  'Native lock checks execute only when explicitly enabled with the isolated PostgreSQL runtime.',
 ]};

test('R06 terminal input retains the original user text without an unusable provider snapshot',async t=>{
 const f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
 const run=(name,fn)=>t.test(name,async()=>{try{await fn();report.cases.push({name,status:'PASS'});}catch(e){report.failures.push({name,error:e.message});throw e;}});
 const row=p=>f.value(`select to_jsonb(t) as value from ${relation(p)} t where account_id=$1 and client_request_id=$2`,[A,R]);
 const sweep=async at=>{const result=await f.value('select private.ai_turn_sweep_v5($1) as value',[at??null]);assert.deepEqual(result.errors,[]);return result;};
 const seed=async p=>{
  await f.seed(p);
  // A missing USER linkage is the actual lone-input boundary. Worker's normal
  // claimed message remains physically present, but is not canonical proof.
  if(p==='WORKER_CAPABILITY')await f.db.exec('update private.worker_ai_turns set user_message_id=null');
  await f.prepare(p);
 };
 const terminate=async(p,mode)=>{
  if(mode==='EXPIRED')await f.db.exec(`update ${relation(p)} set lease_expires_at=clock_timestamp()-interval '1 second'`);
  else await f.db.query(`update ${relation(p)} set state=$1,cancelled_at=${mode==='CANCELLED'?'clock_timestamp()':'null'}${p==='NEED_SERVICE'?",receipt="+(mode==='SUCCEEDED'?"'{}'::jsonb":"null"):''}`,[mode==='CANCELLED'?'FAILED':mode]);
 };
 const unchangedCommand=(before,after)=>assert.deepEqual(
  Object.fromEntries(Object.entries(after).filter(([k])=>!['prepared_input','prepared_input_sha256'].includes(k))),
  Object.fromEntries(Object.entries(before).filter(([k])=>!['prepared_input','prepared_input_sha256'].includes(k))));
 const minimized=async(p,before)=>{
  const after=await row(p);
  assert.deepEqual(after.prepared_input,{schemaVersion:'R06_RETAINED_TEXT_V1',input:{userText:TEXT},originalInputSha256:before.prepared_input_sha256});
  assert.equal(await f.value(`select encode(extensions.digest(prepared_input::text,'sha256'),'hex')=prepared_input_sha256 as value from ${relation(p)} where account_id=$1 and client_request_id=$2`,[A,R]),true);
  unchangedCommand(before,after);
  assert.deepEqual((await f.snapshot()).datasets[dataset(p)][0].preparedInput,{userText:TEXT});
  const erasure=await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',[relation(p),after,A,foreign]);
  assert.equal(erasure.patch.prepared_input,null);assert.equal(erasure.patch.prepared_input_sha256,null);
  assert.equal(Object.hasOwn(erasure.patch,'provider_dispatched'),false);
  return after;
 };
 try{
  await f.db.exec(candidate);await f.db.exec(privacyCandidate);
  // Keep the real captured Need closure trigger enabled for every changed row.
  await f.db.exec("create trigger pre_v3_closure_ai_command before insert or update on private.ai_need_turn_commands for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id')");
  await run('negative control: installed lifecycle keeps the unusable prompt after original lease expiry',async()=>{
   await seed('NEED_SERVICE');await terminate('NEED_SERVICE','EXPIRED');const before=await row('NEED_SERVICE');
   await sweep();assert.deepEqual((await row('NEED_SERVICE')).prepared_input,before.prepared_input);
   assert.ok(before.prepared_input.input.providerRequest.systemInstruction);
   assert.deepEqual(await f.read('NEED_SERVICE'),{state:'EXPIRED'});
  });
  await run('whole source is blocked; incremental owner change preserves all metadata and rejects reapplication',async()=>{
   await assert.rejects(f.db.exec(source),/R06_TERMINAL_INPUT_SOURCE_ONLY/);
   const metadata=await f.value("select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure");
   if(baseline)return;
   await f.db.exec(terminalCandidate);
   assert.deepEqual(await f.value("select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure"),metadata);
   const digest=source.match(/^-- R06_TERMINAL_POSTIMAGE .+ ([a-f0-9]{32})$/m)[1];
   assert.equal(await f.value("select md5(prosrc) as value from pg_proc where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure"),digest);
   await assert.rejects(f.db.exec(terminalCandidate),/R06_TERMINAL_PREIMAGE_DRIFT/);await f.db.exec('rollback');
  });
  for(const p of purposes){
   await run(`${p}: failed, cancelled, unconfirmed-success and expired single inputs retain only exact user text`,async()=>{
    for(const mode of ['FAILED','CANCELLED','SUCCEEDED','EXPIRED']){
     await seed(p);await terminate(p,mode);const before=await row(p);
     const money=await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b');
     await sweep();await minimized(p,before);
     assert.deepEqual(await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b'),money);
     assert.equal(await f.value('select settled_microusd is null as value from private.ai_test_reservations_v5'),true);
     assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
    }
   });
   await run(`${p}: active prepared and active dispatched input are not prematurely minimized`,async()=>{
    for(const dispatched of [false,true]){
     await seed(p);if(dispatched)await f.dispatch(p);
     const before=await row(p);await sweep();assert.deepEqual(await row(p),before);
     assert.equal((await f.read(p)).state,dispatched?'READ_ONLY':'PREPARED');
    }
   });
   await run(`${p}: minimized input cannot be redispatched, re-prepared or exposed to another account`,async()=>{
    for(const dispatched of [false,true]){
     await seed(p);if(dispatched)await f.dispatch(p);await terminate(p,'EXPIRED');const before=await row(p);
     await sweep();const after=await minimized(p,before);
     const state=dispatched?'READ_ONLY':'EXPIRED';
     assert.deepEqual(await f.read(p),{state});
     for(let i=0;i<2;i++)assert.deepEqual(await f.dispatchPrepared(p,before.prepared_input_sha256),{state,dispatched:false});
     await assert.rejects(f.prepare(p),/R06_INPUT_NOT_PREPARABLE/);
     await assert.rejects(f.read(p,{account:foreign}),/R06_INPUT_NOT_OWNED/);
     assert.deepEqual(await row(p),after);
     await sweep();assert.deepEqual(await row(p),after,'second sweep must not rewrite minimized input');
     assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
    }
   });
   await run(`${p}: account/conversation holds and closure restrictions retain the original snapshot`,async()=>{
    for(const restriction of ['account-hold','conversation-hold','closure']){
     await seed(p);await terminate(p,'EXPIRED');const before=await row(p);
     if(restriction==='closure')await f.db.query("insert into private.account_closure_requests(account_id,state) values($1,'READY')",[A]);
     else await f.db.query('insert into private.retention_holds(account_id,conversation_id,active) values($1,$2,true)',[A,restriction==='account-hold'?null:C]);
     await sweep();assert.deepEqual(await row(p),before);
     if(restriction!=='closure'){
      await f.db.exec('update private.retention_holds set active=false');await sweep();await minimized(p,before);
     }
    }
   });
   await run(`${p}: corrupt or unknown snapshot is retained instead of silently losing its context`,async()=>{
    for(const variant of ['digest','schema','text']){
     await seed(p);await terminate(p,'EXPIRED');
     if(variant==='digest')await f.db.exec(`update ${relation(p)} set prepared_input_sha256=repeat('f',64)`);
     else{
      await f.db.exec(`update ${relation(p)} set prepared_input=jsonb_set(prepared_input,'{${variant==='schema'?'schemaVersion':'input,userText'}}','${variant==='schema'?'"FUTURE_SCHEMA"':'null'}'::jsonb)`);
      await f.db.exec(`update ${relation(p)} set prepared_input_sha256=encode(extensions.digest(prepared_input::text,'sha256'),'hex')`);
     }
     const before=await row(p);await sweep();assert.deepEqual(await row(p),before);
    }
   });
   if(native)await run(`${p}: real row or retention lock contention preserves input until the lock is released`,async()=>{
    for(const lock of ['row','retention']){
     await seed(p);await terminate(p,'EXPIRED');const before=await row(p),locker=await runtime.connectFixtureClient();
     try{
      await locker.query('begin');
      if(lock==='row')await locker.query(`select turn_id from ${relation(p)} where account_id=$1 and client_request_id=$2 for update`,[A,R]);
      else await locker.query("select pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||$1::text,0))",[A]);
      await f.db.exec("set statement_timeout='2s'");await sweep();assert.deepEqual(await row(p),before);
      await locker.query('commit');await sweep();await minimized(p,before);
     }finally{await locker.query('rollback');await locker.end();await f.db.exec('reset statement_timeout');}
    }
   });
  }
  await run('the sweep shares one bounded 100-row budget and canonical copies have priority over old single inputs',async()=>{
   await seed('NEED_SERVICE');await terminate('NEED_SERVICE','EXPIRED');const current=await row('NEED_SERVICE');
   const columns=Object.keys(current),quote=s=>'"'+s.replaceAll('"','""')+'"';
   await f.db.query(`insert into private.ai_need_turn_commands(${columns.map(quote).join(',')})
    select ${columns.map(n=>'v.'+quote(n)).join(',')} from generate_series(1,101) g(i)
    cross join lateral jsonb_populate_record(null::private.ai_need_turn_commands,$1::jsonb||jsonb_build_object(
     'client_request_id',md5('terminal-request-'||g.i)::uuid,'turn_id',md5('terminal-turn-'||g.i)::uuid,
     'prepared_at',clock_timestamp()-interval '1 day','state','FAILED','receipt',null)) v`,[current]);
   await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) values($1,$2,$3,'USER',$4,1)",[T,A,C,TEXT]);
   await f.db.query("update private.ai_need_turn_commands set state='SUCCEEDED',receipt=jsonb_build_object('userMessageId',$1::uuid,'authoritative',true) where account_id=$2 and client_request_id=$3",[T,A,R]);
   await sweep();assert.equal((await row('NEED_SERVICE')).prepared_input,null);
   const counts=()=>f.value("select jsonb_build_object('original',count(*) filter(where prepared_input->>'schemaVersion'='R06_PREPARED_TEXT_V1'),'retained',count(*) filter(where prepared_input->>'schemaVersion'='R06_RETAINED_TEXT_V1')) as value from private.ai_need_turn_commands");
   assert.deepEqual(await counts(),{original:2,retained:99});await sweep();assert.deepEqual(await counts(),{original:0,retained:101});
  });
  await run('a caller-supplied future time cannot minimize an active prepared input',async()=>{
   await seed('NEED_SERVICE');const before=await row('NEED_SERVICE');
   await sweep(new Date(Date.now()+86400000).toISOString());
   assert.deepEqual((await row('NEED_SERVICE')).prepared_input,before.prepared_input);
  });
  await run('guarded code rollback retains minimized data, original markers and refusal of another dispatch',async()=>{
   await assert.rejects(f.db.exec(rollbackSource),/R06_TERMINAL_ROLLBACK_SOURCE_ONLY/);
   if(baseline)return;
   await seed('NEED_SERVICE');await terminate('NEED_SERVICE','EXPIRED');const original=await row('NEED_SERVICE');
   await sweep();const before=await minimized('NEED_SERVICE',original);
   const money=await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b');
   await f.db.exec(rollbackCandidate);await sweep();assert.deepEqual(await row('NEED_SERVICE'),before);
   assert.deepEqual(await f.read('NEED_SERVICE'),{state:'EXPIRED'});
   assert.deepEqual(await f.dispatchPrepared('NEED_SERVICE',original.prepared_input_sha256),{state:'EXPIRED',dispatched:false});
   assert.deepEqual(await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b'),money);
   assert.deepEqual((await f.snapshot()).datasets.taskAiTurns[0].preparedInput,{userText:TEXT});
   await assert.rejects(f.db.exec(rollbackCandidate),/R06_TERMINAL_ROLLBACK_PREIMAGE_DRIFT/);await f.db.exec('rollback');
   await f.db.exec(terminalCandidate);
  });
 }finally{
  if(native)await runtime.stopFixture();else await f.db.close();
  report.finishedAt=new Date().toISOString();report.passed=report.failures.length===0;
  if(process.env.USKOCI_R06_TERMINAL_PROOF)fs.writeFileSync(process.env.USKOCI_R06_TERMINAL_PROOF,JSON.stringify(report,null,2)+'\n');
 }
});
