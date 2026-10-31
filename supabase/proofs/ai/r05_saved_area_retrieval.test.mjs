// R05: execute exact LOCAL_ONLY patch against a synthetic PostgreSQL area model.
// Distance is a numeric domain (not real PostGIS), so this is retrieval control-flow
// proof, not production geography/index performance, HTTP, or DEV acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../../candidates/r05_saved_area_retrieval.sql',import.meta.url),'utf8');
const patch=sql.split('-- PATCH BEGINS:')[1]?.split('-- PATCH ENDS.')[0];
const uid=n=>'00000000-0005-4005-8005-'+String(n).padStart(12,'0');
const task=uid(1),near=uid(11),far=uid(12),outside=uid(13),withoutArea=uid(14),nullPin=uid(15);
const acct=n=>uid(100+n);
function baseline(capped){
 const n=capped?'candidate_profile_ids_v1b':'candidate_profile_ids';
 const cap=capped?',p_cap integer':'';
 const room=capped?'private.worker_notify_room_v1b(c.uid,p_cap) and ':'';
 const uidSelect=capped?',pref.worker_account_id as uid':'';
 const uidFallback=capped?',p.account_id as uid':'';
 const prefix=capped?'if p_cap is null then return query select * from private.candidate_profile_ids(nid,p_limit);return;end if;':'';
 return [
 'CREATE FUNCTION private.'+n+'(nid uuid,p_limit integer'+cap+') RETURNS TABLE(worker_profile_id uuid)',
 "LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $f$",
 'declare n public.needs; admitted integer:=0; c record; task_geog extensions.geography;',
 'begin',
 prefix,
 'select * into n from public.needs where id=nid;',
 'if not found or p_limit is null or p_limit<1 then return;end if;',
 "if n.execution_location_mode IN ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') and n.approx_geog is not null then",
 'task_geog:=n.approx_geog;',
 'for c in select pref.worker_profile_id as pid'+uidSelect+' from public.worker_match_preferences pref',
 'where pref.approximate_geog is not null and extensions.ST_DWithin(pref.approximate_geog,task_geog,300000.0)',
 'order by pref.worker_profile_id loop',
 'if '+room+'private.dispatch_cheap_candidate_admitted(n.id,c.pid) then',
 'worker_profile_id:=c.pid;return next;admitted:=admitted+1;exit when admitted>=p_limit;end if;',
 'end loop;',
 '    if admitted < p_limit then',
 '      for c in',
 '        select p.id as pid'+uidFallback,
 '        from public.app_profiles p left join public.worker_match_preferences pref on pref.worker_profile_id=p.id',
 "        where p.kind='WORKER' and p.profile_status='ACTIVE'",
 '        and (pref.worker_profile_id is null or pref.approximate_geog is null) order by p.id',
 '      loop',
 '       if '+room+'private.dispatch_cheap_candidate_admitted(n.id,c.pid) then',
 '        worker_profile_id:=c.pid;return next;admitted:=admitted+1;exit when admitted>=p_limit;end if;',
 '      end loop;',
 '    end if;',
 'return;',
 'end if;',
 'for c in select p.id as pid'+uidFallback+" from public.app_profiles p where p.kind='WORKER' and p.profile_status='ACTIVE' order by p.id loop",
 ' if '+room+'private.dispatch_cheap_candidate_admitted(n.id,c.pid) then',
 ' worker_profile_id:=c.pid;return next;admitted:=admitted+1;exit when admitted>=p_limit;end if;',
 'end loop;',
 'end; $f$;'
 ].join('\n');
}
async function makeDb(){
 const db=new PGlite();
 await db.exec([
 'CREATE SCHEMA private;CREATE SCHEMA extensions;',
 'CREATE DOMAIN extensions.geography AS numeric;',
 "CREATE FUNCTION extensions.ST_DWithin(a extensions.geography,b extensions.geography,d double precision) RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$ SELECT abs(a::numeric-b::numeric)<=d; $f$;",
 'CREATE TABLE public.needs(id uuid PRIMARY KEY,execution_location_mode text,approx_geog extensions.geography,task_country_code text,approximate_city text,approximate_lat numeric,approximate_lng numeric);',
 'CREATE TABLE public.app_profiles(id uuid PRIMARY KEY,account_id uuid,kind text,profile_status text);',
 'CREATE TABLE public.worker_match_preferences(worker_profile_id uuid,worker_account_id uuid,approximate_geog extensions.geography);',
 'CREATE TABLE private.saved_areas(owner uuid PRIMARY KEY,areas jsonb);',
 "CREATE FUNCTION private.worker_saved_areas_v1(aid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$ SELECT coalesce((SELECT areas FROM private.saved_areas WHERE owner=aid),'[]'::jsonb); $f$;",
 'CREATE FUNCTION private.worker_area_fit_v1(areas jsonb,mode text,country text,city text,lat numeric,lng numeric) RETURNS boolean LANGUAGE sql STABLE AS $f$ SELECT coalesce(areas ? country,false); $f$;',
 "CREATE FUNCTION private.dispatch_cheap_candidate_admitted(nid uuid,pid uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$ SELECT exists(SELECT 1 FROM public.app_profiles p WHERE p.id=pid AND p.profile_status='ACTIVE'); $f$;",
 "CREATE FUNCTION private.worker_notify_room_v1b(p_uid uuid,p_cap integer) RETURNS boolean LANGUAGE sql STABLE AS $f$ SELECT p_cap>=2 OR p_uid<> '"+acct(11)+"'::uuid; $f$;",
 baseline(false),baseline(true)
 ].join('\n'));
 await db.query("INSERT INTO public.needs VALUES($1,'STATIONARY',0::numeric,'RS','Novi Sad',45.25,19.83)",[task]);
 for(const [id,point] of [[near,10000],[far,600000],[outside,700000],[withoutArea,850000]]){
  const account=acct(Number(id.slice(-2)));
  await db.query("INSERT INTO public.app_profiles VALUES ($1,$2,'WORKER','ACTIVE')",[id,account]);
  await db.query('INSERT INTO public.worker_match_preferences VALUES($1,$2,$3::numeric)',[id,account,point]);
 }
 await db.query("INSERT INTO private.saved_areas VALUES($1,'[\"RS\"]'),($2,'[\"ME\"]')",[acct(12),acct(13)]);
 return db;
}
async function list(db,capped,limit,cap){
 const q=capped?'SELECT worker_profile_id FROM private.candidate_profile_ids_v1b($1::uuid,$2::integer,$3::integer)'
  :'SELECT worker_profile_id FROM private.candidate_profile_ids($1::uuid,$2::integer)';
 const r=await db.query(q,capped?[task,limit,cap]:[task,limit]);
 return r.rows.map(v=>v.worker_profile_id);
}
test('exact source pins both readers and does not claim PostGIS/DEV admission',()=>{
 assert.match(sql,/R05_SAVED_AREA_LOCAL_ONLY/);
 assert.match(sql,/665d3bcba58ea4a930a5ac5801383a84/);
 assert.match(sql,/60b8eae4b4efa8a6b05b81c6c08b0021/);
 for(const sha of ['4b9e8a4114dc962f58aa5488b2ee9675','89bb9de67e0cae401b0447636a9e0939',
   '3a29aaf12ec94c4a83743944a973dc09','591a2c4ca91722217a098e05f2bbb9ab'])
   assert.ok(sql.includes(sha),'each live helper must be source-pinned before a future SQL release');
 assert.match(sql,/private\.worker_area_fit_v1/);
 assert.match(sql,/private\.worker_notify_room_v1b/);
 assert.ok(patch?.includes('R05_SAVED_AREA_300KM_RESCUE'));
});
test('actual injected SQL includes far signed-area candidate after nearby candidates',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 assert.deepEqual(await list(db,false,5),[near]);
 await db.exec(patch);
 assert.deepEqual(await list(db,false,2),[near,far]);
 assert.deepEqual(await list(db,false,1),[near]);
 assert.deepEqual(await list(db,false,5),[near,far]);
});
test('capped retrieval preserves suppression and NULL cap delegates to original flow',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 await db.exec(patch);
 assert.deepEqual(await list(db,true,2,null),[near,far]);
 assert.deepEqual(await list(db,true,1,1),[far]);
 assert.deepEqual(await list(db,true,2,2),[near,far]);
});
test('far invalid area and DRAFT worker cannot slip into the rescue',async t=>{
 const db=await makeDb();t.after(()=>db.close());await db.exec(patch);
 await db.query("UPDATE private.saved_areas SET areas='[\"ME\"]'::jsonb WHERE owner=$1",[acct(12)]);
 assert.deepEqual(await list(db,false,4),[near]);
 await db.query("UPDATE private.saved_areas SET areas='[\"RS\"]'::jsonb WHERE owner=$1",[acct(12)]);
 await db.query("UPDATE public.app_profiles SET profile_status='DRAFT' WHERE id=$1",[far]);
 assert.deepEqual(await list(db,true,4,2),[near]);
});
test('no-GPS preference is still handled by the existing fallback without inventing a pin',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 await db.query("INSERT INTO public.app_profiles VALUES($1,$2,'WORKER','ACTIVE')",[nullPin,acct(15)]);
 await db.exec(patch);
 assert.deepEqual(await list(db,false,3),[near,far,nullPin]);
});
