// Offline derivation only. Does not connect to DEV or turn isolated proof into
// a release approval. Existing source/readiness certificates are never changed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const here=new URL('./',import.meta.url);
const read=name=>readFileSync(new URL(name,here),'utf8').replace(/\r\n/g,'\n');
const hash=(s,algorithm='sha256')=>createHash(algorithm).update(s).digest('hex');
const q=s=>s===null?'NULL':"'"+s.replaceAll("'","''")+"'";
const qi=s=>'"'+s.replaceAll('"','""')+'"';
export const pre=JSON.parse(read('preimage.json')),deps=JSON.parse(read('dependencies.json'));
const chain=JSON.parse(read('chain-dependencies.json'));
const target='leqcwgzvjsxugfgzdmth';
const candidates=['../../../proofs/ai/r04_turn_catalog_resolution_candidate.sql','../../../proofs/ai/r06_first_plan_completion_candidate.sql'];
const hint='private.work_taxonomy_gemini_turn_hints_v1',view='private.work_taxonomy_turn_hints_resolved_v1';
const fnQuery=`SELECT n.nspname||'.'||p.proname AS name,
 n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature,
 replace(pg_get_functiondef(p.oid),chr(13),'') AS definition,
 md5(replace(pg_get_functiondef(p.oid),chr(13),'')) AS md5,
 pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','private') ORDER BY n.nspname,p.proname`;
const ddl=f=>f.definition.trimEnd()+';\n';
function acl(f){
 assert.equal(f.owner,'postgres');
 assert.ok(/^\{postgres=X\/postgres(?:,(?:authenticated|service_role)=X\/postgres)*\}$/.test(f.acl),f.name);
 return `REVOKE ALL ON FUNCTION ${f.signature} FROM PUBLIC,anon,authenticated,service_role;\n`+
 ['authenticated','service_role'].filter(role=>f.acl.includes(role+'=')).map(role=>`GRANT EXECUTE ON FUNCTION ${f.signature} TO ${role};`).join('\n');
}
export async function derive(){
 assert.equal(pre.project_ref,target);assert.equal(deps.project_ref,target);assert.equal(chain.project_ref,target);
 assert.equal(deps.role,'postgres');assert.equal(deps.server_version_num,'170006');
 const db=new PGlite();
 try{
  await db.exec('CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;SET check_function_bodies=false;SET search_path=pg_catalog;');
  // DDL derivation only: row types and view dependencies; behavior is covered
  // separately by r06_first_plan_completion and r04_single_pass_readers.
  for(const table of deps.tables)await db.exec(`CREATE TABLE ${table.name}(${table.columns.map(c=>qi(c.name)+' '+c.type).join(',')});`);
  for(const f of pre.functions)await db.exec(ddl(f));
  let before=(await db.query(fnQuery)).rows;
  for(const f of before){const original=pre.functions.find(x=>x.name===f.name);assert.equal(f.md5,original.md5,f.name);await db.exec(acl({...f,acl:original.acl}));}
  before=(await db.query(fnQuery)).rows;
  await db.exec("SET uskoci.r06_first_plan.disposable='LOCAL_ONLY'");
  for(const path of candidates)await db.exec(read(path));
  const after=(await db.query(fnQuery)).rows;
  for(const f of before)assert.equal(after.find(x=>x.signature===f.signature).acl,f.acl,f.name+' ACL');
  const created=after.filter(f=>!before.some(x=>x.signature===f.signature));
  const changed=after.filter(f=>before.some(x=>x.signature===f.signature&&x.md5!==f.md5));
  // Explicit-selection review calls the updated projector, but its historical
  // handoff lookup must remain on immutable original proposals.
  assert.equal(changed.length,7);assert.equal(created.length,10);
  assert.equal(after.find(f=>f.name==='public.rpc_prepare_worker_ai_review_taxonomy_confirmed').md5,
   before.find(f=>f.name==='public.rpc_prepare_worker_ai_review_taxonomy_confirmed').md5);
  for(const f of created)assert.equal(f.acl,f.name.startsWith('public.')?'{postgres=X/postgres,service_role=X/postgres}':'{postgres=X/postgres}',f.name);
  const viewDef=(await db.query(`SELECT pg_get_viewdef(${q(view)}::regclass,true) AS definition`)).rows[0].definition;
  const viewAcl=(await db.query(`SELECT relacl::text AS acl FROM pg_class WHERE oid=${q(view)}::regclass`)).rows[0].acl;
  const check=(await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=${q(hint)}::regclass`)).rows;
  assert.equal(check.length,1);
  // Execute the generated restoration and reapply the complete candidate.
  // No rows/semantic writes are involved in this DDL round trip.
  const state={before,after,created,changed};
  await db.exec(restoreDdl(state));
  assert.deepEqual((await db.query(fnQuery)).rows,before,'exact function/ACL rollback');
  for(const path of candidates)await db.exec(read(path));
  assert.deepEqual((await db.query(fnQuery)).rows,after,'reapply is the same postimage');
  for(const f of created){
   for(const role of ['anon','authenticated','service_role']){
    const allowed=(await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,f.signature])).rows[0].allowed;
    assert.equal(allowed,role==='service_role'&&f.name.startsWith('public.'),f.name+' '+role);
   }
  }
  return {before,after,created,changed,viewDef,viewAcl,columnCheck:check[0].definition};
 }finally{await db.close();}
}
function guard(functions,{oid=false}={}){
 return functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${q(f.signature)})
${oid?' AND p.oid='+pre.functions.find(x=>x.name===f.name).oid:''}
 AND md5(replace(pg_get_functiondef(p.oid),chr(13),''))=${q(f.md5)}
 AND pg_get_userbyid(p.proowner)=${q(f.owner)} AND p.proacl::text IS NOT DISTINCT FROM ${q(f.acl)})
 THEN RAISE EXCEPTION 'SINGLE_PASS_FUNCTION_DRIFT: %',${q(f.signature)}; END IF;`).join('\n');
}
const capture=read('capture-dependencies.sql');
const captureSelect=capture.slice(capture.indexOf('SELECT jsonb_build_object('),capture.indexOf(' AS capture;')+11);
const tableRead=`SELECT capture->'tables' FROM (${captureSelect}) x`;
const closureRead=`SELECT capture->'closure' FROM (${captureSelect}) x`;
function tableGuard(){return `IF (${tableRead}) IS DISTINCT FROM ${q(JSON.stringify(deps.tables))}::jsonb THEN RAISE EXCEPTION 'SINGLE_PASS_RELATION_DRIFT';END IF;`;}
const context=`IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'SINGLE_PASS_CONTEXT_REFUSED';END IF;`;
const noColumn=`IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=${q(hint)}::regclass AND attname='catalog_resolution' AND NOT attisdropped)
 OR to_regclass(${q(view)}) IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_ALREADY_PRESENT';END IF;`;
const locks=`LOCK TABLE ${deps.tables.map(t=>t.name).join(',')} IN SHARE ROW EXCLUSIVE MODE;`;
const wrap=body=>`BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';\n${body}\nCOMMIT;\n`;
function restoreDdl(d){return `${d.changed.map(f=>ddl(d.before.find(x=>x.signature===f.signature))).join('\n')}
 DROP VIEW ${view} RESTRICT;
 ${d.created.filter(f=>f.name.startsWith('public.')).map(f=>'DROP FUNCTION '+f.signature+' RESTRICT;').join('\n')}
 ${d.created.filter(f=>f.name.startsWith('private.')).reverse().map(f=>'DROP FUNCTION '+f.signature+' RESTRICT;').join('\n')}
 ALTER TABLE ${hint} DROP COLUMN catalog_resolution RESTRICT;`;}
function unchangedReadiness(){return `IF ((${closureRead})-'schema'-'source') IS DISTINCT FROM ${q(JSON.stringify(Object.fromEntries(Object.entries(deps.closure).filter(([k])=>!['schema','source'].includes(k)))))}::jsonb
 THEN RAISE EXCEPTION 'SINGLE_PASS_READINESS_CHANGED';END IF;`;}
export async function generate(){
 const d=await derive();
 const missing=d.created.map(f=>`IF to_regprocedure(${q(f.signature)}) IS NOT NULL THEN RAISE EXCEPTION 'SINGLE_PASS_HELPER_PRESENT';END IF;`).join('\n');
 const preflight=`DO $pre$ BEGIN\n${context}\n${guard(d.before,{oid:true})}\n${guard(chain.functions)}\n${tableGuard()}\n${noColumn}\n${missing}
 IF (${closureRead}) IS DISTINCT FROM ${q(JSON.stringify(deps.closure))}::jsonb THEN RAISE EXCEPTION 'SINGLE_PASS_CLOSURE_DRIFT';END IF;
 END;$pre$;`;
 const newDdl=d.created.map(f=>ddl(f)+acl(f)).join('\n');
 // Function body validation stays enabled on DEV. Creation ordering respects
 // dependencies on the new hint column and its row type.
 const forward=`${locks}\n${preflight}\nALTER TABLE ${hint} ADD COLUMN catalog_resolution jsonb ${d.columnCheck};
 ${newDdl}
 CREATE VIEW ${view} WITH(security_invoker=true) AS ${d.viewDef}
 REVOKE ALL ON ${view} FROM PUBLIC,anon,authenticated,service_role;
 ${d.changed.map(ddl).join('\n')}`;
 const post=`DO $post$ BEGIN\n${context}\n${guard(d.after)}\n${guard(chain.functions)}\n${unchangedReadiness()}
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=${q(view)}::regclass AND c.reloptions=ARRAY['security_invoker=true']
 AND c.relacl::text=${q(d.viewAcl)} AND md5(pg_get_viewdef(c.oid,true))=${q(hash(d.viewDef,'md5'))}) THEN RAISE EXCEPTION 'SINGLE_PASS_VIEW_ACL_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=${q(hint)}::regclass AND attname='catalog_resolution'
 AND atttypid='jsonb'::regtype AND NOT attnotnull AND NOT attisdropped AND attacl IS NULL)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=${q(hint)}::regclass AND pg_get_constraintdef(oid)=${q(d.columnCheck)})
 THEN RAISE EXCEPTION 'SINGLE_PASS_COLUMN_DRIFT';END IF;
 END;$post$;`;
 // Keep additive column/view shape as separately inspected postimage evidence.
 // Before first accepted completion, exact code rollback removes no user data.
 const rollback=wrap(`${locks}\n${post}
 DO $unused$ BEGIN IF EXISTS(SELECT 1 FROM ${hint} WHERE catalog_resolution IS NOT NULL)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_audit WHERE source_ref LIKE 'TURN_CATALOG_V1:%')
 THEN RAISE EXCEPTION 'SINGLE_PASS_IN_USE_REQUIRES_FORWARD_RECOVERY';END IF;END;$unused$;
 ${restoreDdl(d)}
 ${preflight}\nNOTIFY pgrst,'reload schema';`);
 const files={
  'preflight.sql':`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='30s';\n${preflight}\nSELECT 'SINGLE_PASS_PREIMAGE_MATCH' AS result,false AS release_ready;ROLLBACK;\n`,
  'promotion.sql':wrap(forward+'\n'+post+"\nNOTIFY pgrst,'reload schema';"),
  'postflight.sql':`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;\n${post}\nSELECT 'SINGLE_PASS_POSTIMAGE_MATCH' AS result,false AS release_ready;ROLLBACK;\n`,
  'rollback.sql':rollback,
  'postimage.json':JSON.stringify(d.after,null,2)+'\n',
 };
 files['manifest.json']=JSON.stringify({unit:'R04_R06_SINGLE_PASS_DEV',status:'PREPARED_NOT_APPLIED',project_ref:target,
  source_candidates:Object.fromEntries(candidates.map(p=>[p,hash(read(p))])),preimage_sha256:hash(read('preimage.json')),
  dependencies_sha256:hash(read('dependencies.json')),chain_dependencies_sha256:hash(read('chain-dependencies.json')),
  changed_functions:d.changed.length,new_functions:d.created.length,
  files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)])),
  blockers:['Current full AI CI migration is not green.','Complete real-schema export/erasure and concurrency acceptance remains required; isolated current Worker Save/binder/sync/matching chain is proven.',
   'R01 and R10 source readiness remain open; this package grants no release approval.'],
  rollback:'Only before first catalog resolution; otherwise forward recovery. Restore compatible Edge versions before SQL rollback.',
  limits:['Offline DDL derivation is not Auth/HTTP, DEV or native acceptance.','Connector project binding is required; no SQL setting proves the remote project.']},null,2)+'\n';
 return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const files=await generate();
 if(process.argv[2]==='--write')for(const[n,s]of Object.entries(files))writeFileSync(new URL(n,here),s);
 else if(process.argv[2]==='--check'){for(const[n,s]of Object.entries(files))assert.equal(read(n),s,n);console.log('SINGLE_PASS_PACKAGE_DERIVATION_PASS');}
 else throw Error('Use --write or --check; no deploy command is provided.');
}
