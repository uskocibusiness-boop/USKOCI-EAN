// Local PostgreSQL read-model proof. Real captured tables/helpers and the exact
// candidate execute with pgcrypto and authenticated role ownership checks.
// Durable writer records are fixtures: this is not Save/DEV/Auth HTTP/device E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const candidate=readFileSync(new URL('../../candidates/r08_saved_worker_services.sql',import.meta.url),'utf8');
const id=n=>'00000000-0010-4010-8010-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),profile=id(3),logo=id(4),repair=id(5),conversation=id(6);
const at='2026-10-30T12:00:00Z',boundAt='2026-10-30T12:01:00Z';
const handoff={required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}};
function sqlFunction(name){
 const start=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'('),marker=snapshot.indexOf('AS $function$',start);
 const end=snapshot.indexOf('$function$;',marker+13);assert.ok(start>=0&&marker>start&&end>marker,name);
 return snapshot.slice(start,end+11);
}
function tableSql(name){
 const quoted=name.split('.').map(x=>'"'+x+'"').join('.');
 const start=snapshot.indexOf('CREATE TABLE '+quoted+' ('),end=snapshot.indexOf('\n);',start);assert.ok(start>=0&&end>start,name);
 const changes=snapshot.split('\n').filter(line=>line.startsWith('ALTER TABLE '+quoted+' ')
  && (line.includes(' SET DEFAULT ')||/ ADD CONSTRAINT .* (PRIMARY KEY|UNIQUE) /.test(line)));
 return snapshot.slice(start,end+3)+'\n'+changes.join('\n');
}
function mobileDecoder(){
 const cache=new Map(),context=vm.createContext({Intl,Date,process:{env:{}}});
 const noIo=()=>assert.fail('UNEXPECTED_MOBILE_IO');
 function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  if(url.pathname.endsWith('/src/store/sesija.ts'))return {sesijaSada:noIo};
  if(url.pathname.endsWith('/src/data/supabaseClient.ts'))return {supabaseKlijent:noIo};
  if(url.pathname.endsWith('/src/data/ownProfileClientService.ts'))return {ownProfileClientService:{read:noIo}};
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{fileName:url.pathname.replace(/\.mjs$/,'.ts'),
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  const exports={};cache.set(url.href,exports);
  new vm.Script(`(function(exports,require){${compiled.outputText}\n})`,{filename:url.pathname}).runInContext(context)(exports,name=>{
   assert.ok(name.startsWith('.'),'Only local decoder imports');return load(new URL(/\.(?:ts|mjs)$/.test(name)?name:name+'.ts',url));
  });return exports;
 }
 return load(new URL('../../../src/data/workerExecutionModeClientService.ts',import.meta.url)).decodeWorkerExecutionModeReceipt;
}
const decode=mobileDecoder();
async function setup(t,{patched=true}={}){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;`);
 await db.exec(sqlFunction('private.taxonomy_normalize_v1'));
 for(const name of ['public.app_profiles','private.worker_execution_mode_choices','private.worker_ai_reviews','private.worker_ai_saves',
  'private.work_taxonomy_categories','private.work_taxonomy_aliases','private.work_taxonomy_category_modes',
  'private.work_taxonomy_worker_capabilities','private.taxonomy_confirmed_worker_modes_v1',
  'private.work_taxonomy_worker_bindings_v1','private.work_taxonomy_review_batches_v1'])await db.exec(tableSql(name));
 for(const name of ['private.taxonomy_normalize_v1','private.taxonomy_handoff_valid_v1','public.rpc_get_worker_execution_modes'])await db.exec(sqlFunction(name));
 await db.exec(`REVOKE ALL ON FUNCTION public.rpc_get_worker_execution_modes(uuid) FROM PUBLIC,anon,service_role;
 GRANT EXECUTE ON FUNCTION public.rpc_get_worker_execution_modes(uuid) TO authenticated,service_role;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 SELECT set_config('uskoci.f10.disposable','LOCAL_ONLY',false);`);
 if(patched&&!process.env.F10_PROOF_UNPATCHED)await db.exec(candidate);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[owner]);
 await db.query(`INSERT INTO public.app_profiles(id,account_id,kind,display_name,skills,profile_status)
 VALUES($1,$2,'WORKER','Mila',ARRAY['Logotip','Popravka računara'],'ACTIVE')`,[profile,owner]);
 await db.query(`INSERT INTO private.worker_execution_mode_choices(worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES($1,$2,ARRAY['ON_SITE','REMOTE'],'EXPLICIT_PROFILE_REVIEW',$3,$3)`,[profile,owner,boundAt]);
 await db.query(`INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES($1,'logotip','Logotip','ESTABLISHED','CURATED',1),($2,'popravka racunara','Popravka računara','ESTABLISHED','CURATED',1)`,[logo,repair]);
 await db.query(`INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES($1,'REMOTE','fixture'),($2,'REMOTE','fixture'),($2,'ON_SITE','fixture')`,[logo,repair]);
 return db;
}
async function save(db,{review=id(10),request=id(11),time=at,skills=['Logotip','Popravka računara'],
 modes=[{service:'Logotip',mode:'REMOTE'},{service:'Popravka računara',mode:'REMOTE',handoff}],state='READY',account=owner}={}){
 const plans=modes.map(m=>({...m,action:'REUSE_EXISTING',categoryId:m.service==='Logotip'?logo:repair,catalogVersion:1,reason:'Explicit choice'}));
 const envelope={reviewId:review,accountId:account,profileId:profile,canAccept:true,classificationState:state,
  profile:{skills},reviewedServiceModes:modes.map(({service,mode})=>({service,mode})),classificationCandidates:plans};
 await db.query(`INSERT INTO private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,created_at,expires_at)
 SELECT $1,$2,$3,1,'base',e||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
 (e||jsonb_build_object('baseHash','base'))::text,'sha256'),'hex')),$5::timestamptz-interval '1 minute',$5::timestamptz+interval '15 minutes'
 FROM (SELECT $4::jsonb e) x`,[review,account,conversation,JSON.stringify(envelope),time]);
 await db.query(`INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,receipt,created_at)
 VALUES($1,$2,$3,jsonb_build_object('reviewId',$1::uuid::text,'accountId',$2::uuid::text,'profileId',$4::text,'saved',true,'authoritative',true,'profileStatus','ACTIVE'),$5)`,
 [review,account,request,profile,time]);
 return {review,request,modes,account};
}
async function bind(db,entry){
 const {review,request,modes,account}=entry;
 await db.query(`INSERT INTO private.work_taxonomy_worker_bindings_v1(owner_account_id,request_key,source_review_id,profile_id,catalog_version,result,bound_at)
 VALUES($1,$2,$3,$4,1,jsonb_build_object('status','BOUND_WORKER_SERVICES','workerProfileId',$4::uuid::text,'serviceModeCount',$5::int),$6)`,[account,request,review,profile,modes.length,boundAt]);
 await db.query(`INSERT INTO private.work_taxonomy_review_batches_v1(owner_account_id,request_key,purpose,source_review_id,review_digest,plans_digest,plans,catalog_version,result)
 SELECT $1,$2,'WORKER_CAPABILITY',$3,envelope->>'displayedContentDigest','fixture',envelope->'classificationCandidates',1,
 jsonb_build_object('status','COMMITTED','requiresBinding',true,'items',envelope->'classificationCandidates')
 FROM private.worker_ai_reviews WHERE id=$3`,[account,request,review]);
 for(const m of modes){
  const category=m.service==='Logotip'?logo:repair;
  await db.query(`INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,updated_at,allow_related_offers,excluded,origin)
   VALUES($1,$2,$3,$3,false,false,'WORKER_CONFIRMED') ON CONFLICT(worker_account_id,category_id) DO NOTHING`,[account,category,boundAt]);
  await db.query(`INSERT INTO private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,execution_scope,source_review_id,source_request_key,confirmed_at,active,handoff)
   VALUES($1,$2,$3,$4,$5,$6,true,$7)`,[account,category,m.mode,review,request,boundAt,m.handoff?JSON.stringify(m.handoff):null]);
 }
}
async function read(db,profileId=profile){
 await db.exec('SET ROLE authenticated');
 try{return (await db.query('SELECT public.rpc_get_worker_execution_modes($1) AS receipt',[profileId])).rows[0].receipt;}
 finally{await db.exec('RESET ROLE');}
}
const details=receipt=>JSON.parse(JSON.stringify(decode(receipt,profile).services));
test('actual owned reader → mobile decoder preserves each saved mode and physical handoff, without an AI session',async t=>{
 const db=await setup(t),entry=await save(db,{modes:[{service:'Logotip',mode:'REMOTE'},
  {service:'Popravka računara',mode:'ON_SITE'},{service:'Popravka računara',mode:'REMOTE',handoff}]});await bind(db,entry);
 const result=await read(db);
 assert.equal(result.servicesVersion,'WORKER_SAVED_SERVICES_V1');
 assert.deepEqual(details(result),[
  {service:'Logotip',status:'CONFIRMED',modes:[{mode:'REMOTE',status:'CONFIRMED',handoff:null}]},
  {service:'Popravka računara',status:'CONFIRMED',modes:[{mode:'ON_SITE',status:'CONFIRMED',handoff:null},{mode:'REMOTE',status:'CONFIRMED',handoff}]}]);
 assert.deepEqual(result.modes,['ON_SITE','REMOTE']);assert.equal(result.matchingAuthority,'NONE');
});
test('saved first review stays pending before binding; ACTIVE/global choices cannot confirm a service',async t=>{
 const db=await setup(t);await save(db);
 assert.deepEqual(details(await read(db)).map(s=>s.status),['PENDING','PENDING']);
 assert.deepEqual(details(await read(db))[1].modes,[{mode:'REMOTE',status:'PENDING',handoff}]);
});
test('a later pending addition preserves an independent old confirmed service',async t=>{
 const db=await setup(t);await bind(db,await save(db,{skills:['Logotip'],modes:[{service:'Logotip',mode:'REMOTE'}]}));
 await save(db,{review:id(20),request:id(21),time:'2026-10-30T12:05:00Z',modes:[],state:'PENDING_CLASSIFICATION'});
 const result=details(await read(db));assert.equal(result[0].status,'CONFIRMED');
 assert.deepEqual(result[1],{service:'Popravka računara',status:'PENDING',modes:[]});
});
test('a changed handoff remains pending beside the old bound choice until its own binding exists',async t=>{
 const db=await setup(t);await bind(db,await save(db));
 const nextHandoff={required:true,shippingCountries:['RS']};
 await save(db,{review:id(20),request:id(21),time:'2026-10-30T12:05:00Z',modes:[
  {service:'Logotip',mode:'REMOTE'},{service:'Popravka računara',mode:'REMOTE',handoff:nextHandoff}]});
 const service=details(await read(db))[1];assert.equal(service.status,'PENDING');
 assert.deepEqual(service.modes,[{mode:'REMOTE',status:'CONFIRMED',handoff},{mode:'REMOTE',status:'PENDING',handoff:nextHandoff}]);
});
test('BOTH is not fully confirmed when one current service mode is withdrawn',async t=>{
 const db=await setup(t);await bind(db,await save(db,{modes:[{service:'Logotip',mode:'REMOTE'},
  {service:'Popravka računara',mode:'ON_SITE'},{service:'Popravka računara',mode:'REMOTE',handoff}]}));
 await db.query(`UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id=$1 AND execution_scope='ON_SITE'`,[repair]);
 const service=details(await read(db))[1];assert.equal(service.status,'UNCONFIRMED');
 assert.deepEqual(service.modes.map(m=>[m.mode,m.status]),[['ON_SITE','UNCONFIRMED'],['REMOTE','CONFIRMED']]);
});
test('Save without activation has saved pending details and no fabricated global consent',async t=>{
 const db=await setup(t);await save(db);
 await db.exec(`UPDATE public.app_profiles SET profile_status='DRAFT';
 UPDATE private.worker_ai_saves SET receipt=jsonb_set(receipt,'{profileStatus}','"DRAFT"'::jsonb);
 DELETE FROM private.worker_execution_mode_choices;`);
 const receipt=await read(db);assert.equal(receipt.confirmed,false);assert.deepEqual(receipt.modes,[]);
 assert.deepEqual(details(receipt).map(s=>s.status),['PENDING','PENDING']);
});
test('unconfirmed/unsaved modes are never inferred from global flags, names or an unaccepted review',async t=>{
 const db=await setup(t);const entry=await save(db);await db.query('DELETE FROM private.worker_ai_saves WHERE review_id=$1',[entry.review]);
 assert.deepEqual(details(await read(db)),['Logotip','Popravka računara'].map(service=>({service,status:'UNCONFIRMED',modes:[]})));
});
for(const [name,sql] of [
 ['excluded capability',`UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE category_id='${repair}'`],
 ['withdrawn mode',`UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id='${repair}'`],
 ['withdrawn global preference',`UPDATE private.worker_execution_mode_choices SET modes=ARRAY['ON_SITE'],updated_at=now()`],
 ['missing binding',`DELETE FROM private.work_taxonomy_worker_bindings_v1`],
 ['incomplete binding receipt',`UPDATE private.work_taxonomy_worker_bindings_v1 SET result=jsonb_set(result,'{serviceModeCount}','1'::jsonb)`],
 ['incomplete admitted items',`UPDATE private.work_taxonomy_review_batches_v1 SET result=jsonb_set(result,'{items}',(result->'items')-0)`],
 ['mismatched bound request',`UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_request_key='${id(88)}' WHERE category_id='${repair}'`],
 ['changed digest',`UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{profile,skills}','["Logotip"]'::jsonb)`],
 ['handoff changed after binding',`UPDATE private.taxonomy_confirmed_worker_modes_v1 SET handoff='{"required":false}'::jsonb WHERE category_id='${repair}'`],
 ['ambiguous category',`INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version) VALUES('${id(70)}','different','Other','ESTABLISHED','CURATED',1);
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES('${id(70)}','sr','Popravka računara')`],
])test(name+' cannot claim confirmed saved service',async t=>{
 const db=await setup(t);await bind(db,await save(db));await db.exec(sql);
 assert.notEqual(details(await read(db)).find(s=>s.service==='Popravka računara').status,'CONFIRMED');
});
test('a removed skill stays removed, and a stale later review without Save is ignored',async t=>{
 const db=await setup(t);await bind(db,await save(db));
 const unsaved=await save(db,{review:id(30),request:id(31),time:'2026-10-30T12:10:00Z',modes:[],state:'PENDING_CLASSIFICATION'});
 await db.query('DELETE FROM private.worker_ai_saves WHERE review_id=$1',[unsaved.review]);
 assert.deepEqual(details(await read(db)).map(s=>s.status),['CONFIRMED','CONFIRMED']);
 await db.query(`UPDATE public.app_profiles SET skills=ARRAY['Logotip'] WHERE id=$1`,[profile]);
 assert.deepEqual(details(await read(db)).map(s=>s.service),['Logotip']);
});
test('owner isolation and ACL survive the additive reader replacement',async t=>{
 const db=await setup(t);await bind(db,await save(db));
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[other]);
 await assert.rejects(read(db),/WORKER_PROFILE_NOT_OWNED/);
 await db.exec(`SELECT set_config('request.jwt.claim.sub','',false)`);
 await assert.rejects(read(db),/AUTH_REQUIRED/);
 const acl=(await db.query(`SELECT has_function_privilege('anon','public.rpc_get_worker_execution_modes(uuid)','EXECUTE') AS anon,
 has_function_privilege('service_role','public.rpc_get_worker_execution_modes(uuid)','EXECUTE') AS service,
 has_function_privilege('authenticated','public.rpc_get_worker_execution_modes(uuid)','EXECUTE') AS own`)).rows[0];
 assert.deepEqual(acl,{anon:false,service:true,own:true});
});
test('old reader remains compatible but provides no fabricated per-service data',async t=>{
 const db=await setup(t,{patched:false});assert.equal(decode(await read(db),profile).services,undefined);
});
test('candidate refuses a changed predecessor before replacing the reader',async t=>{
 const db=await setup(t,{patched:false});await db.exec(`CREATE OR REPLACE FUNCTION private.taxonomy_normalize_v1(p_value text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT lower($1) $f$;`);
 await assert.rejects(db.exec(candidate),/F10_PREDECESSOR_DRIFT/);await db.exec('ROLLBACK');
 assert.equal((await read(db)).servicesVersion,undefined);
});
