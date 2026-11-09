'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {React,RTR,createHarness,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const uiHarness=()=>createHarness({'src/store/sesija.ts':{sesijaSada:()=>({})},'src/data/supabaseClient.ts':{supabaseKlijent:()=>{throw Error('Unexpected transport');}}});
const h=uiHarness();
h.stubs['src/ui/product/ProductSheet.tsx']={ProductSheet:p=>React.createElement('ProductSheet',p,p.children(p.onClose))};
const {HomeWaitingPanel}=h.load('src/ui/home/HomeWaitingPanel.tsx');
const row=(id,target={kind:'AGREEMENT',agreementId:id})=>({id,title:'Potvrdite završetak',taskTitle:'Zadatak '+id,detail:'Završetak je označen.',target});
const home=extra=>({attention:[row('a')],attentionMore:0,attentionState:'known',allPrompts:[],partial:false,ratingsDue:0,ratingDueAgreementId:null,...extra});
async function setup(extra={}){const calls=[];const props={home:home(),stale:false,refreshing:false,onClose:()=>calls.push('close'),onOpen:t=>calls.push(t),onRatings:id=>calls.push(['rating',id]),onMyTasks:()=>calls.push('tasks'),onMyApplications:()=>calls.push('applications'),onAgreements:()=>calls.push('agreements'),onRefresh:()=>calls.push('refresh'),...extra};return{r:await mount(HomeWaitingPanel,props),calls,props};}
test('UX03 known action closes the transient panel before opening its exact target',async()=>{const s=await setup();await press(target(s.r,'Potvrdite završetak'));assert.deepEqual(s.calls,['close',{kind:'AGREEMENT',agreementId:'a'}]);await unmount(s.r);});
test('UX03 additional confirmed prompts are available without duplicating preview rows',async()=>{const s=await setup({home:home({allPrompts:[row('a'),{...row('b',{kind:'AGREEMENT_CHANGE',agreementId:'b'}),title:'Odgovorite na predlog izmene'}]})});assert.equal(nodes(s.r,n=>n.type==='ListRow'&&n.props.title==='Potvrdite završetak').length,1);await press(target(s.r,'Odgovorite na predlog izmene'));assert.deepEqual(s.calls,['close',{kind:'AGREEMENT_CHANGE',agreementId:'b'}]);await unmount(s.r);});
test('UX03 omitted server actions stay explicitly incomplete, never invented or called all',async()=>{const s=await setup({home:home({attentionMore:7})});const text=JSON.stringify(s.r.toJSON());assert.match(text,/Još /);assert.match(text,/nije prikazano/);assert.equal(nodes(s.r,n=>n.type==='ListRow').length,4);assert.doesNotMatch(text,/Prikažite sve što/);await unmount(s.r);});
test('UX03 each domain link opens the existing owned list, no new archive',async()=>{for(const [title,value]of [['Moji zadaci','tasks'],['Moje prijave','applications'],['Dogovori','agreements']]){const s=await setup();await press(target(s.r,title));assert.deepEqual(s.calls,['close',value]);await unmount(s.r);}});
test('UX03 one eligible rating opens its exact agreement while unknown count stays unknown',async()=>{const s=await setup({home:home({ratingsDue:1,ratingDueAgreementId:'r'})});await press(target(s.r,'Ocenite saradnju'));assert.deepEqual(s.calls,['close',['rating','r']]);await unmount(s.r);const u=await setup({home:home({ratingsDue:null})});assert.match(JSON.stringify(u.r.toJSON()),/nije potvrđen/);await press(target(u.r,'Proverite ocene'));assert.deepEqual(u.calls,['close',['rating',null]]);await unmount(u.r);});
test('UX03 failed, stale or incomplete reads cannot announce an empty queue',async()=>{for(const patch of [{home:home({attention:[],partial:true})},{home:home({attention:[],attentionMore:2})},{home:home({attention:[],ratingsDue:0}),stale:true}]){const s=await setup(patch);assert.doesNotMatch(JSON.stringify(s.r.toJSON()),/Trenutno nema učitanih/);await unmount(s.r);}});
test('UX03 refresh is explicit; merely opening the panel cannot execute a command',async()=>{const s=await setup();assert.deepEqual(s.calls,[]);await press(target(s.r,'Osvežite pregled'));assert.deepEqual(s.calls,['refresh']);await unmount(s.r);});
test('UX03 refresh cannot be pressed twice while it is in flight',async()=>{const s=await setup({refreshing:true});assert.equal(target(s.r,'Osvežite pregled').props.disabled,true);await unmount(s.r);});
test('UX03 overflow button actually opens the panel and leaving Home removes it',async()=>{
 const mocks=uiHarness();mocks.stubs['src/ui/home/HomeWaitingPanel.tsx']={HomeWaitingPanel:mocks.host('HomeWaitingPanel')};
 const {composeHome}=mocks.load('src/data/homeSnapshot.ts');
 const snapshot=composeHome({needs:{kind:'known',value:[]},applications:{kind:'known',value:[]},agreements:{kind:'known',value:[]}},
 {kind:'known',value:{rows:[row('a'),row('b'),row('c')],more:2,asOf:'2026-11-07T12:00:00Z',ratings:{due:0,agreementId:null}}});
 const C=mocks.load('src/ui/home/HomePresentation.tsx').HomePresentation,noop=()=>{};
 const props={active:true,home:snapshot,loading:false,refreshing:false,error:false,onPublish:noop,onEarn:noop,onProfile:noop,onOpen:noop,onRatings:noop,onMyTasks:noop,onMyApplications:noop,onRefresh:noop};
 const r=await mount(C,props);const retainedOpen=target(r,'Prikažite pregled obaveza').props.onPress;await press(target(r,'Prikažite pregled obaveza'));assert.equal(nodes(r,n=>n.type==='HomeWaitingPanel').length,1);
 await RTR.act(async()=>r.update(React.createElement(C,{...props,active:false})));assert.equal(nodes(r,n=>n.type==='HomeWaitingPanel').length,0);
 await RTR.act(async()=>retainedOpen());
 await RTR.act(async()=>r.update(React.createElement(C,props)));assert.equal(nodes(r,n=>n.type==='HomeWaitingPanel').length,0);await unmount(r);
});
test('owner pause: Home hides the legacy immediate-availability control even if its saved value is true',async()=>{
 const mocks=uiHarness();mocks.stubs['src/ui/home/HomeWaitingPanel.tsx']={HomeWaitingPanel:mocks.host('HomeWaitingPanel')};
 const {composeHome}=mocks.load('src/data/homeSnapshot.ts');
 const snapshot=composeHome({needs:{kind:'known',value:[]},applications:{kind:'known',value:[]},agreements:{kind:'known',value:[]},workerProfile:{kind:'known',value:{stanje:'ACTIVE',dostupanOdmah:true}}},
   {kind:'known',value:{rows:[],more:0,asOf:'2026-11-07T12:00:00Z',ratings:{due:0,agreementId:null}}});
 const C=mocks.load('src/ui/home/HomePresentation.tsx').HomePresentation,noop=()=>{};
 const r=await mount(C,{home:snapshot,loading:false,refreshing:false,error:false,
   onPublish:noop,onEarn:noop,onProfile:noop,onOpen:noop,onRatings:noop,
   onMyTasks:noop,onMyApplications:noop,onRefresh:noop,
   availableNow:{value:true,onEdit:()=>{throw Error('PAUSED_NOW_CONTROL_MUST_NOT_OPEN')}}});
 assert.equal(nodes(r,n=>n.type==='ListRow'&&n.props.title==='Dostupnost').length,0);
 assert.equal(nodes(r,n=>n.type==='T'&&typeof n.children?.[0]==='string'&&n.children.some(part=>typeof part==='string'&&part.includes('Mogu odmah'))).length,0);
 await unmount(r);
});
