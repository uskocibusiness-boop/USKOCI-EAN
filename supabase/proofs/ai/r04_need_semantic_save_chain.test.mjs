// Connected isolated Need boundary: actual signed prepare -> current mobile
// decoder -> actual accept/save -> owned read. No DEV/live provider/Auth HTTP/native.
// Reuses the existing R08 schema/extractors; synthetic auth/closure and policy
// are explicit. REMOTE has no PostGIS point; no geographic/hosted-RLS claim.
// The positive cases add actual Edge/SQL evaluation and canonical publication.
// Policy content, provider output, Auth transport and budget are synthetic;
// no decision, publication state, dispatch row or canonical receipt is fabricated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {postimages} from '../../operations/dev-alpha/r04-semantic-admission-20261101/build.mjs';

const proof=new URL('./r08_remote_only_activation.test.mjs',import.meta.url);
const text=readFileSync(proof,'utf8');
const marker="test('baseline reproduces both first-save blockers;";
assert.ok(text.includes(marker));
let fixture=text.slice(0,text.indexOf(marker)).replaceAll('import.meta.url',JSON.stringify(proof.href))
 .replace('../../../src/data/workerAiClientService.ts','../../../src/data/aiTaskReviewClientService.ts')
 .replace('function mobileDecoder(){','function mobileDecoder(io={}){')
 .replace('vm.createContext({Intl,Date,process:{env:{}}})','vm.createContext({Intl,Date,AbortController,setTimeout,clearTimeout,process:{env:{}}})')
 .replace('{sesijaSada:noIo}','{sesijaSada:io.session??noIo}')
 .replace('{supabaseKlijent:noIo}','{supabaseKlijent:io.client??noIo}');
for(const name of ['@electric-sql/pglite','@electric-sql/pglite/contrib/pgcrypto','typescript'])
 fixture=fixture.replaceAll(`from '${name}'`,'from '+JSON.stringify(import.meta.resolve(name)));
fixture+='\nexport {setup,tableSql,sqlFunction,mobileDecoder,owner,other,remote};';
const {setup,tableSql,sqlFunction,mobileDecoder,owner,other,remote}
 =await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const cid='00000000-0044-4444-8444-000000000001',profile='00000000-0044-4444-8444-000000000002';
const request='00000000-0044-4444-8444-000000000003';
const one=async(db,sql,args=[]) => (await db.query(sql,args)).rows[0];
const prepare=async db=>(await one(db,'SELECT public.rpc_prepare_ai_task_review_taxonomy($1) result',[cid])).result;
const accept=(db,r,key=request)=>db.query('SELECT public.rpc_accept_ai_task_review($1,$2,$3) result',[r.reviewId,r.displayedContentDigest,key]);

// Reuse the actual Edge VM loader, substituting only its HTTP boundaries.
const edgeProof=new URL('../policy/publication_evaluator_edge.test.mjs',import.meta.url);
const edgeText=readFileSync(edgeProof,'utf8');
const edgeMarker="test('owned same-JWT context";
assert.ok(edgeText.includes(edgeMarker));
const edgeSource=edgeText.slice(0,edgeText.indexOf(edgeMarker))
 .replaceAll('import.meta.url',JSON.stringify(edgeProof.href))
 .replace("from 'typescript'",'from '+JSON.stringify(import.meta.resolve('typescript')))+'\nexport {fixture};';
const {fixture:edgeFixture}=await import('data:text/javascript;base64,'+Buffer.from(edgeSource).toString('base64'));

async function publicationFixture(db){
 for(const name of ['private.need_publication_decisions','private.need_publish_commands','private.dispatch_schedule',
  'private.closure_redaction_certificate_v5','private.closure_executions_v5','private.closure_actions_v5'])await db.exec(tableSql(name));
 await db.exec(`CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
 SELECT current_setting('request.jwt.claim.role',true)$f$;`);
 for(const name of ['private.publication_policy_bundle_ready','private.current_publication_policy_bundle',
  'private.publication_policy_document','private.ai_task_review_policy','private.need_publication_location_readiness',
  'private.need_publication_fingerprint_snapshot','private.need_publication_context','public.rpc_get_need_publication_context',
  'public.rpc_claim_ai_task_review_evaluation_service','public.rpc_record_need_publication_decision_service',
  'public.rpc_complete_ai_task_review_evaluation_service','private.task_replacement_origin','private.finalize_task_replacement',
  'private.enqueue_dispatch','private.enqueue_on_need_change','private.closure_redaction_allowed_v5','private.guard_need_write',
  'private.reject_need_publication_decision_mutation','public.rpc_publish_need_canonical'])await db.exec(sqlFunction(name));
 await db.exec(`CREATE TRIGGER needs_enqueue_dispatch AFTER INSERT OR UPDATE OF status,revision ON public.needs
 FOR EACH ROW EXECUTE FUNCTION private.enqueue_on_need_change();
 CREATE TRIGGER needs_guard_write BEFORE INSERT OR UPDATE ON public.needs FOR EACH ROW EXECUTE FUNCTION private.guard_need_write();
 CREATE TRIGGER need_publication_decisions_immutable BEFORE DELETE OR UPDATE ON private.need_publication_decisions
 FOR EACH ROW EXECUTE FUNCTION private.reject_need_publication_decision_mutation();
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;`);
 // Same disposable-only policy/content binding pattern as the existing W05
 // proof. This is explicitly NOT legal policy review or a DEV activation.
 const head={schemaVersion:'USKOCI_PUBLICATION_POLICY_V1',instructions:'SYNTHETIC DISPOSABLE TEST ONLY. No legal or production authority.'};
 const rule={instructions:'SYNTHETIC TRANSPORT RULE ONLY.',outcomes:['ALLOW','CLARIFY','REVIEW','BLOCK'],safeReasonCodes:[]};
 const bundle=(await one(db,`INSERT INTO private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,reviewed_at,activated_at,review_provenance)
 VALUES('RS_PUBLICATION_POLICY_MINIMUM',1,'RS',true,true,true,statement_timestamp(),statement_timestamp(),
 jsonb_build_object('testBoundary','DISPOSABLE_SYNTHETIC_ONLY','evaluatorPolicy',$1::jsonb)) RETURNING id`,[JSON.stringify(head)])).id;
 await db.query(`INSERT INTO private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
 VALUES($1,'SYNTHETIC_RULE_1',jsonb_build_object('evaluation',$2::jsonb))`,[bundle,JSON.stringify(rule)]);
 await db.query(`UPDATE private.publication_policy_bundles SET review_provenance=review_provenance||jsonb_build_object(
 'evaluatorContentSha256',encode(extensions.digest(convert_to($2::jsonb::text,'UTF8'),'sha256'),'hex')) WHERE id=$1`,
 [bundle,JSON.stringify({...head,rules:[{ruleId:'SYNTHETIC_RULE_1',...rule}]})]);
 assert.ok((await one(db,'SELECT private.publication_policy_document($1) doc',[bundle])).doc);
}

function connectedEvaluator(db,{loseCompletionAck=false}={}){
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 // This explicit allowlist maps transport to actual SQL routines. No dynamic
 // identifier comes from the handler or provider; all request arguments pass
 // unchanged through named SQL parameters.
 const args={
  rpc_get_need_publication_context:['p_need_id','p_expected_revision'],
  rpc_claim_ai_task_review_evaluation_service:['p_account_id','p_review_id','p_need_id','p_need_revision','p_binding'],
  rpc_complete_ai_task_review_evaluation_service:['p_account_id','p_review_id','p_attempt_id','p_outcome','p_rule_ids','p_safe_reason_codes','p_provider_ref','p_model_ref','p_not_ready_code'],
  rpc_read_ai_task_review:['p_review_id'],rpc_publish_accepted_ai_task_review:['p_review_id','p_client_request_id'],
 };
 const invokeSql=async(name,body,service=false)=>{
  assert.ok(Object.hasOwn(args,name),name);assert.deepEqual(Object.keys(body).sort(),[...args[name]].sort());
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[owner,service?'service_role':'authenticated']);
  if(!service)await db.exec('SET ROLE authenticated');
  try{return {data:(await one(db,`SELECT public.${name}(${args[name].map((key,i)=>key+' => $'+(i+1)).join(',')}) result`,
   args[name].map(key=>key==='p_binding'?JSON.stringify(body[key]):body[key]))).result,error:null};}
  catch(e){return {data:null,error:{message:e.message,code:e.code}};}
  finally{await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");}
 };
 const transport=async(call,service=false)=>{
  assert.equal(call.headers.authorization,service?'Bearer SYNTHETIC_SERVICE_SECRET':'Bearer SYNTHETIC_USER_SESSION');
  const name=new URL(call.url).pathname.split('/').at(-1),body=JSON.parse(call.body);
  const r=await invokeSql(name,body,service);
  if(r.error)return json(r.error,400);
  if(loseCompletionAck&&name==='rpc_complete_ai_task_review_evaluation_service')throw new Error('SYNTHETIC_LOST_COMPLETION_ACK');
  return json(r.data);
 };
 const edge=edgeFixture({auth:()=>json({id:owner,role:'authenticated'}),context:call=>transport(call),
  reviewClaim:call=>transport(call,true),reviewComplete:call=>transport(call,true),
  writer:()=>assert.fail('ACCEPTED_REVIEW_MUST_USE_ACTUAL_COMPLETION_WRAPPER'),
  provider:()=>json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify({outcome:'ALLOW',ruleIds:['SYNTHETIC_RULE_1'],safeReasonCodes:[]})}]}}]})});
 const client={rpc:(name,body)=>invokeSql(name,body),auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'SYNTHETIC_USER_SESSION'}},error:null})},
  functions:{invoke:async(name,{body})=>{assert.equal(name,'uskoci-publication-evaluate');const r=await edge.invoke({body});return {data:await r.json(),error:r.ok?null:{message:'EDGE_FAILED'}};}}};
 const mobile=mobileDecoder({session:()=>({user:{id:owner},accountRevision:1}),client:()=>client});
 return {edge,mobile};
}

async function needFixture(t){
 const db=await setup(t,{patched:false});
 const tables=['public.ai_messages','public.ai_structured_facts','private.ai_need_turn_commands',
  'private.need_fact_registry','private.ai_task_reviews','private.ai_task_review_commands','private.need_draft_save_commands',
  'private.owned_media_assets','private.publication_policy_bundles','private.publication_policy_rule_refs',
  'private.location_market_configs','public.need_geography','public.need_sensitive','public.need_requirement_details',
  'private.work_taxonomy_risk_rules','private.work_taxonomy_audit','private.work_taxonomy_need_bindings_v1'];
 for(const name of tables)await db.exec(tableSql(name));
 // The inherited empty needs fixture has no spatial engine. Preserve the
 // captured non-spatial columns/defaults and a NULL-only placeholder, so this
 // exact REMOTE scenario cannot claim PostGIS or non-REMOTE behavior.
 let needs=tableSql('public.needs');
 const spatial=/  "approx_geog" extensions\.geography\(Point,4326\) GENERATED ALWAYS AS \([\s\S]*?\) STORED,/;
 assert.match(needs,spatial);
 needs=needs.replace(spatial,'  "approx_geog" jsonb CHECK (approx_geog IS NULL),');
 await db.exec('DROP FUNCTION private.assert_application_price_v5(public.needs,integer,integer);DROP TABLE public.needs;'+needs);
 await db.exec(`CREATE FUNCTION private.need_edit_base_marker(uuid) RETURNS text LANGUAGE plpgsql AS $f$
 BEGIN RAISE EXCEPTION 'UNEXPECTED_BOUND_NEED_EDIT';END$f$;
 CREATE FUNCTION private.ai_task_review_policy(text) RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('fixture','R04_NEED_REMOTE_BOUNDARY','country',$1)$f$;`);
 const functions=['private.location_text_valid','private.location_private_text_valid','private.normalize_location_point','private.require_location_country',
  'private.normalize_task_geography','private.normalize_resolved_location','private.normalize_need_location',
  'private.taxonomy_handoff_display_v1','private.taxonomy_category_path_valid_v1','private.need_v2_location_ref_valid',
  'private.validate_need_v2_fact_pre_fastest_retirement','private.validate_need_v2_fact_pre_location',
  'private.validate_need_v2_fact_pre_country','private.validate_need_v2_fact',
  'private.media_task_refs','private.media_refs_ready','private.ai_task_review_source_before_media','private.ai_task_review_source',
  'private.need_location_review_document','public.rpc_ai_need_review_v2','public.rpc_prepare_ai_task_review_taxonomy',
  'public.rpc_ai_confirm_fact','public.rpc_save_need_location_review','private.materialize_resolved_location',
  'public.rpc_save_need_draft_from_review','private.ai_task_review_command_document','public.rpc_accept_ai_task_review',
  'public.rpc_read_ai_task_review','public.rpc_publish_accepted_ai_task_review',
  'public.fn_need_covered_slots','public.covered_slots','public.rpc_storage_account_open',
  'private.need_candidate_states_v5','public.selectable_application_count','public.rpc_read_task',
  'private.taxonomy_execution_scope_v1','private.needs_sync_taxonomy_category_trigger_fn',
  'public.rpc_taxonomy_bind_reviewed_need_service'];
 for(const name of functions)await db.exec(sqlFunction(name));
 await db.exec(`INSERT INTO private.location_market_configs VALUES('RS','BUILDING','RSD','sr-Latn','Europe/Belgrade');
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
 -- Synthetic own-row visibility fixture, not the actual hosted RLS policy.
 ALTER TABLE public.needs ENABLE ROW LEVEL SECURITY;
 CREATE POLICY test_owned_need ON public.needs FOR SELECT TO authenticated USING (requester_account_id=auth.uid());
 GRANT SELECT ON public.needs,public.marketplace_responses,public.need_geography,public.need_requirement_details TO authenticated;
 CREATE TRIGGER needs_sync_taxonomy_category_trg BEFORE INSERT OR UPDATE OF category ON public.needs
 FOR EACH ROW EXECUTE FUNCTION private.needs_sync_taxonomy_category_trigger_fn();
 CREATE TRIGGER taxonomy_enqueue_need_accepted_v1 AFTER INSERT ON private.ai_task_review_commands
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_queue_review_after_save_v1();
 CREATE TRIGGER taxonomy_pending_need_save_v1 AFTER INSERT OR UPDATE OF state ON private.ai_task_review_commands
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_pending_saved_event_v1();`);
 const old=readFileSync(new URL('./currency_correction_characterization.test.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const start=old.indexOf('const registry=')+'const registry='.length,end=old.indexOf(';\nconst db=',start);
 const registry=JSON.parse(old.slice(start,end).trim());
 registry.push({fact_key:'need.handoff',schema_version:'NEED_FACT_V2',value_type:'OBJECT',required_for_draft:false,privacy_class:'PUBLIC',material:true,target_owner:'need_requirement_details.handoff'});
 for(const row of registry)await db.query('INSERT INTO private.need_fact_registry SELECT * FROM jsonb_populate_record(NULL::private.need_fact_registry,$1::jsonb)',[JSON.stringify(row)]);
 await db.query("INSERT INTO public.app_profiles(id,account_id,kind,profile_status,display_name,bio,skills) VALUES($1,$2,'REQUESTER','ACTIVE','Mila','','{}')",[profile,owner]);
 await db.query("INSERT INTO public.ai_conversations(id,account_id,purpose,status,fact_schema_version) VALUES($1,$2,'NEED_INTAKE','OPEN','NEED_FACT_V2')",[cid,owner]);
 const facts={'need.title':'Lektura kratkog teksta','need.description':'Potrebna lektura kratkog teksta na srpskom jeziku.',
  'need.category':'Lektura','need.people_needed':1,'need.price_mode':'OFFERS','need.schedule_kind':'FLEXIBLE',
  'need.task_country_code':'RS','need.task_geography':{mode:'REMOTE'},'need.handoff':{required:false}};
 for(const [key,value]of Object.entries(facts)){
  const spec=registry.find(r=>r.fact_key===key);
  await db.query(`INSERT INTO public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope,fact_schema_version,value_type,display_value)
   VALUES($1,$2,$3,$4::jsonb,'NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT','NEED_FACT_V2',$5,$6)`,
   [owner,cid,key,JSON.stringify(value),spec.value_type,typeof value==='object'?JSON.stringify(value):String(value)]);
 }
 await db.query("INSERT INTO public.ai_messages(account_id,conversation_id,role,body,safety) VALUES($1,$2,'ASSISTANT','Synthetic completed intake','ALLOW')",[owner,cid]);
 await db.query("UPDATE private.work_taxonomy_categories SET canonical_key='lektura tekstova',label='Lektura tekstova' WHERE id=$1",[remote]);
 await db.query(`INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,client_request_id,turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
 VALUES($1,$2,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),repeat('a',64),'NEED_SERVICE',
 encode(extensions.digest(private.ai_task_review_source($2)::text,'sha256'),'hex'),1,$3::jsonb)`,
 [owner,cid,JSON.stringify([{action:'REUSE_EXISTING',service:'Lektura',mode:'REMOTE',categoryId:remote,parentId:'',proposedPath:[],catalogVersion:1,reason:'Isti konkretan posao lekture teksta',handoff:{required:false}}])]);
 return db;
}

async function installDeadline(db){
 const sql=readFileSync(new URL('../../../docs/candidates/task-ai-deadline-20261021/forward_candidate.sql',import.meta.url),'utf8');
 const defs=[...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (?:public|private)\.[\s\S]*?\$function\$;/g)].map(m=>m[0]);
 for(const def of defs.filter(d=>!d.includes('FUNCTION public.rpc_ai_open_need_edit_conversation_v2(')))await db.exec(def);
 await db.exec("INSERT INTO private.need_fact_registry VALUES('need.response_deadline','NEED_FACT_V2','OBJECT',false,'PUBLIC',true,'needs.response_deadline')");
 await db.query(`INSERT INTO public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope,fact_schema_version,value_type,display_value)
 VALUES($1,$2,'need.response_deadline','{"kind":"AT","at":"2099-10-10T15:00:00Z"}','NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT','NEED_FACT_V2','OBJECT','Prijave do 10. oktobra')`,[owner,cid]);
 await db.query("UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET source_fingerprint=encode(extensions.digest(private.ai_task_review_source($1)::text,'sha256'),'hex')",[cid]);
}

test('deadline fact keeps legacy and opt-in signed prepare aligned through actual Save',async t=>{
 const db=await needFixture(t);
 for(const f of Object.values(postimages))await db.exec(f.definition);
 await installDeadline(db);
 const legacy=await prepare(db),opt=(await one(db,'SELECT public.rpc_prepare_ai_task_review_deadline_taxonomy($1) result',[cid])).result;
 assert.deepEqual(opt,legacy,'one signed review for both clients');
 assert.equal(Date.parse(legacy.responseDeadline),Date.parse('2099-10-10T15:00:00Z'));
 assert.ok(mobileDecoder().decodeAiTaskReview(legacy,owner));assert.equal(legacy.canAccept,true);
 const stale=(await one(db,"SELECT public.rpc_prepare_ai_task_review_taxonomy($1,'2020-01-01T00:00:00Z') result",[cid])).result;
 assert.deepEqual(stale,legacy,'old stale deadline cannot override the newer displayed fact');
 const saved=(await accept(db,legacy)).rows[0].result;
 const read=(await one(db,'SELECT public.rpc_read_ai_task_review($1) result',[legacy.reviewId])).result;
 assert.equal(read.review.responseDeadline,legacy.responseDeadline);
 assert.equal(read.command.needId,saved.needId);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(prepare(db),/TASK_REVIEW_NOT_FOUND/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec("SELECT set_config('test.closure','closed',false)");
 await assert.rejects(prepare(db),/ACCOUNT_CLOSED/);
});

test('Need actual signed prepare/decoder/Save/bind/readback, replay and no-ALLOW publication fence',async t=>{
 const db=await needFixture(t);
 const baseline=await prepare(db);
 assert.notEqual(baseline.classificationState,'READY');
 t.diagnostic('Baseline signed classification: '+baseline.classificationState+'; canAccept='+baseline.canAccept);
 for(const f of Object.values(postimages))await db.exec(f.definition);
 const reviewed=await prepare(db);
 assert.equal(reviewed.classificationState,'READY');assert.equal(reviewed.canAccept,true);
 const decoded=mobileDecoder().decodeAiTaskReview(reviewed,owner);
 assert.ok(decoded,'real SQL envelope must decode unchanged');
 assert.equal(decoded.reviewId,reviewed.reviewId);
 assert.equal(decoded.classificationCandidates[0].categoryId,remote);
 assert.equal(decoded.classificationCandidates[0].service,reviewed.classificationCandidates[0].service);
 assert.equal(mobileDecoder().decodeAiTaskReview(reviewed,other),null);
 assert.equal(reviewed.classificationCandidates[0].categoryId,remote);
 assert.deepEqual(await prepare(db),reviewed,'unchanged READY refresh reuses signed review');
 await assert.rejects(accept(db,{...reviewed,displayedContentDigest:'0'.repeat(64)}),/TASK_REVIEW_DIGEST_MISMATCH/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(accept(db,reviewed),/TASK_REVIEW_NOT_FOUND/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec('SET ROLE authenticated');
 const receipt=(await accept(db,reviewed)).rows[0].result;
 assert.equal(receipt.state,'ACCEPTED');assert.equal(receipt.authoritative,true);
 assert.deepEqual((await accept(db,reviewed)).rows[0].result,receipt);
 const readback=(await one(db,'SELECT public.rpc_read_task($1) result',[receipt.needId])).result;
 assert.equal(readback.id,receipt.needId);assert.equal(readback.revision,receipt.needRevision);
 assert.equal(readback.status,'DRAFT');assert.equal(readback.requester_profile_id,profile);
 assert.equal(readback.category,reviewed.classificationCandidates[0].service);
 assert.deepEqual(readback.need_geography,{public_topology:{mode:'REMOTE'}});
 const readReview=(await one(db,'SELECT public.rpc_read_ai_task_review($1) result',[reviewed.reviewId])).result;
 assert.deepEqual(readReview.review,reviewed);assert.deepEqual(readReview.command,receipt);
 await db.exec('RESET ROLE');
 assert.equal((await one(db,'SELECT category_id FROM public.needs WHERE id=$1',[receipt.needId])).category_id,null);
 await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const admission=(await one(db,'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,\'NEED_SERVICE\',$3,$4::jsonb) result',
  [owner,request,reviewed.reviewId,JSON.stringify(reviewed.classificationCandidates)])).result;
 assert.equal(admission.status,'COMMITTED');assert.equal(admission.items[0].categoryId,remote);
 const bind=revision=>one(db,'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1,$2,$3,$4,$5) result',
  [owner,request,reviewed.reviewId,receipt.needId,revision]);
 const bound=(await bind(receipt.needRevision)).result;
 assert.equal(bound.status,'BOUND_NEED_REVISION');assert.equal(bound.categoryId,remote);
 assert.equal(bound.notificationAuthority,'NONE');assert.equal(bound.dispatchAuthority,'NONE');
 assert.deepEqual((await bind(receipt.needRevision)).result,bound);
 await assert.rejects(bind(receipt.needRevision+1),/NEED_BINDER_REQUEST_KEY_REUSED/);
 assert.equal((await one(db,'SELECT category_id FROM public.needs WHERE id=$1',[receipt.needId])).category_id,remote);
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.work_taxonomy_need_snapshots WHERE need_id=$1',[receipt.needId])).n,1);
 await db.query("SELECT set_config('request.jwt.claim.role','authenticated',false)");
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('SELECT public.rpc_publish_accepted_ai_task_review($1,$2)',[reviewed.reviewId,request]),/PUBLICATION_DECISION_NOT_ALLOW/);
 assert.equal((await one(db,'SELECT public.rpc_read_task($1) result',[receipt.needId])).result.status,'DRAFT');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal((await one(db,'SELECT public.rpc_read_task($1) result',[receipt.needId])).result,null);
 await assert.rejects(db.query('SELECT public.rpc_read_ai_task_review($1)',[reviewed.reviewId]),/TASK_REVIEW_NOT_FOUND/);
 await db.exec('RESET ROLE');
 const stored=await one(db,'SELECT id,requester_account_id,status,revision,category FROM public.needs WHERE id=$1',[receipt.needId]);
 assert.equal(stored.status,'DRAFT');assert.equal(stored.revision,receipt.needRevision);assert.equal(stored.requester_account_id,owner);
});

for(const loseCompletionAck of [false,true])
test('Need actual Edge evaluation -> mobile resume -> canonical PUBLISHED owned readback; '+(loseCompletionAck?'lost completion ACK':'normal ACK'),async t=>{
 const db=await needFixture(t);await publicationFixture(db);
 await installDeadline(db);
 for(const f of Object.values(postimages))await db.exec(f.definition);
 const reviewed=await prepare(db);
 assert.equal(reviewed.classificationState,'READY');assert.equal(reviewed.canAccept,true);
 assert.equal(mobileDecoder().decodeAiTaskReview(reviewed,owner).classificationCandidates[0].categoryId,remote);
 await db.exec('SET ROLE authenticated');
 const accepted=(await accept(db,reviewed)).rows[0].result;
 assert.equal(accepted.state,'ACCEPTED');
 await assert.rejects(db.query('SELECT public.rpc_publish_accepted_ai_task_review($1,$2)',[reviewed.reviewId,request]),/PUBLICATION_DECISION_NOT_ALLOW/);
 await db.exec('RESET ROLE');
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.need_publication_decisions')).n,0);
 await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const batch=(await one(db,"SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'NEED_SERVICE',$3,$4::jsonb) result",
  [owner,request,reviewed.reviewId,JSON.stringify(reviewed.classificationCandidates)])).result;
 assert.equal(batch.status,'COMMITTED');
 const bound=(await one(db,'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1,$2,$3,$4,$5) result',
  [owner,request,reviewed.reviewId,accepted.needId,accepted.needRevision])).result;
 assert.equal(bound.status,'BOUND_NEED_REVISION');assert.equal(bound.categoryId,remote);
 await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");
 const {edge,mobile}=connectedEvaluator(db,{loseCompletionAck});
 const result=await mobile.aiTaskReviewClientService.resume(accepted);
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.podatak.state,'PUBLISHED');
 assert.equal(result.podatak.evaluation.decision.outcome,'ALLOW');
 assert.equal(result.podatak.needId,accepted.needId);assert.equal(result.podatak.needRevision,accepted.needRevision);
 assert.deepEqual(edge.calls.map(c=>c.kind),['auth','context','reviewClaim','budget','provider','reviewComplete']);
 assert.equal(edge.timers.size,0);
 const context=(await one(db,'SELECT evaluation_binding FROM private.ai_task_review_commands WHERE review_id=$1',[reviewed.reviewId])).evaluation_binding;
 const decision=await one(db,'SELECT need_id,need_revision,canonical_fingerprint,service_provenance FROM private.need_publication_decisions');
 assert.equal(decision.need_id,accepted.needId);assert.equal(decision.need_revision,accepted.needRevision);
 assert.equal(decision.canonical_fingerprint,context.canonicalFingerprint);
 assert.deepEqual(decision.service_provenance,{evaluationContext:context});
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.dispatch_schedule WHERE need_id=$1',[accepted.needId])).n,1);
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.need_publish_commands')).n,1);
 const calls=edge.calls.length;
 assert.deepEqual(await mobile.aiTaskReviewClientService.resume(accepted),result,'stored PUBLISHED command replays without another provider');
 assert.equal(edge.calls.length,calls);
 await db.exec('SET ROLE authenticated');
 const published=(await one(db,'SELECT public.rpc_read_task($1) result',[accepted.needId])).result;
 assert.equal(published.status,'PUBLISHED');assert.equal(published.id,accepted.needId);
 assert.equal(published.revision,accepted.needRevision);assert.equal(published.category,reviewed.classificationCandidates[0].service);
 assert.equal(published.published_at,result.podatak.published.publishedAt);
 assert.equal(Date.parse(published.response_deadline),Date.parse('2099-10-10T15:00:00Z'));
 assert.equal(Date.parse(result.podatak.published.responseDeadline),Date.parse(reviewed.responseDeadline));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal((await one(db,'SELECT public.rpc_read_task($1) result',[accepted.needId])).result,null);
 await assert.rejects(db.query('SELECT public.rpc_publish_accepted_ai_task_review($1,$2)',[reviewed.reviewId,request]),/TASK_REVIEW_NOT_FOUND/);
 await db.exec('RESET ROLE');
 assert.equal((await one(db,'SELECT category_id FROM public.needs WHERE id=$1',[accepted.needId])).category_id,remote);
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.need_publication_decisions')).n,1);
 assert.equal((await one(db,'SELECT count(*)::int n FROM private.dispatch_schedule')).n,1);
});
