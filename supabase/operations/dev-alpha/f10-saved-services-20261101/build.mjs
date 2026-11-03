// Offline exact-byte derivation. No network connection or deployment command.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const root=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const hash=(s,kind='sha256')=>createHash(kind).update(s).digest('hex'),quote=s=>"'"+s.replaceAll("'","''")+"'";
const target='leqcwgzvjsxugfgzdmth',signature='public.rpc_get_worker_execution_modes(uuid)';
const candidateUrl=new URL('../../../candidates/r08_saved_worker_services.sql',import.meta.url);
export const preimage=JSON.parse(read('preimage.json'));
export const original=preimage.functions.find(f=>f.signature===signature);
const dependencies=preimage.functions.filter(f=>f!==original);
const relationQuery='WITH names(name) AS '+read('capture.sql').split('names(name) AS ')[1].split("SELECT jsonb_build_object('unit','F10_DEV_PREIMAGE'")[0]
 +'SELECT md5(tables::text) FROM relations';
const ddl=f=>f.definition.trimEnd()+';\n';
export async function localCatalog(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec('CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;SET check_function_bodies=off;');
 for(const f of preimage.functions.filter(f=>!f.signature.startsWith('extensions.'))){
  await db.exec(ddl(f)+'REVOKE ALL ON FUNCTION '+f.signature+' FROM PUBLIC,anon,authenticated,service_role;'+
   f.acl_entries.filter(a=>a.grantee!==f.owner).map(a=>{
    assert.equal(a.grantor,f.owner);assert.equal(a.privilege,'EXECUTE');assert.equal(a.grantable,false);
    assert.ok(['service_role','authenticated'].includes(a.grantee));return 'GRANT EXECUTE ON FUNCTION '+f.signature+' TO '+a.grantee+';';
   }).join('\n'));
 }
 return db;
}
export async function captureReader(db){
 return (await db.query(`SELECT pg_get_functiondef(p.oid) AS definition,md5(pg_get_functiondef(p.oid)) AS definition_md5,
 md5(replace(p.prosrc,E'\\r\\n',E'\\n')) AS body_md5,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl
 FROM pg_proc p WHERE p.oid=to_regprocedure($1)`,[signature])).rows[0];
}
function functionGuard(functions){return functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${quote(f.signature)})
 AND p.oid=${f.oid} AND md5(pg_get_functiondef(p.oid))=${quote(f.definition_md5)}
 AND pg_get_userbyid(p.proowner)=${quote(f.owner)} AND p.proacl::text IS NOT DISTINCT FROM ${f.acl===null?'NULL':quote(f.acl)})
 THEN RAISE EXCEPTION 'F10_DEV_FUNCTION_DRIFT:%',${quote(f.signature)}; END IF;`).join('\n');}
function contextGuard(intent=false){return `IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 ${intent?"OR current_setting('uskoci.f10.dev_target',true) IS DISTINCT FROM '"+target+"'":''}
 THEN RAISE EXCEPTION 'F10_DEV_CONTEXT_REFUSED'; END IF;`;}
function dependenciesGuard(){return functionGuard(dependencies)+`\nIF (${relationQuery}) IS DISTINCT FROM '${preimage.tables_md5}'
 THEN RAISE EXCEPTION 'F10_DEV_RELATION_DRIFT'; END IF;`;}
const guard=(name,functions,intent=false)=>`DO $${name}$ BEGIN\n${contextGuard(intent)}\n${functionGuard(functions)}\n${dependenciesGuard()}\nEND; $${name}$;\n`;
export function wrap(sql,commit=false){return `BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.f10.dev_target='${target}';\n${sql}\n${commit?'COMMIT':'ROLLBACK'};\n`;}
export async function generate(){
 assert.equal(preimage.project_id,target);assert.equal(preimage.read_only,'on');assert.equal(preimage.capture_role,'postgres');
 assert.equal(preimage.server_version_num,170006);assert.equal(preimage.functions.length,4);assert.equal(preimage.tables.length,11);
 for(const f of preimage.functions){assert.ok(f.oid);assert.equal(hash(f.definition,'md5'),f.definition_md5);}
 for(const table of preimage.tables)assert.ok(table.oid&&table.columns.length,table.name);
 const db=await localCatalog();let post;
 try{
  const before=await captureReader(db);assert.equal(before.definition_md5,original.definition_md5);assert.equal(before.acl,original.acl);
  await db.exec("SELECT set_config('uskoci.f10.disposable','LOCAL_ONLY',false)");
  // Execute the tested candidate unchanged, with its complete LOCAL_ONLY admission guard.
  await db.exec(readFileSync(candidateUrl,'utf8'));
  post={signature,oid:original.oid,...await captureReader(db)};
  assert.equal(post.owner,original.owner);assert.equal(post.acl,original.acl);
 }finally{await db.close();}
 const rollback=guard('f10_rollback_pre',[post],true)+ddl(original)+guard('f10_rollback_post',[original],true)+"NOTIFY pgrst,'reload schema';\n";
 const flight=(f,name)=>`BEGIN TRANSACTION READ ONLY;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='15s';\n${guard('f10_readback',[f])}
SELECT '${name}' AS metadata_result,false AS functional_acceptance_proven;\nROLLBACK;\n`;
 const projection=post.definition.slice(post.definition.indexOf(' WITH names AS ('),post.definition.indexOf(' RETURN jsonb_build_object'));
 assert.ok(projection.startsWith(' WITH names AS (')&&projection.endsWith('INTO v_services FROM projected;\n'));
 const acceptance=`-- F10 no-row acceptance fragment inside the reviewed migration transaction.
-- No profile/review/capability records are inserted or returned.
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $auth$ BEGIN
 BEGIN PERFORM public.rpc_get_worker_execution_modes(NULL);
  RAISE EXCEPTION 'F10_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '28000' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE; END IF; END;
END $auth$;
SELECT set_config('request.jwt.claim.sub','00000000-0010-4010-8010-000000000999',true);
DO $owner$ BEGIN
 BEGIN PERFORM public.rpc_get_worker_execution_modes(NULL);
  RAISE EXCEPTION 'F10_EXPECTED_OWNER_DENIAL';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'WORKER_PROFILE_NOT_OWNED' THEN RAISE; END IF; END;
END $owner$;
RESET ROLE;
-- Execute the exact new projection against the actual relation schema with no
-- names and NULL ownership/profile keys. No real account is selected or returned.
DO $empty_projection$
DECLARE v_profile public.app_profiles;v_account uuid:=NULL;p_worker_profile_id uuid:=NULL;
 v_modes text[]:=NULL;v_at timestamptz:=NULL;v_services jsonb;
BEGIN v_profile.skills:=ARRAY[]::text[];
${projection}
 IF v_services IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'F10_EMPTY_PROJECTION_INVALID'; END IF;
END $empty_projection$;
`;
 const forward=guard('f10_pre',[original],true)+ddl(post)+acceptance+guard('f10_post',[post],true)+"NOTIFY pgrst,'reload schema';\n";
 const outputs={'forward.sql':forward,'rollback.sql':rollback,'preflight.sql':flight(original,'F10_DEV_PREIMAGE_MATCH'),
  'postflight.sql':flight(post,'F10_DEV_POSTIMAGE_MATCH'),'acceptance.sql':acceptance,'postimage.json':JSON.stringify(post,null,2)+'\n'};
 outputs['manifest.json']=JSON.stringify({unit:'F10_DEV_PACKAGE',format_version:1,status:'PREPARED_NOT_APPLIED',project_id:target,
  captured_at:preimage.captured_at,server_version_num:170006,changed_functions:1,new_functions:0,new_tables:0,
  source_candidate:'supabase/candidates/r08_saved_worker_services.sql',candidate_sha256:hash(readFileSync(candidateUrl)),
  preimage_sha256:hash(read('preimage.json')),pinned_dependency_functions:3,pinned_relations:11,
  files:Object.fromEntries(Object.entries(outputs).map(([n,s])=>[n,hash(s)])),
  limitations:['External connector project binding is required; the target GUC is an intent marker only.',
   'The candidate LOCAL_ONLY guard is executed unchanged in disposable derivation; no setting bypass is sent to DEV.',
   'Hosted DDL must use the controlled migration tool after review, including temporary or rollback-only DDL; execute_sql is metadata-only.',
   'Acceptance uses auth denial, NULL profile ownership and empty projection only; it is not real-user Save/reopen acceptance.',
   'Forward/rollback changes only one reader definition and preserves its existing ACL; no data or activation compensation.',
   'No committed DEV deployment, migration history, Edge change or Android acceptance is claimed.']},null,2)+'\n';
 return outputs;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputs=await generate();
 if(process.argv[2]==='--write')for(const[n,s]of Object.entries(outputs))writeFileSync(new URL(n,root),s);
 else if(process.argv[2]==='--check'){for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);console.log('F10 exact package generation PASS');}
 else if(process.argv[2]==='--emit'&&['forward','rollback'].includes(process.argv[3])){
  for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);process.stdout.write(wrap(outputs[process.argv[3]+'.sql'],true));
 }else throw Error('Use --write, --check, or --emit forward|rollback. This program never deploys.');
}
