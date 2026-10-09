// Production helper under synthetic transport. No provider, secret or billing access.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(fetch = () => assert.fail('UNEXPECTED_NETWORK')) {
  const logs = [], file = new URL('../../functions/_shared/geminiTaskStream.ts', import.meta.url);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {fileName:String(file), reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal(code.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const context = vm.createContext({fetch, Response, Request, Headers, TextEncoder, TextDecoder, ReadableStream,
    AbortController, setTimeout, clearTimeout, console:{error:(...args)=>logs.push(args)}});
  const availability=ts.transpileModule(readFileSync(new URL('../../../src/contracts/aiAvailability.ts',import.meta.url),'utf8'),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  const contract=new vm.Script(`(function(exports){${availability.outputText};return exports;})`).runInContext(context)({});
  const require=name=>{assert.equal(name,'../../../src/contracts/aiAvailability.ts');return contract;};
  return {api:new vm.Script(`(function(exports,require){${code.outputText};return exports;})`).runInContext(context)({},require),logs};
}
const body = () => JSON.stringify({contents:[{role:'user',parts:[{text:'SYNTHETIC_INPUT'}]}],generationConfig:{
  temperature:0.2,topP:0.9,topK:10,maxOutputTokens:8192,responseMimeType:'application/json',
  responseSchema:{type:'OBJECT',additionalProperties:false,properties:{assistantMessage:{type:'STRING'},facts:{type:'ARRAY',items:{type:'INTEGER'}}},required:['assistantMessage','facts']}}});
const plain = x => JSON.parse(JSON.stringify(x));
const args = (overrides={}) => ({url:'https://provider.invalid:443/stream',key:'SYNTHETIC_KEY',body:body(),onText:()=>assert.fail('NO_DELTA'),...overrides});
test('wire conversion preserves all constraints, contents and token cap; normalization is idempotent',()=>{
  const {api}=load(), input=body(), result=api.geminiRequestBody(input), parsed=JSON.parse(result);
  assert.equal(api.geminiRequestBody(result),result);
  assert.deepEqual(parsed.contents,JSON.parse(input).contents);
  assert.equal(parsed.generationConfig.maxOutputTokens,8192);
  assert.deepEqual(parsed.generationConfig.thinkingConfig,{thinkingLevel:'low'});
  // Structured output travels in the provider's documented fields. additionalProperties is not
  // part of that schema subset, so the adapter drops it; the caller's own decoder still refuses
  // unknown keys, so the accepted answer shape does not widen.
  assert.equal(parsed.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(parsed.generationConfig.responseSchema,{
    type:'OBJECT',properties:{assistantMessage:{type:'STRING'},facts:{type:'ARRAY',items:{type:'INTEGER'}}},required:['assistantMessage','facts']});
  assert.ok(!('responseFormat' in parsed.generationConfig));
  assert.ok(!JSON.stringify(parsed).includes('additionalProperties'));
  for(const old of ['temperature','topP','topK'])assert.ok(!(old in parsed.generationConfig));
});

test('only additionalProperties is dropped; every other constraint and type survives',()=>{
  const {api}=load();
  const schema={type:'OBJECT',additionalProperties:false,required:['facts'],properties:{
    facts:{type:'ARRAY',maxItems:12,minItems:1,items:{type:'OBJECT',additionalProperties:false,
      properties:{key:{type:'STRING',enum:['a','b']},score:{type:'NUMBER',minimum:0,maximum:1},note:{type:'STRING',nullable:true}},
      required:['key','score']}}}};
  const input=JSON.stringify({contents:[{role:'user',parts:[{text:'x'}]}],
    generationConfig:{temperature:0.2,maxOutputTokens:8192,responseMimeType:'application/json',responseSchema:schema}});
  const out=JSON.parse(api.geminiRequestBody(input)).generationConfig.responseSchema;
  assert.deepEqual(out,{type:'OBJECT',required:['facts'],properties:{
    facts:{type:'ARRAY',maxItems:12,minItems:1,items:{type:'OBJECT',
      properties:{key:{type:'STRING',enum:['a','b']},score:{type:'NUMBER',minimum:0,maximum:1},note:{type:'STRING',nullable:true}},
      required:['key','score']}}}});
});
test('malformed configuration cannot become a permissive unstructured request',()=>{
  const {api}=load();for(const value of ['null','[]','{}','{"generationConfig":[]}',
    '{"generationConfig":{"responseMimeType":"text/plain","responseSchema":{}}}',
    '{"generationConfig":{"responseMimeType":"application/json","responseSchema":[]}}'])
    assert.throws(()=>api.geminiRequestBody(value));
});
test('diagnostics expose only closed tokens, never raw message, key, metadata or arbitrary fields',()=>{
  const {api}=load(), secret='SYNTHETIC_PRIVATE';
  assert.deepEqual(plain(api.geminiFailureDiagnostic({error:{status:'INVALID_ARGUMENT',message:secret,
    details:[{reason:'API_KEY_INVALID',metadata:{key:secret}},{fieldViolations:[{field:'generation_config.response_format',description:secret}]}]}})),
    {status:'INVALID_ARGUMENT',reason:'API_KEY_INVALID',field:'RESPONSE_FORMAT'});
  for(const input of [null,{},[],{error:{status:secret,details:[{reason:secret,fieldViolations:[{field:secret},{field:'__proto__'}]}]}}])
    assert.deepEqual(plain(api.geminiFailureDiagnostic(input)),{status:'UNKNOWN',reason:'UNKNOWN',field:'UNKNOWN'});
});
test('HTTP400 logs safe reason exactly once without retry, user text or content delta',async()=>{
  let calls=0;const {api,logs}=load(async()=>{calls++;return new Response(JSON.stringify({error:{status:'INVALID_ARGUMENT',
    message:'PRIVATE_BODY',details:[{reason:'API_KEY_INVALID',metadata:{key:'PRIVATE_KEY'}}]}}),{status:400});});
  await assert.rejects(()=>api.streamGeminiTask(args()),/AI_STREAM_UNAVAILABLE/);
  assert.equal(calls,1);assert.deepEqual(logs,[['GEMINI_STREAM_HTTP_FAILED',400,'INVALID_ARGUMENT','API_KEY_INVALID','UNKNOWN']]);
});
test('oversized rejection is bounded and cancelled, never logged',async()=>{
  let cancelled=false;const {api,logs}=load(async()=>new Response(new ReadableStream({start(c){
    c.enqueue(new TextEncoder().encode('PRIVATE_BODY'.repeat(1000)));},cancel(){cancelled=true;}}),{status:400}));
  await assert.rejects(()=>api.streamGeminiTask(args()));assert.equal(cancelled,true);
  assert.deepEqual(logs,[['GEMINI_STREAM_HTTP_FAILED',400,'UNKNOWN','UNKNOWN','UNKNOWN']]);
});
test('hung error body is interrupted even when mocked fetch ignores cancellation',async()=>{
  const abort=new AbortController();let cancelled=false,calls=0;
  const {api,logs}=load(async()=>{calls++;setTimeout(()=>abort.abort(),5);return new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:403});});
  await assert.rejects(()=>api.streamGeminiTask(args({signal:abort.signal})));assert.equal(calls,1);assert.equal(cancelled,true);
  assert.deepEqual(logs,[['GEMINI_STREAM_HTTP_FAILED',403,'UNKNOWN','UNKNOWN','UNKNOWN']]);
});
test('already cancelled action never invokes provider',async()=>{
  const abort=new AbortController();abort.abort();const {api}=load();
  await assert.rejects(()=>api.streamGeminiTask(args({signal:abort.signal})),/AI_STREAM_STOPPED/);
});
test('hung successful body terminates on cancellation without another request',async()=>{
  const abort=new AbortController();let cancelled=false,calls=0;
  const {api}=load(async()=>{calls++;setTimeout(()=>abort.abort(),5);return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});});
  await assert.rejects(()=>api.streamGeminiTask(args({signal:abort.signal})),/AI_STREAM_STOPPED/);
  assert.equal(calls,1);assert.equal(cancelled,true);
});
test('unbuffered multi-chunk UTF8 stream emits first text before remaining bytes arrive',async()=>{
  const encode=new TextEncoder();let controller,reads=0;const emitted=[];
  const event=(text,last=false)=>encode.encode('data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(last?{finishReason:'STOP'}:{})}]})+'\n\n');
  const {api}=load(async()=>{reads++;return new Response(new ReadableStream({start(c){controller=c;}}),{headers:{'Content-Type':'text/event-stream'}});});
  const result=api.streamGeminiTask(args({onText:text=>emitted.push(text)}));
  await new Promise(r=>setTimeout(r,0));controller.enqueue(event('{"assistantMessage":"Čujem '));
  await new Promise(r=>setTimeout(r,0));assert.deepEqual(emitted,['Čujem ']);
  controller.enqueue(event('te 🟢.","facts":[]}',true));controller.close();
  assert.equal(JSON.parse(await result).assistantMessage,'Čujem te 🟢.');assert.equal(emitted.join(''),'Čujem te 🟢.');assert.equal(reads,1);
});
