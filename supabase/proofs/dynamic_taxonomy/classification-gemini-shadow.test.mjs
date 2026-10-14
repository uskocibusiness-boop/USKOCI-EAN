import test from 'node:test';
import assert from 'node:assert/strict';
import { withGeminiClassificationShadowSchema as decorate, inspectGeminiClassificationShadow as inspect, geminiClassificationShadowInstruction as instructions } from '../../functions/_shared/classificationGeminiShadow.mjs';

const lesson='11111111-1111-4111-8111-111111111111';
const rental='22222222-2222-4222-8222-222222222222';
const repair='33333333-3333-4333-8333-333333333333';
const snapshot={catalogVersion:9,categories:[
  {id:lesson,label:'Časovi umetničkog klizanja',modes:['ON_SITE']},
  {id:rental,label:'Iznajmljivanje klizaljki',modes:['ON_SITE']},
  {id:repair,label:'Oštrenje klizaljki',modes:['ON_SITE']},
]};
const reason='Distinct, expressly offered skating-related service';
const plan=(service,categoryId=lesson,mode='ON_SITE',action='REUSE_EXISTING')=>({
  service,mode,action,categoryId,parentId:'',proposedPath:[],reason,catalogVersion:9,
});
const worker={assistantMessage:'Proveri svoj nacrt profila.',safety:'ALLOW',patch:{skills:['Časovi umetničkog klizanja']}};
const need={assistantMessage:'Otvori pregled zadatka.',safety:'ALLOW',facts:[],dialogue:{next:'DONE'}};
const withShadow=(legacy,entries)=>({...legacy,classificationShadow:entries});
test('OFF flag baseline schema is not mutated and shadow field remains optional',()=>{
 const old={type:'OBJECT',properties:{safety:{type:'STRING'}},required:['safety'],additionalProperties:false};
 const extended=decorate(old);
 assert.deepEqual(Object.keys(old.properties),['safety']);
 assert.deepEqual(extended.required,['safety']);
 assert.deepEqual(extended.properties.classificationShadow.items.required,
  ['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion']);
 assert.equal(extended.properties.classificationShadow.maxItems,6);
 assert.equal(extended.additionalProperties,false);
});
test('A/B worker and requester Gemini outputs share exact canonical identity candidate',()=>{
 for(const [purpose,legacy] of [['WORKER_CAPABILITY',worker],['NEED_SERVICE',need]]){
  const outcome=inspect(withShadow(legacy,[plan('Časovi umetničkog klizanja')]),snapshot,purpose);
  assert.deepEqual(outcome.output,legacy,'legacy wire shape must never receive taxonomy fields');
  assert.deepEqual(outcome.statuses,['REUSE_CANDIDATE']);
 }
});
test('C/D two ordering directions give the same result without authority',()=>{
 for(const purposes of [
  ['WORKER_CAPABILITY','NEED_SERVICE'],['NEED_SERVICE','WORKER_CAPABILITY']
 ]){
   assert.deepEqual(purposes.map(p=>inspect(withShadow(need,[plan('Oštrenje klizaljki',repair)]),snapshot,p).statuses),
    [['REUSE_CANDIDATE'],['REUSE_CANDIDATE']]);
 }
});
test('E no AI claim can independently validate a new unregistered alias',()=>{
 const out=inspect(withShadow(worker,[plan('Individualni časovi klizanja',lesson,'ON_SITE','REUSE_ALIAS')]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(out.statuses,['ALIAS_EVIDENCE_REQUIRED']);
});
test('F similar language is not enough to fuse three separate existing identities',()=>{
 const out=inspect(withShadow(worker,[
  plan('Časovi umetničkog klizanja',lesson),
  plan('Iznajmljivanje klizaljki',rental),
  plan('Oštrenje klizaljki',repair),
 ]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(out.statuses,['REUSE_CANDIDATE','REUSE_CANDIDATE','REUSE_CANDIDATE']);
 assert.equal(snapshot.categories.length,3);
});
test('G legacy output stays unchanged on forged catalog ID, stale version and weird JSON',()=>{
 const bad=plan('Časovi umetničkog klizanja','44444444-4444-4444-8444-444444444444');
 const stale={...plan('Oštrenje klizaljki',repair),catalogVersion:8};
 const malformed={...plan('Loša usluga'),reason:'too short'};
 const out=inspect(withShadow(need,[bad,stale,malformed]),snapshot,'NEED_SERVICE');
 assert.deepEqual(out.output,need);
 assert.deepEqual(out.statuses,['UNKNOWN_CANONICAL_ID','STALE_CATALOG','INVALID_PLAN']);
});
test('H neither REMOTE mismatch nor UNCONFIRMED mode permits candidate reuse',()=>{
 const out=inspect(withShadow(worker,[
  plan('Časovi umetničkog klizanja',lesson,'REMOTE'),
  plan('Oštrenje klizaljki',repair,'UNCONFIRMED'),
 ]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(out.statuses,['MODE_NOT_SUPPORTED','MODE_UNCONFIRMED']);
});
test('I novel service belongs to owner-reviewed admission, not provider output',()=>{
 const child={...plan('Dresiranje egzotičnih ptica',''),action:'CREATE_CHILD',
  parentId:lesson,proposedPath:['Dresiranje egzotičnih ptica']};
 const out=inspect(withShadow(need,[child]),snapshot,'NEED_SERVICE');
 assert.deepEqual(out.statuses,['ADMISSION_REVIEW_REQUIRED']);
});
test('J empty, absent, invalid and over-limit shadow never change legacy facts',()=>{
 assert.deepEqual(inspect(worker,snapshot,'WORKER_CAPABILITY').output,worker);
 assert.deepEqual(inspect(withShadow(worker,[]),snapshot,'WORKER_CAPABILITY').statuses,[]);
 assert.deepEqual(inspect(withShadow(worker,'not array'),snapshot,'WORKER_CAPABILITY').statuses,['INVALID_BATCH']);
 assert.deepEqual(inspect(withShadow(worker,Array(7).fill(plan('Oštrenje klizaljki',repair))),snapshot,'WORKER_CAPABILITY').statuses,['INVALID_BATCH']);
 assert.deepEqual(inspect(withShadow(worker,[plan('Oštrenje klizaljki',repair),plan('Oštrenje klizaljki',repair)]),snapshot,'WORKER_CAPABILITY').statuses,
  ['REUSE_CANDIDATE','DUPLICATE_SERVICE']);
});
test('K blocked/review interview cannot produce even a reuse candidate',()=>{
 for(const safety of ['BLOCK','REVIEW']){
  const old={...need,safety};
  const out=inspect(withShadow(old,[plan('Oštrenje klizaljki',repair)]),snapshot,'NEED_SERVICE');
  assert.deepEqual(out.output,old);
  assert.deepEqual(out.statuses,['SAFETY_INTERVIEW_REVIEW']);
 }
});
test('L protected model instruction does not claim consent or matching',()=>{
 const prompt=instructions();
 assert.match(prompt,/never user consent/);
 assert.match(prompt,/never write/);
 assert.match(prompt,/UNCONFIRMED/);
});

test('Gemini shadow cannot smuggle skate rental or sharpening as skating lessons',()=>{
 for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']){
  const result=inspect(withShadow(worker,[plan('Iznajmljivanje klizaljki',lesson)]),snapshot,purpose);
  assert.deepEqual(result.output,worker);
  assert.deepEqual(result.statuses,['SEMANTIC_IDENTITY_REVIEW_REQUIRED']);
 }
});
test('Cyrillic review identity works without creating a second category',()=>{
 const result=inspect(withShadow(need,[plan('Часови уметничког клизања')]),snapshot,'NEED_SERVICE');
 assert.deepEqual(result.statuses,['REUSE_CANDIDATE']);
 assert.deepEqual(result.output,need);
});

test('shadow Cyrillic and Latin names cannot create parallel candidate services',()=>{
 const first={...plan('Popravka tipografske mašine',''),action:'CREATE_CHILD',parentId:lesson,proposedPath:['Popravka tipografske mašine']};
 const second={...first,service:'Поправка типографске машине'};
 const result=inspect(withShadow(need,[first,second]),snapshot,'NEED_SERVICE');
 assert.deepEqual(result.statuses,['ADMISSION_REVIEW_REQUIRED','DUPLICATE_SERVICE']);
 assert.deepEqual(result.output,need);
});

test('validated hints survive stripping only as non-authoritative review proposals',()=>{
 for(const [purpose,legacy] of [['WORKER_CAPABILITY',worker],['NEED_SERVICE',need]]){
  const reused=plan('Oštrenje klizaljki',repair);
  const child={...plan('Časovi hokeja', ''),action:'CREATE_CHILD',
   parentId:lesson,proposedPath:['Časovi hokeja']};
  const ambiguous={...plan('Oštrenje klizaljki',repair),mode:'UNCONFIRMED'};
  const wrong=plan('Iznajmljivanje klizaljki',lesson);
  const result=inspect(withShadow(legacy,[reused,child,ambiguous,wrong]),snapshot,purpose);
  assert.deepEqual(result.output,legacy);
  assert.deepEqual(result.statuses,['REUSE_CANDIDATE','ADMISSION_REVIEW_REQUIRED',
    'MODE_UNCONFIRMED','SEMANTIC_IDENTITY_REVIEW_REQUIRED']);
  assert.deepEqual(result.reviewProposals,[reused,child],
    'only candidates with validated identity or reviewed parent and explicit mode survive');
  assert.notStrictEqual(result.reviewProposals[1].proposedPath,child.proposedPath);
  assert.equal(Object.hasOwn(result.output,'reviewProposals'),false);
 }
});
test('unsafe, aliased, stale and ambiguous model hints can never become review candidates',()=>{
 const rejected=[
  plan('Oštrenje klizaljki',repair,'ON_SITE','REUSE_ALIAS'),
  {...plan('Časovi umetničkog klizanja',lesson),catalogVersion:8},
  plan('Iznajmljivanje klizaljki',lesson),
  plan('Časovi umetničkog klizanja',lesson,'REMOTE'),
 ];
 for(const old of [worker,need]){
  assert.deepEqual(inspect(withShadow({...old,safety:'BLOCK'},[plan('Oštrenje klizaljki',repair)]),snapshot,'NEED_SERVICE').reviewProposals,[]);
  assert.deepEqual(inspect(withShadow(old,rejected),snapshot,'NEED_SERVICE').reviewProposals,[]);
  assert.deepEqual(inspect(withShadow(old,'invalid'),snapshot,'NEED_SERVICE').reviewProposals,[]);
 }
});
