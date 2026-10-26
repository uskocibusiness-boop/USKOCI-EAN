// Deterministic safety/diagnostic observations of the CURRENT runtime.
// Synthetic catalog/provider/RPC only. Not an authenticated or paid Gemini E2E acceptance test.
// Current fallback findings are OBSERVATIONS, not a desired long-term recovery contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';
import { processTaxonomyPostSaveTick } from '../../functions/_shared/taxonomyPostSaveWorker.mjs';

const parentId='11111111-1111-4111-8111-111111111111';
const novel='specijalna izrada keramičkih mozaika';
const catalogVersion=901026001;
const snapshot=(version=catalogVersion)=>({
  catalogVersion:version,catalogFingerprint:`synthetic-only-${version}`,
  categories:[{categoryId:parentId,label:'Keramički radovi',aliases:[],
    modes:['ON_SITE'],path:['Keramički radovi'],isLeaf:true}],
});
const rpcFor=version=>async (name)=>{
  assert.equal(name,'rpc_taxonomy_fetch_snapshot_v1');
  return {ok:true,data:snapshot(version)};
};
const classify=(rpc=rpcFor(catalogVersion),service=novel)=>buildFullTreeTaxonomyProposals({
  rpc,geminiKey:'SYNTHETIC_KEY',geminiModel:'synthetic-model',
  items:[{service,mode:'ON_SITE'}],scopeSummary:'Jedan probni posao bez privatnih podataka',
  conversationId:'22222222-2222-4222-8222-222222222222',draftRevision:3,
});
async function withProviderStub(fakeFetch,work){
  const old=globalThis.fetch;
  globalThis.fetch=fakeFetch;
  try{return await work();}finally{globalThis.fetch=old;}
}

test('current second-Gemini 503 fallback never invents a category (diagnostic only)',async()=>{
  let calls=0;
  await withProviderStub(async()=>{calls++;return new Response('unavailable',{status:503});},async()=>{
    const out=await classify(rpcFor(901026002));
    assert.equal(calls,1,'current code does not retry this paid classifier call');
    assert.equal(out.proposals.length,0,'temporary provider failure must not create a category');
    assert.equal(out.clarifications.length,1,
      'CURRENT OBSERVATION: HTTP 503 is treated as a user clarification, not a technical-retry state');
    assert.equal(out.clarifications[0].action,'NEEDS_CLARIFICATION');
  });
});

test('current malformed Gemini JSON also becomes user clarification (diagnostic only)',async()=>{
  let calls=0;
  await withProviderStub(async()=>{
    calls++;
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{bad-json'}]}}]}),
      {status:200,headers:{'Content-Type':'application/json'}});
  },async()=>{
    const out=await classify(rpcFor(901026003));
    assert.equal(calls,1);
    assert.equal(out.proposals.length,0);
    assert.equal(out.clarifications.length,1,
      'CURRENT OBSERVATION: parse failure not distinguishable from semantic ambiguity');
  });
});

test('post-save worker performs bounded signed catalog reconciliation; it does not call Gemini',async()=>{
  const calls=[];
  const rpc=async(name,args)=>{
    calls.push({name,args});
    if(name==='rpc_taxonomy_reconcile_reviewed_outbox_service')return 0;
    if(name==='rpc_taxonomy_claim_reviewed_batches_service')return [];
    assert.fail('UNEXPECTED_RPC_'+name);
  };
  const result=await processTaxonomyPostSaveTick(rpc,{limit:3,reconcileLimit:25});
  assert.deepEqual(calls.map(x=>x.name),[
    'rpc_taxonomy_reconcile_reviewed_outbox_service',
    'rpc_taxonomy_claim_reviewed_batches_service',
  ]);
  assert.equal(result.claimed,0);
  assert.equal(result.admitted,0);
  assert.equal(result.notificationAuthority,'NONE');
});

test('transient failure receives RETRY receipt without inventing new owner permission',async()=>{
  const job={
    id:'33333333-3333-4333-8333-333333333333',
    ownerAccountId:'44444444-4444-4444-8444-444444444444',
    requestKey:'55555555-5555-4555-8555-555555555555',
    sourceReviewId:'66666666-6666-4666-8666-666666666666',
    purpose:'NEED_SERVICE',plans:[{action:'REUSE_EXISTING'}],
    leaseToken:'77777777-7777-4777-8777-777777777777',attempts:1,
  };
  const calls=[];
  const rpc=async(name,args)=>{
    calls.push({name,args});
    if(name==='rpc_taxonomy_reconcile_reviewed_outbox_service')return 0;
    if(name==='rpc_taxonomy_claim_reviewed_batches_service')return [job];
    if(name==='rpc_taxonomy_commit_reviewed_batch_service'){
      const err=new Error('synthetic request timeout');err.retryable=true;throw err;
    }
    if(name==='rpc_taxonomy_finalize_reviewed_batch_service'){
      assert.equal(args.p_error_code,'TEMPORARY_UNAVAILABLE');
      return {outboxId:job.id,status:'RETRY'};
    }
    assert.fail('UNEXPECTED_RPC_'+name);
  };
  const result=await processTaxonomyPostSaveTick(rpc,{limit:3,reconcileLimit:25});
  assert.equal(result.retry,1);
  assert.equal(result.admitted,0);
  assert.equal(result.notificationAuthority,'NONE');
  assert.equal(calls.filter(x=>x.name==='rpc_taxonomy_commit_reviewed_batch_service').length,1,
    'retry happens on a later lease, not as an uncontrolled immediate second call');
});
