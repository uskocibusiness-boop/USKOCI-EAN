import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewClassificationBatch} from '../../functions/_shared/classificationBatch.mjs';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const catalog={catalogVersion:9,categories:[
 {id:ids[0],label:'Časovi umetničkog klizanja',modes:['ON_SITE']},
 {id:ids[1],label:'Iznajmljivanje klizaljki',modes:['ON_SITE']},
 {id:ids[2],label:'Oštrenje klizaljki',modes:['ON_SITE','REMOTE']}
]};
const entry=(service,id,opts={})=>({
 purpose:opts.purpose||'WORKER_CAPABILITY',
 service,mode:opts.mode===undefined?'ON_SITE':opts.mode,
 plan:{action:opts.action||'REUSE_EXISTING',reason:'Owner clearly identified this distinct service as provided.',
  categoryId:id,catalogVersion:opts.version===undefined?9:opts.version},
});
test('three skating meanings stay distinct in the same worker review batch',()=>{
 const b=reviewClassificationBatch([
 entry('Časovi umetničkog klizanja',ids[0]),
 entry('Iznajmljivanje klizaljki',ids[1]),
 entry('Oštrenje klizaljki',ids[2]),
 ],catalog);
 assert.deepEqual(b.items.map(x=>x.candidateCategoryId),ids);
 assert.equal(b.status,'CANDIDATES_ONLY');
 assert.equal(b.accepted,false);
 assert.equal(b.requiresOwnerReview,true);
 assert.equal(b.requiresAtomicBatch,true);
 assert.equal(b.notificationAuthority,'NONE');
});
test('two separate scripts describing the same ID never create two capabilities',()=>{
 const b=reviewClassificationBatch([
 entry('Časovi umetničkog klizanja',ids[0]),
 entry('Часови уметничког клизања',ids[0]),
 ],catalog);
 assert.equal(b.status,'DUPLICATE_SERVICE_OR_IDENTITY');
 assert.deepEqual(b.items.map(x=>x.status),['REUSE_CANDIDATE','DUPLICATE_SERVICE_OR_IDENTITY']);
});
test('same canonical service can have two EXPLICIT modes without implicit consent',()=>{
 const b=reviewClassificationBatch([
 entry('Oštrenje klizaljki',ids[2],{mode:'REMOTE'}),
 entry('Oštrenje klizaljki',ids[2],{mode:'ON_SITE'}),
 ],catalog);
 assert.equal(b.status,'CANDIDATES_ONLY');
 assert.deepEqual(b.items.map(x=>x.status),['REUSE_CANDIDATE','REUSE_CANDIDATE']);
 assert.equal(b.capabilityAuthority,'NONE');
});
test('unknown mode cannot activate either service mode',()=>{
 const b=reviewClassificationBatch([entry('Oštrenje klizaljki',ids[2],{mode:null})],catalog);
 assert.equal(b.status,'REVIEW_REQUIRED');
 assert.equal(b.items[0].status,'MODE_CONFIRMATION_REQUIRED');
});
test('same reviewed service and mode cannot be repeated',()=>{
 const b=reviewClassificationBatch([entry('Oštrenje klizaljki',ids[2]),entry('Oštrenje  klizaljki ',ids[2])],catalog);
 assert.equal(b.status,'DUPLICATE_SERVICE_OR_IDENTITY');
});
test('any stale plan makes the entire reviewed envelope stale',()=>{
 const b=reviewClassificationBatch([
 entry('Časovi umetničkog klizanja',ids[0]),
 entry('Iznajmljivanje klizaljki',ids[1],{version:8}),
 ],catalog);
 assert.equal(b.status,'STALE_CATALOG');
 assert.deepEqual(b.items.map(x=>x.status),['REUSE_CANDIDATE','STALE_CATALOG']);
});
test('AI-only alias cannot grant capability even if it has existing target ID',()=>{
 const b=reviewClassificationBatch([
 entry('Privatni časovi klizanja',ids[0],{action:'REUSE_ALIAS'}),
 ],catalog);
 assert.equal(b.status,'REVIEW_REQUIRED');
 assert.equal(b.items[0].status,'ALIAS_EVIDENCE_REQUIRED');
});
test('novel category and branch require separate owner/operator admission',()=>{
 const e=entry('Dresiranje egzotičnih ptica',undefined,{action:'CREATE_CHILD'});
 e.plan.parentId=ids[0];e.plan.proposedPath=['Dresiranje egzotičnih ptica'];
 const b=reviewClassificationBatch([e],catalog);
 assert.equal(b.status,'REVIEW_REQUIRED');
 assert.equal(b.items[0].status,'ADMISSION_REVIEW_REQUIRED');
});
test('no model proposal may confer unsupported on-site/remote capabilities',()=>{
 const b=reviewClassificationBatch([
 entry('Časovi umetničkog klizanja',ids[0],{mode:'REMOTE'})
 ],catalog);
 assert.equal(b.status,'REVIEW_REQUIRED');
 assert.equal(b.items[0].status,'MODE_NOT_SUPPORTED');
});
test('same service identity across separate worker and task reviews is stable',()=>{
 const w=reviewClassificationBatch([entry('Časovi umetničkog klizanja',ids[0])],catalog);
 const n=reviewClassificationBatch([entry('Časovi umetničkog klizanja',ids[0],{purpose:'NEED_SERVICE'})],catalog);
 assert.equal(w.items[0].candidateCategoryId,n.items[0].candidateCategoryId);
 assert.equal(w.accepted,false);assert.equal(n.accepted,false);
});
test('bounded review batch is not a fixed ceiling for the taxonomy',()=>{
 const hundred=Array.from({length:100},(_,i)=>entry('Usluga '+i,ids[i%3]));
 const b=reviewClassificationBatch(hundred,catalog);
 assert.equal(b.items.length,100);
 assert.equal(reviewClassificationBatch([...hundred,hundred[0]],catalog).status,'INVALID_OR_OVERSIZE_BATCH');
 assert.equal(reviewClassificationBatch([],catalog).status,'INVALID_OR_OVERSIZE_BATCH');
});
test('invalid items are isolated and cannot turn an unreviewed batch into a commit',()=>{
 const b=reviewClassificationBatch([entry('Iznajmljivanje klizaljki',ids[1]),{
  purpose:'NEED_SERVICE',service:'',mode:'ON_SITE',plan:{action:'REUSE_EXISTING'}
 }],catalog);
 assert.equal(b.status,'REVIEW_REQUIRED');
 assert.equal(b.items[1].status,'INVALID_ITEM');
 assert.equal(b.commitAuthority,'NONE');
});
