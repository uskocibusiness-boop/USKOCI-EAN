import { discoveryV1EnrichmentTargets, discoveryV1MapMarkers, discoveryV1Opportunity,
  discoveryV1PointMembersScope, discoveryV1ViewPlan } from '../discoveryV1MarketplaceAdapter';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';
import type { DiscoveryV1Item } from '../discoveryV1Contract';

const ID='11111111-1111-4111-8111-111111111111', PROFILE='22222222-2222-4222-8222-222222222222';
const AT='2026-09-28T10:00:00.000000Z',A='a'.repeat(32);
const view=(patch:Partial<MarketplaceView>={}):MarketplaceView=>({...initialMarketplaceView(),mode:'map',...patch});
const item=(patch:Partial<DiscoveryV1Item>={}):DiscoveryV1Item=>({
 id:ID,revision:4,sortAt:AT,publishedAt:AT,title:'Prenos troseda',category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:2,coveredSlots:1,requiredSkills:['Selidbe'],requiredTools:['Kaiševi'],requiredVehicles:['Kombi'],requiredLicenses:[],
 minimumExperienceYears:null,priceMode:'MY_PRICE',requesterPriceRsd:5000,priceBasis:'TOTAL',requesterProfileId:PROFILE,responseDeadline:null,
 acceptsApplications:true,publicTopology:null,criticalConditions:['Treći sprat'],...patch
});
it('maps one MarketplaceView to one strict filter and AREA list scope',()=>{
 const p=discoveryV1ViewPlan(view({query:'  trosed ',area:[19.7,45.1,20,45.4],viewport:{center:[19.85,45.25],zoom:12,bounds:[19.6,45,20.1,45.5]},
  price:'MY_PRICE',when:'tomorrow',where:'onsite',places:2,place:'Novi Sad, Liman'}));
 expect(p.filter).toEqual({text:'  trosed ',price:'MY_PRICE',where:'onsite',places:2,when:'tomorrow',dates:null,place:'Novi Sad, Liman'});
 expect(p.pageScope).toEqual({kind:'AREA',bounds:[19.7,45.1,20,45.4]});expect(p.mapBounds).toEqual([19.6,45,20.1,45.5]);
 expect(p.placesFacetArea).toEqual([19.7,45.1,20,45.4]);
});
it('dates override a stale quick-date word',()=>expect(discoveryV1ViewPlan(view({when:'week',dates:{from:'2026-09-30',to:'2026-10-02'}})).filter)
 .toEqual(expect.objectContaining({when:'any',dates:{from:'2026-09-30',to:'2026-10-02'}})));
it.each([1,5000,2_147_483_647])('sends the minimal stated fixed price without changing its basis or other filters: %s',minBudgetRsd=>{
 const baseline=discoveryV1ViewPlan(view({price:'MY_PRICE',forMe:true,where:'remote'}));
 const constrained=discoveryV1ViewPlan(view({price:'MY_PRICE',forMe:true,where:'remote',minBudgetRsd}));
 expect(constrained).toEqual({...baseline,filter:{...baseline.filter,minBudgetRsd}});
});
it.each([undefined,null])('absent or empty minimum preserves the exact old serialized filter: %s',minBudgetRsd=>{
 for(const price of ['all','MY_PRICE','OFFERS'] as const){
  const before=discoveryV1ViewPlan(view({price}));
  expect(JSON.stringify(discoveryV1ViewPlan(view({price,minBudgetRsd})))).toBe(JSON.stringify(before));
  expect(Object.hasOwn(before.filter,'minBudgetRsd')).toBe(false);
 }
});
it.each([0,-1,0.5,2_147_483_648,NaN,Infinity,'5000',true,{}])('malformed minimum refuses rather than widening discovery: %p',minBudgetRsd=>{
 expect(()=>discoveryV1ViewPlan(view({price:'MY_PRICE',minBudgetRsd:minBudgetRsd as number}))).toThrow('DISCOVERY_V1_MIN_BUDGET_INVALID');
});
it('all plus minimum keeps the all mode so the server can include offers and qualifying fixed prices',()=>{
 expect(discoveryV1ViewPlan(view({price:'all',minBudgetRsd:5000})).filter).toMatchObject({price:'all',minBudgetRsd:5000});
});
it('an offers-only wire minimum is invalid rather than silently ignored',()=>{
 expect(()=>discoveryV1ViewPlan(view({price:'OFFERS',minBudgetRsd:5000}))).toThrow('DISCOVERY_V1_MIN_BUDGET_PRICE_MODE');
});
it('remote intent clears locality and geographic query scopes without rewriting remembered view',()=>{
 const original=view({where:'remote',place:'Liman',area:[19,44,21,46],pinPlace:'45.25,19.83',viewport:{center:[20,45],zoom:10,bounds:[19,44,21,46]}});
 const p=discoveryV1ViewPlan(original);expect(p.filter.place).toBeNull();expect(p.pageScope).toEqual({kind:'ALL'});
 expect(p.mapBounds).toBeNull();expect(p.placesFacetArea).toBeNull();expect(original.area).toEqual([19,44,21,46]);
});
it('pinPlace owns POINT_LIST ahead of area and POINT_MEMBERS is separate',()=>{
 expect(discoveryV1ViewPlan(view({area:[19,44,21,46],pinPlace:'45.25,19.83'})).pageScope)
  .toEqual({kind:'POINT_LIST',point:{lat:45.25,lng:19.83}});
 expect(discoveryV1PointMembersScope('45.25,19.83')).toEqual({kind:'POINT_MEMBERS',point:{lat:45.25,lng:19.83}});
});
it.each(['45.2,19.83','45.25,181.00','not-a-point'])('invalid pin refuses instead of widening: %s',key=>
 expect(()=>discoveryV1PointMembersScope(key)).toThrow('DISCOVERY_V1_VIEW_PIN_INVALID'));
it('maps strict task facts without fabricating identity trust or urgency',()=>{
 const result=discoveryV1Opportunity(item());
 expect(result).toMatchObject({id:ID,revision:4,naslov:'Prenos troseda',statusTekst:'Traži ponude',primaNovePrijave:true,
  podrucjeTekst:'Liman, Novi Sad',pokrivenost:{ukupno:2,popunjeno:1,preostalo:1,udeo:.5},narucilacProfilId:PROFILE,
  narucilacIme:'',narucilacOcena:null,narucilacBrojOcena:null,narucilacAvatarId:null,priblizno:{lat:45.25,lng:19.83},
  rezimCene:'MY_PRICE',osnovaCene:'TOTAL',ponudjenaCena:{iznos:5000,valuta:'RSD'}});
 expect(result.urgency).toBeUndefined();expect(result.uslovi).toEqual(['Selidbe','Kaiševi','Kombi']);
 expect(result.detalji?.zahtevi.bitniUslovi).toEqual(['Treći sprat']);
});
it('remote task never inherits a public pin',()=>{
 const result=discoveryV1Opportunity(item({executionLocationMode:'REMOTE',approximateArea:null,approximateCity:null,pin:null,scheduleKind:'REMOTE_ANYTIME'}));
 expect(result.podrucjeTekst).toBe('Na daljinu');expect(result.priblizno).toBeNull();expect(result.detalji?.rezimLokacije).toBe('REMOTE');
});
it('bounded enrichment targets deduplicate only an admitted slice',()=>{
 const second=item({id:'33333333-3333-4333-8333-333333333333'});
 expect(discoveryV1EnrichmentTargets([item(),second],2)).toEqual({needIds:[ID,second.id],profileIds:[PROFILE]});
 expect(()=>discoveryV1EnrichmentTargets([item(),second],1)).toThrow('DISCOVERY_V1_ENRICHMENT_BOUND');
});
it('aggregate MAP buckets do not fabricate task cards',()=>{
 const markers=discoveryV1MapMarkers({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:A,
  anchor:{version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:'2026-09-28T10:30:00.000000Z'},
  coverageBounds:[19,44,21,46],effectiveGrid:8,wholeBounds:[19,44,21,46],
  counts:{kind:'exact_live',observedAt:AT,mapped:8,withoutPoint:0},buckets:[
   {kind:'TASK',key:'t',point:{lat:45.25,lng:19.83},taskId:ID},
   {kind:'PLACE',key:'p',point:{lat:45.26,lng:19.84},taskCount:2},
   {kind:'CLUSTER',key:'c',point:{lat:45.3,lng:19.9},taskCount:5,distinctPointCount:3,memberBounds:[19.8,45.2,20,45.4]}]});
 expect(markers).toEqual(expect.arrayContaining([expect.objectContaining({kind:'TASK',taskId:ID,taskCount:1}),
  expect.objectContaining({kind:'PLACE',taskCount:2}),expect.objectContaining({kind:'CLUSTER',taskCount:5,distinctPointCount:3})]));
 expect(JSON.stringify(markers)).not.toContain('Prenos troseda');
});

it('a view with no viewport or area asks the session to seed its map; a camera, an area or remote intent does not',()=>{
 expect(discoveryV1ViewPlan(view()).mapSeed).toBe(true);expect(discoveryV1ViewPlan(view()).mapBounds).toBeNull();
 expect(discoveryV1ViewPlan(view({viewport:{center:[20,45],zoom:10,bounds:[19,44,21,46]}})).mapSeed).toBe(false);
 expect(discoveryV1ViewPlan(view({area:[19,44,21,46]})).mapSeed).toBe(false);
 expect(discoveryV1ViewPlan(view({where:'remote'})).mapSeed).toBe(false);
});
