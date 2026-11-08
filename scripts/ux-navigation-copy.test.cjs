'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {ROOT,React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function literals(file){const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),values=[];function visit(n){if(ts.isStringLiteralLike(n)||ts.isJsxText(n)||ts.isTemplateSpan(n))values.push(n.text??n.literal?.text??'');ts.forEachChild(n,visit)}visit(ast);return values.join('\n');}
test('UX05 old archive address replaces navigation with existing previous collaborations only',async()=>{const h=createHarness({'expo-router':{Redirect:p=>React.createElement('Redirect',p)}}),C=h.load('src/app/(app)/arhiva.tsx').default,r=await mount(C,{});assert.deepEqual(nodes(r,n=>n.type==='Redirect')[0].props.href,{pathname:'/dogovori',params:{odeljak:'istorija'}});assert.equal(read('src/app/(app)/arhiva.tsx').match(/from /g).length,1);await unmount(r);});
test('UX05 planner links directly to the existing history context, not generic archive',()=>{const code=read('src/app/(app)/raspored.tsx');assert.match(code,/onPreviousAgreements=\{\(\) => router\.navigate\(\{ pathname: '\/dogovori', params: \{ odeljak: 'istorija' \} \}\)\}/);assert.doesNotMatch(code,/['"]\/arhiva['"]/);});
test('UX05 planner presents previous collaborations and retains independent availability entry',()=>{const source=read('src/ui/calendar/AgendaScreen.tsx');assert.match(source,/title="Prethodne saradnje"/);assert.match(source,/onPress=\{onPreviousAgreements\}/);assert.match(source,/onPress=\{onAvailability\}/);assert.doesNotMatch(source,/onArchive|title="Arhiva"/);});
test('UX07 numeric filter describes stated price without changing the MY_PRICE business value',()=>{const code=read('src/ui/v2/discovery/DiscoverySearchPanel.tsx');assert.match(code,/Sa navedenom cenom/);assert.match(code,/Najmanja navedena cena u dinarima/);assert.match(code,/MY_PRICE/);assert.doesNotMatch(literals('src/ui/v2/discovery/DiscoverySearchPanel.tsx'),/Fiksna cena|Najmanja fiksna cena/);});
test('UX08 the two work-profile entrances name the same broad service profile',()=>{assert.match(literals('src/ui/home/HomePresentation.tsx'),/Podesite radni profil/);assert.match(literals('src/ui/profile/ProfileHubPresentation.tsx'),/Radni profil/);for(const p of ['src/ui/home/HomePresentation.tsx','src/ui/profile/ProfileHubPresentation.tsx','src/ui/workerProfile/WorkerProfilePresentation.tsx'])assert.doesNotMatch(literals(p),/profil majstora|[Pp]rofil za uskakanje/);});
test('UX08 reviewed auth, application and support commands use formal address',()=>{const paths=['src/app/auth.tsx','src/ui/v2/ApplicationComposerPresentation.tsx',...fs.readdirSync(path.join(ROOT,'src/ui/support')).filter(p=>p.endsWith('.tsx')).map(p=>'src/ui/support/'+p)];for(const p of paths){const text=literals(p);assert.doesNotMatch(text,/Poslali smo ti kod|Ako te izaberu|a ti još nemaš|zahtev povežeš|Tvoji Dogovori/);assert.doesNotMatch(text,/(?:^|\n)(?:Pošalji|Sačuvaj|Pokušaj ponovo|Proveri|Unesi|Otvori|Nastavi|Izaberi)(?:\s|\n|$)/);}});
test('owner applicant instruction: person count is supplied by the applicant, not an invented team',()=>{
 const composer=literals('src/ui/v2/ApplicationComposerPresentation.tsx');
 const people=read('src/ui/v2/ApplicationPeopleInput.tsx');
 const route=read('src/app/(app)/prilike/[id]/prijava.tsx');
 assert.match(composer,/Koliko ljudi obezbeđujete/);
 assert.match(composer,/Uključite i sebe ako dolazite/);
 assert.match(people,/Broj ljudi koje obezbeđujete/);
 assert.match(route,/pokrivenaMesta: Number\(draft.people\)/);
 assert.match(route,/people > data\.need\.pokrivenost\.preostalo/);
});

// R11: actual HowItWorks hooks/content and navigation. Native layout, gestures and TalkBack remain a device acceptance gate.
// The only persistence boundary is a synthetic AsyncStorage; no accounts, APIs or provider calls are made here.
const GUIDE_FILE='src/ui/home/HowItWorks.tsx';
function guideHarness(saved=new Map(),options={}){
 const reads=[],writes=[],timers=new Map();let sequence=0;
 const h=createHarness({'@react-native-async-storage/async-storage':{
  getItem:key=>{reads.push(key);return options.get?options.get(key):Promise.resolve(saved.get(key)??null);},
  setItem:(key,value)=>{writes.push([key,value]);if(options.set)return options.set(key,value);saved.set(key,value);return Promise.resolve();},
 }},{[GUIDE_FILE]:{setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)}});
 delete h.stubs[GUIDE_FILE];
 const guide=h.load(GUIDE_FILE);
 return{h,guide,saved,reads,writes,fire:async()=>RTR.act(async()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());})};
}
const visibleGuide=r=>nodes(r,n=>typeof n.props.testID==='string'&&/^how-it-works(?:-|$)/.test(n.props.testID));
const allText=r=>JSON.stringify(r.toJSON());

test('R11 first visit offers the six existing contexts with two accessible nonblocking choices',async()=>{
 const x=guideHarness();
 assert.equal(x.guide.HOW_IT_WORKS_TOPICS.length,6);
 for(const topic of x.guide.HOW_IT_WORKS_TOPICS){
  const r=await mount(x.guide.HowItWorks,{topic,stacked:true});
  assert.equal(visibleGuide(r).length,1,topic);
  assert.ok(allText(r).includes(x.guide.HOW_IT_WORKS_GUIDES[topic].body),topic);
  for(const label of ['Razumem','Ne prikazuj ponovo']){
   const button=target(r,label);assert.equal(button.props.accessibilityRole,'button');assert.ok(button.props.accessibilityHint);
   assert.ok(button.props.style.minHeight>=48);
  }
  assert.equal(nodes(r,n=>n.type==='Modal').length,0);await unmount(r);
 }
 assert.equal(x.writes.length,0,'Simply reading never creates a business or preference write');
});

test('R11 Razumem persists the current guide version across a new app module, without suppressing later revisions',async()=>{
 const saved=new Map(),x=guideHarness(saved),r=await mount(x.guide.HowItWorks,{topic:'tasks'});
 await press(target(r,'Razumem'));assert.equal(r.toJSON(),null);assert.equal(x.writes.length,1);
 const key=x.guide.howItWorksReceiptKey('tasks'),receipt=saved.get(key);
 assert.deepEqual(JSON.parse(receipt),{seenVersion:1,suppressed:false});await unmount(r);
 const restarted=guideHarness(saved),again=await mount(restarted.guide.HowItWorks,{topic:'tasks'});
 assert.equal(again.toJSON(),null);assert.equal(restarted.guide.howItWorksReceiptHides(receipt,2),false);
 assert.equal(restarted.writes.length,0);await unmount(again);
});

test('R11 Ne prikazuj ponovo survives future guide revisions while an APK downgrade keeps an acknowledged guide hidden',async()=>{
 const x=guideHarness(),r=await mount(x.guide.HowItWorks,{topic:'messages'});
 await press(target(r,'Ne prikazuj ponovo'));
 const receipt=x.saved.get(x.guide.howItWorksReceiptKey('messages'));
 assert.deepEqual(JSON.parse(receipt),{seenVersion:1,suppressed:true});
 assert.equal(x.guide.howItWorksReceiptHides(receipt,4),true);
 assert.equal(x.guide.howItWorksReceiptHides(JSON.stringify({seenVersion:3,suppressed:false}),1),true);
 await unmount(r);
 const restarted=guideHarness(x.saved),again=await mount(restarted.guide.HowItWorks,{topic:'messages'});
 assert.equal(again.toJSON(),null);await unmount(again);
});

test('R11 damaged, incomplete and unrelated stored values never fabricate a permanent dismissal',()=>{
 const {guide}=guideHarness();
 for(const value of [null,'1','null','[]','true','{','{}','{"seenVersion":1}','{"seenVersion":1,"suppressed":"true"}',
  '{"seenVersion":0,"suppressed":true}','{"seenVersion":1.5,"suppressed":true}'])
  assert.equal(guide.howItWorksReceiptHides(value,1),false,String(value));
});

test('R11 the older APK Home receipt remains authoritative and does not hide another screen guide',async()=>{
 const x=guideHarness(new Map([['uskoci.home.how-it-works-hidden.v1','1']]));
 const home=await mount(x.guide.HowItWorks,{topic:'home'});assert.equal(home.toJSON(),null);await unmount(home);
 const tasks=await mount(x.guide.HowItWorks,{topic:'tasks'});assert.equal(visibleGuide(tasks).length,1);
 assert.equal(x.writes.length,0,'Reading legacy preference is not a destructive migration');await unmount(tasks);
});

test('R11 a slow unread receipt does not flash a guide that was previously suppressed',async()=>{
 const read=deferred(),x=guideHarness(new Map(),{get:()=>read.promise}),r=await mount(x.guide.HowItWorks,{topic:'messages'});
 assert.equal(r.toJSON(),null);
 await RTR.act(async()=>read.resolve(JSON.stringify({seenVersion:1,suppressed:true})));
 assert.equal(r.toJSON(),null);await x.fire();assert.equal(r.toJSON(),null);await unmount(r);
});

test('R11 legacy Home suppression still wins when the new receipt read fails or hangs',async()=>{
 for(const unread of ['rejected','pending']){
  const pending=deferred(),x=guideHarness(new Map(),{get:key=>key==='uskoci.home.how-it-works-hidden.v1'
   ?Promise.resolve('1'):unread==='pending'?pending.promise:Promise.reject(Error('DEVICE_READ_FAILED'))});
  const r=await mount(x.guide.HowItWorks,{topic:'home'});assert.equal(r.toJSON(),null);
  await x.fire();assert.equal(r.toJSON(),null);await RTR.act(async()=>pending.resolve(null));assert.equal(r.toJSON(),null);await unmount(r);
 }
});

test('R11 a timed-out device read omits the guide for this visit instead of shifting an already open list',async()=>{
 const read=deferred(),x=guideHarness(new Map(),{get:()=>read.promise}),r=await mount(x.guide.HowItWorks,{topic:'agreements'});
 assert.equal(r.toJSON(),null);await x.fire();assert.equal(r.toJSON(),null);
 await RTR.act(async()=>read.resolve(null));assert.equal(r.toJSON(),null);await unmount(r);
 const again=await mount(x.guide.HowItWorks,{topic:'agreements'});assert.equal(visibleGuide(again).length,1);
 await press(target(again,'Razumem'));assert.equal(again.toJSON(),null);
 assert.equal(x.writes.length,1);await unmount(again);
});

test('R11 a late pending read cannot resurrect a guide acknowledged from another mounted occurrence',async()=>{
 const pending=deferred();let reads=0;
 const x=guideHarness(new Map(),{get:()=>++reads===1?pending.promise:Promise.resolve(null)});
 const first=await mount(x.guide.HowItWorks,{topic:'tasks'}),second=await mount(x.guide.HowItWorks,{topic:'tasks'});
 assert.equal(first.toJSON(),null);assert.equal(visibleGuide(second).length,1);
 await press(target(second,'Razumem'));assert.equal(second.toJSON(),null);
 await RTR.act(async()=>pending.resolve(null));assert.equal(first.toJSON(),null);assert.equal(second.toJSON(),null);
 assert.equal(x.writes.length,1);await unmount(first);await unmount(second);
});

test('R11 timed-out and retired topic receipts cannot flash old guidance or change the new topic',async()=>{
 const tasks=deferred(),messages=deferred(),x=guideHarness(new Map(),{get:key=>key.endsWith('.tasks')?tasks.promise:messages.promise});
 const C=x.guide.HowItWorks,r=await mount(C,{topic:'tasks'});await x.fire();assert.equal(r.toJSON(),null);
 await RTR.act(async()=>r.update(React.createElement(C,{topic:'messages'})));assert.equal(r.toJSON(),null,'No old-topic flash');
 await RTR.act(async()=>tasks.resolve(JSON.stringify({seenVersion:1,suppressed:true})));assert.equal(r.toJSON(),null);
 await x.fire();assert.equal(r.toJSON(),null);
 await RTR.act(async()=>messages.resolve(JSON.stringify({seenVersion:1,suppressed:true})));assert.equal(r.toJSON(),null);await unmount(r);
});

test('R11 failed device storage holds the explicit choice for this run, including an account remount, without claiming a durable save',async()=>{
 const x=guideHarness(new Map(),{set:()=>Promise.reject(Error('DEVICE_WRITE_FAILED'))});
 const C=x.guide.HowItWorks,r=await mount(C,{topic:'workerProfile',key:'account-a'});
 await press(target(r,'Ne prikazuj ponovo'));assert.equal(r.toJSON(),null);
 await RTR.act(async()=>r.update(React.createElement(C,{topic:'workerProfile',key:'account-b'})));
 assert.equal(r.toJSON(),null);assert.equal(x.writes.length,1);assert.doesNotMatch(JSON.stringify(x.writes),/account-a|account-b/);
 await unmount(r);x.guide.forgetHiddenHowItWorks();
 const restarted=await mount(C,{topic:'workerProfile'});assert.equal(visibleGuide(restarted).length,1);await unmount(restarted);
});

test('R11 failed storage reads stay quiet without falsely persisting seen state and can recover on another visit',async()=>{
 for(const failure of ['throw','reject']){
  let failing=true;
  const x=guideHarness(new Map(),{get:()=>{if(!failing)return Promise.resolve(null);if(failure==='throw')throw Error('READ_FAILED');return Promise.reject(Error('READ_FAILED'));}});
  const r=await mount(x.guide.HowItWorks,{topic:'tasks'});assert.equal(r.toJSON(),null);await unmount(r);
  assert.equal(x.writes.length,0);failing=false;
  const recovered=await mount(x.guide.HowItWorks,{topic:'tasks'});assert.equal(visibleGuide(recovered).length,1);await unmount(recovered);
 }
});

test('R11 simultaneous taps make one preference write and every mounted occurrence observes it',async()=>{
 const x=guideHarness(),C=x.guide.HowItWorks,r=await mount(()=>React.createElement(React.Fragment,null,
  React.createElement(C,{topic:'tasks'}),React.createElement(C,{topic:'tasks'})),{});
 const acknowledge=nodes(r,n=>n.props.accessibilityLabel==='Razumem')[0].props.onPress;
 const suppress=nodes(r,n=>n.props.accessibilityLabel==='Ne prikazuj ponovo')[0].props.onPress;
 await RTR.act(async()=>{acknowledge();suppress();});assert.equal(r.toJSON(),null);
 assert.equal(x.writes.length,1);assert.deepEqual(JSON.parse(x.writes[0][1]),{seenVersion:1,suppressed:false});await unmount(r);
});

test('R11 a known local guide preserves its visibility on list remount without repeated device reads',async()=>{
 const x=guideHarness(),r=await mount(x.guide.HowItWorks,{topic:'tasks'});assert.equal(visibleGuide(r).length,1);await unmount(r);
 const count=x.reads.length,again=await mount(x.guide.HowItWorks,{topic:'tasks'});
 assert.equal(visibleGuide(again).length,1);assert.equal(x.reads.length,count);await unmount(again);
});

test('R11 manual Kako radi reads the same six bundled guides offline and never clears any choice',async()=>{
 const x=guideHarness(new Map(),{get:()=>{throw Error('NO_STORAGE_IN_REFERENCE');},set:()=>{throw Error('NO_WRITE_IN_REFERENCE');}});
 const r=await mount(x.guide.HowItWorksReference,{});
 for(const topic of x.guide.HOW_IT_WORKS_TOPICS)assert.ok(allText(r).includes(x.guide.HOW_IT_WORKS_GUIDES[topic].body),topic);
 for(const text of ['Jedan nalog i jedna reputacija','AI razumeo','pošaljite prijavu'])assert.ok(allText(r).includes(text),text);
 assert.equal(nodes(r,n=>n.props.accessibilityLabel==='Ne prikazuj ponovo').length,0);
 assert.deepEqual([x.reads.length,x.writes.length],[0,0]);await unmount(r);
});

test('R11 settings opens the single manual guide through its existing navigation callback',async()=>{
 const h=createHarness(),C=h.load('src/ui/settings/AccountSettingsPresentation.tsx').AccountSettings,calls=[];
 const props={busy:false,logoutError:false,words:{},open:path=>calls.push(path),onBack:()=>{},onLogout:()=>{}};
 const r=await mount(C,props);await press(target(r,'Kako radi'));assert.deepEqual(calls,['/profil/kako-radi']);
 await RTR.act(async()=>r.update(React.createElement(C,{...props,busy:true})));assert.equal(target(r,'Kako radi').props.disabled,true);await unmount(r);
});

test('R11 the real manual route fences stale and repeated Back and retains its Settings fallback',async()=>{
 for(const canGoBack of [true,false]){
  const x=guideHarness(),calls=[],focus={};
  x.h.stubs['expo-router']={router:{canGoBack:()=>canGoBack,back:()=>calls.push('back'),replace:path=>calls.push(path)},
   useFocusEffect:fn=>React.useEffect(()=>{focus.cleanup=fn();return()=>focus.cleanup?.();},[fn])};
  x.h.stubs['src/ui/settings/SettingsPresentation.tsx']={SettingsScreen:x.h.host('SettingsScreen')};
  const C=x.h.load('src/app/(app)/profil/kako-radi.tsx').default,r=await mount(C,{});
  const back=nodes(r,n=>n.type==='SettingsScreen')[0].props.onBack;
  await RTR.act(async()=>{back();back();});assert.deepEqual(calls,[canGoBack?'back':'/profil/podesavanja']);
  await RTR.act(async()=>focus.cleanup());back();assert.equal(calls.length,1);
  assert.deepEqual([x.reads.length,x.writes.length],[0,0]);await unmount(r);
 }
});

test('R11 manual help is a hidden detail destination and cannot become a fifth tab',()=>{
 assert.match(read('src/app/(app)/_layout.tsx'),/<Tabs\.Screen name="profil\/kako-radi" options=\{\{ href: null, \.\.\.FULL \}\} \/>/);
});

test('R11 contextual messages are in the scroll header and step aside for an unavailable inbox',async()=>{
 const h=createHarness();h.native.FlatList=p=>React.createElement('FlatList',p,p.ListHeaderComponent);
 h.stubs['src/ui/system/StateView.tsx']={StateView:h.host('StateView')};
 const C=h.load('src/ui/messages/ConversationInboxPresentation.tsx').ConversationInboxPresentation;
 const props={items:null,loading:true,refreshing:false,error:false,paging:false,pageError:false,hasMore:false,onOpen:()=>{},onRefresh:()=>{},onLoadMore:()=>{}};
 const r=await mount(C,props);assert.equal(nodes(r,n=>n.type==='HowItWorks').length,0);
 await RTR.act(async()=>r.update(React.createElement(C,{...props,items:[],loading:false})));
 assert.equal(nodes(r,n=>n.type==='HowItWorks')[0].props.topic,'messages');
 await RTR.act(async()=>r.update(React.createElement(C,{...props,items:[],loading:false,error:true})));
 assert.equal(nodes(r,n=>n.type==='HowItWorks').length,0);await unmount(r);
});

test('R11 saved profile guide does not duplicate the pristine setup introduction or dilute suspension',async()=>{
 const h=createHarness();
 h.stubs['src/ui/system/tokens.ts'].sys.conversation={};
 for(const [file,name]of [['src/ui/system/DetailTopBar.tsx','DetailTopBar'],['src/ui/system/ConversationArt.tsx','ConversationArt'],
  ['src/ui/system/StateView.tsx','StateView'],['src/ui/v2/QuietReadState.tsx','QuietReadState'],['src/ui/workerProfile/WorkerProfileSaved.tsx','WorkerProfileSaved']])h.stubs[file]={[name]:h.host(name)};
 h.stubs['react-native-safe-area-context']={SafeAreaView:h.host('SafeAreaView')};
 const C=h.load('src/ui/workerProfile/WorkerProfilePresentation.tsx').WorkerProfileForm;
 const props={draft:{},change:()=>{},navigate:()=>{},disabled:false,status:null,profileExists:false};
 const r=await mount(C,props);assert.equal(nodes(r,n=>n.type==='HowItWorks').length,0);assert.equal(nodes(r,n=>n.props.testID==='worker-profile-intro').length,1);
 await RTR.act(async()=>r.update(React.createElement(C,{...props,profileExists:true,status:'ACTIVE'})));
 assert.equal(nodes(r,n=>n.type==='HowItWorks')[0].props.topic,'workerProfile');assert.equal(nodes(r,n=>n.type==='WorkerProfileSaved').length,1);
 await RTR.act(async()=>r.update(React.createElement(C,{...props,profileExists:true,status:'SUSPENDED'})));
 assert.equal(nodes(r,n=>n.type==='HowItWorks').length,0);assert.equal(nodes(r,n=>n.type==='WorkerProfileSaved').length,1);await unmount(r);
});

test('R11 Agreement guidance stays inside the scroll list and does not compete with search, history or read recovery',async()=>{
 const h=createHarness();h.native.Keyboard={dismiss:()=>{}};
 h.native.FlatList=p=>React.createElement('FlatList',p,p.ListHeaderComponent);
 h.stubs['react-native-safe-area-context']={SafeAreaView:h.host('SafeAreaView')};
 h.stubs['src/ui/system/ScreenChrome.tsx']={ChromeIconButton:h.host('ChromeIconButton'),ScreenChrome:h.host('ScreenChrome')};
 for(const [file,name]of [['src/ui/system/StateView.tsx','StateView'],['src/ui/agreements/AgreementRoleRail.tsx','AgreementRoleRail'],
  ['src/ui/v2/QuietReadState.tsx','QuietReadState'],['src/ui/agreements/GroupHeader.tsx','GroupHeader'],['src/ui/v2/discovery/SearchParts.tsx','SearchField']])h.stubs[file]={[name]:h.host(name)};
 const C=h.load('src/ui/v2/AgreementCollectionPresentation.tsx').AgreementCollectionPresentation;
 const props={items:[],section:'active',confirmationOnly:false,loading:false,error:false,
  onSection:()=>{},onConfirmationOnly:()=>{},onRefresh:()=>{},onOpen:()=>{},onCalendar:()=>{},onProfile:()=>{},onHome:()=>{}};
 const r=await mount(C,props);assert.equal(nodes(r,n=>n.type==='HowItWorks')[0].props.topic,'agreements');
 for(const patch of [{loading:true},{error:true},{section:'history'},{search:{open:true,query:'',onToggle:()=>{},onChange:()=>{}}}]){
  await RTR.act(async()=>r.update(React.createElement(C,{...props,...patch})));assert.equal(nodes(r,n=>n.type==='HowItWorks').length,0);
 }
 await unmount(r);
});
