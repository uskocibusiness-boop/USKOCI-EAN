// Exact handler, real HTTP primitives, SYNTHETIC Auth/DB/Expo transports.
// No provider, physical device, live dispatch or DB attestation is performed.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {notificationPushCopy} from '../../functions/_shared/pushNotificationCopy.mjs';
const source=readFileSync(new URL('../../functions/uskoci-push-transport/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const id='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222';
const secret='synthetic-service-only',expoSecret='synthetic-expo-only',token='ExpoPushToken[synthetic_device]';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
function harness(options={}) {
 const calls=[],logs=[],envReads=[];let handler;
 // Both receipts describe one lease; tests must not create different timestamps
 // merely because their fixture construction crosses a millisecond boundary.
 const expires=options.expires??options.begin?.leaseExpiresAt??new Date(Date.now()+90000).toISOString();
 const claim={kind:'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:expires,ticketId:null};
 const begun={kind:'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:expires,expoPushToken:token,priority:'NORMAL',eventType:'MESSAGE_RECEIVED'};
 const fetch=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,init,body});
  if(String(url).includes('/rest/v1/rpc/')) {
   assert.equal(init.headers.Authorization,`Bearer ${secret}`);assert.equal(init.headers.apikey,secret);
   if(url.endsWith('rpc_record_push_readiness'))return json(options.health??{recorded:true,observation:body.p_observation,observedAt:new Date().toISOString(),authoritative:true});
   if(url.endsWith('rpc_claim_push_transport'))return json(options.claim??(body.p_kind==='RECEIPT'?(options.receipt?{...claim,kind:'RECEIPT',ticketId:'ticket_1'}:{kind:'NONE'}):options.receipt?{kind:'NONE'}:claim));
   if(url.endsWith('rpc_begin_push_send'))return json(options.begin??begun);
   if(url.endsWith('rpc_complete_push_transport')) {
    const states={TICKET:'TICKET_PENDING',PROVIDER_ACCEPTED:'PROVIDER_ACCEPTED',DEVICE_NOT_REGISTERED:'FINAL',RETRYABLE:options.receipt?'TICKET_PENDING':'RETRYABLE',RECEIPT_RATE_EXCEEDED:'RETRYABLE',FATAL:'FINAL',UNKNOWN:'UNKNOWN',RECEIPT_PENDING:'TICKET_PENDING'};
    return json(options.done??{attemptId:id,state:states[body.p_result]});
   }
   throw Error('Unexpected RPC');
  }
  assert.ok(['https://exp.host/--/api/v2/push/send','https://exp.host/--/api/v2/push/getReceipts'].includes(url));
  assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,`Bearer ${expoSecret}`);assert.equal(init.headers.apikey,undefined);
  if(options.provider)return options.provider(url,init);
  return json(options.receipt?{data:{ticket_1:{status:'ok'}}}:{data:[{status:'ok',id:'ticket_1'}]});
 };
 const env={SUPABASE_SERVICE_ROLE_KEY:secret,SUPABASE_URL:'https://synthetic.supabase.co',EXPO_PUSH_TRANSPORT_ENABLED:'true',EXPO_ACCESS_TOKEN:expoSecret,...options.env};
 const context=vm.createContext({exports:{},require:specifier=>{if(specifier==='../_shared/pushNotificationCopy.mjs')return{notificationPushCopy};throw Error('UNEXPECTED_REQUIRE');},Request,Response,URL,Headers,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,
  setTimeout:options.setTimeout??setTimeout,clearTimeout,fetch,console:{log:(...x)=>logs.push(x),warn:(...x)=>logs.push(x),error:(...x)=>logs.push(x)},
  Deno:{env:{get:k=>{envReads.push(k);return env[k];}},serve:h=>handler=h}});
 new vm.Script(compiled).runInContext(context);
 return {calls,logs,envReads,handler,async run(input={action:'tick'},headers={authorization:`Bearer ${secret}`}) {
  const response=await handler(new Request('https://worker.example.test',{method:'POST',headers,body:JSON.stringify(input)}));
  const body=await response.json();assert.deepEqual(logs,[]);assert.ok(!JSON.stringify(body).includes(token));assert.ok(!JSON.stringify(body).includes(secret));assert.ok(!JSON.stringify(body).includes(expoSecret));return {response,body};
 }};
}
const completion=h=>h.calls.find(x=>x.url.endsWith('rpc_complete_push_transport'))?.body;
const messageEvent='ABCDEF01-3333-4333-8333-333333333333';
const messageBegin=extra=>({kind:'SEND',attemptId:id,leaseId:lease,
 leaseExpiresAt:new Date(Date.now()+90000).toISOString(),expoPushToken:token,
 priority:'NORMAL',eventType:'MESSAGE_RECEIVED',eventId:messageEvent,...extra});

test('P4 enabled message transport adds only the opaque event identity to fixed public data',async()=>{
 const h=harness({begin:messageBegin(),env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:'true'}});const r=await h.run();
 assert.equal(r.response.status,200);assert.equal(r.body.send,'TICKET_PENDING');
 const send=h.calls.find(x=>x.url.endsWith('/push/send'));
 assert.deepEqual(send.body,[{to:token,title:'Nova poruka u Dogovoru',body:'Imaš novu poruku.',
  data:{kind:'INBOX',eventType:'MESSAGE_RECEIVED',eventId:messageEvent.toLowerCase()},
  channelId:'default',sound:'default',priority:'normal',ttl:0}]);
 assert.equal(completion(h).p_result,'TICKET');
 assert.ok(!JSON.stringify(r.body).includes(messageEvent.toLowerCase()));
});

test('P4 urgent transport priority cannot change message copy or attach more routing data',async()=>{
 const h=harness({begin:messageBegin({priority:'HIGH'}),env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:'true'}});assert.equal((await h.run()).response.status,200);
 const value=h.calls.find(x=>x.url.endsWith('/push/send')).body[0];
 assert.equal(value.priority,'high');assert.equal(value.title,'Nova poruka u Dogovoru');
 assert.deepEqual(value.data,{kind:'INBOX',eventType:'MESSAGE_RECEIVED',eventId:messageEvent.toLowerCase()});
});

for(const enabled of [undefined,'false','TRUE','1'])
 test(`P4 new receipt preserves legacy clients unless explicitly enabled: ${enabled}`,async()=>{
  const h=harness({begin:messageBegin(),env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:enabled}});
  assert.equal((await h.run()).response.status,200);
  assert.deepEqual(h.calls.find(x=>x.url.endsWith('/push/send')).body[0].data,{kind:'INBOX'});
 });

test('P4 enabled Edge remains compatible with an unchanged A1 begin receipt',async()=>{
 const h=harness({env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:'true'}});assert.equal((await h.run()).response.status,200);
 assert.deepEqual(h.calls.find(x=>x.url.endsWith('/push/send')).body[0].data,{kind:'INBOX'});
});

test('P4 event identity does not relax the exact lease expiration binding',async()=>{
 const h=harness({begin:messageBegin(),expires:new Date(Date.now()+120000).toISOString(),
  env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:'true'}});
 assert.equal((await h.run()).response.status,503);assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));
});

for(const eventId of [null,42,[],{},'', '../message', 'abc', messageEvent+'x'])
 test(`P4 rejects malformed event identity before provider: ${JSON.stringify(eventId)}`,async()=>{
  const h=harness({begin:messageBegin({eventId})});assert.equal((await h.run()).response.status,503);
  assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));assert.ok(!h.envReads.includes('EXPO_ACCESS_TOKEN'));
 });

test('current SQL opportunity receipt sends globally without exposing its event identifier',async()=>{
 const h=harness({begin:messageBegin({eventType:'OPPORTUNITY_AVAILABLE'}),
  env:{EXPO_PUSH_MESSAGE_TARGET_ENABLED:'true',EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED:'true'}});
 assert.equal((await h.run()).response.status,200);
 const sends=h.calls.filter(x=>x.url==='https://exp.host/--/api/v2/push/send');
 assert.equal(sends.length,1);
 assert.deepEqual(sends[0].body[0].data,{kind:'INBOX'});
});

for(const eventType of ['RESPONSE_RECEIVED','FUTURE_EVENT'])
 test(`P4 does not expose identifiers for ${eventType}`,async()=>{
  const h=harness({begin:messageBegin({eventType})});assert.equal((await h.run()).response.status,503);
  assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));
 });

for(const extra of [{messageId:id},{agreementId:id},{accountId:id},{url:'/dogovor/private'},
 {title:'PRIVATE'},{body:'PRIVATE'},{payload:{message_id:id}}])
 test(`P4 exact event receipt rejects extra private/routing data: ${Object.keys(extra)[0]}`,async()=>{
  const h=harness({begin:messageBegin(extra)});assert.equal((await h.run()).response.status,503);
  assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));
 });
test('service-only: client JWT and arbitrary token cannot claim/read secrets or send',async()=>{
 for(const authorization of ['Bearer client-jwt','Bearer service_role','',`Bearer ${secret}extra`]){const h=harness();const r=await h.run(undefined,{authorization});assert.equal(r.response.status,403);assert.equal(h.calls.length,0);assert.deepEqual(h.envReads,['SUPABASE_SERVICE_ROLE_KEY']);}
});
test('PKG-030: the server key on apikey is accepted, as the scheduled tick sends it; anything near it is refused',async()=>{
 const ok=harness({env:{EXPO_PUSH_TRANSPORT_ENABLED:'false'}});const r=await ok.run(undefined,{apikey:secret});assert.equal(r.response.status,200);assert.equal(r.body.kind,'DISABLED');assert.equal(ok.calls.length,0);
 for(const headers of [{apikey:`${secret}extra`},{apikey:secret.slice(0,-1)},{apikey:'client-publishable'},{apikey:'client-publishable',authorization:'Bearer client-jwt'},{'x-api-key':secret}]){const h=harness();const x=await h.run(undefined,headers);assert.equal(x.response.status,403);assert.equal(h.calls.length,0);}
});
test('disabled deployment consumes no work or provider secret',async()=>{const h=harness({env:{EXPO_PUSH_TRANSPORT_ENABLED:'false'}});assert.equal((await h.run()).body.kind,'DISABLED');assert.equal(h.calls.length,0);assert.ok(!h.envReads.includes('EXPO_ACCESS_TOKEN'));});
test('reject recipients, URL, payload and unexpected input before claim',async()=>{for(const input of [{action:'send'},{action:'tick',to:token},{action:'tick',url:'https://evil.test'},[]]){const h=harness();assert.equal((await h.run(input)).response.status,400);assert.equal(h.calls.length,0);}});
test('actual send revalidates exact lease then submits allowlisted privacy-safe event copy',async()=>{
 const h=harness();const r=await h.run();assert.equal(r.response.status,200);assert.equal(r.body.send,'TICKET_PENDING');
 const send=h.calls.find(x=>x.url.includes('exp.host'));assert.deepEqual(send.body,[{to:token,title:'Nova poruka u Dogovoru',body:'Imaš novu poruku.',data:{kind:'INBOX'},channelId:'default',sound:'default',priority:'normal',ttl:0}]);
 assert.deepEqual(h.calls.filter(x=>x.url.includes('/rpc/')).map(x=>x.url.split('/').pop()),['rpc_claim_push_transport','rpc_claim_push_transport','rpc_begin_push_send','rpc_complete_push_transport','rpc_record_push_readiness']);
 assert.deepEqual(completion(h),{p_attempt_id:id,p_lease_id:lease,p_result:'TICKET',p_ticket_id:'ticket_1'});
});
test('future constrained event type falls back to generic copy without failing transport',async()=>{
 const h=harness({begin:{kind:'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:new Date(Date.now()+90000).toISOString(),expoPushToken:token,priority:'NORMAL',eventType:'FUTURE_EVENT'}});
 const r=await h.run();assert.equal(r.response.status,200);const send=h.calls.find(x=>x.url.includes('exp.host'));
 assert.equal(send.body[0].title,'USKOČI');assert.equal(send.body[0].body,'Imaš novo obaveštenje. Otvori aplikaciju.');
});
test('begin receipt cannot smuggle raw title body or payload to the provider',async()=>{
 for(const extra of [{title:'PRIVATE'},{body:'PRIVATE'},{payload:{address:'PRIVATE'}}]){
  const h=harness({begin:{kind:'SEND',attemptId:id,leaseId:lease,leaseExpiresAt:new Date(Date.now()+90000).toISOString(),expoPushToken:token,priority:'NORMAL',eventType:'MESSAGE_RECEIVED',...extra}});
  assert.equal((await h.run()).response.status,503);assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));
 }
});
test('receipt accepted is provider acceptance, never physical delivery',async()=>{const h=harness({receipt:true});const r=await h.run();assert.equal(r.body.receipt,'PROVIDER_ACCEPTED');assert.deepEqual(h.calls.find(x=>x.url.includes('exp.host')).body,{ids:['ticket_1']});assert.equal(completion(h).p_result,'PROVIDER_ACCEPTED');assert.ok(!JSON.stringify(r.body).includes('DELIVERED'));});
test('missing receipt is polled without resending',async()=>{const h=harness({receipt:true,provider:()=>json({data:{}})});await h.run();assert.equal(completion(h).p_result,'RECEIPT_PENDING');assert.equal(h.calls.filter(x=>x.url.endsWith('/send')).length,0);});
for(const receipt of [false,true])for(const [error,result] of [['DeviceNotRegistered','DEVICE_NOT_REGISTERED'],['MessageRateExceeded','RETRYABLE'],['InvalidCredentials','FATAL'],['MismatchSenderId','FATAL'],['MessageTooBig','FATAL'],['newUnknownCode','UNKNOWN']])test(`${receipt?'receipt':'ticket'} ${error} is mapped without provider message leakage`,async()=>{
 const value={status:'error',message:`PRIVATE ${token} ${expoSecret}`,details:{error}};const h=harness({receipt,provider:()=>json({data:receipt?{ticket_1:value}:[value]})});await h.run();assert.equal(completion(h).p_result,receipt&&error==='MessageRateExceeded'?'RECEIPT_RATE_EXCEEDED':result);
});
test('HTTP429 reading a receipt polls the same ticket; it never authorizes a resend',async()=>{
 const h=harness({receipt:true,provider:()=>json({errors:[{code:'TOO_MANY_REQUESTS'}]},429)});const r=await h.run();assert.equal(completion(h).p_result,'RECEIPT_PENDING');assert.equal(r.body.receipt,'TICKET_PENDING');assert.equal(h.calls.filter(x=>x.url.endsWith('/send')).length,0);
});
test('receipt MessageRateExceeded may exhaust the same three-send bound',async()=>{
 const h=harness({receipt:true,provider:()=>json({data:{ticket_1:{status:'error',details:{error:'MessageRateExceeded'}}}}),done:{attemptId:id,state:'FINAL'}});const r=await h.run();assert.equal(completion(h).p_result,'RECEIPT_RATE_EXCEEDED');assert.equal(r.body.receipt,'FINAL');
});
for(const [status,result] of [[429,'RETRYABLE'],[400,'FATAL'],[401,'FATAL'],[500,'UNKNOWN'],[503,'UNKNOWN']])test(`send HTTP ${status}: ${result}, no automatic replay`,async()=>{const h=harness({provider:()=>json({message:expoSecret},status)});await h.run();assert.equal(completion(h).p_result,result);assert.equal(h.calls.filter(x=>x.url.includes('exp.host')).length,1);});
test('lost network/redirect result is UNKNOWN and never resent',async()=>{const h=harness({provider:()=>{throw Error(`redirect ${expoSecret}`);}});await h.run();assert.equal(completion(h).p_result,'UNKNOWN');assert.equal(h.calls.filter(x=>x.url.includes('exp.host')).length,1);});
for(const value of [{data:[]},{data:[{status:'ok',id:'ticket_1',private:'leak'}]},{data:[{status:'ok',id:'invalid/id'}]},{data:[{status:'ok',id:'ticket_1'}],errors:[]},null])test(`corrupt ticket payload is unknown: ${JSON.stringify(value)}`,async()=>{const h=harness({provider:()=>json(value)});await h.run();assert.equal(completion(h).p_result,'UNKNOWN');});
test('receipt cannot bind an unrequested ticket',async()=>{const h=harness({receipt:true,provider:()=>json({data:{other:{status:'ok'}}})});await h.run();assert.equal(completion(h).p_result,'RECEIPT_PENDING');});
test('overlarge provider body is bounded and does not persist raw data',async()=>{const h=harness({provider:()=>json({data:'x'.repeat(40000)})});await h.run();assert.equal(completion(h).p_result,'UNKNOWN');});
test('revoked or changed device at begin never reads Expo secret or sends',async()=>{const h=harness({begin:{kind:'SUPPRESSED'}});const r=await h.run();assert.equal(r.body.send,'SUPPRESSED');assert.ok(!h.envReads.includes('EXPO_ACCESS_TOKEN'));assert.equal(completion(h),undefined);});
test('mismatched begin identity closes before provider',async()=>{const h=harness({begin:{kind:'SEND',attemptId:lease,leaseId:lease,leaseExpiresAt:new Date(Date.now()+90000).toISOString(),expoPushToken:token,priority:'NORMAL'}});assert.equal((await h.run()).response.status,503);assert.ok(!h.calls.some(x=>x.url.includes('exp.host')));});
test('mismatched completion is not acknowledged',async()=>{const h=harness({done:{attemptId:lease,state:'TICKET_PENDING'}});assert.equal((await h.run()).response.status,503);});
test('fixed Supabase origin admits no user-controlled URL or HTTP target',async()=>{for(const url of ['http://synthetic.supabase.co','https://evil.test','https://synthetic.supabase.co/evil','https://user@synthetic.supabase.co']){const h=harness({env:{SUPABASE_URL:url}});assert.equal((await h.run()).response.status,503);assert.equal(h.calls.length,0);}});
test('one inflight invocation per isolate; cancellation forbids any late completion',async()=>{
 let release;const h=harness({provider:()=>new Promise(r=>release=r)});const c=new AbortController();const first=h.handler(new Request('https://worker.example.test',{method:'POST',headers:{authorization:`Bearer ${secret}`},body:'{"action":"tick"}',signal:c.signal}));
 for(let i=0;i<30&&!release;i++)await new Promise(r=>setTimeout(r,0));assert.ok(release);assert.equal((await h.run()).response.status,429);c.abort();release(json({data:[{status:'ok',id:'ticket_1'}]}));assert.equal((await first).status,504);assert.equal(completion(h),undefined);
});
test('deadline returns even when provider transport ignores cancellation; late result never writes',async()=>{
 let timeout,release;const h=harness({setTimeout:callback=>{timeout=callback;return 1;},provider:()=>new Promise(r=>release=r)});
 const first=h.run();for(let i=0;i<30&&!release;i++)await new Promise(r=>setTimeout(r,0));assert.ok(release);timeout();
 assert.equal((await first).response.status,504);assert.equal(completion(h),undefined);release(json({data:[{status:'ok',id:'late_ticket'}]}));await new Promise(r=>setTimeout(r,0));assert.equal(completion(h),undefined);
});

for(const enabled of ['true','false'])test(`service-only ${enabled} probe records config without claim/provider/key`,async()=>{
 const h=harness({env:{EXPO_PUSH_TRANSPORT_ENABLED:enabled}});const r=await h.run({action:'probe'});
 assert.deepEqual(r.body,{kind:'READINESS_RECORDED',enabled:enabled==='true'});
 assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.endsWith('rpc_record_push_readiness'));
 assert.equal(h.calls[0].body.p_observation,enabled==='true'?'PROBE_ENABLED':'PROBE_DISABLED');
 assert.ok(!h.envReads.includes('EXPO_ACCESS_TOKEN'));
});
test('unknown provider outcome records degraded transport, never a healthy tick',async()=>{
 const h=harness({provider:()=>{throw Error('SECRET');}});await h.run();
 assert.equal(h.calls.find(c=>c.url.endsWith('rpc_record_push_readiness')).body.p_observation,'TICK_DEGRADED');
});
test('a mismatched health receipt cannot produce successful readiness acknowledgement',async()=>{
 const h=harness({health:{recorded:true,observation:'TICK_OK',observedAt:new Date().toISOString(),authoritative:true}});
 assert.equal((await h.run({action:'probe'})).response.status,503);
 assert.ok(!h.calls.some(c=>c.url.includes('exp.host')));
});
