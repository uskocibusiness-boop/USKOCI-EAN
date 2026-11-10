'use strict';
// Isolated SQL proof. No hosted writes, model calls, policy activation or new
// retention duration. Native mode adds real independent PostgreSQL sessions.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,candidate,A,C,R,ATT,T,TEXT}=require('./r06-pre-provider-input-fixture.cjs');
const source=fs.readFileSync(path.join(__dirname,'sql/r06_prepared_input_lifecycle_20261110.sql'),'utf8');
const lifecycle=source.slice(source.indexOf('-- R06_PREPARED_PRIVACY_ISOLATED_START'));
const native=process.env.USKOCI_R06_NATIVE==='1';
const runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const PURPOSES=['NEED_SERVICE','WORKER_CAPABILITY'];
const table=p=>p==='NEED_SERVICE'?'private.ai_need_turn_commands':'private.worker_ai_turns';
const key=p=>p==='NEED_SERVICE'?'taskAiTurns':'workerAiTurns';
const B='b1000000-0000-4000-8000-000000000002';
const D='b2000000-0000-4000-8000-000000000002';
const report={recordedAt:new Date().toISOString(),scope:'SOURCE_ONLY_PREPARED_INPUT_MINIMIZATION',native,
 sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),cases:[],failures:[],limitations:[
  'Synthetic local data and exact captured SQL owners; no hosted mutation, provider call, Android or full account-erasure execution.',
  'The full public export policy and closure binding stay closed. This proves changed projection and local certificate checks, not R10 acceptance.',
  'Cleanup requires an exact canonical user-message copy plus original lease/terminal state, at most 100 candidates per table. Missing copies, active holds and restricted accounts retain raw input.',
  'Fixture omits unrelated lifecycle triggers and keeps the existing Worker source-context seams. Need closure guard and certificate predicate execute real bodies.',
 ]};
test('R06 ephemeral prepared input preserves recovery, holds and original accounting',async t=>{
 let f;
 const run=async(name,fn)=>t.test(name,async()=>{try{await fn();report.cases.push({name,status:'PASS'});}catch(e){report.failures.push({name,error:e.message});throw e;}});
 const row=p=>f.value(`select to_jsonb(t) as value from ${table(p)} t where account_id=$1 and client_request_id=$2`,[A,R]);
 const sweep=async at=>{
  const result=await f.value('select private.ai_turn_sweep_v5($1) as value',[at??null]);
  assert.deepEqual(result.errors,[]);return result;
 };
 const seed=async p=>{
  await f.db.exec('reset role;truncate private.closure_redaction_certificate_v5,private.closure_actions_v5,private.closure_executions_v5');
  await f.seed(p);
  // The base fixture creates Worker's claimed USER row but omits this real
  // claim linkage. Restore it without replacing the provider/context owners.
  if(p==='WORKER_CAPABILITY')await f.db.query('update private.worker_ai_turns set user_message_id=$1',[T]);
 };
 const hold=async(conversation=C,account=A)=>f.db.query('insert into private.retention_holds(account_id,conversation_id,active) values($1,$2,true)',[account,conversation]);
 const expired=async p=>f.db.exec(`update ${table(p)} set lease_expires_at=clock_timestamp()-interval '1 second' where account_id='${A}' and client_request_id='${R}'`);
 const completeNeed=async()=>{
  // Synthetic canonical completion state: only the existing completion owner
  // writes this pair in production. This fixture tests the consumer's exact
  // receipt/message relationship, not a new completion writer.
  await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) values($1,$2,$3,'USER',$4,1)",[T,A,C,TEXT]);
  await f.db.query("update private.ai_need_turn_commands set state='SUCCEEDED',receipt=jsonb_build_object('userMessageId',$1::uuid,'authoritative',true) where account_id=$2 and client_request_id=$3",[T,A,R]);
 };
 const copyReady=async p=>{if(p==='NEED_SERVICE')await completeNeed();};
 const invariant=(before,after)=>{
  assert.equal(after.prepared_at,before.prepared_at);
  assert.equal(after.prepared_reservation_id,before.prepared_reservation_id);
  assert.equal(after.turn_id,before.turn_id);assert.equal(after.attempt_id,before.attempt_id);
  assert.equal(after.client_request_id,before.client_request_id);
 };
 try{
  f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
  await f.db.exec(candidate);
  // This is the exact active DEV Need trigger and captured implementation,
  // omitted by the broad base fixture. Keep its closed-account guard active.
  assert.equal(await f.value("select md5(prosrc) as value from pg_proc where oid='private.closure_guard_owned_write()'::regprocedure"),'f13117fd601dcb82de423b78f25acb4f');
  await f.db.exec("create trigger pre_v3_closure_ai_command before insert or update on private.ai_need_turn_commands for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id')");
  const signatures=[...source.matchAll(/^-- R06_LIFECYCLE_POSTIMAGE (.+) ([a-f0-9]{32})$/gm)];
  const metadata=await f.db.query('select oid::regprocedure::text signature,to_jsonb(p)-\'prosrc\' metadata from pg_proc p where oid=any($1::regprocedure[])',[signatures.map(x=>x[1])]);
  const catalogBefore=await f.value('select private.data_export_dataset_catalog() as value');
  await run('negative control: base dispatch retains raw prompt and export exposes it',async()=>{
   await seed();await f.prepare();await f.dispatchPrepared('NEED_SERVICE',(await f.read()).inputSha256);
   assert.ok((await row('NEED_SERVICE')).prepared_input.input.providerRequest.systemInstruction);
   assert.ok((await f.snapshot()).datasets.taskAiTurns[0].preparedInput.input.providerRequest.systemInstruction);
  });
  await run('whole companion is blocked; guarded slice installs with unchanged metadata',async()=>{
   await assert.rejects(f.db.exec(source),/R06_PREPARED_PRIVACY_SOURCE_ONLY/);
   await f.db.exec(lifecycle);
   for(const [,signature,digest] of signatures)assert.equal(await f.value('select md5(prosrc) as value from pg_proc where oid=to_regprocedure($1)',[signature]),digest);
   const after=await f.db.query('select oid::regprocedure::text signature,to_jsonb(p)-\'prosrc\' metadata from pg_proc p where oid=any($1::regprocedure[])',[signatures.map(x=>x[1])]);
   assert.deepEqual(after.rows,metadata.rows);assert.deepEqual(await f.value('select private.data_export_dataset_catalog() as value'),catalogBefore);
   await assert.rejects(f.db.exec(lifecycle),/R06_PRIVACY_PREIMAGE_DRIFT/);await f.db.exec('rollback');
  });
  for(const purpose of PURPOSES){
   await run(`${purpose}: one dispatch preserves the only user copy and returns the exact input`,async()=>{
    await seed(purpose);const prepared=await f.prepare(purpose),owned=await f.read(purpose),before=await row(purpose);
    assert.equal(owned.state,'PREPARED');assert.equal(before.prepared_input.input.userText,TEXT);
    const dispatched=await f.dispatchPrepared(purpose,prepared.inputSha256),after=await row(purpose);
    assert.equal(dispatched.dispatched,true);assert.deepEqual(dispatched.snapshot,owned.snapshot);
    if(purpose==='NEED_SERVICE'){
     assert.deepEqual(after.prepared_input,before.prepared_input);assert.equal(after.prepared_input_sha256,before.prepared_input_sha256);
    }else{assert.equal(after.prepared_input,null);assert.equal(after.prepared_input_sha256,null);}
    assert.equal(after.provider_dispatched,true);invariant(before,after);
    assert.deepEqual(await f.read(purpose),{state:'READ_ONLY'});
    assert.deepEqual(await f.dispatchPrepared(purpose,prepared.inputSha256),{state:'READ_ONLY',dispatched:false});
    assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
    assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
    assert.equal(await f.value('select settled_microusd is null as value from private.ai_test_reservations_v5'),true);
   });
   await run(`${purpose}: original active lease keeps input available and exported as owned user text`,async()=>{
    await seed(purpose);await f.prepare(purpose);const before=await row(purpose);await sweep();
    assert.deepEqual(await row(purpose),before);assert.equal((await f.read(purpose)).state,'PREPARED');
    const entry=(await f.snapshot()).datasets[key(purpose)][0];
    assert.deepEqual(entry.preparedInput,{userText:TEXT});assert.equal(entry.preparedAt,before.prepared_at);
    assert.equal(await f.snapshot(B),null);
   });
   await run(`${purpose}: expired input with no other user copy is retained; canonical duplicates can be erased`,async()=>{
    await seed(purpose);await f.prepare(purpose);await expired(purpose);const before=await row(purpose);await sweep();
    const after=await row(purpose);
    if(purpose==='NEED_SERVICE'){
     assert.deepEqual(after.prepared_input,before.prepared_input);assert.equal(after.prepared_input_sha256,before.prepared_input_sha256);
     assert.deepEqual(await f.read(purpose),{state:'EXPIRED'});
     assert.deepEqual((await f.snapshot()).datasets[key(purpose)][0].preparedInput,{userText:TEXT});
    }else{
     assert.equal(after.prepared_input,null);assert.equal(after.prepared_input_sha256,null);
     assert.deepEqual(await f.read(purpose),{state:'ERASED'});
     assert.equal((await f.snapshot()).datasets[key(purpose)][0].preparedInput,null);
    }
    assert.equal(after.state,'PROCESSING');assert.equal(after.provider_dispatched,false);invariant(before,after);
    assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
    assert.equal(await f.value('select settled_microusd is null as value from private.ai_test_reservations_v5'),true);
   });
   await run(`${purpose}: future sweep time cannot erase a still-valid prepared input`,async()=>{
    await seed(purpose);await f.prepare(purpose);const before=await row(purpose);
    await sweep(new Date(Date.now()+86400000).toISOString());
    assert.deepEqual((await row(purpose)).prepared_input,before.prepared_input);
    // The old sweep's caller-time state transitions are deliberately unchanged;
    // the new cleanup phase must not treat them as prior terminal evidence.
   });
   await run(`${purpose}: terminal or cancelled state alone cannot erase the only user copy`,async()=>{
    for(const mode of ['SUCCEEDED','FAILED','CANCELLED']){
     await seed(purpose);await f.prepare(purpose);
     await f.db.query(`update ${table(purpose)} set state=$1,cancelled_at=${mode==='CANCELLED'?'clock_timestamp()':'null'}${purpose==='NEED_SERVICE'?",receipt="+(mode==='SUCCEEDED'?"'{}'::jsonb":"null"):''}`,[mode==='CANCELLED'?'FAILED':mode]);
     const before=await row(purpose);await sweep();const after=await row(purpose);
     if(purpose==='NEED_SERVICE')assert.deepEqual(after.prepared_input,before.prepared_input);else assert.equal(after.prepared_input,null);
     assert.equal(after.provider_dispatched,false);assert.equal(after.state,before.state);invariant(before,after);
    }
   });
   await run(`${purpose}: conversation and whole-account holds preserve copies until released`,async()=>{
    for(const conversation of [C,null]){
     await seed(purpose);await f.prepare(purpose);await hold(conversation);
     const prepared=await f.read(purpose);await f.dispatchPrepared(purpose,prepared.inputSha256);await copyReady(purpose);await sweep();
     assert.ok((await row(purpose)).prepared_input);assert.deepEqual((await f.snapshot()).datasets[key(purpose)][0].preparedInput,{userText:TEXT});
     await f.db.exec('update private.retention_holds set active=false');await sweep();
     assert.equal((await row(purpose)).prepared_input,null);assert.equal((await row(purpose)).provider_dispatched,true);
     assert.deepEqual(await f.read(purpose),{state:'READ_ONLY'});
    }
   });
   await run(`${purpose}: unrelated account or conversation hold cannot retain this input`,async()=>{
    for(const [conversation,account]of [[D,A],[C,B]]){
     await seed(purpose);await f.prepare(purpose);await hold(conversation,account);
     await f.dispatchPrepared(purpose,(await f.read(purpose)).inputSha256);await copyReady(purpose);await sweep();assert.equal((await row(purpose)).prepared_input,null);
    }
   });
   await run(`${purpose}: closure restriction keeps erasure under the certified owner`,async()=>{
    await seed(purpose);await f.prepare(purpose);await expired(purpose);await copyReady(purpose);const before=await row(purpose);
    await f.db.query("insert into private.account_closure_requests(account_id,state) values($1,'READY')",[A]);
    await sweep();assert.deepEqual((await row(purpose)).prepared_input,before.prepared_input);
    await assert.rejects(f.read(purpose),/ACCOUNT_CLOSING/);
   });
   await run(`${purpose}: legacy dispatch residual is collected only with its exact canonical user copy`,async()=>{
    await seed(purpose);await f.prepare(purpose);await f.dispatch(purpose);assert.ok((await row(purpose)).prepared_input);
    await sweep();
    if(purpose==='NEED_SERVICE'){assert.ok((await row(purpose)).prepared_input);await completeNeed();await sweep();}
    assert.equal((await row(purpose)).prepared_input,null);assert.equal((await row(purpose)).provider_dispatched,true);
   });
   await run(`${purpose}: same-text foreign, unlinked, non-user or wrong-text messages are not canonical proof`,async()=>{
    for(const variant of ['unlinked','foreign-account','foreign-conversation','assistant','wrong-text',...(purpose==='NEED_SERVICE'?['malformed-receipt','unconfirmed-receipt']:[])]){
     await seed(purpose);await f.prepare(purpose);await expired(purpose);
     await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) values($1,$2,$3,$4,$5,2)",
      [D,variant==='foreign-account'?B:A,variant==='foreign-conversation'?D:C,variant==='assistant'?'ASSISTANT':'USER',variant==='wrong-text'?'Different text':TEXT]);
     if(purpose==='NEED_SERVICE')await f.db.query("update private.ai_need_turn_commands set state='SUCCEEDED',receipt=jsonb_build_object('userMessageId',$1::text,'authoritative',$2::boolean)",[variant==='unlinked'?null:variant==='malformed-receipt'?'invalid-uuid':D,variant!=='unconfirmed-receipt']);
     else await f.db.query('update private.worker_ai_turns set user_message_id=$1',[variant==='unlinked'?null:D]);
     const before=await row(purpose);await sweep();assert.deepEqual((await row(purpose)).prepared_input,before.prepared_input,variant);
    }
   });
   if(purpose==='WORKER_CAPABILITY')await run('Worker dispatch with a missing canonical linkage retains the only proven input',async()=>{
    await seed(purpose);await f.db.exec('update private.worker_ai_turns set user_message_id=null');
    const prepared=await f.prepare(purpose),before=await row(purpose);
    assert.equal((await f.dispatchPrepared(purpose,prepared.inputSha256)).dispatched,true);
    await sweep();assert.deepEqual((await row(purpose)).prepared_input,before.prepared_input);
    assert.deepEqual(await f.read(purpose),{state:'READ_ONLY'});
   });
   if(native)await run(`${purpose}: contended retention lock never blocks dispatch and its active hold survives sweep`,async()=>{
    await seed(purpose);await f.prepare(purpose);const prepared=await f.read(purpose),locker=await runtime.connectFixtureClient();
    try{
     await locker.query('begin');await locker.query("select pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||$1::text,0))",[A]);
     await locker.query('insert into private.retention_holds(account_id,conversation_id,active) values($1,$2,true)',[A,C]);
     await f.db.exec("set statement_timeout='2s'");
     assert.equal((await f.dispatchPrepared(purpose,prepared.inputSha256)).dispatched,true);assert.ok((await row(purpose)).prepared_input);
     await locker.query('commit');await copyReady(purpose);await sweep();assert.ok((await row(purpose)).prepared_input);
     await f.db.exec('update private.retention_holds set active=false');await sweep();assert.equal((await row(purpose)).prepared_input,null);
    }finally{await locker.query('rollback');await locker.end();await f.db.exec('reset statement_timeout');}
   });
   if(native)await run(`${purpose}: contended closure and row locks skip cleanup until released`,async()=>{
    for(const lock of ['closure','row']){
     await seed(purpose);await f.prepare(purpose);await expired(purpose);await copyReady(purpose);const locker=await runtime.connectFixtureClient();
     try{
      await locker.query('begin');
      if(lock==='closure')await locker.query('select pg_advisory_xact_lock(private.closure_account_key($1))',[A]);
      else await locker.query(`select turn_id from ${table(purpose)} where account_id=$1 and client_request_id=$2 for update`,[A,R]);
      await f.db.exec("set statement_timeout='2s'");await sweep();assert.ok((await row(purpose)).prepared_input);
      await locker.query('commit');await sweep();assert.equal((await row(purpose)).prepared_input,null);
     }finally{await locker.query('rollback');await locker.end();await f.db.exec('reset statement_timeout');}
    }
   });
  }
  await run('bounded sweep prefilters held accounts so later unheld input is not starved',async()=>{
   await seed();await f.prepare();await expired('NEED_SERVICE');await completeNeed();
   const current=await row('NEED_SERVICE');
   const columns=Object.keys(current),quote=s=>'"'+s.replaceAll('"','""')+'"';
   await f.db.query(`insert into private.ai_need_turn_commands(${columns.map(quote).join(',')})
    select ${columns.map(n=>'v.'+quote(n)).join(',')} from generate_series(1,101) g(i)
    cross join lateral jsonb_populate_record(null::private.ai_need_turn_commands,$1::jsonb||jsonb_build_object(
     'account_id',$2::uuid,'conversation_id',$3::uuid,'client_request_id',md5('held-request-'||g.i)::uuid,
     'turn_id',md5('held-turn-'||g.i)::uuid,'prepared_at',clock_timestamp()-interval '1 day',
     'receipt',jsonb_build_object('userMessageId',md5('held-message-'||g.i)::uuid,'authoritative',true))) v`,[current,B,D]);
   await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) select md5('held-message-'||i)::uuid,$1,$2,'USER',$3,100+i from generate_series(1,101) i",[B,D,TEXT]);
   await hold(null,B);await sweep();
   assert.equal((await row('NEED_SERVICE')).prepared_input,null);
   assert.equal(await f.value('select count(*)::int as value from private.ai_need_turn_commands where account_id=$1 and prepared_input is not null',[B]),101);
  });
  await run('new cleanup handles at most 100 candidates per owner per invocation',async()=>{
   await seed();await f.prepare();await expired('NEED_SERVICE');await completeNeed();const current=await row('NEED_SERVICE');
   const columns=Object.keys(current),quote=s=>'"'+s.replaceAll('"','""')+'"';
   await f.db.query(`insert into private.ai_need_turn_commands(${columns.map(quote).join(',')})
    select ${columns.map(n=>'v.'+quote(n)).join(',')} from generate_series(1,101) g(i)
    cross join lateral jsonb_populate_record(null::private.ai_need_turn_commands,$1::jsonb||jsonb_build_object(
     'client_request_id',md5('bounded-request-'||g.i)::uuid,'turn_id',md5('bounded-turn-'||g.i)::uuid,
     'receipt',jsonb_build_object('userMessageId',md5('bounded-message-'||g.i)::uuid,'authoritative',true))) v`,[current]);
   await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) select md5('bounded-message-'||i)::uuid,$1,$2,'USER',$3,100+i from generate_series(1,101) i",[A,C,TEXT]);
   await sweep();assert.equal(await f.value('select count(*)::int as value from private.ai_need_turn_commands where prepared_input is not null'),2);
   await sweep();assert.equal(await f.value('select count(*)::int as value from private.ai_need_turn_commands where prepared_input is not null'),0);
  });
  await run('more than 100 old Need inputs with no canonical copy cannot starve a later successful copy',async()=>{
   await seed();await f.prepare();await expired('NEED_SERVICE');await completeNeed();const current=await row('NEED_SERVICE');
   const columns=Object.keys(current),quote=s=>'"'+s.replaceAll('"','""')+'"';
   await f.db.query(`insert into private.ai_need_turn_commands(${columns.map(quote).join(',')})
    select ${columns.map(n=>'v.'+quote(n)).join(',')} from generate_series(1,101) g(i)
    cross join lateral jsonb_populate_record(null::private.ai_need_turn_commands,$1::jsonb||jsonb_build_object(
     'client_request_id',md5('missing-copy-request-'||g.i)::uuid,'turn_id',md5('missing-copy-turn-'||g.i)::uuid,
     'prepared_at',clock_timestamp()-interval '1 day','state','FAILED','receipt',null)) v`,[current]);
   await sweep();assert.equal((await row('NEED_SERVICE')).prepared_input,null);
   assert.equal(await f.value("select count(*)::int as value from private.ai_need_turn_commands where state='FAILED' and prepared_input is not null"),101);
  });
  await run('real certificate predicate admits exact erasure patch and rejects identity or provider-marker changes',async()=>{
   await seed();await f.prepare();await f.dispatch();
   const original=await row('NEED_SERVICE');
   const action='c1000000-0000-4000-8000-000000000001',generation='c2000000-0000-4000-8000-000000000001';
   await f.db.exec('begin');
   try{
    await f.db.query("insert into private.account_closure_requests(account_id,state) values($1,'READY')",[A]);
    await f.db.query(`insert into private.closure_executions_v5(account_id,request_id,generation,policy_sha256,binding,state)
     values($1,$2,$3,repeat('a',64),'{"adapterVersion":"OWNER_AF_D22_EVENT_ERASURE_V1","provenance":"OWNER_AF_D22","trigger":"CLOSURE_REQUESTED"}','EXECUTING')`,[A,R,generation]);
    await f.db.query("insert into private.closure_actions_v5(id,generation,account_id,kind,state,dispatched_at) values($1,$2,$3,'RELATIONAL_REDACT','DISPATCHED',clock_timestamp())",[action,generation,A]);
    const patch=(await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',['private.ai_need_turn_commands',original,A,generation])).patch;
    await f.db.query(`insert into private.closure_redaction_certificate_v5(backend_pid,transaction_id,account_id,generation,action_id,relation_oid,operation,old_sha256,patch)
     values(pg_backend_pid(),txid_current(),$1,$2,$3,'private.ai_need_turn_commands'::regclass,'UPDATE',encode(extensions.digest($4::jsonb::text,'sha256'),'hex'),$5)`,[A,generation,action,original,patch]);
    const check=next=>f.value("select private.closure_redaction_allowed_v5('private.ai_need_turn_commands'::regclass,'UPDATE',$1,$2) as value",[original,next]);
    const redacted={...original,...patch};assert.equal(await check(redacted),true);
    assert.equal(await check({...redacted,provider_dispatched:false}),false);
    assert.equal(await check({...redacted,prepared_reservation_id:B}),false);
    assert.equal(await check({...redacted,attempt_id:B}),false);
    await f.db.query("select set_config('request.jwt.claim.role','authenticated',false)");assert.equal(await check(redacted),false);await f.service();
    const keys=Object.keys(patch),values=Object.values(patch);
    await f.db.query(`update private.ai_need_turn_commands set ${keys.map((k,i)=>'"'+k+'"=$'+(i+1)).join(',')} where account_id='${A}' and client_request_id='${R}'`,values.map(x=>x&&typeof x==='object'?JSON.stringify(x):x));
    const after=await row('NEED_SERVICE');assert.equal(after.prepared_input,null);assert.equal(after.prepared_input_sha256,null);assert.equal(after.provider_dispatched,true);invariant(original,after);
    await f.db.exec('delete from private.closure_redaction_certificate_v5');
    await assert.rejects(f.db.exec(`update private.ai_need_turn_commands set prepared_input_sha256=null where account_id='${A}'`),/ACCOUNT_CLOSING/);
   }finally{await f.db.exec('rollback');}
  });
 }finally{
  if(native)await runtime.stopFixture();else if(f)await f.db.close();
  report.finishedAt=new Date().toISOString();report.passed=report.failures.length===0;
  if(process.env.USKOCI_R06_PRIVACY_PROOF)fs.writeFileSync(process.env.USKOCI_R06_PRIVACY_PROOF,JSON.stringify(report,null,2)+'\n');
 }
});
