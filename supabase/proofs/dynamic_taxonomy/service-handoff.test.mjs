import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeServiceHandoff as decode, formatServiceHandoff as format } from '../../functions/_shared/serviceHandoff.mjs';
import { serviceExecutionInstruction } from '../../functions/_shared/serviceExecutionInstruction.mjs';
import { inspectGeminiClassificationShadow as inspect } from '../../functions/_shared/classificationGeminiShadow.mjs';
import { readWorkerServiceModeContext, preserveWorkerServiceModes } from '../../functions/_shared/workerServiceModeContext.mjs';

const categoryId='11111111-1111-4111-8111-111111111111';
const service='Izrada drvenih figura';
const local={required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}};
const shipping={required:true,shippingCountries:['RS','DE']};
const catalog={catalogVersion:9,categories:[{id:categoryId,label:service,modes:['REMOTE','ON_SITE']}]};
const hint=(extra={})=>({service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId,parentId:'',proposedPath:[],
  reason:'The same concrete service is performed at the provider workshop.',catalogVersion:9,...extra});

test('unknown, no exchange and local/shipping exchange are distinct unchanged values',()=>{
  assert.equal(decode(undefined),null);assert.equal(format(undefined),null);
  assert.deepEqual(decode({required:false}),{required:false});
  assert.equal(format({required:false}),'Bez fizičke predaje');
  const combined={required:true,shippingCountries:['RS','DE'],localExchange:{countryCode:'RS',city:'Novi Sad'}};
  const copy=decode(combined);assert.deepEqual(copy,combined);assert.notEqual(copy,combined);
  assert.notEqual(copy.shippingCountries,combined.shippingCountries);assert.notEqual(copy.localExchange,combined.localExchange);
  assert.equal(format(combined),'Slanje: RS, DE ili Lično preuzimanje: Novi Sad (RS)');
  assert.equal(format(local),'Lično preuzimanje: Novi Sad (RS)');
  assert.equal(format(shipping),'Slanje: RS, DE');
  assert.deepEqual(decode({...shipping,shippingCountries:['DE','RS']}),{required:true,shippingCountries:['DE','RS']});
});

test('wire validator rejects unsupported fields, invented unrestricted options and private address shapes',()=>{
  const malformed=[null,[],{}, {required:'true'}, {required:true}, {required:false,shippingCountries:['RS']},
    {required:true,shippingCountries:[]}, {required:true,shippingCountries:['rs']}, {required:true,shippingCountries:['RS','RS']},
    {required:true,shippingCountries:['ALL']}, {required:true,shippingCountries:['*']}, {required:true,shippingCountries:Array(33).fill('RS')},
    {required:true,shippingCountries:new Array(1)}, {required:true,localExchange:{countryCode:'RS',city:'NS'}},
    {required:true,localExchange:{countryCode:'RS',city:'Novi Sad',address:'PRIVATE'}},
    {required:true,localExchange:{countryCode:'RS',city:'Novi Sad 12'}},
    {required:true,localExchange:{countryCode:'RS',city:' Novi Sad'}},
    {required:true,localExchange:{countryCode:'RS',city:'Novi\nSad'}},
    {required:true,localExchange:{countryCode:'RS',city:'Novi\u007fSad'}},
    {required:true,localExchange:{countryCode:'RS',city:'Novi\u0085Sad'}},
    {required:true,localExchange:{countryCode:'RS',city:'\u00a0Novi Sad'}},
    {required:true,localExchange:{countryCode:'RS',city:'<Novi Sad>'}},
    {required:true,localExchange:{countryCode:'RS',city:'x'.repeat(121)}},
    {...local,authority:'OWNER_CONFIRMED'}, {...local,large:'x'.repeat(2049)},
  ];
  for(const value of malformed){assert.equal(decode(value),null);assert.equal(format(value),null);}
});

test('shared helper runs without browser TextEncoder and does not normalize reviewed content',()=>{
  const original=globalThis.TextEncoder;
  try{globalThis.TextEncoder=undefined;assert.deepEqual(decode(local),local);}
  finally{globalThis.TextEncoder=original;}
  const unicode={required:true,localExchange:{countryCode:'RS',city:'Нови Сад'}};
  assert.deepEqual(decode(unicode),unicode);
});

test('inspector keeps optional remote handoff without changing legacy output or granting authority',()=>{
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY']){
    const output={safety:'ALLOW',assistantMessage:'Predlog je u nacrtu.'};
    for(const handoff of [undefined,{required:false},local,shipping]){
      const proposed=hint(handoff===undefined?{}:{handoff});
      const result=inspect({...output,classificationShadowJson:JSON.stringify([proposed])},catalog,purpose);
      assert.deepEqual(result.output,output);assert.deepEqual(result.statuses,['REUSE_CANDIDATE']);
      assert.deepEqual(result.reviewProposals,[proposed]);
      assert.equal(Object.hasOwn(result.reviewProposals[0],'handoff'),handoff!==undefined);
    }
  }
});

test('invalid, onsite or unconfirmed handoff fails closed instead of becoming unrestricted',()=>{
  for(const proposal of [hint({mode:'ON_SITE',handoff:local}),hint({mode:'UNCONFIRMED',handoff:local}),
    hint({handoff:{required:true}}),hint({handoff:null}),hint({handoff:local,extra:true})]){
    const result=inspect({safety:'ALLOW',classificationShadowJson:JSON.stringify([proposal])},catalog,'WORKER_CAPABILITY');
    assert.deepEqual(result.statuses,['INVALID_PLAN']);assert.deepEqual(result.reviewProposals,[]);
  }
});

test('same-ID EXTEND_MODE remains an admission request with its handoff intact',()=>{
  const proposed=hint({action:'EXTEND_MODE',handoff:local});
  const current={...catalog,categories:[{...catalog.categories[0],modes:['ON_SITE']}]};
  const result=inspect({safety:'ALLOW',classificationShadowJson:JSON.stringify([proposed])},current,'NEED_SERVICE');
  assert.deepEqual(result.statuses,['ADMISSION_REVIEW_REQUIRED']);
  assert.deepEqual(result.reviewProposals,[proposed]);
  assert.equal(current.categories[0].modes.length,1);
});

function workerContext(savedHandoff=local,text='Dopuni samo opis profila.'){
  return {revision:2,candidate:{skills:[service]},messages:[{role:'USER',body:text}],
    serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,
      savedServices:[{service,mode:'REMOTE',categoryId,...(savedHandoff===undefined?{}:{handoff:savedHandoff})}],draftServices:[],unresolvedServices:[]}};
}
function preserve(context,proposals,change){
  return preserveWorkerServiceModes({context,modeContext:readWorkerServiceModeContext(context),catalog,hints:proposals,
    raw:{safety:'ALLOW',patch:{bio:'Dopunjen opis.'},...(change?{serviceModeChangesJson:JSON.stringify([change])}:{})}});
}

test('saved remote pickup-only survives unrelated edit and model shipping drift',()=>{
  const result=preserve(workerContext(),[hint({handoff:shipping})]);
  assert.equal(result.hints.length,1);assert.deepEqual(result.hints[0].handoff,local);
  assert.deepEqual(result.preservedServices,[service]);
});

test('saved unknown is not broadened to no exchange or unlimited shipping by an unrelated edit',()=>{
  const context=workerContext();delete context.serviceModeContext.savedServices[0].handoff;
  const result=preserve(context,[hint({handoff:{required:false}})]);
  assert.equal(Object.hasOwn(result.hints[0],'handoff'),false);
});

test('explicit same-mode handoff correction with owned quote may replace only that service constraint',()=>{
  const evidence='Od sada figure šaljem u Srbiju i Nemačku.';
  const result=preserve(workerContext(local,evidence),[hint({handoff:shipping})],
    {service,modes:['REMOTE'],evidence,handoff:shipping});
  assert.deepEqual(result.hints[0].handoff,shipping);assert.deepEqual(result.preservedServices,[]);
  assert.deepEqual(result.unresolvedChanges,[]);
});

test('a handoff correction for one service preserves the other saved service and its pickup constraint',()=>{
  const otherId='22222222-2222-4222-8222-222222222222',other='Izrada kamenih ukrasa';
  const evidence='Drvene figure sada šaljem u Srbiju i Nemačku.';
  const context=workerContext(local,evidence);
  context.candidate.skills.push(other);
  context.serviceModeContext.savedServices.push({service:other,mode:'REMOTE',categoryId:otherId,handoff:local});
  const result=preserveWorkerServiceModes({context,modeContext:readWorkerServiceModeContext(context),
    catalog:{...catalog,categories:[...catalog.categories,{id:otherId,label:other,modes:['REMOTE']}]},
    hints:[hint({handoff:shipping}),hint({service:other,categoryId:otherId,handoff:shipping})],
    raw:{safety:'ALLOW',patch:{},serviceModeChangesJson:JSON.stringify([{service,modes:['REMOTE'],evidence,handoff:shipping}])}});
  assert.deepEqual(result.hints.find(entry=>entry.service===service).handoff,shipping);
  assert.deepEqual(result.hints.find(entry=>entry.service===other).handoff,local);
});

test('mode-only correction preserves physical handoff; mismatched or unowned handoff evidence cannot widen it',()=>{
  const evidence='Od sada radim samo na daljinu.';
  const context=workerContext(local,evidence);
  const changed=preserve(context,[hint({handoff:shipping})],{service,modes:['REMOTE'],evidence});
  assert.deepEqual(changed.hints[0].handoff,local);
  for(const change of [{service,modes:['REMOTE'],evidence:'NEPOSTOJEĆA PORUKA',handoff:shipping},
    {service,modes:['REMOTE'],evidence,handoff:{required:false}}]){
    const result=preserve(context,[hint({handoff:shipping})],change);
    assert.deepEqual(result.hints[0].handoff,local);
  }
  const mismatch=preserve(context,[hint({handoff:shipping})],{service,modes:['REMOTE'],evidence,handoff:{required:false}});
  assert.deepEqual(mismatch.unresolvedChanges,[service],'retaining old data must not imply the explicit change was completed');
});

test('owned context rejects malformed handoff or handoff attached to onsite',()=>{
  for(const data of [{...local,extra:true},null]){
    const context=workerContext(data);assert.throws(()=>readWorkerServiceModeContext(context),/WORKER_MODE_CONTEXT_INVALID/);
  }
  const context=workerContext();context.serviceModeContext.savedServices[0].mode='ON_SITE';
  assert.throws(()=>readWorkerServiceModeContext(context),/WORKER_MODE_CONTEXT_INVALID/);
});

test('both interview instructions share execution semantics without adding mode or assuming shipping',()=>{
  for(const purpose of ['NEED_SERVICE','WORKER_CAPABILITY']){
    const text=serviceExecutionInstruction(purpose);
    assert.match(text,/only ON_SITE and REMOTE/);assert.match(text,/without asking an obvious extra question/);
    assert.match(text,/Do not silently replace physical work with advice/);
    assert.match(text,/necessary measurement, installation or other worker visit is ON_SITE/);
    assert.match(text,/does not mean the worker offers courier/);
    assert.match(text,/Unknown remains omitted/);assert.match(text,/REMOTE alone never means shipping everywhere/);
    assert.match(text,/description\/bio prose filters/);
  }
  assert.throws(()=>serviceExecutionInstruction('THIRD_MODE'),/EXECUTION_PURPOSE_INVALID/);
});
