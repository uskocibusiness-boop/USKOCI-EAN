// Actual disposable147 SQL/Auth proof. No provider, dispatch, budget reset or
// production access. The historical135 fixture is restored only after exact
// artifact/document/metadata verification; the migration itself has no bypass.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assert,rows,sql,prove,pass,apply,actor,anon,service,ok,denied,randomUUID,q,sha} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
import {readQaPolicyArtifact} from '../qa_policy_fixture.mjs';
const file='20260913081242_clean_v5_qa_owner_product_activation.sql';
const {artifactBytes,artifact}=readQaPolicyArtifact();
const hash=x=>createHash('sha256').update(x).digest('hex');
const document={...artifact.document,rules:[...artifact.document.rules].sort((a,b)=>a.ruleId.localeCompare(b.ruleId))};
const literal=x=>q(JSON.stringify(x))+'::jsonb';
const policyWhere="policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1";
const current=()=>sql("select private.current_publication_policy_bundle('PRESELECTION_QA_V1','RS',statement_timestamp())");
const refs=id=>rows(`select rule_id,rule_provenance from private.publication_policy_rule_refs where bundle_id=${q(id)}::uuid order by rule_id`);
const expectedRefs=document.rules.map(({ruleId,...evaluation})=>({rule_id:ruleId,rule_provenance:{evaluation,sourceMapping:artifact.sourceMapping.find(x=>x.ruleId===ruleId)}}));
const policies=()=>({bundles:rows('select * from private.publication_policy_bundles order by id'),refs:rows('select * from private.publication_policy_rule_refs order by bundle_id,rule_id')});
const nonQa=()=>({bundles:rows(`select * from private.publication_policy_bundles where not(${policyWhere}) order by id`),
 refs:rows(`select r.* from private.publication_policy_rule_refs r join private.publication_policy_bundles b on b.id=r.bundle_id where not(${policyWhere}) order by r.bundle_id,r.rule_id`)});
const budget=()=>({budget:rows('select * from private.ai_test_budget_v5 order by singleton'),
 reservations:rows('select * from private.ai_test_reservations_v5 order by id'),allowlist:rows('select * from private.ai_test_accounts_v5 order by account_id')});
const closure=()=>({seal:rows('select * from private.closure_source_v5 order by singleton'),digest:sql('select private.closure_source_digest_v5()')});
const functions=()=>rows("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) body,p.proacl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.prokind='f' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)");
function privateGrants(){
 for(const role of ['anon','authenticated','service_role'])for(const table of ['private.publication_policy_bundles','private.publication_policy_rule_refs'])
  assert.equal(sql(`select has_table_privilege(${q(role)},${q(table)},'SELECT,INSERT,UPDATE,DELETE')`),'f',role+':'+table);
 const signature='public.rpc_claim_qa_classification_service(uuid,text,uuid,integer,uuid,text,uuid)';
 for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
 assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');
}
async function activeWorker(){
 const a=await actor('qa147-worker'),p=await ok(a.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(a.client.from('app_profiles').update({display_name:'Disposable147 QA worker',skills:['Proof']}).eq('id',p.id));
 const location=await ok(a.client.rpc('rpc_get_worker_location',{}));
 await ok(a.client.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(a.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));
 assert.equal(sql(`select profile_status from public.app_profiles where id=${q(p.id)}::uuid`),'ACTIVE');return a;
}
function remoteNeed(a){
 const id=randomUUID(),profile=rows(`select id from public.app_profiles where account_id=${q(a.id)}::uuid and kind='REQUESTER'`)[0].id;
 // Explicit synthetic published fixture. REMOTE/RS is a complete current
 // geography context; this is not a claim that the publication journey ran.
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);select set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at,execution_location_mode,task_country_code,task_timezone)
 values(${q(id)},${q(a.id)},${q(profile)},'PUBLISHED','Synthetic147 remote task','Disposable public clarification fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',clock_timestamp()+interval '2 days',clock_timestamp(),'REMOTE','RS',
 (select default_timezone from private.location_market_configs where country_code='RS'));commit;`);
 assert.deepEqual(rows(`select execution_location_mode,task_country_code,verified_identity_required from public.needs where id=${q(id)}`),[{execution_location_mode:'REMOTE',task_country_code:'RS',verified_identity_required:false}]);return id;
}

await prove('V5_QA_OWNER_PRODUCT_ACTIVATION','v5-qa-owner-activation-report.json',async report=>{
 const sourcePath='supabase/migrations/'+file,sourceBytes=readFileSync(sourcePath);
 assert.deepEqual(sourceBytes,execFileSync('git',['show',sha+':'+sourcePath]));
 const source=sourceBytes.toString('utf8').replaceAll('\r\n','\n');
 const embedded=source.match(/a jsonb:='((?:[^']|'')*)'::jsonb;/);assert.ok(embedded);
 assert.deepEqual(JSON.parse(embedded[1].replaceAll("''","'")),artifact);
 assert.equal(hash(artifactBytes),'2cab9bb4d551878a2071fff0fc7fc93383c9db2b370a13db3772b45209ab786a');
 assert.ok(source.includes("artifact_sha text:='"+hash(artifactBytes)+"'"));
 assert.equal(document.rules.length,5);assert.equal(artifact.activation,'NOT_ACTIVATED');
 const digest=sql(`select encode(extensions.digest(convert_to((${literal(document)})::text,'UTF8'),'sha256'),'hex')`);
 const {rules,...head}=document;
 const prepared={candidateArtifactSha256:hash(artifactBytes),sourceMapping:artifact.sourceMapping,
  processingAuthority:artifact.processingAuthority,numericAuthority:artifact.numericAuthority,
  reviewState:'PREPARED_AWAITING_REVIEW',evaluatorPolicy:head,evaluatorContentSha256:digest};
 const candidate=rows(`select * from private.publication_policy_bundles where ${policyWhere}`);
 assert.equal(candidate.length,1);const before=candidate[0],id=before.id;
 assert.equal(before.is_active,false);assert.equal(before.is_reviewed,true);assert.equal(before.is_complete,true);
 assert.ok(before.reviewed_at);assert.ok(before.activated_at);assert.equal(before.effective_from,null);assert.equal(before.effective_until,null);
 assert.deepEqual(before.review_provenance,{...prepared,disposable135Fixture:true});
 assert.deepEqual(refs(id),expectedRefs);
 assert.deepEqual(rows(`select private.publication_policy_document(${q(id)}::uuid) value`)[0].value,document);
 const preserved={nonQa:nonQa(),budget:budget(),closure:closure(),functions:functions()};privateGrants();
 assert.equal(preserved.closure.seal.length,1);assert.equal(preserved.closure.seal[0].sha256,preserved.closure.digest);
 // LOCAL ONLY: undo precisely the labelled135 review fixture, preserving IDs,
 // timestamps of creation, references, content and every other metadata key.
 sql(`update private.publication_policy_bundles set is_reviewed=false,reviewed_at=null,activated_at=null,
 review_provenance=review_provenance-'disposable135Fixture' where id=${q(id)}::uuid`);
 const restored=rows(`select * from private.publication_policy_bundles where id=${q(id)}::uuid`)[0];
 assert.deepEqual(restored,{...before,is_reviewed:false,reviewed_at:null,activated_at:null,review_provenance:prepared});
 assert.deepEqual(refs(id),expectedRefs);assert.equal(current(),'');
 report.policyFixture='EXACT_VERIFIED_135_DISPOSABLE_REVIEW_METADATA_RESTORED_ONLY_IN_LOCAL_PROOF';
 report.approvedArtifactSha256=hash(artifactBytes);report.executableDocumentSha256=digest;
 pass(report,'EXACT_FIVE_RULE_ARTIFACT_DOCUMENT_AND_135_FIXTURE_ONLY_METADATA_RESTORATION');

 // Execute the exact migration body inside our outer rollback transaction.
 // Only its single outer BEGIN/COMMIT are removed; all guards/locks remain.
 assert.equal(source.match(/^begin;$/gm)?.length,1);assert.equal(source.match(/^commit;$/gm)?.length,1);
 const body=source.replace(/^begin;\n/m,'').replace(/\ncommit;\s*$/,'\n');
 const policyBaseline=policies(),historyBefore=rows(migrationSnapshotQuery());assert.equal(historyBefore.length,146);
 const unchanged=()=>{assert.deepEqual(policies(),policyBaseline);assert.deepEqual(rows(migrationSnapshotQuery()),historyBefore);
  assert.deepEqual(budget(),preserved.budget);assert.deepEqual(closure(),preserved.closure);privateGrants();};
 const drift=(name,change,code)=>{
  assert.throws(()=>sql('begin;\n'+change+'\n'+body+'\nrollback;'),error=>error.message.includes(code),name);
  unchanged();pass(report,name);
 };
 // Keep135 UUID/FKs while exercising the genuinely absent candidate branch.
 const fresh=sql(`begin;update private.publication_policy_bundles set policy_id=${q('DISPOSABLE147_RENAMED_'+randomUUID())} where id=${q(id)}::uuid;
 ${body}
 select jsonb_build_object('id',b.id,'ready',private.publication_policy_bundle_ready(b.id,'RS',statement_timestamp()),
 'document',private.publication_policy_document(b.id),'refs',(select count(*) from private.publication_policy_rule_refs where bundle_id=b.id))
 from private.publication_policy_bundles b where ${policyWhere};rollback;`);
 const freshResult=JSON.parse(fresh);assert.notEqual(freshResult.id,id);assert.equal(freshResult.ready,true);assert.equal(freshResult.refs,5);assert.deepEqual(freshResult.document,document);
 unchanged();pass(report,'FRESH_INSERT_BRANCH_NEW_UUID_EXACT_DOCUMENT_READY_ROLLBACK_PRESERVES_135_FKS_AND_HISTORY');
 const setCandidate=fragment=>`update private.publication_policy_bundles set ${fragment} where id=${q(id)}::uuid;`;
 drift('WRONG_ARTIFACT_HASH_DENIED',setCandidate("review_provenance=jsonb_set(review_provenance,'{candidateArtifactSha256}',to_jsonb(repeat('0',64)))"),'QA_OWNER_EXISTING_CANDIDATE_DRIFT');
 drift('UNAPPROVED_CANDIDATE_METADATA_DENIED',setCandidate("review_provenance=review_provenance||'{\"unapproved\":true}'::jsonb"),'QA_OWNER_EXISTING_CANDIDATE_DRIFT');
 drift('ALREADY_REVIEWED_CANDIDATE_DENIED',setCandidate('is_reviewed=true,reviewed_at=clock_timestamp()'),'QA_OWNER_EXISTING_CANDIDATE_DRIFT');
 const firstRule=q(document.rules[0].ruleId);
 drift('CHANGED_RULE_INSTRUCTION_DENIED',`update private.publication_policy_rule_refs set rule_provenance=jsonb_set(rule_provenance,'{evaluation,instructions}','"Unapproved changed instruction"'::jsonb) where bundle_id=${q(id)}::uuid and rule_id=${firstRule};`,'QA_OWNER_EXISTING_CANDIDATE_DRIFT');
 drift('CHANGED_RULE_MAPPING_WITH_SAME_DOCUMENT_DENIED',`update private.publication_policy_rule_refs set rule_provenance=jsonb_set(rule_provenance,'{sourceMapping}','{}'::jsonb) where bundle_id=${q(id)}::uuid and rule_id=${firstRule};`,'QA_OWNER_RULE_CONTENT_DRIFT');
 drift('OTHER_ACTIVE_QA_VERSION_DENIED',`insert into private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,reviewed_at,activated_at) values('PRESELECTION_QA_V1',2,'RS',true,true,true,clock_timestamp(),clock_timestamp());`,'QA_OWNER_OTHER_ACTIVE_VERSION');
 drift('TASK_SAFETY_POLICY_DOCUMENT_DRIFT_DENIED',"update private.publication_policy_bundles set review_provenance=jsonb_set(review_provenance,'{evaluatorContentSha256}',to_jsonb(repeat('0',64))) where id=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',statement_timestamp());",'QA_OWNER_TASK_POLICY_NOT_READY');
 // Since146 the closure seal (closure_erasure_program_digest_v5) also hashes the ACL of
 // every private/public table, so a grant on the private policy table is refused by the
 // seal guard (QA_OWNER_SOURCE_NOT_READY) before the dedicated QA_OWNER_PRIVATE_POLICY_EXPOSED
 // guard runs. Both refuse the same drift; assert the guard that actually fires.
 const grantDrift="grant select on private.publication_policy_bundles to service_role;";
 const sealSeesGrant=sql(`begin;${grantDrift}select (select sha256 from private.closure_source_v5 where singleton) is distinct from private.closure_source_digest_v5();rollback;`)==='t';
 report.privatePolicyGrantDeniedBy=sealSeesGrant?'QA_OWNER_SOURCE_NOT_READY':'QA_OWNER_PRIVATE_POLICY_EXPOSED';
 drift('PRIVATE_POLICY_GRANT_DENIED',grantDrift,report.privatePolicyGrantDeniedBy);

 await apply(report,file,146);
 const activated=rows(`select * from private.publication_policy_bundles where id=${q(id)}::uuid`)[0];
 assert.equal(current(),id);assert.equal(activated.is_reviewed,true);assert.equal(activated.is_complete,true);assert.equal(activated.is_active,true);
 assert.ok(activated.reviewed_at);assert.equal(activated.reviewed_at,activated.activated_at);assert.equal(activated.reviewed_at,activated.effective_from);assert.equal(activated.effective_until,null);
 assert.equal(activated.created_at,before.created_at);
 assert.deepEqual(activated.review_provenance,{...prepared,reviewState:'OWNER_PRODUCT_APPROVED_NOT_LEGAL_CERTIFICATION',
  review_state:'OWNER_PRODUCT_APPROVED_NOT_LEGAL_CERTIFICATION',legal_certification:false,approved_by:'USKOCI_PRODUCT_OWNER',
  approval_scope:'EXISTING_PRESELECTION_QA_RS_V1',activation_authority:'AF-D11 numeric rules; AF-D12 approved Gemini public Q&A purpose; AF-D26 canonical DEV/ALPHA backend promotion',
  activated_by:'20260913081242_clean_v5_qa_owner_product_activation'});
 assert.deepEqual(refs(id),expectedRefs);assert.deepEqual(rows(`select private.publication_policy_document(${q(id)}::uuid) value`)[0].value,document);
 assert.equal(sql(`select private.publication_policy_bundle_ready(${q(id)}::uuid,'RS',statement_timestamp())`),'t');privateGrants();
 assert.deepEqual(nonQa(),preserved.nonQa);assert.deepEqual(functions(),preserved.functions);assert.deepEqual(closure(),preserved.closure);assert.deepEqual(budget(),preserved.budget);
 pass(report,'EXACT_147_ACTIVATION_SAME_CANDIDATE_READY_PRIVATE_GRANTS_NO_FUNCTION_BUDGET_CLOSURE_OR_OTHER_POLICY_CHANGE');

 const owner=await actor('qa147-owner'),worker=await activeWorker(),n=remoteNeed(owner),key=randomUUID(),text='Koji format dokumenta je potreban?';
 const context=await ok(worker.client.rpc('rpc_read_preselection_qa_context',{p_expected_user_id:worker.id,p_need_id:n}));
 assert.equal(context.canAsk,true);assert.equal(context.questionMaxChars,500);assert.equal(context.answerMaxChars,1000);assert.equal(context.ratePolicyState,'READY');
 const input={p_account_id:worker.id,p_type:'ASK',p_need_id:n,p_need_revision:1,p_question_id:null,p_text:text,p_client_request_id:key};
 const readArgs={p_expected_user_id:worker.id,p_need_id:n,p_client_request_id:key};
 const read=()=>ok(worker.client.rpc('rpc_read_qa_classification',readArgs));
 assert.equal((await read()).state,'ABSENT');
 await denied(anon.rpc('rpc_claim_qa_classification_service',input));await denied(worker.client.rpc('rpc_claim_qa_classification_service',input));
 await denied(anon.rpc('rpc_read_qa_classification',readArgs));
 await denied(owner.client.rpc('rpc_read_qa_classification',readArgs),'AUTH_CONTEXT_CHANGED');
 const claim=await ok(service.rpc('rpc_claim_qa_classification_service',input));assert.ok(claim.claim);assert.equal(claim.status.state,'PROCESSING');
 assert.deepEqual(claim.claim.context.policy,document);
 const taskDocument=rows("select private.publication_policy_document(private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',statement_timestamp())) value")[0].value;
 assert.ok(taskDocument);assert.deepEqual(claim.claim.context.taskSafetyPolicy,taskDocument);
 assert.equal(claim.claim.context.schemaVersion,'PRESELECTION_QA_CLASSIFIER_V1');assert.equal(claim.claim.context.type,'ASK');assert.equal(claim.claim.context.question,null);
 const publicKeys=value=>value&&typeof value==='object'?Object.entries(value).flatMap(([key,item])=>[key,...publicKeys(item)]):[];
 for(const forbidden of ['needId','requesterAccountId','requesterProfileId','accountId','email','approximateLat','approximateLng'])assert.ok(!publicKeys(claim.claim.context.publicTask).includes(forbidden));
 const own=await read();assert.equal(own.state,'PROCESSING');assert.equal(own.canCancel,true);assert.equal(own.receipt,null);assert.equal(own.accountId,worker.id);
 const replay=await ok(service.rpc('rpc_claim_qa_classification_service',input));assert.equal(replay.claim,null);assert.deepEqual(replay.status,own);
 const commands=()=>rows(`select * from private.qa_ai_commands where account_id=${q(worker.id)}::uuid and client_request_id=${q(key)}::uuid`);
 const commandBefore=commands();assert.equal(commandBefore.length,1);assert.equal(commandBefore[0].provider_dispatched,false);assert.equal(commandBefore[0].policy_bundle_id,id);
 assert.deepEqual(budget(),preserved.budget);pass(report,'REAL_AUTH_ACTIVE_WORKER_REMOTE_RS_TASK_EXACT_POLICY_SERVICE_CLAIM_OWNED_READ_REPLAY_WITHOUT_DISPATCH');
 const {p_account_id,p_text,...rest}=input;
 const cancelArgs={...rest,p_expected_user_id:p_account_id,p_text_sha256:hash(p_text.trim())};
 const cancelled=await ok(worker.client.rpc('rpc_cancel_qa_classification',cancelArgs));assert.equal(cancelled.state,'CANCELLED');assert.equal(cancelled.canCancel,false);assert.equal(cancelled.receipt,null);
 assert.deepEqual(await read(),cancelled);assert.deepEqual(await ok(worker.client.rpc('rpc_cancel_qa_classification',cancelArgs)),cancelled);
 const terminal=await ok(service.rpc('rpc_claim_qa_classification_service',input));assert.equal(terminal.claim,null);assert.deepEqual(terminal.status,cancelled);
 const commandAfter=commands();assert.equal(commandAfter.length,1);assert.equal(commandAfter[0].provider_dispatched,false);
 for(const field of ['id','attempt_id','request_hash','source_hash','policy_hash','policy_bundle_id','text_sha256'])assert.deepEqual(commandAfter[0][field],commandBefore[0][field],field);
 assert.equal(sql(`select count(*) from private.preselection_qa_questions where need_id=${q(n)}::uuid`),'0');
 assert.deepEqual(budget(),preserved.budget);assert.deepEqual(nonQa(),preserved.nonQa);assert.deepEqual(closure(),preserved.closure);privateGrants();
 assert.equal(current(),id);report.providerCalled=false;report.dispatchCalled=false;report.budgetReservationsChanged=false;
 pass(report,'OWNED_CANCEL_AND_TERMINAL_REPLAY_PRESERVE_AUTHORITY_NO_PUBLIC_QUESTION_NO_COST_OR_ALLOWLIST_CHANGE');
});
