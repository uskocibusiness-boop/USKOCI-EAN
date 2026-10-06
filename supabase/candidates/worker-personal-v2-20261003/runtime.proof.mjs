// Runs ONLY on the established loopback disposable chain. No DEV/provider/push.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import * as rt from '../../proofs/pre_v3/closure_runtime.mjs';
const { assert, sql, rows, q, randomUUID, ok, denied, env } = rt;
const dir='supabase/candidates/worker-personal-v2-20261003/';
const out=env.WPP02_ARTIFACT_DIR; assert.ok(out); mkdirSync(out,{recursive:true});
const m=JSON.parse(readFileSync(dir+'sql-manifest.json','utf8'));
const candidate=readFileSync(dir+'candidate.sql','utf8');
const report={unit:'WPP02-A',result:'RUNNING',sourceSha:env.GITHUB_SHA,
 actualAuth:true,actualPostgrest:true,actualDatabase:true,disposableOnly:true,
 fullAiReview:false,fullExport:false,certificateAdmitted:false,
 liveAccess:false,providerCalls:0,pushSends:0,checks:[]};
const write=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({name,result:'PASS'});write();console.log('PASS WPP02_'+name);};
const closure=()=>rows("select private.closure_source_digest_v5() as source,private.closure_erasure_program_digest_v5() as program,(select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,private.retention_ai_source_ready() as ready")[0];
const pid=(a,k='WORKER')=>rows("select id from public.app_profiles where account_id="+q(a.id)+" and kind="+q(k))[0].id;
const doc=p=>rows("select private.worker_work_preferences_document_v2("+q(p)+"::uuid) as d")[0].d;
const wanted=d=>{const {exists,updatedAt,...v}=d;return v;};
const readonlyPins=()=>rows("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,md5(p.prosrc) as body,to_jsonb(p)-'prosrc' as meta from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.oid");
// Mirrors the observed closure-exclusive -> profile-row order without erasing
// any account. Proves this specific lock graph only, not full erasure execution.
async function closureFirstOverlap(account,profile,request){
 const child=spawn('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
 let output='',failure='',pending;
 child.stdout.on('data',x=>{output+=x;});child.stderr.on('data',x=>{failure+=x;});
 const waitToken=async token=>{for(let i=0;i<400;i++){
  if(output.includes(token))return;
  if(child.exitCode!==null)throw new Error('CLOSURE_LOCK_HOLDER_EXIT:'+failure.slice(-500));
  await new Promise(r=>setTimeout(r,25));
 }throw new Error('CLOSURE_LOCK_TOKEN_TIMEOUT:'+token);};
 try{
  child.stdin.write("begin;select pg_advisory_xact_lock(private.closure_account_key("+q(account)+"::uuid));select 'HOLDER_READY:'||pg_backend_pid();\n");
  await waitToken('HOLDER_READY:');const holder=Number(/HOLDER_READY:(\d+)/.exec(output)[1]);
  pending=Promise.resolve().then(request);let observed;
  for(let i=0;i<100;i++){
   observed=rows("select a.pid,a.wait_event_type,a.wait_event,exists(select 1 from pg_locks l where l.pid=a.pid and l.relation='public.app_profiles'::regclass and l.granted and l.mode='RowShareLock') as profile_lock from pg_stat_activity a where "+holder+"=any(pg_blocking_pids(a.pid))")[0];
   if(observed)break;await new Promise(r=>setTimeout(r,25));
  }
  assert.ok(observed,'MISSING_CLOSURE_ADVISORY_WAIT');
  assert.equal(observed.wait_event,'advisory');assert.equal(observed.profile_lock,false);
  child.stdin.write("select 1 from public.app_profiles where id="+q(profile)+" for update;select 'PROFILE_LOCKED';\n");
  await waitToken('PROFILE_LOCKED');child.stdin.end('commit;\n');
  return await pending;
 }finally{
  if(!child.stdin.destroyed)child.stdin.end('rollback;\n');child.kill();
  if(pending)await pending.catch(()=>{});
 }
}
let wrappers=false;
try {
 // Exactly the current WPP01 functions, with no replay-wide DEV equivalence claim.
 sql(readFileSync('supabase/candidates/worker-personal-profile-20261003/candidate.sql','utf8'));
 const requester=await rt.actor('wpp02-requester'),worker=await rt.actor('wpp02-worker');
 const other=await rt.actor('wpp02-other'),fresh=await rt.actor('wpp02-fresh');
 const wp=pid(worker),otherPid=pid(other),freshPid=pid(fresh),rp=pid(requester,'REQUESTER');
 sql("update public.app_profiles set city='Novi Sad',skills=array['Ciscenje','Dostava','Selidbe'],tools='{}',vehicles='{}' where id="+q(wp));
 await ok(worker.client.rpc('rpc_complete_worker_profile',{p_profile_id:wp}));
 let av=rows("select private.worker_availability_document("+q(wp)+"::uuid) d")[0].d;
 const {profileId,accountId,revision,...available}=av;
 available.availableNow=true;
 available.rules=[{id:randomUUID(),weekdays:[0,1,2,3,4,5,6],startTime:'00:00',endTime:'24:00',
  startsOn:'2026-01-01',endsOn:null,label:'WPP02 disposable',active:true}];
 await ok(worker.client.rpc('rpc_save_worker_availability',{p_expected_revision:revision,p_value:available}));
 const makeNeed=(label,category,skills,{urgent=false,schedule='FLEXIBLE',start='null',end='null'}={})=>{
  const id=randomUUID();
  sql("begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,mode,required_slots,schedule_kind,starts_at,ends_at,required_skills,urgent,response_deadline,published_at) values("+
   [q(id),q(requester.id),q(rp),"'PUBLISHED'",q('WPP02 '+label),"'Disposable fixture'",q(category),"'Novi Sad'","'OFFERS'",1,q(schedule),start,end,q('{'+skills.join(',')+'}')+'::text[]',urgent,"statement_timestamp()+interval '3 days'","statement_timestamp()"].join(',')+");commit;");
  return id;
 };
 const clean=makeNeed('clean','Ciscenje',['Ciscenje']);
 const mixed=makeNeed('mixed','Ciscenje',['Ciscenje','Dostava']);
 const unknown=makeNeed('unknown','UnclassifiedWpp02',[]);
 const moving=makeNeed('carrying','Selidbe',['Selidbe']);
 const today=makeNeed('today urgent','Ciscenje',['Ciscenje'],{urgent:true,schedule:'TODAY_FLEXIBLE'});
 const future=makeNeed('future urgent','Ciscenje',['Ciscenje'],{urgent:true,schedule:'TOMORROW_FLEXIBLE'});
 const exact=makeNeed('exact future urgent','Ciscenje',['Ciscenje'],{urgent:true,schedule:'FIXED_WINDOW',
  start:"statement_timestamp()+interval '2 days'",end:"statement_timestamp()+interval '2 days 1 hour'"});
 const match=id=>rows("select private.match_detail_without_calendar("+q(id)+"::uuid,"+q(wp)+"::uuid) detail,private.dispatch_cheap_candidate_admitted("+q(id)+"::uuid,"+q(wp)+"::uuid) cheap")[0];
 const baseline=readonlyPins(),cert=closure(); assert.equal(cert.ready,true);
 assert.throws(()=>sql(candidate.replace(m.functions[2].before_md5,'0'.repeat(32))),/WPP02_PREIMAGE_DRIFT/);
 assert.deepEqual(readonlyPins(),baseline);assert.deepEqual(closure(),cert);
 assert.equal(sql("select count(*) from pg_attribute where attrelid='public.worker_match_preferences'::regclass and attname='work_notes'"),'0');
 pass('DRIFT_REFUSAL_ROLLS_BACK_SCHEMA_AND_BODIES');

 sql(candidate);
 for(const f of m.functions){
  const [name,args]=f.signature.split('(');
  assert.equal(sql("select md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname="+q(name)+" and pg_get_function_identity_arguments(p.oid)="+q(args.slice(0,-1))),f.after_md5);
 }
 const next=closure();assert.equal(next.ready,false);
 assert.equal(next.certificate,cert.certificate);assert.equal(next.erasure,cert.erasure);
 assert.notEqual(next.source,cert.source);assert.notEqual(next.program,cert.program);
 report.unadmittedClosure={source:next.source,program:next.program};
 pass('EXPECTED_CLOSURE_DRIFT_NO_CERTIFICATE_REBIND');
 // Test-only RPC exercises the private primitive with actual Auth/PostgREST.
 // This wrapper is NOT present in the candidate or any runtime source.
 sql("create function public.wpp02_proof_replace(p_pid uuid,p_expected jsonb,p_wanted jsonb) returns jsonb language sql security definer set search_path=pg_catalog as $f$ select private.worker_work_preferences_replace_v2(auth.uid(),p_pid,p_expected,p_wanted) $f$; revoke all on function public.wpp02_proof_replace(uuid,jsonb,jsonb) from public,anon,service_role; grant execute on function public.wpp02_proof_replace(uuid,jsonb,jsonb) to authenticated; notify pgrst,'reload schema';");
 wrappers=true;await new Promise(r=>setTimeout(r,1000));
 const call=(a,p,expected,value)=>a.client.rpc('wpp02_proof_replace',{p_pid:p,p_expected:expected,p_wanted:value});
 const save=async patch=>{const d=doc(wp);return await ok(call(worker,wp,d,{...wanted(d),...patch}));};
 assert.equal(sql("select has_function_privilege('authenticated','private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb)','EXECUTE')"),'f');
 assert.equal(sql("select has_function_privilege('service_role','private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb)','EXECUTE')"),'f');
 let d=doc(wp);
 const ownerError=await denied(call(other,wp,d,wanted(d)),'WORKER_PROFILE_NOT_OWNED');assert.equal(ownerError.code,'42501');
 for(const value of [{...wanted(d),desiredWorkKinds:['UNKNOWN']},{...wanted(d),workNotes:[' ']},
  {...wanted(d),urgentTasksEnabled:'false'},{...wanted(d),workNotes:['same','same']},
  {...wanted(d),workNotes:['x'.repeat(501)]},{...wanted(d),unowned:true}]){
  const invalid=await denied(call(worker,wp,d,value),'WORKER_V2_INVALID');assert.equal(invalid.code,'22023');
 }
 assert.deepEqual(doc(wp),d);
 pass('ACTUAL_AUTH_OWNER_AND_STRICT_INPUT_BOUNDARIES');
 sql("update public.app_profiles set profile_status='SUSPENDED' where id="+q(wp));
 const restricted=await denied(call(worker,wp,d,{...wanted(d),workNotes:['Must not save']}),'WORKER_PROFILE_RESTRICTED');
 assert.equal(restricted.code,'55000');assert.deepEqual(doc(wp),d);
 sql("update public.app_profiles set profile_status='ACTIVE' where id="+q(wp));
 pass('RESTRICTED_PROFILE_CANNOT_WRITE_PREFERENCES');
 const direct=await denied(worker.client.from('worker_match_preferences').update({work_notes:['Direct attempt']}).eq('worker_profile_id',wp),'WORKER_PREFERENCES_REQUIRE_REVIEW');
 assert.equal(direct.code,'42501');
 const pro=await denied(worker.client.from('worker_match_preferences').update({proactive_notifications:false}).eq('worker_profile_id',wp),'WORKER_PREFERENCES_REQUIRE_REVIEW');assert.equal(pro.code,'42501');
 assert.equal(sql("select count(*) from public.worker_match_preferences where worker_profile_id="+q(freshPid)),'0');
 const ins=await denied(fresh.client.from('worker_match_preferences').insert({worker_profile_id:freshPid,worker_account_id:fresh.id,desired_work_kinds:['CISCENJE']}),'WORKER_PREFERENCES_REQUIRE_REVIEW');assert.equal(ins.code,'42501');
 pass('DIRECT_AUTHENTICATED_INSERT_AND_UPDATE_REFUSED');

 const stable=doc(wp);assert.deepEqual(await save({}),stable);
 const notes=['Mogu da nosim, ne mogu da prevozim.','Не носим клавире.'];
 await save({workNotes:notes});assert.deepEqual(doc(wp).workNotes,notes);
 assert.equal(match(moving).detail.responseAllowed,true);
 assert.equal(match(moving).cheap,true);
 const stale=await denied(call(worker,wp,stable,{...wanted(stable),proactiveNotifications:false}),'WORKER_AI_STALE');assert.equal(stale.code,'PT409');
 pass('DESCRIPTIVE_NOTES_NO_FALSE_FILTER_NOOP_AND_STALE_PROTECTION');
 assert.deepEqual(await ok(other.client.from('worker_match_preferences').select('work_notes').eq('worker_profile_id',wp)),[]);
 assert.deepEqual((await ok(worker.client.from('worker_match_preferences').select('work_notes').eq('worker_profile_id',wp)))[0].work_notes,notes);
 pass('EXISTING_RLS_KEEPS_OWNED_DESCRIPTIVE_NOTES_PRIVATE');
 const assertDispatch=(id,allowed,code)=>{
  const r=match(id);assert.equal(r.detail.responseAllowed,true);
  assert.equal(r.detail.dispatchEligible,allowed,JSON.stringify(r.detail));assert.equal(r.cheap,allowed);
  if(code)assert.ok(r.detail.dispatchBlockers.includes(code));
 };
 await save({desiredWorkKinds:['CISCENJE'],declinedWorkKinds:['DOSTAVA']});
 assertDispatch(clean,true);assertDispatch(mixed,false,'DECLINED_WORK_KIND');
 assertDispatch(unknown,false,'OUTSIDE_DESIRED_WORK_KINDS');
 await save({desiredWorkKinds:['CISCENJE'],declinedWorkKinds:['CISCENJE']});
 assertDispatch(clean,false,'DECLINED_WORK_KIND');
 await save({desiredWorkKinds:[],declinedWorkKinds:[],proactiveNotifications:false});
 assertDispatch(clean,false,'PROACTIVE_NOTIFICATIONS_PAUSED');
 await save({proactiveNotifications:true});assertDispatch(clean,true);
 pass('DETAILED_CHEAP_DESIRED_DECLINED_PROACTIVE_PARITY_MANUAL_UNCHANGED');

 // Legacy setting remains an existing privileged fixture, not a new public setter.
 for(const legacy of [false,true]){
  sql("begin;select set_config('request.jwt.claims',"+q(JSON.stringify({sub:worker.id,role:'authenticated'}))+",true);update public.worker_match_preferences set same_day_urgent_notifications="+legacy+" where worker_profile_id="+q(wp)+";commit;");
  for(const urgent of [null,false,true]){
   await save({urgentTasksEnabled:urgent});
   assertDispatch(clean,true);
   assertDispatch(today,urgent===true||(urgent===null&&legacy),urgent===false?'URGENT_TASKS_PAUSED':urgent===null&&!legacy?'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED':null);
   for(const id of [future,exact])assertDispatch(id,urgent!==false,urgent===false?'URGENT_TASKS_PAUSED':null);
  }
 }
 // Helper boundary proves exact-today and nonurgent cases without future task
 // publication validation masking the predicate; all combinations use live SQL.
 const table=rows("select u as urgent,legacy,same_day,case when opt=0 then null when opt=1 then false else true end opt,private.worker_work_dispatch_blockers_v2(jsonb_populate_record(null::public.needs,jsonb_build_object('category','Ciscenje','required_skills',jsonb_build_array('Ciscenje'),'urgent',u,'schedule_kind','FIXED_WINDOW','starts_at',case when same_day then statement_timestamp() else statement_timestamp()+interval '2 days' end)),jsonb_populate_record(null::public.worker_match_preferences,jsonb_build_object('proactive_notifications',true,'timezone','UTC','same_day_urgent_notifications',legacy,'urgent_tasks_enabled',case when opt=0 then null when opt=1 then false else true end)),statement_timestamp()) blockers from (values(false),(true)) a(u) cross join (values(false),(true)) b(legacy) cross join (values(false),(true)) c(same_day) cross join generate_series(0,2) opt");
 assert.equal(table.length,24);
 for(const r of table){
  const expected=!r.urgent?[]:r.opt===false?['URGENT_TASKS_PAUSED']:r.opt===null&&r.same_day&&!r.legacy?['SAME_DAY_URGENT_NOTIFICATIONS_PAUSED']:[];
  assert.deepEqual(r.blockers,expected);
 }
 pass('HITNO_NULL_TRUE_FALSE_TODAY_FUTURE_EXACT_PARITY');
 await save({urgentTasksEnabled:null});
 av=rows("select private.worker_availability_document("+q(wp)+"::uuid) d")[0].d;
 const {profileId:ap,accountId:aa,revision:ar,...changedAvailability}=av;
 changedAvailability.rules=changedAvailability.rules.map((rule,i)=>i===0?{...rule,label:'Changed legacy schedule'}:rule);
 await ok(worker.client.rpc('rpc_save_worker_availability',{p_expected_revision:ar,p_value:changedAvailability}));
 assert.deepEqual(doc(wp).workNotes,notes);
 const loc=rows("select private.worker_location_document("+q(wp)+"::uuid) d")[0].d;
 const {profileId:lp,accountId:la,revision:lr,...changedLocation}=loc;
 changedLocation.radiusKm=changedLocation.radiusKm===25?26:25;
 await ok(worker.client.rpc('rpc_save_worker_location',{p_expected_revision:lr,p_value:changedLocation,p_confirmed:true}));
 assert.deepEqual(doc(wp).workNotes,notes);
 pass('EXISTING_LOCATION_AVAILABILITY_WRITERS_PRESERVE_V2_NOTES');

 // Real SQL lock wait against the existing availability RPC; no sleep-only race.
 await ok(rt.lockedRace("select 1 from public.app_profiles where id="+q(wp)+" for update",()=>worker.client.rpc('rpc_save_worker_availability',{
  p_expected_revision:rows("select private.worker_availability_document("+q(wp)+"::uuid) d")[0].d.revision,
  p_value:changedAvailability
 })));
 const beforeRace=doc(wp);
 // A separate profile transaction changes the preferences; the awaiting new
 // primitive must re-read under its lock and reject the frozen old document.
 const pendingWanted={...wanted(beforeRace),proactiveNotifications:false};
 const raceError=await rt.lockedRace(
  "select 1 from public.app_profiles where id="+q(wp)+" for update;select set_config('request.jwt.claims',"+q(JSON.stringify({sub:worker.id,role:'authenticated'}))+",true);select private.worker_work_preferences_replace_v2("+q(worker.id)+"::uuid,"+q(wp)+"::uuid,"+q(JSON.stringify(beforeRace))+"::jsonb,"+q(JSON.stringify({...wanted(beforeRace),desiredWorkKinds:['CISCENJE']}))+"::jsonb)",
  ()=>call(worker,wp,beforeRace,pendingWanted));
 assert.equal(raceError.error?.code,'PT409');assert.equal(raceError.error?.message,'WORKER_AI_STALE');
 assert.equal(doc(wp).proactiveNotifications,true);
 pass('ACTUAL_PROFILE_LOCK_WAIT_STALE_WRITE_REFUSED');

 // First preference creation through the existing location RPC racing the new
 // primitive: both use the owned profile lock; first-row staleness is explicit.
 const freshBefore=doc(freshPid);assert.equal(freshBefore.exists,false);
 const first=await rt.lockedRace(
  "select 1 from public.app_profiles where id="+q(freshPid)+" for update;select set_config('request.jwt.claims',"+q(JSON.stringify({sub:fresh.id,role:'authenticated'}))+",true);select set_config('uskoci.profile_mutation','LOCATION_REVIEW',true);insert into public.worker_match_preferences(worker_profile_id,worker_account_id) values("+q(freshPid)+","+q(fresh.id)+")",
  ()=>call(fresh,freshPid,freshBefore,{...wanted(freshBefore),desiredWorkKinds:['CISCENJE']}));
 assert.equal(first.error?.code,'PT409');
 pass('FIRST_PREFERENCE_ROW_CONCURRENT_INSERT_REJECTS_OLD_SNAPSHOT');
 const beforeClosure=doc(wp);
 await ok(closureFirstOverlap(worker.id,wp,()=>call(worker,wp,beforeClosure,{...wanted(beforeClosure),proactiveNotifications:false})));
 assert.equal(doc(wp).proactiveNotifications,false);
 await save({proactiveNotifications:true});
 pass('OBSERVED_CLOSURE_EXCLUSIVE_BEFORE_PROFILE_ROW_NO_INVERSE_LOCK');

 await save({desiredWorkKinds:['CISCENJE'],workNotes:notes});
 const retained=doc(wp);
 const rollback=readFileSync(dir+'compatible-rollback.sql','utf8');
 // Independent security metadata and overload drift must fail with our bounded
 // PT409 preflight, never an ambiguous scalar-subquery/cardinality exception.
 sql('alter function private.worker_work_dispatch_blockers_v2(public.needs,public.worker_match_preferences,timestamptz) security definer');
 assert.throws(()=>sql(rollback),/WPP02_POSTIMAGE_DRIFT/);
 sql('alter function private.worker_work_dispatch_blockers_v2(public.needs,public.worker_match_preferences,timestamptz) security invoker');
 sql('grant execute on function private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb) to authenticated');
 assert.throws(()=>sql(rollback),/WPP02_POSTIMAGE_DRIFT/);
 sql('revoke execute on function private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb) from authenticated');
 sql('create function private.worker_work_dispatch_blockers_v2(uuid) returns boolean language sql as $$select false$$');
 assert.throws(()=>sql(rollback),/WPP02_POSTIMAGE_DRIFT/);
 sql('drop function private.worker_work_dispatch_blockers_v2(uuid)');
 assert.deepEqual(doc(wp),retained);
 pass('ROLLBACK_REJECTS_SECURITY_ACL_AND_OVERLOAD_DRIFT');
 sql(rollback);
 assert.deepEqual(doc(wp),retained);
 assertDispatch(clean,false,'WORKER_PREFERENCES_V2_PAUSED');
 await denied(call(worker,wp,retained,wanted(retained)),'WORKER_PREFERENCES_V2_PAUSED');
 assert.equal(sql("select count(*) from pg_attribute where attrelid='public.worker_match_preferences'::regclass and attname in ('desired_work_kinds','declined_work_kinds','work_notes','urgent_tasks_enabled') and not attisdropped"),'4');
 sql(readFileSync(dir+'resume.sql','utf8'));
 assert.deepEqual(doc(wp),retained);assertDispatch(clean,true);
 pass('COMPATIBLE_ROLLBACK_FAIL_CLOSED_DATA_RETAINED_EXACT_RESUME');
 report.result='PASS';
} catch(e) {
 report.result='FAIL';report.failure=String(e.message).slice(0,1600);
 process.exitCode=1;console.error('FAIL WPP02 '+report.failure);
} finally {
 if(wrappers){try{sql("drop function public.wpp02_proof_replace(uuid,jsonb,jsonb);notify pgrst,'reload schema';");}catch{report.wrapperCleanupFailed=true;report.result='FAIL';process.exitCode=1;}}
 write();
}
