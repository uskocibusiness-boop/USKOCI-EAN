'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {React,RTR,createHarness,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const h=createHarness();
const {agreementMatchesSearch:match,agreementSearchQuery:query,agreementGroupMatchesSearch:groupMatch,prioritizeAgreementSearch:prioritize}=h.load('src/ui/agreements/agreementSearch.ts');
const {visibleAgreementTaskGroups:visible,cancelledIdsForVisibleAgreementGroups:cancelled}=h.load('src/ui/agreements/optionalReadScope.ts');
const {groupAgreementTasks}=h.load('src/ui/agreements/agreementListModel.ts');
const row=(id,patch={})=>({id,naslov:'Selidba stana',stanje:'CONFIRMED',rezim:'FIZICKI',izvor:{zadatakId:'task-'+id},verzija:1,
 ucesnici:[{viSte:true,ime:'Vlasnik',uloga:'narucilac'},{viSte:false,ime:'Marko Živković',uloga:'uskocer'}],
 putanjaTekst:'Liman · Novi Sad',cena:{prikaz:'1.200 RSD'},ocenaMoguca:false,izmenaCeka:null,prihvacenPocetak:'2026-11-09T08:00:00Z',tacanTermin:null,...patch});
const view={section:'active',roleFilter:'all',confirmationOnly:false,historyFilter:'all',searchQuery:''};
test('UX06 searches task title, other person and rendered coarse place',()=>{const r=row('a');for(const q of ['Selidba','marko','liman','Novi Sad','marko selidba'])assert.equal(match(r,q),true,q);});
test('UX06 Serbian Latin/Cyrillic and accents normalize consistently',()=>{const r=row('a');for(const q of ['МАРКО','Живковић','zivkovic','НОВИ САД',' selidba   STANA '])assert.equal(match(r,q),true,q);});
test('UX06 own name, IDs, phone, messages, exact address and coordinates are never indexed',()=>{
 const r=row('a',{id:'hiddenidentity',telefon:'hiddenphone',tacnaAdresa:'hiddensecretstreet',tacnaLokacija:{latitude:45.123456,longitude:19.765432},poruke:'hiddenmessage'});
 for(const q of ['Vlasnik','hiddenidentity','hiddenphone','hiddensecretstreet','45.123456','19.765432','hiddenmessage','task-a'])assert.equal(match(r,q),false,q);
});
test('UX06 REMOTE matches its displayed mode, not obsolete physical label',()=>{const r=row('a',{rezim:'DALJINSKI'});assert.equal(match(r,'na daljinu'),true);assert.equal(match(r,'Liman'),false);});
test('UX06 empty query is identity and terms must all match the same authorized record',()=>{assert.equal(match(row('a'),''),true);assert.equal(match(row('a'),'marko nepostojeci'),false);assert.equal(query('x'.repeat(200)).length,120);});
test('UX06 group search retains siblings and cannot move a cancelled sibling into history',()=>{
 const a=row('a',{izvor:{zadatakId:'same'}}),b=row('b',{izvor:{zadatakId:'same'},stanje:'CANCELLED',ucesnici:[a.ucesnici[0],{viSte:false,ime:'Ana',uloga:'uskocer'}]});
 const groups=visible([a,b],{...view,searchQuery:'Ana'});assert.equal(groups.length,1);assert.deepEqual(groups[0].items,[a,b]);assert.deepEqual(cancelled(groups,'active','all'),['b']);
 assert.equal(visible([a,b],{...view,section:'history',searchQuery:'Ana'}).length,0);
});
test('UX06 role, confirmation and history outcome remain effective under search',()=>{
 const completed=row('a',{stanje:'COMPLETED'}),worker=row('b',{ucesnici:[{viSte:true,ime:'Vlasnik',uloga:'uskocer'},{viSte:false,ime:'Marko',uloga:'narucilac'}]});
 assert.equal(visible([completed,worker],{...view,roleFilter:'narucilac',searchQuery:'Marko'}).length,0);
 assert.equal(visible([worker],{...view,confirmationOnly:true,searchQuery:'Marko'}).length,0);
 assert.equal(visible([completed],{...view,section:'history',historyFilter:'completed',searchQuery:'Marko'}).length,1);
 assert.equal(visible([completed],{...view,section:'history',historyFilter:'cancelled',searchQuery:'Marko'}).length,0);
});
test('UX06 completed-only history does not match a cancelled sibling name',()=>{
 const a=row('a',{stanje:'COMPLETED',izvor:{zadatakId:'same'}}),b=row('b',{stanje:'CANCELLED',izvor:{zadatakId:'same'},ucesnici:[a.ucesnici[0],{viSte:false,ime:'Ana',uloga:'uskocer'}]});
 assert.equal(groupMatch(groupAgreementTasks([a,b])[0],'Ana','completed'),false);assert.equal(groupMatch(groupAgreementTasks([a,b])[0],'Ana','cancelled'),true);
});
test('UX06 matched collaborator is first without mutation, duplication or loss of accepted siblings',()=>{
 const rows=Array.from({length:5},(_,i)=>row(String(i),{ucesnici:[row('x').ucesnici[0],{viSte:false,ime:'Osoba'+i,uloga:'uskocer'}]})),before=JSON.stringify(rows);
 const ordered=prioritize(rows,'Osoba4');assert.equal(ordered[0],rows[4]);assert.deepEqual(ordered.slice(1),rows.slice(0,4));assert.equal(JSON.stringify(rows),before);assert.equal(prioritize(rows,''),rows);
});
async function setup(patch={}){
 const mocks=createHarness();mocks.native.Keyboard={dismiss:()=>{}};
 mocks.native.FlatList=p=>React.createElement('FlatList',p,p.data.length?p.data.map((item,index)=>React.createElement(React.Fragment,{key:item.id},p.renderItem({item,index}))):p.ListEmptyComponent,p.ListFooterComponent);
 for(const [file,exportName]of [['src/ui/system/ScreenChrome.tsx','ChromeIconButton'],['src/ui/system/StateView.tsx','StateView'],['src/ui/agreements/AgreementRoleRail.tsx','AgreementRoleRail'],['src/ui/agreements/AgreementListCard.tsx','AgreementTaskRow'],['src/ui/agreements/GroupHeader.tsx','GroupHeader'],['src/ui/v2/QuietReadState.tsx','QuietReadState'],['src/ui/v2/discovery/SearchParts.tsx','SearchField']])mocks.stubs[file]={[exportName]:mocks.host(exportName)};
 mocks.stubs['src/ui/system/ScreenChrome.tsx'].ScreenChrome=mocks.host('ScreenChrome');
 mocks.stubs['react-native-safe-area-context']={SafeAreaView:mocks.host('SafeAreaView')};
 const C=mocks.load('src/ui/v2/AgreementCollectionPresentation.tsx').AgreementCollectionPresentation;
 const calls=[];const props={items:[row('a'),row('b',{naslov:'Montaža',ucesnici:[row('a').ucesnici[0],{ime:'Ana',viSte:false,uloga:'uskocer'}]})],section:'active',confirmationOnly:false,loading:false,error:false,now:new Date('2026-11-07T18:00:00Z'),
  onSection:x=>calls.push(['section',x]),onConfirmationOnly:x=>calls.push(['confirmation',x]),onRefresh:()=>calls.push(['refresh']),onOpen:x=>calls.push(['open',x.id]),onCalendar:()=>calls.push(['calendar']),onProfile:()=>{},onHome:()=>{},...patch};
 const r=await mount(C,props);return{r,C,props,calls,update:async p=>{Object.assign(props,p);await RTR.act(async()=>r.update(React.createElement(C,props)));},stop:()=>unmount(r)};
}
const data=r=>nodes(r,n=>n.type==='FlatList')[0].props.data.filter(x=>x.kind==='item');
const input=r=>nodes(r,n=>n.type==='SearchField')[0];
const enter=async(r,q)=>RTR.act(async()=>input(r).props.onChangeText(q));
test('UX06 magnifier opens one field, narrows groups and exact original record opens',async()=>{
 const h=await setup();assert.equal(input(h.r),undefined);await press(target(h.r,'Pretražite Dogovore'));assert.ok(input(h.r));await enter(h.r,'Ana');assert.equal(data(h.r).length,1);assert.equal(data(h.r)[0].task.items[0].id,'b');
 const card=nodes(h.r,n=>n.type==='AgreementTaskRow')[0];await RTR.act(async()=>card.props.onOpen(card.props.group.items[0]));assert.deepEqual(h.calls,[['open','b']]);await h.stop();
});
test('UX06 clear preserves role and outcome choices while restoring groups',async()=>{
 const h=await setup({roleFilter:'narucilac',historyFilter:'completed'});await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'Ana');await enter(h.r,'');assert.equal(data(h.r).length,2);assert.deepEqual(h.calls,[]);await h.stop();
});
test('UX06 no match offers clear, not a claim of no collaborations',async()=>{
 const h=await setup();await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'nepostojeci');
 const empty=target(h.r,'Nema rezultata u ovom pregledu');await RTR.act(async()=>empty.props.primary.onPress());assert.equal(data(h.r).length,2);await h.stop();
});
for(const flag of ['refreshError','refreshing'])test('UX06 '+flag+' does not declare complete no-results',async()=>{
 const h=await setup({[flag]:true});await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'nepostojeci');assert.ok(target(h.r,'Rezultati pretrage nisu potvrđeni'));assert.equal(nodes(h.r,n=>n.props.title==='Nema rezultata u ovom pregledu').length,0);await h.stop();
});
test('UX06 error/loading hide search results and preserve recovery',async()=>{
 const h=await setup();await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'Ana');await h.update({error:true});assert.equal(data(h.r).length,0);assert.ok(target(h.r,'Ne možemo da učitamo Dogovore'));
 await h.update({error:false,loading:true});assert.equal(data(h.r).length,0);assert.ok(target(h.r,'Učitavamo Dogovore…'));await h.stop();
});
test('UX06 history uses separate query and does not leak active results',async()=>{
 const h=await setup({items:[row('a'),row('b',{stanje:'COMPLETED',naslov:'Montaža'})]});await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'Selidba');
 await h.update({section:'history'});assert.equal(input(h.r),undefined);await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'Montaža');assert.equal(data(h.r)[0].task.items[0].id,'b');
 await h.update({section:'active'});assert.equal(input(h.r).props.value,'Selidba');assert.equal(data(h.r)[0].task.items[0].id,'a');await h.stop();
});
test('UX06 closing search clears its filter, and normal scroll survives search',async()=>{
 const h=await setup();await RTR.act(async()=>nodes(h.r,n=>n.type==='FlatList')[0].props.onScroll({nativeEvent:{contentOffset:{y:420}}}));
 await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'Ana');assert.equal(nodes(h.r,n=>n.type==='FlatList')[0].props.contentOffset.y,0);
 await press(target(h.r,'Zatvorite pretragu Dogovora'));assert.equal(input(h.r),undefined);assert.equal(data(h.r).length,2);assert.equal(nodes(h.r,n=>n.type==='FlatList')[0].props.contentOffset.y,420);await h.stop();
});
test('UX06 empty initial list has no useless search control',async()=>{const h=await setup({items:[]});assert.equal(nodes(h.r,n=>n.props.label==='Pretražite Dogovore').length,0);await h.stop();});

const sectionTabs=r=>nodes(r,n=>n.type==='Segmented'&&n.props.options?.some(option=>option.key==='history'));
const historyLinks=r=>nodes(r,n=>n.type==='Press'&&n.props.accessibilityLabel==='Prethodne saradnje');
test('Agreement history has one entry when the upper section selector is available, including filtered-empty results',async()=>{
 const h=await setup({confirmationOnly:true});
 assert.equal(sectionTabs(h.r).length,1);assert.equal(historyLinks(h.r).length,0);
 await press(target(h.r,'Pretražite Dogovore'));await enter(h.r,'nepostojeci');assert.equal(data(h.r).length,0);
 assert.equal(sectionTabs(h.r).length,1);assert.equal(historyLinks(h.r).length,0);
 await RTR.act(async()=>sectionTabs(h.r)[0].props.onChange('history'));
 assert.deepEqual(h.calls,[['section','history'],['confirmation',false]]);await h.stop();
});
test('Agreement empty source keeps history access when the upper selector is absent',async()=>{
 const h=await setup({items:[]});assert.equal(sectionTabs(h.r).length,0);assert.equal(historyLinks(h.r).length,1);
 await press(target(h.r,'Prethodne saradnje'));assert.deepEqual(h.calls,[['section','history'],['confirmation',false]]);
 await h.update({section:'history'});assert.equal(historyLinks(h.r).length,0);
 const chrome=nodes(h.r,n=>n.type==='ScreenChrome')[0];await RTR.act(async()=>chrome.props.onBack());
 assert.deepEqual(h.calls.at(-1),['section','active']);await h.stop();
});
test('Agreement history access survives stale reads and recovers after loading or failure',async()=>{
 const h=await setup({refreshError:true});assert.equal(sectionTabs(h.r).length,1);assert.equal(historyLinks(h.r).length,0);
 await h.update({items:[]});assert.equal(historyLinks(h.r).length,1);
 for(const state of [{loading:true,error:false},{loading:false,error:true}]){
  await h.update(state);assert.equal(sectionTabs(h.r).length,0);assert.equal(historyLinks(h.r).length,0);
 }
 await h.update({loading:false,error:false,refreshError:false});assert.equal(historyLinks(h.r).length,1);await h.stop();
});

const {agreementMenuActions, MENU_WAIT_REASON}=h.load('src/ui/agreements/agreementMenu.ts');
const menuInput={party:true,hasOther:true,active:true,requester:true,canChange:true,hasLocation:true,problemFree:true,enabled:true};
const menuLabels={task:'Otvorite izvorni zadatak',change:'Promenite termin ili uslove',location:'Tačna adresa i lokacija',problem:'Prijavite problem u Dogovoru',cancel:'Otkažite Dogovor',safety:'Prijavite ili blokirajte osobu'};
const menuCommandNames={task:'onOpenTask',change:'onChange',location:'onLocation',problem:'onProblem',cancel:'onCancel',safety:'onSafety'};
test('Agreement menu uses professional actions for both roles and preserves each original command',()=>{
 const calls=[];const commands=Object.fromEntries(Object.entries(menuCommandNames).map(([key,name])=>[name,()=>calls.push(key)]));
 for(const requester of [true,false]){
  const actions=agreementMenuActions({...menuInput,requester},commands);
  const keys=requester?['task','change','location','problem','cancel','safety']:['task','change','problem','cancel','safety'];
  assert.deepEqual(actions.map(x=>x.key),keys);assert.deepEqual(calls,[]);
  for(const action of actions){assert.equal(action.label,menuLabels[action.key]);assert.equal(action.disabled,false);assert.equal(action.onPress,commands[menuCommandNames[action.key]]);action.onPress();}
  assert.deepEqual(calls.splice(0),keys);assert.deepEqual(actions.filter(x=>x.destructive).map(x=>x.key),['cancel','safety']);
 }
});
test('Agreement menu keeps unauthorized, terminal, problem and pending-command boundaries',()=>{
 const noop=()=>{};const commands=Object.fromEntries(Object.values(menuCommandNames).map(name=>[name,noop]));
 assert.deepEqual(agreementMenuActions({...menuInput,party:false},commands),[]);
 assert.deepEqual(agreementMenuActions({...menuInput,active:false},commands).map(x=>x.key),['task','safety']);
 assert.deepEqual(agreementMenuActions({...menuInput,canChange:false,problemFree:false},commands).map(x=>x.key),['task','location','safety']);
 for(const action of agreementMenuActions({...menuInput,enabled:false},commands)){assert.equal(action.disabled,true);assert.equal(action.reason,MENU_WAIT_REASON);}
});

async function completionSetup(worker,patch={}){
 const mocks=createHarness();
 mocks.stubs['src/ui/product/ProductSheet.tsx']={ProductSheet:p=>React.createElement('ProductSheet',p,p.children(),p.footer())};
 mocks.stubs['src/ui/product/ProductDetails.tsx']={ProductFacts:mocks.host('ProductFacts'),ProductFact:mocks.host('ProductFact')};
 const Component=mocks.load('src/ui/agreements/AgreementCompletionReview.tsx').AgreementCompletionReview;
 const calls=[];const agreement=row('accepted',{vremeTekst:'10. novembar u 14:00',pokrivenost:{popunjeno:2},osnovaCene:'HOURLY',problemOtvoren:true,...patch});
 const r=await mount(Component,{agreement,worker,confirm:()=>calls.push('confirm'),back:()=>calls.push('back')});
 return{r,calls,agreement,stop:()=>unmount(r)};
}
for(const worker of [true,false])test('Agreement completion '+(worker?'worker':'owner')+' preserves accepted facts and confirms only after explicit action',async()=>{
 const h=await completionSetup(worker);
 const facts=nodes(h.r,n=>n.type==='ProductFact');
 assert.deepEqual(facts.map(n=>[n.props.label,n.props.value]),[
  ['Dogovoreni termin','10. novembar u 14:00'],['Dogovoreni broj ljudi','2 osobe'],['Sačuvani iznos · po osobi po satu','1.200 RSD']]);
 const copy=nodes(h.r,n=>n.type==='T').flatMap(n=>n.children).filter(x=>typeof x==='string');
 assert.ok(copy.includes(worker?'Prijavljeni problem ostaje sačuvan. Automatski završetak je zaustavljen.':'Prijavljeni problem ostaje sačuvan. Ovom potvrdom ipak završavate Dogovor; problem sam po sebi ne određuje krivicu ili dug.'));
 assert.deepEqual(h.calls,[]);
 await press(target(h.r,worker?'Da, zadatak je gotov':'Da, potvrdite završetak'));assert.deepEqual(h.calls,['confirm']);
 await RTR.act(async()=>nodes(h.r,n=>n.type==='ProductSheet')[0].props.onClose());assert.deepEqual(h.calls,['confirm','back']);await h.stop();
});
test('Agreement completion never invents a price or basis when accepted metadata is absent',async()=>{
 const h=await completionSetup(false,{cena:{prikaz:''},osnovaCene:null,problemOtvoren:false});
 const price=nodes(h.r,n=>n.type==='ProductFact'&&n.props.art==='money')[0];
 assert.equal(price.props.value,'Iznos nije sačuvan');assert.equal(price.props.label,'Sačuvani iznos · osnovica cene nije potvrđena');assert.equal(price.props.prominentAs,'label');assert.deepEqual(h.calls,[]);await h.stop();
});
