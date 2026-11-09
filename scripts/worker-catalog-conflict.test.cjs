'use strict';
// Diagnostic reproduction of unchanged, freshly read DEV SQL. This fixture is
// not an Auth/RLS, full Save/activation or hosted integration acceptance test.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const capture=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/worker_catalog_conflict_20261109.preimage.json'),'utf8'));
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const account='10000000-0000-4000-8000-000000000001';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema private;create schema auth;create schema extensions;
 create table private.work_taxonomy_gemini_turn_hints_v1(id uuid primary key,account_id uuid,catalog_version bigint,proposals jsonb,catalog_resolution jsonb);
 create table private.work_taxonomy_control(singleton boolean primary key,catalog_version bigint,updated_at timestamptz);
 create table private.work_taxonomy_categories(id uuid primary key default gen_random_uuid(),label text,parent_id uuid,canonical_key text unique,state text,source text,catalog_version bigint);
 create table private.work_taxonomy_category_modes(category_id uuid,execution_scope text,source_ref text,primary key(category_id,execution_scope));
 create table private.work_taxonomy_aliases(category_id uuid,normalized_key text);
 create table private.work_taxonomy_risk_rules(pattern text,decision text,enabled boolean);
 create table private.work_taxonomy_audit(action text,category_id uuid,normalized_key text,catalog_version bigint,source_ref text);
 create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
 create function private.closure_assert_open(uuid) returns void language sql as $$select null::void$$;
 create function extensions.digest(text,text) returns bytea language sql immutable as $$select case when $2='sha256' then sha256(convert_to($1,'UTF8')) end$$;`);
 await db.query('insert into private.work_taxonomy_control values(true,$1,now())',[capture.catalog.catalogVersion]);
 for(const c of capture.catalog.categories)await db.query('insert into private.work_taxonomy_categories values($1,$2,$3,$4,$5,$6,$7)',[c.id,c.label,c.parent_id,c.canonical_key,c.state,c.source,c.catalog_version]);
 for(const m of capture.catalog.modes)await db.query('insert into private.work_taxonomy_category_modes values($1,$2,null)',[m.category_id,m.execution_scope]);
 for(const a of capture.catalog.aliases)await db.query('insert into private.work_taxonomy_aliases values($1,$2)',[a.category_id,a.normalized_key]);
 for(const r of capture.catalog.riskRules)await db.query('insert into private.work_taxonomy_risk_rules values($1,$2,$3)',[r.pattern,r.decision,r.enabled]);
 // Exact live function bodies, including the duplicate check and risk rules.
 for(const fn of [...capture.functions].sort((a,b)=>Number(a.signature.includes('resolve_turn'))-Number(b.signature.includes('resolve_turn')))){
  assert.equal(md5(fn.definition.split('AS $function$')[1].split('$function$')[0]),fn.body_md5);
  await db.exec(fn.definition);
 }
 const value=async(sql,args=[])=> (await db.query(sql,args)).rows[0].value;
 return {db,value,resolve:async(proposals)=>{
  const id=crypto.randomUUID(),anchors=[],seen=new Set();
  for(const p of proposals){let id=['REUSE_EXISTING','EXTEND_MODE'].includes(p.action)?p.categoryId:p.parentId;
   while(id&&!seen.has(id)){const c=capture.catalog.categories.find(c=>c.id===id);assert.ok(c);seen.add(id);anchors.push({categoryId:c.id,label:c.label,parentId:c.parent_id});id=c.parent_id;}}
  await db.query('insert into private.work_taxonomy_gemini_turn_hints_v1 values($1,$2,$3,$4,null)',[id,account,capture.catalog.catalogVersion,JSON.stringify(proposals)]);
  return value("select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,'ALLOW') as value",[id,sha(JSON.stringify(proposals)),JSON.stringify(anchors)]);
 }};
}
test('current exact seven-service plan reproduces durable CATALOG_CONFLICT without catalog mutation',async()=>{
 const f=await fixture();try{
  const result=await f.resolve(capture.proposals);assert.equal(result.state,'DEFERRED');assert.equal(result.code,'CATALOG_CONFLICT');
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'),0);
  assert.equal(await f.value('select catalog_version as value from private.work_taxonomy_control'),capture.catalog.catalogVersion);
  assert.deepEqual(await f.value('select catalog_resolution as value from private.work_taxonomy_gemini_turn_hints_v1'),result);
 }finally{await f.db.close();}
});
test('two natural service labels are individually accepted but same leaf and mode together are rejected',async()=>{
 const f=await fixture();try{
  for(const p of capture.proposals.slice(0,2))assert.equal((await f.resolve([p])).state,'RESOLVED');
  const pair=await f.resolve(capture.proposals.slice(0,2));assert.equal(pair.code,'CATALOG_CONFLICT');
 }finally{await f.db.close();}
});
test('removing only duplicate identity exposes separate broad-service CATALOG_SAFETY block',async()=>{
 const f=await fixture();try{
  const result=await f.resolve(capture.proposals.filter((_,i)=>i!==1));assert.equal(result.state,'DEFERRED');assert.equal(result.code,'CATALOG_SAFETY');
  assert.equal(await f.value('select private.taxonomy_risk_triage_v1($1) as value',[capture.proposals[2].service]),'NEEDS_CLARIFICATION');
  assert.equal((await f.resolve([capture.proposals[2]])).code,'CATALOG_SAFETY');
 }finally{await f.db.close();}
});
test('remaining five independent specific services resolve with exact provided IDs and modes',async()=>{
 const f=await fixture();try{
  const proposals=capture.proposals.filter((_,i)=>i!==1&&i!==2),result=await f.resolve(proposals);
  assert.equal(result.state,'RESOLVED');assert.deepEqual(result.items.map(i=>i.categoryId),proposals.map(p=>p.categoryId));
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'),0);
 }finally{await f.db.close();}
});
test('duplicate rejection is scoped to same mode; explicit missing-mode extension remains a distinct decision',async()=>{
 const f=await fixture();try{
  const p=capture.proposals[0],second={...capture.proposals[1],mode:'REMOTE',action:'EXTEND_MODE'};
  const result=await f.resolve([p,second]);assert.equal(result.state,'RESOLVED');assert.equal(result.items.length,2);
  assert.equal(result.items[0].categoryId,result.items[1].categoryId);
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'),1);
 }finally{await f.db.close();}
});
test('one combined specific offer resolves under the unchanged SQL without changing the other service identities',async()=>{
 const f=await fixture();try{
  // Diagnostic shape for a NEW model-authored offer, not silent deletion or
  // rewriting of an existing saved service. The broad offer still needs its
  // own clarification; no test assertion authorizes ignoring it in the app.
  const combined={...capture.proposals[0],service:'Kurirske dostave i nabavka'};
  const specific=[combined,...capture.proposals.slice(3)];
  const result=await f.resolve(specific);assert.equal(result.state,'RESOLVED');
  assert.deepEqual(result.items.map(x=>x.categoryId),specific.map(x=>x.categoryId));
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'),0);
 }finally{await f.db.close();}
});
