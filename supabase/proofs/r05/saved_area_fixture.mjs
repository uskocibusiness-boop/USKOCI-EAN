// Isolated R05 fixture. Production helper/reader bodies are copied verbatim from
// the pinned bootstrap. Only PostGIS and the final admission/cap boundary are
// synthetic in PGlite; the real PostGIS plan proof must use a disposable server.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

export const sql=readFileSync(new URL('../../candidates/r05_saved_area_retrieval.sql',import.meta.url),'utf8');
export const patch=sql.split('-- PATCH BEGINS:')[1]?.split('-- PATCH ENDS.')[0];
export const indexedSource=sql.split('-- INDEXED SOURCE BEGINS:')[1]?.split('-- INDEXED SOURCE ENDS.')[0];
const bootstrap=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
export function sourceFunction(name){
 const start=bootstrap.indexOf(`CREATE OR REPLACE FUNCTION private.${name}(`);
 assert.ok(start>=0,name);
 const body=bootstrap.indexOf('AS $function$',start);
 const end=bootstrap.indexOf('$function$;',body+'AS $function$'.length);
 assert.ok(end>start,name);
 return bootstrap.slice(start,end+'$function$;'.length);
}
export const radiusIndex=`CREATE INDEX r05_worker_review_radius_centers_idx ON private.worker_ai_reviews
 USING gist (private.worker_area_radius_centers_v1(envelope#>'{profile,workAreas}'));`;
export const uid=n=>'00000000-0005-4005-8005-'+String(n).padStart(12,'0');
export const task=uid(1),near=uid(11),far=uid(12),outside=uid(13),withoutArea=uid(14),nullPin=uid(15);
export const acct=n=>uid(100+n);
export const countryArea=()=>({kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null});
export const cityArea=(city='Novi Sad',latitude=45.25,longitude=19.83,source=123)=>({kind:'CITY',countryCode:'RS',label:city,city,sourceRef:`osm:relation:${source}`,latitude,longitude,radiusKm:null});
export const radiusArea=(radiusKm=10,latitude=45.25,longitude=19.83,source=123)=>({...cityArea('Novi Sad',latitude,longitude,source),kind:'RADIUS',label:`Novi Sad · do ${radiusKm} km`,radiusKm});

export const schemaSql=`
 CREATE SCHEMA private; CREATE SCHEMA extensions;
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.needs(id uuid PRIMARY KEY,execution_location_mode text,approx_geog extensions.geography,task_country_code text,approximate_city text,approximate_lat numeric,approximate_lng numeric);
 CREATE TABLE public.app_profiles(id uuid PRIMARY KEY,account_id uuid,kind text,profile_status text,UNIQUE(account_id,kind));
 CREATE TABLE public.worker_match_preferences(worker_profile_id uuid PRIMARY KEY,worker_account_id uuid,approximate_geog extensions.geography);
 CREATE TABLE private.worker_ai_reviews(id uuid PRIMARY KEY,account_id uuid NOT NULL,envelope jsonb NOT NULL,expires_at timestamptz);
 CREATE TABLE private.worker_ai_saves(review_id uuid PRIMARY KEY REFERENCES private.worker_ai_reviews(id),account_id uuid NOT NULL,created_at timestamptz NOT NULL);
 CREATE TABLE private.blocked_profiles(id uuid PRIMARY KEY);
`;
export const helperSql=['validate_worker_areas_v1','worker_area_city_key_v1','haversine_km','worker_area_fit_v1','worker_saved_areas_v1'].map(sourceFunction).join('\n');
export const readerSql=['candidate_profile_ids','candidate_profile_ids_v1b'].map(sourceFunction).join('\n');
export const boundarySql=`
 CREATE FUNCTION private.dispatch_cheap_candidate_admitted(nid uuid,pid uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT exists(SELECT 1 FROM public.app_profiles p WHERE p.id=pid AND p.profile_status='ACTIVE')
 AND NOT EXISTS(SELECT 1 FROM private.blocked_profiles b WHERE b.id=pid); $f$;
 CREATE FUNCTION private.worker_notify_room_v1b(p_uid uuid,p_cap integer) RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT p_cap>=2 OR p_uid<>'${acct(11)}'::uuid; $f$;
`;

// This is deliberately NOT a PostGIS/index emulator. Legacy points are numeric
// distances, radius centers are JSON points, and only their SQL control flow is
// exercised. The real GiST DDL is omitted here, never claimed as executed.
const syntheticGeo=`
 CREATE DOMAIN extensions.geometry AS jsonb;
 CREATE DOMAIN extensions.geography AS jsonb;
 CREATE FUNCTION extensions.ST_MakePoint(x double precision,y double precision) RETURNS extensions.geometry
 LANGUAGE sql IMMUTABLE AS $f$ SELECT jsonb_build_array(x,y)::extensions.geometry; $f$;
 CREATE FUNCTION extensions.ST_SetSRID(g extensions.geometry,srid integer) RETURNS extensions.geometry
 LANGUAGE sql IMMUTABLE AS $f$ SELECT g; $f$;
 CREATE FUNCTION extensions.ST_Collect(g extensions.geometry[]) RETURNS extensions.geometry
 LANGUAGE sql IMMUTABLE AS $f$ SELECT to_jsonb(g)::extensions.geometry; $f$;
 CREATE FUNCTION extensions.ST_DWithin(a extensions.geography,b extensions.geography,d double precision,spheroid boolean DEFAULT true)
 RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $f$
 DECLARE pt jsonb;
 BEGIN
  IF a IS NULL OR b IS NULL THEN RETURN null; END IF;
  IF jsonb_typeof(a)='number' THEN RETURN abs((a#>>'{}')::numeric-(b#>>'{}')::numeric)<=d; END IF;
  FOR pt IN SELECT value FROM jsonb_array_elements(a) LOOP
   IF private.haversine_km((pt->>1)::numeric,(pt->>0)::numeric,(b->>1)::numeric,(b->>0)::numeric)*1000<=d THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
 END; $f$;
 CREATE FUNCTION extensions.fixture_distance(a extensions.geography,b extensions.geography) RETURNS double precision
 LANGUAGE sql IMMUTABLE AS $f$ SELECT abs((a#>>'{}')::numeric-(b#>>'{}')::numeric)::double precision; $f$;
 CREATE OPERATOR extensions.<-> (LEFTARG=extensions.geography,RIGHTARG=extensions.geography,FUNCTION=extensions.fixture_distance);
`;
export async function applyIndexed(db){
 assert.equal(indexedSource.split(radiusIndex).length,2,'omit exactly one unavailable real GiST index, not any reader/guard');
 await db.exec(indexedSource.replace(radiusIndex,'-- Real PostGIS GiST proof is separate.'));
 await db.exec(patch);
}
export async function saveAreas(db,account,areas,{review=uid(100000+Number(account.slice(-6))),at='2026-11-01T12:00:00Z',saved=true,reviewOwner=account}={}){
 await db.query('INSERT INTO private.worker_ai_reviews VALUES($1,$2,$3::jsonb,$4::timestamptz)',[review,reviewOwner,JSON.stringify({profile:{workAreas:areas}}),'2026-10-01T00:00:00Z']);
 if(saved) await db.query('INSERT INTO private.worker_ai_saves VALUES($1,$2,$3::timestamptz)',[review,account,at]);
 return review;
}
export async function makeDb({seed=true}={}){
 const db=new PGlite();
 await db.exec('CREATE SCHEMA private; CREATE SCHEMA extensions;');
 await db.exec(syntheticGeo);
 await db.exec(schemaSql.replace('CREATE SCHEMA private; CREATE SCHEMA extensions;',''));
 await db.exec(helperSql+boundarySql+readerSql);
 await db.query("INSERT INTO public.needs VALUES($1,'STATIONARY','0'::jsonb,'RS','Novi Sad',45.25,19.83)",[task]);
 if(seed){
  for(const [id,point] of [[near,10000],[far,600000],[outside,700000],[withoutArea,850000]]){
   const account=acct(Number(id.slice(-2)));
   await db.query("INSERT INTO public.app_profiles VALUES ($1,$2,'WORKER','ACTIVE')",[id,account]);
   await db.query('INSERT INTO public.worker_match_preferences VALUES($1,$2,$3::jsonb)',[id,account,String(point)]);
  }
  await saveAreas(db,acct(12),[countryArea()]);
  await saveAreas(db,acct(13),[cityArea('Niš',43.32,21.90)]);
 }
 return db;
}
export async function list(db,capped=false,limit=5,cap=null){
 const q=capped?'SELECT worker_profile_id FROM private.candidate_profile_ids_v1b($1::uuid,$2::integer,$3::integer)'
  :'SELECT worker_profile_id FROM private.candidate_profile_ids($1::uuid,$2::integer)';
 return (await db.query(q,capped?[task,limit,cap]:[task,limit])).rows.map(v=>v.worker_profile_id);
}
