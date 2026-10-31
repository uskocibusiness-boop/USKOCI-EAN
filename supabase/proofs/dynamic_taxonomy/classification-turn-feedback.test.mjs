import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGeminiClassificationShadow as inspect, classificationTurnFeedback as feedback, workerFinishReviewMessage }
  from '../../functions/_shared/classificationGeminiShadow.mjs';

const rootId='11111111-1111-4111-8111-111111111111';
const leafId='22222222-2222-4222-8222-222222222222';
const catalog={catalogVersion:9,catalogFingerprint:'a'.repeat(32),categories:[
  {id:rootId,label:'Digitalne usluge',parentId:null,path:['Digitalne usluge'],modes:['REMOTE'],aliases:[]},
  {id:leafId,label:'3D printovanje',parentId:rootId,path:['Digitalne usluge','3D printovanje'],modes:['REMOTE'],aliases:['3D štampa']},
]};
const plan=(patch={})=>({service:'3D printovanje',mode:'REMOTE',action:'REUSE_EXISTING',categoryId:leafId,
  parentId:'',proposedPath:[],reason:'The reviewed concrete service is exactly the supplied category.',catalogVersion:9,...patch});
const raw=(plans,patch={})=>({assistantMessage:'Da, dostava je moguća. Koji materijal želiš?',safety:'ALLOW',facts:[],
  dialogue:{next:'ASK'},classificationShadowJson:JSON.stringify(plans),...patch});
const review=(plans,purpose='NEED_SERVICE',services=['3D printovanje'],overrides={})=>{
  const inspected=inspect(raw(plans,overrides),catalog,purpose);
  return {inspected,result:feedback(inspected,{purpose,services,readyForReview:true})};
};

test('worker can OFFER an optional 2-3 sentence biography at finish without making it a Save prerequisite',()=>{
  const skills=['3D printovanje'], covered=[plan()];
  const offered=workerFinishReviewMessage(skills,covered,true,true);
  assert.match(offered,/Otvorite pregled profila/);
  assert.match(offered,/Ako želite, mogu da sastavim kratak opis Vašeg rada/);
  assert.match(offered,/nije uslov za pregled ili čuvanje/);
  assert.doesNotMatch(offered,/sačuvano|aktivirano|objavljeno|automatski povezano/);
  const existing=workerFinishReviewMessage(skills,covered,true,false);
  assert.doesNotMatch(existing,/Ako želite, mogu da sastavim/);
  const missing=workerFinishReviewMessage(['Druga usluga'],[],true,true);
  assert.match(missing,/nije potvrđeno/);
  assert.match(missing,/Ako želite, mogu da sastavim/);
  const unavailable=workerFinishReviewMessage(skills,[],false,true);
  assert.match(unavailable,/Otvorite pregled profila/);
  assert.match(unavailable,/nije uslov za pregled ili čuvanje/);
});

test('both purposes retain exact/registered-alias candidates and leave the useful answer and facts intact',()=>{
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY'])for(const service of ['3D printovanje','3D štampa']){
    const input=raw([plan({service})]);const original=structuredClone(input);
    const inspected=inspect(input,catalog,purpose);
    const result=feedback(inspected,{purpose,services:[service],readyForReview:true});
    assert.equal(result.state,'CLEAR');assert.equal(result.canOfferReview,true);
    assert.deepEqual(result.questions,[]);assert.equal(result.notice,null);
    assert.equal(inspected.output.assistantMessage,input.assistantMessage);
    assert.deepEqual(inspected.output.facts,[]);assert.deepEqual(input,original);
    assert.equal(inspected.reviewProposals[0].categoryId,leafId);
    assert.equal(Object.hasOwn(inspected.output,'issues'),false);
  }
});

test('task finish and map answers retain their full known classification; an empty snapshot is never ready',()=>{
  for(const dialogue of [{next:'DONE'},{next:'ASK',requiresLocation:true}]){
    const kept=review([plan()],'NEED_SERVICE',['3D printovanje'],{dialogue});
    assert.equal(kept.result.canOfferReview,true);
    assert.deepEqual(kept.inspected.output.dialogue,dialogue);
    const lost=review([],'NEED_SERVICE',['3D printovanje'],{dialogue});
    assert.equal(lost.result.state,'RETRY');assert.equal(lost.result.canOfferReview,false);
    assert.deepEqual(lost.result.questions,[],'an omitted model snapshot is not a new user-data question');
    assert.equal(lost.inspected.output.assistantMessage,raw([]).assistantMessage);
  }
  const changed=review([plan()],'NEED_SERVICE',['3D modelovanje']);
  assert.equal(changed.result.canOfferReview,false,'a superseded category cannot cover the new task');
  assert.ok(changed.result.issues.some(issue=>issue.code==='MISSING_SERVICE_PROPOSAL'&&issue.service==='3D modelovanje'));
});

test('a new conversation with no service may honestly send an empty snapshot',()=>{
  const inspected=inspect(raw([]),catalog,'NEED_SERVICE');
  const result=feedback(inspected,{purpose:'NEED_SERVICE',services:[]});
  assert.equal(result.state,'CLEAR');assert.equal(result.notice,null);assert.deepEqual(result.questions,[]);
  assert.equal(result.canOfferReview,false,'empty classification is not a claim that review is complete');
});

test('missing mode and genuine ambiguity ask about the service without echoing model reasons or IDs',()=>{
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY']){
    const {result}=review([plan({mode:'UNCONFIRMED'})],purpose);
    assert.equal(result.state,'ASK_USER');assert.equal(result.canOfferReview,false);
    assert.equal(result.issues[0].service,'3D printovanje');assert.equal(result.issues[0].mode,'UNCONFIRMED');
    assert.equal(result.issues[0].action,'REUSE_EXISTING');assert.equal(result.issues[0].code,'MODE_UNCONFIRMED');
    assert.equal(result.questions.length,1);assert.match(result.questions[0],/3D printovanje/);
    assert.doesNotMatch(result.questions[0],/11111111|22222222|UNCONFIRMED|REUSE_EXISTING/);
    const ambiguous=review([plan({action:'ASK_CLARIFICATION',categoryId:'',reason:'PRIVATE_PROVIDER_REASON do not expose'})],purpose);
    assert.equal(ambiguous.result.state,'ASK_USER');assert.equal(ambiguous.result.questions.length,1);
    assert.doesNotMatch(JSON.stringify(ambiguous.result),/PRIVATE_PROVIDER_REASON/);
    assert.deepEqual(ambiguous.inspected.reviewProposals,[]);
  }
});

test('malformed metadata, stale catalog and an unregistered synonym never become a broad category or a user question',()=>{
  for(const proposal of [plan({service:'3D laserska obrada',categoryId:rootId}),plan({catalogVersion:8}),
    plan({parentId:rootId}),plan({service:'3D stampa',action:'REUSE_ALIAS'})]){
    const {result,inspected}=review([proposal],'NEED_SERVICE',[proposal.service]);
    assert.equal(result.state,'RETRY');assert.equal(result.canOfferReview,false);
    assert.deepEqual(result.questions,[]);assert.deepEqual(inspected.reviewProposals,[]);
  }
  for(const input of [{...raw([]),classificationShadowJson:'broken'},
    {assistantMessage:'Korisno objašnjenje?',safety:'ALLOW',facts:[]}]){
    const inspected=inspect(input,catalog,'NEED_SERVICE');
    assert.equal(feedback(inspected,{purpose:'NEED_SERVICE',services:['3D printovanje']}).state,'RETRY');
    assert.equal(inspected.output.assistantMessage,input.assistantMessage);
  }
});

test('valid deep new branch is reviewable, while activation remains outside the helper',()=>{
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY'])for(const action of ['CREATE_CHILD','CREATE_NEW_BRANCH']){
    const proposedPath=['Specijalne usluge','Izrada predmeta','Oblikovanje','Precizni modeli','Kolekcionarstvo','Posebne figure','Minijaturne replike','Izrada posebnih figurica'];
    const proposal=plan({service:proposedPath.at(-1),action,categoryId:'',parentId:action==='CREATE_CHILD'?rootId:'',proposedPath});
    const {result,inspected}=review([proposal],purpose,[proposal.service]);
    assert.deepEqual(inspected.reviewProposals,[proposal]);
    assert.equal(result.state,'PENDING');assert.equal(result.canOfferReview,true);
    assert.deepEqual(result.questions,[]);assert.match(result.notice,/pre potvrde i čuvanja/);
    assert.equal(Object.hasOwn(inspected.output,'categoryId'),false);
    const unknown=review([{...proposal,mode:'UNCONFIRMED'}],purpose,[proposal.service]);
    assert.equal(unknown.result.state,'ASK_USER');assert.equal(unknown.result.canOfferReview,false);
  }
});

test('review-only uncertainty and unsafe services cannot be mislabeled ready',()=>{
  for(const action of ['NEEDS_REVIEW','REJECT_UNSUPPORTED_OR_UNSAFE']){
    const {result}=review([plan({action,categoryId:''})]);
    assert.equal(result.canOfferReview,false);assert.deepEqual(result.questions,[]);
    assert.equal(result.state,action==='NEEDS_REVIEW'?'PENDING':'UNSUPPORTED');
  }
  for(const safety of ['BLOCK','REVIEW']){
    const {result}=review([],'NEED_SERVICE',[],{safety});
    assert.equal(result.state,'UNSUPPORTED');assert.equal(result.canOfferReview,false);
  }
});

test('byte-bound applies to deep UTF-8 paths in encoded and legacy envelopes without truncation',()=>{
  const service='Izrada posebnih figurica';
  const path=Array.from({length:120},(_,index)=>`N${index} ${'č'.repeat(112)}`);path.push(service);
  const proposal=plan({service,action:'CREATE_CHILD',categoryId:'',parentId:rootId,proposedPath:path});
  assert.ok(new TextEncoder().encode(JSON.stringify([proposal])).length>24576);
  const encoded=raw([proposal]);const {classificationShadowJson,...base}=encoded;
  for(const input of [encoded,{...base,classificationShadow:[proposal]}]){
    const result=inspect(input,catalog,'NEED_SERVICE');
    assert.deepEqual(result.statuses,['INVALID_SHADOW_JSON']);assert.deepEqual(result.reviewProposals,[]);
    assert.deepEqual(result.output,base);assert.equal(proposal.proposedPath.length,121);
  }
});

test('worker partial coverage retains valid hints and bounds questions without dropping unresolved issues',()=>{
  const unclear=Array.from({length:4},(_,index)=>plan({service:`Usluga broj ${index}`,categoryId:'',action:'ASK_CLARIFICATION'}));
  const {result,inspected}=review([plan(),...unclear],'WORKER_CAPABILITY',['3D printovanje',...unclear.map(p=>p.service)]);
  assert.equal(inspected.reviewProposals.length,1);assert.equal(result.state,'ASK_USER');assert.equal(result.canOfferReview,false);
  assert.equal(result.questions.length,1);assert.equal(result.issues.length,4);
});

test('preservation evidence is scoped to covered current services and never conceals global corruption or outage',()=>{
  const checked=inspect(raw([plan({mode:'UNCONFIRMED'})]),catalog,'WORKER_CAPABILITY');
  const options={purpose:'WORKER_CAPABILITY',services:['3D printovanje'],readyForReview:true};
  assert.equal(feedback({...checked,reviewProposals:[plan()]},options).state,'ASK_USER',
    'provider hints without the saved-mode guard provenance do not answer a missing mode');
  assert.equal(feedback(checked,{...options,preservedServices:['3D printovanje']}).state,'ASK_USER',
    'a label alone cannot clear an issue without the returned valid hint');
  const retained={...checked,reviewProposals:[plan()]};
  assert.equal(feedback(retained,{...options,preservedServices:['3D printovanje']}).state,'CLEAR');
  assert.equal(feedback(retained,{...options,preservedServices:['Nepovezana usluga']}).state,'ASK_USER');
  const malformed=inspect({...raw([]),classificationShadowJson:'broken'},catalog,'WORKER_CAPABILITY');
  assert.equal(feedback({...malformed,reviewProposals:[plan()]},{...options,preservedServices:['3D printovanje']}).state,'RETRY');
  const outage=feedback({reviewProposals:[],issues:[]},{purpose:'NEED_SERVICE',services:[],readyForReview:true,catalogAvailable:false});
  assert.equal(outage.state,'RETRY');assert.equal(outage.canOfferReview,false);assert.deepEqual(outage.questions,[]);
  assert.ok(outage.issues.some(issue=>issue.code==='CATALOG_UNAVAILABLE'));
});
