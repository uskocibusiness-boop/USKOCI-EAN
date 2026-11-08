'use strict';
// Captured real profile-requeue/queue/world functions on the existing bounded
// R09/R13 schema. Synthetic rows and probe triggers are local test inputs only.
// No hosted database, network wake, push provider or application writer is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=require('./r09-worker-activation-fixture.cjs');
const source=fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'),'utf8');
const executable=source.slice(source.indexOf('-- R13_ISOLATED_TEST_PROCEDURE_START'));
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r13_profile_sweep_20261108.preimage.json'),'utf8'));
const ZERO='00000000-0000-0000-0000-000000000000';
const id=(prefix,n)=>`${prefix}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const iso=x=>new Date(x).toISOString();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');

async function fixture(options={}){
 const f=await base.fixture(options);
 let workerSerial=0,needSerial=0;
 try{
  // The unchanged baseline and dependencies must match the fresh read-only
  // hosted capture before this test can compare the extracted step to them.
  for(const name of ['requeue_changed_worker_profiles_v1','requeue_open_needs_for_worker_v5','enqueue_dispatch','accounts_same_world']){
   const expected=preimage.functions.find(x=>x.proname===name);
   assert.ok(expected,name+' current preimage is required');
   const observed=await f.value('select md5(prosrc) as value from pg_proc where oid=$1::regprocedure',[expected.signature]);
   assert.equal(observed,expected.body_md5,'captured baseline body drift: '+expected.signature);
  }
  await f.db.exec(`create table private.r13_profile_probe(
   event text not null, account_id uuid, changed_at timestamptz, need_id uuid,
   transaction_id xid8 not null, backend_pid integer not null);
   create function private.r13_profile_probe_cursor() returns trigger language plpgsql as $$
   begin
    if new.key='match_v1_profile_requeue' then
     insert into private.r13_profile_probe values(
      case when new.value->>'afterAccount'<>'${ZERO}' and
       (new.value->>'after',new.value->>'afterAccount') is distinct from
       (old.value->>'after',old.value->>'afterAccount') then 'PROFILE' else 'IDLE' end,
      (new.value->>'afterAccount')::uuid,(new.value->>'after')::timestamptz,null,
      pg_current_xact_id(),pg_backend_pid());
    end if;return new;
   end$$;
   create trigger r13_profile_probe_cursor after update on private.marketplace_config
    for each row execute function private.r13_profile_probe_cursor();
   create function private.r13_profile_probe_queue() returns trigger language plpgsql as $$
   begin insert into private.r13_profile_probe values('QUEUE',null,null,new.need_id,
    pg_current_xact_id(),pg_backend_pid());return new;end$$;
   create trigger r13_profile_probe_queue after insert or update on private.dispatch_schedule
    for each row execute function private.r13_profile_probe_queue();`);
  f.at=iso(await f.value("select statement_timestamp()-interval '2 minutes' as value"));
  f.time=seconds=>iso(Date.parse(f.at)+seconds*1000);
  f.watermark=async(at=f.time(-120),account=ZERO)=>{
   await f.db.query("update private.marketplace_config set value=$1 where key='match_v1_profile_requeue'",
    [{after:at,afterAccount:account,preserveUnrelatedKey:'still-here'}]);
  };
  f.clearAudit=()=>f.db.exec('truncate private.r13_profile_probe');
  f.clearQueue=()=>f.db.exec('truncate private.dispatch_schedule');
  f.reset=async()=>{
   await f.db.exec("update public.needs set status='DRAFT';update public.app_profiles set profile_status='DRAFT' where kind='WORKER';truncate private.dispatch_schedule,private.r13_profile_probe;");
   await f.db.query("update private.marketplace_config set value=jsonb_set(jsonb_set(value,'{mode}','\"ALL\"'),'{tickBudgetSeconds}','40') where key='match_v1_dispatch'");
   f.at=iso(await f.value("select statement_timestamp()-interval '2 minutes' as value"));
   await f.watermark();await f.clearAudit();
  };
  f.addProfile=async(opts={})=>{
   const n=++workerSerial,account=base.workerId(n),profile=base.profileId(n);
   await f.db.query('insert into public.app_accounts(id,full_name) values($1,$2)',[account,'Synthetic profile sweep '+n]);
   await f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,operating_country_code,updated_at)
    values($1,$2,$3,$4,'Novi Sad',$5,'{}','RS',$6)`,
    [profile,account,opts.kind||'WORKER','Synthetic profile sweep '+n,opts.status||'ACTIVE',opts.changedAt||f.time(-60)]);
   await f.db.query("insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values($1,$2,'Isolated profile-sweep proof','R13 profile transaction fixture')",
    [account,opts.world==='OTHER'?'REAL_USER':'SYNTHETIC_ACCEPTANCE_FIXTURE']);
   return {n,account,profile};
  };
  f.requesterProfile=async worker=>{
   const profile=id('d0000000',worker.n);
   await f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,operating_country_code)
    values($1,$2,'REQUESTER','Synthetic requester boundary','Novi Sad','ACTIVE','{}','RS')`,[profile,worker.account]);
   return profile;
  };
  f.addTask=async(opts={})=>{
   const n=++needSerial;
   const need=await f.addNeed(n,{publishedAt:f.time(-600)});
   const allowed=new Set(['status','published_at','remaining_search_closed_at','response_deadline','requester_account_id','requester_profile_id']);
   const entries=Object.entries(opts);for(const [key]of entries)assert.ok(allowed.has(key),'bounded synthetic task patch');
   if(entries.length)await f.db.query('update public.needs set '+entries.map(([key],i)=>key+'=$'+(i+2)).join(',')+' where id=$1',[need,...entries.map(([,value])=>value)]);
   return need;
  };
  f.seedQueue=async(need,{updatedAt=f.time(-120),nextRunAt=f.time(300),status='SENT',attempts=0}={})=>{
   await f.db.query(`insert into private.dispatch_schedule(need_id,next_run_at,updated_at,last_status,attempts)
    values($1,$2,$3,$4,$5) on conflict(need_id) do update set next_run_at=excluded.next_run_at,
    updated_at=excluded.updated_at,last_status=excluded.last_status,attempts=excluded.attempts`,[need,nextRunAt,updatedAt,status,attempts]);
  };
  f.step=async(at=f.at)=>f.value('select private.requeue_changed_worker_profile_candidate($1) as value',[at]);
  // p_at is intentionally earlier than the actual queue-enqueue statement.
  // That isolates non-idle profile work without dispatching these test Needs.
  f.tick=(client=f.db,at=f.at)=>client.query('call private.dispatch_cooperative_candidate(25,$1)',[at]);
  f.cursor=()=>f.value("select value as value from private.marketplace_config where key='match_v1_profile_requeue'");
  f.events=async(event)=> (await f.db.query('select event,account_id,changed_at,need_id,transaction_id::text as txid,backend_pid as pid from private.r13_profile_probe where $1::text is null or event=$1 order by transaction_id,account_id,need_id',[event??null])).rows;
  f.queueIds=async()=> (await f.db.query('select need_id from private.dispatch_schedule order by need_id')).rows.map(x=>x.need_id);
  await f.reset();
  return f;
 }catch(e){await f.db.close();throw e;}
}

const cases=[
 ['source guard, role and ACL keep the extracted profile step internal',async f=>{
  const before=await f.cursor();await assert.rejects(f.db.exec(source),/R13_COOPERATIVE_DISPATCH_SOURCE_ONLY/);assert.deepEqual(await f.cursor(),before);
  const acl={};for(const role of ['anon','authenticated','service_role']){
   acl[role]=await f.value("select has_function_privilege($1,'private.requeue_changed_worker_profile_candidate(timestamptz)','EXECUTE') as value",[role]);assert.equal(acl[role],false);
  }
  await f.db.exec('grant usage on schema private to authenticated;grant execute on function private.requeue_changed_worker_profile_candidate(timestamptz) to authenticated;set role authenticated');
  try{await assert.rejects(f.step(),e=>e.code==='42501'&&/R13_SCHEDULER_ROLE_REQUIRED/.test(e.message));}
  finally{await f.db.exec('reset role;revoke execute on function private.requeue_changed_worker_profile_candidate(timestamptz) from authenticated;revoke usage on schema private from authenticated');}
  assert.deepEqual(await f.cursor(),before);return {acl,explicitWrongRoleRejected:true,hostedChanges:false};
 }],
 ['101 profiles sharing one timestamp: 100 independent commits then the remaining profile without skips',async f=>{
  const profiles=[];for(let i=0;i<101;i++)profiles.push(await f.addProfile());await f.clearAudit();
  await f.tick();const first=await f.events('PROFILE');assert.equal(first.length,100);assert.equal(new Set(first.map(x=>x.txid)).size,100);
  assert.deepEqual(first.map(x=>x.account_id),profiles.slice(0,100).map(x=>x.account));
  let cursor=await f.cursor();assert.equal(cursor.afterAccount,profiles[99].account);assert.equal(iso(cursor.after),f.time(-60));assert.equal(cursor.preserveUnrelatedKey,'still-here');
  await f.tick();const all=await f.events('PROFILE');assert.equal(all.length,101);assert.equal(new Set(all.map(x=>x.account_id)).size,101);assert.equal(new Set(all.map(x=>x.txid)).size,101);
  cursor=await f.cursor();assert.equal(iso(cursor.after),f.time(-30));assert.equal(cursor.afterAccount,ZERO);
  await f.tick();assert.equal((await f.events('PROFILE')).length,101);
  return {profiles:101,firstInvocation:100,secondInvocation:1,profileTransactions:101,duplicateProfiles:0,unrelatedConfigPreserved:true};
 }],
 ['30-second cutoff includes its exact boundary once and excludes recent or inactive/non-worker profiles',async f=>{
  const older=await f.addProfile({changedAt:f.time(-31)}),edge=await f.addProfile({changedAt:f.time(-30)}),recent=await f.addProfile({changedAt:f.time(-29)});
  await f.addProfile({changedAt:f.time(-60),status:'DRAFT'});await f.addProfile({changedAt:f.time(-60),kind:'REQUESTER'});await f.clearAudit();
  await f.tick();let processed=await f.events('PROFILE');assert.deepEqual(processed.map(x=>x.account_id),[older.account,edge.account]);
  const after=await f.cursor();assert.equal(iso(after.after),f.time(-30));assert.equal(after.afterAccount,edge.account);
  await f.tick();assert.equal((await f.events('PROFILE')).length,2,'same cutoff must not reset the account tie and replay it');
  await f.tick(f.db,f.time(1));processed=await f.events('PROFILE');assert.deepEqual(processed.map(x=>x.account_id),[older.account,edge.account,recent.account]);
  const held=await f.cursor();await f.tick(f.db,f.time(-60));assert.deepEqual(await f.cursor(),held,'older caller must not move a newer watermark backwards');
  return {initialEligible:2,ignoredRecentUntilNextCutoff:true,exactCutoffReplays:0,inactiveAndRequesterSkipped:true,olderCallerCannotRewind:true};
 }],
 ['one profile queues only 200 newest eligible Needs in the same transaction as its cursor',async f=>{
  const worker=await f.addProfile(),tasks=[];for(let i=0;i<201;i++)tasks.push(await f.addTask());await f.clearQueue();await f.clearAudit();
  const step=await f.step();assert.deepEqual(step,{status:'DONE',profiles:1,queued:200,more:true});
  const expected=tasks.slice(1).sort();assert.deepEqual(await f.queueIds(),expected);
  const events=await f.events();assert.equal(events.filter(x=>x.event==='QUEUE').length,200);assert.equal(events.filter(x=>x.event==='PROFILE').length,1);assert.equal(new Set(events.map(x=>x.txid)).size,1);
  assert.equal((await f.cursor()).afterAccount,worker.account);return {eligibleNeeds:201,queued:200,perProfileTransactionCount:1,cursorAndAllQueueWritesAtomic:true};
 }],
 ['existing world, ownership, expiry, closure, status and already-reconsidered filters match the unchanged owner',async f=>{
  const worker=await f.addProfile(),ownRequester=await f.requesterProfile(worker);
  const other=await f.addProfile({world:'OTHER',status:'DRAFT'}),otherRequester=await f.requesterProfile(other);
  const allowed=await f.addTask(),selection=await f.addTask({status:'SELECTION'});
  const excluded={
   own:await f.addTask({requester_account_id:worker.account,requester_profile_id:ownRequester}),
   otherWorld:await f.addTask({requester_account_id:other.account,requester_profile_id:otherRequester}),
   expired:await f.addTask({response_deadline:f.time(-1)}),closed:await f.addTask({remaining_search_closed_at:f.time(-1)}),
   draft:await f.addTask({status:'DRAFT'}),unpublished:await f.addTask({published_at:null}),recentQueue:await f.addTask()
  };
  await f.clearQueue();await f.seedQueue(excluded.recentQueue,{updatedAt:f.time(-59)});await f.clearAudit();
  const baseline=await f.value('select private.requeue_changed_worker_profiles_v1($1) as value',[f.at]);
  const baselineIds=await f.queueIds();assert.equal(baseline.profiles,1);assert.equal(baseline.queued,2);
  await f.clearQueue();await f.seedQueue(excluded.recentQueue,{updatedAt:f.time(-59)});await f.watermark();await f.clearAudit();
  const result=await f.step();assert.equal(result.queued,2);assert.deepEqual(await f.queueIds(),baselineIds);
  const enqueued=(await f.events('QUEUE')).map(x=>x.need_id).sort();assert.deepEqual(enqueued,[allowed,selection].sort());
  return {baselineOwnerBodyMd5:'9104edac66d52ba630b91fac58c7fcbc',queued:2,excluded:Object.keys(excluded),sameResultAsCurrentOwner:true};
 }],
 ['LADDER preserves a running wave; ALL requeues it without changing its status, attempts or earlier run time',async f=>{
  await f.addProfile();const waiting=await f.addTask(),earlier=await f.addTask();await f.clearQueue();
  await f.seedQueue(waiting,{nextRunAt:f.time(300),status:'SENT',attempts:3});await f.seedQueue(earlier,{nextRunAt:f.time(-90),status:'STOPPED',attempts:2});
  await f.db.exec("update private.marketplace_config set value=jsonb_set(value,'{mode}','\"LADDER\"') where key='match_v1_dispatch'");await f.clearAudit();
  const ladder=await f.step();assert.equal(ladder.queued,1);assert.deepEqual((await f.events('QUEUE')).map(x=>x.need_id),[earlier]);
  const earliest=await f.value('select next_run_at as value from private.dispatch_schedule where need_id=$1',[earlier]);assert.equal(iso(earliest),f.time(-90));
  await f.watermark();await f.seedQueue(earlier,{nextRunAt:f.time(-90),status:'STOPPED',attempts:2});
  await f.db.exec("update private.marketplace_config set value=jsonb_set(value,'{mode}','\"ALL\"') where key='match_v1_dispatch'");await f.clearAudit();
  const all=await f.step();assert.equal(all.queued,2);
  const row=await f.value('select to_jsonb(s) as value from private.dispatch_schedule s where need_id=$1',[waiting]);assert.equal(row.last_status,'SENT');assert.equal(row.attempts,3);
  assert.equal(iso(await f.value('select next_run_at as value from private.dispatch_schedule where need_id=$1',[earlier])),f.time(-90));
  return {ladderQueued:1,allQueued:2,waitingWavePreservedInLadder:true,existingAttemptStatusAndEarlierTimePreserved:true};
 }],
 ['a mid-profile enqueue error rolls back its earlier writes and cursor; a later retry completes once',async f=>{
  const worker=await f.addProfile(),tasks=[];for(let i=0;i<6;i++)tasks.push(await f.addTask());await f.clearQueue();await f.clearAudit();const before=await f.cursor();
  await f.db.exec(`create function private.r13_profile_inject_error() returns trigger language plpgsql as $$begin
   if new.need_id='${tasks[3]}'::uuid then raise exception 'R13_TEST_ENQUEUE_FAILURE';end if;return new;end$$;
   create trigger r13_profile_inject_error before insert on private.dispatch_schedule for each row execute function private.r13_profile_inject_error();`);
  try{await f.tick();assert.deepEqual(await f.queueIds(),[]);assert.deepEqual(await f.cursor(),before);assert.deepEqual(await f.events(),[]);}
  finally{await f.db.exec('drop trigger r13_profile_inject_error on private.dispatch_schedule;drop function private.r13_profile_inject_error();');}
  await f.tick();assert.deepEqual(await f.queueIds(),tasks.sort());const profiles=await f.events('PROFILE');assert.equal(profiles.length,1);assert.equal(profiles[0].account_id,worker.account);
  const writes=await f.events('QUEUE');assert.equal(writes.length,6);assert.ok(writes.every(x=>x.txid===profiles[0].txid));
  return {rolledBackPartialQueueAndCursor:true,retryQueued:6,processedProfiles:1,duplicateQueueWrites:0};
 }],
 ['invalid time/watermark and missing configuration do not move the cursor or enqueue work',async f=>{
  await f.addProfile();await f.addTask();await f.clearQueue();const before=await f.cursor();await f.clearAudit();
  for(const at of [null,'infinity','-infinity'])assert.equal((await f.step(at)).reason,'INVALID_TIME');assert.deepEqual(await f.cursor(),before);
  await f.db.exec("update private.marketplace_config set value='{}' where key='match_v1_profile_requeue'");await f.clearAudit();assert.equal((await f.step()).reason,'WATERMARK_INVALID');assert.deepEqual(await f.events(),[]);
  await f.db.exec("delete from private.marketplace_config where key='match_v1_profile_requeue'");assert.equal((await f.step()).reason,'NOT_CONFIGURED_OR_BUSY');assert.deepEqual(await f.queueIds(),[]);
  await f.db.query('insert into private.marketplace_config(key,value) values($1,$2)',['match_v1_profile_requeue',before]);return {invalidInputsRejected:5,queued:0,cursorNotAdvanced:true};
 }]
];
module.exports={fixture,cases,source,executable,preimage,ZERO,sha,iso};
