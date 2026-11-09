'use strict';
// Real SQL owners, synthetic rows. No HTTP/Auth provider, queue or push proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {fixture:baseFixture,workerId,profileId}=require('./r09-worker-activation-fixture.cjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'sql',n),'utf8'));
const capture=read('worker_draft_activation_20261109.preimage.json'),dependencies=read('worker_draft_activation_20261109.dependencies.json');
const catalog=read('worker_catalog_conflict_20261109.preimage.json'),shared=read('worker_shared_reuse_20261109.preimage.json');
const source=fs.readFileSync(path.join(__dirname,'sql/worker_draft_activation_20261109.sql'),'utf8');
const currentShared=fs.readFileSync(path.join(__dirname,'sql/worker_shared_reuse_20261109.sql'),'utf8');
const CITY={kind:'CITY',countryCode:'RS',label:'Novi Sad',city:'Novi Sad',latitude:45.26,longitude:19.85,sourceRef:'osm:relation:9273976',radiusKm:null};
const proposals=catalog.proposals.map((p,i)=>i===2?{...p,service:'Ručno iznošenje kutija i nošenje nameštaja bez prevoza'}:p);
async function fixture(){
 const f=await baseFixture(),{db}=f;
 try{
  await db.exec('set check_function_bodies=off');
  for(const fn of [...catalog.functions,...shared.functions,...capture.functions,...dependencies.functions]){
   assert.equal(crypto.createHash('md5').update(fn.definition.split('AS $function$')[1].split('$function$')[0]).digest('hex'),fn.body_md5);
   await db.exec(fn.definition);
  }
  await db.exec(currentShared.slice(currentShared.indexOf('-- WORKER_SHARED_REUSE_ISOLATED_START')));
  await db.exec('set check_function_bodies=on');
  await db.exec("create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('role',current_setting('request.jwt.claim.role',true))$$");
  await db.query('insert into private.work_taxonomy_control(singleton,catalog_version) values(true,$1)',[catalog.catalog.catalogVersion]);
  for(const c of catalog.catalog.categories)await db.query('insert into private.work_taxonomy_categories(id,label,parent_id,canonical_key,state,source,catalog_version) values($1,$2,$3,$4,$5,$6,$7)',[c.id,c.label,c.parent_id,c.canonical_key,c.state,c.source,c.catalog_version]);
  for(const m of catalog.catalog.modes)await db.query("insert into private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) values($1,$2,'SOURCE fixture')",[m.category_id,m.execution_scope]);
  for(const [i,a] of catalog.catalog.aliases.entries())await db.query("insert into private.work_taxonomy_aliases(id,category_id,locale,label) values($1,$2,'sr',$3)",[i+1,a.category_id,a.normalized_key]);
  for(const [i,r] of catalog.catalog.riskRules.entries())await db.query('insert into private.work_taxonomy_risk_rules(id,pattern,decision,enabled) values($1,$2,$3,$4)',[i+1,r.pattern,r.decision,r.enabled]);
  const audit=shared.auditRelation;
  await db.exec('create table private.work_taxonomy_audit('+audit.columns.map(c=>'"'+c.name+'" '+c.type+(c.identity?' generated always as identity':c.default?' default '+c.default:'')+(c.not_null?' not null':'')).join(',')+')');
  for(const c of audit.constraints)await db.exec('alter table private.work_taxonomy_audit add constraint "'+c.name+'" '+c.definition);
  // The real source-continuity trigger is necessary for reopening a saved
  // draft. Async queue triggers are outside this isolated synchronous proof.
  await db.exec('CREATE TRIGGER worker_ai_area_source_continuity_v1 AFTER INSERT ON private.worker_ai_saves FOR EACH ROW EXECUTE FUNCTION private.worker_ai_area_source_continuity_v1()');
  const auth=account=>db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[account]);
  const open=()=>f.value('select public.rpc_open_worker_ai($1) as value',[crypto.randomUUID()]);
  const prepare=(conv,revision=0,activate=true)=>f.value('select public.rpc_prepare_worker_ai_review_taxonomy($1,$2,$3) as value',[conv,revision,activate]);
  const save=(review,request=crypto.randomUUID())=>f.value('select public.rpc_save_worker_ai_review($1,$2,$3) as value',[review.reviewId,review.displayedContentDigest,request]);
  let n=200;
  async function savedDraft(opts={}){
   const number=++n,account=workerId(number),profile=profileId(number);
   await db.query("insert into public.app_accounts(id,full_name) values($1,'Synthetic saved draft')",[account]);
   await db.query("insert into public.app_profiles(id,account_id,kind,display_name,profile_status,skills) values($1,$2,'WORKER','Synthetic saved draft','DRAFT','{}')",[profile,account]);
   await db.query("insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values($1,'SYNTHETIC_ACCEPTANCE_FIXTURE','Isolated SQL proof','DRAFT activation fixture')",[account]);
   await auth(account);
   const first=await open(),ps=opts.proposals||proposals;
   const candidate={...first.candidate,skills:[...new Set(ps.map(p=>p.service))],workAreas:opts.areas??[CITY]};
   await db.query('update private.worker_ai_sessions set candidate=$2,revision=1 where conversation_id=$1',[first.conversationId,JSON.stringify(candidate)]);
   const fingerprint=await f.value("select encode(extensions.digest(candidate::text||'|'||revision::text||'|'||base_hash,'sha256'),'hex') as value from private.worker_ai_sessions where conversation_id=$1",[first.conversationId]);
   const hint=crypto.randomUUID(),digest=crypto.createHash('sha256').update(JSON.stringify(ps)).digest('hex'),anchors=[],seen=new Set();
   for(const p of ps){let cid=p.categoryId;while(cid&&!seen.has(cid)){const c=catalog.catalog.categories.find(c=>c.id===cid);assert.ok(c);seen.add(cid);anchors.push({categoryId:c.id,label:c.label,parentId:c.parent_id});cid=c.parent_id;}}
   await db.query("insert into private.work_taxonomy_gemini_turn_hints_v1(id,purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,catalog_version,proposals,payload_digest) values($1,'WORKER_CAPABILITY',$2,$3,$1,$1,$1,$4,$5,$6,$7)",[hint,account,first.conversationId,fingerprint,catalog.catalog.catalogVersion,JSON.stringify(ps),digest]);
   await db.exec("set request.jwt.claim.role='service_role'");
   const resolution=await f.value("select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,'ALLOW') as value",[hint,digest,JSON.stringify(anchors)]);
   await auth(account);
   assert.equal(resolution.state,'RESOLVED');
   const review=await prepare(first.conversationId,1,false);
   assert.equal(review.classificationState,'READY');assert.equal(review.canAccept,true);
   const receipt=await save(review);
   assert.equal(receipt.profileStatus,'DRAFT');
   const reopened=await open();
   return {account,profile,first,review,receipt,reopened,proposals:ps};
  }
  const context=d=>f.value('select private.worker_ai_service_mode_context_v1($1,$2) as value',[d.account,d.reopened.conversationId]);
  const status=d=>f.value('select profile_status as value from public.app_profiles where id=$1',[d.profile]);
  const authority=d=>f.value('select jsonb_build_array((select count(*) from private.taxonomy_confirmed_worker_modes_v1 where worker_account_id=$1 and active),(select count(*) from private.work_taxonomy_worker_capabilities where worker_account_id=$1 and not excluded)) as value',[d.account]);
  const install=()=>db.exec(source.slice(source.indexOf('-- WORKER_DRAFT_ACTIVATION_ISOLATED_START')));
  return {...f,auth,open,prepare,save,savedDraft,context,status,authority,install};
 }catch(e){await db.close();throw e}
}
module.exports={fixture,CITY,proposals,capture,source};
