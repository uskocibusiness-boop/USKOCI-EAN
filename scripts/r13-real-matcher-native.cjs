'use strict';
// Opt-in isolated PostgreSQL17/PostGIS proof. Never connects to Supabase DEV.
// Required USKOCI_POSTGRES_ROOT and USKOCI_PG_MODULE are handled by the existing
// fixture launcher, which verifies the freshly-created local data directory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {startFixture,stopFixture,connectFixtureClient}=require('./p0-discovery-native-benchmark.cjs');
const {fixture,candidate,source,procedure,capture,preimage,needId,profileId,workerId}=require('./r09-worker-activation-fixture.cjs');
const output=process.argv[2]||path.join(__dirname,'../docs/plan/proofs/r13-native-real-matcher-20261108.json');
const measured=async action=>{const start=process.hrtime.bigint();const result=await action();return {elapsedMs:Number(process.hrtime.bigint()-start)/1e6,result};};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const evidence={recordedAt:new Date().toISOString(),sourceHead:'fea25188863475c289c5c9fb47ab1866c2c9d887',
 candidateSha256:sha(candidate),procedureSha256:sha(procedure),
 captureSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r13_native_matcher_20261108.preimage.json'))),
 activationPreimageSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r09_worker_activation_20261108.preimage.json'))),
 fixtureSha256:sha(fs.readFileSync(path.join(__dirname,'r09-worker-activation-fixture.cjs'))),
 harnessSha256:sha(fs.readFileSync(__filename)),
 exactFunctionCount:capture.functions.length,exactRelationCount:capture.relations.length,
 activationOwnerFunctionCount:preimage.functions.length,
 deployment:'ISOLATED_ONLY_NO_DEV_CHANGES',scenarios:[],
 limitations:[
  'Local synthetic accounts, tasks and signed-scope rows; no real users, Auth/JWT HTTP, Android, Expo/FCM or transport calls.',
  'Captured real matcher, wave, event ledger, profile requeue and candidate procedure. External lifecycle/wake triggers and foreign keys are not installed; this is not a full Supabase copy.',
  'Native real PostGIS and real SQL functions run unchanged except the separately hash-guarded R09 activation candidate.',
  'Latency samples describe this isolated process only, not hosted capacity, p95/p99, or 300000-user readiness.',
  'Per-invocation notification budget is carried across commits; parallel invocations each retain their own budget. A fleet-global rate limit is not proven or introduced.',
  'Maintenance/expiry/autocompletion/export/retention/AI sweep transaction parity, hosted scheduler role and Cron switching remain unresolved. R13 remains source-only.',
  'Material task editing remains blocked by the existing writer; fixture revision changes only model already-authorized publications.'
 ]};
let f,workerSerial=0,needSerial=0,clients=[];
async function record(name,action){const m=await measured(action);evidence.scenarios.push({name,...m});console.log(JSON.stringify({name,elapsedMs:m.elapsedMs,result:m.result}));}
async function reset(config={}){
 await f.db.exec(`truncate private.dispatch_schedule,public.dispatch_rounds,public.opportunity_deliveries,public.user_activity_events,public.notification_deliveries;
  update public.needs set status='DRAFT';update public.worker_match_preferences set proactive_notifications=false;`);
 const actual=capture.marketplace_config.find(x=>x.key==='match_v1_dispatch').value;
 await f.db.query("update private.marketplace_config set value=$1 where key='match_v1_dispatch'",[{...actual,...config}]);
 await f.db.exec("update private.marketplace_config set value=jsonb_build_object('after',statement_timestamp(),'afterAccount','00000000-0000-0000-0000-000000000000') where key='match_v1_profile_requeue'");
}
async function workers(count,opts={}){const numbers=[];for(let i=0;i<count;i++){numbers.push(++workerSerial);await f.addWorker(workerSerial,opts);}return numbers;}
async function need(opts={}){const number=++needSerial;await f.addNeed(number,opts);return number;}
async function tick(client=f.db){return client.query('call private.dispatch_cooperative_candidate(25,statement_timestamp())');}
async function due(){await f.db.exec("update private.dispatch_schedule set next_run_at=statement_timestamp()-interval '1 second',locked_until=null");}
async function expectLedger(n){assert.deepEqual(await f.counts(),{opportunities:n,events:n,push:n,inApp:n,duplicates:0});}
async function waitCondition(probe,label){const until=Date.now()+5000;while(Date.now()<until){if(await probe())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out observing '+label);}
async function main(){
 f=await startFixture(Driver=>fixture({Driver,native:true}));
 await f.installProfileGuard();
 evidence.installedFunctionCount=f.installedFunctionCount;evidence.isolatedRelationCount=f.isolatedRelationCount;
 evidence.postgres=await f.value('select version() as value');evidence.postgis=await f.value('select extensions.postgis_full_version() as value');
 evidence.actualConfig=capture.marketplace_config;
 await f.db.exec(candidate);
 await record('Source gate and scheduler access: no client role can invoke the prototype',async()=>{
  await assert.rejects(f.db.exec(source),/R09_WORKER_ACTIVATION_SOURCE_ONLY/);
  const acl={};for(const role of ['anon','authenticated','service_role']){
   acl[role]=await f.value("select has_function_privilege($1,'private.dispatch_cooperative_candidate(integer,timestamp with time zone)','EXECUTE') as value",[role]);assert.equal(acl[role],false);
  }return {acl};
 });
 for(const count of [0,1,20,120,1000])await record(`${count} eligible workers: exact current DEV configuration, real onsite geography and matcher`,async()=>{
  await reset();await workers(count);const n=await need();
  const run=await measured(()=>tick());await expectLedger(count);
  const repeat=await measured(()=>{return f.db.query('select private.dispatch_next_wave($1)',[needId(n)]);});await expectLedger(count);
  assert.equal(await f.value('select count(*)::int as value from public.needs where id=$1 and approx_geog is not null',[needId(n)]),1);
  return {eligibleWorkers:count,...await f.counts(),firstDispatchMs:run.elapsedMs,repeatedDispatchMs:repeat.elapsedMs,networkPushAttempts:0};
 });
 await record('1201 eligible workers: real current1000 budget defers201 without duplicates',async()=>{
  await reset();await workers(1201);const n=await need();
  await tick();await expectLedger(1000);await due();await tick();await expectLedger(1201);
  return {eligibleWorkers:1201,perInvocationBudget:1000,totals:[1000,1201],final:await f.counts()};
 });
 await record('Two tasks and60 workers: notification budget50 survives per-task COMMIT',async()=>{
  await reset({workerNotifyPerTransaction:50,remoteWaves:false});await workers(60);await need();await need();
  const totals=[];for(const expected of [50,100,120]){await due();await tick();await expectLedger(expected);totals.push((await f.counts()).opportunities);}
  return {syntheticBudget:50,remoteWaves:false,totals,final:await f.counts()};
 });
 await record('Two concurrent schedulers claim distinct Needs and preserve unique real ledgers',async()=>{
  await reset({workerNotifyPerTransaction:50,remoteWaves:false});await workers(60);await need();await need();
  await f.db.exec(`create table private.fixture_scheduler_seen(pid integer,need_id uuid);
   create function private.fixture_overlap() returns trigger language plpgsql as $$begin
    insert into private.fixture_scheduler_seen values(pg_backend_pid(),new.need_id);perform pg_sleep(0.003);return new;end$$;
   create trigger fixture_overlap before insert on public.opportunity_deliveries for each row execute function private.fixture_overlap();`);
  const a=await connectFixtureClient(),b=await connectFixtureClient();clients.push(a,b);
  await Promise.all([tick(a),tick(b)]);await expectLedger(100);
  const owners=(await f.db.query('select pid,count(distinct need_id)::int tasks,count(*)::int opportunities from private.fixture_scheduler_seen group by pid order by pid')).rows;
  assert.equal(owners.length,2);assert.ok(owners.every(x=>x.opportunities===50&&x.tasks===1));
  await f.db.exec('drop trigger fixture_overlap on public.opportunity_deliveries;drop function private.fixture_overlap();drop table private.fixture_scheduler_seen;');
  await due();await tick();await expectLedger(120);
  return {parallelSchedulers:2,perInvocationBudget:50,firstCombined:100,distinctBackendOwners:owners.length,final:await f.counts(),fleetGlobalBudgetClaim:false};
 });
 await record('Concurrent direct waves for the same task serialize and create one business opportunity per worker',async()=>{
  await reset();await workers(20);const n=await need();const a=await connectFixtureClient(),b=await connectFixtureClient();clients.push(a,b);
  const results=await Promise.all([a,b].map(c=>c.query('select private.dispatch_next_wave($1) as value',[needId(n)])));
  const inserted=results.map(x=>x.rows[0].value.inserted).sort((a,b)=>a-b);assert.deepEqual(inserted,[0,20]);await expectLedger(20);
  return {parallelWaves:2,inserted,final:await f.counts()};
 });
 await record('Busy Need and busy queue are skipped without holding unrelated Need locks',async()=>{
  await reset();await workers(1);const n1=await need(),n2=await need(),n3=await need();
  const a=await connectFixtureClient(),b=await connectFixtureClient();clients.push(a,b);
  await a.query('begin');await a.query('select id from public.needs where id=$1 for update',[needId(n1)]);
  await b.query('begin');await b.query('select need_id from private.dispatch_schedule where need_id=$1 for update',[needId(n2)]);
  await tick();await expectLedger(1);
  assert.equal(await f.value('select need_id::text as value from public.opportunity_deliveries'),needId(n3));
  // If the skipped queue left its Need lock behind, NOWAIT would fail here.
  await a.query('select id from public.needs where id=$1 for update nowait',[needId(n2)]);
  await a.query('rollback');await b.query('rollback');await due();await tick();await expectLedger(3);
  return {skippedBusyNeed:true,skippedBusyQueue:true,skippedNeedLockReleased:true,final:await f.counts()};
 });
 await record('Connection cancellation during second task preserves the first committed task and retries without duplicates',async()=>{
  await reset();await workers(20);const n1=await need(),n2=await need();
  await f.db.exec(`create function private.fixture_interrupt() returns trigger language plpgsql as $$begin
   if new.need_id='${needId(n2)}'::uuid then perform pg_advisory_xact_lock(190913);end if;return new;end$$;
   create trigger fixture_interrupt before insert on public.opportunity_deliveries for each row execute function private.fixture_interrupt();`);
  const lock=await connectFixtureClient(),runner=await connectFixtureClient();clients.push(lock,runner);
  await lock.query('select pg_advisory_lock(190913)');
  const pid=(await runner.query('select pg_backend_pid() pid')).rows[0].pid;
  const pending=tick(runner).then(()=>({ok:true}),e=>({ok:false,code:e.code}));
  await waitCondition(()=>f.value("select exists(select 1 from pg_stat_activity where pid=$1 and wait_event='advisory') as value",[pid]),'second Need advisory barrier');
  await expectLedger(20);assert.equal(await f.value('select need_id::text as value from public.opportunity_deliveries limit1'.replace('limit1','limit 1')),needId(n1));
  await f.db.query('select pg_cancel_backend($1)',[pid]);const cancellation=await pending;assert.equal(cancellation.code,'57014');await expectLedger(20);
  await lock.query('select pg_advisory_unlock(190913)');
  await f.db.exec('drop trigger fixture_interrupt on public.opportunity_deliveries;drop function private.fixture_interrupt();');
  await due();await tick();await expectLedger(40);
  return {committedBeforeCancellation:20,cancellationSqlstate:cancellation.code,final:await f.counts()};
 });
 await record('REMOTE keeps its own300/1000 waves and30-minute window under actual configuration',async()=>{
  await reset();await workers(320,{modes:['REMOTE']});const n=await need({mode:'REMOTE'});
  const first=await f.value('select private.dispatch_next_wave($1) as value',[needId(n)]);assert.equal(first.inserted,300);await expectLedger(300);
  const early=await f.value('select private.dispatch_next_wave($1) as value',[needId(n)]);await expectLedger(300);
  // Move only synthetic prior round timestamps, modelling elapsed time without
  // changing the deployed function or pretending wall-clock30m actually passed.
  await f.db.query("update public.dispatch_rounds set created_at=statement_timestamp()-interval '31 minutes',deadline_at=statement_timestamp()-interval '1 minute' where need_id=$1",[needId(n)]);
  const second=await f.value('select private.dispatch_next_wave($1) as value',[needId(n)]);assert.equal(second.inserted,20);await expectLedger(320);
  return {first,early,second,simulatedElapsedWindow:true,final:await f.counts()};
 });
 await record('New worker sees an old task through actual matcher and can respond, without retroactive opportunity; new publication qualifies',async()=>{
  await reset();const old=await need({publishedAt:'2026-11-01T00:00:00Z'});const [w]=await workers(1);const current=await need();
  assert.equal(await f.value('select private.worker_need_match_v1($1,$2) as value',[needId(old),profileId(w)]),true);
  assert.equal(await f.value("select (private.match_detail($1,$2)->>'responseAllowed')::boolean as value",[needId(old),profileId(w)]),true);
  await tick();await expectLedger(1);assert.equal(await f.value('select need_id::text as value from public.opportunity_deliveries'),needId(current));
  return {oldStillMatches:true,oldManualResponseAllowed:true,oldOpportunities:0,newOpportunities:1,final:await f.counts()};
 });
 evidence.completedAt=new Date().toISOString();evidence.result='PASS';
 fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log('Evidence: '+path.resolve(output));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const c of clients)try{await c.end();}catch{}await stopFixture();});
