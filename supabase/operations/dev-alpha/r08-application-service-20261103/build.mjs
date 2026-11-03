// One additive authenticated RPC using existing worker Save/binder storage.
// Generates a guarded DEV operation; no network or deployment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const base=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,base),'utf8').replace(/\r\n/g,'\n');
const deps=JSON.parse(read('dependencies.json')),source=read('../../../proofs/ai/r08_application_service_review_candidate.sql');
const signature='public.rpc_worker_service_from_application(uuid,uuid,uuid,boolean)';
const hash=s=>createHash('sha256').update(s).digest('hex'),q=s=>"'"+s.replaceAll("'","''")+"'";
const ddl=source.slice(source.indexOf('CREATE FUNCTION'),source.lastIndexOf('COMMIT;'));
const capture=read('capture.sql');
const captureSelect=capture.slice(capture.indexOf('SELECT jsonb_build_object('),capture.indexOf(' capture;'));
const observed=`(SELECT capture FROM (${captureSelect} AS capture) x)`;
const context=`IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'APPLICATION_SERVICE_CONTEXT';END IF;`;
const dependencies=`IF ((${observed})-'read_only') IS DISTINCT FROM (${q(JSON.stringify(deps))}::jsonb-'read_only') THEN RAISE EXCEPTION 'APPLICATION_SERVICE_DEPENDENCY_DRIFT';END IF;`;
export async function generate(){
 assert.equal(deps.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(deps.read_only,'on');
 const db=new PGlite();let after;
 try{
  await db.exec('CREATE SCHEMA private;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;SET check_function_bodies=false;');
  // Only row types are needed for DDL derivation; behavioral acceptance is separate.
  for(const r of deps.relations)await db.exec('CREATE TABLE '+r.name+'(placeholder integer)');
  await db.exec(ddl);
  after=(await db.query(`SELECT md5(pg_get_functiondef(${q(signature)}::regprocedure)) md5,proacl::text acl,prosecdef definer,proconfig config FROM pg_proc WHERE oid=${q(signature)}::regprocedure`)).rows[0];
  assert.equal(after.acl,'{postgres=X/postgres,authenticated=X/postgres}');assert.equal(after.definer,true);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') yes',[role,signature])).rows[0].yes,role==='authenticated');
 }finally{await db.close();}
 const guard=installed=>`DO $guard$ BEGIN ${context}\n${dependencies}\n`+(installed?
  `IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(${q(signature)}) AND md5(pg_get_functiondef(oid))=${q(after.md5)} AND proacl::text=${q(after.acl)} AND pg_get_userbyid(proowner)='postgres' AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']) THEN RAISE EXCEPTION 'APPLICATION_SERVICE_POSTIMAGE';END IF;`:
  `IF to_regprocedure(${q(signature)}) IS NOT NULL THEN RAISE EXCEPTION 'APPLICATION_SERVICE_ALREADY_PRESENT';END IF;`)+`END $guard$;`;
 const tx=body=>"BEGIN;SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';\n"+body+"\nNOTIFY pgrst,'reload schema';COMMIT;\n";
 const files={
  'preflight.sql':'BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;\n'+guard(false)+"\nSELECT 'APPLICATION_SERVICE_PREIMAGE_MATCH' result;ROLLBACK;\n",
  'promotion.sql':tx(guard(false)+'\n'+ddl+'\n'+guard(true)),
  'postflight.sql':'BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;\n'+guard(true)+"\nSELECT 'APPLICATION_SERVICE_POSTIMAGE_MATCH' result;ROLLBACK;\n",
  'rollback.sql':tx(guard(true)+'\nDROP FUNCTION '+signature+' RESTRICT;\n'+guard(false)),
 };
 files['manifest.json']=JSON.stringify({project_ref:deps.project_ref,status:'PREPARED_NOT_APPLIED',signature,
  source_sha256:hash(source),dependencies_sha256:hash(read('dependencies.json')),postimage:after,
  files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)])),
  requirements:['Relevant full CI success; read-only preflight; guarded transaction and postflight; TEST Auth/UI acceptance.'],
  recovery:'Remove only this additive endpoint. Preserve all profile, review, capability and Save data; reapply restores receipt lookup.',
  limits:['No new storage or readiness/certificate changes. Global R01/R10 remain open.','Isolated SQL proof does not establish real Auth/HTTP or Android behavior.']},null,2)+'\n';
 return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const files=await generate();
 if(process.argv[2]==='--write')for(const[n,s]of Object.entries(files))writeFileSync(new URL(n,base),s);
 else if(process.argv[2]==='--check'){for(const[n,s]of Object.entries(files))assert.equal(read(n),s,n);console.log('APPLICATION_SERVICE_PACKAGE_PASS');}
 else throw Error('Use --write or --check');
}
