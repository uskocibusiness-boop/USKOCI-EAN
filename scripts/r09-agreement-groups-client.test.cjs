'use strict';
// Actual TS service/decoder/pager and mounted route. Native hosts/Auth transport
// are substitutes; this is not Android, hosted RLS or physical-device evidence.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const ID=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const account=ID(1),other=ID(2);
const view={section:'active',role:'all',outcome:'all',confirmationOnly:false,query:''};
const at='2026-11-08T10:00:00.123456Z',start='2030-01-01T10:00:00.000001Z';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function document(n=10){return{id:ID(n),needId:ID(n+100),applicationId:ID(n+200),sortAt:at,createdAt:at,currentVersion:1,status:'CONFIRMED',agreementStatus:'CONFIRMED',
 requesterAccountId:account,workerAccountId:other,requesterProfileId:ID(3),workerProfileId:ID(4),requesterName:'Miloš',workerName:'Marko',
 title:'Selidba stana',approximateArea:'Liman',approximateCity:'Novi Sad',executionMode:'ON_SITE',pendingChange:null,ratingDue:false,
 terms:{price_rsd:1200,currency:'RSD',priceBasis:'HOURLY',covered_slots:2,required_slots:5,proposed_start_at:start,proposed_end_at:null}};}
function envelope(n=10){const raw=document(n);return{view:{...view},viewAt:at,asOf:at,groups:[{needId:raw.needId,role:'narucilac',rank:5,sortAt:start,items:[raw]}],hasMore:false,
 counts:{matching:1,attention:0,confirmation:0,active:1,activeAttention:0,history:0,hasAny:true,hasBothRoles:false,historyInActive:false}};}
function serviceHarness(options={}){
 const session={user:{id:account},accountRevision:1},calls=[],signals=[],timers=[];
 const data=options.data??envelope();
 const h=createHarness({
  'src/store/sesija.ts':{sesijaSada:()=>session},
  'src/data/supabaseClient.ts':{supabaseKlijent:()=>({auth:{getUser:options.auth??(async()=>({data:{user:session.user},error:null}))},rpc:(name,args)=>{
   calls.push({name,args});return{abortSignal:signal=>{signals.push(signal);return options.reply?options.reply(name,args):Promise.resolve({data,error:null});}};
  }})},
  'src/data/agreementRatingsRead.ts':{ratingReadOwnerCurrent:o=>o.accountId===session.user?.id&&o.accountRevision===session.accountRevision,
   withAgreementRatings:()=>{throw new Error('Unexpected rating enrichment');}},
 },options.clock?{'src/data/agreementClientService.ts':{setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:()=>{}}}:{});
 return{...h,...h.load('src/data/ownAgreementGroupsPage.ts'),client:h.load('src/data/agreementClientService.ts').agreementClientService,session,calls,signals,timers};
}
test('R09 page client makes one RPC, preserves accepted terms and never drains another page',async()=>{
 const h=serviceHarness(),page=await h.client.mojiDogovoriStrana({view,limit:20,cursor:null});
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'rpc_list_my_agreement_groups_page');assert.equal(page.items.length,1);
 assert.equal(page.items[0].items[0].cena.iznos,1200);assert.equal(page.items[0].items[0].pokrivenost.popunjeno,2);
 assert.equal(page.items[0].items[0].prihvacenPocetak,start);assert.equal(page.cursor.at,start);
});
test('R09 reproduces the retained legacy all-history path and its 2000-row refusal',async()=>{
 let offset=0;
 const h=serviceHarness({reply:async(name,args)=>{
  assert.equal(name,'rpc_list_my_agreements_page');assert.equal(args.p_scope,'ALL');
  const items=Array.from({length:100},(_,i)=>({...document(3000-offset-i),sortAt:at}));offset+=100;
  return{data:{items,hasMore:true},error:null};
 }});
 await assert.rejects(h.client.mojiDogovori({signal:new AbortController().signal}),/AGREEMENT_LIST_TOO_MANY_PAGES/);
 assert.equal(h.calls.length,20);assert.equal(offset,2000);
});
for(const [name,mutate] of [
 ['foreign account',d=>{d.groups[0].items[0].requesterAccountId=ID(999);} ],
 ['foreign group',d=>{d.groups[0].items[0].needId=ID(999);} ],
 ['role mismatch',d=>{d.groups[0].role='uskocer';} ],
 ['missing rating state',d=>{delete d.groups[0].items[0].ratingDue;} ],
 ['duplicate row',d=>{d.groups[0].items.push(structuredClone(d.groups[0].items[0]));} ],
 ['duplicate group',d=>{d.groups.push(structuredClone(d.groups[0]));d.counts.matching=2;d.counts.active=2;} ],
 ['invalid accepted amount basis',d=>{d.groups[0].items[0].terms.priceBasis='HOURLY_TEAM';} ],
 ['invalid people',d=>{d.groups[0].items[0].terms.covered_slots=0;} ],
 ['invalid instant',d=>{d.groups[0].sortAt='2026-02-29T10:00:00Z';} ],
 ['contradictory count',d=>{d.counts.matching=2;} ],
 ['nonprogressing empty page',d=>{d.groups=[];d.hasMore=true;d.counts.matching=2;} ],
 ['wrong view',d=>{d.view.section='history';} ],
 ['active state in history',d=>{d.groups[0].items[0].status='CANCELLED';} ],
 ['missing groups',d=>{delete d.groups;} ],
 ['missing scope binding',d=>{delete d.view;} ],
 ['future ordering timestamp',d=>{d.viewAt='2027-11-08T10:00:00Z';} ],
])test('R09 page rejects '+name,async()=>{
 const data=envelope();mutate(data);const h=serviceHarness({data});
 await assert.rejects(h.client.mojiDogovoriStrana({view,limit:20,cursor:null}),/AGREEMENT_LIST_INVALID_PROJECTION/);
});
test('R09 next page refuses the old boundary, changed view clock and foreign scope',async()=>{
 const h=serviceHarness();const first=await h.client.mojiDogovoriStrana({view,limit:1,cursor:null});
 await assert.rejects(h.client.mojiDogovoriStrana({view,limit:1,cursor:first.cursor}),/INVALID_PROJECTION/);
 const before=h.calls.length;
 await assert.rejects(h.client.mojiDogovoriStrana({view:{...view,role:'uskocer'},limit:1,cursor:first.cursor}),/INVALID_REQUEST/);
 assert.equal(h.calls.length,before);
});
test('R09 foreign-account and A to B to A responses retire the original page',async()=>{
 for(const changeId of [true,false]){
  const answer=deferred(),h=serviceHarness({reply:()=>answer.promise});const read=h.client.mojiDogovoriStrana({view,limit:20,cursor:null});
  await tick();if(changeId)h.session.user.id=other;h.session.accountRevision++;
  answer.resolve({data:envelope(),error:null});await assert.rejects(read,/AUTH_ACCOUNT_CHANGED/);
 }
});
test('R09 abort during Auth prevents later RPC and cannot resurrect a retired page',async()=>{
 const auth=deferred(),h=serviceHarness({auth:()=>auth.promise}),abort=new AbortController();
 const read=h.client.mojiDogovoriStrana({view,limit:20,cursor:null,signal:abort.signal});abort.abort();
 await assert.rejects(read,/AGREEMENT_LIST_ABORTED/);auth.resolve({data:{user:{id:account}},error:null});await tick();assert.equal(h.calls.length,0);
});
test('R09 one 15-second deadline aborts a stalled page without an automatic retry',async()=>{
 const reply=deferred(),h=serviceHarness({clock:true,reply:()=>reply.promise});const read=h.client.mojiDogovoriStrana({view,limit:20,cursor:null});
 await tick();assert.equal(h.calls.length,1);assert.equal(h.timers.length,1);assert.equal(h.timers[0].ms,15000);
 h.timers[0].fn();await assert.rejects(read,/AGREEMENTS_READ_TIMEOUT/);assert.equal(h.signals[0].aborted,true);
 reply.resolve({data:envelope(),error:null});await tick();assert.equal(h.calls.length,1);
});
test('R09 permission, network and missing-schema errors do not silently fall back to a whole-history read',async()=>{
 for(const code of ['42501','PGRST202','NETWORK_ERROR']){
  const h=serviceHarness({reply:async()=>({data:null,error:{code}})});
  await assert.rejects(h.client.mojiDogovoriStrana({view,limit:20,cursor:null}),/AGREEMENT_LIST_FAILED/);assert.equal(h.calls.length,1);
 }
});

const pure=createHarness({'src/store/sesija.ts':{sesijaSada:()=>({})},'src/data/supabaseClient.ts':{supabaseKlijent:()=>{throw new Error('Unexpected transport');}}}),{createPagedListPager}=pure.load('src/data/pagedListPager.ts');
function pagerHarness(size=2501){
 let current=true;const calls=[],answer={override:null};
 const readPage=async r=>{calls.push(r);if(answer.override)return answer.override(r);
  const from=r.cursor??0,end=Math.min(size,from+r.limit);
  return{items:Array.from({length:end-from},(_,i)=>({key:'g'+(from+i)})),cursor:end,hasMore:end<size,counts:r.cursor===null?{total:size}:null};};
 const pager=createPagedListPager({readPage,isCurrent:()=>current,keyOf:x=>x.key,limit:20});pager.setScope('active');
 return{pager,calls,answer,retire:()=>{current=false;}};
}
test('R09 real pager reads 20 of 2501 groups first and manual paging has no 2000-row refusal',async()=>{
 const h=pagerHarness();h.pager.start();await tick();assert.equal(h.calls.length,1);assert.equal(h.pager.snapshot().items.length,20);
 while(h.pager.snapshot().hasMore)await h.pager.loadMore();
 assert.equal(h.calls.length,126);assert.equal(h.pager.snapshot().items.length,2501);assert.equal(new Set(h.pager.snapshot().items.map(x=>x.key)).size,2501);
 h.pager.stop();
});
test('R09 concurrent load-more coalesces, failed page keeps cards and retry uses the same cursor',async()=>{
 const h=pagerHarness();h.pager.start();await tick();const wait=deferred();h.answer.override=()=>wait.promise;
 const a=h.pager.loadMore(),b=h.pager.loadMore();assert.equal(h.calls.length,2);
 wait.reject(new Error('offline'));await Promise.all([a,b]);assert.equal(h.pager.snapshot().moreError,true);assert.equal(h.pager.snapshot().items.length,20);
 h.answer.override=null;await h.pager.loadMore();assert.equal(h.calls[2].cursor,20);assert.equal(h.pager.snapshot().items.length,40);h.pager.stop();
});
test('R09 refresh retires an old append; duplicate groups cannot reappear',async()=>{
 const h=pagerHarness();h.pager.start();await tick();const wait=deferred();h.answer.override=r=>r.cursor?wait.promise:Promise.resolve({items:[{key:'fresh'}],cursor:1,hasMore:true,counts:null});
 const more=h.pager.loadMore();await h.pager.refresh();wait.resolve({items:[{key:'obsolete'}],cursor:40,hasMore:true,counts:null});await more;
 assert.deepEqual(h.pager.snapshot().items,[{key:'fresh'}]);
 h.answer.override=async()=>({items:[{key:'fresh'},{key:'next'}],cursor:2,hasMore:false,counts:null});await h.pager.loadMore();
 assert.deepEqual(h.pager.snapshot().items,[{key:'fresh'},{key:'next'}]);h.pager.stop();
});
test('R09 refresh failure keeps the prior data explicitly stale',async()=>{
 const h=pagerHarness();h.pager.start();await tick();h.answer.override=async()=>{throw new Error('offline');};
 assert.equal(await h.pager.refresh(),false);assert.equal(h.pager.snapshot().items.length,20);
 assert.equal(h.pager.snapshot().error,false);assert.equal(h.pager.snapshot().refreshError,true);
 h.answer.override=null;await h.pager.refresh();assert.equal(h.pager.snapshot().refreshError,false);h.pager.stop();
});
test('R09 foreground/account retirement discards an outstanding page and forgets private cards',async()=>{
 const h=pagerHarness();h.pager.start();await tick();const wait=deferred();h.answer.override=()=>wait.promise;
 const read=h.pager.loadMore();h.retire();h.pager.forget();wait.resolve({items:[{key:'foreign'}],cursor:40,hasMore:false,counts:null});await read;
 assert.deepEqual(h.pager.snapshot().items,[]);
});
test('R09 a slow old search cannot overwrite the current view counts',async()=>{
 const old=deferred();const pager=createPagedListPager({isCurrent:()=>true,keyOf:x=>x.key,limit:20,countsByScope:true,
  readPage:request=>request.scope==='old'?old.promise:Promise.resolve({items:[{key:'new'}],cursor:1,hasMore:false,counts:{matching:1}})});
 pager.setScope('old');pager.start();pager.setScope('new');await tick();assert.deepEqual(pager.snapshot().counts,{matching:1});
 old.resolve({items:[{key:'old'}],cursor:1,hasMore:false,counts:{matching:999}});await tick();
 assert.equal(pager.snapshot().scope,'new');assert.deepEqual(pager.snapshot().counts,{matching:1});
 pager.forget();assert.equal(pager.snapshot().counts,null);pager.stop();
});

async function routeHarness(){
 const session={user:{id:account},accountRevision:1},calls=[],states=new Set(),back=new Set(),navigations=[];
 const model=pure.load('src/data/ownAgreementGroupsPage.ts');
 const item={id:ID(10),izvor:{zadatakId:ID(110),prijavaId:ID(210)},naslov:'Selidba',stanje:'CONFIRMED',ocenaMoguca:false,stanjeProvereOcene:'NOT_DUE',
  ucesnici:[{id:account,viSte:true,uloga:'narucilac'},{id:other,viSte:false,uloga:'uskocer'}],rezim:'FIZICKI',putanjaTekst:'Liman',izmenaCeka:null};
 const source={mojiDogovori:()=>{throw new Error('Root must not drain history');},mojiDogovoriStrana:async request=>{
  calls.push(request);const number=request.cursor?2:1,rows=request.view.section==='history'?[]:[{key:'g'+number,needId:ID(110+number),role:'narucilac',rank:5,sortAt:start,items:[{...item,id:ID(10+number)}]}];
  return{items:rows,cursor:rows.length?{rank:5,at:start,id:ID(110+number),role:'narucilac',viewAt:at,view:request.view}:null,
   hasMore:request.view.section==='active'&&!request.cursor,asOf:at,counts:request.cursor?null:{matching:request.view.section==='active'?2:0,
    attention:0,confirmation:0,active:2,activeAttention:0,history:0,hasAny:true,hasBothRoles:false,historyInActive:false,viewKey:model.ownAgreementScope(request.view)}};
 }};
 const h=createHarness({
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/store/uloga.ts':{useIzvor:()=>source,izvorSada:()=>source},
  'src/data/supabaseClient.ts':{supabaseKlijent:()=>{throw new Error('Unexpected transport');}},
  'expo-router':{router:{navigate:x=>navigations.push(x),setParams:()=>{}},useLocalSearchParams:()=>({}),useFocusEffect:fn=>React.useEffect(fn,[fn])},
  'src/data/agreementCancellationClientService.ts':{agreementCancellationService:{read:async()=>({ok:false})}},
  'src/data/needSearchRecoveryClientService.ts':{needSearchRecoveryClientService:{read:async()=>({ok:false})}},
 });
 h.native.AppState={currentState:'active',addEventListener:(_,fn)=>{states.add(fn);return{remove:()=>states.delete(fn)};}};
 h.native.BackHandler={addEventListener:(_,fn)=>{back.add(fn);return{remove:()=>back.delete(fn)};}};h.native.Keyboard={dismiss:()=>{}};
 h.stubs['src/ui/system/ActualUserAvatar.tsx']={ActualUserAvatar:h.host('ActualUserAvatar')};
 h.stubs['src/ui/system/ScreenChrome.tsx']={ChromeIconButton:h.host('ChromeIconButton')};
 h.stubs['src/ui/v2/AgreementCollectionPresentation.tsx']={AgreementCollectionPresentation:h.host('AgreementCollectionPresentation')};
 const C=h.load('src/app/(app)/dogovori.tsx').default,r=await mount(C,{});
 const props=()=>nodes(r,x=>x.type==='AgreementCollectionPresentation')[0]?.props;
 return{r,calls,props,session,states,h,stop:()=>unmount(r)};
}
test('R09 mounted root fetches one active page; history opens only on explicit navigation',async()=>{
 const h=await routeHarness();assert.equal(h.calls.length,1);assert.equal(h.calls[0].view.section,'active');assert.equal(h.props().items.length,1);
 await RTR.act(async()=>h.props().pagination.onMore());assert.equal(h.calls.length,2);assert.equal(h.props().items.length,2);
 await RTR.act(async()=>h.props().onSection('history'));assert.equal(h.calls.length,3);assert.equal(h.calls[2].view.section,'history');assert.deepEqual(h.props().items,[]);await h.stop();
});
test('R09 mounted search debounces only the final view and never completes all pages',async()=>{
 const h=await routeHarness();await RTR.act(async()=>{h.props().search.onChange('Мар');});
 await RTR.act(async()=>{h.props().search.onChange('Марко');});assert.equal(h.calls.length,1);assert.equal(h.props().loading,true);
 await RTR.act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].view.query,'marko');assert.equal(h.props().loading,false);await h.stop();
});
test('R09 mounted background gate retires private rows and stale load-more callbacks',async()=>{
 const h=await routeHarness(),more=h.props().pagination.onMore;
 await RTR.act(async()=>{h.h.native.AppState.currentState='background';for(const fn of [...h.states])fn('background');});
 assert.equal(h.props(),undefined);await RTR.act(async()=>more());assert.equal(h.calls.length,1);
 await RTR.act(async()=>{h.h.native.AppState.currentState='active';for(const fn of [...h.states])fn('active');});
 assert.ok(h.props());assert.equal(h.calls.length,2);assert.equal(h.calls[1].cursor,null);await h.stop();
});

async function presentationHarness(patch={}){
 const h=createHarness(),calls=[];h.native.Keyboard={dismiss:()=>{}};
 h.native.FlatList=p=>React.createElement('FlatList',p,p.data.length?p.data.map((item,index)=>React.createElement(React.Fragment,{key:item.id},p.renderItem({item,index}))):p.ListEmptyComponent,p.ListFooterComponent);
 for(const [file,name] of [['src/ui/system/ScreenChrome.tsx','ChromeIconButton'],['src/ui/system/StateView.tsx','StateView'],['src/ui/agreements/AgreementRoleRail.tsx','AgreementRoleRail'],['src/ui/agreements/AgreementListCard.tsx','AgreementTaskRow'],['src/ui/agreements/GroupHeader.tsx','GroupHeader'],['src/ui/v2/QuietReadState.tsx','QuietReadState'],['src/ui/v2/discovery/SearchParts.tsx','SearchField']])h.stubs[file]={[name]:h.host(name)};
 h.stubs['src/ui/system/ScreenChrome.tsx'].ScreenChrome=h.host('ScreenChrome');h.stubs['react-native-safe-area-context']={SafeAreaView:h.host('SafeAreaView')};
 const C=h.load('src/ui/v2/AgreementCollectionPresentation.tsx').AgreementCollectionPresentation;
 const row={id:ID(10),izvor:{zadatakId:ID(110),prijavaId:ID(210)},naslov:'Selidba',stanje:'CONFIRMED',ocenaMoguca:false,stanjeProvereOcene:'NOT_DUE',
  ucesnici:[{id:account,viSte:true,uloga:'narucilac'},{id:other,ime:'Marko',viSte:false,uloga:'uskocer'}],rezim:'FIZICKI',putanjaTekst:'Liman',izmenaCeka:null};
 const counts={matching:100,attention:0,confirmation:0,active:100,activeAttention:0,history:8,hasAny:true,hasBothRoles:true,historyInActive:false,viewKey:''};
 const props={items:[row],section:'active',confirmationOnly:false,loading:false,error:false,onSection:s=>calls.push(['section',s]),onConfirmationOnly:()=>{},onRefresh:()=>calls.push(['refresh']),onOpen:()=>{},onCalendar:()=>{},onProfile:()=>{},onHome:()=>{},
  pagination:{hasMore:true,loadingMore:false,moreError:false,loadedGroups:1,counts,onMore:()=>calls.push(['more'])},...patch};
 const r=await mount(C,props);return{r,props,calls,row,counts,update:async value=>{Object.assign(props,value);await RTR.act(async()=>r.update(React.createElement(C,props)));},stop:()=>unmount(r)};
}
test('R09 mounted list keeps cards after next-page failure and retries explicitly',async()=>{
 const h=await presentationHarness();const list=()=>nodes(h.r,n=>n.type==='FlatList')[0];
 await RTR.act(async()=>list().props.onEndReached());assert.deepEqual(h.calls,[['more']]);
 await h.update({pagination:{...h.props.pagination,moreError:true}});await RTR.act(async()=>list().props.onEndReached());assert.equal(h.calls.length,1);
 assert.equal(nodes(h.r,n=>n.type==='AgreementTaskRow').length,1);
 await press(target(h.r,'Pokušajte ponovo da učitate saradnje'));assert.equal(h.calls.length,2);await h.stop();
});
test('R09 stale refresh disables later pages but preserves the last cards and refresh recovery',async()=>{
 const h=await presentationHarness({refreshError:true});const list=nodes(h.r,n=>n.type==='FlatList')[0];
 await RTR.act(async()=>list.props.onEndReached());assert.equal(h.calls.length,0);assert.equal(target(h.r,'Učitajte još saradnji').props.disabled,true);
 assert.equal(nodes(h.r,n=>n.type==='AgreementTaskRow')[0].props.stale,true);
 await press(target(h.r,'Ponovo osvežite Dogovore'));assert.deepEqual(h.calls,[['refresh']]);await h.stop();
});
test('R09 server counts preserve role filters and distinguish no active work from no agreements',async()=>{
 const h=await presentationHarness();assert.equal(nodes(h.r,n=>n.type==='AgreementRoleRail').length,1);
 await h.update({items:[],pagination:{...h.props.pagination,hasMore:false,loadedGroups:0,counts:{...h.counts,matching:0,active:0}}});
 assert.ok(target(h.r,'Nema aktivnih Dogovora'));assert.equal(nodes(h.r,n=>n.props.title==='Još nemate Dogovora').length,0);
 await press(target(h.r,'Prethodne saradnje'));assert.deepEqual(h.calls,[['section','history']]);await h.stop();
});
