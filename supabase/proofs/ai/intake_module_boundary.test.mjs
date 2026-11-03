// C10: bind synthetic handler proofs to their actual transitive runtime imports.
// This is source/VM evidence, not a deployed bundle or a paid provider call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';
import * as config from '../../functions/_shared/taxonomyRuntimeConfig.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const inactive=new Set(['classificationExplorer.mjs','taxonomyScopedShadow.mjs',
 'classificationGeminiShadow.mjs','classificationDirectReply.mjs','classificationReply.mjs',
 'geminiToolConversation.ts','taxonomyProviderBudget.ts']);
const retired=['classificationExplorer.mjs','classificationExplorer.d.mts','taxonomyScopedShadow.mjs'];
function runtimeImports(path){
 const source=readFileSync(path,'utf8');
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 const imports=[];
 const add=node=>{assert.ok(ts.isStringLiteral(node),`Unreviewed dynamic import: ${relative(root,path)}`);imports.push(node.text);};
 const visit=node=>{
  if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly){
   const bindings=node.importClause?.namedBindings;
   if(!node.importClause?.name&&bindings&&ts.isNamedImports(bindings)&&bindings.elements.length&&bindings.elements.every(x=>x.isTypeOnly))return;
   add(node.moduleSpecifier);
  }else if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&!node.isTypeOnly)add(node.moduleSpecifier);
  else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)add(node.arguments[0]);
  ts.forEachChild(node,visit);
 };
 visit(ast);return imports;
}
function graph(entry){
 const files=new Map();
 const visit=path=>{
  if(files.has(path))return;
  assert.ok(path.startsWith(root+'/'),`Import outside repository: ${path}`);
  const bytes=readFileSync(path);files.set(path,createHash('sha256').update(bytes).digest('hex'));
  for(const name of runtimeImports(path)){
   assert.ok(name.startsWith('.'),`Unreviewed external intake import: ${name}`);
   visit(resolve(dirname(path),name));
  }
 };
 visit(resolve(root,entry));
 return Object.fromEntries([...files].map(([path,hash])=>[relative(root,path),hash]).sort(([a],[b])=>a.localeCompare(b)));
}
for(const [kind,entry,load] of [
 ['NEED','supabase/functions/uskoci-ai-interview/index.ts',loadOwnedIntakeHandler],
 ['WORKER','supabase/functions/uskoci-worker-interview/index.ts',loadWorkerRecoveryHandler],
])test(kind+' proof hashes equal the actual runtime import graph; inactive strategies cannot be injected',async()=>{
 const actual=graph(entry),loaded=load({fetch:()=>assert.fail('NO_NETWORK'),env:()=>''});
 assert.deepEqual(loaded.sourceHashes,actual);
 for(const file of Object.keys(actual))assert.ok(!inactive.has(file.split('/').at(-1)),file);
 assert.equal((await loaded.handler(new Request('https://edge.invalid',{method:'GET'}))).status,405);
});
test('retired catalog modules are absent and no Edge runtime source still imports them',()=>{
 for(const name of retired)assert.equal(existsSync(resolve(root,'supabase/functions/_shared',name)),false,name);
 const walk=dir=>{for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=resolve(dir,item.name);
  if(item.isDirectory())walk(path);
  else if(/\.(?:[cm]?js|[cm]?ts)$/.test(item.name)&&!item.name.endsWith('.d.ts')){
   for(const dependency of runtimeImports(path))assert.ok(!retired.includes(dependency.split('/').at(-1)),relative(root,path));
  }
 }};
 walk(resolve(root,'supabase/functions'));
});
test('server config exposes only the current intake gate, not selectable retired strategies',()=>{
 assert.deepEqual(Object.keys(config),['taxonomyIntakeEnabled']);
});
