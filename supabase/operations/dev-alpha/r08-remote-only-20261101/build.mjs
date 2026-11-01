// Exact R08 DEV package preparation; this program never connects to a database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('./',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const digest=(s,kind='sha256')=>createHash(kind).update(s).digest('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const ddl=f=>f.definition.trimEnd()+';\n';
const candidateUrl=new URL('../../../candidates/r08_remote_only_activation.sql',import.meta.url);
export const preimage=JSON.parse(read('preimage.json'));
export const dependencies=JSON.parse(read('dependencies.json'));
export const acceptanceDependencies=JSON.parse(read('acceptance-dependencies.json'));
export const helpers=Object.keys(preimage.new_helpers).sort();
const originals=preimage.functions;
const target='leqcwgzvjsxugfgzdmth';
const mutable=new Set(originals.map(f=>f.signature));
const depFunctions=dependencies.functions.filter(f=>!mutable.has(f.signature));
const catalog=read('capture-dependencies.sql').split('WITH names(name) AS ')[1]
 .split('SELECT capture,md5((capture')[0];
const tableFingerprintSql='WITH names(name) AS '+catalog+'SELECT md5((capture->\'tables\')::text) FROM capture';

function restoreAcl(f){
 const revoked=['PUBLIC','anon','authenticated','service_role','dashboard_user'];
 return 'REVOKE ALL ON FUNCTION '+f.signature+' FROM '+revoked.map(x=>x==='PUBLIC'?x:ident(x)).join(',')+';\n'+
  f.acl_entries.filter(a=>a.grantee!==f.owner).sort((a,b)=>f.acl.indexOf(a.grantee+'=')-f.acl.indexOf(b.grantee+'=')).map(a=>{
   assert.equal(a.grantor,f.owner);assert.equal(a.privilege,'EXECUTE');
   return 'GRANT EXECUTE ON FUNCTION '+f.signature+' TO '+(a.grantee==='PUBLIC'?'PUBLIC':ident(a.grantee))+
    (a.grantable?' WITH GRANT OPTION':'')+';';}).join('\n');
}
export async function localCatalog(){
 const db=new PGlite();
 await db.exec('CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;'+
  'CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE dashboard_user;'+
  'SET check_function_bodies=off;SET search_path=pg_catalog;');
 for(const f of originals){await db.exec(ddl(f)+restoreAcl(f));}
 return db;
}
export async function captureFunctions(db,signatures){
 const rows=[];
 for(const signature of signatures){
  const r=(await db.query(`SELECT pg_get_functiondef(p.oid) AS definition,
   md5(pg_get_functiondef(p.oid)) AS definition_md5,pg_get_userbyid(p.proowner) AS owner,
   p.proacl::text AS acl FROM pg_proc p WHERE p.oid=to_regprocedure($1)`,[signature])).rows[0];
  assert.ok(r,signature);rows.push({signature,...r});
 }
 return rows;
}
export async function derivePostimage(){
 assert.equal(preimage.project_id,target);assert.equal(preimage.read_only,'on');
 assert.equal(preimage.server_version_num,170006);assert.equal(preimage.capture_role,'postgres');
 assert.equal(originals.length,7);assert.equal(dependencies.missing_names.length,0);
 assert.ok(helpers.length===3&&helpers.every(h=>preimage.new_helpers[h]===false));
 for(const f of originals){assert.equal(digest(f.definition,'md5'),f.definition_md5);assert.equal(f.owner,'postgres');}
 const db=await localCatalog();
 try{
  const before=await captureFunctions(db,originals.map(f=>f.signature));
  for(const f of before)assert.equal(f.definition_md5,originals.find(p=>p.signature===f.signature).definition_md5);
  await db.exec("SELECT set_config('uskoci.r08.remote_only.disposable','LOCAL_ONLY',false)");
  await db.exec(readFileSync(candidateUrl,'utf8'));
  return await captureFunctions(db,[...originals.map(f=>f.signature),...helpers]);
 }finally{await db.close();}
}
function functionGuard(functions,{pinOid=false}={}){
 return functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${quote(f.signature)})
  ${pinOid?'AND p.oid='+f.oid:''}
  AND md5(pg_get_functiondef(p.oid))=${quote(f.definition_md5)}
  AND pg_get_userbyid(p.proowner)=${quote(f.owner)} AND p.proacl::text IS NOT DISTINCT FROM ${f.acl===null?'NULL':quote(f.acl)})
 THEN RAISE EXCEPTION 'R08_DEV_FUNCTION_DRIFT'; END IF;`).join('\n');
}
function contextGuard(){return `IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r08.dev_target',true) IS DISTINCT FROM '${target}'
 THEN RAISE EXCEPTION 'R08_DEV_CONTEXT_REFUSED'; END IF;`;}
function dependencyGuard(){return functionGuard(depFunctions)+`
 IF (${tableFingerprintSql}) IS DISTINCT FROM '${dependencies.tables_md5}'
 THEN RAISE EXCEPTION 'R08_DEV_RELATION_DRIFT'; END IF;`;}
function noCitylessGuard(){return `IF EXISTS(SELECT 1 FROM public.app_profiles
 WHERE kind='WORKER' AND profile_status='ACTIVE' AND char_length(btrim(coalesce(city,'')))<2)
 THEN RAISE EXCEPTION 'R08_DEV_ACTIVE_CITYLESS_REQUIRES_FORWARD_RECOVERY'; END IF;`;}
const locks=`LOCK TABLE public.app_profiles,private.worker_ai_sessions,private.worker_ai_reviews,private.worker_ai_saves
 IN SHARE ROW EXCLUSIVE MODE;`;
function acceptanceGuard(){
 const tables=acceptanceDependencies.tables.map(t=>{
  const expected={triggers:t.triggers.map(x=>({definition:x.definition,signature:x.signature,md5:x.md5,enabled:x.enabled})),rules:t.rules};
  return `IF (SELECT jsonb_build_object('triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'definition',pg_get_triggerdef(t.oid),'signature',t.tgfoid::regprocedure::text,
   'md5',md5(pg_get_functiondef(t.tgfoid)),'enabled',t.tgenabled) ORDER BY t.tgname)
   FROM pg_trigger t WHERE t.tgrelid=to_regclass(${quote(t.name)}) AND NOT t.tgisinternal),'[]'::jsonb),
   'rules',COALESCE((SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.rulename) FROM pg_rewrite r
   WHERE r.ev_class=to_regclass(${quote(t.name)})),'[]'::jsonb))) IS DISTINCT FROM ${quote(JSON.stringify(expected))}::jsonb
   OR to_regclass(${quote(t.name)}) IS NULL
  THEN RAISE EXCEPTION 'R08_ACCEPTANCE_TRIGGER_DRIFT'; END IF;`;
 }).join('\n');
 const funcs=acceptanceDependencies.functions.map(f=>`IF md5(pg_get_functiondef(to_regprocedure(${quote(f.signature)})))
  IS DISTINCT FROM ${quote(f.md5)} THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DEPENDENCY_DRIFT'; END IF;`).join('\n');
 return `LOCK TABLE ${acceptanceDependencies.tables.map(t=>t.name).join(',')} IN SHARE ROW EXCLUSIVE MODE;
DO $r08_acceptance_surface$ BEGIN
${tables}\n${funcs}
END;$r08_acceptance_surface$;\n`;
}
const cleanFixture=`DO $r08_clean_fixture$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='af081101-0000-4000-8000-000000000001')
  OR EXISTS(SELECT 1 FROM private.account_lineage_v5 WHERE account_id='af081101-0000-4000-8000-000000000001')
  OR EXISTS(SELECT 1 FROM public.ai_conversations WHERE id='af081101-0000-4000-8000-000000000003')
  OR EXISTS(SELECT 1 FROM private.worker_ai_sessions WHERE conversation_id='af081101-0000-4000-8000-000000000003')
  OR EXISTS(SELECT 1 FROM private.worker_ai_saves WHERE account_id='af081101-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_FIXTURE_NOT_ROLLED_BACK'; END IF;
END;$r08_clean_fixture$;`;
function unavailableGuard(){return helpers.map(s=>`IF to_regprocedure(${quote(s)}) IS NOT NULL
 THEN RAISE EXCEPTION 'R08_DEV_HELPER_ALREADY_PRESENT'; END IF;`).join('\n');}
export async function generate(){
 const post=await derivePostimage();
 const created=post.filter(f=>helpers.includes(f.signature));
 const changed=post.filter(f=>!helpers.includes(f.signature));
 // CREATE OR REPLACE must preserve existing ACLs; never repair a derivation
 // mismatch by overwriting the observed result with the desired preimage.
 for(const f of changed)assert.equal(f.acl,originals.find(p=>p.signature===f.signature).acl,f.signature+' ACL');
 const forward=`-- R08 exact DEV transaction fragment. Use build.mjs --emit forward.
-- Connector target must independently be ${target}; the local setting is an intent marker, not identity proof.
${locks}
DO $r08_pre$ BEGIN
${contextGuard()}
${functionGuard(originals,{pinOid:true})}
${dependencyGuard()}
${unavailableGuard()}
${noCitylessGuard()}
END; $r08_pre$;
${created.map(f=>ddl(f)+'REVOKE ALL ON FUNCTION '+f.signature+' FROM PUBLIC,anon,authenticated,service_role;').join('\n')}
${changed.map(ddl).join('\n')}
DO $r08_post$ BEGIN
${functionGuard(post)}
${dependencyGuard()}
END; $r08_post$;
NOTIFY pgrst,'reload schema';
`;
 const rollback=`-- Code rollback BEFORE first cityless ACTIVE Save, otherwise fail closed.
-- No account/profile/history deletion or fabricated data compensation.
${locks}
DO $r08_rollback_pre$ BEGIN
${contextGuard()}
${functionGuard(post)}
${dependencyGuard()}
${noCitylessGuard()}
END; $r08_rollback_pre$;
${originals.map(ddl).join('\n')}
${[...helpers].reverse().map(h=>'DROP FUNCTION '+h+' RESTRICT;').join('\n')}
DO $r08_rollback_post$ BEGIN
${functionGuard(originals,{pinOid:true})}
${dependencyGuard()}
${unavailableGuard()}
END; $r08_rollback_post$;
NOTIFY pgrst,'reload schema';
`;
 const readback=(functions,missing)=>`BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='3s';
DO $r08_readback$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
THEN RAISE EXCEPTION 'R08_DEV_CONTEXT_REFUSED'; END IF;
${functionGuard(functions,{pinOid:missing})}
${dependencyGuard()}
${missing?unavailableGuard():''}
END; $r08_readback$;
SELECT '${missing?'R08_DEV_PREIMAGE_MATCH':'R08_DEV_POSTIMAGE_MATCH'}' AS metadata_result,
 false AS functional_acceptance_proven;
ROLLBACK;
`;
 const output={'forward.sql':forward,'rollback.sql':rollback,'preflight.sql':readback(originals,true),
  'postflight.sql':readback(post,false),'postimage.json':JSON.stringify(post,null,2)+'\n'};
 const acceptance=acceptanceGuard()+`SAVEPOINT r08_acceptance;\n`+read('acceptance.sql')+
  `\nROLLBACK TO SAVEPOINT r08_acceptance;\nRELEASE SAVEPOINT r08_acceptance;\n${cleanFixture}\n`;
 output['acceptance-guard.sql']=acceptanceGuard();
 output['promotion.sql']=wrap(forward+acceptance+`DO $r08_final$ BEGIN\n${functionGuard(post)}\n${dependencyGuard()}\nEND;$r08_final$;\n`);
 const manifest={unit:'R08_DEV_PACKAGE',format_version:1,status:'PREPARED_NOT_APPLIED',project_id:target,
  captured_at:preimage.captured_at,dependencies_captured_at:dependencies.captured_at,
  postgres_version_num:170006,source_candidate:'supabase/candidates/r08_remote_only_activation.sql',
  candidate_sha256:digest(readFileSync(candidateUrl)),preimage_sha256:digest(read('preimage.json')),
  dependencies_sha256:digest(read('dependencies.json')),table_fingerprint_md5:dependencies.tables_md5,
  acceptance_sha256:digest(read('acceptance.sql')),acceptance_dependencies_sha256:digest(read('acceptance-dependencies.json')),
  changed_functions:7,new_functions:3,pinned_dependency_functions:depFunctions.length,pinned_relations:dependencies.tables.length,
  files:Object.fromEntries(Object.entries(output).map(([n,s])=>[n,digest(s)])),
  limitations:['PGlite validates DDL derivation and rollback, not hosted PostgreSQL17/Auth/RLS/PostGIS.',
   'Code rollback refuses any ACTIVE cityless worker. After accepted Save use forward recovery; no data undo is claimed.',
   'External connector project binding is mandatory; a GUC is not server identity.',
   'No SQL/Edge/mobile deployment or real account acceptance has occurred.']};
 output['manifest.json']=JSON.stringify(manifest,null,2)+'\n';return output;
}
export function wrap(sql){return `BEGIN;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL uskoci.r08.dev_target='${target}';\n${sql}\nCOMMIT;\n`;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputs=await generate();
 if(process.argv[2]==='--write')for(const[n,s]of Object.entries(outputs))writeFileSync(new URL(n,root),s);
 else if(process.argv[2]==='--check'){for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);console.log('R08 exact package generation PASS');}
 else if(process.argv[2]==='--emit'&&['forward','rollback'].includes(process.argv[3])){
  for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);
  process.stdout.write(wrap(outputs[process.argv[3]+'.sql']));
 }else throw Error('Use --write, --check, or --emit forward|rollback; no network execution is provided.');
}
