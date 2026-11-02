// Actual SQL prepare -> current mobile decoder -> Save/activate -> batch/binder
// -> saved-mode readback and application readiness. Synthetic claims and BG hint;
// no provider, Auth HTTP, RLS/PostGIS, complete matching or Android proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {postimages} from '../../operations/dev-alpha/r04-semantic-admission-20261101/build.mjs';

// Reuse the existing R08 fixture exactly, as its acceptance runner already does.
// No duplicated schema and no imported test registrations.
const proof=new URL('./r08_remote_only_activation.test.mjs',import.meta.url);
const text=readFileSync(proof,'utf8');
const marker="test('baseline reproduces both first-save blockers;";
assert.ok(text.includes(marker));
let fixture=text.slice(0,text.indexOf(marker)).replaceAll('import.meta.url',JSON.stringify(proof.href));
for(const name of ['@electric-sql/pglite','@electric-sql/pglite/contrib/pgcrypto','typescript'])
  fixture=fixture.replaceAll(`from '${name}'`,'from '+JSON.stringify(import.meta.resolve(name)));
fixture+='\nexport {setup,tableSql,sqlFunction,prepare,save,bind,makeNeed,mobileDecoder,owner,other,remote,profile,conversation,request,need};';
const {setup,tableSql,sqlFunction,prepare,save,bind,makeNeed,mobileDecoder,owner,other,remote,profile,conversation,need}
  =await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const root=new URL('../../operations/dev-alpha/r04-semantic-admission-20261101/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('signed semantic cityless worker passes actual prepare, decoder, Save, bind and application readiness',async t=>{
  const db=await setup(t);
  for(const table of ['private.work_taxonomy_risk_rules','private.work_taxonomy_audit','private.work_taxonomy_related_acceptances'])
    await db.exec(tableSql(table));
  await db.exec(sqlFunction('private.taxonomy_category_path_valid_v1'));
  await db.exec(Object.values(postimages).map(f=>f.definition+';').join('\n'));
  await db.exec(`CREATE FUNCTION private.closure_taxonomy_profile_erasing_v1(uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$SELECT false$$;`);
  const trigger=JSON.parse(read('worker-sync-dev-preimage-20261102.json')).functions
    .find(f=>f.signature==='private.worker_profile_sync_taxonomy_capabilities_trg_fn()');
  await db.exec(read('worker-semantic-sync-local-only.sql')+';'+trigger.definition+';');
  await db.exec(`CREATE TRIGGER semantic_profile_sync AFTER INSERT OR UPDATE OF skills ON public.app_profiles
    FOR EACH ROW EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn();`);
  await db.query("UPDATE private.work_taxonomy_categories SET label='Lektura tekstova',canonical_key='lektura tekstova' WHERE id=$1",[remote]);
  await db.query(`UPDATE private.worker_ai_sessions SET candidate=candidate||
    '{"skills":["Lektura"],"bio":"Lektura tekstova na srpskom jeziku"}'::jsonb WHERE conversation_id=$1`,[conversation]);
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET
    source_fingerprint=encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex'),
    proposals=jsonb_build_array(jsonb_build_object('action','REUSE_EXISTING','service','Lektura','mode','REMOTE',
      'categoryId',$2::text,'parentId','','proposedPath','[]'::jsonb,'catalogVersion',1,
      'reason','Isti posao lekture teksta, postojeći potvrđeni list kataloga','handoff',jsonb_build_object('required',false)))
    FROM private.worker_ai_sessions s WHERE h.conversation_id=$1 AND s.conversation_id=h.conversation_id`,[conversation,remote]);
  const old=await prepare(db);
  assert.equal(old.canAccept,false); // Four-body package alone does not close R08.
  await db.exec(read('worker-remote-semantic-review-local-only.sql'));
  await db.exec(read('worker-semantic-binder-local-only.sql'));
  await db.exec(read('worker-remote-semantic-activation-local-only.sql'));
  await db.exec(read('worker-semantic-readback-local-only.sql'));
  await db.exec('SET ROLE authenticated');
  const review=await prepare(db);
  assert.equal(review.canAccept,true); assert.deepEqual(review.missingRequired,[]);
  assert.equal(review.classificationState,'READY');
  assert.equal(review.classificationCandidates[0].categoryId,remote);
  assert.equal(review.classificationCandidates[0].categoryLabel,'Lektura tekstova');
  assert.ok(mobileDecoder().decodeWorkerAiReview(review,owner,conversation));
  await db.exec('RESET ROLE');
  await db.query("UPDATE private.work_taxonomy_categories SET label='Promenjena usluga' WHERE id=$1",[remote]);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(save(db,review),/WORKER_AI_STALE/);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.app_profiles WHERE id=$1',[profile])).rows[0].n,0);
  await db.query("UPDATE private.work_taxonomy_categories SET label='Lektura tekstova' WHERE id=$1",[remote]);
  await db.exec('SET ROLE authenticated');
  // No manual review/Save receipt insertion: actual server signs and saves it.
  const receipt=await save(db,review);
  assert.equal(receipt.profileStatus,'ACTIVE'); assert.equal(receipt.authoritative,true);
  assert.deepEqual(await save(db,review),receipt);
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT city,operating_country_code,skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0],
    {city:'',operating_country_code:null,skills:['Lektura']});
  const eligible=async()=> (await db.query("SELECT private.worker_remote_only_activation_ready_v1($1,ARRAY['Lektura']) ok",[owner])).rows[0].ok;
  const services=async()=> (await db.query('SELECT public.rpc_get_worker_execution_modes($1) result',[profile])).rows[0].result.services;
  assert.equal(await eligible(),false);
  assert.equal((await services())[0].status,'PENDING');
  await makeNeed(db);
  const submit=()=>db.query("SELECT public.rpc_submit_response($1,1,$2,1,1000,NULL,NULL,'','semantic-submit-01')",[need,profile]);
  await assert.rejects(submit(),/WORKER_PROFILE_NOT_READY/);
  assert.equal((await bind(db,review)).status,'BOUND_WORKER_SERVICES');
  assert.equal(await eligible(),true);
  assert.equal((await services())[0].status,'CONFIRMED');
  assert.deepEqual((await db.query('SELECT category_id,excluded FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=$1',[owner])).rows,
    [{category_id:remote,excluded:false}]);
  // Only the actual application readiness gate is proved: calendar is sentinel.
  await assert.rejects(submit(),/TEST_CALENDAR_BOUNDARY_REACHED/);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.marketplace_responses')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_aliases')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,1);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
  await assert.rejects(services(),/WORKER_PROFILE_NOT_OWNED/);
  await assert.rejects(save(db,review),/WORKER_AI_DENIED/);
});

async function novelRemote(t,action){
  const db=await setup(t),service='Analiza podataka';
  for(const table of ['private.work_taxonomy_risk_rules','private.work_taxonomy_audit','private.work_taxonomy_related_acceptances'])
    await db.exec(tableSql(table));
  await db.exec(sqlFunction('private.taxonomy_category_path_valid_v1'));
  await db.exec(Object.values(postimages).map(f=>f.definition+';').join('\n'));
  await db.exec(`CREATE FUNCTION private.closure_taxonomy_profile_erasing_v1(uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$SELECT false$$;`);
  const trigger=JSON.parse(read('worker-sync-dev-preimage-20261102.json')).functions
    .find(f=>f.signature==='private.worker_profile_sync_taxonomy_capabilities_trg_fn()');
  await db.exec(read('worker-semantic-sync-local-only.sql')+';'+trigger.definition+';');
  await db.exec(`CREATE TRIGGER semantic_profile_sync AFTER INSERT OR UPDATE OF skills ON public.app_profiles
    FOR EACH ROW EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn();`);
  for(const file of ['worker-remote-semantic-review-local-only.sql','worker-semantic-binder-local-only.sql',
    'worker-remote-semantic-activation-local-only.sql','worker-semantic-readback-local-only.sql',
    'worker-semantic-mode-context-local-only.sql','worker-semantic-prepare-local-only.sql',
    'worker-semantic-confirmed-prepare-local-only.sql']) await db.exec(read(file));
  await db.query('UPDATE private.work_taxonomy_categories SET label=$2,canonical_key=private.taxonomy_normalize_v1($2) WHERE id=$1',
    [remote,action==='EXTEND_MODE'?service:'Digitalne usluge']);
  if(action==='EXTEND_MODE') await db.query("UPDATE private.work_taxonomy_category_modes SET execution_scope='ON_SITE' WHERE category_id=$1",[remote]);
  const proposal={action,service,mode:'REMOTE',categoryId:action==='EXTEND_MODE'?remote:'',
    parentId:action==='CREATE_CHILD'?remote:'',proposedPath:action==='EXTEND_MODE'?[]:
      action==='CREATE_CHILD'?['Analiticke usluge',service]:['Digitalna analiza',service],
    catalogVersion:1,reason:'Synthetic source-bound remote service plan',handoff:{required:false}};
  await db.query('UPDATE private.worker_ai_sessions SET candidate=candidate||$2::jsonb WHERE conversation_id=$1',
    [conversation,JSON.stringify({skills:[service],bio:'Analiza podataka i izrada izvestaja'})]);
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET
    source_fingerprint=encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex'),
    proposals=$2::jsonb FROM private.worker_ai_sessions s
    WHERE h.conversation_id=$1 AND s.conversation_id=h.conversation_id`,[conversation,JSON.stringify([proposal])]);
  const eligible=async()=> (await db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2::text[]) ok',[owner,[service]])).rows[0].ok;
  const services=async()=> (await db.query('SELECT public.rpc_get_worker_execution_modes($1) result',[profile])).rows[0].result.services;
  const authority=async()=> (await db.query(`SELECT
    (SELECT count(*)::int FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=$1 AND NOT excluded) caps,
    (SELECT count(*)::int FROM private.taxonomy_confirmed_worker_modes_v1 WHERE worker_account_id=$1 AND active) modes`,[owner])).rows[0];
  return {db,service,proposal,eligible,services,authority};
}

for(const action of ['CREATE_CHILD','CREATE_NEW_BRANCH','EXTEND_MODE']){
  test(`${action}: signed cityless activation is consent only until actual admission and binding`,async t=>{
    const {db,service,proposal,eligible,services,authority}=await novelRemote(t,action);
    await db.exec('SET ROLE authenticated');
    const review=await prepare(db);
    assert.equal(review.classificationState,'READY'); assert.equal(review.canAccept,true);
    assert.deepEqual(review.missingRequired,[]);
    assert.equal(review.classificationCandidates[0].action,action);
    assert.ok(mobileDecoder().decodeWorkerAiReview(review,owner,conversation));
    await db.exec('RESET ROLE');
    // Drift after signing must roll back profile, availability and Save together.
    await db.exec('BEGIN');
    if(action==='CREATE_NEW_BRANCH') await db.query(`INSERT INTO private.work_taxonomy_categories
      (canonical_key,label,state,source,catalog_version) VALUES(private.taxonomy_normalize_v1($1),$1,'ESTABLISHED','CURATED',1)`,[proposal.proposedPath[0]]);
    else await db.query("UPDATE private.work_taxonomy_categories SET label='Promenjena usluga' WHERE id=$1",[remote]);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(save(db,review),/WORKER_AI_STALE/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.app_profiles WHERE id=$1',[profile])).rows[0].n,0);
    await db.exec('SET ROLE authenticated');
    const receipt=await save(db,review);
    assert.equal(receipt.profileStatus,'ACTIVE'); assert.equal(receipt.authoritative,true);
    assert.deepEqual(await save(db,review),receipt);
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT city,operating_country_code,skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0],
      {city:'',operating_country_code:null,skills:[service]});
    assert.deepEqual(await authority(),{caps:0,modes:0});
    assert.equal(await eligible(),false); assert.equal((await services())[0].status,'PENDING');
    await makeNeed(db);
    const submit=()=>db.query("SELECT public.rpc_submit_response($1,1,$2,1,1000,NULL,NULL,'','novel-submit-01')",[need,profile]);
    await assert.rejects(submit(),/WORKER_PROFILE_NOT_READY/);
    assert.equal((await bind(db,review)).status,'BOUND_WORKER_SERVICES');
    assert.deepEqual(await authority(),{caps:1,modes:1}); assert.equal(await eligible(),true);
    assert.deepEqual((await services())[0],{service,status:'CONFIRMED',modes:[{mode:'REMOTE',status:'CONFIRMED',handoff:{required:false}}]});
    const bound=(await db.query('SELECT category_id FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=$1',[owner])).rows[0].category_id;
    if(action==='EXTEND_MODE') assert.equal(bound,remote); else assert.notEqual(bound,remote);
    await db.query('UPDATE public.needs SET category_id=$1 WHERE id=$2',[bound,need]);
    await db.query('UPDATE private.work_taxonomy_need_snapshots SET category_id=$1 WHERE need_id=$2',[bound,need]);
    await assert.rejects(submit(),/TEST_CALENDAR_BOUNDARY_REACHED/);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.marketplace_responses')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_aliases')).rows[0].n,0);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
    await assert.rejects(services(),/WORKER_PROFILE_NOT_OWNED/);
    await assert.rejects(save(db,review),/WORKER_AI_DENIED/);
  });
}

test('novel activation needs the owned current source and unchanged complete REMOTE plan',async t=>{
  const {db,service,authority}=await novelRemote(t,'CREATE_CHILD');
  const review=await prepare(db);
  assert.equal(review.canAccept,true);
  const check=async doc=>(await db.query('SELECT private.worker_remote_review_ready_v1($1::jsonb) ok',[JSON.stringify(doc)])).rows[0].ok;
  for(const doc of [
    {...review,accountId:other}, {...review,conversationId:need}, {...review,conversationId:'malformed'},
    {...review,classificationState:'PENDING_CLASSIFICATION'},
    {...review,classificationCatalogVersion:99}, {...review,classificationCatalogFingerprint:'wrong'},
    {...review,reviewedServiceModes:[{service,mode:'ON_SITE'}]},
    {...review,reviewedServiceModes:[{service,mode:'REMOTE'},{service,mode:'ON_SITE'}]},
    {...review,classificationCandidates:[{...review.classificationCandidates[0],action:'UNKNOWN'}]},
    {...review,classificationCandidates:[{...review.classificationCandidates[0],path:['Druga usluga']}]},
    {...review,classificationCandidates:[{...review.classificationCandidates[0],handoff:{required:true}}]},
  ]) assert.equal(await check(doc),false);
  await db.exec('BEGIN');
  await db.query('UPDATE private.worker_ai_sessions SET revision=revision+1 WHERE conversation_id=$1',[conversation]);
  assert.equal(await check(review),false);
  await assert.rejects(save(db,review),/WORKER_AI_STALE/);
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query('UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET account_id=$1',[other]);
  assert.equal(await check(review),false);
  const unconfirmed=await prepare(db);
  assert.equal(unconfirmed.canAccept,false);
  assert.notEqual(unconfirmed.classificationState,'READY');
  await db.exec('ROLLBACK');
  assert.equal(await check(review),true); assert.deepEqual(await authority(),{caps:0,modes:0});
});

test('first cityless two-service profile retains source-bound physical handoff while adding a new service',async t=>{
  const {db,service,proposal,services,authority}=await novelRemote(t,'CREATE_CHILD');
  const existing='Popravka racunara';
  const category=(await db.query('SELECT id FROM private.work_taxonomy_categories WHERE id<>$1',[remote])).rows[0].id;
  await db.query('UPDATE private.work_taxonomy_categories SET label=$2,canonical_key=private.taxonomy_normalize_v1($2) WHERE id=$1',[category,existing]);
  await db.query("UPDATE private.work_taxonomy_category_modes SET execution_scope='REMOTE' WHERE category_id=$1",[category]);
  const handoff={required:true,shippingCountries:['RS']};
  const reuse={action:'REUSE_EXISTING',service:existing,mode:'REMOTE',categoryId:category,parentId:'',proposedPath:[],
    catalogVersion:1,reason:'Synthetic workshop repair with explicit shipping',handoff};
  await db.query('UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,\'{skills}\',$2::jsonb) WHERE conversation_id=$1',
    [conversation,JSON.stringify([existing,service])]);
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET
    source_fingerprint=encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex'),
    proposals=$2::jsonb FROM private.worker_ai_sessions s
    WHERE h.conversation_id=$1 AND s.conversation_id=h.conversation_id`,[conversation,JSON.stringify([reuse,proposal])]);
  await db.exec('SET ROLE authenticated');
  const review=await prepare(db);
  assert.equal(review.canAccept,true); assert.equal(review.classificationState,'READY');
  assert.deepEqual(review.classificationCandidates.map(p=>p.action),['REUSE_EXISTING','CREATE_CHILD']);
  assert.deepEqual(review.classificationCandidates[0].handoff,handoff);
  assert.ok(mobileDecoder().decodeWorkerAiReview(review,owner,conversation));
  await db.exec('RESET ROLE');
  await db.exec('BEGIN');
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1
    SET proposals=jsonb_set(proposals,'{0,handoff}','{"required":false}') WHERE conversation_id=$1`,[conversation]);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(save(db,review),/WORKER_AI_STALE/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.app_profiles WHERE id=$1',[profile])).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,0);
  await db.exec('SET ROLE authenticated');
  assert.equal((await save(db,review)).profileStatus,'ACTIVE');
  await db.exec('RESET ROLE');
  assert.deepEqual(await authority(),{caps:0,modes:0});
  assert.deepEqual((await services()).map(s=>s.status),['PENDING','PENDING']);
  assert.equal((await bind(db,review)).status,'BOUND_WORKER_SERVICES');
  assert.deepEqual(await authority(),{caps:2,modes:2});
  const saved=await services();
  assert.deepEqual(saved.map(s=>s.status),['CONFIRMED','CONFIRMED']);
  assert.deepEqual(saved[0].modes,[{mode:'REMOTE',status:'CONFIRMED',handoff}]);
  assert.equal((await db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2::text[]) ok',
    [owner,[existing,service]])).rows[0].ok,true);
});

test('new cityless service may still save a draft; draft cannot bind or become actionable',async t=>{
  const {db,eligible,authority}=await novelRemote(t,'CREATE_NEW_BRANCH');
  await db.exec('SET ROLE authenticated');
  const draft=await prepare(db,false,false);
  assert.equal(draft.classificationState,'READY'); assert.equal(draft.canAccept,true); assert.equal(draft.activate,false);
  assert.equal((await save(db,draft)).profileStatus,'DRAFT');
  await db.exec('RESET ROLE');
  await assert.rejects(bind(db,draft),/WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED/);
  assert.deepEqual(await authority(),{caps:0,modes:0}); assert.equal(await eligible(),false);
});

for(const semantic of [false,true]) test(`mixed new plan preserves an already bound ${semantic?'semantic':'canonical'} physical handoff without a new hint`,async t=>{
  const {db,service,proposal,services,authority}=await novelRemote(t,'EXTEND_MODE');
  const handoff={required:true,shippingCountries:['RS']};
  await db.query("UPDATE private.work_taxonomy_category_modes SET execution_scope='REMOTE' WHERE category_id=$1",[remote]);
  if(semantic) await db.query("UPDATE private.work_taxonomy_categories SET label='Analiza skupova podataka',canonical_key='analiza skupova podataka' WHERE id=$1",[remote]);
  await db.query('UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=$1::jsonb',
    [JSON.stringify([{...proposal,action:'REUSE_EXISTING',handoff}])]);
  const original=await prepare(db);
  assert.equal(original.canAccept,true);
  await save(db,original); await bind(db,original);
  assert.deepEqual((await services())[0].modes[0].handoff,handoff);
  await db.exec(tableSql('public.ai_messages'));
  for(const name of ['private.worker_ai_turn_document','private.worker_ai_document','public.rpc_open_worker_ai']) await db.exec(sqlFunction(name));
  const reopened=(await db.query('SELECT public.rpc_open_worker_ai(gen_random_uuid()) doc')).rows[0].doc;
  const cid=reopened.conversationId,newService='Digitalna obrada slika';
  assert.equal(reopened.stale,false); assert.equal(reopened.revision,0);
  await db.query(`UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',$2::jsonb),revision=1 WHERE conversation_id=$1`,
    [cid,JSON.stringify([service,newService])]);
  await db.query(`INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
    (account_id,conversation_id,client_request_id,turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
    SELECT account_id,conversation_id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),'WORKER_CAPABILITY',
    encode(extensions.digest(convert_to(candidate::text||'|'||revision::text||'|'||base_hash,'UTF8'),'sha256'),'hex'),
    (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton),$2::jsonb FROM private.worker_ai_sessions WHERE conversation_id=$1`,
    [cid,JSON.stringify([{action:'CREATE_NEW_BRANCH',service:newService,mode:'REMOTE',categoryId:'',parentId:'',
      proposedPath:['Digitalna obrada',newService],catalogVersion:1,reason:'Synthetic new independent remote service',handoff:{required:false}}])]);
  const context=(await db.query('SELECT private.worker_ai_service_mode_context_v1($1,$2) doc',[owner,cid])).rows[0].doc;
  assert.deepEqual(context.savedServices,[{service,mode:'REMOTE',categoryId:remote,handoff}]);
  await db.exec('BEGIN');
  const formatted='  ANALIZA PODATAKA  ';
  await db.query("UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',$2::jsonb) WHERE conversation_id=$1",
    [cid,JSON.stringify([formatted,newService])]);
  assert.deepEqual((await db.query('SELECT private.worker_ai_service_mode_context_v1($1,$2) doc',[owner,cid])).rows[0].doc.savedServices,
    [{service:formatted,mode:'REMOTE',categoryId:remote,handoff}]);
  await db.query("UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',$2::jsonb) WHERE conversation_id=$1",
    [cid,JSON.stringify([formatted,service,newService])]);
  assert.deepEqual((await db.query('SELECT private.worker_ai_service_mode_context_v1($1,$2) doc',[owner,cid])).rows[0].doc.savedServices,[]);
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query("UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',$2::jsonb) WHERE conversation_id=$1",
    [cid,JSON.stringify([service,newService,'Nepoznata dodatna usluga'])]);
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET source_fingerprint=
    encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
    FROM private.worker_ai_sessions s WHERE h.conversation_id=$1 AND s.conversation_id=h.conversation_id`,[cid]);
  const incomplete=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid])).rows[0].review;
  assert.equal(incomplete.classificationState,'SERVICE_MODE_CONFIRMATION_REQUIRED'); assert.equal(incomplete.canAccept,false);
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query(`INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
    (account_id,conversation_id,client_request_id,turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
    SELECT account_id,conversation_id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('b',64),'WORKER_CAPABILITY',
      'previous-revision',(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton),$2::jsonb
    FROM private.worker_ai_sessions WHERE conversation_id=$1`,[cid,JSON.stringify([{...proposal,service,action:'EXTEND_MODE',mode:'ON_SITE',handoff:undefined}])]);
  const forgottenChange=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid])).rows[0].review;
  assert.equal(forgottenChange.canAccept,false); assert.notEqual(forgottenChange.classificationState,'READY');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query(`INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
    (account_id,conversation_id,client_request_id,turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
    SELECT account_id,conversation_id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('c',64),'WORKER_CAPABILITY',
      'previous-handoff-revision',(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton),$2::jsonb
    FROM private.worker_ai_sessions WHERE conversation_id=$1`,[cid,JSON.stringify([{...proposal,service,action:'REUSE_EXISTING',mode:'REMOTE',handoff:{required:false}}])]);
  const forgottenHandoff=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,true,$2::jsonb) review',
    [cid,JSON.stringify([{service,mode:'REMOTE'},{service:newService,mode:'REMOTE'}])])).rows[0].review;
  assert.equal(forgottenHandoff.canAccept,false);
  assert.notEqual(forgottenHandoff.classificationState,'READY');
  await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 h SET proposals=proposals||$2::jsonb
    FROM private.worker_ai_sessions s WHERE h.conversation_id=$1 AND s.conversation_id=h.conversation_id
      AND h.source_fingerprint=encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')`,
    [cid,JSON.stringify([{...proposal,service,action:'REUSE_EXISTING',mode:'REMOTE',handoff:undefined}])]);
  for(const rpc of [()=>db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid]),
    ()=>db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,true,$2::jsonb) review',
      [cid,JSON.stringify([{service,mode:'REMOTE'},{service:newService,mode:'REMOTE'}])])]){
    const incompleteHandoff=(await rpc()).rows[0].review;
    assert.equal(incompleteHandoff.canAccept,false); assert.notEqual(incompleteHandoff.classificationState,'READY');
  }
  await db.exec('ROLLBACK');
  // A fresh explicit changed or invalid mode must not silently inherit REMOTE.
  for(const changed of [{mode:'ON_SITE',action:'EXTEND_MODE'},{mode:null,action:'REUSE_EXISTING'},
    {mode:'REMOTE',action:null},{mode:'UNKNOWN',action:'REUSE_EXISTING'}]){
    await db.exec('BEGIN');
    await db.query(`UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=proposals||$2::jsonb WHERE conversation_id=$1`,
      [cid,JSON.stringify([{...proposal,...changed,service,handoff:undefined}])]);
    const altered=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid])).rows[0].review;
    assert.equal(altered.canAccept,false,JSON.stringify(changed));
    await db.exec('ROLLBACK');
  }
  // Stale source and explicit removal cannot readmit the old mode.
  await db.exec('BEGIN');
  await db.query("UPDATE private.worker_ai_sessions SET base_hash='stale' WHERE conversation_id=$1",[cid]);
  await assert.rejects(db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true)',[cid]),/WORKER_AI_STALE/);
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query("UPDATE private.worker_ai_sessions SET candidate=jsonb_set(candidate,'{skills}',$2::jsonb) WHERE conversation_id=$1",[cid,JSON.stringify([newService])]);
  assert.deepEqual((await db.query('SELECT private.worker_ai_service_mode_context_v1($1,$2) doc',[owner,cid])).rows[0].doc.savedServices,[]);
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE worker_account_id=$1',[owner]);
  const removed=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid])).rows[0].review;
  assert.equal(removed.canAccept,false);
  await db.exec('ROLLBACK');
  const automatic=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true) review',[cid])).rows[0].review;
  assert.equal(automatic.classificationState,'READY'); assert.equal(automatic.canAccept,true);
  assert.deepEqual(automatic.classificationCandidates[0].handoff,handoff);
  const selected=[{service,mode:'REMOTE'},{service:newService,mode:'REMOTE'}];
  const reviewed=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,true,$2::jsonb) review',[cid,JSON.stringify(selected)])).rows[0].review;
  t.diagnostic(JSON.stringify({automatic:automatic.classificationState,automaticAccept:automatic.canAccept,
    confirmed:reviewed.classificationState,confirmedAccept:reviewed.canAccept,missing:reviewed.missingRequired}));
  assert.equal(reviewed.canAccept,true);
  for(const changed of [[{service,mode:'ON_SITE'},{service:newService,mode:'REMOTE'}],
    [{service,mode:'REMOTE'}]]){
    const different=(await db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,true,$2::jsonb) review',
      [cid,JSON.stringify(changed)])).rows[0].review;
    assert.equal(different.canAccept,false);
    assert.notEqual(different.classificationState,'READY');
  }
  assert.deepEqual(reviewed.classificationCandidates[0].handoff,handoff);
  assert.ok(mobileDecoder().decodeWorkerAiReview(reviewed,owner,cid));
  const key=(await db.query('SELECT gen_random_uuid() id')).rows[0].id;
  await db.exec('BEGIN');
  await db.query(`UPDATE private.taxonomy_confirmed_worker_modes_v1 SET handoff='{"required":false}' WHERE worker_account_id=$1`,[owner]);
  assert.equal((await db.query('SELECT private.worker_remote_review_ready_v1($1::jsonb) ok',[JSON.stringify(automatic)])).rows[0].ok,false);
  assert.equal((await services())[0].status,'UNCONFIRMED');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE worker_account_id=$1',[owner]);
  assert.equal((await db.query('SELECT private.worker_remote_review_ready_v1($1::jsonb) ok',[JSON.stringify(automatic)])).rows[0].ok,false);
  assert.equal((await services())[0].status,'UNCONFIRMED');
  assert.equal((await db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2::text[]) ok',[owner,[service]])).rows[0].ok,false);
  // Existing ACTIVE profile edits may Save new consent without reactivation.
  // This is not catalog revalidation and must not revive the withdrawn mode.
  assert.equal((await save(db,automatic,key)).profileStatus,'ACTIVE');
  const withdrawnAuthority=await authority();
  assert.equal(withdrawnAuthority.modes,0); assert.ok(withdrawnAuthority.caps<=1);
  assert.equal((await db.query('SELECT private.worker_remote_only_activation_ready_v1($1,$2::text[]) ok',[owner,[service,newService]])).rows[0].ok,false);
  assert.ok((await services()).every(s=>s.status!=='CONFIRMED'));
  await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT skills FROM public.app_profiles WHERE id=$1',[profile])).rows[0].skills,[service]);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.worker_ai_saves')).rows[0].n,1);
  await db.exec('BEGIN');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
  await db.exec('SAVEPOINT foreign_owner');
  await assert.rejects(db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy($1,1,true)',[cid]),/WORKER_AI_DENIED/);
  await db.exec('ROLLBACK TO SAVEPOINT foreign_owner');
  await assert.rejects(db.query('SELECT public.rpc_prepare_worker_ai_review_taxonomy_confirmed($1,1,true,$2::jsonb)',[cid,JSON.stringify(selected)]),/WORKER_AI_DENIED/);
  await db.exec('ROLLBACK');
  assert.equal((await save(db,automatic,key)).profileStatus,'ACTIVE');
  assert.deepEqual(await authority(),{caps:1,modes:1});
  assert.deepEqual((await services()).map(x=>x.status),['CONFIRMED','PENDING']);
  const pendingOpen=(await db.query('SELECT public.rpc_open_worker_ai(gen_random_uuid()) doc')).rows[0].doc;
  const pendingContext=(await db.query('SELECT private.worker_ai_service_mode_context_v1($1,$2) doc',[owner,pendingOpen.conversationId])).rows[0].doc;
  assert.deepEqual(pendingContext.savedServices,[{service,mode:'REMOTE',categoryId:remote,handoff}]);
  assert.deepEqual(pendingContext.unresolvedServices,[newService]);
  await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
  await db.query("SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4::jsonb)",[owner,key,automatic.reviewId,JSON.stringify(automatic.classificationCandidates)]);
  await db.query('SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4)',[owner,key,automatic.reviewId,profile]);
  assert.deepEqual(await authority(),{caps:2,modes:2});
  assert.deepEqual((await services()).map(x=>x.status),['CONFIRMED','CONFIRMED']);
  assert.deepEqual((await services())[0].modes[0].handoff,handoff);
});

test('semantic synonym may extend an established leaf mode without registering an alias',async t=>{
  const {db,service,authority,eligible}=await novelRemote(t,'EXTEND_MODE');
  await db.query("UPDATE private.work_taxonomy_categories SET label='Analiza skupova podataka',canonical_key='analiza skupova podataka' WHERE id=$1",[remote]);
  // Conflicting exact names, changed parent/leaf and stale hints remain refused.
  for(const sql of [
    `UPDATE private.work_taxonomy_categories SET canonical_key='analiza podataka' WHERE id<>'${remote}'`,
    `UPDATE private.work_taxonomy_categories SET parent_id='${remote}' WHERE id<>'${remote}'`,
    `UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_version=99`,
    `UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET source_fingerprint='stale'`
  ]){
    await db.exec('BEGIN'); await db.exec(sql);
    const blocked=await prepare(db); assert.equal(blocked.canAccept,false); assert.notEqual(blocked.classificationState,'READY');
    await db.exec('ROLLBACK');
  }
  const review=await prepare(db);
  assert.equal(review.canAccept,true); assert.equal(review.classificationState,'READY');
  assert.equal(review.classificationCandidates[0].action,'EXTEND_MODE');
  assert.equal(review.classificationCandidates[0].categoryId,remote);
  assert.equal(review.classificationCandidates[0].categoryLabel,'Analiza skupova podataka');
  assert.equal((await save(db,review)).profileStatus,'ACTIVE');
  assert.deepEqual(await authority(),{caps:0,modes:0}); assert.equal(await eligible(),false);
  assert.equal((await bind(db,review)).status,'BOUND_WORKER_SERVICES');
  assert.deepEqual(await authority(),{caps:1,modes:1}); assert.equal(await eligible(),true);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_aliases')).rows[0].n,0);
});
