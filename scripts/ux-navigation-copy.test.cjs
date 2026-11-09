'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {ROOT,React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
// Actual saved-profile route and owned editor; only native widgets/read services are fixtures.
// Entry into signed preparation is not an activation write or installed-Android proof.
const WORKER_AREA_CITY={kind:'CITY',countryCode:'RS',label:'Novi Sad',city:'Novi Sad',sourceRef:'osm:relation:123',latitude:45.26,longitude:19.84,radiusKm:null};
test('account hub retains saved work areas in its mixed-mode Worker subtitle',async()=>{
 const session={user:{id:'owner'},accountRevision:1};
 const profile={id:'worker',stanje:'ACTIVE',ime:'Milan',grad:'',radijusKm:0,
  vestine:['Kurirske dostave','Nabavka i kupovina','Nošenje kutija','Košenje trave','Utovar i istovar','PowerPoint','Pomoć pri selidbi'],workAreas:[WORKER_AREA_CITY]};
 const identity={accountId:'owner',profileId:'requester',kind:'REQUESTER',ime:'Milan',grad:null,stanje:'ACTIVE'};
 const source={mojRadnikProfil:async()=>profile};
 const h=createHarness({
  'expo-router':{router:{},useFocusEffect:fn=>React.useEffect(fn,[fn])},
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/store/uloga.ts':{useIzvor:()=>source},
  'src/data/ownProfileClientService.ts':{ownProfileClientService:{read:async()=>identity}},
  'src/data/publicProfileClientService.ts':{publicProfileClientService:{}},
  'src/data/authClientService.ts':{authClientService:{signOutLocal:async()=>{throw Error('UNEXPECTED_LOGOUT');}}},
  'src/ui/system/ConfirmSheet.tsx':{useConfirmSheet:()=>({close:closeNoop,sheet:null})},
  'src/hooks/useWorkerExecutionModes.ts':{useWorkerExecutionModes:()=>({view:{kind:'confirmed',modes:['ON_SITE','REMOTE']}})},
  'src/ui/profile/useHubStates.ts':{useHubStates:()=>({})},
  'src/ui/profile/hubStates.ts':{hubWords:()=>({})},
 });
 h.native.AppState={currentState:'active',addEventListener:()=>({remove(){}})};
 for(const [file,name]of [['src/ui/reviews/AccountReputation.tsx','AccountReputation'],['src/ui/media/ContextPhotos.tsx','ProfilePhoto'],
  ['src/ui/profile/ProfileWorkSummary.tsx','ProfileWorkSummary'],['src/ui/system/PublicProfileSheet.tsx','PublicProfileSheet'],
  ['src/ui/profile/ProfileHubPresentation.tsx','ProfileHub']])h.stubs[file]={[name]:h.host(name),PROFILE_AVATAR:48};
 const r=await mount(h.load('src/app/(app)/profil.tsx').default,{});
 try{assert.equal(nodes(r,n=>n.type==='ProfileHub')[0].props.capabilityDetail,
  'Aktivan · Kurirske dostave +6 · Na daljinu · Dolazak: Novi Sad');}
 finally{await unmount(r);}
});

function closeNoop(){}

// Actual profile route, presentation and confirmation flow; account reads and Auth
// are synthetic. This verifies admission and command ownership, not native layout.
async function accountMenuRoute({empty=false,readFailure=false,logout=async()=>{}}={}){
 const session={user:{id:'owner',email:'owner@example.test'},accountRevision:1},calls=[],routes=[],effects=new Set();
 const profile=empty?null:{id:'worker',stanje:'ACTIVE',ime:'Milan',grad:'',radijusKm:0,
  vestine:['Kurirske dostave'],workAreas:[WORKER_AREA_CITY]};
 const identity=empty?null:{accountId:'owner',profileId:'requester',kind:'REQUESTER',ime:'Milan',grad:null,stanje:'ACTIVE'};
 const source={mojRadnikProfil:async()=>profile};
 const h=createHarness({
  'expo-router':{router:{navigate:path=>routes.push(path),push:path=>routes.push(path),canGoBack:()=>false,replace:path=>routes.push(path)},
   useFocusEffect:fn=>React.useEffect(()=>{const cleanup=fn();effects.add(cleanup);return()=>{effects.delete(cleanup);cleanup?.();};},[fn])},
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/store/uloga.ts':{useIzvor:()=>source},
  'src/data/ownProfileClientService.ts':{ownProfileClientService:{read:async()=>{if(readFailure)throw Error('OFFLINE');return identity;}}},
  'src/data/publicProfileClientService.ts':{publicProfileClientService:{}},
  'src/data/authClientService.ts':{authClientService:{signOutLocal:async scope=>{calls.push(scope);return logout();}}},
  'src/hooks/useWorkerExecutionModes.ts':{useWorkerExecutionModes:()=>({view:{kind:'confirmed',modes:['ON_SITE']}})},
  'src/ui/system/motion.ts':{useReducedMotion:()=>true},
 });
 h.native.AppState={currentState:'active',addEventListener:()=>({remove(){}})};
 h.native.Modal='Modal';h.native.Pressable='Pressable';h.native.useWindowDimensions=()=>({width:360,height:800});
 h.native.Easing={bezier:()=>()=>0};h.native.Animated={View:'AnimatedView',Value:class{setValue(){}},timing:()=>({start(){},stop(){}})};
 h.stubs['src/ui/system/tokens.ts'].sheetLift={detached:{}};
 for(const [file,names]of [
  ['src/ui/reviews/AccountReputation.tsx',['AccountReputation']],['src/ui/media/ContextPhotos.tsx',['ProfilePhoto']],
  ['src/ui/profile/ProfileWorkSummary.tsx',['ProfileWorkSummary']],['src/ui/system/PublicProfileSheet.tsx',['PublicProfileSheet']],
  ['src/ui/system/Avatar.tsx',['Avatar','FaceEdge']],['src/ui/product/ProductSheet.tsx',['ProductSheet']],
  ['src/ui/settings/SettingsPresentation.tsx',['SettingsAction']],
 ])h.stubs[file]=Object.fromEntries(names.map(name=>[name,h.host(name)]));
 const C=h.load('src/app/(app)/profil.tsx').default,r=await mount(C,{});
 return{r,h,C,session,calls,routes,blur:()=>RTR.act(async()=>{for(const cleanup of [...effects])cleanup?.();}),
  redraw:()=>RTR.act(async()=>r.update(React.createElement(C,{}))),stop:()=>unmount(r)};
}
const confirmButton=r=>nodes(r,n=>n.props.testID==='confirm-sheet-confirm')[0];
const cancelButton=r=>nodes(r,n=>n.props.testID==='confirm-sheet-cancel')[0];
const visibleText=r=>nodes(r,n=>n.type==='T').flatMap(n=>n.children.filter(child=>typeof child==='string')).join(' ');

test('profile has one ordered activity menu and one final logout for empty and populated accounts',async()=>{
 for(const empty of [false,true]){
  const x=await accountMenuRoute({empty});
  const labels=nodes(x.r,n=>n.props.onPress&&n.props.accessibilityLabel).map(n=>n.props.accessibilityLabel);
  assert.deepEqual(labels.slice(-6),['Radni profil','Moji zadaci','Moje prijave','Moj raspored','Podešavanja','Odjavi se']);
  assert.equal(labels.filter(label=>label==='Pomoć i podrška').length,0);
  assert.equal(nodes(x.r,n=>n.props.accessibilityLabel==='Odjavi se').length,1);
  assert.ok(target(x.r,'Odjavi se').props.style.minHeight>=48);
  assert.deepEqual(nodes(x.r,n=>n.type==='Section').map(n=>n.props.title),['Moje aktivnosti','Nalog']);
  assert.deepEqual(x.calls,[]);await x.stop();
 }
});

test('profile logout remains available after an identity read failure and keeps the existing warning',async()=>{
 const x=await accountMenuRoute({readFailure:true});await press(target(x.r,'Odjavi se'));
 assert.ok(visibleText(x.r).includes('neposlate poruke u Dogovorima i lokalni glasovni snimci'));
 assert.equal(confirmButton(x.r).props.accessibilityLabel,'Odjavi se');
 assert.equal(cancelButton(x.r).props.accessibilityLabel,'Ostani prijavljen');assert.deepEqual(x.calls,[]);
 await press(cancelButton(x.r));assert.equal(confirmButton(x.r),undefined);assert.deepEqual(x.calls,[]);
 await press(target(x.r,'Podešavanja'));assert.deepEqual(x.routes,['/profil/podesavanja']);await x.stop();
});

test('profile logout requires one confirmation, blocks competing taps and sends captured ownership once',async()=>{
 const pending=deferred(),x=await accountMenuRoute({logout:()=>pending.promise});
 const ask=target(x.r,'Odjavi se').props.onPress,open=target(x.r,'Podešavanja').props.onPress;
 await RTR.act(async()=>{ask();ask();open();});assert.deepEqual(x.calls,[]);assert.deepEqual(x.routes,[]);
 const confirm=confirmButton(x.r).props.onPress;
 await RTR.act(async()=>{confirm();confirm();ask();open();});
 assert.deepEqual(x.calls,[{accountId:'owner',accountRevision:1}]);assert.deepEqual(x.routes,[]);
 assert.equal(confirmButton(x.r).props.disabled,true);
 await RTR.act(async()=>pending.resolve());assert.equal(confirmButton(x.r),undefined);await x.stop();
});

test('profile logout retires confirmation on blur or account change and fences retained callbacks',async()=>{
 for(const invalidate of [x=>x.blur(),async x=>{x.session.user={id:'other'};x.session.accountRevision++;await x.redraw();}]){
  const x=await accountMenuRoute(),ask=target(x.r,'Odjavi se').props.onPress;
  await press(target(x.r,'Odjavi se'));const confirm=confirmButton(x.r).props.onPress;
  await invalidate(x);assert.equal(confirmButton(x.r),undefined);
  await RTR.act(async()=>{confirm();ask();});assert.deepEqual(x.calls,[]);await x.stop();
 }
});

test('profile logout checks current session even before an account-change render',async()=>{
 const x=await accountMenuRoute();await press(target(x.r,'Odjavi se'));
 x.session.accountRevision++;await press(confirmButton(x.r));assert.deepEqual(x.calls,[]);await x.stop();
});

test('profile logout shows a retryable error only for the owning visit',async()=>{
 const x=await accountMenuRoute({logout:async()=>{throw Error('OFFLINE');}});
 await press(target(x.r,'Odjavi se'));await press(confirmButton(x.r));
 assert.ok(visibleText(x.r).includes('Odjava nije uspela. Pokušajte ponovo.'));
 assert.equal(target(x.r,'Odjavi se').props.disabled,false);
 await press(target(x.r,'Odjavi se'));await press(confirmButton(x.r));assert.equal(x.calls.length,2);await x.stop();
 for(const invalidate of [x=>x.blur(),async x=>{x.session.user={id:'other'};x.session.accountRevision++;await x.redraw();}]){
  const pending=deferred(),late=await accountMenuRoute({logout:()=>pending.promise});
  await press(target(late.r,'Odjavi se'));await press(confirmButton(late.r));await invalidate(late);
  await RTR.act(async()=>pending.reject(Error('LATE_OFFLINE')));
  assert.ok(!visibleText(late.r).includes('Odjava nije uspela. Pokušajte ponovo.'));await late.stop();
 }
});

test('settings retains each destination once and leaves logout to the profile',async()=>{
 const h=createHarness(),C=h.load('src/ui/settings/AccountSettingsPresentation.tsx').AccountSettings,calls=[];
 const r=await mount(C,{busy:false,words:{support:'Jedan zahtev'},open:path=>calls.push(path),onBack:()=>{}});
 const targets=nodes(r,n=>n.type==='Press'&&n.props.onPress);
 for(const node of targets)await press(node);
 assert.equal(calls.length,10);assert.equal(new Set(calls).size,calls.length);
 assert.equal(calls.filter(path=>path==='/podrska').length,1);assert.ok(calls.includes('/profil/prijava-greske'));
 assert.equal(nodes(r,n=>n.props.accessibilityLabel==='Odjavi se').length,0);await unmount(r);
});

async function personalDataRoute(workAreas,grad='',workFailure=false){
 const session={user:{id:'owner'},accountRevision:1},writes=[],routes=[];
 const source={mojRadnikProfil:async()=>{if(workFailure)throw Error('OFFLINE');return{ime:'Milan',biografija:'Dostava',grad,workAreas};},
  azurirajRadnikProfil:async command=>{writes.push(command);throw Error('UNEXPECTED_WRITE');}};
 const h=createHarness({
  'expo-router':{router:{navigate:path=>routes.push(path)},useFocusEffect:fn=>React.useEffect(fn,[fn])},
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/store/uloga.ts':{useIzvor:()=>source},
  'src/data/requesterProfileClientService.ts':{requesterProfileClientService:{
   read:async()=>({ok:true,podatak:{profileId:'requester',displayName:'Milan',revision:1}}),
   save:async command=>{writes.push(command);throw Error('UNEXPECTED_WRITE');}}},
  'src/hooks/useUnsavedProfileBack.ts':{useUnsavedProfileBack:()=>({back:()=>{},sheet:null})},
  'src/data/aiCorrectionIntent.ts':{rememberAiCorrection:()=>({token:'area-correction'})},
 });
 h.native.AppState={currentState:'active',addEventListener:()=>({remove(){}})};
 for(const [file,names]of [
  ['src/ui/settings/SettingsPresentation.tsx',['SettingsScreen','SettingsAction','SettingsGroup','SettingsRow','SettingsText']],
  ['src/ui/profile/DisplayNameForm.tsx',['DisplayNameForm']],['src/ui/system/StateView.tsx',['StateView']],
  ['src/ui/v2/QuietReadState.tsx',['QuietReadState']],['src/ui/media/ContextPhotos.tsx',['ProfilePhoto']],
  ['src/ui/privacy/InlineNote.tsx',['InlineNote']],['src/ui/system/InfoButton.tsx',['InfoButton']],
  ['src/ui/system/ScreenChrome.tsx',['ChromeIconButton']],
 ])h.stubs[file]=Object.fromEntries(names.map(name=>[name,h.host(name)]));
 const r=await mount(h.load('src/app/(app)/profil/podaci.tsx').default,{});
 return{r,writes,routes,stop:()=>unmount(r)};
}

test('personal data reads saved CITY, RADIUS and COUNTRY work areas ahead of legacy city without writing',async()=>{
 for(const [areas,label]of [
  [[WORKER_AREA_CITY],'Novi Sad'],
  [[{...WORKER_AREA_CITY,kind:'RADIUS',label:'Novi Sad · do 30 km',radiusKm:30}],'Novi Sad · do 30 km'],
  [[{kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null}],'Cela Srbija'],
 ]){
  const x=await personalDataRoute(areas,'Stari grad');assert.equal(target(x.r,'Područje rada').props.value,label);
  await press(target(x.r,'Područje rada'));
  assert.deepEqual(x.routes,[{pathname:'/profil/razgovor',params:{aiCorrection:'area-correction'}}]);
  assert.deepEqual(x.writes,[]);await x.stop();
 }
});

test('personal data keeps unknown, empty and legacy work area states honest',async()=>{
 for(const [areas,grad,failed,label]of [[[],'',false,'Još nije podešeno'],[[],'novi sad',false,'Novi Sad'],
  [[WORKER_AREA_CITY],'',true,'Trenutno nedostupno']]){
  const x=await personalDataRoute(areas,grad,failed);assert.equal(target(x.r,'Područje rada').props.value,label);
  assert.deepEqual(x.writes,[]);await x.stop();
 }
});

test('Worker summary uses existing area labels and keeps legacy city/radius compatibility',()=>{
 const {workProfileSummary}=createHarness().load('src/ui/profile/workProfileSummary.ts');
 const profile={stanje:'ACTIVE',vestine:['Dostava'],grad:'Stari grad',radijusKm:20};
 const onSite={kind:'confirmed',modes:['ON_SITE']};
 const radius={...WORKER_AREA_CITY,kind:'RADIUS',label:'Novi Sad · do 30 km',radiusKm:30};
 const country={kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null};
 for(const [workAreas,label]of [[[WORKER_AREA_CITY],'Novi Sad'],[[radius],'Novi Sad · do 30 km'],[[country],'Cela Srbija']])
  assert.equal(workProfileSummary({...profile,workAreas},onSite),`Aktivan · Dostava · Dolazak: ${label}`);
 assert.equal(workProfileSummary({...profile,workAreas:[]},onSite),'Aktivan · Dostava · Dolazak: Stari Grad, do 20 km');
});

test('Worker summary never infers confirmed modes from saved area or absent legacy city',()=>{
 const {workProfileSummary}=createHarness().load('src/ui/profile/workProfileSummary.ts');
 const profile={stanje:'ACTIVE',vestine:['Lektura'],grad:'',workAreas:[WORKER_AREA_CITY]};
 assert.equal(workProfileSummary(profile,{kind:'confirmed',modes:['REMOTE']}),'Aktivan · Lektura · Na daljinu');
 for(const view of [undefined,{kind:'loading'},{kind:'unconfirmed'},{kind:'unavailable'}])
  assert.equal(workProfileSummary(profile,view),'Aktivan · Lektura');
 assert.equal(workProfileSummary({...profile,stanje:'SUSPENDED'},{kind:'confirmed',modes:['ON_SITE','REMOTE']}),'Suspendovan. Obratite se podršci.');
});

async function workerActivationRoute(profilePatch={},modeView={kind:'confirmed',modes:['ON_SITE']}){
 const session={user:{id:'owner'},accountRevision:1},routes=[],writes=[],listeners=new Set();
 const profile={id:'profile',stanje:'DRAFT',ime:'Milan',grad:'',biografija:'Dostavljam pakete i pomažem pri selidbi.',
  vestine:['Kurirske dostave','Nabavka i kupovina','Pomoć pri selidbi'],alati:[],vozila:[],licence:[],radijusKm:0,dostupanOdmah:false,
  workAreas:[WORKER_AREA_CITY],...profilePatch};
 const source={mojRadnikProfil:async()=>profile,azurirajRadnikProfil:async command=>{writes.push(command);return{ok:false,kod:'UNEXPECTED_WRITE'};}};
 const control={modes:modeView},router={navigate:route=>routes.push(route),canGoBack:()=>true,back:()=>{},replace:route=>routes.push(route)};
 const h=createHarness({
  'expo-router':{router,useLocalSearchParams:()=>({}),useFocusEffect:fn=>React.useEffect(fn,[fn])},
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/store/uloga.ts':{useIzvor:()=>source},
  'src/hooks/useWorkerAvailability.ts':{useWorkerAvailability:()=>({view:{kind:'unavailable'},refresh:()=>{}})},
  'src/hooks/useWorkerExecutionModes.ts':{useWorkerExecutionModes:()=>({view:control.modes,refresh:()=>{}})},
  'src/hooks/useUnsavedProfileBack.ts':{useUnsavedProfileBack:({onBack})=>({back:onBack,sheet:null})},
  'src/ui/profile/useAccountName.ts':{useAccountName:()=>({state:'ready',name:'Milan',profileId:null})},
  'src/lib/idempotencija.ts':{noviUuidZahtevId:()=> '00000000-0000-4000-8000-000000000123'},
  'src/data/aiCorrectionIntent.ts':{rememberAiCorrection:()=>null},
 });
 h.native.AppState={currentState:'active',addEventListener:(_,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)};}};
 h.native.BackHandler={addEventListener:()=>({remove:()=>{}})};
 for(const [file,names]of [
  ['src/ui/workerProfile/WorkerProfilePresentation.tsx',['WorkerProfileFrame','WorkerProfileFooter','WorkerProfileForm','WorkerProfileStatus']],
  ['src/ui/media/ContextPhotos.tsx',['ProfilePhoto']],['src/ui/profile/RatingLine.tsx',['RatingLine']],['src/ui/settings/InfoTitle.tsx',['HeaderInfo']],
 ])h.stubs[file]=Object.fromEntries(names.map(name=>[name,h.host(name)]));
 const C=h.load('src/app/(app)/profil/radnik.tsx').default,r=await mount(C,{});
 return{r,C,session,control,routes,writes,profile,form:()=>nodes(r,n=>n.type==='WorkerProfileForm')[0],
  redraw:()=>RTR.act(async()=>r.update(React.createElement(C,{}))),
  background:()=>RTR.act(async()=>{h.native.AppState.currentState='background';for(const fn of listeners)fn('background');}),
  stop:()=>unmount(r)};
}

test('saved Worker with signed CITY area and empty legacy city enters activation review without writing',async()=>{
 const x=await workerActivationRoute();
 assert.equal(x.form().props.checks.area,true);assert.equal(x.form().props.readyToActivate,false);
 await press(target(x.r,'Pregled za aktivaciju'));
 assert.deepEqual(x.routes,[{pathname:'/profil/razgovor',params:{activationRequest:'00000000-0000-4000-8000-000000000123'}}]);
 assert.deepEqual(x.writes,[]);assert.equal(x.profile.stanje,'DRAFT');await x.stop();
});

test('saved Worker COUNTRY and RADIUS areas open the same signed review entry',async()=>{
 for(const area of [{kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null},
  {...WORKER_AREA_CITY,kind:'RADIUS',label:'Novi Sad · do 30 km',radiusKm:30}]){
  const x=await workerActivationRoute({workAreas:[area]});assert.equal(x.form().props.checks.area,true);
  await press(target(x.r,'Pregled za aktivaciju'));assert.equal(x.routes[0].pathname,'/profil/razgovor');assert.deepEqual(x.writes,[]);await x.stop();
 }
});

test('confirmed REMOTE-only Worker needs no invented city to request activation review',async()=>{
 const x=await workerActivationRoute({workAreas:[],vestine:['Lektura']},{kind:'confirmed',modes:['REMOTE']});
 assert.equal(x.form().props.checks.area,true);assert.equal(x.form().props.readyToActivate,false);
 await press(target(x.r,'Pregled za aktivaciju'));assert.ok(x.routes[0].params.activationRequest);assert.deepEqual(x.writes,[]);await x.stop();
});

test('unknown or on-site modes without a valid area do not fabricate area readiness',async()=>{
 for(const modes of [{kind:'loading'},{kind:'unavailable'},{kind:'unconfirmed'},
  {kind:'confirmed',modes:['ON_SITE']},{kind:'confirmed',modes:['ON_SITE','REMOTE']}]){
  const x=await workerActivationRoute({workAreas:[]},modes);assert.equal(x.form().props.checks.area,false);
  await press(target(x.r,'Nastavite kroz razgovor'));assert.deepEqual(x.routes,['/profil/razgovor']);assert.deepEqual(x.writes,[]);await x.stop();
 }
 for(const workAreas of [[{...WORKER_AREA_CITY,sourceRef:null}],[{...WORKER_AREA_CITY,kind:'RADIUS',radiusKm:201}],[]]){
  const x=await workerActivationRoute({workAreas});assert.equal(x.form().props.checks.area,false);
  assert.ok(target(x.r,'Nastavite kroz razgovor'));await x.stop();
 }
});

test('legacy saved area still opens review; a missing skill does not become activation readiness',async()=>{
 for(const radijusKm of [25,0]){
  const x=await workerActivationRoute({workAreas:[],grad:'Novi Sad',radijusKm});
  assert.equal(x.form().props.checks.area,radijusKm>0);await press(target(x.r,'Pregled za aktivaciju'));assert.deepEqual(x.writes,[]);await x.stop();
 }
 const empty=await workerActivationRoute({vestine:[]});assert.equal(empty.form().props.checks.basics,false);
 assert.ok(target(empty.r,'Nastavite kroz razgovor'));await empty.stop();
});

test('activation review entry retains suspended, dirty, account and background guards',async()=>{
 const suspended=await workerActivationRoute({stanje:'SUSPENDED'});assert.equal(suspended.form().props.status,'SUSPENDED');
 assert.equal(nodes(suspended.r,n=>n.props.label==='Pregled za aktivaciju').length,0);await suspended.stop();
 const dirty=await workerActivationRoute();await RTR.act(async()=>dirty.form().props.change({...dirty.form().props.draft,biografija:'Izmenjen opis'}));
 assert.ok(target(dirty.r,'Sačuvajte izmene'));assert.equal(nodes(dirty.r,n=>n.props.label==='Pregled za aktivaciju').length,0);await dirty.stop();
 for(const invalidate of [async x=>{x.session.accountRevision++;},x=>x.background()]){
  const x=await workerActivationRoute(),stale=target(x.r,'Pregled za aktivaciju').props.onPress;await invalidate(x);
  await RTR.act(async()=>stale());assert.deepEqual(x.routes,[]);assert.deepEqual(x.writes,[]);await x.stop();
 }
});

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
