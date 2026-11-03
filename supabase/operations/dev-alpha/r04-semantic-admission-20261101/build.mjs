// Offline, exact-body derivation of R04 semantic admission. Never connects or deploys.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {deriveClosurePostimage} from './closure-postimage.mjs';

const root=new URL('./',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
export const preimage=JSON.parse(read('preimage.json'));

export const signatures={
 triage:'private.taxonomy_risk_triage_v1(text)',
 proj:'private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)',
 trigger:'private.needs_sync_taxonomy_category_trigger_fn()',
 commit:'public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'
};

export const originals=Object.fromEntries(
 Object.entries(signatures).map(([key,sig])=>{
  const f=preimage.functions.find(x=>x.signature===sig);
  assert.ok(f,'Original function missing in preimage: '+sig);
  return [key,f];
 })
);

const hash=(s,kind='sha256')=>createHash(kind).update(s).digest('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";

const cand1=readFileSync(new URL('../../../candidates/r04_semantic_review_pending_projection.sql',root),'utf8');
const cand2=readFileSync(new URL('../../../candidates/r04_semantic_batch_admission.sql',root),'utf8');

function extractCandidateDefinition(sql,signature){
 const marker='CREATE OR REPLACE FUNCTION '+signature;
 const pos=sql.indexOf(marker);
 assert.notEqual(pos,-1,'Marker not found: '+signature);
 const bodyMarker=sql.indexOf('AS $function$',pos);
 const close=sql.indexOf('$function$',bodyMarker+'AS $function$'.length);
 assert.ok(bodyMarker>=pos&&close>bodyMarker,'Function delimiters missing: '+signature);
 const def=sql.slice(pos,close+'$function$'.length).trimEnd()+';\n';
 const bodyStart=def.indexOf('AS $function$')+'AS $function$'.length;
 const bodyEnd=def.lastIndexOf('$function$;');
 const body=def.slice(bodyStart,bodyEnd);
 return {
  definition:def,
  definition_md5:hash(def,'md5'),
  body_md5:hash(body,'md5'),
  body_lf_md5:hash(body.replaceAll('\r\n','\n'),'md5')
 };
}

export const postimages={
 triage:{...originals.triage,...extractCandidateDefinition(cand1,'private.taxonomy_risk_triage_v1')},
 proj:{...originals.proj,...extractCandidateDefinition(cand1,'private.taxonomy_review_candidate_projection_v2')},
 trigger:{...originals.trigger,...extractCandidateDefinition(cand2,'private.needs_sync_taxonomy_category_trigger_fn')},
 commit:{...originals.commit,...extractCandidateDefinition(cand2,'public.rpc_taxonomy_commit_reviewed_batch_service')}
};

export const closureQuery=`SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())`;

export const postClosure=deriveClosurePostimage({
 evidence:{...JSON.parse(read('closure-postimage-offline-evidence-20261102.json')),
  schema_capture:JSON.parse(read('closure-schema-input-20261102.json')).capture},
 originals,postimages,preimageClosure:preimage.closure
});

// One unapplied promotion now includes the downstream owners and compatible
// receipt recovery. Preserve the four core exports used by connected proofs.
export const connectedPreimage=JSON.parse(read('connected-dev-preimage-20261102.json'));
export const additionalSources={
 workerBinder:['public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)','worker-semantic-binder-local-only.sql'],
 workerReview:['private.worker_remote_review_ready_v1(jsonb)','worker-remote-semantic-review-local-only.sql'],
 workerSync:['private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])','worker-semantic-sync-local-only.sql'],
 workerActivation:['private.worker_remote_only_activation_ready_v1(uuid,text[])','worker-remote-semantic-activation-local-only.sql'],
 workerReadback:['public.rpc_get_worker_execution_modes(uuid)','worker-semantic-readback-local-only.sql'],
 workerContext:['private.worker_ai_service_mode_context_v1(uuid,uuid)','worker-semantic-mode-context-local-only.sql'],
 workerPrepare:['public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)','worker-semantic-prepare-local-only.sql'],
 workerConfirmedPrepare:['public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)','worker-semantic-confirmed-prepare-local-only.sql'],
 receiptFinalizer:['public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)','../../../proofs/ai/r06_postsave_receipt_finalization_candidate.sql'],
 receiptReconciler:['public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)','../../../proofs/ai/r06_postsave_late_receipt_reconcile_candidate.sql']
};
export const promotionSignatures={...signatures,...Object.fromEntries(Object.entries(additionalSources).map(([key,[sig]])=>[key,sig]))};
assert.equal(connectedPreimage.functions.length,Object.keys(promotionSignatures).length,'Connected capture scope changed');
export const promotionOriginals=Object.fromEntries(Object.entries(promotionSignatures).map(([key,sig])=>{
 const f=connectedPreimage.functions.find(x=>x.signature===sig);
 assert.ok(f,'Connected original missing: '+sig);
 assert.equal(hash(f.definition,'md5'),f.definition_md5,'Connected original bytes changed');
 if(originals[key])assert.equal(f.body_md5,originals[key].body_md5,'Core DEV body changed');
 return[key,f];
}));
assert.deepEqual(connectedPreimage.closure,preimage.closure,'Connected closure preimage changed');
assert.equal(connectedPreimage.read_only,'on');
assert.equal(connectedPreimage.project_ref,preimage.project_ref);
assert.equal(connectedPreimage.capture_role,'postgres');
assert.equal(connectedPreimage.server_version_num,preimage.server_version_num);

// Reuse the captured signature/defaults/volatility/search_path header verbatim.
// Candidate wrappers remain LOCAL_ONLY; only the reviewed function body enters
// this separately guarded transaction. No candidate guard is disabled on DEV.
const replaceBody=(original,definition)=>{
 const marker='AS $function$';
 const start=definition.indexOf(marker),end=definition.lastIndexOf('$function$');
 const oldStart=original.definition.indexOf(marker),oldEnd=original.definition.lastIndexOf('$function$');
 assert.ok(start>=0&&end>start&&oldStart>=0&&oldEnd>oldStart,'Function body delimiter missing');
 const body=definition.slice(start+marker.length,end).replaceAll('\r\n','\n');
 const next=original.definition.slice(0,oldStart+marker.length)+body+original.definition.slice(oldEnd);
 return{...original,definition:next,definition_md5:hash(next,'md5'),body_md5:hash(body,'md5'),body_lf_md5:hash(body,'md5')};
};
export const promotionPostimages=Object.fromEntries(Object.entries(promotionOriginals).map(([key,original])=>{
 const definition=postimages[key]?.definition??extractCandidateDefinition(read(additionalSources[key][1]),original.signature.split('(')[0]).definition;
 return[key,replaceBody(original,definition)];
}));
export const connectedClosureEvidence={
 ...JSON.parse(read('closure-postimage-offline-evidence-20261102.json')),
 schema_capture:JSON.parse(read('closure-schema-input-20261102.json')).capture,
 changed_function_preimages:connectedPreimage.functions
};
export const promotionPostClosure=deriveClosurePostimage({evidence:connectedClosureEvidence,
 originals:promotionOriginals,postimages:promotionPostimages,preimageClosure:connectedPreimage.closure});

const closureGuard=images=>{
 const target=(images===promotionPostimages)?promotionPostClosure:connectedPreimage.closure;
 return `IF (${closureQuery}) IS DISTINCT FROM ${quote(JSON.stringify(target))}::jsonb
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED'
 USING DETAIL=jsonb_build_object('expected',${quote(JSON.stringify(target))}::jsonb,'observed',(${closureQuery}))::text; END IF;`;
};

const contextGuard=intent=>`IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 ${intent?"OR current_setting('uskoci.r04.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'":''}
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CONTEXT_REFUSED'; END IF;`;

const functionGuard=images=>Object.values(images).map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure(${quote(f.signature)})
 AND md5(replace(p.prosrc,E'\\r\\n',E'\\n'))=${quote(f.body_lf_md5)}
 AND p.prosecdef=${f.security_definer}
 AND pg_get_userbyid(p.proowner)=${quote(f.owner)}
 AND p.proacl::text IS NOT DISTINCT FROM ${f.acl===null?'NULL':quote(f.acl)}
 AND to_jsonb(p)-'prosrc'=${quote(JSON.stringify(f.catalog_attributes))}::jsonb)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_FUNCTION_DRIFT:%',${quote(f.signature)}; END IF;`).join('\n');

const guard=(name,images,intent=false)=>`DO $${name}$ BEGIN\n${contextGuard(intent)}\n${functionGuard(images)}\n${closureGuard(images)}\nEND; $${name}$;\n`;

const ddl=images=>Object.values(images).map(f=>f.definition.trimEnd()+';\n').join('');

export const catalogBefore=`CREATE TEMP TABLE r04_semantic_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');\n`;

export const catalogAfter=`DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r04_semantic_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid IN (
   ${Object.values(promotionSignatures).map(sig=>'to_regprocedure('+quote(sig)+')').join(',\n   ')}
 ) THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;\n`;

export const acceptance=`-- No existing account, business/Auth fixture, provider or push call.
DO $triage$ BEGIN
 IF private.taxonomy_risk_triage_v1('Lektura') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
   RAISE EXCEPTION 'R04_TRIAGE_LEKTURA_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('ostalo') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_OSTALO_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('bilo sta') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_BILO_STA_FAILED';
 END IF;
END;$triage$;
DO $commit_check$ BEGIN
 BEGIN
   PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(NULL, NULL, 'NEED_SERVICE', NULL, '[]'::jsonb);
   RAISE EXCEPTION 'R04_COMMIT_GUARD_FAILED';
 EXCEPTION WHEN OTHERS THEN
    -- The real closure guard rejects a NULL owner before input validation.
    -- An unrelated permission error or a later input error is not this proof.
    IF SQLSTATE <> '42501' OR SQLERRM <> 'CLOSURE_CONTEXT_INVALID' THEN RAISE; END IF;
 END;
END;$commit_check$;\n`;

export function wrap(sql){
 return `BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.r04.dev_target='leqcwgzvjsxugfgzdmth';\n${sql}\nCOMMIT;\n`;
}

export const acceptanceReadOnly="BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n"+
  acceptance+"\nSELECT 'R04_ACTUAL_PG_TRIAGE_AND_NULL_OWNER_GUARD_PASS' result,false authenticated_positive_functional_acceptance,statement_timestamp() checked_at;ROLLBACK;\n";

export function generate(){
 assert.equal(preimage.project_ref,'leqcwgzvjsxugfgzdmth');
 assert.equal(preimage.read_only,'on');
 assert.equal(preimage.server_version_num,170006);
 assert.equal(preimage.capture_role,'postgres');
 assert.equal(preimage.functions.length,10);

 for(const f of preimage.functions){
  assert.ok(f.oid);
  assert.equal(hash(f.definition,'md5'),f.definition_md5);
 }

 for(const changed of Object.values(signatures)){
  const isCommit = changed.startsWith('public.rpc_taxonomy_commit_reviewed_batch_service');
  assert(
   isCommit || !preimage.functions.find(f=>f.signature==='private.closure_source_digest_v5()').definition.includes(changed.split('(')[0]),
   'unauthorized source roster member'
  );
  assert(
   isCommit || !preimage.functions.find(f=>f.signature==='private.closure_erasure_program_digest_v5()').definition.includes(changed.split('(')[0]),
   'unauthorized erasure roster member'
  );
 }

 const forward=guard('r04_pre',promotionOriginals,true)+catalogBefore+ddl(promotionPostimages)+acceptance+
  catalogAfter+guard('r04_post',promotionPostimages,true)+"NOTIFY pgrst,'reload schema';\n";

 const rollback=guard('r04_revert_pre',promotionPostimages,true)+catalogBefore+ddl(promotionOriginals)+catalogAfter+
  guard('r04_revert_post',promotionOriginals,true)+"NOTIFY pgrst,'reload schema';\n";

 const flight=(images,result)=>`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n${guard('r04_flight',images)}
SELECT '${result}' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;\n`;

 const outputs={
  'forward.sql':forward,
  'promotion.sql':wrap(forward),
  'rollback.sql':wrap(rollback),
  'preflight.sql':flight(promotionOriginals,'R04_SEMANTIC_DEV_PREIMAGE_MATCH'),
  'postflight.sql':flight(promotionPostimages,'R04_SEMANTIC_DEV_POSTIMAGE_MATCH'),
  'acceptance.sql':acceptance,
  'acceptance-readonly.sql':acceptanceReadOnly,
  'postimages.json':JSON.stringify(promotionPostimages,null,2)+'\n'
 };

 outputs['manifest.json']=JSON.stringify({
  unit:'R04_DEV_SEMANTIC_ADMISSION_PACKAGE',
  status:'PREPARED_NOT_APPLIED',
  project_ref:preimage.project_ref,
  captured_at:connectedPreimage.captured_at,
  changed_functions:Object.values(promotionSignatures),
  new_functions:0,
  new_tables:0,
  acl_changes:0,
  source_candidates:[
   'supabase/candidates/r04_semantic_review_pending_projection.sql',
   'supabase/candidates/r04_semantic_batch_admission.sql',
   ...Object.values(additionalSources).map(([,path])=>path.startsWith('../../../proofs/')?'supabase/'+path.slice(9):'supabase/operations/dev-alpha/r04-semantic-admission-20261101/'+path)
  ],
  source_candidates_sha256:{
   'r04_semantic_review_pending_projection.sql':hash(cand1),
   'r04_semantic_batch_admission.sql':hash(cand2),
   ...Object.fromEntries(Object.values(additionalSources).map(([,path])=>[path,hash(read(path))]))
  },
  preimage_sha256:hash(read('preimage.json')),
  connected_preimage_sha256:hash(read('connected-dev-preimage-20261102.json')),
  builder_sha256:hash(read('build.mjs')),
  closure_derivation_sha256:hash(read('closure-postimage.mjs')),
  closure_capture_sha256:hash(read('closure-postimage-offline-evidence-20261102.json')),
  closure_schema_capture_sha256:hash(read('closure-schema-input-20261102.json')),
  required_compatible_edge_sources_sha256:Object.fromEntries([
   'supabase/functions/uskoci-taxonomy-postsave-worker/index.ts',
   'supabase/functions/_shared/taxonomyPostSaveWorker.mjs'
  ].map(path=>[path,hash(readFileSync(new URL('../../../../'+path,root),'utf8').replaceAll('\r\n','\n'))])),
  files:Object.fromEntries(Object.entries(outputs).map(([name,s])=>[name,hash(s)])),
  limitations:[
   'Project identity is the connector binding; the GUC is only an intent marker.',
   'R10 source_ready=false and NULL export/erasure bindings stay unchanged; no certification or activation occurs.',
   'Fourteen existing function bodies change; exact captured pg_proc metadata, full catalog delta and inverse rollback are mandatory. No grants or tables change.',
   'Compatible shared postsave Edge source must accompany the SQL rollout; this package contains SQL only. Do not start a fresh provider or business job as acceptance.',
   'Single-word low-risk services are unblocked for task publication while maintaining strict screening for broad or ambiguous terms and regulated categories.',
   'Unrecorded synonyms are admitted into review audit ledger as EXISTING_REUSED without mutating global private.work_taxonomy_aliases.',
   'Category identity drift between review and commit is strictly checked via categoryLabel (BATCH_CATEGORY_IDENTITY_CHANGED).',
   'The acceptance script checks low-risk triage and refused unauthenticated commit only; actual execution and positive real Auth/native acceptance require separate receipts.',
   'Rollback restores code exactly, not newly admitted business state. Pause affected writes and check compatibility of any new semantic bindings before rollback; never delete new data as cleanup.',
   'No full R01, R10, supported old fleet, provider, push or production admission is claimed.'
  ]
 },null,2)+'\n';

 return outputs;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputs=generate();
 if(process.argv[2]==='--write'){
  for(const[name,s]of Object.entries(outputs))writeFileSync(new URL(name,root),s);
  console.log('Successfully wrote', Object.keys(outputs).length, 'files for R04 semantic admission package.');
 }else if(process.argv[2]==='--check'){
  for(const[name,s]of Object.entries(outputs))assert.equal(read(name),s,name);
  console.log('R04 semantic admission exact package generation PASS');
 }else{
  throw Error('Use --write or --check. This program never deploys.');
 }
}
