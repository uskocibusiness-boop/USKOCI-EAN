import { decodeDiscoveryV1Page, type DiscoveryV1Availability } from './discoveryV1Contract';
import { decodeDiscoveryV1Places, type DiscoveryV1PlaceRow } from './discoveryV1SpatialContract';
import { discoveryV1ViewPlan } from './discoveryV1MarketplaceAdapter';
import { placeKey, publicBounds, type MarketplaceView, type PublicBounds } from './marketplaceView';
import type { DiscoveryV1OwnerTransport, DiscoveryV1PageRequest, DiscoveryV1PlacesRequest } from './discoveryV1Owner';

export type DiscoveryV1SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DiscoveryV1SearchSnapshot = {
  active: boolean;
  generation: number;
  key: string | null;
  status: DiscoveryV1SearchStatus;
  count: number | null;
  undated: number | null;
  availability: DiscoveryV1Availability | null;
  places: DiscoveryV1PlaceRow[];
  placeHasMore: boolean;
  placePaging: boolean;
  everywhere: number | null;
  inMapArea: number | null;
  facetError: boolean;
};
type PlacesBase = {
  filter: DiscoveryV1PlacesRequest['filter'];
  prefix: string;
  facetArea: PublicBounds | null;
  limit: number;
};

/**
 * A draft asked about by the search panel. `placeSearch` is the letters typed in "Gde" to find a place: they narrow the
 * places the server lists (its PLACES prefix) and nothing else, so they never reach the tasks' own text filter. A caller
 * that does not say them (they are absent, not empty) gets what it always got: the filter's `query` is the prefix.
 */
export type SearchPreviewView=MarketplaceView&{placeSearch?:string};
const placePrefix=(view:SearchPreviewView)=>placeKey(typeof view.placeSearch==='string'?view.placeSearch:view.query);

const cloneBounds=(value:PublicBounds|null)=>value ? [...value] as PublicBounds : null;
const cloneView=(view:SearchPreviewView):SearchPreviewView=>({...view,area:cloneBounds(view.area),
  dates:view.dates?{...view.dates}:null,viewport:view.viewport?{...view.viewport,center:[...view.viewport.center] as [number,number],
    bounds:[...view.viewport.bounds] as PublicBounds}:null});

export function discoveryV1SearchPreviewKey(view:SearchPreviewView,mapArea:PublicBounds|null):string{
  const plan=discoveryV1ViewPlan(view);
  return JSON.stringify([plan.filter,plan.pageScope,mapArea?publicBounds(mapArea):null,placePrefix(view)]);
}

/** How long a read preview answers the same draft again. */
export const SEARCH_PREVIEW_FRESH_MS=20_000;

export function createDiscoveryV1SearchOwner(transport:DiscoveryV1OwnerTransport,isCurrent:()=>boolean=()=>true){
  let active=true,generation=0,controller:AbortController|null=null,placesController:AbortController|null=null;
  let state:DiscoveryV1SearchSnapshot={active:true,generation:0,key:null,status:'idle',count:null,undated:null,availability:null,
    places:[],placeHasMore:false,placePaging:false,everywhere:null,inMapArea:null,facetError:false};
  let placesBase:PlacesBase|null=null,placesAnchor:any=null,placesCursor:any=null,readyAt=0;

  const snapshot=():DiscoveryV1SearchSnapshot=>({...state,places:state.places.map(row=>({...row}))});
  const current=(g:number)=>active&&generation===g&&isCurrent();
  const failState=(g:number,key:string):DiscoveryV1SearchSnapshot=>{
    state={active:true,generation:g,key,status:'error',count:null,undated:null,availability:null,places:[],placeHasMore:false,
      placePaging:false,everywhere:null,inMapArea:null,facetError:true};
    return snapshot();
  };

  async function preview(next:SearchPreviewView,mapArea:PublicBounds|null,limit=10){
    if(!active) return {kind:'stale' as const,snapshot:snapshot()};
    if(!Number.isSafeInteger(limit)||limit<1||limit>30) throw new Error('DISCOVERY_V1_SEARCH_PLACE_LIMIT');
    const view=cloneView(next),area=mapArea?publicBounds(mapArea):null;
    if(mapArea&&!area) throw new Error('DISCOVERY_V1_SEARCH_MAP_AREA');
    const askedKey=discoveryV1SearchPreviewKey(view,area);
    // The same draft asked again while it is being read, or within a short while of being read, is answered by what is there. A failed
    // preview is asked again, and a changed draft always reads.
    if(state.key===askedKey&&(state.status==='loading'||(state.status==='ready'&&Date.now()-readyAt<SEARCH_PREVIEW_FRESH_MS)))
      return {kind:'noop' as const,snapshot:snapshot()};
    controller?.abort();placesController?.abort();
    const own=new AbortController();controller=own;placesController=null;const g=++generation,key=askedKey;
    placesBase=null;placesAnchor=null;placesCursor=null;
    state={active:true,generation:g,key,status:'loading',count:null,undated:null,availability:null,places:[],placeHasMore:false,
      placePaging:false,everywhere:null,inMapArea:null,facetError:false};

    const plan=discoveryV1ViewPlan(view);
    const pageRequest:DiscoveryV1PageRequest={mode:'PAGE',filter:plan.filter,anchor:null,scope:plan.pageScope,limit:1,after:null};
    const pageTask=transport(pageRequest,own.signal);

    const remote=(view.where??'any')==='remote';
    const facetView:MarketplaceView={...view,query:'',place:null,area:null,pinPlace:null};
    const facetPlan=discoveryV1ViewPlan(facetView);
    const base:PlacesBase={filter:facetPlan.filter,prefix:placePrefix(view),facetArea:area,limit};
    const placeRequest:DiscoveryV1PlacesRequest={mode:'PLACES',filter:base.filter,anchor:null,prefix:base.prefix,
      facetArea:base.facetArea?cloneBounds(base.facetArea):null,limit,after:null};
    const placeTask=remote ? Promise.resolve<unknown>(null) : transport(placeRequest,own.signal).catch(()=>null);

    let pageRaw:unknown,placeRaw:unknown;
    try {[pageRaw,placeRaw]=await Promise.all([pageTask,placeTask]);}
    catch(error){if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};failState(g,key);throw error;}
    if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};

    let page;
    try{page=decodeDiscoveryV1Page(pageRaw,1);}
    catch(error){failState(g,key);throw error;}

    let places:DiscoveryV1PlaceRow[]=[],placeHasMore=false,everywhere:number|null=null,inMapArea:number|null=null,facetError=false;
    if(!remote){
      if(placeRaw===null){facetError=true;}
      else {
        try{
          const decoded=decodeDiscoveryV1Places(placeRaw,limit);
          places=decoded.items.map(row=>({...row}));placeHasMore=decoded.hasMore;everywhere=decoded.counts.everywhere;
          inMapArea=decoded.counts.inArea;placesAnchor=decoded.anchor;placesCursor=decoded.nextCursor;placesBase=base;
        }catch{facetError=true;}
      }
    }

    state={active:true,generation:g,key,status:'ready',count:page.counts.listed,undated:page.counts.undated,
      availability:page.availability,places,placeHasMore,placePaging:false,everywhere,inMapArea,facetError};
    readyAt=Date.now();
    if(controller===own)controller=null;own.abort();
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  async function nextPlaces(){
    const g=generation,key=state.key,base=placesBase,cursor=placesCursor,anchor=placesAnchor;
    if(!active||state.status!=='ready'||!key||!base||!state.placeHasMore||!cursor||!anchor)
      return {kind:'noop' as const,snapshot:snapshot()};
    placesController?.abort();const own=new AbortController();placesController=own;
    state={...state,placePaging:true};
    const request:DiscoveryV1PlacesRequest={mode:'PLACES',filter:base.filter,anchor:{...anchor},prefix:base.prefix,
      facetArea:base.facetArea?cloneBounds(base.facetArea):null,limit:base.limit,after:{...cursor}};
    let raw:unknown;
    try{raw=await transport(request,own.signal);}
    catch(error){if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};state={...state,placePaging:false,facetError:true};throw error;}
    if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};
    const decoded=decodeDiscoveryV1Places(raw,base.limit);
    const seen=new Set(state.places.map(row=>row.key)),items=[...state.places];
    for(const row of decoded.items)if(!seen.has(row.key)){seen.add(row.key);items.push({...row});}
    state={...state,places:items,placeHasMore:decoded.hasMore,placePaging:false,everywhere:decoded.counts.everywhere,
      inMapArea:decoded.counts.inArea,facetError:false};
    placesAnchor=decoded.anchor;placesCursor=decoded.nextCursor;
    if(placesController===own)placesController=null;own.abort();
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  /** The screen has left and may come back: a preview belongs to one visit of the search panel, so what it read and what it is reading are dropped (the owner stays usable). */
  const suspend=()=>{if(!active)return;generation++;controller?.abort();placesController?.abort();controller=placesController=null;
    placesBase=null;placesAnchor=null;placesCursor=null;readyAt=0;state={active:true,generation,key:null,status:'idle',count:null,undated:null,
      availability:null,places:[],placeHasMore:false,placePaging:false,everywhere:null,inMapArea:null,facetError:false};};

  const retire=()=>{if(!active)return;active=false;generation++;controller?.abort();placesController?.abort();controller=placesController=null;
    placesBase=null;placesAnchor=null;placesCursor=null;state={active:false,generation,key:null,status:'idle',count:null,undated:null,
      availability:null,places:[],placeHasMore:false,placePaging:false,everywhere:null,inMapArea:null,facetError:false};};

  return {preview,nextPlaces,snapshot,suspend,retire};
}
