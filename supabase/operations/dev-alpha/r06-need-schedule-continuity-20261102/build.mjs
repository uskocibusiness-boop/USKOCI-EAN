// Offline derivation only. No database connection or provider call.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,base),'utf8');
const before=JSON.parse(read('preimage.json'));
const candidate=read('../../../proofs/ai/r06_need_schedule_continuity_candidate.sql');
const q=s=>"'"+s.replaceAll("'","''")+"'",hash=(s,a='sha256')=>createHash(a).update(s).digest('hex');
const start=candidate.indexOf('AS $function$')+13,end=candidate.lastIndexOf('$function$');
assert.ok(start>13&&end>start);
const original=before.function.definition,body=candidate.slice(start,end);
const next=original.slice(0,original.indexOf('AS $function$')+13)+body+original.slice(original.lastIndexOf('$function$'));
assert.equal(hash(original,'md5'),before.function.md5);
assert.equal(before.read_only,'on');assert.equal(before.project_ref,'leqcwgzvjsxugfgzdmth');
// The live closure definitions are pinned below. This completion function is
// outside their function/trigger rosters; unchanged closure is a hard postcheck.
const closure=`jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5())`;
const guard=definition=>`DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>${q(before.owner)} OR current_setting('server_version_num')<>${q(before.server_version_num)} THEN RAISE EXCEPTION 'R06_CONTINUITY_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${q(before.function.signature)}) AND md5(pg_get_functiondef(p.oid))=${q(hash(definition,'md5'))} AND to_jsonb(p)-'prosrc'=${q(JSON.stringify(before.function.attributes))}::jsonb) THEN RAISE EXCEPTION 'R06_CONTINUITY_FUNCTION_DRIFT';END IF;
 ${before.dependencies.map(d=>`IF md5(pg_get_functiondef(to_regprocedure(${q(d.signature)}))) IS DISTINCT FROM ${q(d.md5)} THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;`).join('\n ')}
 IF ${closure} IS DISTINCT FROM ${q(JSON.stringify(before.closure))}::jsonb THEN RAISE EXCEPTION 'R06_CONTINUITY_CLOSURE_DRIFT';END IF;
 END; $guard$;\n`;
const catalogBefore=`CREATE TEMP TABLE r06_continuity_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');\n`;
const catalogAfter=`DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_continuity_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid=to_regprocedure(${q(before.function.signature)}) THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_CONTINUITY_UNRELATED_DELTA';END IF;END; $delta$;\n`;
const transaction=(from,to)=>`BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';\n${guard(from)}${catalogBefore}${to.trimEnd()};\n${guard(to)}${catalogAfter}COMMIT;\n`;
const files={
 'preflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(original)}SELECT 'R06_NEED_CONTINUITY_PREIMAGE_MATCH' result;ROLLBACK;\n`,
 'promotion.sql':transaction(original,next),
 'postflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(next)}SELECT 'R06_NEED_CONTINUITY_POSTIMAGE_MATCH' result;ROLLBACK;\n`,
 'rollback.sql':transaction(next,original),
};
files['manifest.json']=JSON.stringify({status:'PREPARED_NOT_APPLIED',project:before.project_ref,functions:1,preimage_md5:before.function.md5,postimage_md5:hash(next,'md5'),candidate_sha256:hash(candidate),preimage_sha256:hash(read('preimage.json')),closure:'UNCHANGED_REQUIRED',files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)]))},null,2)+'\n';
for(const[n,s]of Object.entries(files)){if(process.argv.includes('--check'))assert.equal(read(n),s,'Generated drift: '+n);else writeFileSync(new URL(n,base),s);}
console.log('R06_NEED_CONTINUITY_PACKAGE_PASS');
