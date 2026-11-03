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
fixture+='\nexport {setup,tableSql,sqlFunction,prepare,owner,remote,conversation};';
const {setup,tableSql,sqlFunction,prepare,owner,remote,conversation}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const pre=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/preimage.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('./r04_turn_catalog_resolution_candidate.sql',import.meta.url),'utf8');
test('complete candidate patches exact DEV readers and keeps semantic ID through worker review',async t=>{
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
