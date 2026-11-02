// One existing function body. This generator never connects to a database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('./',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
const pre=JSON.parse(read('../../../proofs/ai/r06_need_edit_resume_preimage.json'));
const source=read('../../../proofs/ai/r06_need_edit_resume_candidate.sql');
// pg_get_functiondef ends at the closing dollar quote plus ONE newline. The
// SQL statement delimiter belongs only in the executable transaction below.
const next=source.slice(source.indexOf('CREATE OR REPLACE FUNCTION'),source.lastIndexOf('$function$')+'$function$'.length)+'\n';
const q=s=>"'"+s.replaceAll("'","''")+"'",hash=(s,a='sha256')=>createHash(a).update(s).digest('hex');
const original=pre.function.definition;
assert.equal(hash(original,'md5'),pre.function.md5);
assert.equal(next.slice(0,next.indexOf('AS $function$')),original.slice(0,original.indexOf('AS $function$')));
assert.equal(pre.read_only,'on');assert.equal(pre.owner,'postgres');assert.equal(pre.closure.source_ready,false);
const closure=`jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5())`;
const guard=after=>`DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>${q(pre.owner)} OR current_setting('server_version_num')<>${q(pre.server_version_num)} THEN RAISE EXCEPTION 'R06_EDIT_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${q(pre.function.signature)}) AND md5(pg_get_functiondef(p.oid))=${q(after?hash(next,'md5'):pre.function.md5)} AND to_jsonb(p)-'prosrc'=${q(JSON.stringify(pre.function.attributes))}::jsonb) THEN RAISE EXCEPTION 'R06_EDIT_FUNCTION_DRIFT';END IF;
 ${pre.dependencies.map(d=>`IF md5(pg_get_functiondef(to_regprocedure(${q(d.signature)}))) IS DISTINCT FROM ${q(d.md5)} THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;`).join('\n ')}
 IF ${closure} IS DISTINCT FROM ${q(JSON.stringify(pre.closure))}::jsonb THEN RAISE EXCEPTION 'R06_EDIT_CLOSURE_DRIFT';END IF;
 END $guard$;\n`;
const before=`CREATE TEMP TABLE r06_edit_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');\n`;
const after=`DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_edit_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid=${q(pre.function.signature)}::regprocedure THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_EDIT_UNRELATED_DELTA';END IF;END $delta$;\n`;
const transaction=forward=>`BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';\n${guard(!forward)}${before}${(forward?next:original).trimEnd()};\n${guard(forward)}${after}COMMIT;\n`;
const files={
 'preflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(false)}SELECT 'R06_EDIT_RESUME_PREIMAGE_MATCH' result;ROLLBACK;\n`,
 'promotion.sql':transaction(true),
 'postflight.sql':`BEGIN TRANSACTION READ ONLY;\n${guard(true)}SELECT 'R06_EDIT_RESUME_POSTIMAGE_MATCH' result;ROLLBACK;\n`,
 'rollback.sql':transaction(false),
};
files['manifest.json']=JSON.stringify({status:'PREPARED_NOT_APPLIED',project:pre.project_ref,function:pre.function.signature,
preimage_md5:pre.function.md5,postimage_md5:hash(next,'md5'),candidate_sha256:hash(source),
closure:'UNCHANGED_REQUIRED; readiness remains false',files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)]))},null,2)+'\n';
for(const[n,s]of Object.entries(files)){if(process.argv.includes('--check'))assert.equal(read(n),s,'Generated drift: '+n);else writeFileSync(new URL(n,base),s);}
console.log('R06_EDIT_RESUME_PACKAGE_PASS');
