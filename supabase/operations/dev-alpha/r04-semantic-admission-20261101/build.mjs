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
 const end=sql.indexOf('$function$;',pos)+'$function$;'.length;
 const def=sql.slice(pos,end).trimEnd()+'\n';
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
 evidence:JSON.parse(read('closure-postimage-offline-evidence-20261102.json')),
 originals,postimages,preimageClosure:preimage.closure
});

const closureGuard=images=>{
 const target=(images===postimages)?postClosure:preimage.closure;
 return `IF (${closureQuery}) IS DISTINCT FROM ${quote(JSON.stringify(target))}::jsonb
 THEN RAISE EXCEPTION 'R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED'; END IF;`;
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
 AND p.proacl::text IS NOT DISTINCT FROM ${f.acl===null?'NULL':quote(f.acl)})
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
   to_regprocedure('private.taxonomy_risk_triage_v1(text)'),
   to_regprocedure('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'),
   to_regprocedure('private.needs_sync_taxonomy_category_trigger_fn()'),
   to_regprocedure('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)')
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
   IF SQLSTATE <> '22023' THEN RAISE; END IF;
 END;
END;$commit_check$;\n`;

export function wrap(sql){
 return `BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.r04.dev_target='leqcwgzvjsxugfgzdmth';\n${sql}\nCOMMIT;\n`;
}

export const acceptanceReadOnly="BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n"+
 acceptance+"\nSELECT 'R04_ACTUAL_PG_TRIAGE_AND_AUTH_PASS' result,false authenticated_positive_functional_acceptance,statement_timestamp() checked_at;ROLLBACK;\n";

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

 const forward=guard('r04_pre',originals,true)+catalogBefore+ddl(postimages)+acceptance+
  catalogAfter+guard('r04_post',postimages,true)+"NOTIFY pgrst,'reload schema';\n";

 const rollback=guard('r04_revert_pre',postimages,true)+catalogBefore+ddl(originals)+catalogAfter+
  guard('r04_revert_post',originals,true)+"NOTIFY pgrst,'reload schema';\n";

 const flight=(images,result)=>`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n${guard('r04_flight',images)}
SELECT '${result}' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;\n`;

 const outputs={
  'forward.sql':forward,
  'promotion.sql':wrap(forward),
  'rollback.sql':wrap(rollback),
  'preflight.sql':flight(originals,'R04_SEMANTIC_DEV_PREIMAGE_MATCH'),
  'postflight.sql':flight(postimages,'R04_SEMANTIC_DEV_POSTIMAGE_MATCH'),
  'acceptance.sql':acceptance,
  'acceptance-readonly.sql':acceptanceReadOnly,
  'postimages.json':JSON.stringify(postimages,null,2)+'\n'
 };

 outputs['manifest.json']=JSON.stringify({
  unit:'R04_DEV_SEMANTIC_ADMISSION_PACKAGE',
  status:'PREPARED_NOT_APPLIED',
  project_ref:preimage.project_ref,
  captured_at:preimage.captured_at,
  changed_functions:Object.values(signatures),
  new_functions:0,
  new_tables:0,
  acl_changes:0,
  source_candidates:[
   'supabase/candidates/r04_semantic_review_pending_projection.sql',
   'supabase/candidates/r04_semantic_batch_admission.sql'
  ],
  source_candidates_sha256:{
   'r04_semantic_review_pending_projection.sql':hash(cand1),
   'r04_semantic_batch_admission.sql':hash(cand2)
  },
  preimage_sha256:hash(read('preimage.json')),
  builder_sha256:hash(read('build.mjs')),
  closure_derivation_sha256:hash(read('closure-postimage.mjs')),
  closure_capture_sha256:hash(read('closure-postimage-offline-evidence-20261102.json')),
  files:Object.fromEntries(Object.entries(outputs).map(([name,s])=>[name,hash(s)])),
  limitations:[
   'Project identity is the connector binding; the GUC is only an intent marker.',
   'R10 source_ready=false and NULL export/erasure bindings stay unchanged; no certification or activation occurs.',
   'Four existing function bodies change; full catalog delta, ACL/config/owner preservation and exact inverse rollback are mandatory.',
   'Single-word low-risk services are unblocked for task publication while maintaining strict screening for broad or ambiguous terms and regulated categories.',
   'Unrecorded synonyms are admitted into review audit ledger as EXISTING_REUSED without mutating global private.work_taxonomy_aliases.',
   'Category identity drift between review and commit is strictly checked via categoryLabel (BATCH_CATEGORY_IDENTITY_CHANGED).',
   'Hosted acceptance covers low-risk single-word triage validation and commit guard; positive real Auth/native acceptance remains a separate root step.',
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
