// Bounded SQL integration: actual captured prepare/Save/batch/binder and current
// opener/document bodies. Reuses R08's domain fixture; no Auth HTTP, RLS, DEV or
// native claim. Calendar/location/closure and account lineage remain substitutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const proof=new URL('./r08_remote_only_activation.test.mjs',import.meta.url);
const text=readFileSync(proof,'utf8');
const marker="test('baseline reproduces both first-save blockers;";
let fixture=text.slice(0,text.indexOf(marker)).replaceAll('import.meta.url',JSON.stringify(proof.href));
for(const name of ['@electric-sql/pglite','@electric-sql/pglite/contrib/pgcrypto','typescript'])
 fixture=fixture.replaceAll(`from '${name}'`,'from '+JSON.stringify(import.meta.resolve(name)));
fixture+='\nexport {setup,tableSql,prepare,save,bind,makeNeed,id,owner,other,remote,profile,conversation,request,need,mobileDecoder};';
const {setup,tableSql,prepare,save,bind,makeNeed,id,owner,other,remote,profile,need,mobileDecoder}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const chain=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/chain-dependencies.json',import.meta.url),'utf8'));
const deps=JSON.parse(readFileSync(new URL('./r08_application_service_dependencies.json',import.meta.url),'utf8'));
const pre=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/preimage.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('./r08_application_service_review_candidate.sql',import.meta.url),'utf8');
const response=id(40),added=id(41);
const read=(db,prepare=false,account=owner)=>db.query('SELECT public.rpc_worker_service_from_application($1,$2,$3,$4) result',[account,response,profile,prepare]).then(r=>r.rows[0].result);
const count=async(db,table)=>(await db.query('SELECT count(*)::int n FROM '+table)).rows[0].n;
test('captured application-service dependencies retain exact hashes',()=>{
 for(const f of deps.functions)assert.equal(createHash('md5').update(f.definition).digest('hex'),f.md5,f.name);
});
async function currentSetup(t){
 const db=await setup(t);
 for(const name of ['public.ai_messages','public.need_requirement_details','private.work_taxonomy_need_bindings_v1',
  'private.work_taxonomy_related_acceptances','private.work_taxonomy_risk_rules','private.work_taxonomy_audit'])await db.exec(tableSql(name));
 await db.exec(`CREATE FUNCTION private.closure_taxonomy_profile_erasing_v1(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION private.account_visibility_world(uuid) RETURNS text LANGUAGE sql STABLE AS $$SELECT CASE WHEN current_setting('test.foreign_world',true)=$1::text THEN 'REAL' ELSE 'TEST' END$$;`);
 for(const name of ['private.accounts_same_world','private.taxonomy_category_path_valid_v1','private.worker_ai_turn_document','private.worker_ai_document','public.rpc_open_worker_ai'])
  await db.exec(deps.functions.find(f=>f.name===name).definition+';');
 for(const name of ['private.worker_ai_service_mode_context_v1','private.taxonomy_review_candidate_projection_v2','private.worker_remote_review_ready_v1','private.taxonomy_risk_triage_v1'])
  await db.exec(pre.functions.find(f=>f.name===name).definition+';');
 for(const f of chain.functions)await db.exec(f.definition+';');
 await db.exec(candidate);
 const initial=await prepare(db);await save(db,initial);await bind(db,initial);
 await db.query("INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version) VALUES($1,'prevodjenje','Prevođenje','ESTABLISHED','CURATED',1)",[added]);
 await db.query("INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES($1,'REMOTE','fixture')",[added]);
 await makeNeed(db);await db.query("UPDATE public.needs SET category='Prevođenje',category_id=$1 WHERE id=$2",[added,need]);
 await db.query('UPDATE private.work_taxonomy_need_snapshots SET category_id=$1 WHERE need_id=$2',[added,need]);
 await db.query("INSERT INTO private.work_taxonomy_need_bindings_v1 VALUES($1,$2,$3,$4,1,$5,1,'{}',now())",[other,id(42),id(43),need,added]);
 await db.query(`INSERT INTO public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
 submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
 VALUES($1,$2,$3,$4,'OFFER','SUBMITTED',1,1,1,1000,now())`,[response,need,owner,profile]);
 return db;
}

test('known task service prepares once, preserves prior capabilities, and becomes confirmed only after the real binder',async t=>{
 const db=await currentSetup(t),before=await count(db,'private.worker_ai_sessions');
 assert.equal((await read(db)).state,'NONE');assert.equal(await count(db,'private.worker_ai_sessions'),before);
 const result=await read(db,true);assert.equal(result.state,'READY');assert.equal(result.categoryId,added);
 assert.deepEqual(result.review.profile.skills,['Logotip','Prevođenje']);
 assert.deepEqual(result.review.classificationCandidates.map(p=>p.categoryId).sort(),[remote,added].sort());
 const decoded=mobileDecoder().decodeWorkerAiReview(result.review,owner,result.review.conversationId);
 assert.ok(decoded,'actual mobile review decoder accepts SQL envelope');
 assert.deepEqual(await read(db,true),result,'repeated prepare reuses immutable review');
 assert.deepEqual(await read(db),result);
 assert.equal(await count(db,'private.worker_ai_sessions'),before+1);
 const receipt=await save(db,result.review,response);assert.equal(receipt.authoritative,true);
 assert.equal((await read(db)).state,'SAVED');
 await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 await db.query("SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4)",[owner,response,result.review.reviewId,result.review.classificationCandidates]);
 await db.query('SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4)',[owner,response,result.review.reviewId,profile]);
 await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");
 assert.equal((await read(db)).state,'CONFIRMED');
 assert.deepEqual(await save(db,result.review,response),receipt);
 assert.deepEqual((await db.query('SELECT category_id FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active ORDER BY category_id')).rows.map(r=>r.category_id),[remote,added].sort());
 await db.query("UPDATE public.app_profiles SET skills=ARRAY['Logotip'] WHERE id=$1",[profile]);
 assert.notEqual((await read(db)).state,'CONFIRMED','later removal must not keep a false added receipt');
});

test('wrong owner, foreign TEST/REAL world, changed task and withdrawn offer cannot prepare a profile update',async t=>{
 const db=await currentSetup(t),before=await count(db,'private.worker_ai_sessions');
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query(
  "SELECT has_function_privilege($1,'public.rpc_worker_service_from_application(uuid,uuid,uuid,boolean)','EXECUTE') allowed",[role])).rows[0].allowed,role==='authenticated');
 await assert.rejects(read(db,true,other),/AUTH_ACCOUNT_CHANGED/);
 await db.query("SELECT set_config('test.foreign_world',$1,false)",[other]);
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_DENIED/);
 await db.exec("SELECT set_config('test.foreign_world','',false)");
 await db.query('UPDATE public.needs SET revision=2 WHERE id=$1',[need]);
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_TASK_CHANGED/);
 await db.query('UPDATE public.needs SET revision=1 WHERE id=$1',[need]);
 await db.query('UPDATE public.marketplace_responses SET withdrawn_at=now() WHERE id=$1',[response]);
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_TASK_CHANGED/);
 assert.equal(await count(db,'private.worker_ai_sessions'),before);
 assert.deepEqual((await db.query('SELECT skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0].skills,['Logotip']);
});

test('expired or task-stale preparation never silently saves and a fresh prepare preserves the same category',async t=>{
 const db=await currentSetup(t),ready=await read(db,true),saved=await count(db,'private.worker_ai_saves');
 await db.query('UPDATE public.needs SET revision=2 WHERE id=$1',[need]);
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_TASK_CHANGED/);
 await db.query('UPDATE public.needs SET revision=1 WHERE id=$1',[need]);
 await db.query("UPDATE private.worker_ai_reviews SET expires_at=now()-interval '1 minute' WHERE id=$1",[ready.review.reviewId]);
 assert.equal((await read(db)).state,'EXPIRED');
 const refreshed=await read(db,true);assert.equal(refreshed.state,'READY');assert.equal(refreshed.categoryId,added);
 assert.notEqual(refreshed.review.reviewId,ready.review.reviewId);
 assert.equal(await count(db,'private.worker_ai_saves'),saved,'only the original profile is saved before explicit opt-in Save');
});

test('existing ordinary profile draft is preserved and ON_SITE needs a real area',async t=>{
 const db=await currentSetup(t);
 const doc=(await db.query('SELECT public.rpc_open_worker_ai($1) doc',[id(80)])).rows[0].doc;
 const before=(await db.query('SELECT * FROM private.worker_ai_sessions WHERE conversation_id=$1',[doc.conversationId])).rows[0];
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_PROFILE_DRAFT_OPEN/);
 assert.deepEqual((await db.query('SELECT * FROM private.worker_ai_sessions WHERE conversation_id=$1',[doc.conversationId])).rows[0],before);
 await db.query("UPDATE public.ai_conversations SET status='SAVED' WHERE id=$1",[doc.conversationId]);
 await db.query("UPDATE public.needs SET execution_location_mode='STATIONARY' WHERE id=$1",[need]);
 await db.query("INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES($1,'ON_SITE','fixture')",[added]);
 const sessions=await count(db,'private.worker_ai_sessions');
 await assert.rejects(read(db,true),/APPLICATION_SERVICE_AREA_REQUIRED/);
 assert.equal(await count(db,'private.worker_ai_sessions'),sessions,'rejected addition leaves no empty new draft');
 assert.deepEqual((await db.query('SELECT city,skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0],{city:'',skills:['Logotip']});
});
