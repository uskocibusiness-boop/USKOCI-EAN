'use strict';
// Opt-in isolated PG17 proof. All clients are verified against the fresh local
// data directory by the shared launcher; never connects to hosted Supabase.
// Use USKOCI_PG_FIXTURE_PORT=55435 for concurrent independent agent work.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {startFixture,stopFixture,connectFixtureClient}=require('./p0-discovery-native-benchmark.cjs');
const {fixture,cases,source,executable,preimage,sha,iso}=require('./r13-profile-sweep-fixture.cjs');
const output=path.resolve(process.argv[2]||path.join(__dirname,'../docs/plan/proofs/r13-profile-sweep-native-20261108.json'));
const evidence={recordedAt:new Date().toISOString(),sourceBaseHead:execFileSync('git',['rev-parse','HEAD'],{cwd:path.join(__dirname,'..'),encoding:'utf8'}).trim(),
 candidateSha256:sha(source),preimageSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r13_profile_sweep_20261108.preimage.json'))),
 fixtureSha256:sha(fs.readFileSync(path.join(__dirname,'r13-profile-sweep-fixture.cjs'))),harnessSha256:sha(fs.readFileSync(__filename)),
 boundary:'SOURCE_ONLY_NATIVE_POSTGRESQL_17_PROFILE_SWEEP_NO_HOSTED_MUTATIONS',
 comparedCurrentFunctionBodies:preimage.functions.map(x=>({signature:x.signature,bodyMd5:x.body_md5})),scenarios:[],
 limitations:[
  'Synthetic rows in an isolated captured SQL graph, not a full Supabase clone or real user/device traffic.',
  'Actual captured profile requeue predicate, account-world and queue upsert bodies execute on PostgreSQL17; app profile/Need seeding bypasses application writers deliberately.',
  'Probe triggers and an explicitly marked post-COMMIT advisory barrier observe transaction/session ordering; they are never added to the candidate or hosted server.',
  'The process-failure scenario terminates a local PostgreSQL client backend after one commit, then resumes using a fresh connection and durable cursor. It does not stop the whole PostgreSQL server.',
  'This change proves profile-sweep transaction boundaries, not hosted throughput, 300000-user capacity, Expo/FCM or native Android.',
  'The100 profile and200 Need limits are per invocation/profile; concurrent calls do not add a new fleet-global quota.',
  'The30-second cutoff retains the existing assumption that a profile write commits within30 seconds of its updated_at. Unbounded older long-running writers remain outside this contract.',
  'Five other marketplace maintenance phases, their error and partial-progress semantics, hosted role/security and Cron switch acceptance still gate R13 activation. Source guard remains active.'
 ]};
const clients=[];let f;
async function client(){const c=await connectFixtureClient();c.on('error',()=>{});clients.push(c);return c;}
async function record(name,action){
 const start=process.hrtime.bigint();const result=await action();
 const row={name,result,elapsedMs:Number(process.hrtime.bigint()-start)/1e6};evidence.scenarios.push(row);console.log(JSON.stringify(row));
}
async function waitCondition(probe,label){
 const until=Date.now()+5000;while(Date.now()<until){if(await probe())return;await new Promise(r=>setTimeout(r,10));}
 throw new Error('Timed out observing '+label);
}
const barrierKey=19091335;
const marker='    -- R13_PROFILE_COMMIT_BOUNDARY: the next profile cannot undo this one.';
function instrumented(){
 assert.equal(executable.split(marker).length,2,'single explicit first-profile commit boundary');
 return executable.replace(marker,`    IF v_profile_count=0 AND coalesce((v_profile_result->>'profiles')::integer,0)=1
      AND pg_catalog.current_setting('r13_fixture.pause_after_first',true)='on' THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(${barrierKey});
    END IF;
${marker}`);
}
async function awaitBarrier(pid){
 await waitCondition(()=>f.value("select exists(select 1 from pg_stat_activity where pid=$1 and state='active' and wait_event='advisory') as value",[pid]),'post-first-COMMIT barrier');
}
async function main(){
 f=await startFixture(Driver=>fixture({Driver,native:true}));
 evidence.postgres=await f.value('select version() as value');evidence.postgis=await f.value('select extensions.postgis_lib_version() as value');
 for(const [name,scenario]of cases){await f.reset();await record(name,()=>scenario(f));}
 await f.reset();
 await record('busy watermark is skipped without changing a profile or holding an unrelated queue lock',async()=>{
  await f.addProfile();await f.clearAudit();const before=await f.cursor(),holder=await client();
  await holder.query('begin');await holder.query("select value from private.marketplace_config where key='match_v1_profile_requeue' for update");
  try{await f.tick();assert.deepEqual(await f.events(),[]);assert.deepEqual(await f.cursor(),before);}
  finally{await holder.query('rollback');}
  await f.tick();assert.equal((await f.events('PROFILE')).length,1);return {busySkipped:true,cursorUnchangedWhileBusy:true,subsequentInvocationProcessesOnce:true};
 });
 await f.reset();
 await record('two native schedulers share the keyset cursor without processing the same timestamp/account twice',async()=>{
  const profiles=[];for(let i=0;i<101;i++)profiles.push(await f.addProfile());await f.clearAudit();
  await f.db.exec(instrumented());const lock=await client(),a=await client(),b=await client();
  await lock.query('select pg_advisory_lock($1)',[barrierKey]);await a.query("set r13_fixture.pause_after_first='on'");
  const pidA=(await a.query('select pg_backend_pid() as pid')).rows[0].pid;
  let pending;
  try{
   pending=f.tick(a).then(()=>({ok:true}),error=>({ok:false,code:error.code,message:error.message}));
   await awaitBarrier(pidA);assert.equal((await f.events('PROFILE')).length,1);
   // A has committed and holds no watermark lock. B must progress over all
   // remaining100 profiles rather than replaying A's local stale cursor.
   await f.tick(b);const processed=await f.events('PROFILE');assert.equal(processed.length,101);assert.equal(new Set(processed.map(x=>x.account_id)).size,101);assert.equal(new Set(processed.map(x=>x.txid)).size,101);
   const backendCounts=Array.from(new Set(processed.map(x=>x.pid))).map(pid=>processed.filter(x=>x.pid===pid).length).sort((x,y)=>x-y);assert.deepEqual(backendCounts,[1,100]);
   assert.deepEqual(processed.map(x=>x.account_id),profiles.map(x=>x.account));
   await lock.query('select pg_advisory_unlock($1)',[barrierKey]);assert.deepEqual(await pending,{ok:true});
   assert.equal((await f.events('PROFILE')).length,101);
   return {profiles:101,backendCounts,independentProfileTransactions:101,duplicates:0,postCommitBarrier:'TEST_INSTRUMENTATION_ONLY'};
  }finally{
   await lock.query('select pg_advisory_unlock_all()');if(pending)await pending;await f.db.exec(executable);
  }
 });
 await f.reset();
 await record('backend termination after first profile COMMIT preserves200 queue writes and resumes with a fresh client',async()=>{
  const profiles=[];for(let i=0;i<3;i++)profiles.push(await f.addProfile());const tasks=[];for(let i=0;i<200;i++)tasks.push(await f.addTask());await f.clearQueue();await f.clearAudit();
  await f.db.exec(instrumented());const lock=await client(),runner=await client();
  await lock.query('select pg_advisory_lock($1)',[barrierKey]);await runner.query("set r13_fixture.pause_after_first='on'");
  const pid=(await runner.query('select pg_backend_pid() as pid')).rows[0].pid;let pending;
  try{
   pending=f.tick(runner).then(()=>({ok:true}),error=>({ok:false,code:error.code,message:error.message}));await awaitBarrier(pid);
   const before=await f.events();assert.equal(before.filter(x=>x.event==='PROFILE').length,1);assert.equal(before.filter(x=>x.event==='QUEUE').length,200);assert.equal(new Set(before.map(x=>x.txid)).size,1);
   assert.equal((await f.cursor()).afterAccount,profiles[0].account);assert.deepEqual(await f.queueIds(),tasks.sort());
   assert.equal(await f.value('select pg_terminate_backend($1) as value',[pid]),true);const terminated=await pending;assert.equal(terminated.code,'57P01');
   assert.equal((await f.cursor()).afterAccount,profiles[0].account);assert.deepEqual(await f.queueIds(),tasks.sort());
   await lock.query('select pg_advisory_unlock($1)',[barrierKey]);await f.db.exec(executable);
   const fresh=await client();await f.tick(fresh);const after=await f.events('PROFILE');assert.deepEqual(after.map(x=>x.account_id),profiles.map(x=>x.account));assert.equal((await f.events('QUEUE')).length,200);
   return {terminatedClientSqlstate:terminated.code,committedQueueWritesSurvive:200,durableFirstProfile:profiles[0].account,resumedProfiles:2,duplicateProfileOrQueueWrites:0,freshConnection:true};
  }finally{
   await lock.query('select pg_advisory_unlock_all()');if(pending)await pending;await f.db.exec(executable);
  }
 });
 await f.reset();
 await record('an explicit outer transaction rejects the first internal COMMIT and rolls back profile plus queue',async()=>{
  await f.addProfile();await f.addTask();await f.clearQueue();await f.clearAudit();const before=await f.cursor(),c=await client();
  await c.query('begin');try{await assert.rejects(f.tick(c),error=>error.code==='2D000');}finally{await c.query('rollback');}
  assert.deepEqual(await f.cursor(),before);assert.deepEqual(await f.queueIds(),[]);assert.deepEqual(await f.events(),[]);
  return {sqlstate:'2D000',partialCursorOrQueueCommits:0};
 });
 await f.reset();
 await record('time budget yields after the first completed profile and preserves the remaining cursor work',async()=>{
  for(let i=0;i<5;i++)await f.addProfile();await f.clearAudit();
  await f.db.exec(`update private.marketplace_config set value=jsonb_set(value,'{tickBudgetSeconds}','0.001') where key='match_v1_dispatch';
   create function private.r13_profile_slow_fixture() returns trigger language plpgsql as $$begin
    if new.key='match_v1_profile_requeue' then perform pg_sleep(0.02);end if;return new;end$$;
   create trigger r13_profile_slow_fixture after update on private.marketplace_config for each row execute function private.r13_profile_slow_fixture();`);
  try{await f.tick();assert.equal((await f.events('PROFILE')).length,1);}
  finally{await f.db.exec("drop trigger r13_profile_slow_fixture on private.marketplace_config;drop function private.r13_profile_slow_fixture();update private.marketplace_config set value=jsonb_set(value,'{tickBudgetSeconds}','40') where key='match_v1_dispatch'");}
  await f.tick();assert.equal((await f.events('PROFILE')).length,5);
  return {syntheticBudgetSeconds:0.001,deterministicTestDelayMs:20,firstInvocationProfiles:1,resumedProfiles:4,duplicates:0};
 });
 evidence.completedAt=new Date().toISOString();evidence.result='PASS';
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log('Evidence: '+output);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 for(const c of clients)try{await c.end();}catch{}
 await stopFixture();
});
