import test from 'node:test';
import assert from 'node:assert/strict';
import { withGeminiClassificationShadowSchema as decorate, inspectGeminiClassificationShadow as inspect, geminiClassificationShadowInstruction as instructions, classificationTurnFeedback as feedback } from '../../functions/_shared/classificationGeminiShadow.mjs';
import { serviceExecutionInstruction } from '../../functions/_shared/serviceExecutionInstruction.mjs';

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
const withEncodedShadow=(legacy,entries)=>({...legacy,classificationShadowJson:JSON.stringify(entries)});
test('catalog-enabled schema requires the snapshot without mutating the undecorated contract',()=>{
 const old={type:'OBJECT',properties:{safety:{type:'STRING'}},required:['safety'],additionalProperties:false};
 const extended=decorate(old);
 assert.deepEqual(Object.keys(old.properties),['safety']);
 assert.deepEqual(extended.required,['safety','classificationShadowJson']);
 assert.deepEqual(Object.keys(extended.properties),['safety','classificationShadowJson']);
 assert.deepEqual(extended.properties.classificationShadowJson,{type:'STRING'});
 assert.equal(Object.hasOwn(extended.properties,'classificationShadow'),false);
 assert.equal(extended.required.includes('classificationShadowJson'),true);
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

test('canonical label mislabeled as an alias reuses only its exact current unique identity',()=>{
 const p=plan('Časovi umetničkog klizanja',lesson,'ON_SITE','REUSE_ALIAS');
 for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']) {
  const good=inspect(withEncodedShadow(worker,[p]),snapshot,purpose);
  assert.deepEqual(good.statuses,['REUSE_CANDIDATE']);
  assert.equal(good.reviewProposals[0].action,'REUSE_EXISTING');
  for(const [proposal,catalog] of [
   [{...p,categoryId:rental},snapshot], [{...p,mode:'REMOTE'},snapshot], [{...p,catalogVersion:8},snapshot],
   [p,{...snapshot,categories:[...snapshot.categories,{id:'44444444-4444-4444-8444-444444444444',label:p.service,modes:['ON_SITE']}]}],
   [p,{...snapshot,navigation:{kind:'SERVER_QUERIES',identityChecks:[]}}],
  ]) assert.deepEqual(inspect(withEncodedShadow(worker,[proposal]),catalog,purpose).reviewProposals,[]);
 }
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
 assert.deepEqual(out.invalidPlanCodes,['REASON']);
 assert.doesNotMatch(JSON.stringify(out.invalidPlanCodes),/Loša usluga|too short/);
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
 assert.deepEqual(inspect(worker,snapshot,'WORKER_CAPABILITY').statuses,['MISSING_CLASSIFICATION_SHADOW']);
 assert.deepEqual(inspect(withShadow(worker,[]),snapshot,'WORKER_CAPABILITY').statuses,['EMPTY_CLASSIFICATION_SHADOW']);
 assert.deepEqual(inspect(withShadow(worker,'not array'),snapshot,'WORKER_CAPABILITY').statuses,['INVALID_BATCH']);
 assert.deepEqual(inspect(withShadow(need,Array(7).fill(plan('Oštrenje klizaljki',repair))),snapshot,'NEED_SERVICE').statuses,['INVALID_BATCH']);
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
 assert.match(prompt,/action REUSE_EXISTING/);
 assert.match(prompt,/Do not use shorter words such as REUSE/);
});

test('worker snapshot requires explicit unresolved proposals without inferring scope from catalog',()=>{
 const prompt=instructions('WORKER_CAPABILITY');
 assert.match(prompt,/Required classificationShadowJson STRING/);
 assert.match(prompt,/Always include this field/);
 assert.match(prompt,/no currently offered services or safety is BLOCK\/REVIEW/);
 assert.match(prompt,/ASK_CLARIFICATION or NEEDS_REVIEW/);
 assert.match(prompt,/never a reason to omit the service/);
 // Execution semantics live in the shared section sent by both real handlers;
 // classification metadata does not need a second copy of that authority rule.
 assert.match(serviceExecutionInstruction('WORKER_CAPABILITY'),/Catalog modes only limit supported scopes/);
 const unresolved={...plan('PRIVATE_SERVICE','','UNCONFIRMED','NEEDS_REVIEW')};
 const result=inspect(withEncodedShadow(worker,[unresolved]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(result.statuses,['NEEDS_REVIEW']);
 assert.deepEqual(result.reviewProposals,[]);
 for(const raw of [worker,withEncodedShadow(worker,[])]){
  const checked=inspect(raw,snapshot,'WORKER_CAPABILITY');
  assert.deepEqual(checked.output,worker);
  assert.deepEqual(checked.reviewProposals,[]);
  assert.ok(checked.statuses.every(status=>/^[A-Z_]+$/.test(status)));
  assert.doesNotMatch(JSON.stringify(checked.statuses),/PRIVATE_SERVICE|11111111/);
 }
 assert.deepEqual(inspect(need,snapshot,'NEED_SERVICE').statuses,['MISSING_CLASSIFICATION_SHADOW']);
 assert.deepEqual(inspect(withEncodedShadow(need,[]),snapshot,'NEED_SERVICE').statuses,['EMPTY_CLASSIFICATION_SHADOW']);
});

test('both phases and interviews retain the exact wire and authority contract',()=>{
 for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE'])for(const phase of ['direct','research']){
  const instruction=instructions(purpose,phase);
  assert.match(instruction,/For BOTH REUSE_EXISTING and REUSE_ALIAS:/);
  assert.match(instruction,/categoryId must be the exact non-empty UUID/);
  assert.match(instruction,/parentId must be the empty string ""/);
  assert.match(instruction,/proposedPath must be the empty array \[\]/);
  assert.match(instruction,/Do not copy the catalog parentId or path into a reuse entry/);
  assert.match(instruction,/FULL SNAPSHOT/);
  assert.match(instruction,/24576 UTF-8 bytes/);
  assert.match(instruction,/10 to 1000 characters/);
  assert.match(instruction,/ONLY optional ninth field is handoff, only for REMOTE/);
  assert.match(instruction,/never user consent/);
  assert.match(instruction,/Unsafe, regulated, ambiguous and possible duplicates are review-only/);
  if(phase==='direct'){
    assert.match(instruction,/do not invent CREATE\/EXTEND plans/);
    assert.match(instruction,/ASK_CLARIFICATION is for a real question/);
    assert.doesNotMatch(instruction,/Before CREATE_CHILD read/);
  }else{
    assert.match(instruction,/complete an ALL-scope SEARCH/);
    assert.match(instruction,/There is no fixed number of new levels/);
  }
 }
 assert.equal(instructions(),instructions('NEED_SERVICE','research'),'old callers retain research instructions');
 assert.throws(()=>instructions('NEED_SERVICE','unknown'),/SHADOW_PHASE_INVALID/);
});

test('action field diagnostics reject malformed plans without rewriting them or logging private values',()=>{
 const malformed=[];
 for(const action of ['REUSE_EXISTING','REUSE_ALIAS']){
  malformed.push(
   [{...plan('PRIVATE_SERVICE',lesson,'ON_SITE',action),categoryId:''},'REUSE_CATEGORY_REQUIRED'],
   [{...plan('PRIVATE_SERVICE',lesson,'ON_SITE',action),parentId:rental},'REUSE_PARENT_MUST_BE_EMPTY'],
   [{...plan('PRIVATE_SERVICE',lesson,'ON_SITE',action),proposedPath:['PRIVATE_PATH']},'REUSE_PATH_MUST_BE_EMPTY'],
  );
 }
 const child={...plan('PRIVATE_SERVICE','', 'ON_SITE','CREATE_CHILD'),parentId:lesson,proposedPath:['PRIVATE_PATH']};
 malformed.push(
  [{...child,parentId:''},'CHILD_PARENT_REQUIRED'],
  [{...child,categoryId:repair},'CHILD_CATEGORY_MUST_BE_EMPTY'],
  [{...child,proposedPath:[]},'CHILD_PATH_REQUIRED'],
  [{...child,action:'CREATE_NEW_BRANCH',parentId:'',categoryId:repair},'BRANCH_CATEGORY_MUST_BE_EMPTY'],
  [{...child,action:'CREATE_NEW_BRANCH'},'BRANCH_PARENT_MUST_BE_EMPTY'],
  [{...child,action:'CREATE_NEW_BRANCH',parentId:'',proposedPath:[]},'BRANCH_PATH_REQUIRED'],
  [{...child,action:'PROPOSE_RESTRUCTURE',categoryId:repair},'RESTRUCTURE_CATEGORY_MUST_BE_EMPTY'],
  [{...child,action:'PROPOSE_RESTRUCTURE',proposedPath:[]},'RESTRUCTURE_PATH_REQUIRED'],
 );
 for(const action of ['ASK_CLARIFICATION','NEEDS_REVIEW','REJECT_UNSUPPORTED_OR_UNSAFE']){
  const base={...plan('PRIVATE_SERVICE','','ON_SITE',action)};
  malformed.push(
   [{...base,categoryId:repair},'REVIEW_CATEGORY_MUST_BE_EMPTY'],
   [{...base,parentId:rental},'REVIEW_PARENT_MUST_BE_EMPTY'],
   [{...base,proposedPath:['PRIVATE_PATH']},'REVIEW_PATH_MUST_BE_EMPTY'],
  );
 }
 for(const [proposal,code] of malformed){
  const original=structuredClone(proposal);
  for(const [purpose,legacy] of [['WORKER_CAPABILITY',worker],['NEED_SERVICE',need]]){
   const outcome=inspect(withEncodedShadow(legacy,[proposal]),snapshot,purpose);
   assert.deepEqual(outcome.output,legacy);
   assert.deepEqual(outcome.statuses,['INVALID_PLAN']);
   assert.deepEqual(outcome.reviewProposals,[]);
   assert.deepEqual(outcome.invalidPlanCodes,[code]);
   assert.match(code,/^[A-Z_]+$/);
   assert.doesNotMatch(JSON.stringify(outcome.invalidPlanCodes),/PRIVATE_|11111111|22222222|33333333/);
  }
  assert.deepEqual(proposal,original,'diagnostics do not repair or coerce provider data');
 }
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
  const ambiguous={...plan('Časovi umetničkog klizanja',lesson),mode:'UNCONFIRMED'};
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
test('unsafe, unregistered alias, stale and ambiguous model hints cannot become review candidates',()=>{
 const rejected=[
  plan('Brušenje klizaljki',repair,'ON_SITE','REUSE_ALIAS'),
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

test('worker provider requests full 24-scope post-turn snapshot; requester stays 6',()=>{
 const base={type:'OBJECT',properties:{assistantMessage:{type:'STRING'}},required:['assistantMessage'],additionalProperties:false};
 for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']){
  assert.deepEqual(decorate(base,purpose).properties.classificationShadowJson,{type:'STRING'});
  assert.deepEqual(decorate(base,purpose).required,[...base.required,'classificationShadowJson']);
  assert.equal(Object.hasOwn(base.properties,'classificationShadowJson'),false);
 }
 assert.match(instructions('WORKER_CAPABILITY'),/0 to 24/);
 assert.match(instructions('NEED_SERVICE'),/0 to 6/);
 assert.match(instructions('WORKER_CAPABILITY'),/FULL SNAPSHOT/);
 assert.match(instructions('WORKER_CAPABILITY'),/finish\/acknowledgement/);
 assert.match(instructions('WORKER_CAPABILITY'),/do not guess mode/);
 assert.match(instructions('WORKER_CAPABILITY'),/SAME concrete service must resolve one canonical leaf/);
 assert.match(instructions('WORKER_CAPABILITY'),/REUSE\/EXTEND entries use the same categoryId/);
 assert.match(instructions('WORKER_CAPABILITY'),/new-service entries use the same parentId and proposedPath/);
 assert.match(instructions('NEED_SERVICE'),/CURRENT task AFTER applying this turn/);
});
test('worker can offer ONE exact service in both scopes, without fake second skill',()=>{
 const modes=[plan('Časovi umetničkog klizanja',lesson,'ON_SITE'),
   plan('Часови уметничког клизања',lesson,'REMOTE')];
 const dualSnapshot={catalogVersion:9,categories:[{...snapshot.categories[0],modes:['ON_SITE','REMOTE']}]};
 const result=inspect(withShadow(worker,modes),dualSnapshot,'WORKER_CAPABILITY');
 assert.deepEqual(result.statuses,['REUSE_CANDIDATE','REUSE_CANDIDATE']);
 assert.equal(result.reviewProposals.length,2);
 assert.deepEqual(result.reviewProposals.map(x=>x.mode),['ON_SITE','REMOTE']);
 const requester=inspect(withShadow(need,modes),dualSnapshot,'NEED_SERVICE');
 assert.deepEqual(requester.statuses,['REUSE_CANDIDATE','DUPLICATE_SERVICE']);
});
test('worker rejects conflicting cross-mode canonical IDs as one unresolved service in either order',()=>{
 const service='Časovi umetničkog klizanja';
 const conflictingCatalog={catalogVersion:9,categories:[
  {...snapshot.categories[0],modes:['ON_SITE']},
  {id:rental,label:service,modes:['REMOTE']},
  snapshot.categories[2],
 ]};
 const onsite=plan(service,lesson,'ON_SITE');
 const remote=plan('Часови уметничког клизања',rental,'REMOTE');
 for(const pair of [[onsite,remote],[remote,onsite]]){
  const raw=withEncodedShadow(worker,[...pair,plan('Oštrenje klizaljki',repair)]);
  const result=inspect(raw,conflictingCatalog,'WORKER_CAPABILITY');
  assert.deepEqual(result.output,worker);
  assert.deepEqual(result.statuses,['CROSS_MODE_IDENTITY_CONFLICT','CROSS_MODE_IDENTITY_CONFLICT','REUSE_CANDIDATE']);
  assert.deepEqual(result.reviewProposals,[plan('Oštrenje klizaljki',repair)]);
  assert.deepEqual(result.issues.map(issue=>issue.code),['CROSS_MODE_IDENTITY_CONFLICT','CROSS_MODE_IDENTITY_CONFLICT']);
  const turn=feedback(result,{purpose:'WORKER_CAPABILITY',services:[service,'Oštrenje klizaljki'],readyForReview:true});
  assert.equal(turn.state,'RETRY');
  assert.equal(turn.canOfferReview,false);
  assert.deepEqual(turn.questions,[]);
 }
});
test('worker new-service modes agree on parent and normalized path before any hint survives',()=>{
 const service='Izrada posebnih figurica';
 const onsite={...plan(service,'','ON_SITE','CREATE_CHILD'),parentId:lesson,proposedPath:['Precizna izrada',service]};
 const remote={...onsite,mode:'REMOTE',proposedPath:['Прецизна израда','Израда посебних фигурица']};
 for(const pair of [[onsite,{...remote,parentId:rental}],
                    [onsite,{...remote,proposedPath:[service]}],
                    [{...onsite,action:'CREATE_NEW_BRANCH',parentId:''},remote]]){
  const result=inspect(withEncodedShadow(worker,pair),snapshot,'WORKER_CAPABILITY');
  assert.deepEqual(result.statuses,['CROSS_MODE_IDENTITY_CONFLICT','CROSS_MODE_IDENTITY_CONFLICT']);
  assert.deepEqual(result.reviewProposals,[]);
 }
 const matching=inspect(withEncodedShadow(worker,[onsite,remote]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(matching.statuses,['ADMISSION_REVIEW_REQUIRED','ADMISSION_REVIEW_REQUIRED']);
 assert.deepEqual(matching.reviewProposals,[onsite,remote]);
});
test('worker may reuse and extend the same canonical ID across modes, but not mix reuse with creation',()=>{
 const service='Oštrenje klizaljki';
 const onsite=plan(service,repair,'ON_SITE');
 const remote={...plan(service,repair,'REMOTE','EXTEND_MODE'),handoff:{required:false}};
 const allowed=inspect(withEncodedShadow(worker,[onsite,remote]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(allowed.statuses,['REUSE_CANDIDATE','ADMISSION_REVIEW_REQUIRED']);
 assert.deepEqual(allowed.reviewProposals,[onsite,remote]);
 const created={...plan(service,'','REMOTE','CREATE_CHILD'),parentId:lesson,proposedPath:[service]};
 const mixed=inspect(withEncodedShadow(worker,[onsite,created]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(mixed.statuses,['CROSS_MODE_IDENTITY_CONFLICT','CROSS_MODE_IDENTITY_CONFLICT']);
 assert.deepEqual(mixed.reviewProposals,[]);
});
test('worker rejects duplicate same mode across Serbian scripts and contradictory unknown',()=>{
 const dualSnapshot={catalogVersion:9,categories:[{...snapshot.categories[0],modes:['ON_SITE','REMOTE']}]};
 const original=plan('Časovi umetničkog klizanja',lesson,'ON_SITE');
 const duplicate=plan('Часови уметничког клизања',lesson,'ON_SITE');
 const result=inspect(withShadow(worker,[original,duplicate]),dualSnapshot,'WORKER_CAPABILITY');
 assert.deepEqual(result.statuses,['REUSE_CANDIDATE','DUPLICATE_SERVICE']);
 assert.equal(result.reviewProposals.length,1);
 const unknown={...original,mode:'UNCONFIRMED'};
 assert.deepEqual(inspect(withShadow(worker,[original,unknown]),dualSnapshot,'WORKER_CAPABILITY').statuses,
  ['REUSE_CANDIDATE','DUPLICATE_SERVICE']);
});
test('worker accepts 7 distinct services but bounds forged oversized 25 proposal result',()=>{
 const many=Array.from({length:7},(_,i)=>({...plan('Radna veština '+i,''),action:'CREATE_CHILD',
  parentId:lesson,proposedPath:['Radna veština '+i]}));
 const out=inspect(withShadow(worker,many),snapshot,'WORKER_CAPABILITY');
 assert.equal(out.statuses.length,7);
 assert.equal(out.statuses.every(x=>x==='ADMISSION_REVIEW_REQUIRED'),true);
 assert.deepEqual(inspect(withShadow(worker,Array(25).fill(many[0])),snapshot,'WORKER_CAPABILITY').statuses,['INVALID_BATCH']);
});

test('provider-safe envelope is one required string for both catalog snapshots',()=>{
 const base={type:'OBJECT',required:['assistantMessage','patch'],additionalProperties:false,
  properties:{assistantMessage:{type:'STRING'},patch:{type:'OBJECT',required:['skills'],
    properties:{skills:{type:'ARRAY',items:{type:'STRING'}}}}}};
 for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']){
  const extended=decorate(base,purpose);
  assert.deepEqual(extended.required,[...base.required,'classificationShadowJson']);
  assert.deepEqual(extended.properties.patch,base.properties.patch);
  assert.deepEqual(Object.keys(extended.properties),['assistantMessage','patch','classificationShadowJson']);
  assert.deepEqual(extended.properties.classificationShadowJson,{type:'STRING'});
  assert.equal(Object.hasOwn(extended.properties,'classificationShadow'),false);
  assert.equal(Object.hasOwn(base.properties,'classificationShadowJson'),false);
 }
 assert.throws(()=>decorate({...base,properties:{...base.properties,classificationShadowJson:{type:'STRING'}}}),
  /SHADOW_SCHEMA_INVALID/);
});

test('encoded worker and need proposal reuse SAME category ID and preserve original output exactly',()=>{
 for(const [purpose,legacy] of [['WORKER_CAPABILITY',worker],['NEED_SERVICE',need]]){
  const proposal=plan('Časovi umetničkog klizanja',lesson);
  const result=inspect(withEncodedShadow(legacy,[proposal]),snapshot,purpose);
  assert.deepEqual(result.output,legacy);
  assert.deepEqual(result.statuses,['REUSE_CANDIDATE']);
  assert.deepEqual(result.reviewProposals,[proposal]);
  assert.equal(Object.hasOwn(result.output,'classificationShadowJson'),false);
 }
});

test('encoded CREATE_CHILD remains review-only; never generates a worker capability or DB write',()=>{
 const proposal={...plan('Časovi hokeja',''),action:'CREATE_CHILD',
   parentId:lesson,proposedPath:['Časovi hokeja']};
 const out=inspect(withEncodedShadow(worker,[proposal]),snapshot,'WORKER_CAPABILITY');
 assert.deepEqual(out.output,worker);
 assert.deepEqual(out.statuses,['ADMISSION_REVIEW_REQUIRED']);
  assert.deepEqual(out.reviewProposals,[proposal]);
});
test('new top-level branch is retained only as a hint under the chosen execution mode',()=>{
 const proposal={...plan('Izrada posebnih figurica',''),action:'CREATE_NEW_BRANCH',
   parentId:'',proposedPath:['Nove 3D usluge','Izrada posebnih figurica']};
 const out=inspect(withEncodedShadow(need,[proposal]),snapshot,'NEED_SERVICE');
 assert.deepEqual(out.output,need);
 assert.deepEqual(out.statuses,['ADMISSION_REVIEW_REQUIRED']);
 assert.deepEqual(out.reviewProposals,[proposal]);
 const uncertain=inspect(withEncodedShadow(need,[{...proposal,mode:'UNCONFIRMED'}]),snapshot,'NEED_SERVICE');
 assert.deepEqual(uncertain.reviewProposals,[]);
});

test('invalid, oversized, mixed and duplicate encoded shadows fail closed without corrupting interview',()=>{
 const proposal=plan('Časovi umetničkog klizanja',lesson);
 const inputs=[
  [{...need,classificationShadowJson:'{not json'},'INVALID_SHADOW_JSON'],
  [{...need,classificationShadowJson:42},'INVALID_SHADOW_JSON'],
  [{...need,classificationShadowJson:' '.repeat(24577)},'INVALID_SHADOW_JSON'],
  [{...need,classificationShadowJson:'{}'},'INVALID_BATCH'],
  [{...need,classificationShadowJson:JSON.stringify(Array(7).fill(proposal))},'INVALID_BATCH'],
  [{...need,classificationShadowJson:JSON.stringify([proposal]),classificationShadow:[proposal]},'AMBIGUOUS_SHADOW_FORMAT'],
 ];
 for(const [input,status] of inputs){
  const out=inspect(input,snapshot,'NEED_SERVICE');
  assert.deepEqual(out.output,need);
  assert.deepEqual(out.statuses,[status]);
  assert.deepEqual(out.reviewProposals,[]);
 }
 const dup=inspect(withEncodedShadow(need,[proposal,{...proposal,service:'Часови уметничког клизања'}]),snapshot,'NEED_SERVICE');
 assert.deepEqual(dup.statuses,['REUSE_CANDIDATE','DUPLICATE_SERVICE']);
 assert.equal(dup.reviewProposals.length,1);
});

test('encoded scope checks and blocked interview continue to gate proposed classification',()=>{
 const dualSnapshot={catalogVersion:9,categories:[{...snapshot.categories[0],modes:['ON_SITE','REMOTE']}]};
 const modes=[plan('Časovi umetničkog klizanja',lesson,'ON_SITE'),
  plan('Часови уметничког клизања',lesson,'REMOTE')];
 const out=inspect(withEncodedShadow(worker,modes),dualSnapshot,'WORKER_CAPABILITY');
 assert.deepEqual(out.statuses,['REUSE_CANDIDATE','REUSE_CANDIDATE']);
 assert.deepEqual(out.reviewProposals.map(x=>x.mode),['ON_SITE','REMOTE']);
 const blocked=inspect(withEncodedShadow({...worker,safety:'BLOCK'},modes),dualSnapshot,'WORKER_CAPABILITY');
 assert.deepEqual(blocked.reviewProposals,[]);
 assert.deepEqual(blocked.statuses,['SAFETY_INTERVIEW_REVIEW']);
});
