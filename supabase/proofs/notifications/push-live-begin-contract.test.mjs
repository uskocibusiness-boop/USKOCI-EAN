// Regression for live v34 vs current SQL begin receipt (18 Oct 2026).
// All account/device/token/lease values and network responses are synthetic.
// Optional USKOCI_PUSH_CONTRACT_SOURCE points only to captured local source:
// same assertions must FAIL on v34 and PASS on the canonical candidate.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadPushHandler} from './n09_push_transport_runtime.mjs';

const attempt='10000000-0000-4000-8000-000000000001';
const lease='10000000-0000-4000-8000-000000000002';
const event='10000000-0000-4000-8000-000000000003';
const token='ExpoPushToken[synthetic_contract]';
const key='synthetic-service-key';
const json=value=>new Response(JSON.stringify(value));

for(const eventType of ['EXECUTION_STATE_CHANGED','MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE']) {
 test('live SQL begin contract reaches one provider send: '+eventType,async()=>{
  const expires=new Date(Date.now()+90000).toISOString();
  const calls=[];
  let beginCount=0,providerCount=0,completeCount=0;
  const {handler}=loadPushHandler({
   sourcePath:process.env.USKOCI_PUSH_CONTRACT_SOURCE,
   env:name=>({
    SUPABASE_SERVICE_ROLE_KEY:key,
    SUPABASE_URL:'https://synthetic.supabase.co',
    EXPO_PUSH_TRANSPORT_ENABLED:'true',
    // Default metadata stays compatible with installed INBOX-only clients.
    EXPO_PUSH_MESSAGE_TARGET_ENABLED:'false',
    EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED:'false',
   })[name],
   fetch:async(url,init)=>{
    const body=JSON.parse(init.body);
    const name=new URL(url).pathname.split('/').at(-1);
    calls.push(name);
    if(name==='rpc_claim_push_transport') {
     if(body.p_kind==='RECEIPT') return json({kind:'NONE'});
     assert.equal(body.p_kind,'SEND');
     return json({kind:'SEND',attemptId:attempt,leaseId:lease,leaseExpiresAt:expires,ticketId:null});
    }
    if(name==='rpc_begin_push_send') {
     beginCount++;
     assert.deepEqual(body,{p_attempt_id:attempt,p_lease_id:lease});
     return json({
      kind:'SEND',attemptId:attempt,leaseId:lease,leaseExpiresAt:expires,
      expoPushToken:token,priority:'NORMAL',eventType,
      ...(['MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE'].includes(eventType)?{eventId:event}:{}),
     });
    }
    if(url==='https://exp.host/--/api/v2/push/send') {
     providerCount++;
     assert.equal(init.redirect,'error');
     assert.equal(body.length,1);
     assert.equal(body[0].to,token);
     assert.deepEqual(body[0].data,{kind:'INBOX'});
     return json({data:[{status:'ok',id:'synthetic_ticket'}]});
    }
    if(name==='rpc_complete_push_transport') {
     completeCount++;
     assert.deepEqual(body,{
      p_attempt_id:attempt,p_lease_id:lease,p_result:'TICKET',p_ticket_id:'synthetic_ticket',
     });
     return json({attemptId:attempt,state:'TICKET_PENDING'});
    }
    if(name==='rpc_record_push_readiness') return json({
     recorded:true,observation:body.p_observation,observedAt:new Date().toISOString(),authoritative:true,
    });
    assert.fail('UNEXPECTED_CONTRACT_IO');
   },
  });
  const response=await handler(new Request('https://worker.invalid',{
   method:'POST',headers:{apikey:key},body:JSON.stringify({action:'tick'}),
  }));
  const reply=await response.json();
  assert.equal(beginCount,1,'the server already granted the one-time SEND boundary');
  assert.equal(response.status,200,'SQL event fields must not strand an already-started attempt');
  assert.deepEqual(reply,{kind:'TICK_COMPLETED',receipt:'NONE',send:'TICKET_PENDING'});
  assert.equal(providerCount,1,'exactly one synthetic provider call');
  assert.equal(completeCount,1,'one ticket completion, never a retry');
  assert.deepEqual(calls,[
   'rpc_claim_push_transport','rpc_claim_push_transport','rpc_begin_push_send',
   'send','rpc_complete_push_transport','rpc_record_push_readiness',
  ]);
  assert.ok(!JSON.stringify(reply).includes(token));
  assert.ok(!JSON.stringify(reply).includes(event));
 });
}

