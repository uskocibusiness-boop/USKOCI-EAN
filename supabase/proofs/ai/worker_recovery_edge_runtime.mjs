// Evaluates the exact handler/registry with real HTTP primitives. Caller supplies
// explicitly synthetic or loopback-guarded IO. No default network or credentials.
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry='supabase/functions/uskoci-worker-interview/index.ts';
export function loadWorkerRecoveryHandler(options){
 assert.equal(typeof options.fetch,'function');assert.equal(typeof options.env,'function');let handler;const sourceHashes={};
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,ReadableStream,AbortController,crypto:webcrypto,
  Date:options.Date??Date,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,
  fetch:options.fetch,console:{error:(...args)=>{if(options.log)options.log(args);else assert.ok(args.every(x=>typeof x==='number'||/^[A-Z_]+$/.test(x)));}},
  Deno:{env:{get:options.env},serve:fn=>{assert.equal(handler,undefined);handler=fn;}}});
 function evaluate(file,require){
  const bytes=readFileSync(resolve(root,file));sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  return new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:file}).runInContext(context)({},require);
 }
 const budget=evaluate('supabase/functions/_shared/aiTestBudget.ts',()=>assert.fail('UNDECLARED_BUDGET_IMPORT'));
 const availability=evaluate('src/contracts/aiAvailability.ts',()=>assert.fail('UNDECLARED_AVAILABILITY_IMPORT'));
 const stream=evaluate('supabase/functions/_shared/geminiTaskStream.ts',name=>{
  assert.equal(name,'../../../src/contracts/aiAvailability.ts','UNDECLARED_STREAM_IMPORT');return availability;
 });
 const imports={'../_shared/aiTestBudget.ts':budget,'../_shared/geminiTaskStream.ts':stream,'../../../src/contracts/aiAvailability.ts':availability};
 evaluate(entry,name=>{assert.ok(Object.hasOwn(imports,name),'UNDECLARED_EDGE_IMPORT');return imports[name];});
 assert.equal(typeof handler,'function');return {handler,sourceHashes,sourceBinding:{kind:'CURRENT_SOURCE141'}};
}
