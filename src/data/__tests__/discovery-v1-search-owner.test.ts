import { createDiscoveryV1SearchOwner, DISCOVERY_V1_PLACES_BY_CITY, discoveryV1SearchPreviewKey, SEARCH_PREVIEW_FRESH_MS, type SearchPreviewView } from '../discoveryV1SearchOwner';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';

const AT='2026-09-29T05:00:00.000000Z',EX='2026-09-29T05:30:00.000000Z',A='a'.repeat(32),B='b'.repeat(32);
const ID='11111111-1111-4111-8111-111111111111',PROFILE='22222222-2222-4222-8222-222222222222';
const anchor=()=>({version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=():any=>({id:ID,revision:1,sortAt:AT,publishedAt:AT,title:'Selidba',category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null});
const page=(listed=42):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:A,anchor:anchor(),items:[item()],hasMore:true,
 nextCursor:{scopeKey:B,section:0,sortAt:AT,id:ID},counts:{kind:'exact_live',observedAt:AT,mapped:80,listed,inArea:Math.min(30,listed),withoutPoint:Math.min(5,listed),undated:7},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['MY_PRICE','OFFERS']}});
const places=(rows=[{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}],more=true):any=>({
 version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:A,anchor:anchor(),items:rows,hasMore:more,
 nextCursor:more?{count:rows[rows.length-1].count,text:rows[rows.length-1].text,key:rows[rows.length-1].key}:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:80,inArea:23}});
type Pending={request:DiscoveryV1OwnerRequest;signal:AbortSignal;resolve:(v:unknown)=>void;reject:(e?:unknown)=>void};
const harness=()=>{const pending:Pending[]=[];return{pending,transport:(request:DiscoveryV1OwnerRequest,signal:AbortSignal)=>new Promise<unknown>((resolve,reject)=>pending.push({request,signal,resolve,reject}))};};
const view=(patch:Partial<MarketplaceView>={}):MarketplaceView=>({...initialMarketplaceView(),mode:'map',viewport:{center:[19.8,45.2],zoom:11,bounds:[19,44,21,46]},...patch});

it('uses PAGE exact counts and PLACES facets instead of loaded-row length',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({query:'nov',when:'tomorrow',price:'OFFERS'});
 const read=owner.preview(v,[19,44,21,46],3);
 expect(h.pending.map(x=>x.request.mode)).toEqual(['PAGE','PLACES']);
 expect(h.pending[0].request).toMatchObject({mode:'PAGE',limit:1,after:null});
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:'nov',facetArea:[19,44,21,46],limit:3,after:null});
 h.pending[0].resolve(page(42));h.pending[1].resolve(places());
 const result=await read;expect(result.kind).toBe('applied');
 expect(owner.snapshot()).toMatchObject({status:'ready',count:42,undated:7,everywhere:80,inMapArea:23,placeHasMore:true,facetError:false});
 expect(owner.snapshot().places).toEqual([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}]);
 expect(owner.snapshot().key).toBe(discoveryV1SearchPreviewKey(v,[19,44,21,46]));
});

// The letters typed in "Gde" to find a place are the PLACES prefix and nothing else: the tasks' own text filter is "Šta" (owner, 2026-10-07).
it('the letters typed to find a place narrow the places only; the words searched narrow the count only',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v:SearchPreviewView={...view({query:'selidba'}),placeSearch:'  Vrač  '};
 const read=owner.preview(v,[19,44,21,46],3);
 expect(h.pending[0].request).toMatchObject({mode:'PAGE',filter:{text:'selidba',place:null}});
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:'vrač',filter:{text:''}});
 // The parts of a city are asked for apart (the AREA rows), over the same letters and the same facets.
 expect(h.pending[2].request).toMatchObject({mode:'PLACES',prefix:'vrač',filter:{text:''},facetArea:[19,44,21,46]});
 h.pending[0].resolve(page(8));h.pending[1].resolve(places([{key:'beograd',text:'Beograd',count:3}],true));
 h.pending[2].resolve(places([{key:'beograd, vračar',text:'Beograd, Vračar',count:3}],false));await read;
 expect(owner.snapshot().key).toBe(discoveryV1SearchPreviewKey(v,[19,44,21,46]));
 // The continuation of the cities keeps the same prefix.
 const next=owner.nextPlaces();expect(h.pending[3].request).toMatchObject({mode:'PLACES',prefix:'vrač',groupBy:'CITY'});
 h.pending[3].resolve(places([{key:'beograd',text:'Beograd',count:3},{key:'novi sad',text:'Novi Sad',count:1}],false));await next;
});

// DISCOVERY-GRAD (owner decision d14, applied to DEV 2026-10-08): "Gde" lists CITIES; the parts of a city are the AREA rows, asked for apart by the letters typed.
it('the places are asked as cities in every read of the list, and the parts of a city are asked for apart by the letters typed',async()=>{
 expect(DISCOVERY_V1_PLACES_BY_CITY).toBe(true);
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v:SearchPreviewView={...view(),placeSearch:'lim'},area:[number,number,number,number]=[19,44,21,46];
 const read=owner.preview(v,area,3);
 expect(h.pending.map(x=>x.request.mode)).toEqual(['PAGE','PLACES','PLACES']);
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:'lim',groupBy:'CITY',anchor:null,after:null,limit:3});
 // the AREA request is the list of before: no key at all, and its own chain (no anchor)
 expect('groupBy' in h.pending[2].request).toBe(false);
 expect(h.pending[2].request).toMatchObject({mode:'PLACES',prefix:'lim',anchor:null,after:null,limit:3});
 h.pending[0].resolve(page(5));
 h.pending[1].resolve(places([{key:'limanovci',text:'Limanovci',count:2}],true));
 h.pending[2].resolve(places([{key:'liman, novi sad',text:'Liman, Novi Sad',count:9},{key:'novi sad',text:'Novi Sad',count:4}],false));
 await read;
 expect(owner.snapshot().places).toEqual([{key:'limanovci',text:'Limanovci',count:2}]);
 // only a part of a city (a place text with a comma) is kept: a bare city name is a city row and is not offered twice
 expect(owner.snapshot().parts).toEqual([{key:'liman, novi sad',text:'Liman, Novi Sad',count:9}]);
 expect(owner.snapshot()).toMatchObject({status:'ready',facetError:false,placeHasMore:true});
 // the continuation pages the cities only, over the cities' own anchor and cursor
 const next=owner.nextPlaces();
 expect(h.pending[3].request).toMatchObject({mode:'PLACES',prefix:'lim',groupBy:'CITY',anchor:anchor(),after:{count:2,text:'Limanovci',key:'limanovci'}});
 h.pending[3].resolve(places([{key:'limanovci',text:'Limanovci',count:2},{key:'limani',text:'Limani',count:1}],false));await next;
 expect(owner.snapshot().places.map(row=>row.key)).toEqual(['limanovci','limani']);
 expect(owner.snapshot().parts).toHaveLength(1);
});

it('a draft that says no letters asks for the cities alone; the parts are asked for only by letters typed in "Gde"',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 void owner.preview({...view(),placeSearch:''},null,3);
 expect(h.pending.map(x=>x.request.mode)).toEqual(['PAGE','PLACES']);
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:'',groupBy:'CITY'});
 // the words searched are the prefix of a caller that says nothing of letters: that is the places of before, so no parts either
 void owner.preview(view({query:'selidba'}),null,3);
 expect(h.pending.slice(2).map(x=>x.request.mode)).toEqual(['PAGE','PLACES']);
});

it('a failed or unreadable read of the parts leaves the cities standing, and says nothing of them',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v:SearchPreviewView={...view(),placeSearch:'lim'};
 const read=owner.preview(v,null,3);
 h.pending[0].resolve(page(5));h.pending[1].resolve(places([{key:'novi sad',text:'Novi Sad',count:4}],false));h.pending[2].reject(new Error('P6_INVALID_REQUEST'));
 await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',facetError:false,parts:[]});
 expect(owner.snapshot().places).toEqual([{key:'novi sad',text:'Novi Sad',count:4}]);
 const again=owner.preview({...v,placeSearch:'lima'},null,3);
 h.pending[3].resolve(page(5));h.pending[4].resolve(places([{key:'novi sad',text:'Novi Sad',count:4}],false));h.pending[5].resolve({bad:'shape'});
 await again;
 expect(owner.snapshot()).toMatchObject({status:'ready',facetError:false,parts:[]});
 expect(owner.snapshot().places).toHaveLength(1);
});

it('a server that refuses the cities leaves the count working and says the places are not available',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 const read=owner.preview({...view(),placeSearch:''},null,3);
 h.pending[0].resolve(page(5));h.pending[1].reject(new Error('P6_INVALID_REQUEST'));
 await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',count:5,facetError:true,places:[],parts:[]});
});

it('another set of letters is another preview, and a draft that says no letters keeps the words out of the places',async()=>{
 const base=view({query:'selidba'}),area:[number,number,number,number]=[19,44,21,46];
 const key=(placeSearch?:string)=>discoveryV1SearchPreviewKey(placeSearch===undefined?base:{...base,placeSearch},area);
 expect(key('a')).not.toBe(key('ab'));expect(key('')).not.toBe(key('a'));
 // Equal letters in another spelling of the spaces are one question.
 expect(key('  vrač ')).toBe(key('vrač'));
 // A caller that does not say them gets the old behaviour: the words are the prefix.
 expect(key()).toBe(discoveryV1SearchPreviewKey({...base,placeSearch:'selidba'},area));
 expect(key()).not.toBe(key(''));
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 void owner.preview({...base,placeSearch:''},area,3);
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:''});
 void owner.preview(base,area,3);
 expect(h.pending[3].request).toMatchObject({mode:'PLACES',prefix:'selidba'});
});

it('a newer draft fences an older PAGE and PLACES pair even if abort is ignored',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 const old=owner.preview(view({query:'staro'}),null,3),fresh=owner.preview(view({query:'novo'}),null,3);
 expect(h.pending[0].signal.aborted).toBe(true);expect(h.pending[1].signal.aborted).toBe(true);
 h.pending[2].resolve(page(6));h.pending[3].resolve(places([{key:'novi sad',text:'Novi Sad',count:6}],false));
 expect((await fresh).kind).toBe('applied');
 h.pending[0].resolve({bad:'old'});h.pending[1].resolve({bad:'old'});
 expect((await old).kind).toBe('stale');expect(owner.snapshot().count).toBe(6);
});

it('PLACES continuation retains prefix facet area and cursor, then deduplicates keys',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 const first=owner.preview(view({query:'nov'}),[19,44,21,46],2);
 h.pending[0].resolve(page());h.pending[1].resolve(places([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}],true));await first;
 const next=owner.nextPlaces();expect(h.pending[2].request).toMatchObject({mode:'PLACES',prefix:'nov',facetArea:[19,44,21,46],
  after:{count:9,text:'Novi Sad, Liman',key:'novi sad, liman'}});
 h.pending[2].resolve(places([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9},{key:'novi sad, centar',text:'Novi Sad, Centar',count:4}],false));
 expect((await next).kind).toBe('applied');
 expect(owner.snapshot().places.map(x=>x.key)).toEqual(['novi sad, liman','novi sad, centar']);
 expect(owner.snapshot().placeHasMore).toBe(false);
});

it('remote preview never asks for locality facets',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({where:'remote',query:'online'});
 const read=owner.preview(v,[19,44,21,46],10);
 expect(h.pending).toHaveLength(1);expect(h.pending[0].request.mode).toBe('PAGE');
 h.pending[0].resolve(page(11));await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',count:11,places:[],placeHasMore:false,facetError:false,everywhere:null,inMapArea:null});
});

it('facet failure does not fabricate zero and does not disable an authoritative PAGE count',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),read=owner.preview(view(),null,10);
 h.pending[0].resolve(page(12));h.pending[1].reject(Error('facet down'));await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',count:12,facetError:true,places:[],everywhere:null});
});

it('retire makes late responses stale and clears search truth',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),read=owner.preview(view(),null,10);
 owner.retire();h.pending[0].resolve(page());h.pending[1].resolve(places());
 expect((await read).kind).toBe('stale');expect(owner.snapshot()).toMatchObject({active:false,status:'idle',count:null,key:null});
});

// A preview asked again for the same draft must not read again: the panel used to ask after every preview it received, a request loop.
it('the same draft asked again while it is being read, or just read, reads nothing; a changed draft or a failed read does',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({query:'nov'}),area:[number,number,number,number]=[19,44,21,46];
 const first=owner.preview(v,area,3);expect(h.pending).toHaveLength(2);
 // Asked again while loading (with an equal but distinct array): nothing new is sent and nothing is aborted.
 const again=await owner.preview(v,[...area],3);expect(again.kind).toBe('noop');expect(h.pending).toHaveLength(2);
 expect(h.pending[0].signal.aborted).toBe(false);
 h.pending[0].resolve(page(42));h.pending[1].resolve(places());await first;
 // Just read: answered by what is there.
 expect((await owner.preview(v,[...area],3)).kind).toBe('noop');expect(h.pending).toHaveLength(2);
 expect(owner.snapshot()).toMatchObject({status:'ready',count:42});
 // A changed draft always reads.
 const other=owner.preview(view({query:'novi'}),area,3);expect(h.pending).toHaveLength(4);
 h.pending[2].resolve(page(9));h.pending[3].resolve(places());await other;expect(owner.snapshot().count).toBe(9);
});
it('a preview read a while ago is read again, and a failed one is asked again at once',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({query:'nov'}),now=jest.spyOn(Date,'now');
 now.mockReturnValue(1_000_000);
 const first=owner.preview(v,null,3);h.pending[0].resolve(page(5));h.pending[1].resolve(places());await first;
 now.mockReturnValue(1_000_000+SEARCH_PREVIEW_FRESH_MS-1);expect((await owner.preview(v,null,3)).kind).toBe('noop');expect(h.pending).toHaveLength(2);
 now.mockReturnValue(1_000_000+SEARCH_PREVIEW_FRESH_MS+1);
 const stale=owner.preview(v,null,3);expect(h.pending).toHaveLength(4);
 const failure=expect(stale).rejects.toBeDefined();h.pending[2].resolve({bad:'page'});h.pending[3].resolve(places());await failure;
 expect(owner.snapshot().status).toBe('error');
 const retry=owner.preview(v,null,3);expect(h.pending).toHaveLength(6);
 h.pending[4].resolve(page(5));h.pending[5].resolve(places());expect((await retry).kind).toBe('applied');now.mockRestore();
});

// EX-03 warm return: a preview belongs to one visit of the search panel. A suspended owner drops what it read and what it was reading, and stays usable; the same draft asked again reads.
it('suspend drops the preview and the one in flight, and the owner reads again afterwards', async () => {
  const h = harness(), owner = createDiscoveryV1SearchOwner(h.transport), v = view({ query: 'nov' });
  const first = owner.preview(v, null, 3);
  h.pending[0].resolve(page(42)); h.pending[1].resolve(places()); await first;
  expect(owner.snapshot()).toMatchObject({ status: 'ready', count: 42 });
  const inFlight = owner.preview(view({ query: 'novo' }), null, 3);
  owner.suspend();
  expect(h.pending[2].signal.aborted).toBe(true); expect(h.pending[3].signal.aborted).toBe(true);
  h.pending[2].resolve(page(6)); h.pending[3].resolve(places());
  expect((await inFlight).kind).toBe('stale');
  expect(owner.snapshot()).toMatchObject({ active: true, status: 'idle', key: null, count: null, places: [] });
  const again = owner.preview(v, null, 3);                                // the same draft as the ready one: read, not answered from the old preview
  expect(h.pending).toHaveLength(6);
  h.pending[4].resolve(page(42)); h.pending[5].resolve(places());
  expect((await again).kind).toBe('applied');
  owner.retire(); owner.suspend();
  expect(owner.snapshot().active).toBe(false);
});
