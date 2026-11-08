'use strict';
// Actual reader selector, request owner, adapter and presentation states.
// Synthetic transport only; hosted SQL matcher has its separate R05 CI suite.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {ROOT,React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const h=createHarness({'src/data/supabaseClient.ts':{supabaseKlijent:()=>{throw Error('No live API in offline UX test')}},'src/store/sesija.ts':{sesijaSada:()=>({user:null,accountRevision:0})},'expo-constants':{default:{expoConfig:{android:{package:'rs.uskoci.preview.qa'}}}}});
const {selectDiscoveryReader:select}=h.load('src/data/discoveryV1ReaderGate.ts');
const {initialMarketplaceView}=h.load('src/data/marketplaceView.ts');
const {discoveryV1ViewPlan:plan,discoveryV1Opportunity:opportunity}=h.load('src/data/discoveryV1MarketplaceAdapter.ts');
const {createDiscoveryV1Owner:owner}=h.load('src/data/discoveryV1Owner.ts');
const eas=JSON.parse(fs.readFileSync(path.join(ROOT,'eas.json')));
const entry=(patch={})=>({publicationHandoff:false,proofParam:undefined,proofFlag:'0',androidPackage:'rs.uskoci.preview.qa',productionFlag:eas.build.preview.env.EXPO_PUBLIC_P6_DISCOVERY_READER,...patch});
const instant='2026-11-07T12:00:00Z',id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const filter=(extra={})=>({text:'',price:'all',where:'any',places:1,when:'any',dates:null,place:null,...extra});
const anchor=(key)=>({version:'DISCOVERY_V1',filterKey:key,timeAt:instant,publishedThrough:instant,expiresAt:'2026-11-07T12:30:00Z'});
function response(req){const key=req.filter.forMe?'1'.repeat(32):'2'.repeat(32),a=req.anchor??anchor(key);
 if(req.mode==='PAGE')return {version:'DISCOVERY_V1',mode:'PAGE',asOf:instant,filterKey:key,anchor:a,items:[],hasMore:false,nextCursor:null,
 counts:{kind:'exact_live',observedAt:instant,mapped:0,listed:0,inArea:0,withoutPoint:0,undated:0},availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:[]}};
 if(req.mode==='MAP')return{version:'DISCOVERY_V1',mode:'MAP',asOf:instant,filterKey:key,anchor:a,coverageBounds:req.bounds,effectiveGrid:req.grid,wholeBounds:null,buckets:[],counts:{kind:'exact_live',observedAt:instant,mapped:0,withoutPoint:0}};
 throw Error('Unexpected transport operation '+req.mode);
}
function wire(){const calls=[];const o=owner(async req=>{calls.push(req);return response(req)});return {o,calls};}
test('UX02 QA preview selects the real P6 reader; production remains gated off',()=>{assert.equal(select(entry()),'P6');assert.equal(eas.build.production.env.EXPO_PUBLIC_P6_DISCOVERY_READER,'0');assert.equal(select(entry({productionFlag:eas.build.production.env.EXPO_PUBLIC_P6_DISCOVERY_READER,androidPackage:'rs.uskoci'})),'LEGACY');});
test('UX02 exact publication landing is retained under the new preview setting',()=>assert.equal(select(entry({publicationHandoff:true})),'LEGACY'));
test('UX02 a route parameter cannot activate a disabled QA reader or ordinary production reader',()=>{for(const pkg of ['rs.uskoci.preview.qa','rs.uskoci.preview','rs.uskoci'])assert.equal(select(entry({productionFlag:'0',proofParam:'1',proofFlag:'1',androidPackage:pkg})),'LEGACY');});
test('UX02 malformed flag values fail closed and missing proof never grants access',()=>{for(const flag of [true,1,'true','01','yes',''])assert.equal(select(entry({productionFlag:flag})),'LEGACY');});
test('UX02 ForMe changes the single list/map filter, not location or price units',()=>{const v={...initialMarketplaceView(),forMe:true,where:'onsite',price:'MY_PRICE',minBudgetRsd:1200,places:2};const p=plan(v);assert.equal(p.filter.forMe,true);assert.equal(p.filter.minBudgetRsd,1200);assert.equal(p.filter.places,2);assert.equal(p.filter.price,'MY_PRICE');assert.equal(p.filter.where,'onsite');});
test('UX02 disabling ForMe omits its optional wire key instead of fabricating membership',()=>assert.equal(Object.hasOwn(plan({...initialMarketplaceView(),forMe:false}).filter,'forMe'),false));
test('UX02 remote search removes physical scope and map area without inventing a pin',()=>{const p=plan({...initialMarketplaceView(),forMe:true,where:'remote',area:[18,44,21,46],pinPlace:'45.25:19.84',place:'Novi Sad'});assert.deepEqual(p.pageScope,{kind:'ALL'});assert.equal(p.filter.place,null);assert.equal(p.mapBounds,null);assert.equal(p.placesFacetArea,null);});
test('UX02 price basis and people survive the public card adapter',()=>{const r=opportunity({id:id(1),revision:1,title:'TEST nošenje',category:'Pomoć',status:'PUBLISHED',urgent:false,scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.84,precision:'COARSE_1KM'},requiredSlots:5,coveredSlots:2,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,priceMode:'MY_PRICE',requesterPriceRsd:1200,priceBasis:'HOURLY',requesterProfileId:id(2),responseDeadline:null,acceptsApplications:true,publicTopology:null,criticalConditions:[]});assert.equal(r.ponudjenaCena.iznos,1200);assert.equal(r.osnovaCene,'HOURLY');assert.equal(r.pokrivenost.preostalo,3);assert.deepEqual(r.priblizno,{lat:45.25,lng:19.84});});
test('UX02 PAGE and MAP share the same accepted ForMe anchor and filter',async()=>{const {o,calls}=wire();o.begin(filter({forMe:true}));assert.equal((await o.firstPage()).kind,'applied');assert.equal((await o.loadMap([18,44,21,46])).kind,'applied');assert.equal(calls.length,2);assert.deepEqual(calls[0].filter,calls[1].filter);assert.deepEqual(calls[1].anchor,o.snapshot().page.anchor);o.retire();});
test('UX02 toggling membership starts a new traversal and cannot reuse its old cursor',async()=>{const {o,calls}=wire();o.begin(filter({forMe:true}));await o.firstPage();o.begin(filter());await o.firstPage();assert.equal(calls[1].anchor,null);assert.equal(calls[1].after,null);assert.notEqual(o.snapshot().page.filterKey,calls[0].filter.forMe?'1'.repeat(32):'2'.repeat(32));o.retire();});
test('UX02 late ForMe response cannot replace the newly selected all-task traversal',async()=>{const d=deferred(),calls=[];const o=owner(req=>{calls.push(req);return req.filter.forMe?d.promise:Promise.resolve(response(req))});o.begin(filter({forMe:true}));const old=o.firstPage();o.begin(filter());await o.firstPage();d.resolve(response(calls[0]));assert.equal((await old).kind,'stale');assert.equal(o.snapshot().page.filterKey,'2'.repeat(32));o.retire();});
test('UX02 a session revoked during read cannot commit page state',async()=>{const d=deferred();let active=true,req;const o=owner(r=>{req=r;return d.promise},()=>active);o.begin(filter({forMe:true}));const pending=o.firstPage();active=false;d.resolve(response(req));assert.equal((await pending).kind,'stale');assert.equal(o.snapshot().page,null);o.retire();});
test('UX02 missing-profile refusal remains an error, never a fake empty success',async()=>{const o=owner(async()=>{throw Error('DISCOVERY_V1_FOR_ME_PROFILE_REQUIRED')});o.begin(filter({forMe:true}));await assert.rejects(o.firstPage(),/PROFILE_REQUIRED/);assert.equal(o.snapshot().page,null);o.retire();});
test('UX02 visible capsule offers both explicit scopes with the formal description',async()=>{const C=h.load('src/ui/v2/discovery/DiscoveryChipRow.tsx').DiscoveryChipRow;const calls=[];let r=await mount(C,{forMeAvailable:true,scope:'all',onScope:s=>calls.push(s),chips:[]});await press(target(r,'Za Vas'));assert.deepEqual(calls,['forMe']);await RTR.act(async()=>r.update(React.createElement(C,{forMeAvailable:true,scope:'forMe',onScope:s=>calls.push(s),chips:[]})));await press(target(r,'Za Vas'));assert.deepEqual(calls,['forMe','all']);assert.match(target(r,'Za Vas').props.accessibilityHint,/Vašem/);await unmount(r);});
test('UX02 absent matching hides its capsule rather than offering a dead control',async()=>{const C=h.load('src/ui/v2/discovery/DiscoveryChipRow.tsx').DiscoveryChipRow,r=await mount(C,{forMeAvailable:false,scope:'all',chips:[]});assert.equal(nodes(r,n=>n.props.testID==='chip-for-me').length,0);await unmount(r);});
test('UX02 empty ForMe state has distinct show-all and work-profile exits',async()=>{const m=createHarness();m.stubs['src/ui/system/StateView.tsx']={StateView:m.host('StateView')};m.stubs['src/ui/v2/QuietReadState.tsx']={QuietReadState:m.host('QuietReadState')};const C=m.load('src/ui/v2/discovery/DiscoveryListState.tsx').DiscoveryListState;let all=0,profile=0;const r=await mount(C,{state:{kind:'forMe',onShowAll:()=>all++,onWorkProfile:()=>profile++},clearAllLabel:'Očistite'});const state=nodes(r,n=>n.type==='StateView')[0];assert.equal(state.props.primary.label,'Prikažite sve zadatke');assert.equal(state.props.quiet.label,'Otvorite radni profil');state.props.primary.onPress();state.props.quiet.onPress();assert.deepEqual([all,profile],[1,1]);await unmount(r);});


// Reproduce the exact legacy 5,001-task boundary through the current P6
// owner/decoder. This tests keyset continuation locally, not hosted Auth/RLS.
test('P6 PAGE traverses 5,001 public items through 101 bounded 50-item requests without legacy cap', async () => {
 const total=5001, pageSize=50, calls=[]; let offset=0, prior=null;
 const key='2'.repeat(32),scopeKey='3'.repeat(32),a=anchor(key);
 const item=n=>({id:id(total-n),revision:1,sortAt:instant,publishedAt:instant,title:'Pomoć '+n,category:'Pomoć',
  status:'PUBLISHED',urgent:false,scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'REMOTE',
  taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',verifiedIdentityRequired:false,approximateCity:null,approximateArea:null,pin:null,
  requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
  priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:id(6001),responseDeadline:null,
  acceptsApplications:true,publicTopology:null,criticalConditions:[]});
 const o=owner(async req=>{
  assert.equal(req.mode,'PAGE');assert.equal(req.limit,pageSize);assert.deepEqual(req.scope,{kind:'ALL'});
  assert.deepEqual(req.anchor,prior===null?null:a);
  assert.deepEqual(req.after,prior);
  const start=offset,end=Math.min(total,start+pageSize),items=Array.from({length:end-start},(_,i)=>item(start+i));
  offset=end;const hasMore=end<total;
  const cursor=hasMore?{scopeKey,section:0,sortAt:instant,id:items[items.length-1].id}:null;
  prior=cursor;calls.push({start,end,hasMore});
  return {version:'DISCOVERY_V1',mode:'PAGE',asOf:instant,filterKey:key,anchor:a,items,hasMore,nextCursor:cursor,
   counts:{kind:'exact_live',observedAt:instant,mapped:total,listed:total,inArea:0,withoutPoint:total,undated:total},
   availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']}};
 });
 o.begin(filter(),{kind:'ALL'},pageSize);
 assert.equal((await o.firstPage()).kind,'applied');
 for(let i=0;i<100;i++)assert.equal((await o.nextPage()).kind,'applied',`page ${i+2}`);
 const snap=o.snapshot();
 assert.equal(snap.page.items.length,total);assert.equal(new Set(snap.page.items.map(x=>x.id)).size,total);
 assert.equal(snap.page.counts.listed,total);assert.equal(snap.page.hasMore,false);
 assert.equal(calls.length,101);assert.equal(calls.at(-1).end,total);
 assert.deepEqual(await o.nextPage(),{kind:'noop',reason:'NO_MORE'});
 o.retire();
});
