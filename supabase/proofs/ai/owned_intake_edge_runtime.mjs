// Evaluates the exact handler/registry with real HTTP primitives. Caller supplies
// explicitly synthetic or loopback-guarded IO. No default network or credentials.
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {historicalIntakeSource} from './historical_intake_source.mjs';
import {isProviderUsageLog} from './provider_usage_log_contract.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry='supabase/functions/uskoci-ai-interview/index.ts',registry='src/contracts/needFactsV2.ts';
export function loadOwnedIntakeHandler(options){
 assert.equal(typeof options.fetch,'function');assert.equal(typeof options.env,'function');let handler;const sourceHashes={};
 assert.ok(options.historicalPre132===undefined||options.historicalPre132===true,'UNADMITTED_SOURCE_BINDING');
 const historical=options.historicalPre132?historicalIntakeSource():null;
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,ReadableStream,AbortController,crypto:webcrypto,
  Date:options.Date??Date,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,EdgeRuntime:options.EdgeRuntime,
  fetch:options.fetch,console:{error:(...args)=>{if(options.log)options.log(args);else assert.ok(args.every(x=>typeof x==='number'||/^[A-Z_]+$/.test(x)));},
   info:(...args)=>{if(options.log)options.log(args);else assert.ok(isProviderUsageLog(args)||args.every(x=>typeof x==='number'||/^[A-Z_,]+$/.test(x)));},
   warn:(...args)=>{if(options.log)options.log(args);else assert.ok(args.every(x=>typeof x==='number'||/^[A-Z0-9_,]+$/.test(x)));}},
  Deno:{env:{get:options.env},serve:fn=>{assert.equal(handler,undefined);handler=fn;}}});
 function evaluate(file,require){
  const bytes=historical?historical.read(file):readFileSync(resolve(root,file));sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:file.replace(/\.mjs$/,'.ts'),reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  return new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:file}).runInContext(context)({},require);
 }
 const shared=evaluate(registry,()=>assert.fail('UNDECLARED_REGISTRY_IMPORT'));
 const budget=evaluate('supabase/functions/_shared/aiTestBudget.ts',()=>assert.fail('UNDECLARED_BUDGET_IMPORT'));
 const taskDeadline=historical?null:evaluate('src/contracts/taskApplicationDeadline.ts',()=>assert.fail('UNDECLARED_TASK_DEADLINE_IMPORT'));
 const availability=historical?null:evaluate('src/contracts/aiAvailability.ts',()=>assert.fail('UNDECLARED_AVAILABILITY_IMPORT'));
 const location=historical?null:evaluate('supabase/functions/_shared/locationReply.ts',()=>assert.fail('UNDECLARED_LOCATION_IMPORT'));
 const classification=historical?null:evaluate('supabase/functions/_shared/classificationEngine.mjs',()=>assert.fail('UNDECLARED_CLASSIFICATION_IMPORT'));
 const handoff=historical?null:evaluate('supabase/functions/_shared/serviceHandoff.mjs',()=>assert.fail('UNDECLARED_HANDOFF_IMPORT'));
 const execution=historical?null:evaluate('supabase/functions/_shared/serviceExecutionInstruction.mjs',()=>assert.fail('UNDECLARED_EXECUTION_IMPORT'));
 const stream=evaluate('supabase/functions/_shared/geminiTaskStream.ts',name=>{
  assert.ok(!historical&&name==='../../../src/contracts/aiAvailability.ts','UNDECLARED_STREAM_IMPORT');return availability;
 });
 const voice=historical?null:evaluate('supabase/functions/_shared/interviewVoiceInstruction.mjs',()=>assert.fail('UNDECLARED_SHARED_IMPORT'));
 const timing=historical?null:evaluate('supabase/functions/_shared/aiPhaseTiming.mjs',()=>assert.fail('UNDECLARED_SHARED_IMPORT'));
 const researchDeadline=historical?null:evaluate('supabase/functions/_shared/researchDeadline.ts',()=>assert.fail('UNDECLARED_DEADLINE_IMPORT'));
 const taxonomyConfig=historical?null:evaluate('supabase/functions/_shared/taxonomyRuntimeConfig.mjs',()=>assert.fail('UNDECLARED_TAXONOMY_CONFIG_IMPORT'));
 const serviceModes=historical?null:evaluate('supabase/functions/_shared/workerServiceModeContext.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const backgroundArchitect=historical?null:evaluate('supabase/functions/_shared/backgroundTaxonomyArchitect.mjs',name=>{
  if(name==='./serviceHandoff.mjs')return handoff;
  if(name==='./workerServiceModeContext.mjs')return serviceModes;
  assert.equal(name,'./classificationEngine.mjs');return classification;
 });
 const firstPlan=historical?null:evaluate('supabase/functions/_shared/completeFirstPlan.ts',()=>assert.fail('UNDECLARED_FIRST_PLAN_IMPORT'));
 const singlePass=historical?null:evaluate('supabase/functions/_shared/singlePassTaxonomy.mjs',name=>{assert.equal(name,'./backgroundTaxonomyArchitect.mjs');return backgroundArchitect;});
 const imports={'../../../src/contracts/needFactsV2.ts':shared,'../_shared/aiTestBudget.ts':budget,'../_shared/geminiTaskStream.ts':stream,
  ...(!historical?{'../../../src/contracts/taskApplicationDeadline.ts':taskDeadline,'../../../src/contracts/aiAvailability.ts':availability,'../_shared/locationReply.ts':location,
   '../_shared/researchDeadline.ts':researchDeadline,
   '../_shared/taxonomyRuntimeConfig.mjs':taxonomyConfig,
   '../_shared/interviewVoiceInstruction.mjs':voice,'../_shared/aiPhaseTiming.mjs':timing,'../_shared/serviceHandoff.mjs':handoff,'../_shared/serviceExecutionInstruction.mjs':execution,
   '../_shared/completeFirstPlan.ts':firstPlan,'../_shared/singlePassTaxonomy.mjs':singlePass,'../_shared/backgroundTaxonomyArchitect.mjs':backgroundArchitect}:{})};
 evaluate(entry,name=>{assert.ok(Object.hasOwn(imports,name),'UNDECLARED_EDGE_IMPORT');return imports[name];});
 assert.equal(typeof handler,'function');return {handler,sourceHashes,sourceBinding:historical?.binding??{kind:'CURRENT_SOURCE'}};
}
