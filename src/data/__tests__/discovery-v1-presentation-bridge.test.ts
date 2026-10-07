import { discoveryV1PresentationBridgeModel } from '../discoveryV1PresentationBridge';
import type { DiscoveryV1ScreenSnapshot } from '../discoveryV1ScreenSession';
import type { DiscoveryV1OverlaySnapshot } from '../discoveryV1OverlayOwner';
import { taskRelationIndex } from '../taskRelation';
import { initialMarketplaceView } from '../marketplaceView';

const ID='11111111-1111-4111-8111-111111111111',PROFILE='22222222-2222-4222-8222-222222222222',AT='2026-09-28T10:00:00.000000Z';
const wire:any={id:ID,revision:1,sortAt:AT,publishedAt:AT,title:'Selidba',category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null};
const task:any={id:ID,revision:1,naslov:'Selidba',statusTekst:'Traži ponude',taskTimezone:'Europe/Belgrade',vremeTekst:'Po dogovoru',
 lokacijaTekst:'Liman, Novi Sad',lokacija:{city:'Novi Sad',area:'Liman',lat:45.25,lng:19.83},uslovi:[],narucilacProfilId:PROFILE,
 narucilacAvatarId:null,narucilacIme:'',narucilacOcena:null,narucilacBrojOcena:null,rezimCene:'OFFERS',osnovaCene:null,
 ponudjenaCena:undefined,pokrivenost:{potrebno:1,pokriveno:0,preostalo:1},primaNovePrijave:true,rokZaPrijaveIso:null};
const view={...initialMarketplaceView(),mode:'map' as const,viewport:{center:[19.83,45.25] as [number,number],zoom:10,
 bounds:[19.7,45.1,20,45.4] as [number,number,number,number]}};
const screen=(peek:any=null):DiscoveryV1ScreenSnapshot=>({active:true,view,wireItems:[wire],items:[task],
 mapMarkers:[{kind:'TASK',key:'task:'+ID,point:{lat:45.25,lng:19.83},taskId:ID,taskCount:1}],mapWholeBounds:[19.7,45.1,20,45.4],
 places:[],peek,counts:{kind:'exact_live',observedAt:AT,mapped:1000,listed:840,inArea:700,withoutPoint:140,undated:12},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']},mapCounts:{kind:'exact_live',observedAt:AT,mapped:1000,withoutPoint:140},
 placeCounts:null,pageHasMore:true,memberHasMore:false,placeHasMore:false});
const overlay=(loading=false):DiscoveryV1OverlaySnapshot=>({active:true,generation:2,sliceKey:[ID,1,PROFILE,'0'].join(':'),loading,
 admitted:new Map([[ID,[1,PROFILE,'0'].join(':')]]),
 relations:taskRelationIndex([{needId:ID,relation:'APPLIED',applicationId:'33333333-3333-4333-8333-333333333333',applicationState:'SUBMITTED',agreementId:null}],[ID]),
 profiles:new Map([[PROFILE,{profilId:PROFILE,uloga:'narucilac',ime:'Ana',avatarPutanja:null,grad:'Novi Sad',naslov:null,biografija:null,
  poverenje:{ocenaProsek:4.9,brojRecenzija:7,zavrseniBroj:5,identitetVerifikovan:false,ocenaDostupna:true,recenzijeDostupne:true,verifikacijaIdentitetaDostupna:false}}]]),
 urgency:new Map(),missingProfiles:new Set(),errors:{relations:false,profiles:false,urgencies:false}});
const actions={onSelectMarker:jest.fn(),onArea:jest.fn(),onClearPeek:jest.fn(),onShowPlace:jest.fn(),onShowAll:jest.fn(),onNextPage:jest.fn()};

it('bridges strict page and bounded overlays into the real presentation seam without replacing exact counts',()=>{
 const model=discoveryV1PresentationBridgeModel(screen({kind:'TASK',item:task}),overlay(), 'task:'+ID,false,actions);
 expect(model.items).toHaveLength(1);expect(model.items[0]).toMatchObject({id:ID,narucilacIme:'Ana',narucilacOcena:'4,9'});
 expect(model.relations?.relation(ID).kind).toBe('APPLIED');
 expect(model.p6Seam.counts).toMatchObject({listed:840,withoutPoint:140});
 expect(model.p6Seam.map).toMatchObject({selectedKey:'task:'+ID,markers:[expect.objectContaining({kind:'TASK',taskId:ID})]});
 expect(model.p6Seam.peek).toMatchObject({key:'task:'+ID,item:{id:ID},place:[]});
 expect(model.p6Seam.pageHasMore).toBe(true);
});

it('PLACE peek stays a bounded place preview and never becomes a fabricated map task',()=>{
 const placeTask={...task,id:'44444444-4444-4444-8444-444444444444'};
 const model=discoveryV1PresentationBridgeModel(screen({kind:'PLACE',point:{lat:45.26,lng:19.84},items:[task,placeTask]}),overlay(),null,false,actions);
 expect(model.p6Seam.peek).toMatchObject({key:'place:45.26:19.84',item:null,place:[{id:ID},{id:placeTask.id}]});
 expect((model.p6Seam.map.markers[0] as any).naslov).toBeUndefined();
});

it('loading or failed optional metadata never removes the server PAGE row',()=>{
 const pending=overlay(true);pending.relations=null;pending.profiles=new Map();
 const model=discoveryV1PresentationBridgeModel(screen(),pending,null,true,actions);
 expect(model.items).toHaveLength(1);expect(model.items[0].id).toBe(ID);
 expect(model.relationsPending).toBe(true);expect(model.p6Seam.loadingMore).toBe(true);
});

it('refuses an inactive screen snapshot instead of showing stale account data',()=>{
 const stale={...screen(),active:false,view:null};
 expect(()=>discoveryV1PresentationBridgeModel(stale,overlay(),null,false,actions)).toThrow('DISCOVERY_V1_PRESENTATION_INACTIVE');
});

it('carries the viewport-settled action to the map seam only when the screen supplies it',()=>{
 const onViewportSettled=jest.fn();
 const without=discoveryV1PresentationBridgeModel(screen(),overlay(),null,false,actions);
 expect(without.p6Seam.map).not.toHaveProperty('onViewportSettled');
 const withIt=discoveryV1PresentationBridgeModel(screen(),overlay(),null,false,{...actions,onViewportSettled});
 expect(withIt.p6Seam.map.onViewportSettled).toBe(onViewportSettled);
});

// Audit fix 6: the quick chips are offered from the server's whole-filter availability, which the bridge hands to the presentation.
it('hands the server availability and the visible-rows action to the presentation seam',()=>{
 const onVisibleRange=jest.fn();
 const model=discoveryV1PresentationBridgeModel(screen(),overlay(),null,false,{...actions,onVisibleRange});
 expect(model.p6Seam.availability).toEqual({hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']});
 expect(model.p6Seam.onVisibleRange).toBe(onVisibleRange);
 expect(discoveryV1PresentationBridgeModel(screen(),overlay(),null,false,actions).p6Seam).not.toHaveProperty('onVisibleRange');
});
// Audit fix 5: a row with its details is the same object across commits while nothing it shows changed, so the list's memoised rows are not redone.
it('the same row with the same details is the same object across commits; a changed profile makes a new one',()=>{
 // Each commit takes a fresh overlay snapshot: new maps, the same profile and urgency objects.
 const once=overlay(),first=discoveryV1PresentationBridgeModel(screen(),once,null,false,actions);
 const second=discoveryV1PresentationBridgeModel(screen(),{...once,profiles:new Map(once.profiles),urgency:new Map(once.urgency)},null,false,actions);
 expect(second.items[0]).toBe(first.items[0]);
 const other=overlay();other.profiles=new Map([[PROFILE,{...other.profiles.get(PROFILE)!,ime:'Ana M.'}]]);
 const third=discoveryV1PresentationBridgeModel(screen(),other,null,false,actions);
 expect(third.items[0]).not.toBe(first.items[0]);expect(third.items[0]).toMatchObject({narucilacIme:'Ana M.'});
});
