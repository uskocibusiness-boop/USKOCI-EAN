// Behavior-characterization tests, NOT evidence of live Gemini/Supabase E2E.
// Explicitly exposes the currently UNFIXED transient-provider-to-clarification gap.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildFullTreeTaxonomyProposals} from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';
import {processTaxonomyPostSaveTick} from '../../functions/_shared/taxonomyPostSaveWorker.mjs';

const nodeId='11111111-1111-4111-8111-111111111111';
const catalogRpc=async(name)=>{
 assert.equal(name,'rpc_taxonomy_fetch_snapshot_v1');
 return {ok:true,data:{catalogVersion:987654380,catalogFingerprint:'recovery-synthetic',
  categories:[{categoryId:nodeId,label:'Klimatizacija',path:['Klimatizacija'],
   modes:['ON_SITE'],aliases:[]}]}};
};

test('CURRENT GAP: simulated Gemini HTTP 503 becomes a clarification, not durable re-inference',async()=>{
 const originalFetch=globalThis.fetch;
 let attempts=0;
 globalThis.fetch=async()=>{attempts++;return new Response('temporary provider fault',{status:503});};
 try{
  const output=await buildFullTreeTaxonomyProposals({
   rpc:catalogRpc,geminiKey:'SYNTHETIC_KEY',geminiModel:'SYNTHETIC_MODEL',
   items:[{service:'klima',mode:'ON_SITE'}],scopeSummary:'Servis klima uredjaja',
   conversationId:'22222222-2222-4222-8222-222222222222',
   draftRevision:2,
  });
  assert.equal(attempts,1,'today there is exactly one provider attempt, not an automatic retry');
  assert.equal(output.proposals.length,0);
  assert.equal(output.clarifications.length,1,
    'temporary upstream failure currently presents as an ambiguity: known defect, not acceptance');
 }finally{globalThis.fetch=originalFetch;}
});

test('reviewed post-save worker is distinct from provider classification and preserves signed save',()=>{
 const source=readFileSync('supabase/functions/_shared/taxonomyPostSaveWorker.mjs','utf8');
 const edge=readFileSync('supabase/functions/uskoci-taxonomy-postsave-worker/index.ts','utf8');
 assert.match(source,/rpc_taxonomy_reconcile_reviewed_outbox_service/);
 assert.match(source,/rpc_taxonomy_claim_reviewed_batches_service/);
 assert.match(source,/rpc_taxonomy_commit_reviewed_batch_service/);
 assert.match(source,/rpc_taxonomy_finalize_reviewed_batch_service/);
 assert.doesNotMatch(edge,/generativelanguage.googleapis.com|generateGeminiToolConversation|classifyNovelServicesWithGemini/);
 assert.doesNotMatch(edge,/taxonomy_reconcile_pending_reviews_v1/);
});

test('post-save commit transport failure retains the exact request key for retry, never grants capabilities',async()=>{
 const requestKey='33333333-3333-4333-8333-333333333333';
 const owner='44444444-4444-4444-8444-444444444444';
 const review='55555555-5555-4555-8555-555555555555';
 const id='66666666-6666-4666-8666-666666666666';
 const lease='77777777-7777-4777-8777-777777777777';
 const plans=[{action:'REUSE_EXISTING',service:'Krecenje',mode:'ON_SITE',categoryId:nodeId,catalogVersion:11}];
 const calls=[];
 const rpc=async(name,args)=>{
  calls.push({name,args});
  if(name==='rpc_taxonomy_reconcile_reviewed_outbox_service')return 0;
  if(name==='rpc_taxonomy_claim_reviewed_batches_service')return [{
   id,ownerAccountId:owner,sourceReviewId:review,requestKey,purpose:'NEED_SERVICE',plans,leaseToken:lease,attempts:1
  }];
  if(name==='rpc_taxonomy_commit_reviewed_batch_service')
   throw Object.assign(Error('SYNTHETIC_TRANSPORT_FAILURE'),{retryable:true});
  if(name==='rpc_taxonomy_finalize_reviewed_batch_service'){
   assert.equal(args.p_error_code,'TEMPORARY_UNAVAILABLE');
   return {status:'RETRY',outboxId:id};
  }
  throw Error('UNEXPECTED_RPC');
 };
 const result=await processTaxonomyPostSaveTick(rpc);
 assert.equal(result.retry,1);
 assert.equal(result.admitted,0);
 assert.equal(result.capabilityAuthority,'NONE');
 assert.equal(result.notificationAuthority,'NONE');
 const commit=calls.find(c=>c.name==='rpc_taxonomy_commit_reviewed_batch_service');
 assert.equal(commit.args.p_request_key,requestKey);
 assert.equal(calls.at(-1).args.p_lease_token,lease);
});
