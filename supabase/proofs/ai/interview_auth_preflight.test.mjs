// Real current handlers, synthetic Auth only. No credentials, provider calls or DB writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const cases=[
 ['invalid credentials',()=>json({message:'PRIVATE_AUTH_BODY'},401),401,'AUTH_REQUIRED'],
 ['forbidden account',()=>json({message:'PRIVATE_AUTH_BODY'},403),401,'AUTH_REQUIRED'],
 ['upstream outage',()=>json({message:'PRIVATE_AUTH_BODY'},503),503,'AUTH_UNAVAILABLE'],
 ['rate limit',()=>json({message:'PRIVATE_AUTH_BODY'},429),503,'AUTH_UNAVAILABLE'],
 ['malformed identity',()=>json({id:'not-a-user-id'}),503,'AUTH_UNAVAILABLE'],
 ['network failure',()=>{throw new Error('PRIVATE_AUTH_BODY');},503,'AUTH_UNAVAILABLE'],
 ['timeout',()=>new Promise(()=>{}),503,'AUTH_UNAVAILABLE'],
];
for(const [name,load] of [['need',loadOwnedIntakeHandler],['worker',loadWorkerRecoveryHandler]]){
 for(const [label,reply,status,code] of cases)test(`${name}: ${label} stops before reservation and distinguishes authentication from availability`,async()=>{
  const calls=[];
  const {handler}=load({fetch:async url=>{
   calls.push(String(url));assert.equal(String(url),'https://db.invalid/auth/v1/user');return reply();
  },env:key=>({SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE'})[key],
  setTimeout:(fn,ms)=>setTimeout(fn,ms===5000?10:ms)});
  const r=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC','Content-Type':'application/json'},
   body:JSON.stringify({conversationId:id(1),clientRequestId:id(2),text:'SYNTHETIC_TEXT'})}));
  assert.equal(r.status,status);const body=await r.json();assert.equal(body.code,code);
  assert.ok(!JSON.stringify(body).includes('PRIVATE_AUTH_BODY'));assert.equal(calls.length,1);
 });
}
