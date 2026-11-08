'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { edgeHarness, sqlFixture, json, pause } = require('./r09-push-fixture.cjs');

test('captured deployed v45 executes only one SEND and one RECEIPT for the same synthetic burst',async()=>{
 const previous=JSON.parse(readFileSync(path.join(__dirname,'sql/r09_push_edge_v45_20261108.preimage.json'),'utf8'));
 const h=edgeHarness({entrySource:previous.entrypoint});
 for(let i=0;i<100;i++){h.add('SEND',{legacy:true});h.add('RECEIPT');}
 const r=await h.invoke();assert.equal(r.status,200);assert.equal(h.completed.length,2);
 assert.equal(h.completed.filter(c=>c.p_result==='TICKET').length,1);
 assert.equal(h.completed.filter(c=>c.p_result==='PROVIDER_ACCEPTED').length,1);
 assert.equal(h.queues.SEND.length,99);assert.equal(h.queues.RECEIPT.length,99);
});

test('actual handler drains 100 sends and 100 receipts with bounded, separate lanes', async t => {
 const h = edgeHarness({ claimDelay: 1, providerDelay: 4 });
 for (let i=0;i<125;i++) { h.add('SEND'); h.add('RECEIPT'); }
 const started = performance.now();
 const response = await h.invoke(), result = await response.json(), elapsed = performance.now()-started;
 assert.equal(response.status,200); assert.deepEqual(result.processed,{send:100,receipt:100});
 assert.deepEqual(result.failures,{send:0,receipt:0});
 assert.equal(h.queues.SEND.length,25); assert.equal(h.queues.RECEIPT.length,25);
 assert.ok(h.peakSend>1 && h.peakSend<=4); assert.ok(h.peakTotal<=5); assert.equal(h.peakClaim,1);
 assert.equal(new Set(h.completed.map(c=>c.p_attempt_id)).size,200);
 assert.equal(h.completed.filter(c=>c.p_result==='TICKET').length,100);
 assert.equal(h.completed.filter(c=>c.p_result==='PROVIDER_ACCEPTED').length,100);
 assert.deepEqual(h.observations,['TICK_OK']); assert.deepEqual(h.logs,[]);
 const second=await (await h.invoke()).json();assert.deepEqual(second.processed,{send:25,receipt:25});
 assert.equal(new Set(h.completed.map(c=>c.p_attempt_id)).size,250,'second tick never replays prior attempts');
 t.diagnostic(`Mock HTTP only: first tick processed 100 sends + 100 receipts in ${elapsed.toFixed(1)} ms; peak SEND=${h.peakSend}, total provider=${h.peakTotal}. No provider/device throughput claim.`);
});

test('actual bounded handler drives real claim/begin/complete SQL with mock Expo, including receipt readback',async()=>{
 const f=await sqlFixture();
 try{
  await f.db.exec(f.candidate);
  for(let i=0;i<12;i++)await f.delivery(await f.recipient(),{expiresIn:300});
  const h=edgeHarness({providerDelay:2,rpc:async(name,args,fallback)=>{
   if(name==='rpc_record_push_readiness')return fallback(name,args);
   if(name==='rpc_claim_push_transport')return f.claim(args.p_kind);
   if(name==='rpc_begin_push_send')return f.begin({attemptId:args.p_attempt_id,leaseId:args.p_lease_id});
   if(name==='rpc_complete_push_transport')return f.complete({attemptId:args.p_attempt_id,leaseId:args.p_lease_id},args.p_result,args.p_ticket_id);
   if(name==='rpc_get_push_transport_metrics')return f.value('select public.rpc_get_push_transport_metrics() as value');
   assert.fail('Unexpected SQL RPC '+name);
  }});
  const first=await(await h.invoke()).json();assert.deepEqual(first.processed,{send:12,receipt:0});
  assert.deepEqual(first.failures,{send:0,receipt:0});
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where transport_state='TICKET_PENDING' and send_count=1"),12);
  assert.equal(await f.value('select count(*)::integer as value from notification_deliveries where delivered_at is not null'),0);
  await f.db.exec("update notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second';");
  const second=await(await h.invoke()).json();assert.deepEqual(second.processed,{send:0,receipt:12});
  assert.deepEqual(second.failures,{send:0,receipt:0});
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where transport_state='PROVIDER_ACCEPTED' and send_count=1"),12);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/send')).length,12,'receipt pass cannot resend a ticketed attempt');
  assert.equal(second.queue.pendingDeliveries,0);assert.equal(second.queue.receiptAttemptsDue,0);
 }finally{await f.db.close();}
});

test('authoritative expiry bounds offline TTL; old receipts and one-shot targets remain compatible', async()=>{
 const clock={now:Date.now()};const h=edgeHarness({clock});
 h.add('SEND',{deliveryExpiry:new Date(clock.now+120000).toISOString()});
 h.add('SEND',{deliveryExpiry:new Date(clock.now+7200000).toISOString()});
 h.add('SEND',{legacy:true});
 await h.invoke();
 assert.deepEqual(h.calls.filter(c=>c.url.endsWith('/send')).map(c=>c.args[0].ttl).sort((a,b)=>a-b),[0,120,3600]);
 const targeted=edgeHarness({clock});targeted.add('SEND');
 const result=await (await targeted.invoke({action:'single_target',admissionId:randomUUID()})).json();
 assert.equal(result.kind,'SINGLE_TARGET_COMPLETED');
 assert.equal(targeted.calls.find(c=>c.url.endsWith('/send')).args[0].ttl,0);
 assert.equal(targeted.calls.some(c=>c.url.endsWith('/rpc_claim_push_transport')),false);
 assert.deepEqual(targeted.observations,[]);
});

test('expired begin receipt is finalized without a provider request; suppression never sends',async()=>{
 const h=edgeHarness();h.add('SEND',{deliveryExpiry:new Date(Date.now()-10000).toISOString()});h.add('SEND',{suppressed:true});
 const result=await(await h.invoke()).json();assert.equal(result.processed.send,2);
 assert.equal(h.calls.some(c=>c.url.startsWith('https://exp.host')),false);
 assert.equal(h.completed.length,1);assert.equal(h.completed[0].p_result,'FATAL');
});

test('WAIT resumes bounded work without being reported as an empty queue',async()=>{
 const h=edgeHarness({waits:2,setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===100?1:ms,...args)});h.add('SEND');h.add('RECEIPT');
 const result=await(await h.invoke()).json();assert.deepEqual(result.processed,{send:1,receipt:1});
 assert.equal(h.calls.filter(c=>c.url.endsWith('/rpc_claim_push_transport')).length>=4,true);
});

test('provider timeouts record UNKNOWN once while the independent receipt lane progresses',async()=>{
 const h=edgeHarness({setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===5000?5:ms,...args),provider:async(call,{isSend,json})=>
  isSend ? new Promise(()=>{}) : json({data:{[call.args.ids[0]]:{status:'ok'}}})});
 for(let i=0;i<10;i++){h.add('SEND');h.add('RECEIPT');}
 const r=await h.invoke(),result=await r.json();assert.equal(r.status,200);
 assert.equal(result.processed.send,4);assert.equal(result.processed.receipt,10);
 assert.equal(h.completed.filter(c=>c.p_result==='UNKNOWN').length,4);
 assert.deepEqual(h.observations,['TICK_DEGRADED']);assert.equal(h.queues.SEND.length,6);
 assert.equal(h.calls.filter(c=>c.url.endsWith('/send')).length,4,'no blind resend of ambiguous acceptance');
});

test('HTTP throttle, invalid token and missing receipt map to existing bounded SQL outcomes',async()=>{
 for(const scenario of [
  {status:429,expect:'RETRYABLE'},
  {status:500,expect:'UNKNOWN'},
  {status:400,expect:'FATAL'},
  {ticket:{status:'error',details:{error:'DeviceNotRegistered'}},expect:'DEVICE_NOT_REGISTERED'},
  {ticket:{status:'error',details:{error:'MessageTooBig'}},expect:'FATAL'},
 ]){
  const h=edgeHarness({provider:async(call,{isSend,json})=>isSend ? scenario.status ? json({},scenario.status) : json({data:[scenario.ticket]}) : json({data:{}})});
  h.add('SEND');h.add('RECEIPT');await h.invoke();
  assert.equal(h.completed.find(c=>c.p_result!=='RECEIPT_PENDING').p_result,scenario.expect);
  assert.equal(h.completed.filter(c=>c.p_result==='RECEIPT_PENDING').length,1);
 }
});

test('claim window stops new work while accepted claims settle, and missing metrics never resends',async()=>{
 const clock={now:Date.now()};let advance=true;
 const h=edgeHarness({clock,onClaim:()=>{if(advance){clock.now+=31000;advance=false;}},rpc:async(name,args,fallback)=>{
  if(name==='rpc_get_push_transport_metrics')throw new Error('not deployed yet');return fallback(name,args);
 }});
 for(let i=0;i<20;i++){h.add('SEND');h.add('RECEIPT');}
 const result=await(await h.invoke()).json();assert.equal(result.processed.send+result.processed.receipt,1);
 assert.equal(h.completed.length,1);assert.equal(result.queue,null);
});

test('cancellation forbids late settlement and service authentication still fails before I/O',async()=>{
 const controller=new AbortController();let entered;
 const gate=new Promise(resolve=>{entered=resolve;});
 const h=edgeHarness({provider:async()=>{entered();return new Promise(()=>{});}});h.add('SEND');
 const request=h.invoke(undefined,{signal:controller.signal});await gate;controller.abort();
 assert.equal((await request).status,504);assert.equal(h.completed.length,0);
 const denied=edgeHarness();const response=await denied.invoke(undefined,{headers:{apikey:'sb_publishable_wrong'}});
 assert.equal(response.status,403);assert.equal(denied.calls.length,0);
 const disabled=edgeHarness({env:{EXPO_PUSH_TRANSPORT_ENABLED:'false'}});
 assert.deepEqual(await(await disabled.invoke()).json(),{kind:'DISABLED'});assert.equal(disabled.calls.length,0);
});

test('guarded real PostgreSQL queue changes preserve authorization, lifecycle and bounded retry',async t=>{
 const f=await sqlFixture();
 const clear=async()=>f.db.exec('truncate notification_push_attempts,notification_deliveries,user_activity_events,notification_preferences,notification_push_devices,auth.sessions,auth.users;');
 try{
  await t.test('preimage drift refuses atomically; candidate and rollback preserve old definitions and data',async()=>{
   const source=()=>f.query("select proname,md5(prosrc) hash,proacl::text acl from pg_proc where oid in ('public.rpc_claim_push_transport(text)'::regprocedure,'public.rpc_begin_push_send(uuid,uuid)'::regprocedure,'public.rpc_complete_push_transport(uuid,uuid,text,text)'::regprocedure) order by proname");
   const original=await source();
   await f.db.exec('begin;grant execute on function public.rpc_begin_push_send(uuid,uuid) to anon;');
   await assert.rejects(f.db.exec(f.candidate),/R09_PUSH_SOURCE_OR_ACL_DRIFT/);await f.db.exec('rollback;');assert.deepEqual(await source(),original);
   await f.db.exec(f.candidate);assert.notDeepEqual(await source(),original);
   await f.db.exec(f.rollback);assert.deepEqual(await source(),original);
   await f.db.exec(f.candidate);
  });
  await t.test('all public transport/metrics RPCs remain service-only; no table access is granted',async()=>{
   for(const signature of ['public.rpc_claim_push_transport(text)','public.rpc_begin_push_send(uuid,uuid)','public.rpc_complete_push_transport(uuid,uuid,text,text)','public.rpc_get_push_transport_metrics()']){
    assert.equal(await f.value("select has_function_privilege('authenticated',$1,'execute') as value",[signature]),false);
    assert.equal(await f.value("select has_function_privilege('anon',$1,'execute') as value",[signature]),false);
    assert.equal(await f.value("select has_function_privilege('service_role',$1,'execute') as value",[signature]),true);
   }
   await f.db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
   await assert.rejects(f.claim('SEND'),/FORBIDDEN/);
   await assert.rejects(f.value('select public.rpc_get_push_transport_metrics() as value'),/FORBIDDEN/);
   await f.db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  });
  await t.test('priority advantage cannot starve older NORMAL and lease expiry bounds are unchanged',async()=>{
   await clear();const a=await f.recipient(),b=await f.recipient();const old=await f.delivery(a,{age:180});await f.delivery(b,{priority:'HIGH',age:10});
   const c=await f.claim('SEND');assert.equal(await f.value('select delivery_id as value from notification_push_attempts where id=$1',[c.attemptId]),old.id);
   const started=await f.begin(c);assert.equal(started.eventId,old.event);assert.ok(Date.parse(started.deliveryExpiresAt)>Date.now());
   assert.ok(Date.parse(started.deliveryExpiresAt)<=Date.now()+3600000);
   assert.deepEqual(await f.complete(c,'TICKET','fixture_ticket'),{attemptId:c.attemptId,state:'TICKET_PENDING'});
   assert.equal(await f.value('select delivered_at as value from notification_deliveries where id=$1',[old.id]),null,'ticket does not prove device delivery');
   await clear();const x=await f.recipient(),y=await f.recipient();await f.delivery(x,{age:20});const high=await f.delivery(y,{priority:'HIGH',age:0});
   const next=await f.claim('SEND');assert.equal(await f.value('select delivery_id as value from notification_push_attempts where id=$1',[next.attemptId]),high.id,'recent HIGH still gets priority');
  });
  await t.test('six leases stay the global ceiling; excess work is deferred, never dropped',async()=>{
   await clear();for(let i=0;i<7;i++)await f.delivery(await f.recipient());
   const leases=[];for(let i=0;i<6;i++)leases.push(await f.claim('SEND'));assert.ok(leases.every(a=>a.kind==='SEND'));
   assert.deepEqual(await f.claim('SEND'),{kind:'WAIT',retryAfterMs:250});
   assert.equal(await f.value('select count(*)::integer as value from notification_push_attempts where lease_until>clock_timestamp()'),6);
   await f.begin(leases[0]);await f.complete(leases[0],'FATAL');assert.equal((await f.claim('SEND')).kind,'SEND');
  });
  await t.test('recipient cap defers a busy person and lets another recipient progress',async()=>{
   await clear();const a=await f.recipient(),b=await f.recipient();for(let i=0;i<70;i++)await f.delivery(a,{age:100});const other=await f.delivery(b);
   // Keep a stable SQL clock interval by claiming/beginning/settling inside one
   // server call; no wall-clock sleeps or throughput assumptions in this proof.
   await f.db.exec(`do $$declare a jsonb;begin for i in 1..4 loop a:=public.rpc_claim_push_transport('SEND');perform public.rpc_begin_push_send((a->>'attemptId')::uuid,(a->>'leaseId')::uuid);perform public.rpc_complete_push_transport((a->>'attemptId')::uuid,(a->>'leaseId')::uuid,'FATAL',null);end loop;end$$;`);
   const c=await f.claim('SEND');assert.equal(c.kind,'SEND');assert.equal(await f.value('select delivery_id as value from notification_push_attempts where id=$1',[c.attemptId]),other.id);
   const paused=await f.claim('SEND');assert.equal(paused.kind,'WAIT');
   assert.equal(await f.value('select count(*)::integer as value from notification_deliveries where recipient_user_id=$1 and push_started_at is null',[a.user]),66);
  });
  await t.test('global recent-claim limit remains sixty and expired send leases never create a blind resend',async()=>{
   await clear();for(let i=0;i<60;i++)await f.delivery(await f.recipient());
   await f.db.exec(`insert into notification_push_attempts(delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,send_count,last_claimed_at)
    select d.id,p.id,1,'FATAL','FINAL',0,1,clock_timestamp() from notification_deliveries d join notification_push_devices p on p.user_id=d.recipient_user_id;
    update notification_deliveries set push_started_at=clock_timestamp(),state='SENT';`);
   await f.delivery(await f.recipient());assert.deepEqual(await f.claim('SEND'),{kind:'WAIT',retryAfterMs:1000});
   await clear();const actor=await f.recipient();await f.delivery(actor);
   const leased=await f.claim('SEND');
   await f.db.exec("update notification_push_attempts set lease_until=clock_timestamp()-interval '1 second';");
   const reclaimed=await f.claim('SEND');assert.equal(reclaimed.attemptId,leased.attemptId);assert.notEqual(reclaimed.leaseId,leased.leaseId);
   await f.begin(reclaimed);
   await f.db.exec("update notification_push_attempts set lease_until=clock_timestamp()-interval '1 second';");
   assert.deepEqual(await f.claim('SEND'),{kind:'NONE'});
   assert.equal(await f.value('select transport_state as value from notification_push_attempts where id=$1',[leased.attemptId]),'UNKNOWN');
   assert.equal(await f.value('select send_count as value from notification_push_attempts where id=$1',[leased.attemptId]),1);
  });
  await t.test('revoked sessions, disabled preference and expired delivery are suppressed before any send',async()=>{
   for(const why of ['session','preference','expiry']){
    await clear();const actor=await f.recipient();const d=await f.delivery(actor,{expiresIn:why==='expiry'?-1:120});
    if(why==='session')await f.db.query('delete from auth.sessions where id=$1',[actor.session]);
    if(why==='preference')await f.db.query("insert into notification_preferences(user_id,role_context,push_enabled) values($1,'WORKER',false)",[actor.user]);
    assert.deepEqual(await f.claim('SEND'),{kind:'NONE'});
    assert.equal(await f.value('select state as value from notification_deliveries where id=$1',[d.id]),'SUPPRESSED');
    assert.equal(await f.value('select count(*)::integer as value from notification_push_attempts'),0);
   }
  });
  await t.test('known retry stops at three, UNKNOWN never replays, stale token feedback cannot revoke a new revision',async()=>{
   await clear();const actor=await f.recipient();await f.delivery(actor,{expiresIn:120});
   for(let i=1;i<=3;i++){
    await f.db.exec("update notification_push_attempts set last_claimed_at=clock_timestamp()-interval '2 seconds',next_attempt_at=clock_timestamp()-interval '1 second' where transport_state='RETRYABLE';");
    const a=await f.claim('SEND');assert.equal(a.kind,'SEND');await f.begin(a);
    assert.equal((await f.complete(a,'RETRYABLE')).state,i<3?'RETRYABLE':'FINAL');
   }
   assert.deepEqual(await f.claim('SEND'),{kind:'NONE'});
   await clear();const who=await f.recipient();await f.delivery(who);const uncertain=await f.claim('SEND');await f.begin(uncertain);await f.complete(uncertain,'UNKNOWN');
   assert.deepEqual(await f.claim('SEND'),{kind:'NONE'});
   await f.delivery(who);const a=await f.claim('SEND');await f.begin(a);
   await f.db.query('update notification_push_devices set revision=revision+1,bound_revision=bound_revision+1 where id=$1',[who.device]);
   await f.complete(a,'DEVICE_NOT_REGISTERED');assert.equal(await f.value('select active as value from notification_push_devices where id=$1',[who.device]),true);
  });
  await t.test('receipt bookkeeping and telemetry distinguish provider acceptance from device delivery',async()=>{
   await clear();const actor=await f.recipient();const d=await f.delivery(actor,{age:120,expiresIn:300});
   const before=await f.value('select public.rpc_get_push_transport_metrics() as value');assert.equal(before.pendingDeliveries,1);assert.ok(before.oldestPendingDeliverySeconds>=120);
   const send=await f.claim('SEND');const b=await f.begin(send);assert.ok(Date.parse(b.deliveryExpiresAt)<=Date.now()+300000);
   await f.complete(send,'TICKET','accepted_fixture');await f.db.exec("update notification_push_attempts set next_attempt_at=clock_timestamp()-interval '2 seconds';");
   const receipt=await f.claim('RECEIPT');assert.equal(receipt.kind,'RECEIPT');assert.equal((await f.complete(receipt,'PROVIDER_ACCEPTED')).state,'PROVIDER_ACCEPTED');
   assert.equal(await f.value('select delivered_at as value from notification_deliveries where id=$1',[d.id]),null);
   const metrics=await f.value('select public.rpc_get_push_transport_metrics() as value');assert.equal(metrics.pendingDeliveries,0);assert.equal(metrics.receiptAttemptsDue,0);
   assert.equal(JSON.stringify(metrics).includes(actor.user),false);assert.equal(JSON.stringify(metrics).includes(d.event),false);
  });
 }finally{await f.db.close();}
});
