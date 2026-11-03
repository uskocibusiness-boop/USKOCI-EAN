import test from 'node:test';
import assert from 'node:assert/strict';
import {runRejectedAccessProbes,project} from './probe.mjs';

test('six probes use only fixed DEV, no real token, no alternate target or provider request',async()=>{
 const calls=[];const result=await runRejectedAccessProbes(async(url,init)=>{
  calls.push({url,init});assert.ok(url.startsWith('https://'+project+'.supabase.co/functions/v1/'));
  assert.equal(init.redirect,'error');assert.equal(init.headers?.apikey,undefined);
  if(init.method==='OPTIONS')return new Response(url.endsWith('uskoci-ai-interview')?'ok':null,{status:url.endsWith('uskoci-ai-interview')?200:204});
  assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(),['clientRequestId','conversationId','text']);
  assert.ok(init.headers.Authorization===undefined||init.headers.Authorization==='Bearer uskoci-intentionally-invalid-token');
  return Response.json({code:'AUTH_REQUIRED'},{status:401});
 });
 assert.equal(calls.length,6);assert.equal(result.status,'REJECTED_ACCESS_PROBES_PASS');
 assert.equal(result.real_auth_flow_proven,false);assert.equal(result.functional_acceptance_proven,false);
});

test('gateway rejection with different provenance never becomes handler Auth proof',async()=>{
 const result=await runRejectedAccessProbes(async(url,init)=>init.method==='OPTIONS'
  ?new Response(url.endsWith('uskoci-ai-interview')?'ok':null,{status:url.endsWith('uskoci-ai-interview')?200:204})
  :Response.json({code:'INVALID_JWT'},{status:401}));
 assert.equal(result.status,'REJECTED_ACCESS_PROBES_FAIL');
 assert.equal(result.results.filter(r=>r.passed).length,2);
});

test('response cap and non-cooperative fetch are bounded and never expose response text',async()=>{
 await assert.rejects(runRejectedAccessProbes(async()=>new Response('x'.repeat(4097))),/PROBE_RESPONSE_TOO_LARGE/);
 const start=Date.now();await assert.rejects(runRejectedAccessProbes(()=>new Promise(()=>{}),{timeoutMs:20}),/PROBE_TIMEOUT/);
 assert.ok(Date.now()-start<1000);
});
