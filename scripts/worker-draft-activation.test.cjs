'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture,CITY,proposals,capture}=require('./worker-draft-activation-fixture.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));

test('one saved service with BOTH modes preserves each mode without inventing handoff or location',async()=>{
 const f=await fixture();try{
  const service='Časovi engleskog jezika',categoryId='00000000-0000-4000-8000-000000000802';
  const ps=['ON_SITE','REMOTE'].map(mode=>({service,categoryId,action:'REUSE_EXISTING',mode,reason:'Synthetic existing two-mode service',...(mode==='REMOTE'?{handoff:{required:false}}:{})}));
  const d=await f.savedDraft({proposals:ps});await f.install();
  const ctx=await f.context(d);assert.equal(ctx.draftServices.length,2);assert.deepEqual(ctx.unresolvedServices,[]);
  const r=await f.prepare(d.reopened.conversationId);assert.equal(r.canAccept,true);assert.equal(r.classificationCandidates.length,2);
  assert.deepEqual(r.profile.skills,[service]);assert.deepEqual(r.reviewedServiceModes.map(p=>p.mode),['ON_SITE','REMOTE']);
  assert.equal((await f.save(r)).profileStatus,'ACTIVE');
 }finally{await f.db.close()}
});
test('generated operation rejects identity drift and rolls back all DDL on bad postcheck; rollback/reapply is exact',async()=>{
 const f=await fixture();try{
  const fs=require('node:fs'),path=require('node:path'),{source}=require('./worker-draft-activation-fixture.cjs');
  const read=n=>fs.readFileSync(path.join(__dirname,'sql',n),'utf8');
  const operation=JSON.parse(read('worker_draft_activation_20261109.operation-preimage.json'));
  const {render}=require('./sql/worker_draft_activation_20261109.build.cjs');
  // Deterministic isolated digest adapters test atomic package guards only.
  // Actual DEV equality prediction is captured separately, without mutation.
  for(const name of ['closure_source_v5','closure_erasure_source_v5']){
   await f.db.exec('create table if not exists private.'+name+'(singleton boolean primary key,sha256 text)');
   await f.db.query('insert into private.'+name+' values(true,$1) on conflict(singleton) do update set sha256=excluded.sha256',['fixture-stored-certificate']);
  }
  for(const [name,value] of [['closure_schema_digest_v5_139','fixture-schema'],['closure_source_digest_v5','fixture-source'],['closure_erasure_program_digest_v5','fixture-erasure']]){
   await f.db.exec('create or replace function private.'+name+"() returns text language sql as $$select '"+value+"'::text$$");
  }
  const functions=[];
  for(const fn of operation.functions){
   const metadata=await f.value(`select jsonb_build_object('signature',$1::text,'oid',p.oid::bigint,'body_md5',md5(p.prosrc),
    'definer',p.prosecdef,'volatility',p.provolatile,'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),
    'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,
    'argument_defaults',pg_get_expr(p.proargdefaults,0)) as value
    from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure($1)`,[fn.signature]);
   assert.ok(metadata,fn.signature);functions.push(metadata);
  }
  const preflight=read('worker_draft_activation_20261109.preflight.sql');
  const observer=preflight.slice(preflight.indexOf("select jsonb_build_object('relations'"),preflight.indexOf(' into observed;'));
  const environment=await f.value(observer+' as value');
  const snapshot={...operation,functions,...environment,closurePostimage:environment.closure};
  const files=render(snapshot,source),stem='worker_draft_activation_20261109';
  const bodies=()=>f.value("select jsonb_agg(jsonb_build_array(p.oid,md5(p.prosrc),p.proowner,p.proacl::text,p.proconfig) order by p.oid) as value from pg_proc p where p.oid=any(select to_regprocedure(x) from unnest($1::text[]) x)",[functions.map(x=>x.signature)]);
  const initial=await bodies();await f.db.exec(files[stem+'.preflight.sql']);
  const badId=clone(snapshot);badId.functions[0].oid++;
  await assert.rejects(f.db.exec(render(badId,source)[stem+'.promotion.sql']),/WORKER_DRAFT_ACTIVATION_FUNCTION_DRIFT/);
  assert.deepEqual(await bodies(),initial);
  const badPost=clone(snapshot);badPost.closurePostimage.erasureDigest='unrelated-change';
  await assert.rejects(f.db.exec(render(badPost,source)[stem+'.promotion.sql']),/WORKER_DRAFT_ACTIVATION_POSTIMAGE_ENVIRONMENT_DRIFT/);
  assert.deepEqual(await bodies(),initial);
  await f.db.exec(files[stem+'.promotion.sql']);await f.db.exec(files[stem+'.postflight.sql']);
  const promoted=await bodies();assert.notDeepEqual(promoted,initial);
  await assert.rejects(f.db.exec(files[stem+'.promotion.sql']),/WORKER_DRAFT_ACTIVATION_FUNCTION_DRIFT/);
  assert.deepEqual(await bodies(),promoted);
  await f.db.exec(files[stem+'.rollback.sql']);assert.deepEqual(await bodies(),initial);
  await f.db.exec(files[stem+'.promotion.sql']);assert.deepEqual(await bodies(),promoted);
 }finally{await f.db.close()}
});

async function signedMutation(f,review,fn){
 const envelope=await f.value('select envelope as value from private.worker_ai_reviews where id=$1',[review.reviewId]);
 fn(envelope);delete envelope.displayedContentDigest;
 await f.db.query("update private.worker_ai_reviews set envelope=$2::jsonb||jsonb_build_object('displayedContentDigest',encode(extensions.digest(($2::jsonb||jsonb_build_object('baseHash',base_hash))::text,'sha256'),'hex')) where id=$1",[review.reviewId,JSON.stringify(envelope)]);
}
async function rollbackCase(f,fn){await f.db.exec('begin');try{await fn()}finally{await f.db.exec('rollback')}}
test('real open/prepare/Save/reopen reproduces lost DRAFT identity; activation retains seven labels, IDs, areas and handoff without premature capability',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();
  assert.deepEqual(await f.authority(d),[0,0]);assert.deepEqual((await f.context(d)).draftServices,[]);
  const old=await f.prepare(d.reopened.conversationId);assert.equal(old.classificationState,'REVIEW_REQUIRED');assert.equal(old.canAccept,false);
  await assert.rejects(f.save(old),/WORKER_AI_STALE/);
  await f.install();
  const ctx=await f.context(d);assert.equal(ctx.draftServices.length,7);assert.deepEqual(ctx.savedServices,[]);assert.deepEqual(ctx.unresolvedServices,[]);
  assert.equal(await f.status(d),'DRAFT');assert.deepEqual(await f.authority(d),[0,0]);
  const r=await f.prepare(d.reopened.conversationId);
  assert.equal(r.canAccept,true);assert.equal(r.classificationState,'READY');assert.deepEqual(r.missingRequired,[]);
  assert.equal(r.profile.location.city,'');assert.deepEqual(r.profile.workAreas,[CITY]);
  assert.deepEqual(r.classificationCandidates.map(p=>[p.service,p.mode,p.categoryId,p.handoff]),d.review.classificationCandidates.map(p=>[p.service,p.mode,p.categoryId,p.handoff]));
  const request=crypto.randomUUID(),saved=await f.save(r,request);
  assert.equal(saved.profileStatus,'ACTIVE');assert.deepEqual(await f.save(r,request),saved);
  assert.deepEqual(await f.authority(d),[0,0]);
  await f.db.exec("set request.jwt.claim.role='service_role'");
  const batch=await f.value("select public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4) as value",[d.account,request,r.reviewId,JSON.stringify(r.classificationCandidates)]);
  assert.equal(batch.status,'COMMITTED');assert.equal(batch.items.length,7);
  const bound=await f.value('select public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4) as value',[d.account,request,r.reviewId,d.profile]);
  assert.equal(bound.status,'BOUND_WORKER_SERVICES');assert.equal(bound.serviceModeCount,7);
  assert.deepEqual(await f.authority(d),[6,6]);
  assert.deepEqual(await f.value('select to_jsonb(skills) as value from public.app_profiles where id=$1',[d.profile]),proposals.map(p=>p.service));
 }finally{await f.db.close()}
});
test('edited revision, removed service, new mode hint and changed current profile never resurrect a saved DRAFT',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();await f.install();
  for(const mutation of [
   ()=>f.db.query('update private.worker_ai_sessions set revision=1 where conversation_id=$1',[d.reopened.conversationId]),
   ()=>f.db.query("update private.worker_ai_sessions set candidate=jsonb_set(candidate,'{skills}',(candidate->'skills')-0) where conversation_id=$1",[d.reopened.conversationId]),
   async()=>{const id=crypto.randomUUID();await f.db.query("insert into private.work_taxonomy_gemini_turn_hints_v1(id,purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,catalog_version,proposals,payload_digest) values($1,'WORKER_CAPABILITY',$2,$3,$1,$1,$1,repeat('a',64),17,$4,repeat('b',64))",[id,d.account,d.reopened.conversationId,JSON.stringify([{...proposals[0],mode:'REMOTE'}])]);},
   async()=>{await f.db.query("update public.app_profiles set bio='Changed after Save' where id=$1",[d.profile]);await f.db.query("update private.worker_ai_sessions set candidate=private.worker_ai_initial(account_id),base_hash=private.worker_ai_source_hash(account_id) where conversation_id=$1",[d.reopened.conversationId]);}
  ])await rollbackCase(f,async()=>{await mutation();assert.deepEqual((await f.context(d)).draftServices,[]);assert.equal(await f.status(d),'DRAFT');assert.deepEqual(await f.authority(d),[0,0]);});
 }finally{await f.db.close()}
});
test('latest owned signed Save, digest, exact identity and catalog are independently required',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();await f.install();
  for(const mutation of [
   ()=>f.db.query("update private.worker_ai_saves set receipt=receipt||'{\"authoritative\":false}' where review_id=$1",[d.review.reviewId]),
   ()=>f.db.query("update private.worker_ai_saves set receipt=receipt||jsonb_build_object('accountId',extensions.gen_random_uuid()) where review_id=$1",[d.review.reviewId]),
   ()=>f.db.query("update private.worker_ai_reviews set envelope=envelope||'{\"displayedContentDigest\":\"tampered\"}' where id=$1",[d.review.reviewId]),
   ()=>f.db.query("update private.worker_ai_reviews set expires_at=created_at-interval '1 second' where id=$1",[d.review.reviewId]),
   ()=>f.db.exec('update private.work_taxonomy_control set catalog_version=catalog_version+1'),
   ()=>f.db.query("update private.work_taxonomy_categories set label=label||' renamed',canonical_key=private.taxonomy_normalize_v1(label||' renamed') where id=$1",[proposals[0].categoryId]),
   ()=>signedMutation(f,d.review,e=>e.classificationCandidates[0].categoryId=proposals[5].categoryId),
   ()=>signedMutation(f,d.review,e=>e.classificationCandidates[0].action='EXTEND_MODE'),
   ()=>signedMutation(f,d.review,e=>e.classificationCandidates[0].mode='REMOTE'),
   ()=>signedMutation(f,d.review,e=>e.classificationCandidates[5].handoff=null),
  ])await rollbackCase(f,async()=>{await mutation();assert.deepEqual((await f.context(d)).draftServices,[]);assert.deepEqual(await f.authority(d),[0,0]);});
 }finally{await f.db.close()}
});
test('an old review expired now remains usable only when the original Save occurred within its validity',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();await f.install();
  await f.db.query("update private.worker_ai_reviews set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' where id=$1",[d.review.reviewId]);
  await f.db.query("update private.worker_ai_saves set created_at=clock_timestamp()-interval '36 hours' where review_id=$1",[d.review.reviewId]);
  assert.equal((await f.context(d)).draftServices.length,7);
  assert.equal((await f.prepare(d.reopened.conversationId)).canAccept,true);
 }finally{await f.db.close()}
});
test('real REMOTE-only reactivation needs no fabricated city/area and preserves handoff',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft({proposals:proposals.filter(p=>p.mode==='REMOTE'),areas:[]});
  await f.install();const r=await f.prepare(d.reopened.conversationId);
  assert.equal(r.classificationState,'READY');assert.equal(r.canAccept,true);assert.deepEqual(r.profile.workAreas,[]);
  assert.equal(r.profile.location.city,'');assert.deepEqual(r.classificationCandidates[0].handoff,proposals.find(p=>p.mode==='REMOTE').handoff);
  assert.equal((await f.save(r)).profileStatus,'ACTIVE');assert.deepEqual(await f.authority(d),[0,0]);
 }finally{await f.db.close()}
});
test('valid area variants pass; absent/malformed area and legacy direct activation remain blocked',async()=>{
 const f=await fixture();try{
  await f.install();
  const variants=[[CITY],[{...CITY,kind:'RADIUS',label:'Novi Sad · do 20 km',radiusKm:20}],
   [{kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null}]];
  for(const areas of variants){const d=await f.savedDraft({areas});const r=await f.prepare(d.reopened.conversationId);assert.equal(r.canAccept,true);assert.equal((await f.save(r)).profileStatus,'ACTIVE');}
  const d=await f.savedDraft({areas:[]});const r=await f.prepare(d.reopened.conversationId);
  assert.equal(r.canAccept,false);assert.ok(r.missingRequired.includes('Mesto rada'));
  await assert.rejects(f.save(r),/WORKER_AI_STALE/);
  await assert.rejects(f.value('select public.rpc_complete_worker_profile($1) as value',[d.profile]),/CITY_REQUIRED/);
  await f.db.query("update private.worker_ai_sessions set candidate=jsonb_set(candidate,'{workAreas}',$2::jsonb) where conversation_id=$1",[d.reopened.conversationId,JSON.stringify([{...CITY,sourceRef:'invented'}])]);
  assert.equal((await f.prepare(d.reopened.conversationId)).canAccept,false);
 }finally{await f.db.close()}
});
test('signed activation stale catalog, changed profile, expiry and wrong digest fail atomically',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();await f.install();const r=await f.prepare(d.reopened.conversationId);
  for(const mutate of [
   ()=>f.db.exec('update private.work_taxonomy_control set catalog_version=catalog_version+1'),
   ()=>f.db.query("update public.app_profiles set bio='newer external edit' where id=$1",[d.profile]),
   ()=>f.db.query("update private.worker_ai_reviews set expires_at=clock_timestamp()-interval '1 second' where id=$1",[r.reviewId]),
  ])await rollbackCase(f,async()=>{await mutate();await f.db.exec('savepoint before_save');await assert.rejects(f.save(r),/WORKER_AI_STALE/);await f.db.exec('rollback to before_save');assert.equal(await f.status(d),'DRAFT');assert.deepEqual(await f.authority(d),[0,0]);});
  await rollbackCase(f,async()=>{
   await signedMutation(f,r,e=>e.profile.workAreas=[{...CITY,sourceRef:'invented'}]);
   const malformed=await f.value('select envelope as value from private.worker_ai_reviews where id=$1',[r.reviewId]);
   await f.db.query('update private.worker_ai_sessions set candidate=$2 where conversation_id=$1',[d.reopened.conversationId,JSON.stringify(malformed.profile)]);
   await f.db.exec('savepoint before_save');await assert.rejects(f.save(malformed),/WORKER_AREA_INVALID/);await f.db.exec('rollback to before_save');
   assert.equal(await f.status(d),'DRAFT');assert.deepEqual(await f.authority(d),[0,0]);
  });
  await assert.rejects(f.save({...r,displayedContentDigest:'wrong'}),/WORKER_AI_DENIED/);
 }finally{await f.db.close()}
});
test('source replacement preserves function identity and attributes; rollback restores the exact old behavior',async()=>{
 const f=await fixture();try{
  const d=await f.savedDraft();
  const names=['private.worker_ai_service_mode_context_v1','public.rpc_prepare_worker_ai_review_taxonomy','private.complete_worker_profile_v1'];
  const attrs=()=>f.value("select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl::text,p.prosecdef,p.provolatile,p.proisstrict,p.proleakproof,p.proparallel,p.proconfig,p.proargtypes::text,p.prorettype) order by p.oid) as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=any($1)",[names]);
  const before=await attrs();await f.install();assert.deepEqual(await attrs(),before);assert.equal((await f.context(d)).draftServices.length,7);
  for(const fn of capture.functions.filter(fn=>names.includes(fn.name)))await f.db.exec(fn.definition);
  assert.deepEqual(await attrs(),before);assert.deepEqual((await f.context(d)).draftServices,[]);
  await f.install();assert.equal((await f.context(d)).draftServices.length,7);
 }finally{await f.db.close()}
});
