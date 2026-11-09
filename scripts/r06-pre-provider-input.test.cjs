'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {spawn}=require('node:child_process');
const {fixture,source,candidate,preimage,input,A,C,R,ATT,T,TEXT}=require('./r06-pre-provider-input-fixture.cjs');
const native=process.env.USKOCI_R06_NATIVE==='1',runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const report={recordedAt:new Date().toISOString(),scope:'SOURCE_ONLY_BOUNDED_TEXT_COMMAND_CONTRACT',runtimeHandlersChanged:false,
 sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),cases:[],failures:[],limitations:[
 'No active Edge handler invokes this contract. This is not end-to-end Need/Worker restart or production activation.',
 'Photos/location replies are outside this bounded text-only contract. Existing accepted input/runtime behavior is unchanged.',
 'Synthetic data, no external model/HTTP/Auth/device call. A fixture row represents an invocation decision, not provider billing or delivery.',
 'Captured Need context, both dispatch owners, budget reservation, export and held-aware redaction bodies execute real SQL.',
 'Worker profile hash/document/service-mode assembly have explicit narrow SQL seams; actual Worker read-context and dispatch bodies are unchanged.',
 'Existing leases are never renewed. Expired/failed/changed-source/cancelled/dispatched commands cannot resume this contract.',
 'Known-usage and completion runtime paths are unchanged; no new receipt or billing improvement is claimed.',
 'Private export/redaction projections are tested; public policy certification, full erasure worker and large multi-command export capacity remain outside this proof.'
 ]};
report.artifactSha256=Object.fromEntries(['r06-pre-provider-input-fixture.cjs','r06-pre-provider-input.test.cjs','r06-pre-provider-input-process.cjs','r06-pre-provider-input-cold-process.cjs',
 '../supabase/migrations/20261107165752_r10_work_areas_projection_20261107.sql','../supabase/migrations/20261108225909_r10_owned_usage_projection_post_r09_20261108.sql',
 'sql/r06_pre_provider_input_20261108.preimage.json','sql/r06_pre_provider_input_20261108.budget-schema.json'].map(name=>[name,
 crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex')]));
const processRun=(operation,purpose,data)=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(__dirname,'r06-pre-provider-input-process.cjs'),operation,purpose,JSON.stringify(operation==='prepare-crash'?[A,C,R,ATT]:[A,C,R])],{env:process.env,stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);
 child.on('close',code=>resolve({code,out:out.trim()?JSON.parse(out.trim()):null,err}));
 child.stdin.end(data?JSON.stringify(data):'');
});
const coldProcessRun=(directory,operation,purpose,data)=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(__dirname,'r06-pre-provider-input-cold-process.cjs'),operation,purpose,
  JSON.stringify(operation==='prepare-crash'?[A,C,R,ATT]:[A,C,R])],{
  env:{...process.env,USKOCI_R06_PGLITE_DIR:directory},stdio:['pipe','pipe','pipe'],timeout:60000});
 let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);
 child.on('close',code=>{try{resolve({code,out:out.trim()?JSON.parse(out.trim()):null,err});}catch(e){reject(e);}});
 child.stdin.end(data?JSON.stringify(data):'');
});
test('R06 source-only bounded input survives process loss without a second provider permission',async t=>{
 let f;
 const run=async(name,fn)=>t.test(name,async()=>{try{const result=await fn();report.cases.push({name,result:result??{},status:'PASS'});}catch(e){report.failures.push({name,error:e.message});throw e;}});
 const table=purpose=>purpose==='NEED_SERVICE'?'private.ai_need_turn_commands':'private.worker_ai_turns';
 try{
  f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
  const r10Catalog=await f.value('select private.data_export_dataset_catalog() as value');
  await run('whole candidate is blocked and does not install columns',async()=>{
   await assert.rejects(f.db.exec(source),/R06_PRE_PROVIDER_SOURCE_ONLY/);
   assert.equal(await f.value("select count(*)::int as value from pg_attribute where attrelid='private.ai_need_turn_commands'::regclass and attname='prepared_input'"),0);
  });
  await run('guarded installation preserves exact existing dispatch/reservation/usage bodies',async()=>{
   const before=await f.value("select jsonb_object_agg(p.oid::regprocedure::text,to_jsonb(p)) as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('rpc_ai_dispatch_need_turn_v2_service','rpc_dispatch_worker_ai_turn_service','rpc_ai_test_budget_reserve_service','rpc_ai_test_record_usage_service')");
   await f.db.exec(candidate);
   assert.deepEqual(await f.value("select jsonb_object_agg(p.oid::regprocedure::text,to_jsonb(p)) as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('rpc_ai_dispatch_need_turn_v2_service','rpc_dispatch_worker_ai_turn_service','rpc_ai_test_budget_reserve_service','rpc_ai_test_record_usage_service')"),before);
  });
  await run('new executors are service-only and command tables stay private',async()=>{
   for(const role of ['anon','authenticated']){
    for(const fn of ['public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)','public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)',
     'public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)'])
     assert.equal(await f.value("select has_function_privilege($1,$2,'EXECUTE') as value",[role,fn]),false);
    for(const tbl of ['private.ai_need_turn_commands','private.worker_ai_turns'])assert.equal(await f.value("select has_table_privilege($1,$2,'SELECT') as value",[role,tbl]),false);
   }
  });
  await run('R10 post-R09 owned usage projection survives R06 without dropping any existing dataset or field',async()=>{
   const after=await f.value('select private.data_export_dataset_catalog() as value');
   assert.equal(after.length,73);
   for(const prior of r10Catalog){
    const current=after.find(x=>x.key===prior.key);assert.ok(current);
    if(['taskAiTurns','workerAiTurns'].includes(prior.key)){
     assert.deepEqual({...current,fields:current.fields.filter(x=>!['preparedAt','preparedInput'].includes(x))},prior);
    }else assert.deepEqual(current,prior);
   }
   await f.seed();await f.prepare();
   await f.db.query(`insert into private.ai_test_usage_v5(operation_id,account_id,model,prompt_tokens,output_tokens,total_tokens)
    values($1,$2,'gemini-3.8-flash',123,45,168)`,[R,A]);
   let allocations=(await f.snapshot()).datasets.testAllocations;
   assert.equal(allocations.length,1);assert.equal(allocations[0].model,'gemini-3.8-flash');
   assert.equal(allocations[0].promptTokens,123);assert.equal(allocations[0].outputTokens,45);assert.equal(allocations[0].totalTokens,168);
   await f.db.query('update private.ai_test_usage_v5 set account_id=$1',[T]);
   allocations=(await f.snapshot()).datasets.testAllocations;
   assert.equal(allocations.length,1);assert.equal(allocations[0].model,null);assert.equal(allocations[0].promptTokens,null);
   await f.db.query(`insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd,measured_audio_bytes,measured_transcript_chars,
    settled_microusd,settlement_basis,settled_at)
    values($1,$2,'STT',200000,9007199254740993,7,200000,'MEASURED',clock_timestamp())`,[T,A]);
   const audio=(await f.snapshot()).datasets.testAllocations.find(x=>x.kind==='STT');
   assert.equal(audio.measuredAudioBytes,'9007199254740993');assert.equal(audio.measuredTranscriptChars,7);
  });
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY']){
   await run(`${purpose}: prepare atomically reserves once and returns immutable reconstructible input`,async()=>{
    await f.seed(purpose);const first=await f.prepare(purpose);assert.equal(first.state,'PREPARED');assert.equal(first.replay,false);
    const second=await f.prepare(purpose);assert.equal(second.replay,true);assert.equal(second.inputSha256,first.inputSha256);
    const read=await f.read(purpose);assert.equal(read.state,'PREPARED');assert.deepEqual(read.snapshot.input,input());
    assert.equal(read.snapshot.attemptId,ATT);assert.equal(read.snapshot.clientRequestId,R);assert.ok(read.snapshot.sourceContext);
    assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
    assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
    assert.equal(await f.value('select count(*)::int as value from private.ai_test_usage_v5'),0);
   });
   await run(`${purpose}: altered same-key input and wrong account/attempt cannot replace the snapshot`,async()=>{
    await f.seed(purpose);await f.prepare(purpose);
    const changed=input();changed.runtime.clock='2026-11-09T00:00:00Z';await assert.rejects(f.prepare(purpose,changed),/IMMUTABLE/);
    await assert.rejects(f.prepare(purpose,input(),{attempt:T}),/NOT_PREPARABLE/);
    await assert.rejects(f.read(purpose,{account:T}),/NOT_OWNED/);assert.equal((await f.read(purpose)).snapshot.input.runtime.clock,input().runtime.clock);
   });
   await run(`${purpose}: existing dispatch still wins once; post-dispatch recovery never renews permission`,async()=>{
    await f.seed(purpose);await f.prepare(purpose);
    const first=await f.dispatch(purpose);assert.equal(purpose==='NEED_SERVICE'?first:first.dispatched,true);
    assert.equal((await f.read(purpose)).state,'READ_ONLY');const second=await f.dispatch(purpose);assert.equal(purpose==='NEED_SERVICE'?second:second.dispatched,false);
    assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
   });
   await run(`${purpose}: prepared dispatch binds the exact attempt and snapshot and never grants permission twice`,async()=>{
    await f.seed(purpose);const prepared=await f.prepare(purpose);
    await assert.rejects(f.dispatchPrepared(purpose,'a'.repeat(64)),/DISPATCH_MISMATCH/);
    await assert.rejects(f.dispatchPrepared(purpose,prepared.inputSha256,{attempt:T}),/DISPATCH_MISMATCH/);
    await assert.rejects(f.dispatchPrepared(purpose,prepared.inputSha256,{account:T}),/NOT_OWNED/);
    const first=await f.dispatchPrepared(purpose,prepared.inputSha256);
    assert.equal(first.state,'DISPATCHED');assert.equal(first.dispatched,true);assert.deepEqual(first.snapshot.input,input());
    assert.deepEqual(await f.dispatchPrepared(purpose,prepared.inputSha256),{state:'READ_ONLY',dispatched:false});
    assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
    assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
   });
   await run(`${purpose}: a settled reservation after prepared read cannot be dispatched`,async()=>{
    await f.seed(purpose);const prepared=await f.prepare(purpose);assert.equal((await f.read(purpose)).state,'PREPARED');
    await f.db.exec("update private.ai_test_reservations_v5 set settled_microusd=250000,settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED',settled_at=clock_timestamp()");
    assert.deepEqual(await f.dispatchPrepared(purpose,prepared.inputSha256),{state:'READ_ONLY',dispatched:false});
    assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`),false);
   });
   await run(`${purpose}: prepared read cannot bypass later admission, price, account or ceiling revocation`,async()=>{
    const mutations=[
     'update private.ai_test_budget_v5 set enabled=false',
     'update private.ai_test_budget_v5 set reservation_cap_enforced=false',
     "update private.ai_test_budget_v5 set price_valid_until=clock_timestamp()-interval '1 second'",
     'update private.ai_test_budget_v5 set reserved_microusd=5000001',
     'update private.ai_test_accounts_v5 set retired_at=clock_timestamp()',
     'update auth.users set deleted_at=clock_timestamp()'
    ];
    for(const sql of mutations){
     await f.seed(purpose);const prepared=await f.prepare(purpose);assert.equal((await f.read(purpose)).state,'PREPARED');
     await f.db.exec(sql);
     assert.deepEqual(await f.dispatchPrepared(purpose,prepared.inputSha256),{state:'NOT_ADMITTED',dispatched:false},sql);
     assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`),false);
     assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),sql.includes('5000001')?5000001:250000);
    }
   });
   await run(`${purpose}: absent, erased, expired and changed-source inputs cannot be dispatched`,async()=>{
    await f.seed(purpose);assert.deepEqual(await f.dispatchPrepared(purpose,'a'.repeat(64)),{state:'ABSENT',dispatched:false});
    const mutations=[
     [`update ${table(purpose)} set prepared_input=null,prepared_input_sha256=null`,'ERASED'],
     [`update ${table(purpose)} set lease_expires_at=clock_timestamp()-interval '1 second'`,'EXPIRED'],
     [purpose==='NEED_SERVICE'?`update ${table(purpose)} set context_hash=repeat('0',64)`:'update private.worker_ai_sessions set revision=revision+1','STALE']
    ];
    for(const [sql,state] of mutations){
     await f.seed(purpose);const prepared=await f.prepare(purpose);await f.db.exec(sql);
     assert.deepEqual(await f.dispatchPrepared(purpose,prepared.inputSha256),{state,dispatched:false});
     assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`),false);
    }
   });
   await run(`${purpose}: expired, changed-source, cancelled and closing ownership stay closed`,async()=>{
    await f.seed(purpose);await f.prepare(purpose);
    await f.db.exec(`update ${table(purpose)} set lease_expires_at=clock_timestamp()-interval '1 second'`);assert.equal((await f.read(purpose)).state,'EXPIRED');
    await f.seed(purpose);await f.prepare(purpose);
    if(purpose==='NEED_SERVICE')await f.db.query("insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) values(gen_random_uuid(),$1,$2,'USER','Changed after capture',1)",[A,C]);
    else await f.db.exec('update private.worker_ai_sessions set revision=revision+1');
    assert.equal((await f.read(purpose)).state,'STALE');
    await f.seed(purpose);await f.prepare(purpose);await f.db.exec(`update ${table(purpose)} set state='FAILED',cancelled_at=clock_timestamp()`);assert.equal((await f.read(purpose)).state,'CLOSED');
    await f.seed(purpose);await f.prepare(purpose);await f.db.query("insert into private.account_closure_requests(account_id,state) values($1,'READY')",[A]);
    await assert.rejects(f.read(purpose),/ACCOUNT_CLOSING/);
   });
   await run(`${purpose}: real export includes owned snapshot; held-aware redaction removes input without clearing dispatch`,async()=>{
    await f.seed(purpose);await f.prepare(purpose);await f.dispatch(purpose);
    const exported=await f.snapshot(),key=purpose==='NEED_SERVICE'?'taskAiTurns':'workerAiTurns';
    assert.equal(exported.datasets[key][0].preparedInput.input.userText,TEXT);
    assert.equal(await f.snapshot(T),null);
    const row=await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
    await f.db.query('insert into private.retention_holds(account_id,conversation_id,active) values($1,$2,true)',[A,C]);
    assert.equal(await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',[table(purpose),row,A,T]),null);
    await f.db.exec('truncate private.retention_holds');
    const redaction=await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',[table(purpose),row,A,T]);
    assert.equal(redaction.patch.prepared_input,null);assert.equal(redaction.patch.prepared_input_sha256,null);
    assert.equal(Object.hasOwn(redaction.patch,'provider_dispatched'),false);assert.equal(Object.hasOwn(redaction.patch,'prepared_reservation_id'),false);
    const keys=Object.keys(redaction.patch),values=Object.values(redaction.patch);
    await f.db.query(`update ${table(purpose)} set ${keys.map((k,i)=>'"'+k+'"=$'+(i+1)).join(',')}`,values.map(x=>x&&typeof x==='object'?JSON.stringify(x):x));
    assert.equal(await f.value(`select prepared_input is null and prepared_input_sha256 is null and provider_dispatched as value from ${table(purpose)}`),true);
    assert.equal((await f.read(purpose)).state,'READ_ONLY');
   });
   await run(`${purpose}: undispatched redaction is ERASED and cannot repopulate its reservation`,async()=>{
    await f.seed(purpose);await f.prepare(purpose);
    const row=await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
    const redaction=await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',[table(purpose),row,A,T]);
    const keys=Object.keys(redaction.patch),values=Object.values(redaction.patch);
    await f.db.query(`update ${table(purpose)} set ${keys.map((k,i)=>'"'+k+'"=$'+(i+1)).join(',')}`,values.map(x=>x&&typeof x==='object'?JSON.stringify(x):x));
    const after=await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
    assert.equal(after.prepared_input,null);assert.equal(after.prepared_input_sha256,null);
    assert.equal(after.prepared_at,row.prepared_at);assert.equal(after.prepared_reservation_id,row.prepared_reservation_id);assert.equal(after.provider_dispatched,false);
    assert.deepEqual(await f.read(purpose),{state:'ERASED'});
    await assert.rejects(f.prepare(purpose),/INPUT_(?:ERASED|REQUEST_MISMATCH|NOT_PREPARABLE)/);
    assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
   });
   if(!native)await run(`${purpose}: file-backed SQL survives abrupt preparation and dispatch exits without repeat permission`,async()=>{
    for(const crashAfterDispatch of [false,true]){
     const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uskoci-r06-cold-'));
     try{
      const prepared=await coldProcessRun(directory,'prepare-crash',purpose,input());
      assert.equal(prepared.code,73,prepared.err);assert.equal(prepared.out.state,'PREPARED');
      if(crashAfterDispatch){
       const dispatched=await coldProcessRun(directory,'dispatch-crash',purpose);
       assert.equal(dispatched.code,74,dispatched.err);assert.deepEqual(dispatched.out,{state:'DISPATCHED',permission:true});
      }
      const resumed=await coldProcessRun(directory,'resume',purpose);
      assert.equal(resumed.code,0,resumed.err);assert.equal(resumed.out.send,!crashAfterDispatch);
      if(!crashAfterDispatch){assert.equal(resumed.out.inputSha256,prepared.out.inputSha256);assert.equal(resumed.out.userText,TEXT);}
      const repeated=await coldProcessRun(directory,'resume',purpose);
      assert.equal(repeated.code,0,repeated.err);assert.deepEqual(repeated.out,{state:'READ_ONLY',send:false});
      const counts=await coldProcessRun(directory,'count',purpose);
      assert.equal(counts.code,0,counts.err);assert.deepEqual(counts.out,{sends:crashAfterDispatch?0:1,reservations:1,reserved:250000});
     }finally{
      const resolved=fs.realpathSync(directory);
      assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('uskoci-r06-cold-'));
      fs.rmSync(resolved,{recursive:true,force:true});
     }
    }
    return {engine:'FILE_BACKED_PGLITE',prepareExit:73,dispatchExit:74,providerNetworkCalls:0,nativeLockProof:false};
   });
   if(native)await run(`${purpose}: committed preparation survives abrupt process exit; new process needs IDs only`,async()=>{
    await f.seed(purpose);const prepared=await processRun('prepare-crash',purpose,input());assert.equal(prepared.code,73,prepared.err);assert.equal(prepared.out.state,'PREPARED');
    const resumed=await processRun('resume',purpose);assert.equal(resumed.code,0,resumed.err);assert.equal(resumed.out.send,true);assert.equal(resumed.out.inputSha256,prepared.out.inputSha256);
    const repeated=await processRun('resume',purpose);assert.equal(repeated.code,0,repeated.err);assert.equal(repeated.out.send,false);assert.equal(repeated.out.state,'READ_ONLY');
    assert.equal(await f.value('select count(*)::int as value from private.fixture_provider_sends'),1);
    assert.equal(await f.value("select (body#>>'{contents,0,parts,0,text}') as value from private.fixture_provider_sends"),TEXT);
    return {terminatedExit:73,freshProcessInput:'IDENTIFIERS_ONLY',syntheticDispatchDecisions:1,providerNetworkCalls:0};
   });
   if(native)await run(`${purpose}: budget lock wait crossing the original lease rolls reservation and snapshot back`,async()=>{
    await f.seed(purpose);const holder=await runtime.connectFixtureClient(),writer=await runtime.connectFixtureClient();let pending;
    try{
     await holder.query('begin');await holder.query('select 1 from private.ai_test_budget_v5 where singleton for update');
     await f.db.exec(`update ${table(purpose)} set lease_expires_at=clock_timestamp()+interval '1 second'`);
     await writer.query("select set_config('request.jwt.claim.role','service_role',false)");
     const hp=(await holder.query('select pg_backend_pid() pid')).rows[0].pid,wp=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
     pending=writer.query('select public.rpc_ai_prepare_input_service($1,$2,$3,$4,$5,$6) as value',[A,C,R,ATT,purpose,input()]).then(value=>({value}),error=>({error}));
     const deadline=Date.now()+5000;let witnessed=false;
     while(Date.now()<deadline){
      const v=await f.value(`select $1::int=any(pg_blocking_pids($2)) and (select lease_expires_at<=clock_timestamp() from ${table(purpose)}) as value`,[hp,wp]);
      if(v){witnessed=true;break;}await new Promise(r=>setTimeout(r,10));
     }
     assert.equal(witnessed,true,'real budget lock wait crosses the same original lease');await holder.query('commit');
     const result=await pending;assert.match(result.error?.message||'',/R06_INPUT_LEASE_EXPIRED/);
     assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),0);
     assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),0);
     assert.equal(await f.value(`select prepared_input is null and not provider_dispatched as value from ${table(purpose)}`),true);
     return {observedBudgetLockWait:true,originalLeaseExpired:true,reservations:0,counter:0,preparedInputs:0};
    }finally{await holder.query('rollback');await holder.end();if(pending)await pending;await writer.end();}
   });
  }
  await run('unprepared legacy reservation is never adopted or reset',async()=>{
   await f.seed();await f.value("select public.rpc_ai_test_budget_reserve_service($1,$2,'LLM',250000) as value",[A,R]);
   await assert.rejects(f.prepare(),/BUDGET_NOT_ADMITTED/);assert.equal((await f.read()).state,'ABSENT');
   assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
  });
  await run('settled reservation makes prepare replay and fresh read non-executable',async()=>{
   await f.seed();await f.prepare();
   await f.db.exec("update private.ai_test_reservations_v5 set settled_microusd=250000,settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED',settled_at=clock_timestamp()");
   assert.deepEqual(await f.prepare(),{state:'READ_ONLY'});assert.deepEqual(await f.read(),{state:'READ_ONLY'});
   assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),250000);
  });
  await run('post-reservation size failure rolls snapshot and actual budget owner back together',async()=>{
   await f.seed('WORKER_CAPABILITY');
   await f.db.query("update private.worker_ai_sessions set candidate=jsonb_build_object('skills','[]'::jsonb,'bio',$1::text)",['c'.repeat(320000)]);
   const large=input();large.runtime.large='x'.repeat(220000);
   await assert.rejects(f.prepare('WORKER_CAPABILITY',large),/PREPARED_INPUT_TOO_LARGE/);
   assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),0);
   assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'),0);
   assert.equal((await f.read('WORKER_CAPABILITY')).state,'ABSENT');
  });
  await run('inline media and oversize input are refused only by this inactive candidate contract before any reservation',async()=>{
   await f.seed();const photo=input();photo.providerRequest.contents[0].parts.push({inlineData:{mimeType:'image/jpeg',data:'private-photo'}});
   await assert.rejects(f.prepare('NEED_SERVICE',photo),/TEXT_ONLY_INPUT/);const huge=input();huge.runtime.note='x'.repeat(270000);
   await assert.rejects(f.prepare('NEED_SERVICE',huge),/INPUT_INVALID/);assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),0);
  });
  await run('missing role, null catalog fingerprint and extra generation cost controls fail closed',async()=>{
   await f.seed();
   for(const role of [undefined,null,7]){const malformed=input();if(role===undefined)delete malformed.providerRequest.contents[0].role;else malformed.providerRequest.contents[0].role=role;
    await assert.rejects(f.prepare('NEED_SERVICE',malformed),/TEXT_REQUEST_INVALID/);}
   for(const fingerprint of [null,3]){const malformed=input();malformed.catalog={catalogVersion:1,catalogFingerprint:fingerprint,categories:[]};
    await assert.rejects(f.prepare('NEED_SERVICE',malformed),/CATALOG_INPUT_INVALID/);}
   const costly=input();costly.providerRequest.generationConfig.candidateCount=20;await assert.rejects(f.prepare('NEED_SERVICE',costly),/TEXT_REQUEST_INVALID/);
   assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),0);
  });
 }catch(e){report.failures.push({name:'suite',error:e.message});throw e;}
 finally{
  if(native)await runtime.stopFixture();else if(f)await f.db.close();
  report.result=report.failures.length?'FAIL':'PASS';report.completedAt=new Date().toISOString();
  if(process.env.USKOCI_R06_PROOF)fs.writeFileSync(process.env.USKOCI_R06_PROOF,JSON.stringify(report,null,2)+'\n');
 }
});
