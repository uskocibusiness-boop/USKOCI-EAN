// Offline two-body derivation. This composes the existing scheduling fix with
// the native-reproduced 13-fact boundary; no network, promotion or new schema.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MAX_AI_NEED_FACT_V2_PROPOSALS} from '../../../../src/contracts/needFactsV2.ts';
const base=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,base),'utf8');
const pre=JSON.parse(read('preimage.json'));
const schedulePre=JSON.parse(read('../r06-need-schedule-continuity-20261102/preimage.json'));
const candidate=read('../../../proofs/ai/r06_need_schedule_continuity_candidate.sql');
const q=s=>"'"+s.replaceAll("'","''")+"'",hash=(s,a='sha256')=>createHash(a).update(s).digest('hex');
assert.equal(pre.read_only,'on');assert.equal(pre.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(pre.owner,'postgres');
assert.equal(pre.functions.length,2);assert.equal(MAX_AI_NEED_FACT_V2_PROPOSALS,22,'New registry requires a fresh SQL/client compatibility review');
const functions=pre.functions.map(f=>{
 assert.equal(hash(f.definition,'md5'),f.md5);
 let next=f.definition;
 if(f.signature.startsWith('rpc_ai_complete_')){
  assert.equal(f.md5,schedulePre.function.md5);
  const start=candidate.indexOf('AS $function$')+13,end=candidate.lastIndexOf('$function$');
  assert.ok(start>13&&end>start);
  next=next.slice(0,next.indexOf('AS $function$')+13)+candidate.slice(start,end)+next.slice(next.lastIndexOf('$function$'));
  assert.equal(next.split('not between 0 and 12').length,2);
  next=next.replace('not between 0 and 12','not between 0 and '+MAX_AI_NEED_FACT_V2_PROPOSALS);
 }else{
  assert.equal(next.split('jsonb_array_length(v_proposals)>12').length,2);
  next=next.replace('jsonb_array_length(v_proposals)>12','jsonb_array_length(v_proposals)>'+MAX_AI_NEED_FACT_V2_PROPOSALS);
 }
 return {...f,next,post_md5:hash(next,'md5')};
});
const closure=`jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5())`;
const guard=after=>`DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>${q(pre.owner)} OR current_setting('server_version_num')<>${q(pre.server_version_num)} THEN RAISE EXCEPTION 'R06_COMPLETE_CONTEXT_DRIFT';END IF;
 ${functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${q('public.'+f.signature)}) AND md5(pg_get_functiondef(p.oid))=${q(after?f.post_md5:f.md5)} AND to_jsonb(p)-'prosrc'=${q(JSON.stringify(f.attributes))}::jsonb) THEN RAISE EXCEPTION 'R06_COMPLETE_FUNCTION_DRIFT';END IF;`).join('\n ')}
 ${schedulePre.dependencies.map(d=>`IF md5(pg_get_functiondef(to_regprocedure(${q(d.signature)}))) IS DISTINCT FROM ${q(d.md5)} THEN RAISE EXCEPTION 'R06_COMPLETE_DEPENDENCY_DRIFT';END IF;`).join('\n ')}
 IF md5(pg_get_functiondef('private.validate_need_v2_fact(text,jsonb)'::regprocedure))<>${q(pre.validator.md5)} THEN RAISE EXCEPTION 'R06_COMPLETE_VALIDATOR_DRIFT';END IF;
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY fact_key) FROM private.need_fact_registry r) IS DISTINCT FROM ${q(JSON.stringify(pre.registry))}::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_REGISTRY_DRIFT';END IF;
 IF ${closure} IS DISTINCT FROM ${q(JSON.stringify(pre.closure))}::jsonb THEN RAISE EXCEPTION 'R06_COMPLETE_CLOSURE_DRIFT';END IF;
 END $guard$;\n`;
const catalogBefore=`CREATE TEMP TABLE r06_complete_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');\n`;
const catalogAfter=`DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_complete_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid IN(${functions.map(f=>q('public.'+f.signature)+'::regprocedure').join(',')}) THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_COMPLETE_UNRELATED_DELTA';END IF;END $delta$;\n`;
const transaction=after=>`BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';\n${guard(!after)}${catalogBefore}${functions.map(f=>(after?f.next:f.definition).trimEnd()+';').join('\n')}\n${guard(after)}${catalogAfter}COMMIT;\n`;
const files={
 'preflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(false)}SELECT 'R06_COMPLETE_TURN_PREIMAGE_MATCH' result;ROLLBACK;\n`,
 'promotion.sql':transaction(true),
 'postflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(true)}SELECT 'R06_COMPLETE_TURN_POSTIMAGE_MATCH' result;ROLLBACK;\n`,
 'rollback.sql':transaction(false),
};
files['manifest.json']=JSON.stringify({status:'PREPARED_NOT_APPLIED',project:pre.project_ref,functions:functions.map(f=>({signature:'public.'+f.signature,preimage_md5:f.md5,postimage_md5:f.post_md5})),max_proposals:MAX_AI_NEED_FACT_V2_PROPOSALS,scheduling_candidate_sha256:hash(candidate),preimage_sha256:hash(read('preimage.json')),closure:'UNCHANGED_REQUIRED',files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)]))},null,2)+'\n';
for(const[n,s]of Object.entries(files)){if(process.argv.includes('--check'))assert.equal(read(n),s,'Generated drift: '+n);else writeFileSync(new URL(n,base),s);}
console.log('R06_COMPLETE_TURN_PACKAGE_PASS');
