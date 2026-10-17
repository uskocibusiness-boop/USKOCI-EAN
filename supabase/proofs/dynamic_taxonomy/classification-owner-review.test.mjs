import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOwnerClassificationProjection as build} from '../../functions/_shared/classificationOwnerReview.mjs';
const paint='11111111-1111-4111-8111-111111111111';
const slide='22222222-2222-4222-8222-222222222222';
const lessons='33333333-3333-4333-8333-333333333333';
const rental='44444444-4444-4444-8444-444444444444';
const c={catalogVersion:9,categories:[
 {id:paint,label:'Krečenje zidova',modes:['ON_SITE']},
 {id:slide,label:'Izrada prezentacija',modes:['REMOTE']},
 {id:lessons,label:'Časovi umetničkog klizanja',modes:['ON_SITE']},
 {id:rental,label:'Iznajmljivanje klizaljki',modes:['ON_SITE']},
]};
const fp='a'.repeat(32);
const hint=(service,categoryId,mode='ON_SITE')=>({
 service,mode,action:'REUSE_EXISTING',categoryId,parentId:'',proposedPath:[],
 reason:'Server candidate is tied to reviewed exact meaning',catalogVersion:9,
});
const worker=(extra={})=>({
 purpose:'WORKER_CAPABILITY',visibleServices:['Krečenje zidova'],
 explicitServiceModes:[{service:'Krečenje zidova',mode:'ON_SITE'}],
 catalog:c,catalogFingerprint:fp,hints:[],...extra,
});
const need=(extra={})=>({
 purpose:'NEED_SERVICE',visibleServices:['Krečenje zidova'],needMode:'ON_SITE',
 catalog:c,catalogFingerprint:fp,hints:[],...extra,
});
test('exact worker identity stays one UUID without granting any capability',()=>{
 const v=build(worker({hints:[hint('Krečenje zidova',paint)]}));
 assert.equal(v.status,'READY');
 assert.equal(v.classificationCandidates[0].categoryId,paint);
 assert.deepEqual(v.reviewedServiceModes,[{service:'Krečenje zidova',mode:'ON_SITE'}]);
 assert.deepEqual(Object.keys(v.classificationCandidates[0]).sort(),
  ['action','catalogVersion','categoryId','mode','reason','service'].sort());
 assert.ok(!('capabilityAuthority' in v));
});
test('need exact identity uses authoritative need mode, never a worker global choice',()=>{
 const v=build(need({hints:[hint('Krečenje zidova',paint)]}));
 assert.equal(v.status,'READY');
 assert.equal(v.classificationCandidates[0].categoryId,paint);
 assert.deepEqual(v.reviewedServiceModes,[]);
});
test('same canonical ID reused across both publication orders',()=>{
 const x=build(worker());
 const y=build(need());
 assert.equal(x.classificationCandidates[0].categoryId,y.classificationCandidates[0].categoryId);
});
test('2 independently confirmed services do not inherit each others mode',()=>{
 const v=build(worker({visibleServices:['Krečenje zidova','Izrada prezentacija'],
 explicitServiceModes:[{service:'Krečenje zidova',mode:'ON_SITE'},{service:'Izrada prezentacija',mode:'REMOTE'}],
 hints:[hint('Krečenje zidova',paint),hint('Izrada prezentacija',slide,'REMOTE')]}));
 assert.equal(v.status,'READY');
 assert.deepEqual(v.reviewedServiceModes.map(x=>x.mode),['ON_SITE','REMOTE']);
 assert.deepEqual(v.classificationCandidates.map(x=>x.categoryId),[paint,slide]);
});
test('unspecified or partially confirmed worker modes NEVER become implicit ON_SITE',()=>{
 assert.equal(build(worker({explicitServiceModes:[]})).status,'SERVICE_MODE_CONFIRMATION_REQUIRED');
 assert.equal(build(worker({visibleServices:['Krečenje zidova','Izrada prezentacija'],
  explicitServiceModes:[{service:'Krečenje zidova',mode:'ON_SITE'}]})).status,'SERVICE_MODE_CONFIRMATION_REQUIRED');
});
test('worker cannot bind mode to service absent from saved profile',()=>{
 assert.equal(build(worker({explicitServiceModes:[{service:'Časovi umetničkog klizanja',mode:'ON_SITE'}]})).status,'MODE_NOT_IN_PROFILE');
 assert.equal(build(worker({explicitServiceModes:[{service:'Krečenje zidova',mode:'REMOTE'}]})).status,'PENDING_CLASSIFICATION');
});
test('model cannot bind skate rental to ice skating lessons UUID',()=>{
 const x=build(worker({visibleServices:['Iznajmljivanje klizaljki'],
 explicitServiceModes:[{service:'Iznajmljivanje klizaljki',mode:'ON_SITE'}],
 hints:[hint('Iznajmljivanje klizaljki',lessons)]}));
 assert.equal(x.status,'SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
 assert.deepEqual(x.classificationCandidates,[]);
});
test('unknown new service remains pending rather than disappearing or becoming generic root',()=>{
 const x=build(need({visibleServices:['Restauracija antičkih globusa'],
  hints:[]}));
 assert.equal(x.status,'PENDING_CLASSIFICATION');
 assert.deepEqual(x.classificationCandidates,[]);
});
test('novel category hint is NOT auto promoted by parent-only inference',()=>{
 const x=build(worker({visibleServices:['Restauracija antičkih globusa'],
 explicitServiceModes:[{service:'Restauracija antičkih globusa',mode:'ON_SITE'}],
 hints:[{service:'Restauracija antičkih globusa',mode:'ON_SITE',action:'CREATE_CHILD',
 categoryId:'',parentId:paint,proposedPath:['Restauracija antičkih globusa'],
 reason:'Provider merely suggested a parent category',catalogVersion:9}]}));
 assert.equal(x.status,'SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
});
test('wrong/stale category, alias, duplicate hints and conflicting modes fail closed',()=>{
 assert.equal(build(need({hints:[hint('Krečenje zidova','99999999-9999-4999-8999-999999999999')]})).status,
 'SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
 assert.equal(build(need({hints:[{...hint('Krečenje zidova',paint),catalogVersion:8}]})).status,
 'SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
 assert.equal(build(need({hints:[{...hint('Krečenje zidova',paint),action:'REUSE_ALIAS'}]})).status,
 'SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
 assert.equal(build(need({hints:[hint('Krečenje zidova',paint),hint('Krečenje zidova',paint)]})).status,
 'AMBIGUOUS_CANDIDATES');
 assert.equal(build(need({needMode:'REMOTE'})).status,'PENDING_CLASSIFICATION');
});
test('wrong catalogue fingerprint and duplicate Cyrillic/Latin labels fail closed',()=>{
 assert.equal(build(need({catalogFingerprint:'bad'})).status,'CATALOG_UNAVAILABLE');
 assert.equal(build(worker({visibleServices:['Krečenje zidova','Кречење зидова'],
 explicitServiceModes:[{service:'Krečenje zidova',mode:'ON_SITE'}]})).status,'INVALID_SERVICE_LIST');
});
test('stable transcription keeps one canonical category, no creation',()=>{
 const x=build(need({visibleServices:['Кречење зидова']}));
 assert.equal(x.status,'READY');
 assert.equal(x.classificationCandidates[0].categoryId,paint);
 assert.equal(x.classificationCandidates[0].service,'Кречење зидова');
});
