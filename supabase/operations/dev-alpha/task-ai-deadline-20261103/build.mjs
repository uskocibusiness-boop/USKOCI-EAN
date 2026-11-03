// Optional deadline fact. Preserve current edit recovery and delegate review.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8').replace(/\r\n/g,'\n');
const source=read('../../../../docs/candidates/task-ai-deadline-20261021/forward_candidate.sql');
const pre=JSON.parse(read('../../../../docs/candidates/task-ai-deadline-20261021/preimage-20261103.json'));
const closure=JSON.parse(read('closure-preimage.json')),q=s=>"'"+s.replaceAll("'","''")+"'";
const hash=s=>createHash('sha256').update(s).digest('hex');
const definitions=[...source.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (?:public|private)\.[\s\S]*?\$function\$;/g)].map(m=>m[0]);
const grants=source.slice(source.indexOf('revoke all on function public.rpc_prepare_ai_task_review_deadline('),source.indexOf('do $proof$'));
const helperGrant='REVOKE ALL ON FUNCTION private.ai_task_response_deadline_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;';
const row={fact_key:'need.response_deadline',schema_version:'NEED_FACT_V2',value_type:'OBJECT',required_for_draft:false,privacy_class:'PUBLIC',material:true,target_owner:'needs.response_deadline'};
const registry=`INSERT INTO private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner) VALUES('need.response_deadline','NEED_FACT_V2','OBJECT',false,'PUBLIC',true,'needs.response_deadline');`;
const state=`jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5())`;
export async function generate(){
 assert.equal(pre.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(pre.read_only,true);assert.equal(definitions.length,7);
 const db=new PGlite();let after;
 try{
  await db.exec('CREATE SCHEMA private;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;SET check_function_bodies=false;CREATE TABLE public.ai_conversations(id uuid);CREATE TABLE public.needs(id uuid);CREATE TABLE public.need_sensitive(id uuid);');
  for(const f of pre.functions){await db.exec(f.definition+';');await db.exec('REVOKE ALL ON FUNCTION '+f.signature+' FROM PUBLIC,anon,authenticated,service_role;'+
   (f.attributes.proacl?.some(x=>x.startsWith('authenticated='))?'GRANT EXECUTE ON FUNCTION '+f.signature+' TO authenticated;':''));}
  await db.exec(definitions.join('\n')+'\n'+helperGrant+'\n'+grants);
  after=(await db.query("SELECT p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.proconfig config FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') ORDER BY 1")).rows;
 }finally{await db.close();}
 // PGlite public search_path shortens regprocedure names; qualify the result.
 for(const f of after)if(!f.signature.includes('.'))f.signature='public.'+f.signature;
 const created=after.filter(f=>!pre.functions.some(p=>p.signature===f.signature));assert.equal(created.length,3);
 const guard=installed=>`DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'TASK_DEADLINE_CONTEXT';END IF;
 IF ${state} IS DISTINCT FROM ${q(JSON.stringify(closure))}::jsonb THEN RAISE EXCEPTION 'TASK_DEADLINE_CLOSURE_DRIFT';END IF;
 ${pre.functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure(${q(f.signature)}) AND md5(pg_get_functiondef(oid))=${q(installed?after.find(x=>x.signature===f.signature).md5:f.md5)} AND to_jsonb(p)-'prosrc'=${q(JSON.stringify(f.attributes))}::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%',${q(f.signature)};END IF;`).join('\n')}
 ${created.map(f=>installed?`IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(${q(f.signature)}) AND md5(pg_get_functiondef(oid))=${q(f.md5)} AND pg_get_userbyid(proowner)='postgres' AND proacl::text=${q(f.acl)}) THEN RAISE EXCEPTION 'TASK_DEADLINE_POSTIMAGE';END IF;`:`IF to_regprocedure(${q(f.signature)}) IS NOT NULL THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_PRESENT';END IF;`).join('\n')}
 ${installed?`IF (SELECT to_jsonb(r) FROM private.need_fact_registry r WHERE fact_key='need.response_deadline') IS DISTINCT FROM ${q(JSON.stringify(row))}::jsonb THEN RAISE EXCEPTION 'TASK_DEADLINE_REGISTRY_DRIFT';END IF;`:`IF EXISTS(SELECT 1 FROM private.need_fact_registry WHERE fact_key='need.response_deadline') THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_REGISTERED';END IF;`}
 END $guard$;`;
 const tx=sql=>"BEGIN;SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';\n"+sql+"\nNOTIFY pgrst,'reload schema';COMMIT;\n";
 const files={
  'preflight.sql':'BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;\n'+guard(false)+"\nSELECT 'TASK_DEADLINE_PREIMAGE_MATCH' result;ROLLBACK;\n",
  'promotion.sql':tx(guard(false)+'\n'+registry+'\n'+definitions.join('\n')+'\n'+helperGrant+'\n'+grants+'\n'+guard(true)),
  'postflight.sql':'BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;\n'+guard(true)+"\nSELECT 'TASK_DEADLINE_POSTIMAGE_MATCH' result;ROLLBACK;\n",
  'rollback.sql':tx(guard(true)+"\nDO $unused$ BEGIN IF EXISTS(SELECT 1 FROM public.ai_structured_facts WHERE fact_key='need.response_deadline') THEN RAISE EXCEPTION 'TASK_DEADLINE_IN_USE_FORWARD_RECOVERY';END IF;END $unused$;\n"+
   created.filter(f=>f.signature.startsWith('public.')).map(f=>'DROP FUNCTION '+f.signature+' RESTRICT;').join('\n')+'\nDROP FUNCTION private.ai_task_response_deadline_v1(jsonb) RESTRICT;\n'+
   pre.functions.filter(f=>definitions.some(d=>d.includes('FUNCTION '+f.signature.split('(')[0]+'('))).map(f=>f.definition+';').join('\n')+"\nDELETE FROM private.need_fact_registry WHERE fact_key='need.response_deadline';\n"+guard(false)),
 };
 files['manifest.json']=JSON.stringify({project_ref:pre.project_ref,status:'PREPARED_NOT_APPLIED',candidate_sha256:hash(source),preimage_sha256:hash(read('../../../../docs/candidates/task-ai-deadline-20261021/preimage-20261103.json')),
  changed_functions:4,new_functions:3,closure:'UNCHANGED_REQUIRED',files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)])),
  activation:'Separate compatible Edge/client flags. Do not enable until both ends and signed review/readback have been checked.',
  recovery:'Inverse only before first deadline fact; otherwise compatible forward recovery.',limits:['No DEV or Auth/HTTP proof from generation. Global R01/R10 remain open.']},null,2)+'\n';
 return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const files=await generate();if(process.argv[2]==='--write')for(const[n,s]of Object.entries(files))writeFileSync(new URL(n,root),s);
 else if(process.argv[2]==='--check'){for(const[n,s]of Object.entries(files))assert.equal(read(n),s,n);console.log('TASK_DEADLINE_PACKAGE_PASS');}else throw Error('Use --write or --check');
}
