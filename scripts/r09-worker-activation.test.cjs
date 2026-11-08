'use strict';
// Isolated PostgreSQL semantics: current real matcher, wave and event ledger.
// No hosted Auth, HTTP, push transport, Expo, FCM or Android claim.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {fixture,candidate,source,preimage,profileId,workerId,needId,id,REQUESTER}=require('./r09-worker-activation-fixture.cjs');
const native=process.env.USKOCI_R09_NATIVE==='1';
const nativeRuntime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const rollbackSource=fs.readFileSync(path.join(__dirname,'sql/r09_worker_activation_20261108.rollback.sql'),'utf8');
const rollback=rollbackSource.slice(rollbackSource.indexOf('-- R09_ISOLATED_TEST_ROLLBACK_START'));
const gate=(f,n,w)=>f.value('select private.dispatch_cheap_candidate_admitted($1,$2) as value',[needId(n),profileId(w)]);
const match=(f,n,w)=>f.value('select private.worker_need_match_v1($1,$2) as value',[needId(n),profileId(w)]);
const clock=(f,w)=>f.value(`select jsonb_build_object('since',worker_dispatch_eligible_since,'source',worker_dispatch_clock_source) as value from public.app_profiles where id=$1`,[profileId(w)]);
const wave=(f,n)=>f.value('select private.dispatch_next_wave($1) as value',[needId(n)]);
const cols=f=>f.value(`select count(*)::int as value from pg_attribute where attrelid='public.app_profiles'::regclass and attname like 'worker_dispatch_%' and not attisdropped`);

test('R09 activation clock separates current matching from proactive publication admission',async t=>{
 const f=native?await nativeRuntime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
 try{
  await f.addWorker(1);await f.addWorker(2,{status:'DRAFT'});await f.addWorker(3,{push:false});
  await f.addWorker(4,{proactive:false});await f.addWorker(5,{excluded:true});await f.addWorker(6,{world:'OTHER'});
  await f.addWorker(7,{modes:['REMOTE']});await f.addWorker(8,{modes:['ON_SITE']});
  await f.installProfileGuard();
  const aiBefore=new Map();
  for(const w of [1,2]){
   const hash=await f.value('select private.worker_ai_source_hash($1) as value',[workerId(w)]);
   const doc=await f.value('select private.worker_ai_source($1) as value',[workerId(w)]);
   await f.db.query(`insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate,revision)
    values($1,$2,$3,$4,$5,$6,1)`,[id('90000000',w),workerId(w),id('b0000000',w),profileId(w),hash,doc.profile]);
   await f.db.query('update private.worker_ai_reviews set base_hash=$1 where account_id=$2',[hash,workerId(w)]);
   aiBefore.set(w,{hash,doc,
    review:await f.value('select to_jsonb(r) as value from private.worker_ai_reviews r where account_id=$1',[workerId(w)]),
    session:await f.value('select to_jsonb(s) as value from private.worker_ai_sessions s where account_id=$1',[workerId(w)])});
  }
  const avatars=[];
  for(const [account,profile] of [[workerId(1),profileId(1)],[workerId(2),profileId(2)],[REQUESTER,id('20000000',1)]]){
   await f.db.exec("select set_config('request.jwt.claim.role','service_role',false)");
   const request=id('c0000000',avatars.length+1);
   await f.db.query("select public.rpc_claim_media_upload_service($1,'AVATAR',$2,$3,repeat('0',64),10,'image/jpeg')",[account,profile,request]);
   const asset=await f.value('select to_jsonb(a) as value from private.owned_media_assets a where client_request_id=$1',[request]);
   // Synthetic sanitized READY row only; no file bytes, Storage/network or
   // sanitizer outcome is claimed by this compatibility boundary test.
   await f.db.query("update private.owned_media_assets set state='READY',sanitized_sha256=repeat('1',64),storage_path=$2,width=1,height=1,byte_size=10 where id=$1",[asset.id,'synthetic/avatar-'+avatars.length+'.jpg']);
   avatars.push({account,profile,assetId:asset.id,marker:asset.avatar_source_marker,
    previousPath:await f.value('select avatar_path as value from public.app_profiles where id=$1',[profile])});
  }
  await f.db.exec('reset request.jwt.claim.role');
  await f.addNeed(1,{publishedAt:'2026-11-01T00:00:00Z'});
  await f.db.exec('create trigger fixture_need_guard before update on public.needs for each row execute function private.guard_need_write()');
  await t.test('actual preimage reproduces old-task notification admission',async()=>{
   assert.equal(await match(f,1,1),true);assert.equal(await gate(f,1,1),true);
  });
  await t.test('actual old guard reproduces empty/unrelated token publication and revision weakness',async()=>{
   for(const token of ['','CLOSE_REMAINING_SEARCH']){
    await f.db.query("select set_config('uskoci.need_lifecycle',$1,false)",[token]);
    await f.db.query('update public.needs set published_at=clock_timestamp(),revision=2 where id=$1',[needId(1)]);
    await f.db.query("update public.needs set published_at='2026-11-01T00:00:00Z',revision=1 where id=$1",[needId(1)]);
   }
   await f.db.exec('reset uskoci.need_lifecycle');
  });
  await t.test('unapproved full source file aborts without adding a clock',async()=>{
   await assert.rejects(f.db.exec(source),/R09_WORKER_ACTIVATION_SOURCE_ONLY/);assert.equal(await cols(f),0);
  });
  await t.test('owner drift aborts before DDL; transaction rollback restores captured owner',async()=>{
   const original=preimage.functions.find(x=>x.signature==='private.dispatch_cheap_candidate_admitted(uuid,uuid)');
   await f.db.exec(original.definition.replace('select exists (','-- deliberate isolated drift\n  select exists ('));
   await assert.rejects(f.db.exec(candidate),/R09_ACTIVATION_PREIMAGE_DRIFT/);await f.db.exec('rollback');
   assert.equal(await cols(f),0);await f.db.exec(original.definition);
  });
  await t.test('unexpected BEFORE profile trigger aborts before the observation backfill',async()=>{
   await f.db.exec('create trigger zz_unreviewed_profile_trigger before update on public.app_profiles for each row execute function public.set_updated_at()');
   await assert.rejects(f.db.exec(candidate),/R09_PROFILE_TRIGGER_DRIFT/);await f.db.exec('rollback');
   assert.equal(await cols(f),0);await f.db.exec('drop trigger zz_unreviewed_profile_trigger on public.app_profiles');
  });
  await t.test('disabled profile guard is rejected even if its definition is unchanged',async()=>{
   await f.db.exec('alter table public.app_profiles disable trigger guard_profile_write_trg');
   await assert.rejects(f.db.exec(candidate),/R09_PROFILE_TRIGGER_STATE_DRIFT/);await f.db.exec('rollback');
   assert.equal(await cols(f),0);await f.db.exec('alter table public.app_profiles enable trigger guard_profile_write_trg');
  });
  await t.test('the temporary backfill trigger rejects an unrelated profile change without disabling existing guards',async()=>{
   const altered=candidate.replace("worker_dispatch_clock_source='ROLLOUT_ACTIVE_OBSERVED'\n  WHERE", "worker_dispatch_clock_source='ROLLOUT_ACTIVE_OBSERVED',bio='Not metadata only'\n  WHERE");
   assert.notEqual(altered,candidate);await assert.rejects(f.db.exec(altered),/R09_BACKFILL_NOT_METADATA_ONLY/);await f.db.exec('rollback');
   assert.equal(await cols(f),0);
  });
  await t.test('an error after DDL and backfill rolls the complete candidate back atomically',async()=>{
   await assert.rejects(f.db.exec(candidate.replace(/COMMIT;\s*$/,()=>`DO $$BEGIN RAISE EXCEPTION 'INJECTED_ROLLBACK';END$$;COMMIT;`)),/INJECTED_ROLLBACK/);
   await f.db.exec('rollback');assert.equal(await cols(f),0);assert.equal(await gate(f,1,1),true);
  });
  await f.db.exec(candidate);
  await t.test('preexisting ACTIVE and DRAFT AI source, hash, session and review survive metadata-only rollout exactly',async()=>{
   for(const [w,before] of aiBefore){
    assert.equal(await f.value('select private.worker_ai_source_hash($1) as value',[workerId(w)]),before.hash);
    assert.deepEqual(await f.value('select private.worker_ai_source($1) as value',[workerId(w)]),before.doc);
    assert.deepEqual(await f.value('select to_jsonb(r) as value from private.worker_ai_reviews r where account_id=$1',[workerId(w)]),before.review);
    assert.deepEqual(await f.value('select to_jsonb(s) as value from private.worker_ai_sessions s where account_id=$1',[workerId(w)]),before.session);
   }
   assert.equal(await f.value("select to_regprocedure('pg_temp.r09_preserve_backfill_updated_at()')::text as value"),null);
   assert.equal(await f.value("select count(*)::int as value from pg_trigger where tgrelid='public.app_profiles'::regclass and tgname='zz_r09_observation_backfill'"),0);
  });
  await t.test('preexisting avatar claim markers stay valid for ACTIVE worker, DRAFT worker and requester',async()=>{
   for(const a of avatars){
    await f.db.exec('begin');
    try{
     await f.db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[a.account]);
     const receipt=await f.value('select public.rpc_apply_profile_avatar($1,$2) as value',[a.assetId,a.previousPath]);
     assert.equal(receipt.saved,true);assert.equal(receipt.authoritative,true);
     assert.deepEqual(await f.value('select public.rpc_apply_profile_avatar($1,$2) as value',[a.assetId,a.previousPath]),receipt);
    }finally{await f.db.exec('rollback');}
   }
  });
  await t.test('new avatar claims use the same semantic marker and real profile changes still conflict',async()=>{
   const a=avatars[0];await f.db.exec('begin');
   try{
    await f.db.exec("select set_config('request.jwt.claim.role','service_role',true)");
    await f.db.query("select public.rpc_claim_media_upload_service($1,'AVATAR',$2,$3,repeat('2',64),10,'image/jpeg')",[a.account,a.profile,id('c0000000',99)]);
    assert.equal(await f.value('select avatar_source_marker as value from private.owned_media_assets where client_request_id=$1',[id('c0000000',99)]),a.marker);
    await f.db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[a.account]);
    await f.db.query("update public.app_profiles set bio='A real new profile change' where id=$1",[a.profile]);
    await assert.rejects(f.db.query('select public.rpc_apply_profile_avatar($1,$2)',[a.assetId,a.previousPath]),/MEDIA_VERSION_CONFLICT/);
   }finally{await f.db.exec('rollback');}
  });
  await t.test('publication witness and revision reject empty, unrelated, and same-revision PUBLISH tokens',async()=>{
   for(const token of ['','CLOSE_REMAINING_SEARCH','CANCEL_AGREEMENT','PUBLISH']){
    await f.db.query("select set_config('uskoci.need_lifecycle',$1,false)",[token]);
    await assert.rejects(f.db.query('update public.needs set published_at=clock_timestamp() where id=$1',[needId(1)]),/PUBLISHED_AT_IS_SERVER_OWNED/);
    await assert.rejects(f.db.query('update public.needs set revision=2 where id=$1',[needId(1)]),/NEED_REVISION_IS_SERVER_OWNED/);
   }
   await f.db.exec('reset uskoci.need_lifecycle');
  });
  await t.test('existing active workers have honest rollout provenance; drafts and requester have no invented activation',async()=>{
   assert.equal((await clock(f,1)).source,'ROLLOUT_ACTIVE_OBSERVED');
   assert.deepEqual(await clock(f,2),{since:null,source:null});
   assert.equal(await f.value('select worker_dispatch_eligible_since as value from public.app_profiles where account_id=$1',[REQUESTER]),null);
  });
  await t.test('old matching task stays eligible for manual response but never enters proactive candidates',async()=>{
   assert.equal(await match(f,1,1),true);assert.equal(await gate(f,1,1),false);
   const detail=await f.value('select private.match_detail($1,$2) as value',[needId(1),profileId(1)]);
   assert.equal(detail.responseAllowed,true);
   assert.equal((await wave(f,1)).inserted,0);assert.equal((await f.counts()).opportunities,0);
  });
  await t.test('real confirmed activation writer stamps the first activation once',async()=>{
   const before=Date.now();await f.activate(2);const first=await clock(f,2);
   assert.equal(first.source,'FIRST_ACTIVATION');assert.ok(Date.parse(first.since)>=before-1000);
   await f.activate(2);assert.deepEqual(await clock(f,2),first);
   assert.equal(await match(f,1,2),true);assert.equal(await gate(f,1,2),false);
  });
  await t.test('ordinary profile edits preserve the immutable threshold',async()=>{
   const before=await clock(f,2);
   await f.db.query("update public.app_profiles set bio='Edited synthetic bio',updated_at=clock_timestamp() where id=$1",[profileId(2)]);
   assert.deepEqual(await clock(f,2),before);assert.equal(await gate(f,1,2),false);
  });
  await t.test('authenticated and service role cannot spoof, erase, or re-date the clock',async()=>{
   const before=await clock(f,2);
   for(const role of ['authenticated','service_role']){
    await f.db.query("select set_config('request.jwt.claim.role',$1,false)",[role]);
    for(const patch of ["worker_dispatch_eligible_since=now()-interval '1 month'","worker_dispatch_clock_source='ROLLOUT_ACTIVE_OBSERVED'","worker_dispatch_eligible_since=null,worker_dispatch_clock_source=null"]){
     await assert.rejects(f.db.query(`update public.app_profiles set ${patch} where id=$1`,[profileId(2)]),/WORKER_DISPATCH_CLOCK_IS_SERVER_OWNED/);
    }
   }
   await f.db.exec('reset request.jwt.claim.role');assert.deepEqual(await clock(f,2),before);
  });
  await t.test('a direct INSERT cannot forge an ACTIVE worker or supplied clock',async()=>{
   await assert.rejects(f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,worker_dispatch_eligible_since,worker_dispatch_clock_source)
    values($1,$2,'WORKER','Spoofed clock',now(),'FIRST_ACTIVATION')`,[profileId(99),workerId(99)]),/WORKER_DISPATCH_CLOCK_IS_SERVER_OWNED/);
   await f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,profile_status) values($1,$2,'WORKER','Draft bootstrap','ACTIVE')`,[profileId(99),workerId(99)]);
   assert.equal(await f.value('select profile_status as value from public.app_profiles where id=$1',[profileId(99)]),'DRAFT');
   assert.deepEqual(await clock(f,99),{since:null,source:null});
  });
  await f.addNeed(2);await f.addNeed(3,{mode:'REMOTE'});
  await t.test('new publications qualify while taxonomy, modes, world and proactive preference still apply',async()=>{
   assert.equal(await gate(f,2,1),true);assert.equal(await gate(f,2,2),true);assert.equal(await gate(f,2,3),true);
   for(const w of [4,5,6,7,99])assert.equal(await gate(f,2,w),false,'onsite worker '+w);
   assert.equal(await gate(f,2,8),true);assert.equal(await gate(f,3,7),true);assert.equal(await gate(f,3,8),false);
   assert.equal(await match(f,2,4),true,'business push preference does not remove matching');
  });
  await t.test('actual wave creates only available workers and real ledger; push off records explicit suppression',async()=>{
   assert.equal((await wave(f,2)).inserted,4);
   assert.deepEqual(await f.counts(),{opportunities:4,events:4,push:4,inApp:4,duplicates:0});
   assert.equal(await f.value("select state as value from public.notification_deliveries where channel='PUSH' and recipient_user_id=$1",[workerId(3)]),'SUPPRESSED');
   assert.equal(await f.value("select suppression_reason as value from public.notification_deliveries where channel='PUSH' and recipient_user_id=$1",[workerId(3)]),'PUSH_OFF');
   const keys=(await f.db.query("select dedupe_key from public.user_activity_events order by dedupe_key")).rows.map(x=>x.dedupe_key);
   assert.equal(new Set(keys).size,4);assert.ok(keys.every(x=>x.startsWith('opp:'+needId(2)+':1:')));
  });
  await t.test('repeat wave and duplicate event emission cannot duplicate a business notification',async()=>{
   const before=await f.counts();assert.equal((await wave(f,2)).inserted,0);
   const row=(await f.db.query('select * from public.user_activity_events order by created_at limit 1')).rows[0];
   await f.db.query(`select private.emit_event(p_recipient=>$1,p_role=>'WORKER',p_event_type=>'OPPORTUNITY_AVAILABLE',p_entity_type=>'NEED',p_entity_id=>$2,
    p_entity_version=>1,p_title=>'Repeated synthetic event',p_body=>'same event',p_dedupe_key=>$3,p_urgency=>'NORMAL',p_payload=>'{}',p_expires_at=>now()+interval '1 hour')`,[row.recipient_user_id,needId(2),row.dedupe_key]);
   assert.deepEqual(await f.counts(),before);assert.equal(await gate(f,2,1),false);
  });
  await t.test('actual Need guard accepts search closure/reopen fields without refreshing the publication clock',async()=>{
   const published=await f.value('select published_at as value from public.needs where id=$1',[needId(1)]);
   await f.db.query("update public.needs set updated_at=clock_timestamp(),remaining_search_closed_at=clock_timestamp(),remaining_search_closed_by_account_id=$2,remaining_search_close_reason='Synthetic closure' where id=$1",[needId(1),REQUESTER]);
   await f.db.query("update public.needs set updated_at=clock_timestamp(),remaining_search_closed_at=null,remaining_search_closed_by_account_id=null,remaining_search_close_reason=null where id=$1",[needId(1)]);
   assert.deepEqual(await f.value('select published_at as value from public.needs where id=$1',[needId(1)]),published);
   assert.equal(await match(f,1,1),true);assert.equal(await gate(f,1,1),false);
  });
  await t.test('a separate confirmed revision publication admits a new opportunity without deleting historical identity',async()=>{
   // Fixture setup models an already-authorized publication. It deliberately
   // does not remove or claim to test PUBLISHED_TASK_EDIT_NOT_READY.
   await f.db.exec('begin');
   await f.db.exec("select set_config('uskoci.need_lifecycle','CONFIRM_EDIT',true)");
   await f.db.query("update public.needs set revision=2,status='DRAFT',published_at=null,response_deadline=null where id=$1",[needId(2)]);
   await f.db.exec("select set_config('uskoci.need_lifecycle','PUBLISH',true)");
   await f.db.query("update public.needs set status='PUBLISHED',published_at=clock_timestamp() where id=$1",[needId(2)]);
   await f.db.exec('commit');
   await f.db.query(`insert into private.work_taxonomy_need_snapshots(need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
    select need_id,2,category_id,catalog_version,reviewed_by_requester,source,classification_state from private.work_taxonomy_need_snapshots where need_id=$1 and need_revision=1`,[needId(2)]);
   assert.equal(await gate(f,2,1),true);assert.equal((await wave(f,2)).inserted,4);
   assert.equal(await f.value('select count(distinct need_revision)::int as value from public.opportunity_deliveries where need_id=$1',[needId(2)]),2);
   assert.equal((await f.counts()).duplicates,0);
  });
  await t.test('existing profile export includes clock provenance only for its account',async()=>{
   const catalog=await f.value('select private.data_export_dataset_catalog() as value');
   const binding={policyId:'ISOLATED_NOT_APPROVED',policyVersion:'TEST',delivery:{datasets:catalog.map(x=>({key:x.key,mode:'INCLUDE',fields:x.fields}))}};
   const raw=await f.value('select private.data_export_snapshot($1,$2,$3,clock_timestamp()) as value',[workerId(2),id('a0000000',1),binding]);
   const exported=JSON.parse(raw);assert.equal(exported.datasets.profiles.length,1);
   assert.equal(exported.datasets.profiles[0].dispatchClockSource,'FIRST_ACTIVATION');
   assert.equal(Date.parse(exported.datasets.profiles[0].dispatchEligibleSince),Date.parse((await clock(f,2)).since));
   assert.equal(raw.includes(workerId(1)),false);
  });
  await t.test('existing closure redaction owns erasure of both added profile fields',async()=>{
   const row=await f.value('select to_jsonb(p) as value from public.app_profiles p where id=$1',[profileId(2)]);
   const result=await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',['public.app_profiles',row,workerId(2),id('a0000000',1)]);
   assert.equal(result.operation,'UPDATE');const patch=result.patch;
   assert.equal(patch.worker_dispatch_eligible_since,null);assert.equal(patch.worker_dispatch_clock_source,null);assert.equal(patch.profile_status,'CLOSED');
   // The private helper projection is proven. The complete authorized deletion
   // certificate/executor path and public legal readiness remain separate gates.
  });
  await t.test('real narrow closure certificate admits its exact patch and rejects an unrelated change',async()=>{
   const generation=id('a0000000',2),action=id('a0000000',3);
   await f.db.exec('begin');
   try{
    await f.db.query("select set_config('request.jwt.claim.role','service_role',true)");
    const row=await f.value('select to_jsonb(p) as value from public.app_profiles p where id=$1',[profileId(2)]);
    const result=await f.value('select private.closure_redaction_patch_v5($1,$2,$3,$4) as value',['public.app_profiles',row,workerId(2),generation]);
    const patch=result.patch;
    // Synthetic certificate/execution inputs to the ACTUAL guard only. No
    // certificate issuer, public deletion or storage/Auth executor is simulated.
    await f.db.query("insert into private.closure_executions_v5(account_id,generation,request_id,policy_sha256,state,binding) values($1,$2,$2,repeat('0',64),'EXECUTING','{\"adapterVersion\":\"OWNER_AF_D22_EVENT_ERASURE_V1\",\"provenance\":\"OWNER_AF_D22\",\"trigger\":\"CLOSURE_REQUESTED\"}')",[workerId(2),generation]);
    await f.db.query("insert into private.closure_actions_v5(id,generation,account_id,kind,state,dispatched_at) values($1,$2,$3,'RELATIONAL_REDACT','DISPATCHED',clock_timestamp())",[action,generation,workerId(2)]);
    await f.db.query(`insert into private.closure_redaction_certificate_v5(backend_pid,transaction_id,account_id,generation,action_id,relation_oid,operation,old_sha256,patch)
     values(pg_backend_pid(),txid_current(),$1,$2,$3,'public.app_profiles'::regclass,'UPDATE',encode(extensions.digest(convert_to($4::jsonb::text,'UTF8'),'sha256'),'hex'),$5)`,[workerId(2),generation,action,row,patch]);
    assert.equal(await f.value("select private.closure_redaction_allowed_v5('public.app_profiles'::regclass,'UPDATE',$1,$2) as value",[row,{...row,...patch}]),true);
    assert.equal(await f.value("select private.closure_redaction_allowed_v5('public.app_profiles'::regclass,'UPDATE',$1,$2) as value",[row,{...row,...patch,worker_dispatch_clock_source:'FIRST_ACTIVATION'}]),false);
    const columns=Object.keys(patch).map(x=>'"'+x.replaceAll('"','""')+'"');
    await f.db.query(`update public.app_profiles set (${columns.join(',')})=(select ${columns.map(x=>'p.'+x).join(',')} from jsonb_populate_record(null::public.app_profiles,$1) p) where id=$2`,[patch,profileId(2)]);
    assert.deepEqual(await clock(f,2),{since:null,source:null});
    assert.equal(await f.value('select profile_status as value from public.app_profiles where id=$1',[profileId(2)]),'CLOSED');
   }finally{await f.db.exec('rollback');}
  });
  await t.test('second installation is refused; candidate exposes no callable clock setter',async()=>{
   await assert.rejects(f.db.exec(candidate),/R09_ACTIVATION_CLOCK_ALREADY_EXISTS/);await f.db.exec('rollback');
   for(const role of ['anon','authenticated','service_role'])assert.equal(await f.value("select has_function_privilege($1,'private.guard_worker_dispatch_clock_v1()','EXECUTE') as value",[role]),false);
  });
  await t.test('explicit rollback keeps all activation data, export/closure and publication hardening',async()=>{
   const before=await clock(f,2);
   const guardHash=await f.value("select md5(prosrc) as value from pg_proc where oid='private.guard_need_write()'::regprocedure");
   await assert.rejects(f.db.exec(rollbackSource),/R09_ACTIVATION_ROLLBACK_SOURCE_ONLY/);
   await f.db.exec(rollback);
   assert.deepEqual(await clock(f,2),before);assert.equal(await cols(f),2);
   assert.equal(await gate(f,1,2),true,'rollback explicitly restores pre-activation admission; clock data remains available');
   assert.equal(await f.value("select md5(prosrc) as value from pg_proc where oid='private.guard_need_write()'::regprocedure"),guardHash);
   await assert.rejects(f.db.query('update public.app_profiles set worker_dispatch_eligible_since=null where id=$1',[profileId(2)]),/WORKER_DISPATCH_CLOCK_IS_SERVER_OWNED/);
   await assert.rejects(f.db.exec(rollback),/R09_ROLLBACK_POSTIMAGE_DRIFT/);await f.db.exec('rollback');
  });
 }finally{if(native)await nativeRuntime.stopFixture();else await f.db.close();}
});
