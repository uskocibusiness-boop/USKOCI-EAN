// R08 local SQL integration, not DEV/Auth HTTP/Android acceptance. Exact captured
// prepare/save/projection/binder bodies run in PGlite with real pgcrypto. The narrow
// fixture omits RLS and PostGIS; closure, requeue transport and downstream calendar
// matching are explicit substitutes. No capability/mode writer is substituted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const source=readFileSync(new URL('../../candidates/r08_remote_only_activation.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const id=n=>'00000000-0038-4338-8338-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),remote=id(3),local=id(4),profile=id(5),conversation=id(6),request=id(7),need=id(8);
const sqlFunction=name=>{
 const start=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');assert.ok(start>=0,name);
 const marker=snapshot.indexOf('AS $function$',start),end=snapshot.indexOf('$function$;',marker+13);
 assert.ok(marker>start&&end>marker,name);return snapshot.slice(start,end+11);
};
const tableNames=[
 'public.app_profiles','public.ai_conversations','public.profile_availability_rules','public.profile_availability_windows',
 'private.worker_ai_sessions','private.worker_ai_reviews','private.worker_ai_saves','private.worker_ai_turns',
 'private.work_taxonomy_categories','private.work_taxonomy_aliases','private.work_taxonomy_category_modes',
 'private.work_taxonomy_control','private.work_taxonomy_worker_capabilities','private.taxonomy_confirmed_worker_modes_v1',
 'private.work_taxonomy_worker_bindings_v1','private.work_taxonomy_review_batches_v1','private.worker_execution_mode_choices',
 'private.work_taxonomy_gemini_turn_hints_v1','private.work_taxonomy_review_outbox_control_v1','private.work_taxonomy_review_outbox_v1',
 'private.work_taxonomy_pending_control_v1','private.work_taxonomy_pending_reviews_v1','private.taxonomy_match_scope_control_v1',
 'private.work_taxonomy_need_snapshots','public.marketplace_responses','public.marketplace_response_versions',
 'private.response_submit_commands','private.selection_commands','private.connection_policy_versions',
 'public.need_selections','public.agreements','public.agreement_versions',
];
function tableSql(name){
 const quoted=name.split('.').map(x=>'"'+x+'"').join('.');
 const start=snapshot.indexOf('CREATE TABLE '+quoted+' (');assert.ok(start>=0,name);
 const end=snapshot.indexOf('\n);',start);assert.ok(end>start);
 const changes=snapshot.split('\n').filter(line=>line.startsWith('ALTER TABLE '+quoted+' ')
  && (line.includes(' SET DEFAULT ')||/ ADD CONSTRAINT .* (PRIMARY KEY|UNIQUE) /.test(line)));
 return snapshot.slice(start,end+3)+'\n'+changes.join('\n');
}
const functions=[
 'private.taxonomy_normalize_v1','private.taxonomy_admission_fingerprint_v1','private.taxonomy_handoff_valid_v1',
 'private.taxonomy_review_exact_projection_v1','private.taxonomy_review_candidate_projection_v2',
 'private.worker_location_document','private.worker_availability_document','private.worker_capacity_document',
 'private.worker_saved_areas_v1','private.worker_ai_source','private.worker_ai_source_hash','private.worker_ai_initial',
 'private.availability_timezone_valid','private.normalize_worker_ai_availability','public.rpc_save_worker_availability',
 'private.worker_ai_service_mode_context_v1','private.taxonomy_preserve_review_handoff_v1',
 'public.rpc_complete_worker_profile','public.rpc_prepare_worker_ai_review_taxonomy',
 'public.rpc_prepare_worker_ai_review_taxonomy_confirmed','public.rpc_save_worker_ai_review',
 'private.taxonomy_queue_review_after_save_v1','private.taxonomy_pending_saved_event_v1','private.worker_ai_area_source_continuity_v1',
 'public.rpc_taxonomy_commit_reviewed_batch_service','public.rpc_taxonomy_bind_reviewed_worker_service',
 'private.taxonomy_scope_eligible_v1','private.worker_need_fit_v1','private.lower_arr','private.work_kinds_v5','public.rpc_submit_response','public.rpc_select_response',
];
async function setup(t,{patched=true}={}){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;
 CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('role',current_setting('request.jwt.claim.role',true)) $f$;
 CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $f$
 BEGIN IF current_setting('test.closure',true)='closed' THEN RAISE EXCEPTION 'ACCOUNT_CLOSED'; END IF;END $f$;
 CREATE TABLE private.requeue_events(account_id uuid,status text,saved_count integer);
 CREATE TABLE public.worker_match_preferences(worker_profile_id uuid PRIMARY KEY,worker_account_id uuid,
 timezone text,approximate_lat numeric,approximate_lng numeric);
 CREATE TABLE public.needs(id uuid PRIMARY KEY,requester_account_id uuid,requester_profile_id uuid,status text,
 title text,description text,category text,category_id uuid,revision integer,execution_location_mode text,
 task_country_code text,approximate_city text,approximate_lat numeric,approximate_lng numeric,
 required_skills text[],verified_identity_required boolean,required_slots integer,response_deadline timestamptz,
 schedule_kind text,starts_at timestamptz,ends_at timestamptz,mode text,requester_price_rsd integer);
 `);
 await db.exec(sqlFunction('private.taxonomy_normalize_v1'));
 for(const name of tableNames)await db.exec(tableSql(name));
 await db.exec(`CREATE FUNCTION private.requeue_open_needs_for_worker_v5(a uuid) RETURNS void LANGUAGE sql AS $f$
 INSERT INTO private.requeue_events SELECT a,profile_status,(SELECT count(*) FROM private.worker_ai_saves WHERE account_id=a)
 FROM public.app_profiles WHERE account_id=a AND kind='WORKER' $f$;
 CREATE FUNCTION public.rpc_save_worker_location(text,jsonb,boolean) RETURNS jsonb LANGUAGE plpgsql AS $f$
 BEGIN RAISE EXCEPTION 'UNEXPECTED_LOCATION_WRITE';END $f$;
 CREATE FUNCTION private.accounts_same_world(uuid,uuid) RETURNS boolean LANGUAGE sql AS $f$SELECT true$f$;
 CREATE FUNCTION private.identity_admitted(uuid) RETURNS boolean LANGUAGE sql AS $f$SELECT false$f$;
 CREATE FUNCTION private.need_search_time_admitted_v1(uuid,timestamptz) RETURNS boolean LANGUAGE sql AS $f$SELECT true$f$;
 CREATE FUNCTION private.effective_radius_km(integer) RETURNS numeric LANGUAGE sql AS $f$SELECT 15::numeric$f$;
 CREATE FUNCTION private.taxonomy_handoff_fit_v1(uuid,uuid) RETURNS boolean LANGUAGE sql AS $f$SELECT true$f$;
 CREATE FUNCTION private.taxonomy_requirement_tier_inherited_v1(uuid,uuid) RETURNS text LANGUAGE sql AS $f$SELECT 'EXACT'::text$f$;
 CREATE FUNCTION private.worker_need_time_tier_v1(uuid,uuid) RETURNS integer LANGUAGE sql AS $f$SELECT 1$f$;
 CREATE FUNCTION private.assert_application_price_v5(public.needs,integer,integer) RETURNS void LANGUAGE plpgsql AS $f$BEGIN END$f$;
 CREATE FUNCTION private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $f$
 BEGIN RAISE EXCEPTION 'TEST_CALENDAR_BOUNDARY_REACHED';END$f$;
 `);
 for(const name of functions)await db.exec(sqlFunction(name));
 await db.exec(`CREATE TRIGGER taxonomy_enqueue_worker_saved_v1 AFTER INSERT ON private.worker_ai_saves
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_queue_review_after_save_v1();
 CREATE TRIGGER taxonomy_pending_worker_save_v1 AFTER INSERT ON private.worker_ai_saves
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_pending_saved_event_v1();
 CREATE TRIGGER worker_ai_area_source_continuity_v1 AFTER INSERT ON private.worker_ai_saves
 FOR EACH ROW EXECUTE FUNCTION private.worker_ai_area_source_continuity_v1();
 GRANT USAGE ON SCHEMA public,private,auth TO authenticated;
 `);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[owner]);
 await db.exec(`INSERT INTO private.work_taxonomy_control(singleton,catalog_version) VALUES(true,1);
 INSERT INTO private.work_taxonomy_review_outbox_control_v1(singleton,enabled) VALUES(true,true);
 INSERT INTO private.work_taxonomy_pending_control_v1(singleton,enabled) VALUES(true,true);
 INSERT INTO private.taxonomy_match_scope_control_v1(singleton,enabled) VALUES(true,false);`);
 await db.query(`INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES($1,'logotip','Logotip','ESTABLISHED','CURATED',1),($2,'krecenje','Krečenje','ESTABLISHED','CURATED',1)`,[remote,local]);
 await db.query("INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES($1,'REMOTE','fixture'),($2,'ON_SITE','fixture')",[remote,local]);
 await db.query("INSERT INTO public.ai_conversations(id,account_id,purpose,status) VALUES($1,$2,'PROFILE','OPEN')",[conversation,owner]);
 await db.query(`INSERT INTO private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate,revision,safety)
 VALUES($1,$2,$3,$4,private.worker_ai_source_hash($2),private.worker_ai_initial($2)||
 '{"displayName":"Mila","bio":"Izrada logotipa","skills":["Logotip"]}'::jsonb,1,'ALLOW')`,[conversation,owner,id(9),profile]);
 await db.query(`INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,client_request_id,turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
 SELECT account_id,conversation_id,open_request_id,gen_random_uuid(),gen_random_uuid(),repeat('a',64),'WORKER_CAPABILITY',encode(extensions.digest(convert_to(candidate::text||'|'||revision::text||'|'||base_hash,'UTF8'),'sha256'),'hex'),1,
 jsonb_build_array(jsonb_build_object('action','REUSE_EXISTING','service','Logotip','mode','REMOTE','categoryId',$1::text,'catalogVersion',1,'reason','Explicit remote logo service','handoff',jsonb_build_object('required',false)))
 FROM private.worker_ai_sessions`,[remote]);
 if(patched)await install(db);
 return db;
}
const install=async db=>{
 await db.exec("SELECT set_config('uskoci.r08.remote_only.disposable','LOCAL_ONLY',false)");
 await db.exec(source);
};
const prepare=(db,confirmed=false,activate=true)=>db.query(confirmed?
 'SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,$2,$3::jsonb) AS review':
 'SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,$2) AS review',
 confirmed?[conversation,activate,JSON.stringify([{service:'Logotip',mode:'REMOTE'}])]:[conversation,activate]).then(r=>r.rows[0].review);
const save=(db,r,key=request)=>db.query('SELECT public.rpc_save_worker_ai_review($1,$2,$3) AS receipt',[r.reviewId,r.displayedContentDigest,key]).then(r=>r.rows[0].receipt);
const durable=db=>db.query("SELECT private.worker_remote_only_activation_ready_v1($1,ARRAY['Logotip']) AS ready",[owner]).then(r=>r.rows[0].ready);
async function bind(db,r){
 await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const result=await db.query('SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,$3,$4,$5::jsonb) AS result',
 [owner,request,'WORKER_CAPABILITY',r.reviewId,JSON.stringify(r.classificationCandidates)]);
 assert.equal(result.rows[0].result.status,'COMMITTED');
 const bound=await db.query('SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4) AS result',[owner,request,r.reviewId,profile]);
 await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");return bound.rows[0].result;
}
async function makeNeed(db){
 await db.query(`INSERT INTO public.needs(id,requester_account_id,status,category,category_id,revision,execution_location_mode,
 required_skills,verified_identity_required,required_slots,schedule_kind,mode)
 VALUES($1,$2,'PUBLISHED','Logotip',$3,1,'REMOTE','{}',false,1,'FLEXIBLE','OFFERS')`,[need,other,remote]);
 await db.query(`INSERT INTO private.work_taxonomy_need_snapshots(need_id,need_revision,category_id,catalog_version,source,reviewed_by_requester,classification_state)
 VALUES($1,1,$2,1,'fixture',true,'CONFIRMED')`,[need,remote]);
}

test('baseline reproduces both first-save blockers; cached rejected review cannot survive patch',async t=>{
 const db=await setup(t,{patched:false});const before=await prepare(db);
 assert.equal(before.canAccept,false);assert.deepEqual(before.missingRequired,['Mesto rada']);
 await assert.rejects(save(db,before),/WORKER_AI_STALE/);
 // The baseline activation owner is independently city-bound, even with skills.
 await db.query("INSERT INTO public.app_profiles(id,account_id,kind,display_name,bio,skills) VALUES($1,$2,'WORKER','Mila','','{Logotip}')",[profile,owner]);
 await assert.rejects(db.query('SELECT public.rpc_complete_worker_profile($1)',[profile]),/CITY_REQUIRED/);
 await db.query('DELETE FROM public.app_profiles WHERE id=$1',[profile]);
 await install(db);const after=await prepare(db);
 assert.notEqual(after.reviewId,before.reviewId);assert.equal(after.canAccept,true);
 assert.equal((await save(db,after)).profileStatus,'ACTIVE');
});
for(const confirmed of [false,true])test(`actual ${confirmed?'explicit':'hint-bound'} prepare/save persists ACTIVE before outbox/binding without location`,async t=>{
 const db=await setup(t);await db.exec('SET ROLE authenticated');
 const r=await prepare(db,confirmed);assert.equal(r.canAccept,true);assert.deepEqual(r.missingRequired,[]);
 await db.exec("SELECT set_config('uskoci.profile_mutation','prior-context',false)");
 const receipt=await save(db,r);assert.equal(receipt.profileStatus,'ACTIVE');assert.equal(receipt.authoritative,true);
 assert.equal((await db.query("SELECT current_setting('uskoci.profile_mutation') token")).rows[0].token,'prior-context');
 await db.exec('RESET ROLE');
 const p=(await db.query('SELECT city,operating_country_code,profile_status FROM public.app_profiles WHERE id=$1',[profile])).rows[0];
 assert.deepEqual(p,{city:'',operating_country_code:null,profile_status:'ACTIVE'});
 assert.deepEqual((await db.query('SELECT status,saved_count FROM private.requeue_events')).rows,[{status:'ACTIVE',saved_count:0}]);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_review_outbox_v1')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.taxonomy_confirmed_worker_modes_v1')).rows[0].n,0);
 assert.equal(await durable(db),false);
 assert.deepEqual(await save(db,r),receipt);assert.deepEqual(await save(db,r,id(30)),receipt);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,1);
 assert.equal((await db.query('SELECT base_hash=private.worker_ai_source_hash(account_id) ok FROM private.worker_ai_sessions')).rows[0].ok,true);
 await makeNeed(db);
 for(const flag of [false,true]){
  await db.query('UPDATE private.taxonomy_match_scope_control_v1 SET enabled=$1',[flag]);
  const fit=(await db.query('SELECT private.worker_need_fit_v1($1,$2,true) fit',[need,profile])).rows[0].fit;
  assert.equal(fit.matches,false);assert.deepEqual(fit.hard,['SIGNED_SERVICE_SCOPE_REQUIRED']);
 }
 await assert.rejects(db.query('SELECT public.rpc_submit_response($1,1,$2,1,1000,NULL,NULL,\'\',\'response-0001\')',[need,profile]),/WORKER_PROFILE_NOT_READY/);
 const response=id(21);
 await db.query(`INSERT INTO public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
 submitted_against_need_revision,current_version,covered_slots,price_rsd)
 VALUES($1,$2,$3,$4,'OFFER','SUBMITTED',1,1,1,1000)`,[response,need,owner,profile]);
 await db.query(`INSERT INTO public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash)
 VALUES($1,1,1,1,1000,'','fixture-hash')`,[response]);
 const select=()=>db.query('SELECT public.rpc_select_response($1,1,$2,1,\'fixture-hash\',\'selection-0001\')',[need,response]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(select(),/WORKER_PROFILE_NOT_READY/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const bound=await bind(db,r);assert.equal(bound.status,'BOUND_WORKER_SERVICES');assert.equal(await durable(db),true);
 const mode=(await db.query('SELECT source_review_id,source_request_key,handoff FROM private.taxonomy_confirmed_worker_modes_v1')).rows[0];
 assert.deepEqual(mode,{source_review_id:r.reviewId,source_request_key:request,handoff:{required:false}});
 assert.equal((await db.query('SELECT private.worker_need_fit_v1($1,$2,true) fit',[need,profile])).rows[0].fit.matches,true);
 // Actual application body passes only its city readiness gate after binding;
 // the explicit calendar sentinel is not a claimed successful application.
 await assert.rejects(db.query('SELECT public.rpc_submit_response($1,1,$2,1,1000,NULL,NULL,\'\',\'response-0001\')',[need,profile]),/TEST_CALENDAR_BOUNDARY_REACHED/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(select(),/TEST_CALENDAR_BOUNDARY_REACHED/);
});

test('private core ACL, unsigned direct activation, foreign owner and expired review fail closed',async t=>{
 const db=await setup(t);const r=await prepare(db);
 const grants=await db.query(`SELECT has_function_privilege('authenticated','private.complete_worker_profile_v1(uuid,uuid,text)','EXECUTE') core,
 has_function_privilege('service_role','private.worker_remote_review_ready_v1(jsonb)','EXECUTE') predicate`);
 assert.deepEqual(grants.rows[0],{core:false,predicate:false});
 await db.query("INSERT INTO public.app_profiles(id,account_id,kind,display_name,bio,skills) VALUES($1,$2,'WORKER','Mila','','{Logotip}')",[profile,owner]);
 await assert.rejects(db.query('SELECT public.rpc_complete_worker_profile($1)',[profile]),/CITY_REQUIRED/);
 await db.query('DELETE FROM public.app_profiles WHERE id=$1',[profile]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(save(db,r),/WORKER_AI_DENIED/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec("UPDATE private.worker_ai_reviews SET expires_at=clock_timestamp()-interval '1 second'");
 await assert.rejects(save(db,r),/WORKER_AI_STALE/);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.app_profiles')).rows[0].n,0);
});

test('catalog/mode/alias drift, unknown skills and proposal actions do not grant cityless activation',async t=>{
 const db=await setup(t);const r=await prepare(db);
 const ready=x=>db.query('SELECT private.worker_remote_review_ready_v1($1::jsonb) ok',[JSON.stringify(x)]).then(v=>v.rows[0].ok);
 assert.equal(await ready(r),true);
 for(const action of ['EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH'])assert.notEqual(await ready({...r,classificationCandidates:r.classificationCandidates.map(p=>({...p,action}))}),true);
 assert.notEqual(await ready({...r,reviewedServiceModes:[{service:'Logotip',mode:'ON_SITE'}]}),true);
 assert.notEqual(await ready({...r,profile:{...r.profile,skills:['Unknown service']}}),true);
 assert.notEqual(await ready({...r,classificationCandidates:r.classificationCandidates.map(p=>({...p,handoff:{required:true}}))}),true);
 await db.query("DELETE FROM private.work_taxonomy_category_modes WHERE category_id=$1",[remote]);
 await assert.rejects(save(db,r),/WORKER_AI_STALE/);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,0);
 await db.query("INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) VALUES($1,'REMOTE','fixture')",[remote]);
 await db.query("INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES($1,'sr','Logotip')",[local]);
 await assert.rejects(save(db,r),/WORKER_AI_STALE/);
});

test('digest tampering, source revision drift and trigger failure roll back profile/receipt/conversation',async t=>{
 const db=await setup(t);const r=await prepare(db);
 await db.query("UPDATE private.worker_ai_reviews SET envelope=jsonb_set(envelope,'{classificationCandidates,0,reason}','\"forged\"') WHERE id=$1",[r.reviewId]);
 await assert.rejects(save(db,r),/WORKER_AI_STALE/);
 await db.query('UPDATE private.worker_ai_reviews SET envelope=$2::jsonb WHERE id=$1',[r.reviewId,JSON.stringify(r)]);
 await db.exec('UPDATE private.worker_ai_sessions SET revision=2');
 await assert.rejects(save(db,r),/WORKER_AI_STALE/);
 await db.exec('UPDATE private.worker_ai_sessions SET revision=1');
 await db.exec(`CREATE FUNCTION private.test_abort_saved() RETURNS trigger LANGUAGE plpgsql AS $f$
 BEGIN RAISE EXCEPTION 'TEST_SAVE_TRIGGER_FAILURE';END$f$;
 CREATE TRIGGER z_abort_saved AFTER INSERT ON private.worker_ai_saves FOR EACH ROW EXECUTE FUNCTION private.test_abort_saved();`);
 await assert.rejects(save(db,r),/TEST_SAVE_TRIGGER_FAILURE/);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.app_profiles')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.requeue_events')).rows[0].n,0);
 assert.equal((await db.query('SELECT status FROM public.ai_conversations')).rows[0].status,'OPEN');
 await db.exec('DROP TRIGGER z_abort_saved ON private.worker_ai_saves');
 assert.equal((await save(db,r)).profileStatus,'ACTIVE');
});

test('full local admission rejects missing opt-in and exact owner drift without partial installation',async t=>{
 const db=await setup(t,{patched:false});
 await assert.rejects(db.exec(source),/R08_REMOTE_LOCAL_ONLY/);await db.exec('ROLLBACK');
 await db.exec("SELECT set_config('uskoci.r08.remote_only.disposable','LOCAL_ONLY',false)");
 const original=sqlFunction('public.rpc_save_worker_ai_review');
 await db.exec(original.replace('declare s private.worker_ai_sessions;', 'declare /* changed owner */ s private.worker_ai_sessions;'));
 await assert.rejects(db.exec(source),/R08_REMOTE_OWNER_DRIFT/);await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regprocedure('private.complete_worker_profile_v1(uuid,uuid,text)') core")).rows[0].core,null);
 await db.exec(original);await install(db);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('SELECT private.complete_worker_profile_v1($1,NULL,NULL)',[profile]),/permission denied/);
 await db.exec('RESET ROLE');
});

test('durable helper retains foreign/unknown/alias/excluded/inactive/unconfirmed and ON_SITE negatives',async t=>{
 const db=await setup(t);const r=await prepare(db);await save(db,r);await bind(db,r);
 const ready=(account=owner,skills=['Logotip'])=>db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2::text[]) ok',[account,skills]).then(x=>x.rows[0].ok);
 assert.equal(await ready(),true);assert.equal(await ready(other),false);
 for(const skills of [[],['Unknown service'],['Logotip','Krečenje'],['Logotip',null]])assert.equal(await ready(owner,skills),false);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE category_id=$1',[remote]);assert.equal(await ready(),false);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=false WHERE category_id=$1',[remote]);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id=$1',[remote]);assert.equal(await ready(),false);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=true WHERE category_id=$1',[remote]);
 // The production schema rejects null confirmation itself. A nonmatching
 // confirmation or request provenance is also rejected by the helper.
 await assert.rejects(db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=null WHERE category_id=$1',[remote]),/not-null/);
 await db.query("UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=confirmed_at-interval '1 second' WHERE category_id=$1",[remote]);assert.equal(await ready(),false);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=(SELECT bound_at FROM private.work_taxonomy_worker_bindings_v1) WHERE category_id=$1',[remote]);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_request_key=$1 WHERE category_id=$2',[id(99),remote]);assert.equal(await ready(),false);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET source_request_key=$1 WHERE category_id=$2',[request,remote]);
 await db.query("INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES($1,'sr','Logotip')",[local]);assert.equal(await ready(),false);
 await db.query('DELETE FROM private.work_taxonomy_aliases WHERE category_id=$1',[local]);
 await db.query("INSERT INTO private.work_taxonomy_aliases(category_id,locale,label) VALUES($1,'sr','Grafički logo')",[remote]);
 await db.query("UPDATE public.app_profiles SET skills=ARRAY['Grafički logo'] WHERE id=$1",[profile]);
 assert.equal(await ready(owner,['Grafički logo']),true);
 await db.query("UPDATE public.app_profiles SET skills=ARRAY['Logotip'] WHERE id=$1",[profile]);
 await db.query(`INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,excluded,origin,confirmed_at)
 SELECT $1,$2,false,'WORKER_CONFIRMED',bound_at FROM private.work_taxonomy_worker_bindings_v1`,[owner,local]);
 await db.query(`INSERT INTO private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,execution_scope,source_review_id,source_request_key,confirmed_at,active)
 SELECT $1,$2,'ON_SITE',source_review_id,request_key,bound_at,true FROM private.work_taxonomy_worker_bindings_v1`,[owner,local]);
 assert.equal(await ready(),false);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE category_id=$1',[local]);assert.equal(await ready(),true);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=false WHERE category_id=$1',[local]);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id=$1',[local]);assert.equal(await ready(),true);
 await db.query("UPDATE private.taxonomy_confirmed_worker_modes_v1 SET execution_scope='ON_SITE' WHERE category_id=$1",[remote]);assert.equal(await ready(),false);
 await db.query("UPDATE private.taxonomy_confirmed_worker_modes_v1 SET execution_scope='REMOTE' WHERE category_id=$1",[remote]);
 await db.query("UPDATE private.work_taxonomy_categories SET state='PENDING' WHERE id=$1",[remote]);assert.equal(await ready(),false);
 await db.query("UPDATE private.work_taxonomy_categories SET state='ESTABLISHED' WHERE id=$1",[remote]);
 await db.query('DELETE FROM private.work_taxonomy_category_modes WHERE category_id=$1',[remote]);assert.equal(await ready(),false);
});

test('save-only DRAFT and existing ACTIVE edit preserve lifecycle; request reuse cannot save another review',async t=>{
 const db=await setup(t);const draft=await prepare(db,false,false);
 assert.equal((await save(db,draft)).profileStatus,'DRAFT');
 assert.equal((await db.query('SELECT count(*)::int n FROM private.requeue_events')).rows[0].n,0);
 assert.equal(await durable(db),false);
 // Reset the isolated fixture into an existing ACTIVE editing state. This
 // exercises prepare/save editing, not the separate conversation-open RPC.
 await db.query("UPDATE public.app_profiles SET city='Novi Sad',profile_status='ACTIVE' WHERE id=$1",[profile]);
 await db.query('DELETE FROM private.worker_ai_saves');await db.query('DELETE FROM private.worker_ai_reviews');
 await db.exec("UPDATE public.ai_conversations SET status='OPEN',completed_at=null");
 await db.query(`UPDATE private.worker_ai_sessions SET base_hash=private.worker_ai_source_hash($1),
 candidate=private.worker_ai_initial($1)||'{"bio":"Novi opis"}'::jsonb`,[owner]);
 await db.exec('DELETE FROM private.work_taxonomy_gemini_turn_hints_v1');
 const r=await prepare(db,true,true);
 // Make a second otherwise valid review by expiring the cache entry, then restore
 // the first expiry: request identity must reject the second, not mutate again.
 await db.query("UPDATE private.worker_ai_reviews SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[r.reviewId]);
 const second=await prepare(db,true,true);
 await db.query('UPDATE private.worker_ai_reviews SET expires_at=$2 WHERE id=$1',[r.reviewId,r.expiresAt]);
 const receipt=await save(db,r);assert.equal(receipt.profileStatus,'ACTIVE');
 await assert.rejects(save(db,second),/WORKER_AI_REQUEST_CONFLICT/);
 assert.equal((await db.query('SELECT bio FROM public.app_profiles WHERE id=$1',[profile])).rows[0].bio,'Novi opis');
 assert.deepEqual(await save(db,r),receipt);
});
