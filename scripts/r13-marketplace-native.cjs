'use strict';
// Opt-in local PG17 integration. Never executes against hosted Supabase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {startFixture,stopFixture,connectFixtureClient}=require('./p0-discovery-native-benchmark.cjs');
const {fixture,source,preimage,sha,selectedTriggers}=require('./r13-marketplace-fixture.cjs');
const output=path.resolve(process.argv[2]||path.join(__dirname,'../docs/plan/proofs/r13-marketplace-native-20261108.json'));
const evidence={
 recordedAt:new Date().toISOString(),
 sourceBaseHead:execFileSync('git',['rev-parse','HEAD'],{cwd:path.join(__dirname,'..'),encoding:'utf8'}).trim(),
 boundary:'SOURCE_ONLY_NATIVE_POSTGRESQL_17_MARKETPLACE_MAINTENANCE_NO_HOSTED_MUTATIONS',
 candidateSha256:sha(source),
 dispatchCandidateSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'))),
 preimageSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r13_marketplace_20261108.preimage.json'))),
 fixtureSha256:sha(fs.readFileSync(path.join(__dirname,'r13-marketplace-fixture.cjs'))),
 harnessSha256:sha(fs.readFileSync(__filename)),
 f20OverlaySha256:sha(require('./r09-applicant-suppression-fixture.cjs').candidate),
 maintenanceOwners:preimage.functions.map(f=>({signature:f.signature,bodyMd5:f.body_md5})),
 selectedActualTriggers:selectedTriggers,scenarios:[],
 limitations:[
  'Synthetic data in the captured matcher/F20 graph; no user data, live provider, network wake, Storage deletion or hosted DDL.',
  'All invoked maintenance bodies are captured unchanged. Selected real Need/response lifecycle guards and timestamp triggers execute. Fixture input creation deliberately bypasses application writers.',
  'The base fixture omits foreign keys and external closure, safety, group/calendar, connection activation and invalidation triggers. This is not a full Supabase trigger-graph or security acceptance proof.',
  'Retention executes its real POLICY_NOT_READY gate with no retention execution certificate. Positive retention deletion, legal approval and full source-digest readiness remain unproven and unmodified.',
  'Expiry/urgent work and three AI command updates remain bulk operations. Six separate phase transactions do not establish a bound on those phases or on whole-CALL latency.',
  'Transaction segmentation intentionally changes crash atomicity: earlier phases remain committed. Retry starts from expiry and reconciles already committed current owner states.',
  'Actual native runtime differs from hosted PostgreSQL minor version; hosted procedure ownership, role/ACL/SET behavior, scheduler connection reuse and Cron acceptance remain release gates.',
  'The full-file source sentinel remains active. No Cron command or hosted object was changed by this test.'
 ]};
let f;const clients=[];
async function record(name,action){const start=process.hrtime.bigint(),result=await action();const row={name,result,elapsedMs:Number(process.hrtime.bigint()-start)/1e6};evidence.scenarios.push(row);console.log(JSON.stringify(row));}
async function main(){
 f=await startFixture(Driver=>fixture({Driver,native:true}));
 evidence.postgres=await f.value('select version() as value');evidence.postgis=await f.value('select extensions.postgis_lib_version() as value');
 await record('real six-phase cycle: late export error preserves expiry, actual F20 dispatch and completion; retry finishes without duplicated business effects',async()=>{
  const expired=await f.addPair();const oldWave=await f.wave(expired);assert.equal(oldWave.status,'SENT');const response=await f.response(expired);
  await f.db.query("update public.needs set response_deadline=statement_timestamp()-interval '1 minute' where id=$1",[expired.need]);
  await f.db.query('update public.worker_match_preferences set proactive_notifications=false where worker_profile_id=$1',[expired.profile]);
  const fresh=await f.addPair(),completed=await f.addPair({worker:{proactive:false}});
  const agreement=await f.seedCompletion(completed),exported=await f.seedExport(fresh.user),ai=await f.seedAI(fresh);
  await f.installLifecycleGuards();await f.db.exec('truncate private.r13_marketplace_probe');
  await f.db.exec("create function private.r13_export_fail_fixture() returns trigger language plpgsql as $$begin if current_setting('r13_fixture.fail_export',true)='on' then raise exception 'R13_TEST_EXPORT_FAILURE';end if;return NEW;end$$;"+
   "create trigger r13_export_fail_fixture before update on public.data_export_requests for each row execute function private.r13_export_fail_fixture();set r13_fixture.fail_export='on'");
  await assert.rejects(f.call(),e=>e.code==='P0001'&&/R13_TEST_EXPORT_FAILURE/.test(e.message));
  assert.equal(await f.value('select status as value from public.needs where id=$1',[expired.need]),'EXPIRED');
  assert.equal(await f.value('select status as value from public.marketplace_responses where id=$1',[response]),'EXPIRED');
  assert.equal(await f.value('select count(*)::int as value from private.dispatch_schedule where need_id=$1',[expired.need]),0);
  assert.equal(await f.value("select count(*)::int as value from public.opportunity_deliveries where need_id=$1 and status='EXPIRED'",[expired.need]),1);
  assert.equal(await f.value("select count(*)::int as value from public.opportunity_deliveries where need_id=$1 and status='READY'",[fresh.need]),1);
  assert.equal(await f.value('select status as value from public.agreements where id=$1',[agreement]),'COMPLETED');
  assert.equal(await f.value('select status as value from public.needs where id=$1',[completed.need]),'COMPLETED');
  assert.equal(await f.value('select state as value from public.agreement_execution where agreement_id=$1',[agreement]),'COMPLETED');
  assert.equal(await f.value('select status as value from public.data_export_requests where id=$1',[exported.receipt]),'READY');
  assert.ok(await f.value('select snapshot_text as value from private.data_export_artifacts where id=$1',[exported.artifact]),'export snapshot purge must roll back together with failed request update');
  assert.equal(await f.value('select state as value from private.ai_need_turn_commands where turn_id=$1',[ai.stale]),'PROCESSING');
  const partial=await f.probes();assert.deepEqual(partial.map(x=>x.phase),['EXPIRY','DISPATCH','COMPLETION']);assert.equal(new Set(partial.map(x=>x.txid)).size,3);
  await f.db.exec('reset r13_fixture.fail_export;drop trigger r13_export_fail_fixture on public.data_export_requests;drop function private.r13_export_fail_fixture()');
  await f.call();
  assert.equal(await f.value('select status as value from public.data_export_requests where id=$1',[exported.receipt]),'EXPIRED');
  const artifact=await f.value('select to_jsonb(a) as value from private.data_export_artifacts a where id=$1',[exported.artifact]);
  assert.equal(artifact.snapshot_text,null);assert.equal(artifact.download_grant_id,null);assert.equal(artifact.download_grant_expires_at,null);assert.equal(artifact.deleted_at,null);
  assert.equal(await f.value("select count(*)::int as value from private.marketplace_audit_log where event_type='DATA_EXPORT_EXPIRED' and entity_id=$1",[exported.receipt]),1);
  for(const [table,idcolumn,stale,freshId,failed]of [
   ['ai_need_turn_commands','turn_id',ai.stale,ai.fresh,'FAILED'],['worker_ai_turns','turn_id',ai.workerStale,ai.workerFresh,'FAILED'],['qa_ai_commands','id',ai.qaStale,ai.qaFresh,'CANCELLED']]){
   assert.equal(await f.value('select state as value from private.'+table+' where '+idcolumn+'=$1',[stale]),failed);
   assert.equal(await f.value('select state as value from private.'+table+' where '+idcolumn+'=$1',[freshId]),'PROCESSING');
   assert.equal(await f.value('select bool_and(provider_dispatched) as value from private.'+table),true);
  }
  assert.equal(await f.value("select count(*)::int as value from private.ai_task_review_commands where state='EVALUATED' and evaluation->>'code'='EVALUATOR_UNAVAILABLE'"),1);
  const retention=await f.value('select private.retention_maintenance(25) as value');assert.equal(retention.code,'POLICY_NOT_READY');assert.equal(retention.deletedConversations,0);
  assert.equal(await f.value('select count(*)::int as value from public.ai_conversations where id=$1',[ai.conversation]),1);
  const sweep=await f.value('select private.ai_turn_sweep_v5(statement_timestamp()) as value');assert.deepEqual(sweep.errors,[]);assert.equal(sweep.needTurnsFailed,0);assert.equal(sweep.workerTurnsFailed,0);assert.equal(sweep.qaCommandsCancelled,0);
  const probes=await f.probes();assert.deepEqual(probes.map(x=>x.phase),['EXPIRY','DISPATCH','COMPLETION','EXPORT','AI']);assert.equal(new Set(probes.map(x=>x.txid)).size,5);assert.ok(probes.every((x,i)=>i===0||BigInt(x.txid)>BigInt(probes[i-1].txid)));
  const before=await f.businessSnapshot();await f.call();assert.deepEqual(await f.businessSnapshot(),before);
  assert.equal(await f.value("select count(*)::int as value from public.user_activity_events where event_type='EXECUTION_STATE_CHANGED' and entity_id=$1",[agreement]),1);
  return {f20BodyMd5:'34dcf47d654d5960fbf7254c28745a04',actualPhaseEffects:probes.map(x=>x.phase),independentEffectTransactions:5,
   retentionGate:retention,exportFailureSqlstate:'P0001',earlierCommittedPhases:3,failedExportPurgeRolledBack:true,
   staleNeedWorkerQaCommandsEnded:3,freshLeasesUnchanged:3,providerDispatchedPreserved:true,completionNotificationCount:1,
   retryBusinessSnapshotIdentical:true,storageDeleted:false,selectedLifecycleGuardsExecuted:true};
 });
 await f.reset();
 await record('actual export owner preserves raw batch clamp and active snapshot lease; AI publication sweep keeps its independent100 cap',async()=>{
  const pair=await f.addPair({worker:{proactive:false}});await f.db.query("update public.needs set status='DRAFT' where id=$1",[pair.need]);
  for(let i=0;i<101;i++)await f.seedExport(pair.user);
  const first=await f.value('select private.data_export_maintenance(0) as value');assert.equal(first.expiredRequests,1);assert.equal(first.temporarySnapshotsPurged,1);
  const rest=await f.value('select private.data_export_maintenance(201) as value');assert.equal(rest.expiredRequests,100);assert.equal(rest.temporarySnapshotsPurged,100);assert.equal(rest.storageDeletionPerformed,false);
  assert.equal(await f.value('select count(*)::int as value from private.retention_policy_sets where retired_at is null'),1);
  await assert.rejects(f.db.exec("insert into private.retention_policy_sets(policy_version,counsel_reference,effective_at) values('r13-second-active-policy','ISOLATED_TEST_NO_LEGAL_APPROVAL',statement_timestamp())"),e=>e.code==='23505'&&e.constraint==='retention_policy_one_active_uq');
  const lease=await f.seedExport(pair.user,{activeLease:true});const busy=await f.value('select private.data_export_maintenance(1) as value');
  assert.equal(busy.expiredRequests,1);assert.equal(busy.temporarySnapshotsPurged,0);assert.ok(await f.value('select snapshot_text as value from private.data_export_artifacts where id=$1',[lease.artifact]));
  await f.db.query('update private.data_export_artifacts set verified_at=statement_timestamp() where id=$1',[lease.artifact]);
  assert.equal((await f.value('select private.data_export_maintenance(1) as value')).temporarySnapshotsPurged,1);
  await f.seedAI(pair,{reviews:101});
  const aiFirst=await f.value('select private.ai_turn_sweep_v5(statement_timestamp()) as value');assert.deepEqual(aiFirst.errors,[]);assert.equal(aiFirst.reviewEvaluationsStopped,100);
  const aiNext=await f.value('select private.ai_turn_sweep_v5(statement_timestamp()) as value');assert.deepEqual(aiNext.errors,[]);assert.equal(aiNext.reviewEvaluationsStopped,1);
  return {exportBatch0:1,exportBatch201:100,temporarySnapshotsPurged:101,oneActiveSyntheticPolicy:true,actualPolicyUniqueIndexEnforced:true,activeLeaseSnapshotHeld:true,verifiedSnapshotPurged:true,aiReviewFirst:100,aiReviewNext:1,aiErrors:[]};
 });
 await f.reset();
 await record('actual completion owner keeps its independent100 cap with wrapper batch1 and completes the101st on retry',async()=>{
  const agreements=[];for(let i=0;i<101;i++){const pair=await f.addPair({worker:{proactive:false}});agreements.push(await f.seedCompletion(pair));}
  await f.installLifecycleGuards();await f.db.exec('truncate private.r13_marketplace_probe');
  await f.call(1);assert.equal(await f.value("select count(*)::int as value from public.agreements where status='COMPLETED'"),100);
  assert.equal(await f.value("select count(*)::int as value from public.needs where status='COMPLETED'"),100);
  assert.equal(await f.value("select count(*)::int as value from public.user_activity_events where event_type='EXECUTION_STATE_CHANGED'"),100);
  const first=await f.probes();assert.equal(first.length,100);assert.ok(first.every(x=>x.phase==='COMPLETION'));assert.equal(new Set(first.map(x=>x.txid)).size,1);
  await f.call(1);assert.equal(await f.value("select count(*)::int as value from public.agreements where status='COMPLETED'"),101);
  assert.equal(await f.value("select count(*)::int as value from public.user_activity_events where event_type='EXECUTION_STATE_CHANGED'"),101);
  const done=await f.probes();assert.equal(done.length,101);assert.equal(new Set(done.map(x=>x.txid)).size,2);
  return {wrapperBatch:1,eligibleAgreements:101,firstCompleted:100,nextCompleted:1,completionTransactions:2,completionEvents:101,duplicateEvents:0,selectedLifecycleGuardsExecuted:true};
 });
 await f.reset();
 await record('native explicit transaction and unauthorized role reject scheduler entry without partial lifecycle changes',async()=>{
  const pair=await f.addPair();await f.db.query("update public.needs set response_deadline=statement_timestamp()-interval '1 minute' where id=$1",[pair.need]);await f.installLifecycleGuards();
  const client=await connectFixtureClient();clients.push(client);await client.query('begin');try{await assert.rejects(f.call(25,client),e=>e.code==='2D000');}finally{await client.query('rollback');}
  assert.equal(await f.value('select status as value from public.needs where id=$1',[pair.need]),'PUBLISHED');
  for(const role of ['anon','authenticated','service_role'])assert.equal(await f.value("select has_function_privilege($1,'private.marketplace_cooperative_candidate(integer,timestamptz)','EXECUTE') as value",[role]),false);
  await assert.rejects(f.db.exec(source),/R13_MARKETPLACE_COOPERATIVE_SOURCE_ONLY/);assert.equal((await f.probes()).length,0);
  return {outerTransactionSqlstate:'2D000',uncommittedExpiryRolledBack:true,deniedRoles:['anon','authenticated','service_role'],sourceOnlySentinel:true};
 });
 evidence.completedAt=new Date().toISOString();evidence.result='PASS';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log('Evidence: '+output);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const c of clients)try{await c.end();}catch{}await stopFixture();});

