// Current DEV reader definitions + the complete catalog candidate. No hosted
// writes, provider, Auth/HTTP or native claims. Reuse the existing R08 fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=new URL('./r08_remote_only_activation.test.mjs',import.meta.url);
const text=readFileSync(proof,'utf8');
const marker="test('baseline reproduces both first-save blockers;";
let fixture=text.slice(0,text.indexOf(marker)).replaceAll('import.meta.url',JSON.stringify(proof.href));
for(const name of ['@electric-sql/pglite','@electric-sql/pglite/contrib/pgcrypto','typescript'])
 fixture=fixture.replaceAll(`from '${name}'`,'from '+JSON.stringify(import.meta.resolve(name)));
fixture+='\nexport {setup,tableSql,sqlFunction,prepare,save,bind,makeNeed,owner,remote,profile,conversation,need};';
const {setup,tableSql,sqlFunction,prepare,save,bind,makeNeed,owner,remote,profile,conversation,need}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const pre=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/preimage.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('./r04_turn_catalog_resolution_candidate.sql',import.meta.url),'utf8');
const chain=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/chain-dependencies.json',import.meta.url),'utf8'));
async function currentSetup(t){
 const db=await setup(t);
 for(const name of ['private.work_taxonomy_risk_rules','private.work_taxonomy_audit'])await db.exec(tableSql(name));
 await db.exec(sqlFunction('private.taxonomy_category_path_valid_v1'));
 const names=['private.taxonomy_review_candidate_projection_v2','private.worker_remote_review_ready_v1',
  'private.worker_ai_service_mode_context_v1','public.rpc_prepare_worker_ai_review_taxonomy',
  'public.rpc_prepare_worker_ai_review_taxonomy_confirmed','private.closure_taxonomy_inventory_v1',
  'private.closure_taxonomy_project_v1','private.closure_taxonomy_reset_sections_v1','private.taxonomy_risk_triage_v1'];
 await db.exec('SET check_function_bodies=false');
 for(const name of names)await db.exec(pre.functions.find(f=>f.name===name).definition+';');
 await db.exec("SELECT set_config('uskoci.r06_first_plan.disposable','LOCAL_ONLY',false)");
 await db.exec(candidate);
 await db.exec('SET check_function_bodies=true');
 return db;
}
test('complete candidate patches exact DEV readers and keeps semantic ID through worker review',async t=>{
 const db=await currentSetup(t);
 const row=(await db.query('SELECT id,proposals FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE conversation_id=$1',[conversation])).rows[0];
 assert.ok(row);
 const anchor=(await db.query('SELECT id AS "categoryId",label,parent_id AS "parentId" FROM private.work_taxonomy_categories WHERE id=$1',[remote])).rows[0];
 await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const result=(await db.query("SELECT private.taxonomy_resolve_turn_catalog_v1($1,repeat('a',64),$2,'ALLOW') result",[row.id,[anchor]])).rows[0].result;
 assert.equal(result.state,'RESOLVED');assert.equal(result.items[0].categoryId,remote);
 await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");
 const review=await prepare(db);assert.equal(review.classificationState,'READY');
 assert.equal(review.classificationCandidates[0].categoryId,remote);
 // A different service changing the catalog version cannot invalidate this ID.
 await db.exec('UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1 WHERE singleton');
 const rebased=await prepare(db);assert.equal(rebased.classificationState,'READY');
 assert.equal(rebased.classificationCandidates[0].categoryId,remote);
 assert.equal(rebased.classificationCandidates[0].catalogVersion,2);
 await db.query("UPDATE private.work_taxonomy_categories SET label='Different meaning' WHERE id=$1",[remote]);
 const changed=await prepare(db);assert.notEqual(changed.classificationState,'READY');assert.equal(changed.canAccept,false);
 await db.query('UPDATE private.work_taxonomy_categories SET label=$2 WHERE id=$1',[remote,anchor.label]);
 await db.query("UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=jsonb_build_object('state','DEFERRED','code','CATALOG_CHANGED','inputDigest',repeat('a',64)) WHERE id=$1",[row.id]);
 const deferred=await prepare(db);assert.notEqual(deferred.classificationState,'READY');assert.equal(deferred.canAccept,false);
 // An exact name is not permission to bypass the failed owned resolution.
 assert.equal(deferred.classificationCandidates.length,0);
});

// Current hosted Save/batch/binder/sync bodies are used unchanged. Closure
// lifecycle and downstream location/calendar remain explicit fixture boundaries;
// this proves the category-to-capability SQL chain, not Auth/HTTP/native or release.
for(const service of ['Logotip','Dizajn znaka za firmu','Digitalna obrada arhiva'])test(`single response preserves ${service} ID through Save, activation, binding, matching and removal`,async t=>{
 const db=await currentSetup(t);
 await db.exec(tableSql('private.work_taxonomy_related_acceptances'));
 await db.exec(`CREATE FUNCTION private.closure_taxonomy_profile_erasing_v1(uuid) RETURNS boolean LANGUAGE sql AS $f$SELECT false$f$`);
 for(const f of chain.functions)await db.exec(f.definition+';');
 await db.exec(`CREATE TRIGGER worker_profile_sync_taxonomy_capabilities_trg AFTER INSERT OR UPDATE OF skills ON public.app_profiles FOR EACH ROW WHEN ((new.kind = 'WORKER'::text)) EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn()`);
 await db.query(`UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',jsonb_build_array($1::text))`,[service]);
 await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET proposals=jsonb_set(proposals,'{0,service}',to_jsonb($1::text)),
 source_fingerprint=encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
 FROM private.worker_ai_sessions s WHERE s.conversation_id=h.conversation_id`,[service]);
 const hint=(await db.query('SELECT id FROM private.work_taxonomy_gemini_turn_hints_v1')).rows[0];
 const createsBranch=service==='Digitalna obrada arhiva';
 if(createsBranch)await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=jsonb_build_array(jsonb_build_object(
 'action','CREATE_NEW_BRANCH','service',$1::text,'mode','REMOTE','categoryId','','parentId','',
 'proposedPath',jsonb_build_array('Arhiviranje',$1::text),'reason','Novi posao iz izričitog opisa korisnika.','catalogVersion',1,'handoff',jsonb_build_object('required',false)))`,[service]);
 const anchor=(await db.query('SELECT id AS "categoryId",label,parent_id AS "parentId" FROM private.work_taxonomy_categories WHERE id=$1',[remote])).rows[0];
 await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const resolved=(await db.query("SELECT private.taxonomy_resolve_turn_catalog_v1($1,repeat('a',64),$2,'ALLOW') result",[hint.id,createsBranch?[]:[anchor]])).rows[0].result;
 assert.equal(resolved.state,'RESOLVED');
 const target=resolved.items[0].categoryId;
 if(createsBranch){
  assert.notEqual(target,remote);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_worker_capabilities')).rows[0].n,0);
  assert.equal((await db.query('SELECT parent.label FROM private.work_taxonomy_categories child JOIN private.work_taxonomy_categories parent ON parent.id=child.parent_id WHERE child.id=$1',[target])).rows[0].label,'Arhiviranje');
 }else assert.equal(target,remote);
 await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");
 const review=await prepare(db);assert.equal(review.canAccept,true);assert.equal(review.classificationState,'READY');
 assert.equal(review.classificationCandidates[0].categoryId,target);
 assert.equal(review.classificationCandidates[0].service,service);
 const receipt=await save(db,review);assert.equal(receipt.profileStatus,'ACTIVE');assert.equal(receipt.authoritative,true);
 assert.deepEqual(await save(db,review),receipt);
 const ready=()=>db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2) ready',[owner,[service]]).then(r=>r.rows[0].ready);
 assert.equal(await ready(),false,'Save is not a capability binder');
 const bound=await bind(db,review);assert.equal(bound.status,'BOUND_WORKER_SERVICES');assert.equal(await ready(),true);
 const sync=(await db.query('SELECT private.sync_worker_skills_to_taxonomy_capabilities($1,$2) result',[owner,[service]])).rows[0].result;
 assert.equal(sync.revokedCount,0);assert.deepEqual(sync.retainedExistingCategoryIds,[target]);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_aliases')).rows[0].n,0,'Natural wording is not a global alias');
 assert.deepEqual((await db.query('SELECT city,profile_status,skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0],{city:'',profile_status:'ACTIVE',skills:[service]});
 await makeNeed(db);
 if(createsBranch){
  await db.query('UPDATE public.needs SET category=$1,category_id=$2 WHERE id=$3',[service,target,need]);
  await db.query('UPDATE private.work_taxonomy_need_snapshots SET category_id=$1 WHERE need_id=$2',[target,need]);
 }
 assert.equal((await db.query('SELECT private.worker_need_fit_v1($1,$2,true) fit',[need,profile])).rows[0].fit.matches,true);
 await db.query('UPDATE public.app_profiles SET skills=ARRAY[]::text[] WHERE id=$1',[profile]);
 assert.equal((await db.query('SELECT excluded FROM private.work_taxonomy_worker_capabilities WHERE category_id=$1',[target])).rows[0].excluded,true);
 assert.equal(await ready(),false);
 assert.equal((await db.query('SELECT private.worker_need_fit_v1($1,$2,true) fit',[need,profile])).rows[0].fit.matches,false);
});
