'use strict';
// SOURCE-only SQL admission proof. Captured review/save rows are synthetic:
// this is not HTTP/Auth, real user confirmation, Android, RLS or DEV acceptance.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture:baseFixture,id,workerId,profileId}=require('./r09-worker-activation-fixture.cjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'sql',n),'utf8'));
const catalog=read('worker_catalog_conflict_20261109.preimage.json');
const capture=read('worker_shared_reuse_20261109.preimage.json');
const sql=fs.readFileSync(path.join(__dirname,'sql/worker_shared_reuse_20261109.sql'),'utf8');
const candidate=sql.slice(sql.indexOf('-- WORKER_SHARED_REUSE_ISOLATED_START'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const specific=catalog.proposals.filter((_,i)=>i!==2);
const pair=catalog.proposals.slice(0,2);
const body=f=>f.definition.split('AS $function$')[1].split('$function$')[0];

async function fixture(){
 const f=await baseFixture(),{db}=f;
 try{
  const t=capture.auditRelation;
  await db.exec('create table private.work_taxonomy_audit('+t.columns.map(c=>'"'+c.name+'" '+c.type+
   (c.identity?' generated always as identity':c.default?' default '+c.default:'')+(c.not_null?' not null':'')).join(',')+')');
  for(const c of t.constraints)await db.exec('alter table private.work_taxonomy_audit add constraint "'+c.name+'" '+c.definition);
  for(const fn of [...catalog.functions,...capture.functions]){
   assert.equal(md5(body(fn)),fn.body_md5,fn.signature);await db.exec(fn.definition);
  }
  await db.query('insert into private.work_taxonomy_control(singleton,catalog_version) values(true,$1)',[catalog.catalog.catalogVersion]);
  for(const c of catalog.catalog.categories)await db.query(`insert into private.work_taxonomy_categories(id,label,parent_id,canonical_key,state,source,catalog_version)
   values($1,$2,$3,$4,$5,$6,$7)`,[c.id,c.label,c.parent_id,c.canonical_key,c.state,c.source,c.catalog_version]);
  for(const m of catalog.catalog.modes)await db.query(`insert into private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) values($1,$2,'SOURCE fixture')`,[m.category_id,m.execution_scope]);
  for(const [i,a] of catalog.catalog.aliases.entries())await db.query(`insert into private.work_taxonomy_aliases(id,category_id,locale,label) values($1,$2,'sr',$3)`,[i+1,a.category_id,a.normalized_key]);
  for(const [i,r] of catalog.catalog.riskRules.entries())await db.query(`insert into private.work_taxonomy_risk_rules(id,pattern,decision,enabled) values($1,$2,$3,$4)`,[i+1,r.pattern,r.decision,r.enabled]);
  // Isolated JWT adapter only; no assertion of hosted Auth or role privileges.
  await db.exec("create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('role',current_setting('request.jwt.claim.role',true))$$;set request.jwt.claim.role='service_role';");
  let workerNumber=100;
  const makePlans=proposals=>proposals.map(p=>{
   const c=catalog.catalog.categories.find(c=>c.id===p.categoryId);
   const {parentId,proposedPath,...rest}=p;
   return {...rest,catalogVersion:catalog.catalog.catalogVersion,categoryLabel:c.label,categoryParentId:c.parent_id};
  });
  const resolve=async(proposals,purpose='WORKER_CAPABILITY',context={})=>{
   const hint=crypto.randomUUID(),anchors=[],seen=new Set();
   for(const p of proposals){let cid=['REUSE_EXISTING','EXTEND_MODE'].includes(p.action)?p.categoryId:p.parentId;
    while(cid&&!seen.has(cid)){const c=catalog.catalog.categories.find(c=>c.id===cid);assert.ok(c);seen.add(cid);anchors.push({categoryId:c.id,label:c.label,parentId:c.parent_id});cid=c.parent_id;}}
   const digest=sha(JSON.stringify(proposals));
   await db.query(`insert into private.work_taxonomy_gemini_turn_hints_v1
    (id,purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,catalog_version,proposals,payload_digest)
    values($1,$2,$3,$7,$1,$1,$1,$8,$5,$6,$4)`,[hint,purpose,context.account||workerId(999),digest,catalog.catalog.catalogVersion,JSON.stringify(proposals),context.conversation||hint,context.fingerprint||digest]);
   return f.value("select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,'ALLOW') as value",[hint,digest,JSON.stringify(anchors)]);
  };
  const review=async(plans,options={})=>{
   const n=++workerNumber,{account,profile,review:reviewId,request}=await f.addWorker(n,{status:'DRAFT',modes:['ON_SITE']});
   let projection,resolution;
   if(options.proposals){
    const conversation=crypto.randomUUID(),candidate={skills:options.proposals.map(p=>p.service)};
    await db.query(`insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate,revision)
     values($1,$2,$1,$3,'synthetic-base',$4,1)`,[conversation,account,profile,JSON.stringify(candidate)]);
    const fingerprint=await f.value("select encode(extensions.digest(candidate::text||'|'||revision::text||'|'||base_hash,'sha256'),'hex') as value from private.worker_ai_sessions where conversation_id=$1",[conversation]);
    resolution=await resolve(options.proposals,'WORKER_CAPABILITY',{account,conversation,fingerprint});
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','service_role',false)",[account]);
    projection=await f.value("select private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',$1,$2,$3,$4) as value",
     [JSON.stringify(candidate.skills),JSON.stringify(options.proposals.map(p=>({service:p.service,mode:p.mode}))),account,conversation]);
    if(projection.status!=='READY')return {projection,resolution};
    plans=projection.classificationCandidates;
   }
   const skills=plans.map(p=>p.service);
   await db.query(`update public.app_profiles set skills=$2,profile_status='ACTIVE',updated_at=statement_timestamp()-interval '1 minute' where id=$1`,[profile,skills]);
   await db.query(`delete from private.worker_execution_mode_choices where worker_profile_id=$1`,[profile]);
   const envelope={profile:{skills},profileId:profile,canAccept:true,classificationState:'READY',
    classificationCandidates:plans,reviewedServiceModes:plans.map(p=>({service:p.service,mode:p.mode})),
    classificationCatalogVersion:catalog.catalog.catalogVersion,
    classificationCatalogFingerprint:await f.value('select private.taxonomy_admission_fingerprint_v1() as value')};
   if(options.envelope)Object.assign(envelope,options.envelope);
   await db.query(`update private.worker_ai_reviews set envelope=$2 where id=$1`,[reviewId,JSON.stringify(envelope)]);
   await db.query(`update private.worker_ai_reviews set envelope=envelope||jsonb_build_object('displayedContentDigest',
    encode(extensions.digest((envelope||jsonb_build_object('baseHash',base_hash))::text,'sha256'),'hex')) where id=$1`,[reviewId]);
   await db.query(`update private.worker_ai_saves set receipt=$2,created_at=statement_timestamp() where review_id=$1`,
    [reviewId,JSON.stringify({saved:true,profileId:profile,profileStatus:'ACTIVE'})]);
   if(options.noSave)await db.query('delete from private.worker_ai_saves where review_id=$1',[reviewId]);
   const commit=(override={})=>f.value("select public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4) as value",
    [override.account||account,request,reviewId,JSON.stringify(override.plans||plans)]);
   const bind=()=>f.value('select public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4) as value',[account,request,reviewId,profile]);
   return {account,profile,review:reviewId,request,plans,commit,bind,projection,resolution};
  };
  const signatures=capture.functions.slice(0,1).map(fn=>fn.signature).concat([
   'private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)',
   'public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)']);
  const attributes=()=>f.value(`select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl::text,p.prosecdef,p.provolatile,p.proisstrict,p.proleakproof,p.proparallel,p.proconfig,p.proargtypes::text,p.prorettype) order by p.oid) as value
   from pg_proc p where p.oid=any(select to_regprocedure(x) from unnest($1::text[]) x)`,[signatures]);
  const install=async()=>{const before=await attributes();await db.exec(candidate);assert.deepEqual(await attributes(),before);};
  return {...f,resolve,review,makePlans,install};
 }catch(error){await db.close();throw error;}
}

test('old resolver and batch reject two distinct reviewed offers for one existing capability; source candidate retains both',async()=>{
 const f=await fixture();try{
  assert.equal((await f.resolve(pair)).code,'CATALOG_CONFLICT');
  const r=await f.review(f.makePlans(pair));
  await assert.rejects(r.commit(),/BATCH_DUPLICATE_CANONICAL_ID/);
  await f.install();
  const resolved=await f.resolve(pair);assert.equal(resolved.state,'RESOLVED');
  assert.deepEqual(resolved.items.map(x=>x.categoryId),pair.map(p=>p.categoryId));
  const committed=await r.commit();assert.equal(committed.status,'COMMITTED');
  assert.deepEqual(committed.items.map(x=>x.service),pair.map(p=>p.service));
  assert.equal(committed.createdCount,0);
  const bound=await r.bind();assert.equal(bound.status,'BOUND_WORKER_SERVICES');assert.equal(bound.serviceModeCount,2);
  assert.equal(await f.value(`select count(*)::int as value from private.work_taxonomy_worker_capabilities where worker_account_id=$1 and category_id=$2`,[r.account,pair[0].categoryId]),1);
  assert.equal(await f.value(`select count(*)::int as value from private.taxonomy_confirmed_worker_modes_v1 where worker_account_id=$1 and category_id=$2 and active`,[r.account,pair[0].categoryId]),1);
  assert.deepEqual(await f.value('select to_jsonb(skills) as value from public.app_profiles where id=$1',[r.profile]),pair.map(p=>p.service));
  const audit=await f.value('select count(*)::int as value from private.work_taxonomy_audit');
  assert.deepEqual(await r.commit(),committed);assert.deepEqual(await r.bind(),bound);
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'),audit);
  assert.equal(await f.value('select catalog_version as value from private.work_taxonomy_control'),catalog.catalog.catalogVersion);
  await assert.rejects(r.commit({plans:[...r.plans].reverse()}),/BATCH_REQUEST_KEY_REUSED/);
  for(const fn of capture.functions.filter(fn=>/taxonomy_resolve_turn_catalog_v1|taxonomy_review_exact_projection_v1|rpc_taxonomy_commit_reviewed_batch_service/.test(fn.signature)))await f.db.exec(fn.definition);
  assert.equal((await f.resolve(pair)).code,'CATALOG_CONFLICT');
  assert.deepEqual(await r.commit(),committed);assert.deepEqual(await r.bind(),bound);
  await f.install();assert.equal((await f.resolve(pair)).state,'RESOLVED');
 }finally{await f.db.close();}
});

test('all six specific original offers reach reviewed binding; broad seventh still requires clarification',async()=>{
 const f=await fixture();try{
  await f.install();
  const resolved=await f.resolve(specific);assert.equal(resolved.state,'RESOLVED');assert.equal(resolved.items.length,6);
  assert.equal((await f.resolve(catalog.proposals)).code,'CATALOG_SAFETY');
  const r=await f.review(null,{proposals:specific});assert.equal(r.projection.status,'READY');assert.equal((await r.commit()).items.length,6);
  assert.equal((await r.bind()).serviceModeCount,6);
  assert.equal(await f.value('select count(*)::int as value from private.taxonomy_confirmed_worker_modes_v1 where worker_account_id=$1 and active',[r.account]),5);
  const broad=await f.review(null,{proposals:catalog.proposals});
  assert.equal(broad.resolution.code,'CATALOG_SAFETY');assert.notEqual(broad.projection.status,'READY');
 }finally{await f.db.close();}
});

test('duplicate literal service, different handoff, non-reuse and Need purpose remain rejected',async()=>{
 const f=await fixture();try{
  await f.install();
  for(const proposals of [[pair[0],pair[0]],[pair[0],{...pair[0],service:'  KURIRSKE DOSTAVE  '}],[pair[0],{...pair[1],action:'EXTEND_MODE'}]]){
   assert.equal((await f.resolve(proposals)).code,'CATALOG_CONFLICT');
  }
  assert.equal((await f.resolve(pair,'NEED_SERVICE')).code,'CATALOG_CONFLICT');
  const literal=await f.review(f.makePlans([pair[0],pair[0]]));await assert.rejects(literal.commit(),/BATCH_DUPLICATE_SERVICE/);
  const remote=catalog.proposals[5];
  for(const handoff of [{required:true,shippingCountries:['RS']},null,undefined]){
   const other={...remote,service:'Priprema PowerPoint prezentacija',handoff};
   if(handoff===undefined)delete other.handoff;
   const remotePair=[remote,other];
   assert.equal((await f.resolve(remotePair)).code,'CATALOG_CONFLICT');
   const mismatch=await f.review(f.makePlans(remotePair));await assert.rejects(mismatch.commit(),/BATCH_HANDOFF_INVALID|BATCH_DUPLICATE_CANONICAL_ID/);
  }
 }finally{await f.db.close();}
});

test('review ownership, Save, unchanged signed content and stale identity still gate shared reuse',async()=>{
 const f=await fixture();try{
  await f.install();
  const missing=await f.review(f.makePlans(pair),{noSave:true});await assert.rejects(missing.commit(),/BATCH_EXISTING_USER_SAVE_REQUIRED/);
  const owned=await f.review(f.makePlans(pair));await assert.rejects(owned.commit({account:workerId(999)}),/BATCH_EXISTING_USER_SAVE_REQUIRED/);
  const changed=clone(owned.plans);changed[0].service='Drugi opis dostave';await assert.rejects(owned.commit({plans:changed}),/BATCH_REVIEW_NOT_BOUND/);
  await f.db.query('update private.work_taxonomy_categories set label=label||$2,canonical_key=private.taxonomy_normalize_v1(label||$2) where id=$1',[pair[0].categoryId,' izmenjeno']);
  await assert.rejects(owned.commit(),/BATCH_CATEGORY_IDENTITY_CHANGED/);
 }finally{await f.db.close();}
});
test('canonical plus registered alias passes actual projection and binder without changing either label',async()=>{
 const f=await fixture();try{
  const node=catalog.catalog.categories.find(c=>c.id===pair[0].categoryId);
  const alias='Brza dostava paketa';
  await f.db.query("insert into private.work_taxonomy_aliases(id,category_id,locale,label) values(10001,$1,'sr',$2)",[node.id,alias]);
  const proposals=[{...pair[0],service:node.label},{...pair[1],service:alias}];
  const blocked=await f.review(null,{proposals});assert.equal(blocked.projection.status,'REVIEW_REQUIRED');
  await f.install();
  const r=await f.review(null,{proposals});assert.equal(r.projection.status,'READY');assert.equal(r.resolution.state,'RESOLVED');
  assert.deepEqual(r.plans.map(x=>x.service),[node.label,alias]);
  assert.equal((await r.commit()).items.length,2);assert.equal((await r.bind()).serviceModeCount,2);
  assert.equal(await f.value('select count(*)::int as value from private.taxonomy_confirmed_worker_modes_v1 where worker_account_id=$1 and active',[r.account]),1);
  assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_aliases'),catalog.catalog.aliases.length+1);
 }finally{await f.db.close();}
});

test('prior explicit extension or created path cannot authorize a later same-target reuse',async()=>{
 const f=await fixture();try{
  await f.install();
  const extension=[{...pair[0],mode:'REMOTE',action:'EXTEND_MODE'},pair[1],
   {...pair[0],service:'Gradska dostava kupovine',mode:'REMOTE'}];
  assert.equal((await f.resolve(extension)).code,'CATALOG_CONFLICT');
  assert.equal(await f.value("select count(*)::int as value from private.work_taxonomy_category_modes where category_id=$1 and execution_scope='REMOTE'",[pair[0].categoryId]),0);
  await f.db.query("insert into private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) values($1,'REMOTE','Synthetic preexisting mode')",[pair[0].categoryId]);
  const r=await f.review(f.makePlans(extension));
  await f.db.exec('update private.work_taxonomy_control set catalog_version=catalog_version+1');
  await assert.rejects(r.commit(),/BATCH_DUPLICATE_CANONICAL_ID/);
  const node=catalog.catalog.categories.find(c=>c.id===pair[0].categoryId);
  const created={...pair[0],service:node.label,action:'CREATE_CHILD',categoryId:'',parentId:node.parent_id,proposedPath:[node.label]};
  assert.equal((await f.resolve([created,pair[1]])).code,'CATALOG_CONFLICT');
 }finally{await f.db.close();}
});

test('exact duplicate exemption still rejects individually broad, risky or nonleaf identities',async()=>{
 const f=await fixture();try{
  await f.install();
  const node=catalog.catalog.categories.find(c=>c.id===pair[0].categoryId);
  await f.db.query("insert into private.work_taxonomy_aliases(id,category_id,locale,label) values(10001,$1,'sr','Prodaja narkotika'),(10002,$1,'sr','Brza dostava paketa')",[node.id]);
  const project=services=>f.value("select private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',$1,$2) as value",
   [JSON.stringify(services),JSON.stringify(services.map(service=>({service,mode:'ON_SITE'})))]);
  const broadNode=catalog.catalog.categories.find(c=>c.id===catalog.proposals[2].categoryId);
  assert.equal((await project(['Fizički poslovi',broadNode.label])).status,'REVIEW_REQUIRED');
  assert.equal((await project([broadNode.label,'Fizički poslovi'])).status,'REVIEW_REQUIRED');
  const broadPlans=f.makePlans([{...catalog.proposals[2]},{...catalog.proposals[2],service:broadNode.label}]);
  const broadSigned=await f.review(broadPlans);await assert.rejects(broadSigned.commit(),/BATCH_DUPLICATE_CANONICAL_ID/);
  assert.equal((await project(['Prodaja narkotika',node.label])).status,'REVIEW_REQUIRED');
  assert.equal((await project([node.label,'Prodaja narkotika'])).status,'REVIEW_REQUIRED');
  await f.db.query("insert into private.work_taxonomy_categories(id,label,parent_id,canonical_key,state,source,catalog_version) values($1,'Specifična dostava',$2,private.taxonomy_normalize_v1('Specifična dostava'),'ESTABLISHED','SYSTEM',17)",[id('a0000000',1),node.id]);
  assert.equal((await project([node.label,'Brza dostava paketa'])).status,'REVIEW_REQUIRED');
 }finally{await f.db.close();}
});
test('REMOTE offers with the identical valid handoff retain both signed labels and one mode row',async()=>{
 const f=await fixture();try{
  await f.install();
  const remote=catalog.proposals[5],proposals=[remote,{...remote,service:'Priprema PowerPoint prezentacija'}];
  const r=await f.review(null,{proposals});
  assert.equal(r.projection.status,'READY');assert.equal(r.resolution.state,'RESOLVED');
  assert.deepEqual(r.plans.map(p=>p.handoff),[{required:false},{required:false}]);
  assert.equal((await r.commit()).items.length,2);assert.equal((await r.bind()).serviceModeCount,2);
  const modes=await f.value('select jsonb_agg(jsonb_build_object(\'category\',category_id,\'mode\',execution_scope,\'handoff\',handoff)) as value from private.taxonomy_confirmed_worker_modes_v1 where worker_account_id=$1 and active',[r.account]);
  assert.deepEqual(modes,[{category:remote.categoryId,mode:'REMOTE',handoff:{required:false}}]);
 }finally{await f.db.close();}
});
test('generated operation guards and DDL are atomic; drift rejects before writes, rollback and reapply preserve attributes',async()=>{
 const f=await fixture();try{
  // This checks the SAME package renderer/DO blocks against isolated metadata.
  // OIDs, ACLs and closure hashes are fixture values, not simulated DEV proof.
  // Live closure predictions are separately derived read-only from its exact
  // existing digest expressions; these deterministic stand-ins only exercise
  // the package's equality guards and transactional rollback mechanics.
  const operation=read('worker_shared_reuse_20261109.operation-preimage.json');
  const {render}=require('./sql/worker_shared_reuse_20261109.build.cjs');
  const oldBatch=operation.functions.find(x=>x.signature.startsWith('rpc_taxonomy_commit')).body_md5;
  for(const name of ['closure_source_v5','closure_erasure_source_v5']){
   await f.db.exec('create table if not exists private.'+name+'(singleton boolean primary key,sha256 text)');
   await f.db.query('insert into private.'+name+' values(true,$1) on conflict(singleton) do update set sha256=excluded.sha256',['fixture-stored-certificate']);
  }
  await f.db.exec("create or replace function private.closure_schema_digest_v5_139() returns text language sql as $$select 'fixture-schema'::text$$");
  for(const [name,label] of [['closure_source_digest_v5','source'],['closure_erasure_program_digest_v5','erasure']]){
   await f.db.exec("create or replace function private."+name+"() returns text language sql as $$select case when (select md5(prosrc) from pg_proc where oid='public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure)='"+oldBatch+"' then 'fixture-"+label+"-before' else 'fixture-"+label+"-after' end$$");
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
   assert.ok(metadata);functions.push(metadata);
  }
  const preflight=fs.readFileSync(path.join(__dirname,'sql/worker_shared_reuse_20261109.preflight.sql'),'utf8');
  const observer=preflight.slice(preflight.indexOf("select jsonb_build_object('relations'"),preflight.indexOf(' into observed;'));
  const environment=await f.value(observer+' as value');
  const fixtureCapture={...operation,functions,...environment,
   closurePostimage:{...environment.closure,sourceDigest:'fixture-source-after',erasureDigest:'fixture-erasure-after'}};
  const files=render(fixtureCapture,sql);
  const pre=files['worker_shared_reuse_20261109.preflight.sql'],promote=files['worker_shared_reuse_20261109.promotion.sql'],
   post=files['worker_shared_reuse_20261109.postflight.sql'],rollback=files['worker_shared_reuse_20261109.rollback.sql'];
  const bodies=()=>f.value("select jsonb_agg(jsonb_build_array(p.oid,md5(p.prosrc),p.proowner,p.proacl::text,p.proconfig) order by p.oid) as value from pg_proc p where p.oid=any(select to_regprocedure(x) from unnest($1::text[]) x)",[functions.map(x=>x.signature)]);
  const initial=await bodies();await f.db.exec(pre);
  const wrongOid=clone(fixtureCapture);wrongOid.functions[0].oid+=1;
  await assert.rejects(f.db.exec(render(wrongOid,sql)['worker_shared_reuse_20261109.promotion.sql']),/WORKER_SHARED_REUSE_FUNCTION_DRIFT/);
  assert.deepEqual(await bodies(),initial);
  const badPost=clone(fixtureCapture);badPost.closurePostimage.erasureDigest='unrelated-closure-change';
  await assert.rejects(f.db.exec(render(badPost,sql)['worker_shared_reuse_20261109.promotion.sql']),/WORKER_SHARED_REUSE_POSTIMAGE_ENVIRONMENT_DRIFT/);
  assert.deepEqual(await bodies(),initial);
  await f.db.exec(promote);await f.db.exec(post);
  const promoted=await bodies();assert.notDeepEqual(promoted,initial);
  await assert.rejects(f.db.exec(promote),/WORKER_SHARED_REUSE_FUNCTION_DRIFT/);
  assert.deepEqual(await bodies(),promoted);
  await f.db.exec(rollback);assert.deepEqual(await bodies(),initial);await f.db.exec(pre);
  await f.db.exec(promote);assert.deepEqual(await bodies(),promoted);
 }finally{await f.db.close();}
});
