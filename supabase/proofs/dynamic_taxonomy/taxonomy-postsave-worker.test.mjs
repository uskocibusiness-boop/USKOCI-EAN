import test from 'node:test';
import assert from 'node:assert/strict';
import { processTaxonomyPostSaveTick, TaxonomyWorkerProtocolError } from '../../functions/_shared/taxonomyPostSaveWorker.mjs';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id='10000000-0000-4000-8000-000000000001';
const review='20000000-0000-4000-8000-000000000001';
const request='30000000-0000-4000-8000-000000000001';
const lease='40000000-0000-4000-8000-000000000001';
const category='50000000-0000-4000-8000-000000000001';
const plans=[{action:'REUSE_EXISTING',service:'Krečenje zidova',mode:'ON_SITE',categoryId:category,catalogVersion:3,reason:'Previously reviewed real painting service'}];
const job={id,ownerAccountId:owner,requestKey:request,sourceReviewId:review,
 purpose:'WORKER_CAPABILITY',plans,leaseToken:lease,attempts:1};
const receipt={status:'COMMITTED',items:[{service:'Krečenje zidova',mode:'ON_SITE',categoryId:category}],
 createdCount:0,catalogVersion:3,capabilityAuthority:'NONE',needRevisionAuthority:'NONE',
 notificationAuthority:'NONE',requiresBinding:true};
const finish={status:'COMMITTED',outboxId:id};
function setup({claim=[job],reply=receipt,settle=finish,reconciled=0,commitError=null,settleError=null}={}){
 const calls=[];
 const rpc=async(name,args)=>{
  calls.push({name,args});
  switch(name){
   case 'rpc_taxonomy_reconcile_reviewed_outbox_service':return reconciled;
   case 'rpc_taxonomy_claim_reviewed_batches_service':return claim;
   case 'rpc_taxonomy_commit_reviewed_batch_service':
    if(commitError)throw commitError;
    return reply;
   case 'rpc_taxonomy_finalize_reviewed_batch_service':
    if(settleError)throw settleError;
    return typeof settle==='function'?settle(args):settle;
   default:throw Error('Unexpected RPC');
  }
 };
 return {rpc,calls};
}
test('one real reviewed batch: catalog commit and receipt-fenced settlement, no matching rights',async()=>{
 const {rpc,calls}=setup({reconciled:2});
 const out=await processTaxonomyPostSaveTick(rpc);
 assert.deepEqual(out,{kind:'CATALOG_ONLY_TICK',reconciled:2,claimed:1,admitted:1,
  reviewRequired:0,retry:0,capabilityAuthority:'NONE',needRevisionAuthority:'NONE',notificationAuthority:'NONE'});
 assert.deepEqual(calls.map(x=>x.name),[
  'rpc_taxonomy_reconcile_reviewed_outbox_service',
  'rpc_taxonomy_claim_reviewed_batches_service',
  'rpc_taxonomy_commit_reviewed_batch_service',
  'rpc_taxonomy_finalize_reviewed_batch_service']);
 assert.deepEqual(calls[2].args,{p_owner_account_id:owner,p_request_key:request,
  p_purpose:'WORKER_CAPABILITY',p_source_review_id:review,p_plans:plans});
 assert.deepEqual(calls[3].args,{p_outbox_id:id,p_lease_token:lease,p_error_code:null});
});
test('empty queue is success and never creates a category',async()=>{
 const {rpc,calls}=setup({claim:[]});
 const result=await processTaxonomyPostSaveTick(rpc);
 assert.equal(result.claimed,0);assert.equal(calls.length,2);
});
test('untrusted/ill-formed claim is refused before any commit',async()=>{
 const {rpc,calls}=setup({claim:[{...job,ownerAccountId:'not-a-uuid'}]});
 await assert.rejects(processTaxonomyPostSaveTick(rpc),TaxonomyWorkerProtocolError);
 assert.equal(calls.length,2);
});
test('a semantic error becomes review-required without hiding the saved profile',async()=>{
 const failure=Error('BATCH_SEMANTIC_IDENTITY_MISMATCH');
 const {rpc,calls}=setup({commitError:failure,
  settle:args=>({status:args.p_error_code==='BATCH_REVIEW_REQUIRED'?'REVIEW_REQUIRED':'INVALID',outboxId:id})});
 const result=await processTaxonomyPostSaveTick(rpc);
 assert.equal(result.reviewRequired,1);assert.equal(result.admitted,0);
 assert.equal(calls[3].args.p_error_code,'BATCH_REVIEW_REQUIRED');
});
test('uncertain network commit reply is retried with same idempotency request key',async()=>{
 const unavailable=Object.assign(Error('network'),{retryable:true});
 const {rpc,calls}=setup({commitError:unavailable,
  settle:args=>({status:args.p_error_code==='TEMPORARY_UNAVAILABLE'?'RETRY':'INVALID',outboxId:id})});
 const result=await processTaxonomyPostSaveTick(rpc);
 assert.equal(result.retry,1);assert.equal(calls[2].args.p_request_key,request);
 assert.equal(calls[3].args.p_error_code,'TEMPORARY_UNAVAILABLE');
});
test('a receipt suggesting worker or push authority is quarantined for retry',async()=>{
 const {rpc,calls}=setup({reply:{...receipt,notificationAuthority:'GRANTED'},
  settle:args=>({status:args.p_error_code==='TEMPORARY_UNAVAILABLE'?'RETRY':'INVALID',outboxId:id})});
 const result=await processTaxonomyPostSaveTick(rpc);
 assert.equal(result.retry,1);assert.equal(calls[3].args.p_error_code,'TEMPORARY_UNAVAILABLE');
});
test('unknown lease finalization response cannot be reported as success',async()=>{
 const {rpc}=setup({settle:{status:'COMMITTED',outboxId:owner}});
 await assert.rejects(processTaxonomyPostSaveTick(rpc),TaxonomyWorkerProtocolError);
});
test('claim and reconcile bounds fail closed without processing',async()=>{
 for(const bad of [{claim:[job,job,job,job]}, {reconciled:51}, {claim:'not a list'}]){
  const {rpc}=setup(bad);
  await assert.rejects(processTaxonomyPostSaveTick(rpc),TaxonomyWorkerProtocolError);
 }
});
