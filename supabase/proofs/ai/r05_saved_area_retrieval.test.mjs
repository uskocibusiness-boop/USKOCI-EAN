import test from 'node:test';
import assert from 'node:assert/strict';
import {sql,patch,indexedSource,uid,task,near,far,nullPin,acct,countryArea,cityArea,radiusArea,saveAreas,makeDb,applyIndexed,list} from '../r05/saved_area_fixture.mjs';

test('pins exact readers, area semantics and LOCAL_ONLY admission without widening RPC grants',()=>{
 for(const pin of ['665d3bcba58ea4a930a5ac5801383a84','60b8eae4b4efa8a6b05b81c6c08b0021','4b9e8a4114dc962f58aa5488b2ee9675',
 '89bb9de67e0cae401b0447636a9e0939','3a29aaf12ec94c4a83743944a973dc09','591a2c4ca91722217a098e05f2bbb9ab',
 '22233ee6f1029842db9fe465ddb5398f','6ea6e5923e7aaf8934ac277a864b9067','5a5848cbf4f91f2f216290e00cf89f1e']) assert.ok(sql.includes(pin));
 assert.match(sql,/R05_SAVED_AREA_LOCAL_ONLY/);
 assert.equal((indexedSource.match(/REVOKE ALL ON FUNCTION/g)||[]).length,3);
 assert.doesNotMatch(indexedSource,/SECURITY DEFINER|CREATE TABLE|CREATE TRIGGER|GRANT /);
 assert.match(patch,/private\.worker_saved_areas_v1\(c.uid\)/);
 assert.match(patch,/private\.worker_area_fit_v1/);
});
test('actual pinned readers include far latest saved area after nearby candidates',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 assert.deepEqual(await list(db),[near]);
 await applyIndexed(db);
 assert.deepEqual(await list(db,false,2),[near,far]);
 assert.deepEqual(await list(db,false,1),[near]);
 assert.deepEqual(await list(db),[near,far]);
});
test('numeric cap suppression and NULL delegation retain the same reader contract',async t=>{
 const db=await makeDb();t.after(()=>db.close());await applyIndexed(db);
 assert.deepEqual(await list(db,true,2,null),[near,far]);
 assert.deepEqual(await list(db,true,1,1),[far]);
 assert.deepEqual(await list(db,true,2,2),[near,far]);
});
test('far invalid area, inactive worker, owner mismatch and final gate denial cannot enter',async t=>{
 const db=await makeDb();t.after(()=>db.close());await applyIndexed(db);
 await db.query('UPDATE private.worker_ai_reviews SET envelope=$1::jsonb WHERE account_id=$2',[JSON.stringify({profile:{workAreas:[cityArea('Niš')]}}),acct(12)]);
 assert.deepEqual(await list(db),[near]);
 await db.query('UPDATE private.worker_ai_reviews SET envelope=$1::jsonb WHERE account_id=$2',[JSON.stringify({profile:{workAreas:[countryArea()]}}),acct(12)]);
 await db.query("UPDATE public.app_profiles SET profile_status='DRAFT' WHERE id=$1",[far]);
 assert.deepEqual(await list(db,true,4,2),[near]);
 await db.query("UPDATE public.app_profiles SET profile_status='ACTIVE' WHERE id=$1",[far]);
 await db.query('INSERT INTO private.blocked_profiles VALUES($1)',[far]);
 assert.deepEqual(await list(db),[near]);
 await db.exec('DELETE FROM private.blocked_profiles');
 await db.query('UPDATE public.worker_match_preferences SET worker_account_id=$1 WHERE worker_profile_id=$2',[acct(13),far]);
 assert.deepEqual(await list(db),[near]);
});
test('no-pin fallback and REMOTE path retain original behavior without inventing a location',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 await db.query("INSERT INTO public.app_profiles VALUES($1,$2,'WORKER','ACTIVE')",[nullPin,acct(15)]);
 await db.query("UPDATE public.needs SET execution_location_mode='REMOTE',approx_geog=null,approximate_lat=null,approximate_lng=null");
 const before=await list(db);await applyIndexed(db);
 assert.deepEqual(await list(db),before,'REMOTE remains its existing rotation/final matcher path');
 await db.query("UPDATE public.needs SET execution_location_mode='STATIONARY',approx_geog='0'::jsonb,approximate_lat=45.25,approximate_lng=19.83");
 assert.deepEqual(await list(db,false,3),[near,far,nullPin]);
});
test('latest owned Save wins, newer unsaved review and accepted-review expiry do not change authority',async t=>{
 const db=await makeDb();t.after(()=>db.close());await applyIndexed(db);
 await saveAreas(db,acct(12),[cityArea('Niš')],{review:uid(200001),saved:false});
 assert.deepEqual(await list(db),[near,far],'expired but accepted country is still authoritative');
 await saveAreas(db,acct(12),[cityArea('Niš')],{review:uid(200002),at:'2026-11-01T13:00:00Z'});
 assert.deepEqual(await list(db),[near],'old saved country cannot override newer saved city');
 await saveAreas(db,acct(12),[countryArea()],{review:uid(200003),at:'2026-11-01T13:00:00Z'});
 assert.deepEqual(await list(db),[near,far],'review-id tie break matches canonical saved reader');
 await saveAreas(db,acct(12),[],{review:uid(200004),at:'2026-11-01T14:00:00Z',reviewOwner:acct(13)});
 assert.deepEqual(await list(db),[near,far],'foreign-owned review is not a current owned Save');
 await saveAreas(db,acct(12),[],{review:uid(200005),at:'2026-11-01T15:00:00Z'});
 assert.deepEqual(await list(db),[near],'latest empty saved areas remove indexed match without reviving history');
});
test('canonical CITY normalization and COUNTRY country gate use exact existing evaluator',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 await saveAreas(db,acct(12),[cityArea('НОВИ   САД')],{review:uid(210001),at:'2026-11-01T13:00:00Z'});
 await applyIndexed(db);
 assert.deepEqual(await list(db),[near,far]);
 await db.query("UPDATE public.needs SET approximate_city='Novi Beograd'");
 assert.deepEqual(await list(db),[near]);
 await saveAreas(db,acct(12),[countryArea()],{review:uid(210002),at:'2026-11-01T14:00:00Z'});
 await db.query("UPDATE public.needs SET task_country_code='ME'");
 assert.deepEqual(await list(db),[near]);
 await db.query("UPDATE public.needs SET task_country_code='RS',approximate_city=null,approximate_lat=null,approximate_lng=null");
 assert.deepEqual(await list(db),[near,far],'country does not invent or require a task coordinate');
});
test('all five RADIUS centers are candidates, but broad retrieval does not replace exact radius fit',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 const areas=[1,2,3,4].map((n)=>radiusArea(1,41+n/100,20,n));areas.push(radiusArea(1));
 await saveAreas(db,acct(12),areas,{review:uid(220001),at:'2026-11-01T13:00:00Z'});
 await applyIndexed(db);assert.deepEqual(await list(db),[near,far]);
 await saveAreas(db,acct(12),[radiusArea(1,45.7,19.83)],{review:uid(220002),at:'2026-11-01T14:00:00Z'});
 assert.ok((await db.query("SELECT * FROM private.worker_saved_area_candidates_v1('RS','Novi Sad',45.25,19.83)")).rows.some(r=>r.worker_account_id===acct(12)),'201km retrieval intentionally over-selects');
 assert.deepEqual(await list(db),[near],'exact 1km radius still rejects distant task');
});
test('malformed, unknown and erased review JSON cannot break index build or act as signed area',async t=>{
 const db=await makeDb();t.after(()=>db.close());
 const bad=[null,{},'x',[{}],[null],[7],['x'],[[]],[{...radiusArea(),radiusKm:'ten'}],[{...radiusArea(),latitude:'NaN'}],[{...cityArea(),kind:'FUTURE'}],{erasedBy:'AF-D22'}];
 for(let i=0;i<bad.length;i++) await saveAreas(db,acct(12),bad[i],{review:uid(230000+i),saved:false});
 await applyIndexed(db);
 for(const areas of bad){
  const r=await db.query('SELECT private.worker_area_retrieval_keys_v1($1::jsonb) AS keys,private.worker_area_radius_centers_v1($1::jsonb) AS centers',[JSON.stringify(areas)]);
  assert.deepEqual(r.rows[0],{keys:[],centers:null});
 }
 assert.deepEqual(await list(db),[near,far]);
 await db.query("UPDATE private.worker_ai_reviews SET envelope='{}'::jsonb WHERE account_id=$1",[acct(12)]);
 assert.deepEqual(await list(db),[near],'erasure updates indexes without retaining location projection');
});

async function sparseFarDb(rejectedCount){
 const db=await makeDb({seed:false});
 await db.exec(`CREATE SEQUENCE private.area_probe_calls MINVALUE 0 START WITH 0;
 CREATE OR REPLACE FUNCTION private.worker_saved_areas_v1(aid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $f$
 BEGIN
  PERFORM nextval('private.area_probe_calls');
  RETURN coalesce((SELECT r.envelope#>'{profile,workAreas}' FROM private.worker_ai_saves s
   JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
   WHERE s.account_id=aid ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1),'[]'::jsonb);
 END; $f$;`);
 const eligible=uid(1000+rejectedCount);
 for(let i=0;i<=rejectedCount;i++){
  const id=uid(1000+i),account=uid(10000+i);
  await db.query("INSERT INTO public.app_profiles VALUES($1,$2,'WORKER','ACTIVE')",[id,account]);
  await db.query("INSERT INTO public.worker_match_preferences VALUES($1,$2,'600000'::jsonb)",[id,account]);
  await saveAreas(db,account,i===rejectedCount?[countryArea()]:[cityArea('Niš',43.32,21.90)]);
 }
 return {db,eligible};
}
async function countReads(db){return Number((await db.query('SELECT CASE WHEN is_called THEN last_value+1 ELSE 0 END AS calls FROM private.area_probe_calls')).rows[0].calls);}
async function resetReads(db){await db.query("SELECT setval('private.area_probe_calls',0,false)");}
const indexedFrom='from private.worker_saved_area_candidates_v1(n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng) saved\n        join public.worker_match_preferences pref on pref.worker_account_id=saved.worker_account_id';

test('sparse indexed retrieval reads only matching latest saved area, no-match reads none, retry is stable',async t=>{
 const {db,eligible}=await sparseFarDb(128);t.after(()=>db.close());await applyIndexed(db);
 for(const [capped,cap] of [[false,null],[true,null],[true,2]]){
  for(let retry=0;retry<2;retry++){
   await resetReads(db);assert.deepEqual(await list(db,capped,1,cap),[eligible]);
   assert.equal(await countReads(db),1,'128 unrelated far saved-area readers are not called');
  }
 }
 await db.query('DELETE FROM private.worker_ai_saves WHERE account_id=$1',[uid(10128)]);
 await resetReads(db);assert.deepEqual(await list(db,false,1),[]);assert.equal(await countReads(db),0);
});
test('negative control preserves old 129-read witness and demonstrates why a raw cap is invalid',async t=>{
 for(const limit of [null,8]){
  const {db,eligible}=await sparseFarDb(128);t.after(()=>db.close());
  assert.equal(patch.split(indexedFrom).length-1,2);
  let old=patch.replaceAll(indexedFrom,'from public.worker_match_preferences pref');
  if(limit) old=old.replaceAll('order by pref.worker_profile_id\n      loop','order by pref.worker_profile_id LIMIT 8\n      loop');
  await db.exec(old);
  for(const [capped,cap] of [[false,null],[true,null],[true,2]]){
   for(let retry=0;retry<2;retry++){
    await resetReads(db);assert.deepEqual(await list(db,capped,1,cap),limit?[]:[eligible]);
    assert.equal(await countReads(db),limit??129);
   }
  }
 }
});
test('actual GIN and latest-Save btree are chosen for selective core PostgreSQL queries',async t=>{
 const db=await makeDb({seed:false});t.after(()=>db.close());await applyIndexed(db);
 await db.query(`INSERT INTO private.worker_ai_reviews(id,account_id,envelope)
  SELECT md5('review'||g)::uuid,md5('owner'||g)::uuid,
  jsonb_build_object('profile',jsonb_build_object('workAreas',jsonb_build_array($1::jsonb||jsonb_build_object('city','City'||g,'label','City'||g))))
  FROM generate_series(1,4000) g`,[JSON.stringify(cityArea())]);
 await db.exec(`INSERT INTO private.worker_ai_saves SELECT id,account_id,'2026-11-01'::timestamptz FROM private.worker_ai_reviews; ANALYZE private.worker_ai_reviews; ANALYZE private.worker_ai_saves;`);
 const plan=(await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) SELECT id FROM private.worker_ai_reviews
  WHERE private.worker_area_retrieval_keys_v1(envelope#>'{profile,workAreas}') && ARRAY['CITY:city3999']`)).rows[0]['QUERY PLAN'];
 assert.match(JSON.stringify(plan),/r05_worker_review_area_keys_idx/);
 assert.equal(plan[0].Plan['Actual Rows'],1);
 const latest=(await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) SELECT review_id FROM private.worker_ai_saves
  WHERE account_id=md5('owner3999')::uuid ORDER BY created_at DESC,review_id DESC LIMIT 1`)).rows[0]['QUERY PLAN'];
 assert.match(JSON.stringify(latest),/r05_worker_saves_latest_idx/);
 assert.equal(latest[0].Plan['Actual Rows'],1);
 // No GiST/PostGIS plan assertion: PGlite does not provide that extension.
});
