// Current R07 writers -> exact two export branches -> current projection/JSON tail.
// Isolated PGlite 18, with the pricing fixture's explicit environmental stubs.
// The binding is synthetic and only includes these two datasets. This is not a
// complete export, lifecycle certificate admission, hosted Auth/HTTP or download.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setup as pricingSetup, body, md5} from '../ai/r07_current_hourly_fixture.mjs';

const data=JSON.parse(execFileSync('python',['supabase/proofs/legal/build_price_export_candidate.py','--json'],{encoding:'utf8',maxBuffer:2*1024*1024}));
const candidate=readFileSync(new URL('../../candidates/r07_price_export_current.sql',import.meta.url),'utf8');
const packagePostimage=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/postimage.json',import.meta.url),'utf8'));
const names=Object.keys({...data.before,...data.dependencies});
const snapshotName='private.data_export_snapshot';
const catalogName='private.data_export_dataset_catalog';
const metadata=f=>f.rows(`SELECT n.nspname||'.'||p.proname AS name,to_jsonb(p)-'prosrc' AS attributes,md5(p.prosrc) AS hash
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=ANY($1::text[]) ORDER BY 1`,[names]);
const catalog=f=>f.value('SELECT private.data_export_dataset_catalog() AS value');

async function setup(t,{apply=true}={}){
 const f=await pricingSetup(t);
 for(const entry of Object.values({...data.before,...data.dependencies})){
  await f.db.exec(entry.definition+`\nREVOKE ALL ON FUNCTION ${entry.signature} FROM PUBLIC,anon,authenticated,service_role;`);
 }
 const inventory=packagePostimage.find(v=>v.name==='private.closure_taxonomy_inventory_v1');
 assert.ok(inventory);const inventoryDefinition=inventory.definition.trimEnd()+';';
 // This existing package records pg_get_functiondef MD5, not prosrc MD5.
 assert.equal(md5(inventory.definition),inventory.md5);
 await f.db.exec(inventoryDefinition+f.fn('private.closure_taxonomy_scope_v1'));
 // Only the existing final account-existence predicate needs this synthetic row.
 await f.db.exec('CREATE TABLE public.app_accounts(id uuid PRIMARY KEY);');
 await f.db.query('INSERT INTO public.app_accounts VALUES($1),($2),($3)',[f.WORKER,f.REQUESTER,f.FOREIGN]);
 if(apply)await f.db.exec("SET uskoci.r07_export.disposable='LOCAL_ONLY';"+candidate);
 return f;
}

async function snapshotBody(f){
 return f.value('SELECT prosrc AS value FROM pg_proc WHERE oid=$1::regprocedure',[data.before[snapshotName].signature]);
}
async function branches(f,account){
 const parts=(await snapshotBody(f)).split('\nunion all\n');
 return Object.fromEntries(await Promise.all(['responses','agreements'].map(async key=>{
  const branch=parts.find(v=>v.startsWith(`select '${key}' as key,`));assert.ok(branch,key);
  const rows=await f.rows(branch.replaceAll('p_account_id','$1::uuid'),[account]);
  return [key,rows.map(v=>v.value)];
 })));
}
async function projected(f,account){
 const source=await snapshotBody(f),parts=source.split('\nunion all\n');
 const included=['responses','agreements'];
 const exactBranches=included.map(key=>{const branch=parts.find(v=>v.startsWith(`select '${key}' as key,`));assert.ok(branch);return branch;});
 const start=source.indexOf(' owned_rows as materialized ('),end=source.indexOf('),\n projected as ');
 assert.ok(start>0&&end>start);
 const sql=(source.slice(0,start)+' owned_rows as materialized ('+exactBranches.join('\nunion all\n')+source.slice(end))
  .replaceAll('p_account_id','$1::uuid').replaceAll('p_binding','$2::jsonb')
  .replaceAll('p_receipt_id','$3::uuid').replaceAll('p_cutoff','$4::timestamptz');
 const binding={delivery:{datasets:(await catalog(f)).filter(v=>included.includes(v.key)).map(({key,fields})=>({key,fields,mode:'INCLUDE'}))}};
 const rows=await f.rows(sql,[account,binding,randomUUID(),'2026-11-03T12:00:00Z']);
 assert.equal(rows.length,1);return JSON.parse(Object.values(rows[0])[0]);
}
async function selectedHourly(f){
 await f.actor(f.WORKER);const need=await f.need('HOURLY'),receipt=await f.submit(need);
 await f.actor(f.REQUESTER);const agreement=await f.select(need,receipt);
 return {need,receipt,agreement};
}
async function unrelatedSelection(f){
 const worker=randomUUID(),requester=randomUUID(),workerProfile=randomUUID(),requesterProfile=randomUUID();
 await f.db.query('INSERT INTO public.app_accounts VALUES($1),($2)',[worker,requester]);
 await f.db.query(`INSERT INTO public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
  VALUES($1,$2,'WORKER','Drugi radnik','Beograd',ARRAY['Selidbe'],'ACTIVE'),
        ($3,$4,'REQUESTER','Drugi naručilac','Beograd','{}','ACTIVE')`,[workerProfile,worker,requesterProfile,requester]);
 const need=await f.need('HOURLY',8800);
 await f.db.query('UPDATE public.needs SET requester_account_id=$2,requester_profile_id=$3 WHERE id=$1',[need,requester,requesterProfile]);
 await f.actor(worker);const receipt=await f.submit(need,8800,2,1,randomUUID(),workerProfile);
 await f.actor(requester);await f.select(need,receipt);
}
const propose=(f,id,price,version=1)=>f.value('SELECT public.rpc_propose_agreement_change_v2($1,$2,$3,$4,$5) AS value',
 [id,version,{price_rsd:price},'Dogovorena promena',randomUUID()]);

test('two current export owners regenerate exactly; dependencies, schema version and dataset identities stay intact',()=>{
 assert.match(execFileSync('python',['supabase/proofs/legal/build_price_export_candidate.py','--check'],{encoding:'utf8'}),/R07_EXPORT_SOURCE_PASS/);
 for(const group of [data.before,data.after,data.dependencies])for(const f of Object.values(group))assert.equal(md5(body(f.definition)),f.body_md5,f.name);
 assert.equal(Object.keys(data.after).length,2);
 assert.doesNotMatch(candidate,/^\s*(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s/im);
 assert.match(data.after[snapshotName].definition,/'projectionVersion','OWN_ACCOUNT_V5_11'/);
});

test('real hourly selection reproduces lost unit/history; candidate preserves all old fields and private function metadata',async t=>{
 const f=await setup(t,{apply:false}),{receipt}=await selectedHourly(f);
 const before=await branches(f,f.WORKER),oldCatalog=await catalog(f),meta=await metadata(f),rows=await f.immutableRows(receipt.responseId);
 assert.equal(Object.hasOwn(before.responses[0],'priceBasis'),false);
 assert.equal(Object.hasOwn(before.responses[0],'versions'),false);
 assert.equal(Object.hasOwn(before.agreements[0],'versions'),false);
 await f.db.exec("SET uskoci.r07_export.disposable='LOCAL_ONLY';"+candidate);
 const after=await branches(f,f.WORKER),newCatalog=await catalog(f),post=await metadata(f);
 assert.equal(after.responses[0].priceRsd,1200);assert.equal(after.responses[0].priceBasis,'HOURLY');
 assert.equal(after.responses[0].versions[0].priceBasis,'HOURLY');assert.equal(after.agreements[0].versions[0].priceBasis,'HOURLY');
 const {priceBasis,currentVersion,versions,...oldResponse}=after.responses[0];
 const {versions:agreementVersions,...oldAgreement}=after.agreements[0];
 assert.deepEqual(oldResponse,before.responses[0]);assert.deepEqual(oldAgreement,before.agreements[0]);
 assert.equal(currentVersion,1);assert.equal(versions.length,1);assert.equal(agreementVersions.length,1);
 assert.equal(oldCatalog.length,73);assert.equal(newCatalog.length,73);
 assert.deepEqual(newCatalog.map(v=>v.key),oldCatalog.map(v=>v.key));
 for(const entry of newCatalog){
  const old=oldCatalog.find(v=>v.key===entry.key);
  if(['responses','agreements'].includes(entry.key)){
   assert.deepEqual({...entry,fields:old.fields},old);
   assert.deepEqual([...entry.fields].sort(),Object.keys(after[entry.key][0]).sort());
  }else assert.deepEqual(entry,old);
 }
 assert.deepEqual(post.map(({hash,...v})=>v),meta.map(({hash,...v})=>v));
 for(const row of post)assert.equal(row.hash,(data.after[row.name]??data.dependencies[row.name]).body_md5);
 assert.deepEqual(await f.immutableRows(receipt.responseId),rows);
 for(const role of ['anon','authenticated','service_role'])for(const entry of Object.values(data.before)){
  assert.equal(await f.value("SELECT has_function_privilege($1,$2,'EXECUTE') AS value",[role,entry.signature]),false);
 }
});

test('unmarked target, changed body/dependency, ACL and schema drift refuse atomically; successful change rolls back',async t=>{
 const f=await setup(t,{apply:false}),initial=await metadata(f);
 await assert.rejects(f.db.exec(candidate),/R07_EXPORT_DISPOSABLE_REQUIRED/);
 const mutations=[
  [data.before[snapshotName].definition.replace(' with configured',' with /* drift */ configured'),'SOURCE_OR_ACL_DRIFT'],
  [data.dependencies['private.data_export_scalar_v5'].definition.replace('AS $function$','AS $function$\n-- drift'),'SOURCE_OR_ACL_DRIFT'],
  ['GRANT EXECUTE ON FUNCTION private.data_export_dataset_catalog() TO authenticated;','SOURCE_OR_ACL_DRIFT'],
  ['ALTER TABLE public.marketplace_response_versions ALTER COLUMN price_basis SET NOT NULL;','SCHEMA_DRIFT'],
 ];
 for(const [sql,error] of mutations){
  await f.db.exec("BEGIN;SET LOCAL uskoci.r07_export.disposable='LOCAL_ONLY';"+sql);
  await assert.rejects(f.db.exec(candidate),new RegExp('R07_EXPORT_'+error));
  await f.db.exec('ROLLBACK');assert.deepEqual(await metadata(f),initial);
 }
 await f.db.exec("BEGIN;SET LOCAL uskoci.r07_export.disposable='LOCAL_ONLY';"+candidate+'ROLLBACK;');
 assert.deepEqual(await metadata(f),initial);
});

test('accepted hourly change exports immutable amounts and units for both participants; pending proposal and foreign account stay outside',async t=>{
 const f=await setup(t),{agreement}=await selectedHourly(f),proposal=await propose(f,agreement,1400);
 await f.actor(f.WORKER);await f.value('SELECT public.rpc_respond_agreement_change($1,true) AS value',[proposal]);
 await f.actor(f.REQUESTER);await propose(f,agreement,1700,2);
 await unrelatedSelection(f);
 for(const account of [f.WORKER,f.REQUESTER]){
  const result=await projected(f,account),rows=result.datasets.agreements;
  assert.equal(rows.length,1);assert.equal(rows[0].currentVersion,2);
  assert.deepEqual(rows[0].versions.map(v=>[v.version,v.priceRsd,v.priceBasis,v.coveredSlots]),[[1,1200,'HOURLY',2],[2,1400,'HOURLY',2]]);
  assert.equal(rows[0].versions[1].supersedesVersion,1);
  assert.equal(result.projectionVersion,'OWN_ACCOUNT_V5_11');
  assert.equal(result.datasetCounts.agreements,1);assert.equal(result.datasetCounts.responses,account===f.WORKER?1:0);
  assert.equal(rows[0].versions.some(v=>v.priceRsd===1700||v.priceRsd===8800),false);
  if(account===f.WORKER)assert.deepEqual(result.datasets.responses[0].versions.map(v=>[v.version,v.priceRsd,v.priceBasis]),[[1,1200,'HOURLY']]);
 }
 assert.deepEqual((await projected(f,f.FOREIGN)).datasets,{responses:[],agreements:[]});
});

test('revision history preserves the old TOTAL amount and the new HOURLY rate without reading today\'s edited task unit',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const need=await f.need(null),first=await f.submit(need);
 await f.stale(need,first,'HOURLY');const next=await f.resolveStale(first,2,'UPDATE',1200,2);
 await f.actor(f.REQUESTER);await f.select(need,next);
 await f.db.query("UPDATE public.needs SET price_basis='PER_PERSON' WHERE id=$1",[need]);
 const result=await projected(f,f.WORKER),response=result.datasets.responses[0];
 assert.equal(response.currentVersion,2);assert.equal(response.priceBasis,'HOURLY');assert.equal(response.priceRsd,1200);
 assert.deepEqual(response.versions.map(v=>[v.version,v.needRevision,v.priceRsd,v.priceBasis,v.coveredSlots]),[[1,1,1200,'TOTAL',2],[2,2,1200,'HOURLY',2]]);
 assert.equal(result.datasets.agreements[0].versions[0].priceBasis,'HOURLY');
});

test('legacy NULL units remain TOTAL; typed projections exclude opaque terms and reject malformed units instead of inventing rates',async t=>{
 const f=await setup(t),{receipt,agreement,need}=await selectedHourly(f);
 await f.db.query('UPDATE public.marketplace_responses SET price_basis=NULL WHERE id=$1',[receipt.responseId]);
 await f.db.query('UPDATE public.marketplace_response_versions SET price_basis=NULL WHERE response_id=$1',[receipt.responseId]);
 await f.db.query("UPDATE public.needs SET price_basis='HOURLY' WHERE id=$1",[need]);
 const cases=[
  [{price_rsd:900,covered_slots:2},900,'TOTAL',2],
  [{price_rsd:900,priceBasis:null,covered_slots:2},900,'TOTAL',2],
  [{price_rsd:1200,priceBasis:'HOURLY',covered_slots:2,rawSecret:'MUST_NOT_EXPORT',address:'MUST_NOT_EXPORT'},1200,'HOURLY',2],
  [{price_rsd:{secret:'MUST_NOT_EXPORT'},priceBasis:{secret:'MUST_NOT_EXPORT'},covered_slots:['MUST_NOT_EXPORT']},null,null,null],
  [{price_rsd:'1200',priceBasis:'PER_PERSON',covered_slots:'2'},null,null,null],
  [[],null,null,null],['MUST_NOT_EXPORT',null,null,null],
 ];
 for(const [terms,priceRsd,priceBasis,coveredSlots] of cases){
  await f.db.query('UPDATE public.agreement_versions SET terms=$2::jsonb WHERE agreement_id=$1',[agreement,JSON.stringify(terms)]);
  const result=await projected(f,f.WORKER),response=result.datasets.responses[0],version=result.datasets.agreements[0].versions[0];
  assert.equal(response.priceBasis,'TOTAL');assert.equal(response.versions[0].priceBasis,'TOTAL');
  assert.equal(response.priceRsd,1200);assert.equal(version.priceRsd,priceRsd);assert.equal(version.priceBasis,priceBasis);assert.equal(version.coveredSlots,coveredSlots);
  assert.deepEqual(Object.keys(version).sort(),['version','status','supersedesVersion','createdAt','priceRsd','priceBasis','coveredSlots'].sort());
  assert.equal(JSON.stringify(result).includes('MUST_NOT_EXPORT'),false);
 }
});
