import { decodeDiscoveryV1Exact, decodeDiscoveryV1Page } from '../discoveryV1Contract';

const ID='11111111-1111-4111-8111-111111111111', PROFILE='22222222-2222-4222-8222-222222222222';
const AT='2026-09-28T10:00:00.000000Z', EXPIRES='2026-09-28T10:30:00.000000Z';
const item=():any=>({id:ID,revision:3,sortAt:AT,publishedAt:AT,title:'Prenos ormara',category:'selidbe',status:'PUBLISHED',urgent:false,
  scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
  verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
  requiredSlots:2,coveredSlots:0,requiredSkills:['Selidbe'],requiredTools:[],requiredVehicles:[],requiredLicenses:[],
  minimumExperienceYears:null,priceMode:'MY_PRICE',requesterPriceRsd:4000,priceBasis:'TOTAL',requesterProfileId:PROFILE,
  responseDeadline:null,acceptsApplications:true,publicTopology:{mode:'STATIONARY',start:{city:'Novi Sad',area:'Liman'}},
  criticalConditions:['Treći sprat']});
const page=():any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:'a'.repeat(32),
  anchor:{version:'DISCOVERY_V1',filterKey:'a'.repeat(32),timeAt:AT,publishedThrough:AT,expiresAt:EXPIRES},
  items:[item()],hasMore:true,nextCursor:{scopeKey:'b'.repeat(32),section:0,sortAt:AT,id:ID},
  counts:{kind:'exact_live',observedAt:AT,mapped:1,listed:1,inArea:1,withoutPoint:0,undated:0},
  availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['MY_PRICE','OFFERS']}});
const exact=():any=>({version:'DISCOVERY_V1',mode:'EXACT_PUBLIC',asOf:AT,items:[item()],hasMore:false,nextCursor:null});

it('accepts the exact PAGE allowlist without turning counts into loaded length',()=>{
  const value=decodeDiscoveryV1Page(page(),50);
  expect(value.items).toHaveLength(1);expect(value.counts).toMatchObject({mapped:1,listed:1,kind:'exact_live'});
  expect(value.nextCursor?.id).toBe(ID);
});
it('accepts zero-row PAGE and keeps an exact zero only when the server actually sent it',()=>{
  const value=page();value.items=[];value.hasMore=false;value.nextCursor=null;
  value.counts={kind:'exact_live',observedAt:AT,mapped:0,listed:0,inArea:0,withoutPoint:0,undated:0};
  expect(decodeDiscoveryV1Page(value,50).counts.listed).toBe(0);
});
it('accepts exact present/missing reads and binds a present row to the requested id',()=>{
  expect(decodeDiscoveryV1Exact(exact(),ID).items[0].id).toBe(ID);
  const missing=exact();missing.items=[];expect(decodeDiscoveryV1Exact(missing,ID).items).toEqual([]);
});
it.each(['requesterAccountId','description','exactAddress','resolvedLocation','serviceRoleSecret'])('rejects extra/private item field %s',key=>{
  const value=page();(value.items[0] as any)[key]='private';expect(()=>decodeDiscoveryV1Page(value)).toThrow('DISCOVERY_V1_ITEM_SHAPE');
});
it('rejects PAGE fields on EXACT and EXACT shape on PAGE',()=>{
  expect(()=>decodeDiscoveryV1Exact({...exact(),counts:page().counts})).toThrow();
  const value:any=page();delete value.counts;expect(()=>decodeDiscoveryV1Page(value)).toThrow();
});
it('rejects fabricated or contradictory paging/count state',()=>{
  const cursor=page();cursor.hasMore=false;expect(()=>decodeDiscoveryV1Page(cursor)).toThrow('DISCOVERY_V1_CURSOR_PRESENCE');
  const count=page();count.counts={...count.counts,listed:0,inArea:0,withoutPoint:0};expect(()=>decodeDiscoveryV1Page(count)).toThrow('DISCOVERY_V1_COUNT_UNDERFLOW');
});
it('rejects malformed authority-sensitive item facts instead of defaulting them',()=>{
  for(const patch of [
    {requiredSlots:0},{coveredSlots:3},{priceMode:'OFFERS',requesterPriceRsd:4000},{executionLocationMode:'REMOTE'},
    {acceptsApplications:false},{taskCountryCode:'Serbia'},{taskTimezone:'Not/AZone'},{pin:{lat:45.251,lng:19.83,precision:'COARSE_1KM'}},
  ]){
    const value=page();Object.assign(value.items[0],patch);
    expect(()=>decodeDiscoveryV1Page(value)).toThrow();
  }
});
it('rejects malformed anchor/cursor IDs and timing rather than restarting silently',()=>{
  const badAnchor=page();badAnchor.anchor.expiresAt='2026-09-28T11:00:00.000000Z';expect(()=>decodeDiscoveryV1Page(badAnchor)).toThrow('DISCOVERY_V1_ANCHOR_WINDOW');
  const badCursor=page();badCursor.nextCursor!.id='bad';expect(()=>decodeDiscoveryV1Page(badCursor)).toThrow('DISCOVERY_V1_CURSOR_ID');
});
it('rejects a public topology that disagrees with the task location mode',()=>{
  const value=page();value.items[0].publicTopology={mode:'REMOTE'};expect(()=>decodeDiscoveryV1Page(value)).toThrow('DISCOVERY_V1_ITEM_TOPOLOGY');
});

it('keeps a mixed total/hourly PAGE intact and preserves the hourly per-person amount in EXACT_PUBLIC', () => {
  const value = page();
  value.items = [item(), { ...item(), id: PROFILE, priceBasis: 'HOURLY', requesterPriceRsd: 1200 }];
  value.hasMore = false; value.nextCursor = null;
  value.counts = { ...value.counts, mapped: 2, listed: 2, inArea: 2 };
  expect(decodeDiscoveryV1Page(value).items.map(row => [row.priceBasis, row.requesterPriceRsd])).toEqual([['TOTAL', 4000], ['HOURLY', 1200]]);
  expect(decodeDiscoveryV1Exact({ ...exact(), items: [value.items[1]] }, PROFILE).items[0]).toMatchObject({ priceBasis: 'HOURLY', requesterPriceRsd: 1200 });
});
