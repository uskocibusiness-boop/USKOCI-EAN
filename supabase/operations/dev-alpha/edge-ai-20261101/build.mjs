// Offline package derivation/verification only. No HTTP, provider, SQL or deploy.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';

export const project='leqcwgzvjsxugfgzdmth';
export const sourceCommit='53a3220d58643ee30e6646b6be04c807f9c1eb19';
const base=new URL('./',import.meta.url),repo=fileURLToPath(new URL('../../../../',base));
const read=name=>readFileSync(new URL(name,base),'utf8');
const json=name=>JSON.parse(read(name));
const sha=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const stringify=value=>JSON.stringify(value,null,2)+'\n';
export const slugs=['uskoci-ai-interview','uskoci-worker-interview'];
const beforeNames=['before.need.json','before.worker.json'];
const missingReceipt='public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)';

export function scanSecrets(files){
 const patterns=[/AIza[0-9A-Za-z_-]{30,}/,/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{15,}/,/sbp_[A-Fa-f0-9]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
 for(const f of files)for(const re of patterns)assert.ok(!re.test(f.content),'Possible embedded credential: '+f.name);
}
function imports(name,content){
 const file=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true);
 const values=[];
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
   assert.ok(ts.isStringLiteral(node.moduleSpecifier),'Nonliteral module: '+name);
   values.push(node.moduleSpecifier.text);
  }
  // This exact package has no computed module loads. Do not silently omit one.
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(file)==='require'))
   throw Error('Unreviewed dynamic dependency: '+name);
  ts.forEachChild(node,visit);
 }
 visit(file);return [...new Set(values)];
}
function dependency(name,specifier){
 assert.ok(specifier.startsWith('.'),'Unreviewed external module: '+specifier);
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),specifier));
 assert.ok(!resolved.startsWith('../')&&!path.posix.isAbsolute(resolved),'Dependency escapes repository');return resolved;
}
const hasPinnedHistory=spawnSync('git',['cat-file','-e',sourceCommit+'^{commit}'],{cwd:repo,stdio:'ignore'}).status===0;
export function snapshotSourceReader(snapshot,readCurrent){
 assert.equal(snapshot.source_commit,sourceCommit,'Wrong frozen source revision');
 const files=new Map(snapshot.files.map(f=>[f.name,f.content]));assert.equal(files.size,snapshot.files.length,'Duplicate frozen source file');
 return name=>{assert.ok(files.has(name),'Missing frozen source: '+name);const content=files.get(name);
  assert.equal(readCurrent(name),content,'Pinned history absent and current source differs: '+name);return content;};
}
function readRevision(revision,name){return execFileSync('git',['show',revision+':'+name],{cwd:repo,encoding:'utf8',maxBuffer:4*1024*1024});}
let frozenRead;
function gitRead(name){
 if(hasPinnedHistory)return readRevision(sourceCommit,name);
 // Normal CI checkout is shallow. The committed snapshot is usable only if
 // every required current HEAD byte still matches the originally pinned source.
 frozenRead??=snapshotSourceReader(json('source-files.json'),name=>readRevision('HEAD',name));
 return frozenRead(name);
}
export function sourceFiles(entry){
 const files=new Map();
 function visit(name){if(files.has(name))return;const content=gitRead(name);files.set(name,{name,content});
  for(const specifier of imports(name,content))visit(dependency(name,specifier));}
 visit(entry);return [...files.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
export function verifyClosure(entry,files){
 const byName=new Map(files.map(f=>[f.name,f]));assert.equal(byName.size,files.length,'Duplicate bundle file');
 const visited=new Set();function visit(name){assert.ok(byName.has(name),'Missing bundle dependency: '+name);
  if(visited.has(name))return;visited.add(name);for(const specifier of imports(name,byName.get(name).content))visit(dependency(name,specifier));}
 visit(entry);assert.equal(visited.size,files.length,'Unrelated file in bundle');scanSecrets(files);
}
function payload(slug,files){const entrypoint_path='supabase/functions/'+slug+'/index.ts';verifyClosure(entrypoint_path,files);
 return {project_id:project,name:slug,entrypoint_path,verify_jwt:false,files};}
function fileManifest(files){return files.map(f=>({name:f.name,bytes:Buffer.byteLength(f.content,'utf8'),sha256:sha(f.content)}));}
function snapshot(slug){return json(beforeNames[slugs.indexOf(slug)]);}
export function deploymentBaseline(slug){
 assert.ok(slugs.includes(slug));const baseline=json('deployment-baseline.json'),old=snapshot(slug);
 assert.equal(baseline.project_id,project);assert.equal(baseline.source_commit,sourceCommit);
 assert.equal(baseline.status,'VERIFIED_SAME_SOURCE_AFTER_CONFIG_WRITES');assert.equal(baseline.functions.length,2);
 const selected=baseline.functions.find(f=>f.metadata.slug===slug);assert.ok(selected);
 assert.equal(selected.source_snapshot,beforeNames[slugs.indexOf(slug)]);
 assert.equal(selected.source_snapshot_sha256,sha(read(selected.source_snapshot)));
 assert.equal(selected.original_version,old.version);
 assert.equal(selected.metadata.version,[153,106][slugs.indexOf(slug)],'Unexpected config-era baseline version');
 for(const field of ['id','slug','name','status','created_at','verify_jwt','import_map','entrypoint_path','ezbr_sha256'])
  assert.deepEqual(selected.metadata[field],old[field],'Config update changed source metadata: '+field);
 assert.deepEqual(selected.files,fileManifest([...old.files].sort((a,b)=>a.name.localeCompare(b.name,'en'))));
 return {...selected.metadata,files:old.files};
}
export function rollbackPayload(slug){assert.ok(slugs.includes(slug));const old=snapshot(slug);
 assert.equal(old.project_id,project);assert.equal(old.slug,slug);assert.equal(old.verify_jwt,false);assert.equal(old.import_map,false);
 return payload(slug,old.files);
}
export function candidatePayload(slug){assert.ok(slugs.includes(slug));return payload(slug,sourceFiles('supabase/functions/'+slug+'/index.ts'));}

export function verifyLive(slug,mode,live){
 assert.ok(['before-config','before','candidate','rollback'].includes(mode));assert.ok(slugs.includes(slug));
 const old=snapshot(slug),baseline=mode==='before-config'?old:deploymentBaseline(slug),expected=mode==='candidate'?candidatePayload(slug):rollbackPayload(slug);
 assert.equal(live.id,old.id,'Function identity drift');assert.equal(live.slug,slug);assert.equal(live.status,'ACTIVE');
 assert.equal(live.verify_jwt,false);assert.equal(live.import_map,false);
 assert.ok(live.entrypoint_path.endsWith('/'+expected.entrypoint_path)||live.entrypoint_path===expected.entrypoint_path,'Entrypoint drift');
 if(mode==='before'||mode==='before-config'){assert.equal(live.version,baseline.version);assert.equal(live.ezbr_sha256,baseline.ezbr_sha256);}
 else assert.ok(Number.isInteger(live.version)&&live.version>baseline.version,'No new version established');
 assert.match(live.ezbr_sha256,/^[a-f0-9]{64}$/);
 verifyClosure(expected.entrypoint_path,live.files);
 assert.deepEqual(fileManifest([...live.files].sort((a,b)=>a.name.localeCompare(b.name,'en'))),
  fileManifest([...expected.files].sort((a,b)=>a.name.localeCompare(b.name,'en'))),'Deployed source mismatch');
 return {slug,mode,version:live.version,files:live.files.length,source_exact:true,functional_acceptance:false};
}

export function rpcPreflight(capture){
 assert.equal(capture.project_id,project);assert.equal(capture.read_only,'on');assert.equal(capture.functions.length,25);
 assert.equal(capture.missing_receipt_rpc_absent,true);
 const checks=capture.functions.map(f=>{
  assert.equal(f.anon,false);assert.equal(f.authenticated,false);assert.equal(f.service_role,true);
  // pg_proc::regprocedure was captured under the dashboard's public search path.
  // The verifier deliberately uses pg_catalog, so qualify the public signature.
  assert.ok(f.signature.startsWith(f.name+'(')||f.signature.startsWith('public.'+f.name+'('));
  const signature=f.signature.startsWith('public.')?f.signature:'public.'+f.signature;
  return `IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(${quote(signature)})
 AND p.oid=${f.oid} AND md5(pg_get_functiondef(p.oid))=${quote(f.definition_md5)}
 AND pg_get_userbyid(p.proowner)=${quote(f.owner)} AND p.proacl::text IS NOT DISTINCT FROM ${f.acl===null?'NULL':quote(f.acl)}
 AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')
 AND has_function_privilege('service_role',p.oid,'execute'))
 THEN RAISE EXCEPTION 'EDGE_AI_RPC_DRIFT:%',${quote(signature)}; END IF;`;
 }).join('\n');
 return `-- Metadata-only prerequisite for both complete Edge bundles. Run again after each promotion.
-- External connector project identity and non-secret environment review are separate requirements.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='15s';
DO $edge_ai_preflight$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'EDGE_AI_CONTEXT_DRIFT'; END IF;
 ${checks}
 IF to_regprocedure('${missingReceipt}') IS NOT NULL THEN RAISE EXCEPTION 'EDGE_AI_RECEIPT_RPC_RECAPTURE_REQUIRED'; END IF;
END $edge_ai_preflight$;
SELECT 'EDGE_AI_25_RPC_METADATA_MATCH' AS metadata_result,
 false AS environment_verified,false AS functional_acceptance_proven;
ROLLBACK;
`;
}
export function generate(){
 // No implicit Deno config/import map: the exact source tree contains none.
 const configPaths=['deno.json','deno.jsonc','supabase/functions/deno.json','supabase/functions/deno.jsonc',
  ...slugs.flatMap(s=>['deno.json','deno.jsonc','import_map.json'].map(n=>'supabase/functions/'+s+'/'+n))];
 assert.equal(execFileSync('git',['ls-tree','--name-only',hasPinnedHistory?sourceCommit:'HEAD',...configPaths],{cwd:repo,encoding:'utf8'}).trim(),'','New runtime config requires package review');
 const bundles=slugs.map(candidatePayload),union=new Map();
 for(const b of bundles)for(const f of b.files){if(union.has(f.name))assert.equal(union.get(f.name).content,f.content);union.set(f.name,f);}
 assert.deepEqual(bundles.map(b=>b.files.length),[23,21]);assert.equal(union.size,26);
 const rpcNames=new Set();
 for(const f of union.values()){
  const file=ts.createSourceFile(f.name,f.content,ts.ScriptTarget.Latest,true);
  function visit(n){if(ts.isStringLiteral(n)){const match=n.text.match(/(?:^|\/rest\/v1\/rpc\/)(rpc_[a-zA-Z0-9_]+)$/);
   if(match)rpcNames.add(match[1]);}ts.forEachChild(n,visit);}visit(file);
 }
 assert.deepEqual([...rpcNames].sort(),[...json('rpc-preimage.json').functions.map(f=>f.name),
  'rpc_taxonomy_read_gemini_turn_hint_receipt_service'].sort(),'Unreviewed RPC dependency');
 const before=slugs.map((s,i)=>{const old=snapshot(s);verifyLive(s,'before-config',old);
  assert.equal(old.version,[151,104][i]);return {slug:s,version:old.version,id:old.id,ezbr_sha256:old.ezbr_sha256,
   verify_jwt:old.verify_jwt,import_map:old.import_map,entrypoint_path:rollbackPayload(s).entrypoint_path,
   snapshot:beforeNames[i],snapshot_sha256:sha(read(beforeNames[i])),files:fileManifest(old.files)};});
 const outputs={'source-files.json':stringify({source_commit:sourceCommit,files:[...union.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'))}),
  'preflight.sql':rpcPreflight(json('rpc-preimage.json'))};
 outputs['manifest.json']=stringify({unit:'EDGE_AI_DEV_PACKAGE',format_version:1,status:'PREPARED_CONFIG_UNVERIFIED_NOT_DEPLOYED',project_id:project,
  source_commit:sourceCommit,source_union_files:union.size,before,
  candidate:bundles.map(b=>({slug:b.name,entrypoint_path:b.entrypoint_path,verify_jwt:b.verify_jwt,import_map:false,
   payload_sha256:sha(JSON.stringify(b)),files:fileManifest(b.files)})),
  rpc_preimage_sha256:sha(read('rpc-preimage.json')),rpc_count:25,config_review_sha256:sha(read('config-review.json')),
  files:Object.fromEntries(Object.entries(outputs).map(([n,value])=>[n,sha(value)])),
  credential_literal_scan:{status:'PASS',patterns:['Google API key','JWT','Supabase secret/publishable key','Supabase PAT','private key PEM'],limitations:'Pattern scan and source review; not a universal secret detector.'},
  acceptance:{ai_suite:{tests:1478,pass:1477,fail:0,todo:1,log:'artifacts/20261101-continuation-ai.log'},
   current_schema_rpc_metadata:true,non_secret_environment:false,hosted_promotion:false,real_auth_flow:false,android:false},
  limitations:['No SQL, flags, provider calls or deployment by this package. Emit commands output payloads only.',
   'Only the complete pinned handlers and their import closures are candidates; no partial old-source variants.',
   'The absent receipt-reader remains disabled; durable first-plan candidate/wrapper RPCs are not used by these handlers.',
   'Source rollback creates newer Edge versions; it does not reverse provider charges, reservations, writes, bindings, R08 activation or consent.',
   'Existing R01/privacy/R10 and real Auth/device acceptance remain independent open requirements.']});
 return outputs;
}
export function check(){for(const[name,value]of Object.entries(generate()))assert.equal(read(name),value,name);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const command=process.argv[2];
 if(command==='--write'){for(const[name,value]of Object.entries(generate()))writeFileSync(new URL(name,base),value);}
 else if(command==='--check'){check();console.log('Edge AI exact prepared package PASS; see config-receipt.json for later configuration verification. No deployment by this command.');}
 else if(command==='--emit'&&['candidate','rollback'].includes(process.argv[3])){check();
  process.stdout.write(stringify(process.argv[3]==='candidate'?candidatePayload(process.argv[4]):rollbackPayload(process.argv[4])));}
 else if(command==='--verify-live'&&['before-config','before','candidate','rollback'].includes(process.argv[3])){check();
  console.log(JSON.stringify(verifyLive(process.argv[4],process.argv[3],JSON.parse(readFileSync(process.argv[5],'utf8')))));}
 else throw Error('Use --write, --check, --emit candidate|rollback <slug>, or --verify-live before|candidate|rollback <slug> <capture.json>. No command deploys.');
}
