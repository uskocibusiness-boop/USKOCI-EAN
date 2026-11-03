// Complete paired Edge bundles and exact source rollback; no network/deploy command.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import {verifyClosure} from '../edge-ai-20261101/build.mjs';
const base=new URL('./',import.meta.url),repo=fileURLToPath(new URL('../../../../',base));
const read=n=>readFileSync(new URL(n,base),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const slugs=['uskoci-ai-interview','uskoci-worker-interview'];
const snapshot=slug=>JSON.parse(read('edge-before.'+(slug===slugs[0]?'need':'worker')+'.json'));
const manifestFiles=files=>[...files].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(f=>({name:f.name,sha256:hash(f.content)}));
function currentFiles(entry){
 const files=new Map();
 function visit(name){
  assert.ok(!path.posix.isAbsolute(name)&&!name.startsWith('../'),'Dependency escapes repository: '+name);
  if(files.has(name))return;
  const content=readFileSync(path.join(repo,name),'utf8').replace(/\r\n/g,'\n');files.set(name,{name,content});
  const ast=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true);
  function walk(n){
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier){
    assert.ok(ts.isStringLiteral(n.moduleSpecifier));const spec=n.moduleSpecifier.text;
    assert.ok(spec.startsWith('.'),'External dependency requires explicit review');
    visit(path.posix.normalize(path.posix.join(path.posix.dirname(name),spec)));
   }
   ts.forEachChild(n,walk);
  }walk(ast);
 }visit(entry);const result=[...files.values()];verifyClosure(entry,result);return result;
}
export function payload(slug,rollback=false){
 assert.ok(slugs.includes(slug));const before=snapshot(slug);
 assert.equal(before.project_id,'leqcwgzvjsxugfgzdmth');assert.equal(before.slug,slug);
 assert.equal(before.verify_jwt,false);assert.equal(before.import_map,false);
 const entrypoint_path='supabase/functions/'+slug+'/index.ts';
 const files=rollback?before.files:currentFiles(entrypoint_path);verifyClosure(entrypoint_path,files);
 return {project_id:before.project_id,name:slug,entrypoint_path,verify_jwt:before.verify_jwt,files};
}
export function generate(){
 for(const n of ['deno.json','deno.jsonc','supabase/functions/deno.json','supabase/functions/deno.jsonc',
  ...slugs.flatMap(s=>['deno.json','deno.jsonc','import_map.json'].map(n=>'supabase/functions/'+s+'/'+n))])
  assert.ok(!existsSync(path.join(repo,n)),'Runtime config must be packaged: '+n);
 return {project_ref:'leqcwgzvjsxugfgzdmth',status:'PREPARED_NOT_DEPLOYED',
  unchanged_runtime_source:'f940f8347f3cfe4c1f4b204333daf5101a53a733',
  database_prerequisite:'SINGLE_PASS_POSTIMAGE_MATCH required before either new handler serves requests',
  functions:slugs.map(slug=>{const before=snapshot(slug);return {slug,before_version:before.version,before_id:before.id,
   before_source_sha256:before.ezbr_sha256,before_files:manifestFiles(payload(slug,true).files),
   candidate_files:manifestFiles(payload(slug).files),verify_jwt:before.verify_jwt};}),
  recovery:'Before SQL inverse restore both captured handlers; after first new resolution retain additive SQL and repair forward.',
  limits:['No configuration or budget changes. Existing in-handler Auth remains required.',
   'Exact source equality does not prove paid Gemini, Auth/HTTP or Android behavior.']};
}
const encoded=()=>JSON.stringify(generate(),null,2)+'\n';
export function check(){assert.equal(read('edge-manifest.json'),encoded());}
export function verifyLive(slug,live,rollback=false){
 check();const before=snapshot(slug);assert.equal(live.id,before.id);assert.equal(live.slug,slug);
 assert.equal(live.status,'ACTIVE');assert.equal(live.verify_jwt,before.verify_jwt);assert.equal(live.import_map,false);
 assert.ok(live.version>before.version);assert.deepEqual(manifestFiles(live.files),manifestFiles(payload(slug,rollback).files));
 return {slug,version:live.version,source_exact:true,functional_acceptance:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const command=process.argv[2];
 if(command==='--write')writeFileSync(new URL('edge-manifest.json',base),encoded());
 else if(command==='--check'){check();console.log('PAIRED_EDGE_PACKAGE_PASS');}
 else if(command==='--emit'){check();console.log(JSON.stringify(payload(process.argv[3],process.argv[4]==='rollback')));}
 else throw Error('Use --write, --check, --emit <slug> [rollback]');
}
