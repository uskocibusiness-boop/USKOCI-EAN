import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,run,MILOS,checkExistingModeExtension,checkWorkerHandoffClarification,checkPhysicalMapConfirmation} from './dev_taxonomy_fulltree_acceptance.mjs';

const env={USKOCI_QA_CASES:'need-pickup-execution,need-shipping-execution,need-digital-execution,need-impossible-execution,need-rare-execution,worker-shipping-execution,need-typewriter-shipping-execution',USKOCI_QA_MAX_ATTEMPTS:'8'};
test('budget correction acceptance reuses the owned conversation and does not authorize another service',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>assert.fail('DRY_RUN_NETWORK');
 try {const result=await run({USKOCI_QA_CASES:'need-budget-correction-execution',USKOCI_QA_MAX_ATTEMPTS:'2'},[]);
  assert.equal(result.result,'DRY_RUN_NO_IO');assert.equal(result.cases.length,1);
  assert.equal(result.cases[0].messages.length,2);assert.equal(result.maxProviderAttempts,8);
 }finally{globalThis.fetch=previous;}
});
test('execution QA is dry by default and accounts for every possible tool round',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>assert.fail('DRY_RUN_NETWORK');
 try{const result=await run(env,[]);assert.equal(result.result,'DRY_RUN_NO_IO');
  assert.equal(result.maxLogicalRequests,8);assert.equal(result.maxProviderAttempts,32);
  assert.equal(result.maxReservationMicrousd,8_000_000);assert.equal(result.cases.length,7);
  assert.equal(result.cases.reduce((n,c)=>n+c.messages.length,0),8);
 }finally{globalThis.fetch=previous;}
});
test('execution QA rejects an unbounded run, mixed fixtures and the real owner',()=>{
 assert.throws(()=>configuration({...env,USKOCI_QA_MAX_ATTEMPTS:'9'},[]),/EXECUTION_MAX_8/);
 assert.throws(()=>configuration({...env,USKOCI_QA_MAX_ATTEMPTS:'7'},[]),/CASE_BUDGET_EXCEEDED/);
 assert.throws(()=>configuration({...env,USKOCI_QA_CASES:'need-pickup-execution,need-existing'},[]),/EXECUTION_MAX_8/);
 assert.throws(()=>configuration({...env,USKOCI_QA_EXPECTED_ACCOUNT_ID:MILOS},['--execute']),/ISOLATED_EXPECTED_ACCOUNT/);
});

test('worker asks about unknown handoff without granting delivery from profile city or equating READY with completion',()=>{
 const review={classificationState:'READY',canAccept:true,classificationCandidates:[{mode:'REMOTE',action:'REUSE_EXISTING'}]};
 const reply={outcome:'OWNED_SUCCEEDED_READBACK',assistantTextSource:'OWNED_WORKER_SNAPSHOT',
  assistantText:'Kako predajete gotove figurice: šaljete ih ili nudite lično preuzimanje?',clientRequestId:'owned-turn'};
 const assessment=checkWorkerHandoffClarification(review,reply);
 assert.equal(assessment.classificationState,'READY');assert.equal(assessment.canAccept,true);
 assert.equal(assessment.handoffSpecified,false);assert.equal(assessment.questionMeaning,'HUMAN_REVIEW_REQUIRED');
 for(const handoff of [{required:false},{required:true,shippingCountries:['RS']},
  {required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}},null]) {
  assert.throws(()=>checkWorkerHandoffClarification({...review,classificationCandidates:[{...review.classificationCandidates[0],handoff}]},reply),/INVENTED_BEFORE_ANSWER/);
 }
 assert.throws(()=>checkWorkerHandoffClarification(review,{...reply,outcome:'ATTEMPTED_UNKNOWN_NO_RETRY'}),/NOT_CONFIRMED/);
 const unrelated=checkWorkerHandoffClarification(review,{...reply,assistantText:'Kada ste dostupni?'});
 assert.equal(unrelated.questionSignalDetected,false);assert.equal(unrelated.questionMeaning,'HUMAN_REVIEW_REQUIRED');
});

test('optional same-category mode extension remains a single dry logical request',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>assert.fail('DRY_RUN_NETWORK');
 try {
  const defaults=await run({},[]);
  assert.equal(defaults.cases.some(c=>c.expectedAction==='EXTEND_MODE'),false);
  const result=await run({USKOCI_QA_CASES:'need-typewriter-shipping-execution',USKOCI_QA_MAX_ATTEMPTS:'1'},[]);
  assert.equal(result.result,'DRY_RUN_NO_IO');assert.equal(result.cases.length,1);
  assert.equal(result.maxLogicalRequests,1);assert.equal(result.maxProviderAttempts,4);
  assert.equal(result.maxReservationMicrousd,1_000_000);
  const categoryId=result.cases[0].expectedCategoryId;
  const good={classificationState:'READY',canAccept:true,location:{geography:{mode:'REMOTE'}},
   classificationCandidates:[{action:'EXTEND_MODE',categoryId,mode:'REMOTE',handoff:{required:true,shippingCountries:['RS']}}]};
  assert.doesNotThrow(()=>checkExistingModeExtension(good,categoryId));
  for(const change of [
   r=>{r.classificationCandidates[0].action='CREATE_NEW_BRANCH';},
   r=>{r.classificationCandidates[0].action='REUSE_EXISTING';},
   r=>{r.classificationCandidates[0].categoryId='11111111-1111-4111-8111-111111111111';},
   r=>{r.classificationCandidates.push({...r.classificationCandidates[0]});},
   r=>{r.classificationCandidates[0].handoff.shippingCountries.push('DE');},
   r=>{r.classificationCandidates[0].handoff.localExchange={city:'Novi Sad',countryCode:'RS'};},
   r=>{r.canAccept=false;},
  ]){const bad=structuredClone(good);change(bad);assert.throws(()=>checkExistingModeExtension(bad,categoryId),/MODE_EXTENSION_/);}
 }finally{globalThis.fetch=previous;}
});

const physicalReview = (mode = 'STATIONARY', canAccept = true) => {
 const geography = mode === 'POINT_TO_POINT'
  ? {mode,start:{city:'Novi Sad',label:'SYNTHETIC_START'},end:{city:'Novi Sad',label:'SYNTHETIC_END'}}
  : {mode,start:{city:'Novi Sad',label:'SYNTHETIC_PLACE'}};
 return {canAccept,classificationState:'READY',classificationCandidates:[{mode:'ON_SITE',action:'REUSE_EXISTING'}],
  publicProjection:[{key:'need.task_geography',value:geography}],ownerPrivateProjection:[],
  location:{taskCountryCode:'RS',geography,exactAddress:'SYNTHETIC_ADDRESS',accessNotes:null,resolvedLocation:null}};
};

test('physical conversation accepts a prepared description for DRAFT without mistaking canAccept for human pin confirmation',()=>{
 for(const mode of ['STATIONARY','POINT_TO_POINT']) {
  for(const canAccept of [true,false]) assert.doesNotThrow(()=>checkPhysicalMapConfirmation(physicalReview(mode,canAccept),mode));
  const incomplete=physicalReview(mode,false);incomplete.location=null;
  assert.doesNotThrow(()=>checkPhysicalMapConfirmation(incomplete,mode));
 }
});

test('physical conversation rejects complete, partial or malformed resolved pins in either location or a projection',()=>{
 const pin={slot:'start',latitudeE6:45000000,longitudeE6:19000000,origin:{kind:'MANUAL_PIN'}};
 for(const resolvedLocation of [{version:1,points:[pin]}, {version:1,points:[]}, {}]) {
  const review=physicalReview('POINT_TO_POINT');review.location.resolvedLocation=resolvedLocation;
  assert.throws(()=>checkPhysicalMapConfirmation(review,'POINT_TO_POINT'),/AI_CONFIRMED_MAP_WITHOUT_HUMAN/);
 }
 for(const projection of ['publicProjection','ownerPrivateProjection']) {
  const review=physicalReview();review[projection].push({key:'need.resolved_location',value:{version:1,points:[pin]}});
  assert.throws(()=>checkPhysicalMapConfirmation(review,'STATIONARY'),/AI_CONFIRMED_MAP_WITHOUT_HUMAN/);
 }
});

test('physical confirmation assertion preserves topology/mode and rejects incomplete acceptance envelopes',()=>{
 for(const mutate of [
  r=>{r.publicProjection[0].value.mode='REMOTE';},
  r=>{r.location={...r.location,geography:{mode:'REMOTE'}};},
  r=>{r.classificationCandidates[0].mode='REMOTE';},
  r=>{r.location=null;},
  r=>{delete r.location;},
  r=>{delete r.location.resolvedLocation;},
  r=>{delete r.ownerPrivateProjection;},
  r=>{r.canAccept='true';},
 ]) {
  const review=physicalReview();mutate(review);
  assert.throws(()=>checkPhysicalMapConfirmation(review,'STATIONARY'),/MAP_|TOPOLOGY/);
 }
});
