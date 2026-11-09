'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,source,candidate,rollbackSource,rollback,dependencies,preimage,signature,id}=require('./r09-applicant-suppression-fixture.cjs');
const {edgeHarness}=require('./r09-push-fixture.cjs');
const native=process.env.USKOCI_F20_NATIVE==='1';
const runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const report={recordedAt:new Date().toISOString(),sourceBase:'76dd409a929b7d133fb63da4ed840762778baa27',
 dimension:native?'ISOLATED_NATIVE_POSTGRESQL_POSTGIS':'ISOLATED_PGLITE_SQL',deployment:'NOT_APPLIED_TO_DEV',
 sourceSha256:sha(source),candidateSha256:sha(candidate),rollbackSha256:sha(rollback),
 dependencyCaptureSha256:sha(fs.readFileSync(path.join(__dirname,'sql/r09_applicant_suppression_20261108.dependencies.json'))),
 harnessSha256:sha(fs.readFileSync(__filename)),scenarios:[],failures:[],limitations:[
  'Synthetic SQL data only, not live Auth/JWT, Android, Expo/FCM delivery or a full Supabase clone.',
  'Real captured matcher, wave/emitter, rpc_submit_response and claim/begin/complete bodies run unchanged; only the two named suppression owners are patched.',
  'Auth users/sessions are a narrow shape fixture. External safety, closure, lifecycle, response-version event and pg_net wake triggers and foreign keys are not installed.',
  'Selected/withdrawn/revision/cancelled states are valid synthetic state inputs, not execution of the entire selection/cancellation/edit writer flow.',
  'The real Edge handler uses mock Expo HTTP and mocked readiness/metrics reporting, while its claim/begin/complete RPCs execute real SQL.',
  'A response committed before suppression is checked blocks SEND_STARTED. A provider send that already started cannot be recalled; UNKNOWN never permits a blind resend.',
  native?'Native cases use multiple real PostgreSQL connections and observed blocking; this is not hosted load/capacity evidence.':'PGlite cases prove SQL semantics; real multi-connection races require the separate native invocation.'
 ]};

test('PGlite fixture publication clock is strictly after activation even within one host clock tick',async()=>{
 let f;const realNow=Date.now;
 try{
  f=await fixture();
  const fixedNow=realNow();let clockReads=0,pair;
  try{
   // PGlite's host clock is millisecond based. Freeze only data setup so the
   // activation/publication race is deterministic, without replacing any SQL.
   Date.now=()=>{clockReads++;return fixedNow;};
   pair=await f.addPair();
  }finally{Date.now=realNow;}
  assert.ok(clockReads>0,'the actual PGlite host clock was controlled');
  const clocks=await f.value(`select jsonb_build_object(
   'activation',p.worker_dispatch_eligible_since::text,
   'publishedAfter',n.published_at>p.worker_dispatch_eligible_since,
   'deltaMicros',extract(epoch from(n.published_at-p.worker_dispatch_eligible_since))*1000000)
   as value from public.app_profiles p cross join public.needs n where p.id=$1 and n.id=$2`,[pair.profile,pair.need]);
  assert.equal(clocks.publishedAfter,true,'default fixture represents a publication after activation, never a same-tick tie');
  assert.equal(clocks.deltaMicros,1,'synthetic ordering barrier adds only one microsecond');
  assert.equal(await f.match(pair),true);assert.equal(await f.gate(pair),true);
  for(const [number,offset]of [[100001,'0 microseconds'],[100002,'-1 microsecond']]){
   const exact=await f.value('select ($1::timestamptz+$2::interval)::text as value',[clocks.activation,offset]);
   const need=await f.addNeed(number,{publishedAt:exact}),boundary={...pair,need};
   assert.equal(await f.value('select published_at=$2::timestamptz as value from public.needs where id=$1',[need,exact]),true,
    'explicit historical and equal-time fixture inputs must remain unchanged');
   assert.equal(await f.match(boundary),true);assert.equal(await f.gate(boundary),false,'strict production > boundary is preserved');
  }
 }finally{Date.now=realNow;if(f)await f.db.close();}
});

test('R09/F20 prevents an active or accepted applicant receiving the same opportunity',async t=>{
 let f;const clients=[];
 const run=async(name,fn)=>t.test(name,async()=>{
  const started=performance.now();
  try{const result=await fn();report.scenarios.push({name,result:result??{},elapsedMs:performance.now()-started,status:'PASS'});}
  catch(error){report.failures.push({name,error:String(error.message)});throw error;}
 });
 const clean=async(name,fn)=>run(name,async()=>{await f.reset();return fn();});
 const rowsHash=()=>f.value(`select md5(jsonb_build_object(
  'profiles',(select jsonb_agg(to_jsonb(x) order by x.id) from public.app_profiles x),
  'needs',(select jsonb_agg(to_jsonb(x) order by x.id) from public.needs x),
  'responses',(select jsonb_agg(to_jsonb(x) order by x.id) from public.marketplace_responses x),
  'opportunities',(select jsonb_agg(to_jsonb(x) order by x.id) from public.opportunity_deliveries x),
  'events',(select jsonb_agg(to_jsonb(x) order by x.id) from public.user_activity_events x),
  'deliveries',(select jsonb_agg(to_jsonb(x) order by x.id) from public.notification_deliveries x))::text) as value`);
 const functionState=()=>f.value(`select jsonb_object_agg(p.oid::regprocedure::text,to_jsonb(p)) as value
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('private','public') and p.proname in
   ('dispatch_cheap_candidate_admitted','push_suppression','dispatch_next_wave','rpc_submit_response','rpc_begin_push_send','rpc_claim_push_transport','rpc_complete_push_transport')`);
 const makeSelection=async(pair)=>{
  const response=await f.submit(pair),selection=id('a1000000',pair.number),agreement=id('a2000000',pair.number);
  await f.db.query("update public.needs set required_slots=2,status='SELECTION' where id=$1",[pair.need]);
  await f.db.query("update public.marketplace_responses set status='SELECTED' where id=$1",[response.responseId]);
  await f.db.query(`insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,
   covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode)
   values($1,$2,1,'10000000-0000-4000-8000-000000000001',$3,1,$4,$5,$6,'REQUESTER_SELECTS')`,
  [selection,pair.need,'f20-selected-'+pair.number,response.responseId,pair.user,pair.profile]);
  await f.db.query(`insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,
   requester_profile_id,worker_account_id,worker_profile_id)
   values($1,$2,$3,$4,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',$5,$6)`,
  [agreement,pair.need,selection,response.responseId,pair.user,pair.profile]);
  return {response,selection,agreement};
 };
 const sqlEdge=options=>edgeHarness({...options,rpc:async(name,args,fallback)=>{
  if(name==='rpc_claim_push_transport')return f.claim(args.p_kind);
  if(name==='rpc_begin_push_send'){
   if(options?.beforeBegin)await options.beforeBegin();
   return f.begin({attemptId:args.p_attempt_id,leaseId:args.p_lease_id});
  }
  if(name==='rpc_complete_push_transport')return f.complete({attemptId:args.p_attempt_id,leaseId:args.p_lease_id},args.p_result,args.p_ticket_id);
  if(name==='rpc_record_push_readiness'||name==='rpc_get_push_transport_metrics')return fallback(name,args);
  assert.fail('Unexpected RPC '+name);
 }});
 try {
  f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
  report.postgres=await f.value('select version() as value');
  if(native)report.postgis=await f.value('select extensions.postgis_full_version() as value');
  await run('live preimage reproduces first opportunity after committed manual OFFER',async()=>{
   const pair=await f.addPair();const response=await f.submit(pair);
   assert.equal(response.status,'SUBMITTED');assert.equal(await f.gate(pair),true);
   assert.equal((await f.wave(pair)).inserted,1);
   const delivery=await f.pushDelivery(pair);assert.equal(await f.suppression(delivery),null);
   return {characterization:'CURRENT_BUG_REPRODUCED',activeOffer:true,...await f.ledger()};
  });
  await clean('live preimage also admits manually SELECTED account on partially filled flexible task',async()=>{
   const other=await f.addPair(),pair=await f.addPair();await makeSelection(pair);
   assert.equal(await f.gate(pair),true);assert.equal(await f.gate({...other,need:pair.need}),true);
   const wave=await f.wave(pair);assert.equal(wave.inserted,2);assert.equal(wave.remainingSlots,1);
   return {characterization:'CURRENT_SELECTED_BUG_REPRODUCED',selectedSlots:1,remainingSlots:1,...await f.ledger()};
  });
  await run('full source candidates cannot be mistaken for deployment SQL',async()=>{
   const before=await functionState();await assert.rejects(f.db.exec(source),/R09_APPLICANT_SOURCE_ONLY/);
   await assert.rejects(f.db.exec(rollbackSource),/R09_APPLICANT_ROLLBACK_SOURCE_ONLY/);
   assert.deepEqual(await functionState(),before);
  });
  await run('changed owner body fails before either mutation',async()=>{
   const original=preimage.functions.find(x=>x.identity.startsWith('private.push_suppression('));
   await f.db.exec(original.definition.replace('begin\n','begin\n  -- isolated drift\n'));
   const before=await functionState();await assert.rejects(f.db.exec(candidate),/R09_APPLICANT_PREIMAGE_DRIFT/);
   await f.db.exec('rollback');assert.deepEqual(await functionState(),before);await f.db.exec(original.definition);
  });
  await run('unexpected public privilege fails before mutation without weakening the gate',async()=>{
   await f.db.exec('grant execute on function private.push_suppression(public.notification_deliveries) to authenticated');
   await assert.rejects(f.db.exec(candidate),/R09_APPLICANT_PREIMAGE_DRIFT/);await f.db.exec('rollback');
   await f.db.exec('revoke execute on function private.push_suppression(public.notification_deliveries) from authenticated');
  });
  await run('candidate preserves all rows and all owner/ACL/security metadata',async()=>{
   const state=await functionState(),data=await rowsHash();await f.db.exec(candidate);
   assert.equal(await rowsHash(),data);const after=await functionState();
   const changed=[];for(const [sig,prior]of Object.entries(state)){
    const now=after[sig];assert.ok(now);if(prior.prosrc!==now.prosrc)changed.push(sig);
    const {prosrc:oldSource,...a}=prior,{prosrc:newSource,...b}=now;assert.deepEqual(b,a,sig);
   }
   assert.equal(changed.length,2);assert.ok(changed.every(x=>/dispatch_cheap_candidate_admitted|push_suppression/.test(x)));
   return {changedOwners:changed,dataUnchanged:true,metadataUnchanged:true};
  });
  await run('private owners remain unavailable to every client role and begin remains service-only',async()=>{
   for(const role of ['anon','authenticated','service_role'])for(const name of Object.keys(dependencies.patch_hashes))
    assert.equal(await f.value('select has_function_privilege($1,$2,\'EXECUTE\') as value',[role,name]),false);
   assert.equal(await f.value("select has_function_privilege('authenticated','public.rpc_begin_push_send(uuid,uuid)','EXECUTE') as value"),false);
   assert.equal(await f.value("select has_function_privilege('service_role','public.rpc_begin_push_send(uuid,uuid)','EXECUTE') as value"),true);
  });
  await clean('ordinary first candidate still receives exactly one opportunity and repeated dispatch never duplicates it',async()=>{
   const pair=await f.addPair();assert.equal(await f.gate(pair),true);assert.equal((await f.wave(pair)).inserted,1);
   assert.equal((await f.wave(pair)).inserted,0);assert.deepEqual(await f.ledger(),{opportunities:1,events:1,push:1,attempts:0,sendCount:0,duplicates:0});
  });
  for(const status of ['SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED'])await clean(`${status} OFFER blocks only proactive opportunity, not matching or manual eligibility`,async()=>{
   const pair=await f.addPair();await f.response(pair,{status});
   assert.equal(await f.match(pair),true);assert.equal(await f.responseAllowed(pair),true);
   assert.equal(await f.gate(pair),false);assert.equal((await f.wave(pair)).inserted,0);
   assert.equal((await f.ledger()).events,0);
  });
  for(const status of ['DRAFT','WITHDRAWN','EXPIRED','STALE','STALE_REVIEW_REQUIRED','NOT_SELECTED'])await clean(`${status} keeps existing non-active response admission policy`,async()=>{
   const pair=await f.addPair();await f.response(pair,{status});
   assert.equal(await f.gate(pair),true);assert.equal((await f.wave(pair)).inserted,1);
  });
  await clean('legacy APPLICATION kind does not acquire a new OFFER policy',async()=>{
   const pair=await f.addPair();await f.response(pair,{kind:'APPLICATION'});assert.equal(await f.gate(pair),true);
  });
  await clean('same account is suppressed despite a historical different response profile snapshot',async()=>{
   const other=await f.addPair(),pair=await f.addPair();
   // Current schema allows only one Worker profile/account. This deliberately
   // divergent historical profile reference tests the account predicate only;
   // it is not accepted from a client or produced by rpc_submit_response.
   await f.response(pair,{profile:other.profile});assert.equal(await f.gate(pair),false);
   assert.equal(await f.gate({...other,need:pair.need}),true);
  });
  await clean('another account or another Need does not suppress an unrelated candidate',async()=>{
   const other=await f.addPair(),pair=await f.addPair();
   await f.response(other,{need:pair.need});assert.equal(await f.gate(pair),true);
   await f.db.exec('truncate public.marketplace_responses');await f.response(pair,{need:other.need});assert.equal(await f.gate(pair),true);
  });
  await clean('old submitted revision does not suppress a genuinely new publication revision',async()=>{
   const pair=await f.addPair();await f.response(pair);
   await f.db.query('update public.needs set revision=2 where id=$1',[pair.need]);
   await f.db.query('update private.work_taxonomy_need_snapshots set need_revision=2 where need_id=$1',[pair.need]);
   assert.equal(await f.gate(pair),true);assert.equal((await f.wave(pair)).inserted,1);
   assert.equal(await f.value('select entity_version as value from public.user_activity_events limit 1'),2);
   assert.equal(await f.suppression(await f.pushDelivery(pair)),null);
  });
  await clean('REMOTE uses the same applicant boundary and retains its independent wave policy',async()=>{
   const pair=await f.addPair({worker:{modes:['REMOTE']},need:{mode:'REMOTE'}});await f.response(pair);
   assert.equal(await f.match(pair),true);assert.equal(await f.gate(pair),false);assert.equal((await f.wave(pair)).inserted,0);
  });
  await clean('new worker can manually apply to older matching task without retroactive notification',async()=>{
   const pair=await f.addPair({need:{publishedAt:'2026-11-01T00:00:00Z'}});
   assert.equal(await f.match(pair),true);assert.equal(await f.gate(pair),false);
   assert.equal((await f.submit(pair)).status,'SUBMITTED');assert.equal((await f.wave(pair)).inserted,0);
  });
  await clean('selected account stays suppressed while another eligible worker fills remaining place',async()=>{
   const other=await f.addPair(),pair=await f.addPair();await makeSelection(pair);
   assert.equal(await f.gate(pair),false);assert.equal(await f.gate({...other,need:pair.need}),true);
   const wave=await f.wave(pair);assert.equal(wave.inserted,1);assert.equal(wave.remainingSlots,1);
   assert.equal(await f.value('select worker_account_id::text as value from public.opportunity_deliveries'),other.user);
   return {selectedNotReinvited:true,otherWorkerInvited:true,remainingSlots:1};
  });
  await clean('SELECTED on a partially filled task suppresses its already queued opportunity before first claim',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.wave(pair);
   const delivery=await f.pushDelivery(pair);await makeSelection(pair);
   assert.equal(await f.suppression(delivery),'ALREADY_RESPONDED');
   assert.equal((await f.claim()).kind,'NONE');
   assert.equal(await f.value('select suppression_reason as value from public.notification_deliveries where id=$1',[delivery]),'ALREADY_RESPONDED');
   assert.equal((await f.ledger()).sendCount,0);
   return {selectedSlots:1,remainingSlots:1,queuedPushSuppressed:true,sendCount:0};
  });
  await clean('current cancellation NOT_SELECTED state retains existing eligibility without inventing a new revision',async()=>{
   const pair=await f.addPair();const selection=await makeSelection(pair);
   assert.equal(await f.gate(pair),false);
   // Exact post-state of the read-back cancellation owner; this does not claim
   // execution of cancellation's private-message/grant/closure orchestration.
   await f.db.query("update public.marketplace_responses set status='NOT_SELECTED',selected_at=null where id=$1",[selection.response.responseId]);
   await f.db.query("update public.need_selections set status='CANCELLED' where id=$1",[selection.selection]);
   await f.db.query("update public.agreements set status='CANCELLED' where id=$1",[selection.agreement]);
   assert.equal(await f.gate(pair),true);assert.equal((await f.wave(pair)).inserted,1);assert.equal((await f.wave(pair)).inserted,0);
  });
  await clean('suppression uses concrete event revision even when current Need has advanced',async()=>{
   const pair=await f.addPair();await f.wave(pair);const delivery=await f.pushDelivery(pair);await f.response(pair);
   await f.db.query('update public.needs set revision=2 where id=$1',[pair.need]);
   assert.equal(await f.suppression(delivery),'ALREADY_RESPONDED');
   await f.db.query('update public.marketplace_responses set submitted_against_need_revision=2 where need_id=$1',[pair.need]);
   assert.equal(await f.suppression(delivery),null);
  });
  await clean('missing preferences cannot bypass already-responded suppression',async()=>{
   const pair=await f.addPair();await f.wave(pair);const delivery=await f.pushDelivery(pair);
   await f.db.query('delete from public.notification_preferences where user_id=$1',[pair.user]);
   assert.equal(await f.suppression(delivery),null);await f.submit(pair);assert.equal(await f.suppression(delivery),'ALREADY_RESPONDED');
   assert.equal((await f.claim()).kind,'NONE');assert.equal((await f.ledger()).attempts,0);
   assert.equal(await f.value('select suppression_reason as value from public.notification_deliveries where id=$1',[delivery]),'ALREADY_RESPONDED');
  });
  await clean('recipient identity is validated before any applicant lookup or preference default',async()=>{
   const other=await f.addPair(),pair=await f.addPair();await f.wave(pair);await f.response(pair);
   const delivery=await f.pushDelivery(pair);await f.db.query('update public.notification_deliveries set recipient_user_id=$1 where id=$2',[other.user,delivery]);
   assert.equal(await f.suppression(delivery),'EVENT_UNAVAILABLE');
  });
  await clean('non-opportunity messages remain allowed after an application',async()=>{
   const pair=await f.addPair();await f.wave(pair);await f.submit(pair);const delivery=await f.pushDelivery(pair);
   await f.db.query("update public.user_activity_events set event_type='MESSAGE_RECEIVED',entity_type='AGREEMENT' where recipient_user_id=$1",[pair.user]);
   assert.equal(await f.suppression(delivery),null);
  });
  await clean('push off, category off, quiet hours, expiry and closed state retain their existing checks',async()=>{
   const pair=await f.addPair();await f.wave(pair);const delivery=await f.pushDelivery(pair);
   await f.db.query('update public.notification_preferences set push_enabled=false where user_id=$1',[pair.user]);assert.equal(await f.suppression(delivery),'PUSH_OFF');
   await f.db.query('update public.notification_preferences set push_enabled=true,opportunities_enabled=false where user_id=$1',[pair.user]);assert.equal(await f.suppression(delivery),'CATEGORY_OFF');
   await f.db.query("update public.notification_preferences set opportunities_enabled=true,quiet_hours_enabled=true,quiet_start='00:00',quiet_end='23:59:59.999999' where user_id=$1",[pair.user]);assert.equal(await f.suppression(delivery),'QUIET_HOURS');
   await f.db.query("update public.notification_deliveries set expires_at=clock_timestamp()-interval '1 second' where id=$1",[delivery]);assert.equal(await f.suppression(delivery),'EXPIRED');
   await f.db.query("update public.notification_deliveries set state='SUPPRESSED',suppression_reason='PUSH_OFF' where id=$1",[delivery]);assert.equal(await f.suppression(delivery),'DELIVERY_CLOSED');
  });
  await clean('claim then committed application blocks begin for every pending device',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.device(pair);await f.wave(pair);
   const a=await f.claim(),b=await f.claim();assert.equal(a.kind,'SEND');assert.equal(b.kind,'SEND');assert.notEqual(a.attemptId,b.attemptId);
   await f.submit(pair);assert.equal((await f.begin(a)).kind,'SUPPRESSED');assert.equal((await f.begin(b)).kind,'SUPPRESSED');
   assert.equal((await f.ledger()).sendCount,0);assert.equal(await f.value("select count(*)::int as value from public.notification_push_attempts where transport_state='SUPPRESSED' and error_code='ALREADY_RESPONDED'"),2);
   assert.equal((await f.claim()).kind,'NONE');return {...await f.ledger(),suppressedDevices:2};
  });
  await clean('withdrawal/reopen after final suppression never creates a repeated opportunity or revives its delivery',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.wave(pair);const response=await f.submit(pair);
   assert.equal((await f.claim()).kind,'NONE');await f.db.query("update public.marketplace_responses set status='WITHDRAWN' where id=$1",[response.responseId]);
   await f.db.query("update public.needs set status='SELECTION' where id=$1",[pair.need]);
   assert.equal((await f.wave(pair)).inserted,0);assert.equal((await f.claim()).kind,'NONE');assert.equal((await f.ledger()).opportunities,1);assert.equal((await f.ledger()).sendCount,0);
  });
  await clean('real Edge handler sees committed application between SQL claim and begin and makes no provider call',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.device(pair);await f.wave(pair);let submitted=false;
   const h=sqlEdge({beforeBegin:async()=>{if(!submitted){submitted=true;await f.submit(pair);}}});
   const response=await h.invoke();assert.equal(response.status,200);
   assert.equal(h.calls.filter(c=>c.url.startsWith('https://exp.host')).length,0);assert.equal((await f.ledger()).sendCount,0);
   return {providerCalls:0,actualSqlClaimBegin:true};
  });
  await clean('provider outcome UNKNOWN remains one started send across applicant arrival and repeated ticks',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.wave(pair);
   const h=sqlEdge({provider:async()=>{throw new Error('Synthetic lost provider acknowledgement');}});
   assert.equal((await h.invoke()).status,200);assert.equal((await f.ledger()).sendCount,1);
   assert.equal(await f.value('select transport_state as value from public.notification_push_attempts'),'UNKNOWN');
   await f.submit(pair);assert.equal((await h.invoke()).status,200);assert.equal((await h.invoke()).status,200);
   assert.equal(h.calls.filter(c=>c.url.endsWith('/send')).length,1);assert.equal((await f.ledger()).sendCount,1);
   return {mockProviderCalls:1,sendCount:1,finalState:'UNKNOWN',providerRecalled:false};
  });
  await clean('late receipt settles its original ticket without another SEND after application',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.wave(pair);const a=await f.claim();assert.equal((await f.begin(a)).kind,'SEND');
   await f.complete(a,'TICKET','f20_ticket_1');await f.submit(pair);
   await f.db.exec("update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second'");
   const receipt=await f.claim('RECEIPT');assert.equal(receipt.kind,'RECEIPT');assert.equal((await f.complete(receipt,'PROVIDER_ACCEPTED')).state,'PROVIDER_ACCEPTED');
   assert.equal((await f.claim()).kind,'NONE');assert.equal((await f.ledger()).sendCount,1);
  });
  await clean('known receipt rejection can retry only after current applicant suppression recheck',async()=>{
   const pair=await f.addPair();await f.device(pair);await f.wave(pair);const a=await f.claim();await f.begin(a);await f.complete(a,'TICKET','f20_ticket_2');
   await f.submit(pair);await f.db.exec("update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second'");
   const receipt=await f.claim('RECEIPT');assert.equal((await f.complete(receipt,'RECEIPT_RATE_EXCEEDED')).state,'RETRYABLE');
   await f.db.exec("update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second'");
   assert.equal((await f.claim()).kind,'NONE');assert.equal(await f.value('select transport_state as value from public.notification_push_attempts'),'SUPPRESSED');assert.equal((await f.ledger()).sendCount,1);
  });
  if(native) {
   const connect=async()=>{const c=await runtime.connectFixtureClient();clients.push(c);return c;};
   const waitBlocked=async(pid,blocker)=>{
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){if(await f.value('select $2::int=any(pg_blocking_pids($1)) as value',[pid,blocker]))return;await new Promise(r=>setTimeout(r,10));}
    throw new Error('No real Need lock wait observed');
   };
   const pid=async c=>(await c.query('select pg_backend_pid() as id')).rows[0].id;
   await clean('native submit holds Need first; waiting dispatch sees committed OFFER and creates no opportunity',async()=>{
    const pair=await f.addPair(),a=await connect(),b=await connect();await a.query('begin');await f.submit(pair,{},a);
    const bpid=await pid(b),apid=await pid(a),pending=f.wave(pair,b).then(value=>({value}),error=>({error}));
    await waitBlocked(bpid,apid);await a.query('commit');const out=await pending;if(out.error)throw out.error;
    assert.equal(out.value.inserted,0);assert.equal((await f.ledger()).opportunities,0);
    return {observedNeedLockWait:true,inserted:0};
   });
   await clean('native dispatch holds Need first; waiting submit marks its one opportunity responded before claim',async()=>{
    const pair=await f.addPair(),a=await connect(),b=await connect();await f.device(pair);await a.query('begin');assert.equal((await f.wave(pair,a)).inserted,1);
    const bpid=await pid(b),apid=await pid(a),pending=f.submit(pair,{},b).then(value=>({value}),error=>({error}));
    await waitBlocked(bpid,apid);await a.query('commit');const out=await pending;if(out.error)throw out.error;
    assert.equal(out.value.status,'SUBMITTED');assert.equal(await f.value('select status as value from public.opportunity_deliveries'),'RESPONDED');
    assert.equal((await f.claim()).kind,'NONE');assert.equal((await f.ledger()).sendCount,0);
    return {observedNeedLockWait:true,...await f.ledger()};
   });
   await clean('native two leased devices recheck the same newly committed application without deadlock',async()=>{
    const pair=await f.addPair();await f.device(pair);await f.device(pair);await f.wave(pair);
    const a=await f.claim(),b=await f.claim();const writer=await connect();await f.submit(pair,{},writer);
    const c=await connect(),d=await connect();const out=await Promise.all([f.begin(a,c),f.begin(b,d)]);
    assert.deepEqual(out.map(x=>x.kind),['SUPPRESSED','SUPPRESSED']);assert.equal((await f.ledger()).sendCount,0);
    return {parallelBeginCalls:2,...await f.ledger()};
   });
   await clean('native active-offer lookup uses existing partial unique index at representative synthetic history size',async()=>{
    const pair=await f.addPair();await f.response(pair);await f.db.exec(`insert into public.marketplace_responses
     (need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,price_rsd,price_basis)
     select md5('f20-history-need-'||g)::uuid,md5('f20-history-account-'||g)::uuid,md5('f20-history-profile-'||g)::uuid,
      'OFFER',case when g%2=0 then 'WITHDRAWN' else 'SUBMITTED' end,1,1200,'TOTAL' from generate_series(1,10000) g;
     analyze public.marketplace_responses;`);
    const plan=(await f.db.query(`explain(analyze,buffers,format json) select 1 from public.marketplace_responses r
     where r.need_id=$1 and r.worker_account_id=$2 and r.submitted_against_need_revision=1 and r.response_kind='OFFER'
       and r.status in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')`,[pair.need,pair.user])).rows[0]['QUERY PLAN'];
    assert.match(JSON.stringify(plan),/marketplace_responses_one_live_per_worker_need/);
    return {syntheticRows:10001,addedProductionIndexes:0,plan};
   });
  }
  await run('guarded rollback restores only the two admission bodies and retains all rows and activation clock',async()=>{
   const data=await rowsHash(),metadata=await functionState();await f.db.exec(rollback);
   assert.equal(await rowsHash(),data);const restored=await functionState();
   for(const [sig,before]of Object.entries(metadata)){const {prosrc:x,...a}=before,{prosrc:y,...b}=restored[sig];assert.deepEqual(b,a);}
   for(const [sig,hashes]of Object.entries(dependencies.patch_hashes))assert.equal(await f.value('select md5(prosrc) as value from pg_proc where oid=to_regprocedure($1)',[sig]),hashes.before);
   assert.equal(await f.value("select to_regprocedure('private.guard_worker_dispatch_clock_v1()') is not null as value"),true);
   await f.db.exec(candidate);
   for(const [sig,hashes]of Object.entries(dependencies.patch_hashes))assert.equal(await f.value('select md5(prosrc) as value from pg_proc where oid=to_regprocedure($1)',[sig]),hashes.after);
   return {forwardRollbackForward:true,dataUnchanged:true};
  });
 } catch(error){report.failures.push({name:'suite',error:String(error.message)});throw error;}
 finally {
  for(const c of clients)try{await c.query('rollback');await c.end();}catch{}
  if(native)await runtime.stopFixture();else if(f)await f.db.close();
  report.completedAt=new Date().toISOString();report.result=report.failures.length?'FAIL':'PASS';report.passedScenarios=report.scenarios.length;
  if(process.env.USKOCI_F20_PROOF){const output=path.resolve(process.env.USKOCI_F20_PROOF);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
 }
});
