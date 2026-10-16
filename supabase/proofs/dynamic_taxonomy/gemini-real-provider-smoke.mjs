// Isolated source-schema proof. No Supabase calls, user data, writes, retries or push.
// --offline validates the EXACT live handler source schemas and provider adapter.
// --provider performs exactly two bounded Gemini stream requests with synthetic prompts.
// The API key is supplied only by a dedicated, opt-in GitHub Actions secret.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { withGeminiClassificationShadowSchema } from '../../functions/_shared/classificationGeminiShadow.mjs';

const workerPath='supabase/functions/uskoci-worker-interview/index.ts';
const needPath='supabase/functions/uskoci-ai-interview/index.ts';
const registryPath='src/contracts/needFactsV2.ts';
const adapterPath='supabase/functions/_shared/geminiTaskStream.ts';

function source(path) {
  const sourceText=fs.readFileSync(path,'utf8');
  return ts.createSourceFile(path,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
}
function extract(path,name,kind) {
  const sf=source(path);
  for(const s of sf.statements) {
    if(kind==='function' && ts.isFunctionDeclaration(s) && s.name?.text===name) {
      return s.getText(sf).replace(/^export\s+/,'');
    }
    if(kind==='variable' && ts.isVariableStatement(s)) {
      const d=s.declarationList.declarations.find(x=>x.name.getText(sf)===name);
      if(d) return 'const '+d.getText(sf)+';';
    }
  }
  throw new Error('MISSING_SOURCE_DECLARATION_'+name);
}
function evaluate(segments,expression) {
  const javascript=ts.transpileModule(segments.join('\n'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
  }).outputText;
  return vm.runInNewContext(javascript+'\n'+expression,{}, {timeout:1500});
}
function schemas() {
  const worker=evaluate([extract(workerPath,'workerProviderSchema','function')],'workerProviderSchema()');
  const need=evaluate([
    extract(registryPath,'NEED_FACT_V2_DEFINITIONS','variable'),
    extract(needPath,'DIALOGUE_VALUES','variable'),
    "const INTERVIEW_NEED_FACT_V2_KEYS = Object.keys(NEED_FACT_V2_DEFINITIONS).filter(key => !('manualOnly' in NEED_FACT_V2_DEFINITIONS[key]) && key !== 'need.required_licenses');",
    extract(needPath,'v2ProviderSchema','function')
  ],'v2ProviderSchema()');
  return {worker,need};
}
function wireAdapter(){
  return evaluate([
    extract(adapterPath,'wireUnsupportedKeywords','variable'),
    extract(adapterPath,'providerSchema','function'),
    extract(adapterPath,'geminiRequestBody','function')
  ],'geminiRequestBody');
}
function makePayload(baseline,purpose,toWire) {
  const extended=withGeminiClassificationShadowSchema(baseline,purpose);
  const turn={
    systemInstruction:{parts:[{text:'Synthetic USKOCI schema compatibility test. Respond in Serbian. Return safe short values. Set assistantMessage to OK. Keep facts empty and patch empty. For dialogue use next ACK, questionKey NONE, taskRelation CONTINUE, priceUnit UNSPECIFIED, schedulePattern UNSPECIFIED. Set optional classificationShadowJson to the string [].'}]},
    contents:[{role:'user',parts:[{text:'Sintetički test: treba mi krečenje sobe.'}]}],
    generationConfig:{responseMimeType:'application/json',responseSchema:extended,maxOutputTokens:2048}
  };
  const old=JSON.parse(toWire(JSON.stringify({...turn,generationConfig:{...turn.generationConfig,responseSchema:baseline}})));
  const sent=JSON.parse(toWire(JSON.stringify(turn)));
  const wireSchema=sent.generationConfig.responseSchema;
  const {classificationShadowJson,...core}=wireSchema.properties;
  assert.deepEqual(JSON.parse(JSON.stringify(core)),JSON.parse(JSON.stringify(old.generationConfig.responseSchema.properties)));
  assert.deepEqual(classificationShadowJson,{type:'STRING'});
  assert.equal(wireSchema.required.includes('classificationShadowJson'),false);
  assert.equal('classificationShadow' in wireSchema.properties,false);
  assert.equal(JSON.stringify(sent).includes('additionalProperties'),false);
  assert.equal(JSON.stringify(sent).includes('maxItems'),false);
  assert.deepEqual(sent.generationConfig.thinkingConfig,{thinkingLevel:'low'});
  return sent;
}
async function streamResponse(response) {
  if(!response.body)throw new Error('NO_STREAM_BODY');
  const reader=response.body.getReader();let bytes=0,text='';
  try {
    for(;;){
      const part=await reader.read();
      if(part.done)break;
      bytes+=part.value.byteLength;
      if(bytes>262144)throw new Error('STREAM_TOO_LARGE');
      text+=new TextDecoder().decode(part.value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  let raw='',stopped=false;
  for(const e of text.split(/\r?\n\r?\n/)){
    const data=e.split(/\r?\n/).filter(x=>x.startsWith('data: ')).map(x=>x.slice(6)).join('');
    if(!data)continue;
    const chunk=JSON.parse(data);
    const candidate=chunk.candidates?.[0];
    const delta=candidate?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('')??'';
    raw+=delta;
    if(candidate?.finishReason==='STOP')stopped=true;
  }
  if(!stopped)throw new Error('PROVIDER_NO_STOP');
  return JSON.parse(raw);
}
async function liveCall(name,purpose,schema,key,model,toWire){
  const body=JSON.stringify(makePayload(schema,purpose,toWire));
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':streamGenerateContent?alt=sse';
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{'x-goog-api-key':key,'Content-Type':'application/json',Accept:'text/event-stream'},body});
  if(!response.ok)throw new Error(name+'_HTTP_'+response.status);
  if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error(name+'_NOT_SSE');
  const value=await streamResponse(response);
  if(!value||typeof value.assistantMessage!=='string'||!value.assistantMessage.trim()||typeof value.safety!=='string')
    throw new Error(name+'_BASE_OUTPUT_INVALID');
  if(name==='worker'&&(!value.patch||typeof value.patch!=='object'||Array.isArray(value.patch)))
    throw new Error('WORKER_PATCH_INVALID');
  if(name==='need'&&(!Array.isArray(value.facts)||!value.dialogue||typeof value.dialogue!=='object'))
    throw new Error('NEED_DIALOGUE_INVALID');
  if('classificationShadowJson' in value){
    if(typeof value.classificationShadowJson!=='string'||!Array.isArray(JSON.parse(value.classificationShadowJson)))
      throw new Error(name+'_SHADOW_JSON_INVALID');
  }
  console.log(name.toUpperCase()+'_PROVIDER_SCHEMA_AND_OUTPUT_PASS (no content recorded)');
}
const mode=process.argv[2];
if(!['--offline','--provider'].includes(mode))throw new Error('USE_OFFLINE_OR_PROVIDER');
const {worker,need}=schemas(),adapter=wireAdapter();
makePayload(worker,'WORKER_CAPABILITY',adapter);
makePayload(need,'NEED_SERVICE',adapter);
console.log('BOTH_REAL_HANDLER_SCHEMAS_ON_WIRE_PASS');
if(mode==='--provider'){
  const key=process.env.USKOCI_GEMINI_TEST_API_KEY;
  const model=process.env.USKOCI_GEMINI_TEST_MODEL;
  if(!key||!model||!/^gemini-[a-z0-9][a-z0-9.-]{1,64}$/.test(model))
    throw new Error('DEDICATED_TEST_KEY_AND_MODEL_REQUIRED');
  // No retry. At most two provider requests, synthetic content only.
  await liveCall('worker','WORKER_CAPABILITY',worker,key,model,adapter);
  await liveCall('need','NEED_SERVICE',need,key,model,adapter);
}
