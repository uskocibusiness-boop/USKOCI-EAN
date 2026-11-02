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
    'worker-remote-semantic-activation-local-only.sql','worker-semantic-readback-local-only.sql']) await db.exec(read(file));
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
