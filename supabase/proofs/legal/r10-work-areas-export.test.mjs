// Executes current export branches and reset/archive helpers in isolated PostgreSQL.
// Does not execute hosted DEV, full export admission, retention or Auth/Storage delivery.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const capture=JSON.parse(readFileSync(new URL('./r10-work-areas-current.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('../../candidates/r10_worker_area_export_projection.sql',import.meta.url),'utf8');
const functions=capture.functions;
const fn=name=>functions.find(f=>f.signature.startsWith(`private.${name}(`));
const md5=s=>createHash('md5').update(s).digest('hex');
const id=n=>`00000000-0010-4010-8010-${String(n).padStart(12,'0')}`;
const owner=id(1),peer=id(2),conversation=id(3),foreignConversation=id(4);
const areas=[
  {kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null},
  {kind:'CITY',countryCode:'RS',label:'Niš',city:'Niš',sourceRef:'osm:relation:1',latitude:43.32,longitude:21.90,radiusKm:null},
  {kind:'RADIUS',countryCode:'RS',label:'Novi Sad · do 30 km',city:'Novi Sad',sourceRef:'osm:relation:2',latitude:45.27,longitude:19.83,radiusKm:30},
];
const profile={displayName:'Test izvršilac',skills:['popravka'],teamCapacity:2,
  workAreas:areas.map(a=>({...a,opaqueLease:'MUST_NOT_EXPORT',preciseHomeAddress:'MUST_NOT_EXPORT'})),
  location:{operatingCountryCode:'RS',city:'Niš',radiusKm:20,approximatePosition:{latitude:43.32,longitude:21.90}},
  availability:{timezone:'Europe/Belgrade',availableNow:true,rules:[],windows:[]},secret:'MUST_NOT_EXPORT'};

async function setup(optIn=true){
  const db=new PGlite();
  await db.exec('CREATE SCHEMA private; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  for(const name of ['data_export_scalar_v5','data_export_array_v5','data_export_worker_candidate_v5',
    'closure_taxonomy_inventory_v1','closure_taxonomy_reset_sections_v1',
    'closure_taxonomy_semantic_keys_v1','closure_taxonomy_semantic_v1','closure_taxonomy_project_v1']){
    const f=fn(name);
    await db.exec(f.definition+';');
    const signature=f.signature.replace(/\([^)]*\)/,m=>m.replace(/\b(?:v|t|r|a) /g,''));
    await db.exec(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,anon,authenticated,service_role;`);
  }
  if(optIn) await db.exec("SET uskoci.r10.disposable='LOCAL_ONLY';");
  return db;
}
const project=(db,v)=>db.query('SELECT private.data_export_worker_candidate_v5($1::jsonb) AS result',[v]).then(r=>r.rows[0].result);
const metadata=db=>db.query("SELECT proowner::regrole::text AS owner,proacl::text AS acl,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='private.data_export_worker_candidate_v5(jsonb)'::regprocedure").then(r=>r.rows[0]);

test('captured function definitions and bodies retain exact read-only DEV hashes',()=>{
  assert.equal(capture.project_ref,'leqcwgzvjsxugfgzdmth');
  for(const f of functions){
    assert.equal(md5(f.definition),f.definition_md5,f.signature+' definition');
    const body=f.definition.split('AS $function$')[1]?.split('$function$')[0];
    assert.equal(md5(body),f.body_md5,f.signature+' body');
  }
});

test('current helper reproduces lost workAreas; exact candidate preserves the rest and private ACL',async t=>{
  const db=await setup();t.after(()=>db.close());
  const before=await project(db,profile),meta=await metadata(db);
  assert.equal(Object.hasOwn(before,'workAreas'),false,'reproduce current missing export field');
  await db.exec(candidate);
  const after=await project(db,profile);
  assert.deepEqual(after.workAreas,areas);
  const {workAreas,...unchanged}=after;
  assert.deepEqual(unchanged,before);
  assert.deepEqual(await metadata(db),meta);
  assert.equal(JSON.stringify(after).includes('MUST_NOT_EXPORT'),false);
  for(const role of ['anon','authenticated','service_role']){
    const r=await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,'private.data_export_worker_candidate_v5(jsonb)']);
    assert.equal(r.rows[0].allowed,false);
  }
});

test('unadmitted candidate refuses execution even when the exact live preimage is present',async t=>{
  const db=await setup(false);t.after(()=>db.close());
  const before=await project(db,profile),meta=await metadata(db);
  await assert.rejects(db.exec(candidate),/R10_WORK_AREAS_LOCAL_ONLY/);
  await db.exec('ROLLBACK');
  assert.deepEqual(await project(db,profile),before);
  assert.deepEqual(await metadata(db),meta);
});

test('absent/invalid workAreas are safe; typed fields and order are preserved without inventing facts',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec(candidate);
  for(const workAreas of [undefined,null,'RS',17,true,{kind:'COUNTRY'}]){
    assert.deepEqual((await project(db,{workAreas})).workAreas,[]);
  }
  const result=await project(db,{workAreas:[null,17,'bad',[],areas[2],
    {kind:23,countryCode:true,city:{text:'Niš'},label:['bad'],latitude:'43',longitude:[],radiusKm:'30',sourceRef:9},areas[0]]});
  assert.deepEqual(result.workAreas,[areas[2],Object.fromEntries(Object.keys(areas[0]).map(k=>[k,null])),areas[0]]);
  assert.equal(result.location.city,null);
  assert.equal(result.location.operatingCountryCode,null);
});

test('exact current draft/review export SELECTs retain areas and reject either foreign ownership side',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec(candidate);
  await db.exec(`CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid);
    CREATE TABLE private.worker_ai_sessions(conversation_id uuid,account_id uuid,profile_id uuid,revision integer,safety jsonb,candidate jsonb,created_at timestamptz);
    CREATE TABLE private.worker_ai_reviews(id uuid,conversation_id uuid,account_id uuid,revision integer,envelope jsonb,created_at timestamptz);`);
  await db.query('INSERT INTO public.ai_conversations VALUES($1,$2),($3,$4)',[conversation,owner,foreignConversation,peer]);
  for(const [n,c,a] of [[10,conversation,owner],[11,conversation,peer],[12,foreignConversation,owner],[13,foreignConversation,peer]]){
    await db.query("INSERT INTO private.worker_ai_sessions VALUES($1,$2,$3,1,'{}',$4,'2026-11-01Z')",[c,a,id(n),profile]);
    await db.query("INSERT INTO private.worker_ai_reviews VALUES($1,$2,$3,1,$4,'2026-11-01Z')",[id(n),c,a,{profile,activate:true,opaqueLease:'MUST_NOT_EXPORT'}]);
  }
  // Exact union branches from captured current owner; no mock replacement of predicates.
  const parts=fn('data_export_snapshot').definition.split('\nunion all\n');
  for(const key of ['workerAiDrafts','workerAiReviews']){
    const branch=parts.find(p=>p.startsWith(`select '${key}' as key,`));assert.ok(branch);
    const rows=(await db.query(branch.replaceAll('p_account_id','$1::uuid'),[owner])).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].key,key);
    assert.deepEqual(rows[0].value.profile.workAreas,areas);
    assert.equal(JSON.stringify(rows).includes('MUST_NOT_EXPORT'),false);
  }
});

test('current reset/archive projector retains owned candidate/envelope areas and omits foreign copies and opaque fields',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec(candidate);
  const input={backup_id:id(20),profile_id:id(21),backed_up_at:'2026-11-01Z',secret:'MUST_NOT_EXPORT',payload:{
    worker_sessions:[{account_id:owner,conversation_id:conversation,candidate:profile},
      {account_id:peer,conversation_id:foreignConversation,candidate:{displayName:'FOREIGN_SENTINEL',workAreas:areas}}],
    worker_reviews:[{owner_account_id:owner,id:id(22),envelope:{profile,opaqueLease:'MUST_NOT_EXPORT'}},
      {worker_account_id:peer,id:id(23),envelope:{profile:{displayName:'FOREIGN_SENTINEL',workAreas:areas}}}],
    unrecognized:[{secret:'MUST_NOT_EXPORT'}]}};
  const r=await db.query('SELECT private.closure_taxonomy_project_v1($1,$2::jsonb,$3::uuid) AS result',
    ['private.dev_worker_profile_reset_snapshots_v1',input,owner]);
  const out=r.rows[0].result;
  assert.equal(out.payload.worker_sessions.length,1);assert.equal(out.payload.worker_reviews.length,1);
  assert.deepEqual(out.payload.worker_sessions[0].candidate.workAreas,areas);
  assert.deepEqual(out.payload.worker_reviews[0].envelope.profile.workAreas,areas);
  assert.deepEqual(Object.keys(out.payload.worker_reviews[0].envelope),['profile']);
  assert.equal(JSON.stringify(out).includes('MUST_NOT_EXPORT'),false);
  assert.equal(JSON.stringify(out).includes('FOREIGN_SENTINEL'),false);
});

test('candidate rejects changed source and never admits export/retention certificates',async t=>{
  const db=await setup();t.after(()=>db.close());
  await db.exec("CREATE OR REPLACE FUNCTION private.data_export_worker_candidate_v5(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $f$ SELECT v $f$;");
  await assert.rejects(db.exec(candidate),/R10_WORK_AREAS_PREIMAGE_DRIFT/);
  await db.exec('ROLLBACK');
  assert.match(candidate,/R10_WORK_AREAS_LOCAL_ONLY/);
  assert.doesNotMatch(candidate,/^\s*(?:GRANT|REVOKE|UPDATE|INSERT|DELETE|ALTER|DROP)\s/im);
  assert.equal((candidate.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);
});
