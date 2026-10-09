import { createDiscoveryV1ScreenSession } from '../discoveryV1ScreenSession';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import { initialMarketplaceView } from '../marketplaceView';

const AT='2026-09-28T10:00:00.000000Z',EX='2026-09-28T10:30:00.000000Z',A='a'.repeat(32),B='b'.repeat(32);
const ID1='11111111-1111-4111-8111-111111111111',ID2='33333333-3333-4333-8333-333333333333',PROFILE='22222222-2222-4222-8222-222222222222';
const anchor=()=>({version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=(id=ID1):any=>({id,revision:1,sortAt:AT,publishedAt:AT,title:'Task '+id.slice(0,4),category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null});
const page=(ids=[ID1],more=false):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:A,anchor:anchor(),items:ids.map(item),hasMore:more,
 nextCursor:more?{scopeKey:B,section:0,sortAt:AT,id:ids[ids.length-1]}:null,
 counts:{kind:'exact_live',observedAt:AT,mapped:2,listed:2,inArea:2,withoutPoint:0,undated:0},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']}});
const map=(bounds=[19,44,21,46] as [number,number,number,number]):any=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:A,anchor:anchor(),
 coverageBounds:bounds,effectiveGrid:8,wholeBounds:[19,44,21,46],buckets:[
  {kind:'TASK',key:'task:'+ID1,point:{lat:45.25,lng:19.83},taskId:ID1},
  {kind:'PLACE',key:'place:45.26:19.84',point:{lat:45.26,lng:19.84},taskCount:2},
  {kind:'CLUSTER',key:'cluster:1',point:{lat:45.3,lng:19.9},taskCount:5,distinctPointCount:3,memberBounds:[19.8,45.2,20,45.4]}],
 counts:{kind:'exact_live',observedAt:AT,mapped:8,withoutPoint:0}});
const exact=(id=ID1):any=>({version:'DISCOVERY_V1',mode:'EXACT_PUBLIC',asOf:AT,items:[item(id)],hasMore:false,nextCursor:null});
const places=(more=false):any=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:A,anchor:anchor(),
 items:[{key:'novi sad, liman',text:'Novi Sad, Liman',count:2}],hasMore:more,nextCursor:more?{count:2,text:'Novi Sad, Liman',key:'novi sad, liman'}:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:8,inArea:null}});
type P={request:DiscoveryV1OwnerRequest;signal:AbortSignal;resolve:(v:any)=>void};
const h=()=>{const pending:P[]=[];return {pending,transport:(request:DiscoveryV1OwnerRequest,signal:AbortSignal)=>new Promise<any>(resolve=>pending.push({request,signal,resolve}))};};
const wait=async(x:{pending:P[]},index:number)=>{for(let n=0;n<30&&!x.pending[index];n++)await Promise.resolve();if(!x.pending[index])throw new Error('P6_TEST_PENDING_'+index);};
const view=()=>({...initialMarketplaceView(),mode:'map' as const,viewport:{center:[20,45] as [number,number],zoom:10,bounds:[19,44,21,46] as [number,number,number,number]}});

it('opens PAGE first then MAP with the exact accepted anchor',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());
 expect(x.pending[0].request.mode).toBe('PAGE');x.pending[0].resolve(page());
 await wait(x,1);expect(x.pending[1].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19,44,21,46]}));
 x.pending[1].resolve(map());const result=await opening;expect(result.kind).toBe('applied');
 expect(result.snapshot.items).toHaveLength(1);expect(result.snapshot.mapMarkers).toHaveLength(3);
});
it('a settled map move changes PAGE scope and MAP coverage but keeps the browsing anchor',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const moved=s.settleMap([19.5,44.5,20.5,45.5]);expect(x.pending[2].request).toEqual(expect.objectContaining({mode:'PAGE',anchor:anchor(),scope:{kind:'AREA',bounds:[19.5,44.5,20.5,45.5]}}));
 expect(x.pending[3].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19.5,44.5,20.5,45.5]}));
 x.pending[2].resolve(page([ID2]));x.pending[3].resolve(map([19.5,44.5,20.5,45.5]));const r=await moved;
 expect(r.snapshot.view?.area).toEqual([19.5,44.5,20.5,45.5]);expect(r.snapshot.items[0].id).toBe(ID2);
});
it('new filter session fences an old page that resolves later',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport);const old=s.open(view());
 const newer=s.open({...view(),query:'novo'});expect(x.pending[0].signal.aborted).toBe(true);
 x.pending[1].resolve(page([ID2]));await wait(x,2);x.pending[2].resolve(map());await newer;
 x.pending[0].resolve({bad:'old'});expect((await old).kind).toBe('stale');expect(s.snapshot().items[0].id).toBe(ID2);
});
it('a TASK map marker whose row is NOT loaded resolves exact public data before exposing peek',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page([ID2]));await wait(x,1);x.pending[1].resolve(map());await opening;
 const marker=s.snapshot().mapMarkers[0],selected=s.selectMarker(marker);expect(x.pending[2].request).toEqual({mode:'EXACT_PUBLIC',needId:ID1});
 expect(s.snapshot().peek).toBeNull();
 x.pending[2].resolve(exact());expect((await selected)).toEqual({kind:'TASK',applied:true});expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1}});
});
it('PLACE map marker uses separate POINT_MEMBERS and never replaces main list',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const marker=s.snapshot().mapMarkers[1],selected=s.selectMarker(marker);expect((x.pending[2].request as any).scope).toEqual({kind:'POINT_MEMBERS',point:{lat:45.26,lng:19.84}});
 x.pending[2].resolve(page([ID2]));await selected;expect(s.snapshot().items[0].id).toBe(ID1);expect(s.snapshot().peek).toMatchObject({kind:'PLACE',items:[{id:ID2}]});
});
it('a newer cross-kind selection fences an older PLACE response',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const old=s.selectMarker(s.snapshot().mapMarkers[1]),fresh=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(x.pending[2].signal.aborted).toBe(true);
 x.pending[3].resolve(exact());await fresh;x.pending[2].resolve(page([ID2]));expect((await old).kind).toBe('stale');
 expect(s.snapshot().peek).toMatchObject({kind:'TASK'});expect(s.snapshot().memberHasMore).toBe(false);
});
it('CLUSTER is navigation geometry only and performs no task read',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const before=x.pending.length;expect(await s.selectMarker(s.snapshot().mapMarkers[2])).toEqual({kind:'CLUSTER',bounds:[19.8,45.2,20,45.4]});
 expect(x.pending).toHaveLength(before);
});
it('showPoint narrows list by POINT_LIST without overwriting server map buckets',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const narrow=s.showPoint({lat:45.26,lng:19.84});expect((x.pending[2].request as any).scope).toEqual({kind:'POINT_LIST',point:{lat:45.26,lng:19.84}});
 x.pending[2].resolve(page([ID2]));await narrow;expect(s.snapshot().items[0].id).toBe(ID2);expect(s.snapshot().mapMarkers).toHaveLength(3);
});
it('PAGE and PLACES continuations remain independent',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page([ID1],true));await wait(x,1);x.pending[1].resolve(map());await opening;
 const place=s.queryPlaces('nov',null,3);x.pending[2].resolve(places(true));await place;
 const nextPage=s.nextPage(),nextPlaces=s.nextPlaces();expect(x.pending[3].request.mode).toBe('PAGE');expect(x.pending[4].request.mode).toBe('PLACES');
 x.pending[3].resolve(page([ID2],false));x.pending[4].resolve({...places(false),items:[{key:'beograd',text:'Beograd',count:1}]});
 await Promise.all([nextPage,nextPlaces]);expect(s.snapshot().items.map(i=>i.id)).toEqual([ID1,ID2]);expect(s.snapshot().places).toHaveLength(2);
});
it('retire clears screen state and old responses cannot return it',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());s.retire();x.pending[0].resolve(page());
 expect((await opening).kind).toBe('stale');expect(s.snapshot()).toMatchObject({active:false,view:null,items:[],mapMarkers:[],peek:null});
});

const fresh=()=>({...initialMarketplaceView(),mode:'map' as const});
it('a first visit with no camera seeds MAP over the world, then reads the markers over the server\'s whole bounds',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(fresh());
 x.pending[0].resolve(page());await wait(x,1);
 expect(x.pending[1].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[-180,-90,180,90]}));
 x.pending[1].resolve({...map([-180,-90,180,90]),wholeBounds:[19.5,44.7,21.9,45.3],buckets:[]});
 await wait(x,2);
 expect(x.pending[2].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19.5,44.7,21.9,45.3]}));
 x.pending[2].resolve({...map([19.5,44.7,21.9,45.3]),wholeBounds:[19.5,44.7,21.9,45.3]});
 const result=await opening;expect(result.kind).toBe('applied');
 expect(result.snapshot.mapMarkers).toHaveLength(3);expect(result.snapshot.mapWholeBounds).toEqual([19.5,44.7,21.9,45.3]);
});
it('a first visit with no pinned task stops after the seed and shows no map',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(fresh());
 x.pending[0].resolve(page());await wait(x,1);
 x.pending[1].resolve({...map([-180,-90,180,90]),wholeBounds:null,buckets:[]});
 const result=await opening;expect(result.kind).toBe('applied');expect(x.pending).toHaveLength(2);
 expect(result.snapshot.mapMarkers).toEqual([]);expect(result.snapshot.mapWholeBounds).toBeNull();
});
it('remote intent and a remembered camera never seed',async()=>{
 const a=h(),sa=createDiscoveryV1ScreenSession(a.transport),ra=sa.open({...fresh(),where:'remote'});
 a.pending[0].resolve(page());expect((await ra).kind).toBe('applied');expect(a.pending).toHaveLength(1);
 const b=h(),sb=createDiscoveryV1ScreenSession(b.transport),rb=sb.open(view());
 b.pending[0].resolve(page());await wait(b,1);
 expect(b.pending[1].request).toEqual(expect.objectContaining({mode:'MAP',bounds:[19,44,21,46]}));
 b.pending[1].resolve(map());await rb;expect(b.pending).toHaveLength(2);
});
it('a newer open fences the seed answer that resolves late',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),old=s.open(fresh());
 x.pending[0].resolve(page());await wait(x,1);
 const newer=s.open({...fresh(),query:'novo'});
 x.pending[1].resolve({...map([-180,-90,180,90]),wholeBounds:[19,44,21,46]});
 expect((await old).kind).toBe('stale');
 x.pending[2].resolve(page([ID2]));await wait(x,3);x.pending[3].resolve({...map([-180,-90,180,90]),wholeBounds:null,buckets:[]});
 expect((await newer).kind).toBe('applied');expect(s.snapshot().items[0].id).toBe(ID2);
});

// A camera move that is not the person's own (a fit to a chosen place, Nearby, a saved work area) leaves the buckets of the region it left:
// only the MAP is read again, over what is on screen now. The list, its scope, the peek and the selection do not move.
it('refreshMap reads only the MAP over the new region and leaves the list, the peek and the view alone',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const picked=s.selectMarker(s.snapshot().mapMarkers[0]);x.pending[2].resolve(exact());await picked;
 const before=s.snapshot(),reads=x.pending.length;
 const refreshing=s.refreshMap([19.7123456789,44.51234567891,20.2999999999,45.4123456789]);
 expect(x.pending).toHaveLength(reads+1);
 expect(x.pending[reads].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19.712346,44.512346,20.3,45.412346]}));
 x.pending[reads].resolve(map([19.712346,44.512346,20.3,45.412346]));
 const result=await refreshing;expect(result.kind).toBe('applied');
 const after=s.snapshot();
 expect(after.mapMarkers).toHaveLength(3);expect(after.items).toEqual(before.items);expect(after.view).toEqual(before.view);
 expect(after.peek).toEqual(before.peek);expect(after.pageHasMore).toBe(before.pageHasMore);
 expect(after.view?.area).toBeNull();
});
it('refreshMap does not read again for a region that is where the map was last read',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const reads=x.pending.length;
 expect((await s.refreshMap([19.00001,44.00001,21.00002,46.00001])).kind).toBe('noop');
 expect((await s.refreshMap([19,44,21,46])).kind).toBe('noop');
 expect(x.pending).toHaveLength(reads);
 // A region that is clearly another place is read.
 const refreshing=s.refreshMap([19.7,45.2,20,45.4]);expect(x.pending).toHaveLength(reads+1);
 x.pending[reads].resolve(map([19.7,45.2,20,45.4]));expect((await refreshing).kind).toBe('applied');
});
it('a newer own settle fences an older refresh, and a refresh before any view is a noop',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport);
 expect((await s.refreshMap([19,44,21,46])).kind).toBe('noop');expect(x.pending).toHaveLength(0);
 const opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const old=s.refreshMap([19.6,44.6,19.9,44.9]),reads=x.pending.length;
 const settled=s.settleMap([19.5,44.5,20.5,45.5]);expect(x.pending[reads-1].signal.aborted).toBe(true);
 x.pending[reads].resolve(page([ID2]));x.pending[reads+1].resolve(map([19.5,44.5,20.5,45.5]));await settled;
 x.pending[reads-1].resolve({bad:'old'});expect((await old).kind).toBe('stale');
 expect(s.snapshot().view?.area).toEqual([19.5,44.5,20.5,45.5]);expect(s.snapshot().items[0].id).toBe(ID2);
});

// EX-03 (owner approval 2026-09-30): pin -> the existing card reacts at once from Discovery data the client already holds. PAGE and EXACT_PUBLIC return the same public item,
// so a row the list already holds IS the card's data; the exact read still goes out and only confirms or refreshes it.
const openLoaded=async(ids=[ID1])=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page(ids));await wait(x,1);x.pending[1].resolve(map());await opening;
 return {x,s};
};
it('EX-03: a TASK marker whose row is already loaded shows its card before any answer, and the exact read still goes out',async()=>{
 const {x,s}=await openLoaded();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1,revision:1}});          // no answer yet
 expect(x.pending[2].request).toEqual({mode:'EXACT_PUBLIC',needId:ID1});
 x.pending[2].resolve(exact());expect(await selected).toEqual({kind:'TASK',applied:true});
 expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1}});
});
it('EX-03: an exact answer with the same item leaves the known card untouched; a newer revision replaces it',async()=>{
 const {x,s}=await openLoaded();
 const first=s.selectMarker(s.snapshot().mapMarkers[0]);const known=s.snapshot().peek;
 x.pending[2].resolve(exact());await first;
 expect(s.snapshot().peek).toBe(known);                                                      // the very same card object: nothing to redraw
 const again=s.selectMarker(s.snapshot().mapMarkers[0]);
 x.pending[3].resolve({...exact(),items:[{...item(),revision:2,title:'Promenjen naslov'}]});await again;
 expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1,revision:2}});
 expect((s.snapshot().peek as any).item.naslov).toBe('Promenjen naslov');
});
it('EX-03: a failed exact read keeps the known card and does not fail the selection; without a known row it still fails as before',async()=>{
 const {x,s}=await openLoaded();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 x.pending[2].resolve({bad:'shape'});                                                        // the decoder refuses it: a failed read
 expect(await selected).toEqual({kind:'TASK',applied:true});
 expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1}});
 const y=await openLoaded([ID2]);
 const unknown=y.s.selectMarker(y.s.snapshot().mapMarkers[0]);
 y.x.pending[2].resolve({bad:'shape'});await expect(unknown).rejects.toThrow();
 expect(y.s.snapshot().peek).toBeNull();
});
it('EX-03: an exact answer that no longer has the task takes its known card away',async()=>{
 const {x,s}=await openLoaded();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);expect(s.snapshot().peek).not.toBeNull();
 x.pending[2].resolve({...exact(),items:[]});
 expect(await selected).toEqual({kind:'TASK',applied:false});expect(s.snapshot().peek).toBeNull();
});
it('EX-03: a newer touch fences the known card of an older one, and a late answer of the older one changes nothing',async()=>{
 const {x,s}=await openLoaded([ID1,ID2]);
 const older=s.selectMarker(s.snapshot().mapMarkers[0]);
 s.clearPeek();expect(s.snapshot().peek).toBeNull();
 x.pending[2].resolve(exact());expect((await older).kind).toBe('stale');
 expect(s.snapshot().peek).toBeNull();
});
it('EX-03 warm return: a selection read in flight when the screen leaves never lands, and the card that was showing stays', async () => {
 const {x,s}=await openLoaded();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 const card=s.snapshot().peek;expect(card).not.toBeNull();
 s.suspend();
 x.pending[2].resolve({...exact(),items:[{...item(),revision:9,title:'Kasni odgovor'}]});
 expect(await selected).toEqual({kind:'stale'});
 expect(s.snapshot().peek).toBe(card);
 expect(s.snapshot().items).toHaveLength(1);
});

// EX-03 (PLACE): the same idea for a point several tasks share. When every task of the place is already in the loaded list (the bucket's count equals the rows the list holds at that
// point) the card is exposed at once; the members read still goes out and only confirms or refreshes it. A place that is not fully loaded waits for the read, as before.
const placeBucket=(count:number)=>({kind:'PLACE',key:'place:45.25:19.83',point:{lat:45.25,lng:19.83},taskCount:count});
const openPlace=async(ids=[ID1,ID2],count=2)=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());
 x.pending[0].resolve(page(ids));await wait(x,1);x.pending[1].resolve({...map(),buckets:[placeBucket(count)],counts:{...map().counts,mapped:count}});await opening;
 return {x,s};
};
const membersWithTotal=(ids:string[],total:number,more=false)=>{
 const result=page(ids,more);
 return {...result,counts:{...result.counts,listed:total,mapped:total,inArea:total}};
};
it('a dense PLACE keeps its exact member total separate from the bounded 50-row preview and main PAGE',async()=>{
 const {x,s}=await openPlace([ID1],4100);
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(x.pending[2].request).toMatchObject({scope:{kind:'POINT_MEMBERS'},limit:50});
 const ids=Array.from({length:50},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`);
 x.pending[2].resolve(membersWithTotal(ids,4000,true));await selected;
 const peek=s.snapshot().peek;
 expect(peek).toMatchObject({kind:'PLACE',totalCount:4000});
 expect(peek?.kind==='PLACE'&&peek.items.length).toBe(50);
 expect(s.snapshot().counts?.listed).toBe(2);expect(s.snapshot().memberHasMore).toBe(true);
 const more=s.nextMembers();x.pending[3].resolve(membersWithTotal([ID2],3999,true));await more;
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',totalCount:3999});
 expect(s.snapshot().memberHasMore).toBe(true);
});
it('a fresh POINT_MEMBERS count replaces a stale map total even when the preview rows are unchanged',async()=>{
 const {x,s}=await openPlace();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(s.snapshot().peek).toMatchObject({totalCount:2});
 const known=s.snapshot().peek;
 x.pending[2].resolve(membersWithTotal([ID1,ID2],4,true));await selected;
 expect(s.snapshot().peek).not.toBe(known);
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',totalCount:4,items:[{id:ID1},{id:ID2}]});
});
it('a late PLACE count cannot overwrite a more recent PLACE selection',async()=>{
 const {x,s}=await openPlace([ID1],4000);
 const old=s.selectMarker(s.snapshot().mapMarkers[0]);
 const fresh=s.selectMarker({kind:'PLACE',key:'other',point:{lat:44.8,lng:20.4},taskCount:8});
 x.pending[3].resolve(membersWithTotal([ID2],8,true));await fresh;
 x.pending[2].resolve(membersWithTotal([ID1],4000,true));expect((await old).kind).toBe('stale');
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',point:{lat:44.8,lng:20.4},totalCount:8});
});
it('a members continuation already decoded by the owner cannot land after another selection in the same microtask turn',async()=>{
 const {x,s}=await openPlace();
 const first=s.selectMarker(s.snapshot().mapMarkers[0]);
 x.pending[2].resolve(membersWithTotal([ID1,ID2],3,true));await first;
 const old=s.nextMembers();
 x.pending[3].resolve(membersWithTotal(['55555555-5555-4555-8555-555555555555'],3));
 // Owner resumes first; this continuation runs before the screen resumes from awaiting that owner result.
 await Promise.resolve();
 const fresh=s.selectMarker(s.snapshot().mapMarkers[0]),card=s.snapshot().peek;
 expect(card).toMatchObject({totalCount:2});
 expect((await old).kind).toBe('stale');expect(s.snapshot().peek).toBe(card);
 x.pending[4].resolve(membersWithTotal([ID1,ID2],2));await fresh;
});
it('EX-03: a PLACE marker whose every task is already loaded shows its card before any answer; the members read still goes out and only confirms',async()=>{
 const {x,s}=await openPlace();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',totalCount:2,items:[{id:ID1},{id:ID2}]});                   // no answer yet
 expect(x.pending[2].request).toMatchObject({mode:'PAGE',scope:{kind:'POINT_MEMBERS'}});
 const known=s.snapshot().peek;
 x.pending[2].resolve(page([ID1,ID2]));expect(await selected).toEqual({kind:'PLACE',applied:true});
 expect(s.snapshot().peek).toBe(known);                                                                // the same card object: nothing to redraw
});
it('EX-03: a PLACE that is not fully loaded waits for the members read as before',async()=>{
 const {x,s}=await openPlace([ID1,ID2],3);
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(s.snapshot().peek).toBeNull();
 const three=page([ID1,ID2,'55555555-5555-4555-8555-555555555555']);x.pending[2].resolve({...three,counts:{...three.counts,mapped:3,listed:3,inArea:3}});expect(await selected).toEqual({kind:'PLACE',applied:true});
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',totalCount:3});expect((s.snapshot().peek as any).items).toHaveLength(3);
});
it('EX-03: a members answer that differs replaces the known place card, and one with no tasks empties it',async()=>{
 const {x,s}=await openPlace();
 const first=s.selectMarker(s.snapshot().mapMarkers[0]);const known=s.snapshot().peek;
 x.pending[2].resolve(membersWithTotal([ID2],1));await first;
 expect(s.snapshot().peek).not.toBe(known);expect(s.snapshot().peek).toMatchObject({totalCount:1,items:[{id:ID2}]});
 const again=s.selectMarker(s.snapshot().mapMarkers[0]);x.pending[3].resolve(membersWithTotal([],0));await again;
 expect(s.snapshot().peek).toMatchObject({totalCount:0,items:[]});
});
it('EX-03: a failed members read keeps the known place card, and without a known card it still fails as before',async()=>{
 const {x,s}=await openPlace();
 const selected=s.selectMarker(s.snapshot().mapMarkers[0]);
 x.pending[2].resolve({bad:'shape'});expect(await selected).toEqual({kind:'PLACE',applied:true});
 expect(s.snapshot().peek).toMatchObject({kind:'PLACE',items:[{id:ID1},{id:ID2}]});
 const y=await openPlace([ID1,ID2],3);
 const unknown=y.s.selectMarker(y.s.snapshot().mapMarkers[0]);
 y.x.pending[2].resolve({bad:'shape'});await expect(unknown).rejects.toThrow();
 expect(y.s.snapshot().peek).toBeNull();
});
it('EX-03: a newer touch fences the known place card of an older one, and its late answer changes nothing',async()=>{
 const {x,s}=await openPlace();
 const older=s.selectMarker(s.snapshot().mapMarkers[0]);
 s.clearPeek();expect(s.snapshot().peek).toBeNull();
 x.pending[2].resolve(page([ID1,ID2]));expect((await older).kind).toBe('stale');
 expect(s.snapshot().peek).toBeNull();
});

// Audit fixes 2 and 4: a settled pan of the person's own reads the list over what they can see and the map over its whole frame, and a chosen task stays
// chosen (with its card) while its bucket is still on the map; a choice whose bucket left the map is let go.
it('a settled pan reads the seen band for the list and the frame for the map, and keeps a chosen task whose bucket stays',async()=>{
 const {x,s}=await openLoaded();
 const picked=s.selectMarker(s.snapshot().mapMarkers[0]);x.pending[2].resolve(exact());await picked;
 const card=s.snapshot().peek;expect(s.chosenKey()).toBe('task:'+ID1);
 const moved=s.settleMap([19.6,44.6,20.4,45.4],[19.5,44.5,20.5,45.5]);
 expect(x.pending[3].request).toEqual(expect.objectContaining({mode:'PAGE',scope:{kind:'AREA',bounds:[19.6,44.6,20.4,45.4]}}));
 expect(x.pending[4].request).toEqual(expect.objectContaining({mode:'MAP',bounds:[19.5,44.5,20.5,45.5]}));
 expect(s.snapshot().peek).toBe(card);                                              // the card stays while the move is read
 x.pending[3].resolve(page([ID2]));x.pending[4].resolve(map([19.5,44.5,20.5,45.5]));
 expect((await moved).kind).toBe('applied');
 expect(s.snapshot().peek).toBe(card);expect(s.chosenKey()).toBe('task:'+ID1);
 expect(s.snapshot().view).toMatchObject({area:[19.6,44.6,20.4,45.4],pinPlace:null});
});
it('a settled pan whose map no longer has the chosen bucket lets it go, and its late exact answer changes nothing',async()=>{
 const {x,s}=await openLoaded([ID2]);
 const picked=s.selectMarker(s.snapshot().mapMarkers[0]);                         // not loaded: the exact read is out
 const moved=s.settleMap([19.6,44.6,20.4,45.4],[19.5,44.5,20.5,45.5]);
 x.pending[3].resolve(page([ID2]));x.pending[4].resolve({...map([19.5,44.5,20.5,45.5]),buckets:[]});
 expect((await moved).kind).toBe('applied');
 expect(s.chosenKey()).toBeNull();expect(s.snapshot().peek).toBeNull();
 expect(x.pending[2].signal.aborted).toBe(true);
 x.pending[2].resolve(exact());expect((await picked).kind).toBe('stale');expect(s.snapshot().peek).toBeNull();
});
// Audit fix 5: an unchanged answer is handed out again, not converted again.
it('snapshots hand out the same rows, cards and markers until a new answer lands',async()=>{
 const {x,s}=await openLoaded([ID1,ID2]);
 const a=s.snapshot(),b=s.snapshot();
 expect(b.items).toBe(a.items);expect(b.wireItems).toBe(a.wireItems);expect(b.mapMarkers).toBe(a.mapMarkers);
 const more=s.settleMap([19.6,44.6,20.4,45.4]);x.pending[2].resolve(page([ID2]));x.pending[3].resolve(map([19.6,44.6,20.4,45.4]));await more;
 const c=s.snapshot();expect(c.items).not.toBe(a.items);expect(c.items.map(row=>row.id)).toEqual([ID2]);expect(c.mapMarkers).not.toBe(a.mapMarkers);
});
