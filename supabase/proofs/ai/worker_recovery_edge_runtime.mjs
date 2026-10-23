// Evaluates the exact handler/registry with real HTTP primitives. Caller supplies
// explicitly synthetic or loopback-guarded IO. No default network or credentials.
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {isProviderUsageLog} from './provider_usage_log_contract.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry='supabase/functions/uskoci-worker-interview/index.ts';
export function loadWorkerRecoveryHandler(options){
 assert.equal(typeof options.fetch,'function');assert.equal(typeof options.env,'function');let handler;const sourceHashes={};
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,ReadableStream,AbortController,crypto:webcrypto,
  Date:options.Date??Date,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,
  fetch:options.fetch,console:{error:(...args)=>{if(options.log)options.log(args);else assert.ok(args.every(x=>typeof x==='number'||/^[A-Z_]+$/.test(x)));},
   info:(...args)=>{if(options.log)options.log(args);else assert.ok(isProviderUsageLog(args)||args.every(x=>typeof x==='number'||/^[A-Z_,]+$/.test(x)));}},
  Deno:{env:{get:options.env},serve:fn=>{assert.equal(handler,undefined);handler=fn;}}});
 function evaluate(file,require){
  const bytes=readFileSync(resolve(root,file));sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:file.replace(/\.mjs$/,'.ts'),reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  return new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:file}).runInContext(context)({},require);
 }
 const budget=evaluate('supabase/functions/_shared/aiTestBudget.ts',()=>assert.fail('UNDECLARED_BUDGET_IMPORT'));
 const availability=evaluate('src/contracts/aiAvailability.ts',()=>assert.fail('UNDECLARED_AVAILABILITY_IMPORT'));
 const stream=evaluate('supabase/functions/_shared/geminiTaskStream.ts',name=>{
  assert.equal(name,'../../../src/contracts/aiAvailability.ts','UNDECLARED_STREAM_IMPORT');return availability;
 });
 const classification=evaluate('supabase/functions/_shared/classificationEngine.mjs',()=>assert.fail('UNDECLARED_CLASSIFICATION_IMPORT'));
 const handoff=evaluate('supabase/functions/_shared/serviceHandoff.mjs',()=>assert.fail('UNDECLARED_HANDOFF_IMPORT'));
 const directReply=evaluate('supabase/functions/_shared/classificationDirectReply.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const execution=evaluate('supabase/functions/_shared/serviceExecutionInstruction.mjs',()=>assert.fail('UNDECLARED_EXECUTION_IMPORT'));
  const classificationShadow=evaluate('supabase/functions/_shared/classificationGeminiShadow.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  assert.equal(name,'./classificationEngine.mjs');return classification;
  });
 const serviceModes=evaluate('supabase/functions/_shared/workerServiceModeContext.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const classificationReply=evaluate('supabase/functions/_shared/classificationReply.mjs',()=>assert.fail('UNDECLARED_CLASSIFICATION_REPLY_IMPORT'));
 const explorer=evaluate('supabase/functions/_shared/classificationExplorer.mjs',name=>{
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const voice=evaluate('supabase/functions/_shared/interviewVoiceInstruction.mjs',()=>assert.fail('UNDECLARED_SHARED_IMPORT'));
 const timing=evaluate('supabase/functions/_shared/aiPhaseTiming.mjs',()=>assert.fail('UNDECLARED_SHARED_IMPORT'));
 const toolConversation=evaluate('supabase/functions/_shared/geminiToolConversation.ts',name=>{
  if(name==='./aiPhaseTiming.mjs')return timing;
  assert.equal(name,'./geminiTaskStream.ts');return stream;
 });
 const providerBudget=evaluate('supabase/functions/_shared/taxonomyProviderBudget.ts',name=>{
  assert.equal(name,'./aiTestBudget.ts');return budget;
 });
 const researchDeadline=evaluate('supabase/functions/_shared/researchDeadline.ts',()=>assert.fail('UNDECLARED_DEADLINE_IMPORT'));
 const areaAdmission=evaluate('supabase/functions/_shared/workerAreaAdmission.mjs',()=>assert.fail('UNDECLARED_AREA_IMPORT'));
 const areaResolver=evaluate('supabase/functions/_shared/workerAreaResolver.mjs',()=>assert.fail('UNDECLARED_AREA_IMPORT'));
 const backgroundArchitect=evaluate('supabase/functions/_shared/backgroundTaxonomyArchitect.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const imports={'../_shared/aiTestBudget.ts':budget,'../_shared/geminiTaskStream.ts':stream,'../../../src/contracts/aiAvailability.ts':availability,
  '../_shared/classificationEngine.mjs':classification,'../_shared/classificationGeminiShadow.mjs':classificationShadow,'../_shared/classificationReply.mjs':classificationReply,
  '../_shared/classificationDirectReply.mjs':directReply,
  '../_shared/workerServiceModeContext.mjs':serviceModes,'../_shared/classificationExplorer.mjs':explorer,
  '../_shared/geminiToolConversation.ts':toolConversation,'../_shared/taxonomyProviderBudget.ts':providerBudget,
  '../_shared/researchDeadline.ts':researchDeadline,'../_shared/interviewVoiceInstruction.mjs':voice,'../_shared/aiPhaseTiming.mjs':timing,'../_shared/serviceHandoff.mjs':handoff,'../_shared/serviceExecutionInstruction.mjs':execution,
  '../_shared/workerAreaAdmission.mjs':areaAdmission,'../_shared/workerAreaResolver.mjs':areaResolver,
  '../_shared/backgroundTaxonomyArchitect.mjs':backgroundArchitect};
 evaluate(entry,name=>{assert.ok(Object.hasOwn(imports,name),'UNDECLARED_EDGE_IMPORT');return imports[name];});
 assert.equal(typeof handler,'function');return {handler,sourceHashes,sourceBinding:{kind:'CURRENT_SOURCE141'}};
}
