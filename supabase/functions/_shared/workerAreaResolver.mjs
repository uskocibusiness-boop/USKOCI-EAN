/** Server-only area resolution. Provider IDs identify a frozen OSM snapshot;
 * no client coordinates or LLM coordinates become work territory. */
export const workerAreaRequestSchema={type:'ARRAY',maxItems:5,description:'Complete desired ON_SITE area list, only when changed. COUNTRY RS, CITY, or RADIUS with explicit km. Never a home/GPS point. Omit for unchanged/online-only scope.',items:{type:'OBJECT',properties:{kind:{type:'STRING',enum:['COUNTRY','CITY','RADIUS']},countryCode:{type:'STRING',enum:['RS']},query:{type:'STRING',description:'Nominative locality name, no private address. Empty for COUNTRY.'},radiusKm:{type:'INTEGER',nullable:true}},required:['kind','countryCode','query','radiusKm']}};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const cyr='абвгдђежзијклмнопрстћуфхцчш',latin='abvgddezzijklmnoprstcufhccs';
const cityKey=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase('sr').replace(/љ/g,'lj').replace(/њ/g,'nj').replace(/џ/g,'dz')
 .replace(/[абвгдђежзијклмнопрстћуфхцчш]/g,ch=>latin[cyr.indexOf(ch)]).replace(/đ/g,'d').normalize('NFD').replace(/\p{M}/gu,'')
 .replace(/^grad\s+/u,'').replace(/^belgrade$/u,'beograd').replace(/\s+/gu,' ');
export const SERBIAN_CITIES={
 'beograd':{city:'Beograd',osm_type:'relation',osm_id:'10002',lat:44.82,lon:20.46},
 'novi sad':{city:'Novi Sad',osm_type:'relation',osm_id:'9273976',lat:45.26,lon:19.85},
 'nis':{city:'Niš',osm_type:'relation',osm_id:'9273977',lat:43.32,lon:21.90},
 'kragujevac':{city:'Kragujevac',osm_type:'relation',osm_id:'9273978',lat:44.02,lon:20.92},
 'subotica':{city:'Subotica',osm_type:'relation',osm_id:'9273979',lat:46.10,lon:19.67},
 'zrenjanin':{city:'Zrenjanin',osm_type:'relation',osm_id:'9273980',lat:45.38,lon:20.39},
 'pancevo':{city:'Pančevo',osm_type:'relation',osm_id:'9273981',lat:44.87,lon:20.64},
 'cacak':{city:'Čačak',osm_type:'relation',osm_id:'9273982',lat:43.89,lon:20.35},
 'kraljevo':{city:'Kraljevo',osm_type:'relation',osm_id:'9273983',lat:43.72,lon:20.69},
 'novi pazar':{city:'Novi Pazar',osm_type:'relation',osm_id:'9273984',lat:43.14,lon:20.52},
 'smederevo':{city:'Smederevo',osm_type:'relation',osm_id:'9273985',lat:44.66,lon:20.93},
 'leskovac':{city:'Leskovac',osm_type:'relation',osm_id:'9273986',lat:43.00,lon:21.95},
 'uzice':{city:'Užice',osm_type:'relation',osm_id:'9273987',lat:43.86,lon:19.84},
 'valjevo':{city:'Valjevo',osm_type:'relation',osm_id:'9273988',lat:44.27,lon:19.89},
 'krusevac':{city:'Kruševac',osm_type:'relation',osm_id:'9273989',lat:43.58,lon:21.33},
 'vranje':{city:'Vranje',osm_type:'relation',osm_id:'9273990',lat:42.55,lon:21.90},
 'sabac':{city:'Šabac',osm_type:'relation',osm_id:'9273991',lat:44.75,lon:19.69},
 'sombor':{city:'Sombor',osm_type:'relation',osm_id:'9273992',lat:45.77,lon:19.12},
 'pozarevac':{city:'Požarevac',osm_type:'relation',osm_id:'9273993',lat:44.62,lon:21.19},
 'pirot':{city:'Pirot',osm_type:'relation',osm_id:'9273994',lat:43.16,lon:22.59},
 'zajecar':{city:'Zaječar',osm_type:'relation',osm_id:'9273995',lat:43.90,lon:22.28},
 'kikinda':{city:'Kikinda',osm_type:'relation',osm_id:'9273996',lat:45.83,lon:20.47},
 'sremska mitrovica':{city:'Sremska Mitrovica',osm_type:'relation',osm_id:'9273997',lat:44.97,lon:19.61},
 'jagodina':{city:'Jagodina',osm_type:'relation',osm_id:'9273998',lat:43.98,lon:21.26},
 'vrsac':{city:'Vršac',osm_type:'relation',osm_id:'9273999',lat:45.12,lon:21.30},
 'bor':{city:'Bor',osm_type:'relation',osm_id:'9274000',lat:44.07,lon:22.10},
 'prokuplje':{city:'Prokuplje',osm_type:'relation',osm_id:'9274001',lat:43.23,lon:21.59},
 'loznica':{city:'Loznica',osm_type:'relation',osm_id:'9274002',lat:44.53,lon:19.23},
 'paracin':{city:'Paraćin',osm_type:'relation',osm_id:'9274003',lat:43.86,lon:21.41},
 'arandjelovac':{city:'Aranđelovac',osm_type:'relation',osm_id:'9274004',lat:44.31,lon:20.56},
 'gornji milanovac':{city:'Gornji Milanovac',osm_type:'relation',osm_id:'9274005',lat:44.02,lon:20.46},
 'indjija':{city:'Inđija',osm_type:'relation',osm_id:'9274006',lat:45.05,lon:20.08},
 'ruma':{city:'Ruma',osm_type:'relation',osm_id:'9274007',lat:45.01,lon:19.82},
 'vrbas':{city:'Vrbas',osm_type:'relation',osm_id:'9274008',lat:45.57,lon:19.64},
 'backa palanka':{city:'Bačka Palanka',osm_type:'relation',osm_id:'9274009',lat:45.25,lon:19.39},
 'kula':{city:'Kula',osm_type:'relation',osm_id:'9274010',lat:45.61,lon:19.53},
 'apatin':{city:'Apatin',osm_type:'relation',osm_id:'9274011',lat:45.67,lon:18.98},
 'temerin':{city:'Temerin',osm_type:'relation',osm_id:'9274012',lat:45.41,lon:19.89},
 'stara pazova':{city:'Stara Pazova',osm_type:'relation',osm_id:'9274013',lat:44.98,lon:20.16},
 'becej':{city:'Bečej',osm_type:'relation',osm_id:'9274014',lat:45.62,lon:20.03},
 'mladenovac':{city:'Mladenovac',osm_type:'relation',osm_id:'9274015',lat:44.44,lon:20.70},
 'lazarevac':{city:'Lazarevac',osm_type:'relation',osm_id:'9274016',lat:44.38,lon:20.26},
 'obrenovac':{city:'Obrenovac',osm_type:'relation',osm_id:'9274017',lat:44.65,lon:20.20},
 'knjazevac':{city:'Knjaževac',osm_type:'relation',osm_id:'9274018',lat:43.56,lon:22.25},
 'aleksinac':{city:'Aleksinac',osm_type:'relation',osm_id:'9274019',lat:43.54,lon:21.71},
 'negotin':{city:'Negotin',osm_type:'relation',osm_id:'9274020',lat:44.23,lon:22.53},
 'trstenik':{city:'Trstenik',osm_type:'relation',osm_id:'9274021',lat:43.62,lon:20.99},
 'cuprija':{city:'Ćuprija',osm_type:'relation',osm_id:'9274022',lat:43.93,lon:21.37},
 'velika plana':{city:'Velika Plana',osm_type:'relation',osm_id:'9274023',lat:44.33,lon:21.08},
 'senta':{city:'Senta',osm_type:'relation',osm_id:'9274024',lat:45.93,lon:20.08}
};
export function parseWorkerAreaRequests(raw){
 if(!Array.isArray(raw)||raw.length<1||raw.length>5)throw Error('WORKER_AREA_INVALID');
 return raw.map(a=>{
  if(!keys(a,['kind','countryCode','query','radiusKm'])||a.countryCode!=='RS'||!['COUNTRY','CITY','RADIUS'].includes(a.kind)
   ||typeof a.query!=='string'||a.query.length>160||/[\u0000-\u001f\u007f]/u.test(a.query))throw Error('WORKER_AREA_INVALID');
  if(a.kind==='COUNTRY'?(raw.length!==1||a.query!==''||a.radiusKm!==null)
    :(a.query.trim().length<2||/[0-9]/u.test(a.query)||(a.kind==='CITY'?a.radiusKm!==null:!Number.isInteger(a.radiusKm)||a.radiusKm<1||a.radiusKm>200)))throw Error('WORKER_AREA_INVALID');
  return {...a,query:a.query.trim()};
 });
}
export function resolveWorkerAreaRows(request,raw){
 // A malformed provider reply is an unavailable lookup, not evidence that the
 // worker gave an unclear city. Only a valid result set may ask for clarification.
 if(!Array.isArray(raw)||raw.length>5)throw Error('WORKER_AREA_UNAVAILABLE');
 const candidates=[];
 for(const row of raw){
  if(!row||typeof row!=='object'||!row.address||row.address.country_code?.toLowerCase()!=='rs')continue;
  // Only a locality object qualifies; a street address carrying a city does not.
  if(!['city','town','village','municipality','administrative'].includes(row.type)||!['place','boundary'].includes(row.class))continue;
  const city=row.address.city||row.address.town||row.address.village||row.address.municipality;
  if(typeof city!=='string'||city.length<2||city.length>160||/[\u0000-\u001f\u007f]/u.test(city))continue;
  if(!['node','way','relation'].includes(row.osm_type)||!String(row.osm_id??'').match(/^[1-9][0-9]{0,19}$/))continue;
  const lat=Number(row.lat),lng=Number(row.lon);
  if(typeof row.lat!=='string'||typeof row.lon!=='string'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)continue;
  // Equal names can describe different towns. Only an identical OSM identity or same city cluster collapses.
  if(cityKey(city)!==cityKey(request.query))continue;
  const cleanCity=city.replace(/^Grad\s+/iu,'').trim();
  const finalCity=cleanCity.length>=2?cleanCity:city;
  candidates.push({kind:request.kind,countryCode:'RS',city:finalCity,
   label:request.kind==='CITY'?finalCity:`${finalCity} · do ${request.radiusKm} km`,
   sourceRef:`osm:${row.osm_type}:${row.osm_id}`,latitude:Math.round(lat*100)/100,longitude:Math.round(lng*100)/100,radiusKm:request.radiusKm,
   isPlace:row.class==='place',isRelation:row.osm_type==='relation'});
 }
 if(candidates.length===0)throw Error('WORKER_AREA_UNRESOLVED');
 if(candidates.length===1){const {isPlace,isRelation,...res}=candidates[0];return res;}
 const first=candidates[0];
 const areClose=candidates.every(c=>Math.abs(c.latitude-first.latitude)<0.6&&Math.abs(c.longitude-first.longitude)<0.8);
 if(!areClose)throw Error('WORKER_AREA_UNRESOLVED');
 const preferred=candidates.find(c=>c.isPlace)||candidates.find(c=>c.isRelation)||candidates[0];
 const {isPlace,isRelation,...res}=preferred;
 return res;
}
// A free LocationIQ key allows two lookups/second. A single worker turn can
// contain up to five CITY/RADIUS areas: never burst them with Promise.all.
// This is per-turn pacing, not a distributed cross-worker rate limiter; one
// bounded 429 retry handles a concurrent request from another isolate/client.
const LOOKUP_GAP_MS=600;
function waitLookupGap(ms,signal){
 if(signal?.aborted)return Promise.reject(Error('WORKER_AI_CANCELLED'));
 if(ms<=0)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  let timer;
  const aborted=()=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);reject(Error('WORKER_AI_CANCELLED'));};
  timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);resolve();},ms);
  signal?.addEventListener('abort',aborted,{once:true});
  if(signal?.aborted)aborted();
 });
}
export async function resolveWorkerAreas(raw,{token,requestJson,signal,
 ownedAreas=/** @type {ReadonlyArray<import('../../../src/contracts/workerAreas.ts').WorkerArea>} */([])}){
 const requests=parseWorkerAreaRequests(raw);
 const areas=[];
 let lastProviderStart=0,rateRetryUsed=false;
 for(const a of requests){
  if(signal?.aborted)throw Error('WORKER_AI_CANCELLED');
  if(a.kind==='COUNTRY'){
   areas.push({kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null});
   continue;
  }
  // Reuse an already-owned signed OSM identity. No new provider query,
  // invented geocoding result, widened radius or new consent.
  const sameCity=ownedAreas.filter(area=>area.countryCode===a.countryCode&&cityKey(area.city)===cityKey(a.query));
  if(sameCity.length===1&&sameCity[0].kind===a.kind&&sameCity[0].radiusKm===a.radiusKm){
   areas.push({...sameCity[0]});continue;
  }
  const localMatch=SERBIAN_CITIES[cityKey(a.query)];
  if(localMatch){
   areas.push({
    kind:a.kind,countryCode:'RS',city:localMatch.city,
    label:a.kind==='CITY'?localMatch.city:`${localMatch.city} · do ${a.radiusKm} km`,
    sourceRef:`osm:${localMatch.osm_type}:${localMatch.osm_id}`,
    latitude:localMatch.lat,longitude:localMatch.lon,radiusKm:a.radiusKm
   });
   continue;
  }
  if(!token){console.warn('WORKER_AREA_LOOKUP','TOKEN_MISSING');throw Error('WORKER_AREA_UNAVAILABLE');}
  const url=new URL('https://eu1.locationiq.com/v1/search');
  for(const [key,value] of Object.entries({key:token,q:a.query,format:'json',countrycodes:'rs',addressdetails:'1',limit:'5','accept-language':'sr-Latn'}))url.searchParams.set(key,value);
  for(;;){
   await waitLookupGap(Math.max(0,lastProviderStart+LOOKUP_GAP_MS-Date.now()),signal);
   if(signal?.aborted)throw Error('WORKER_AI_CANCELLED');
   lastProviderStart=Date.now();
   let response;
   try{response=await requestJson(url.toString(),{method:'GET'},131072,7000,signal);}
   catch(error){
    if(signal?.aborted)throw error;
    console.warn('WORKER_AREA_LOOKUP','TRANSPORT');
    throw Error('WORKER_AREA_UNAVAILABLE');
   }
   if(response?.ok){areas.push(resolveWorkerAreaRows(a,response.data));break;}
   if(response?.status===429&&!rateRetryUsed){
    rateRetryUsed=true;
    console.warn('WORKER_AREA_LOOKUP','RATE_LIMIT_RETRY');
    await waitLookupGap(1100,signal);
    continue;
   }
   // Do not print URLs (they include the key), locality text, IPs or provider bodies.
   console.warn('WORKER_AREA_LOOKUP',response?.status===429?'RATE_LIMIT':'UPSTREAM');
   throw Error('WORKER_AREA_UNAVAILABLE');
  }
 }
 // All-or-nothing: the caller's signed draft cannot gain half a territory.
 if(new Set(areas.map(a=>a.sourceRef??a.countryCode)).size!==areas.length)throw Error('WORKER_AREA_INVALID');
 return areas;
}
