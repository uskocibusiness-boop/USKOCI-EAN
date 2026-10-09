import test, {describe} from 'node:test';
import assert from 'node:assert/strict';
import {loadCandidate} from './candidate-runtime.mjs';
import {loadPushHandler} from '../notifications/n09_push_transport_runtime.mjs';
for (const [name, loadHandler] of [['frozen candidate', loadCandidate], ['canonical handler', loadPushHandler]]) {
describe(name, () => {
const id='11111111-1111-4111-8111-111111111111', lease='22222222-2222-4222-8222-222222222222';
const key='synthetic-service-key';
const response=x=>new Response(JSON.stringify(x));
const request=(action='single_target',extra={},auth=key)=>new Request('https://worker.invalid',{method:'POST',headers:{apikey:auth},body:JSON.stringify({action,admissionId:id,...extra})});
function runtime({enabled=false,receipt=false,none=false,providerStatus=200,exact=false,eventId}={}) {
 const calls=[],reads=[],expiry=new Date(Date.now()+60000).toISOString();
 const env=k=>{reads.push(k);return {SUPABASE_SERVICE_ROLE_KEY:key,SUPABASE_URL:'https://proof.supabase.co',EXPO_PUSH_SINGLE_TARGET_ENABLED:enabled?'true':'false',EXPO_PUSH_TRANSPORT_ENABLED:'false',EXPO_PUSH_MESSAGE_TARGET_ENABLED:exact?'true':'false'}[k];};
 const {handler}=loadHandler({env,fetch:async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body});
  if(url==='https://exp.host/--/api/v2/push/send')return providerStatus===200?response({data:[{status:'ok',id:'synthetic_ticket'}]}):new Response('',{status:providerStatus});
  if(url==='https://exp.host/--/api/v2/push/getReceipts')return response({data:{synthetic_ticket:{status:'ok'}}});
  const name=new URL(url).pathname.split('/').at(-1);
  if(name===(receipt?'rpc_claim_push_single_target_receipt':'rpc_claim_push_single_target')){assert.deepEqual(body,{p_admission_id:id});return response(none?{kind:'NONE'}:{kind:receipt?'RECEIPT':'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:expiry,ticketId:receipt?'synthetic_ticket':null});}
  if(name==='rpc_begin_push_send')return response({kind:'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:expiry,expoPushToken:'ExpoPushToken[synthetic]',priority:'NORMAL',eventType:'MESSAGE_RECEIVED',...(eventId===undefined?{}:{eventId})});
  if(name==='rpc_complete_push_transport')return response({attemptId:id,state:body.p_result==='TICKET'?'TICKET_PENDING':body.p_result==='PROVIDER_ACCEPTED'?'PROVIDER_ACCEPTED':body.p_result==='RETRYABLE'?'FINAL':'UNKNOWN'});
  assert.fail('UNEXPECTED_IO_PATH');
 }});return {handler,calls,reads};
}
test('default-off both target actions perform zero DB/provider IO and never read provider credential',async()=>{
 for(const action of ['single_target','single_target_receipt'])for(const exact of [false,true]){const r=runtime({exact,eventId:id});assert.deepEqual(await(await r.handler(request(action))).json(),{kind:'DISABLED'});assert.equal(r.calls.length,0);assert.ok(!r.reads.includes('EXPO_ACCESS_TOKEN'));}
});
test('caller cannot supply recipient/payload or enter with non-service authority',async()=>{
 for(const [extra,auth,status] of [[{recipient:id},key,400],[{payload:'x'},key,400],[{},'not-service',403]]){const r=runtime({enabled:true});assert.equal((await r.handler(request('single_target',extra,auth))).status,status);assert.equal(r.calls.length,0);}
});
test('target SEND selects only one lane and never global scans or readiness writes',async()=>{
 const r=runtime({enabled:true});assert.deepEqual(await(await r.handler(request())).json(),{kind:'SINGLE_TARGET_COMPLETED',state:'TICKET_PENDING'});
 assert.deepEqual(r.calls.map(x=>new URL(x.url).pathname.split('/').at(-1)),['rpc_claim_push_single_target','rpc_begin_push_send','send','rpc_complete_push_transport']);
 assert.equal(r.calls[2].body.length,1);assert.deepEqual(r.calls[2].body[0].data,{kind:'INBOX'});
});
test('target RECEIPT never enters SEND lane',async()=>{
 const r=runtime({enabled:true,receipt:true});assert.equal((await(await r.handler(request('single_target_receipt'))).json()).state,'PROVIDER_ACCEPTED');
 assert.deepEqual(r.calls.map(x=>new URL(x.url).pathname.split('/').at(-1)),['rpc_claim_push_single_target_receipt','getReceipts','rpc_complete_push_transport']);
});
test('consumed/NONE claim produces no provider request',async()=>{const r=runtime({enabled:true,none:true});assert.equal((await(await r.handler(request())).json()).state,'NONE');assert.equal(r.calls.length,1);});
test('429 is completed once as FINAL by target SQL; Edge itself never retries',async()=>{const r=runtime({enabled:true,providerStatus:429});assert.equal((await(await r.handler(request())).json()).state,'FINAL');assert.equal(r.calls.filter(x=>x.url.includes('exp.host')).length,1);assert.equal(r.calls.at(-1).body.p_result,'RETRYABLE');});

test('single-target exact-message uses only the authorized opaque event, with global transport off',async()=>{
 const eventId='ABCDEF01-2345-4678-9ABC-0123456789AB',r=runtime({enabled:true,exact:true,eventId});
 assert.equal((await(await r.handler(request())).json()).state,'TICKET_PENDING');
 assert.deepEqual(r.calls.map(x=>new URL(x.url).pathname.split('/').at(-1)),['rpc_claim_push_single_target','rpc_begin_push_send','send','rpc_complete_push_transport']);
 const sends=r.calls.filter(x=>x.url==='https://exp.host/--/api/v2/push/send');assert.equal(sends.length,1);assert.equal(sends[0].body.length,1);
 assert.deepEqual(sends[0].body[0].data,{kind:'INBOX',eventType:'MESSAGE_RECEIVED',eventId:eventId.toLowerCase()});
});
test('exact-message flag off preserves legacy metadata even when begin provides an event',async()=>{
 const r=runtime({enabled:true,eventId:id});await r.handler(request());
 assert.deepEqual(r.calls[2].body[0].data,{kind:'INBOX'});
});
test('exact-message flag retains the explicitly supported legacy begin receipt',async()=>{
 const r=runtime({enabled:true,exact:true});await r.handler(request());
 assert.deepEqual(r.calls[2].body[0].data,{kind:'INBOX'});
});
test('malformed event identity fails before provider IO or completion, with no global fallback',async()=>{
 for(const eventId of [null,'not-an-event','https://example.invalid',{},id+' ']){
  const r=runtime({enabled:true,exact:true,eventId});assert.equal((await r.handler(request())).status,503);
  assert.deepEqual(r.calls.map(x=>new URL(x.url).pathname.split('/').at(-1)),['rpc_claim_push_single_target','rpc_begin_push_send']);
 }
});
});
}
