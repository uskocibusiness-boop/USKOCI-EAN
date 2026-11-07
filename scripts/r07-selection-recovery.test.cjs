'use strict';
// Execute the actual adapter, Candidates read/choose callbacks and recovery CTA
// expressions. Only RPC transport, account state and native rendering are seams.
// This is not an installed Android UI or hosted Auth test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname,'..');
const ROUTE = 'src/app/(app)/potrebe/[id]/kandidati.tsx';
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ownerId=ID(1),needId=ID(2),responseId=ID(3),agreementId=ID(4);
const command = (patch={}) => Object.freeze({potrebaId:needId,potrebaRevizija:3,prijavaId:responseId,
  prijavaVerzija:2,prijavaHash:'a'.repeat(64),mesta:2,clientRequestId:'r07-selection-original',...patch});
const found = (patch={}) => ({schema:'SELECTION_RESULT_V1',authoritative:true,found:true,result:{
  agreementId,agreementStatus:'CONFIRMED',needId,needRevision:3,responseId,responseVersion:2,
  contentHash:'a'.repeat(64),coveredSlots:2,clientRequestId:'r07-selection-original',...patch,
}});
const absent={schema:'SELECTION_RESULT_V1',authoritative:true,found:false,result:null};
function compile(source,fileName='test.ts') {
  const output=ts.transpileModule(source,{fileName,reportDiagnostics:true,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  assert.deepEqual((output.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  return output.outputText;
}
function evaluate(source,environment,fileName) {
  const module={exports:{}};
  new Function('module',...Object.keys(environment),compile(source,fileName))(module,...Object.values(environment));
  return module.exports;
}
function harness(wireResult=found()) {
  const account={accountId:ownerId,accountRevision:1};
  const auth={user:{id:ownerId},accountRevision:1};
  const need={id:needId,revizija:4};
  const candidate={prijavaId:responseId,potrebaRevizija:4,stanje:'SELECTED',mozeIzabrati:false,
    verzija:2,hash:'a'.repeat(64),pokrivaMesta:2};
  const original={ok:false,kod:'APPLICATION_SELECTION_UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
  const session={readRevision:0,focusToken:1,reading:false,navigated:false,hardReload:false,
    focused:true,active:true,pending:{command:command(),candidate,need:{...need,revizija:3},result:original,inFlight:false,reconciled:false}};
  const calls=[],sourceCalls=[];
  const control={hook:null,sourceHook:null,readResult:wireResult,selectError:null,selectThrows:false,saveOptions:null,sourceThrows:false};
  const wire={async rpc(name,args) {
    calls.push({name,args});
    if(control.hook) await control.hook(name,args);
    if(name==='rpc_read_selection_result') return {data:structuredClone(control.readResult),error:null};
    if(name==='rpc_select_response') {
      if(control.selectThrows) throw new Error('connection ended after server commit');
      return control.selectError?{data:null,error:control.selectError}:{data:agreementId,error:null};
    }
    throw new Error('Unexpected RPC '+name);
  }};
  const stubs={
    'src/data/supabaseClient.ts':{supabaseKlijent:()=>wire},
    'src/store/sesija.ts':{sesijaSada:()=>auth},
  };
  const cache=new Map();
  function load(relative) {
    if(stubs[relative])return stubs[relative];
    if(cache.has(relative))return cache.get(relative).exports;
    const filename=path.join(ROOT,relative),module={exports:{}};cache.set(relative,module);
    const requireLocal=specifier=>{
      if(!specifier.startsWith('.'))return require(specifier);
      const base=path.resolve(path.dirname(filename),specifier);
      const resolved=['','.ts','.tsx','.js','/index.ts'].map(s=>base+s).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
      assert.ok(resolved,relative+': '+specifier);
      return load(path.relative(ROOT,resolved).replaceAll(path.sep,'/'));
    };
    new Function('require','module','exports',compile(fs.readFileSync(filename,'utf8'),filename))(requireLocal,module,module.exports);
    return module.exports;
  }
  const service=load('src/data/applicationSelectionClientService.ts');
  const source=ts.createSourceFile(ROUTE,fs.readFileSync(path.join(ROOT,ROUTE),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const helper=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='recoverPendingSelection');
  const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Kandidati');
  assert.ok(helper&&component);
  let readNode,chooseNode;
  function visit(n) {
    if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='read'&&ts.isCallExpression(n.initializer))readNode=n.initializer.arguments[0];
    if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='choose')chooseNode=n.initializer;
    ts.forEachChild(n,visit);
  }
  visit(component);assert.ok(readNode&&chooseNode);
  const currentAccount=()=>auth.user?.id===ownerId&&auth.accountRevision===1;
  const izvor={
    async potreba(){sourceCalls.push('need');if(control.sourceHook)await control.sourceHook();if(control.sourceThrows)throw new Error('task unavailable');return need;},
    async prijaveZaPotrebu(){sourceCalls.push('candidates');if(control.sourceThrows)throw new Error('candidates unavailable');return [candidate];},
    izaberiPrijavu:service.applicationSelectionClientService.izaberiPrijavu,
  };
  const read=evaluate(helper.getText(source)+'\nmodule.exports = '+readNode.getText(source)+';',{
    session,id:needId,izvor,pager:null,boundedApplicationSelectionRead:service.boundedApplicationSelectionRead,
    readSelectionResult:service.readSelectionResult,currentAccount,user:auth.user,accountRevision:1,
    NO_ROWS:[],STALE_REVIEW_MESSAGE:'stale',
  });
  const choose=evaluate('module.exports = '+chooseNode.getText(source)+';',{
    session,candidate,pending:session.pending,current:()=>currentAccount()&&session.focused&&session.active,
    data:{need,candidates:[candidate],receipt:null},izvor,render:()=>{},currentAccount,
    noviZahtevId:()=>{throw new Error('An unknown pending selection must not get a new key');},
    conclusiveSelectionRefusal:service.conclusiveSelectionRefusal,
    editor:{async save(work,options){control.saveOptions=options;return work();}},
  });
  return {account,auth,need,candidate,session,calls,sourceCalls,control,service,read,choose,original};
}

test('a lost selection reply is recovered from its exact receipt without a second writer call',async()=>{
  const h=harness();h.control.selectThrows=true;
  await h.choose();assert.equal(h.session.pending.result.ok,false);
  const originalCommand=h.session.pending.command;
  const result=await h.read();
  assert.equal(result.ok,true);
  assert.deepEqual(result.podatak.receipt,{dogovorId:agreementId,agreementStatus:'CONFIRMED'});
  assert.equal(h.session.pending.result.ok,true);assert.equal(h.session.pending.command,originalCommand);
  assert.deepEqual(h.calls.map(c=>c.name),['rpc_select_response','rpc_read_selection_result']);
  assert.deepEqual(h.sourceCalls,[],'confirmed receipt does not depend on an incidental list refresh');
  assert.equal(h.calls[1].args.p_need_revision,3,'receipt stays bound to old reviewed revision, not current task revision 4');
  assert.equal(h.calls[1].args.p_covered_slots,2);
});

test('stale or unavailable current candidate list cannot hide a committed selection receipt',async()=>{
  const h=harness();h.control.sourceThrows=true;h.candidate.potrebaRevizija=99;
  const result=await h.read();assert.equal(result.ok,true);
  assert.equal(result.podatak.receipt.dogovorId,agreementId);
  assert.equal(result.podatak.need.revizija,3,'only the owned reviewed context is reused');
  assert.deepEqual(h.sourceCalls,[]);assert.deepEqual(h.calls.map(c=>c.name),['rpc_read_selection_result']);
});

test('a SELECTED list row alone and NOT_FOUND do not confirm or replace an unknown command',async()=>{
  const h=harness(absent),pending=h.session.pending,request=pending.command;
  const result=await h.read();
  assert.equal(result.ok,true);assert.equal(result.podatak.receipt,null);
  assert.equal(pending.result,h.original);assert.equal(pending.command,request);assert.equal(pending.reconciled,true);
  assert.deepEqual(h.calls.map(c=>c.name),['rpc_read_selection_result']);
});

test('checking again after NOT_FOUND finds the same committed intent without selecting again',async()=>{
  const h=harness(absent);assert.equal((await h.read()).podatak.receipt,null);
  h.control.readResult=found();const result=await h.read();
  assert.equal(result.podatak.receipt.dogovorId,agreementId);
  assert.deepEqual(h.calls.map(c=>c.name),['rpc_read_selection_result','rpc_read_selection_result']);
  assert.equal(h.calls[0].args.p_client_request_id,h.calls[1].args.p_client_request_id);
});

test('readback while a pending writer is in flight does not falsely reconcile it',async()=>{
  const h=harness();h.session.pending.inFlight=true;
  const result=await h.read();assert.equal(result.podatak.receipt,null);
  assert.equal(h.session.pending.reconciled,false);assert.equal(h.calls.length,0);
});

test('a writer settling during the incidental list read still requires exact receipt reconciliation',async()=>{
  const h=harness();h.session.pending.inFlight=true;
  h.control.sourceHook=()=>{h.session.pending.inFlight=false;};
  const result=await h.read();assert.equal(result.podatak.receipt,null);
  assert.equal(h.session.pending.reconciled,false,'no receipt RPC was read in this in-flight refresh');
  assert.equal(h.calls.length,0);assert.equal(h.session.pending.result,h.original);
});

test('foreign, partial or contradictory receipts cannot confirm the selection',async()=>{
  const bad=[{...found(),authoritative:false},{...found(),schema:'OTHER'},
    {...found(),found:false},found({agreementId:'invalid'}),found({needId:ID(9)}),
    found({needRevision:4}),found({responseId:ID(9)}),found({responseVersion:3}),
    found({contentHash:'b'.repeat(64)}),found({coveredSlots:1}),found({clientRequestId:'other-request'}),
    found({agreementStatus:'UNKNOWN'}),found({agreementStatus:null}),found({extra:true}),
    {...absent,result:undefined}];
  for(const value of bad) {
    const h=harness(value),before=h.session.pending.result;
    const result=await h.read();assert.equal(result.ok,false);
    assert.equal(h.session.pending.result,before);assert.equal(h.session.pending.reconciled,false);
    assert.deepEqual(h.calls.map(c=>c.name),['rpc_read_selection_result']);
  }
});

test('logout, changed account, blur, background and replacement pending intent fence late readback',async()=>{
  for(const alter of [h=>{h.auth.user=null;},h=>{h.auth.user={id:ID(9)};h.auth.accountRevision=2;},
    h=>{h.session.focused=false;},h=>{h.session.active=false;h.session.focusToken++;},
    h=>{h.session.pending={...h.session.pending,command:command({clientRequestId:'newer-request'})};}]) {
    const h=harness(),original=h.session.pending;
    h.control.hook=()=>alter(h);
    assert.equal((await h.read()).ok,false);
    assert.equal(original.result,h.original);assert.equal(original.reconciled,false);
  }
});

test('transport failure retains the original unknown result and a later check can recover it',async()=>{
  const h=harness();h.control.hook=()=>{throw new Error('offline');};
  assert.equal((await h.read()).ok,false);assert.equal(h.session.pending.result,h.original);
  h.control.hook=null;assert.equal((await h.read()).podatak.receipt.dogovorId,agreementId);
  assert.ok(h.calls.every(c=>c.name==='rpc_read_selection_result'));
});

test('terminal Agreement state from the reader is preserved for honest recovery presentation',async()=>{
  for(const agreementStatus of ['CANCELLED','COMPLETED','SUPERSEDED']) {
    const h=harness(found({agreementStatus})),result=await h.read();
    assert.deepEqual(result.podatak.receipt,{dogovorId:agreementId,agreementStatus});
  }
});

test('last-place and stale-review refusals settle only with the real selection SQLSTATE',async()=>{
  for(const [message,code] of [['OVERFILL','P0001'],['NEED_NOT_OPEN','P0001'],
    ['STALE_REVIEW_REQUIRED','P0001'],['APPLICATION_PRICE_BASIS_REVIEW_REQUIRED','PT409']]) {
    const h=harness();h.control.selectError={message,code};
    const outcome=await h.choose();
    assert.equal(h.service.conclusiveSelectionRefusal(outcome),true);
    assert.equal(h.control.saveOptions.settledFailure(outcome),true);
    assert.equal(outcome.kod,message);
  }
});

test('a bare rejection message, ID collision or concurrency failure remains unknown',async()=>{
  for(const error of [{message:'OVERFILL'},{message:'OVERFILL',code:'40001'},
    {message:'IDEMPOTENCY_KEY_REUSED',code:'22023'},{message:'serialization failure',code:'40001'}]) {
    const h=harness();h.control.selectError=error;
    const outcome=await h.choose();
    assert.equal(outcome.ok,false);assert.equal(h.service.conclusiveSelectionRefusal(outcome),false);
    assert.equal(h.control.saveOptions.settledFailure(outcome),false);
  }
});

test('invalid local selection identity never dispatches a read or write',async()=>{
  const h=harness();
  for(const patch of [{potrebaId:'bad'},{prijavaHash:'bad'},{prijavaVerzija:0},{mesta:0},{clientRequestId:'short'}]) {
    assert.equal((await h.service.readSelectionResult(command(patch),h.account)).ok,false);
    assert.equal((await h.service.applicationSelectionClientService.izaberiPrijavu(command(patch))).ok,false);
  }
  assert.equal(h.calls.length,0);
});

function presentationHarness() {
  const filename='src/ui/v2/ApplicationSelectionPresentation.tsx';
  const source=ts.createSourceFile(filename,fs.readFileSync(path.join(ROOT,filename),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CandidateSelectionPresentation');
  const variable=name=>component.body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(source)===name));
  const branch=component.body.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(source)==='confirmed && confirmedStatus');
  assert.ok(variable('primary')&&variable('quiet')&&branch);
  const bindings='const {confirmed,confirmedStatus,selected,busy,pending,uncertain,refresh,choose,reset,candidate,openAgreement,readAgreement,openLinkedAgreement,askToChoose,back,need}=props;';
  const js=compile(`function controls(props){${bindings}${variable('primary').getText(source)}${variable('quiet').getText(source)}return {primary,quiet};}
    function recovered(props){${bindings}const primary='OPEN_CURRENT_AGREEMENT';${branch.getText(source)}return null;}
    module.exports={controls,recovered};`,filename);
  const jsx=(type,props)=>({type,props});const module={exports:{}};
  new Function('module','exports','require','BrandAction','SelectedAgreementAction','V2Action','CHOICE_LABEL','CHOOSE_LABEL','ProductSheet','View','T','s','readableTitle',js)(
    module,module.exports,specifier=>{assert.equal(specifier,'react/jsx-runtime');return {jsx,jsxs:jsx};},
    'BrandAction','SelectedAgreementAction','V2Action','Izaberite','Izaberite','ProductSheet','View','T',{offerContent:{}},value=>value);
  return module.exports;
}
test('unknown and repeated checks are read-only, retry is separate, and refusal offers current candidates',()=>{
  const p=presentationHarness();let reads=0,writes=0,resets=0;
  const props={confirmed:false,selected:false,busy:false,pending:true,uncertain:true,candidate:{mozeIzabrati:true},
    refresh:()=>reads++,choose:()=>writes++,reset:undefined};
  const unknown=p.controls(props);assert.equal(unknown.primary.props.label,'Proverite da li je izabrano');
  unknown.primary.props.onPress();assert.equal(reads,1);assert.equal(writes,0);
  const checked=p.controls({...props,uncertain:false});
  assert.equal(checked.quiet.props.label,'Proverite ponovo');checked.quiet.props.onPress();assert.equal(reads,2);assert.equal(writes,0);
  assert.equal(checked.primary.props.label,'Pošaljite izbor ponovo');checked.primary.props.onPress();assert.equal(writes,1);
  const refused=p.controls({...props,uncertain:false,reset:()=>resets++});
  assert.equal(refused.primary.props.label,'Pregledajte prijave');refused.primary.props.onPress();
  assert.equal(resets,1);assert.equal(writes,1);
});

test('recovered terminal Agreement never renders the new-cooperation celebration or a stale remaining count',()=>{
  const p=presentationHarness();
  for(const [confirmedStatus,fragment] of [['CANCELLED','otkazana'],['COMPLETED','završena'],['SUPERSEDED','više nije aktuelan'],['CONFIRMED','aktuelne uslove']]) {
    const view=p.recovered({confirmed:true,confirmedStatus,need:{naslov:'Test zadatak'},back:()=>{}});
    assert.equal(view.type,'ProductSheet');assert.equal(view.props.title,'Izbor je sačuvan');
    assert.equal(view.props.footer(),'OPEN_CURRENT_AGREEMENT');
    const content=JSON.stringify(view.props.children());assert.ok(content.includes(fragment));
    assert.equal(content.includes('DogovorenoMoment'),false);assert.equal(content.includes('preostalo'),false);
  }
});

test('a confirmed recovered view stays visible while a later refresh is loading',()=>{
  const source=ts.createSourceFile(ROUTE,fs.readFileSync(path.join(ROOT,ROUTE),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Kandidati');
  const branch=component.body.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(source).startsWith('!candidate ||'));
  assert.ok(branch);
  const retainsList=(receipt,loading)=>evaluate('module.exports = '+branch.expression.getText(source)+';',{
    candidate:{},data:{receipt},editor:{loading},
  });
  assert.equal(retainsList({dogovorId:agreementId,agreementStatus:'COMPLETED'},true),false);
  assert.equal(retainsList(null,true),true,'unconfirmed offer still waits for coherent list read');
  assert.equal(retainsList(null,false),false);
});
