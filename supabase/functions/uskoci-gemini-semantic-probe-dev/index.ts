// One-shot DEV-only, synthetic provider probe. No user login, catalog writes,
// task publication or worker Save. Signed requests are fixed to the three
// operation IDs below; budget reservation is the atomic replay fence.
// Retire this endpoint after the three approved probes. Public key only.
import { singlePassTaxonomyInstruction, withSinglePassTaxonomySchema } from '../_shared/singlePassTaxonomy.mjs';
import { loadFullCatalogTree } from '../_shared/backgroundTaxonomyArchitect.mjs';
import { readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
import { AI_TEST_LIMITS, reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { workerServiceChangesInstruction, workerServiceChangesSchema } from '../_shared/conversationIntent.mjs';
import { workerServiceModeInstruction } from '../_shared/workerServiceModeContext.mjs';
import { geminiRequestBody, geminiFailureDiagnostic, geminiUsage } from '../_shared/geminiTaskStream.ts';
const PROJECT = 'leqcwgzvjsxugfgzdmth';
const ACCOUNT = '579cdbb8-d10b-4131-b452-6e3aa197f5ba'; // enrolled test budget only
const EXPIRES = 1795884151;
const KEY = {kty:'EC',crv:'P-256',x:'64o9yWa9CKEHvgbpdz9o1WDAg181q16sbugA1c2Qvdw',y:'4cuuAJzyxUNApn07RJzIMRhQtMfAPBVWDsGV3HWATW4',ext:true};
const CASES = {
 N01:{op:'982e08d8-6b7b-4f3c-9ebd-a13a66e265e2',purpose:'NEED_SERVICE',text:'Treba mi neko za onlajn časove kineskog od nule.'},
} as const;
const res=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const env=(n:string)=>Deno.env.get(n);
const enc=new TextEncoder();
Deno.serve(async(req)=>{
 if(req.method!=='POST'||Math.floor(Date.now()/1000)>=EXPIRES)return res(410,{code:'PROBE_CLOSED'});
 const url=env('SUPABASE_URL')??'';
 if(url!=='https://'+PROJECT+'.supabase.co')return res(403,{code:'DEV_ONLY'});
 let b:any;
 try{const raw=await req.text();if(raw.length>512)return res(400,{code:'BODY'});b=JSON.parse(raw);}catch{return res(400,{code:'BODY'});}
 if(!b||Object.keys(b).sort().join(',')!=='case,expires,operationId,signature'||!Object.hasOwn(CASES,b.case))return res(403,{code:'AUTH'});
 const c=CASES[b.case as keyof typeof CASES];
 if(b.expires!==EXPIRES||b.operationId!==c.op||typeof b.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(b.signature))return res(403,{code:'AUTH'});
 try{
  const key=await crypto.subtle.importKey('jwk',KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const signature=Uint8Array.from(atob(b.signature.replaceAll('-','+').replaceAll('_','/')+'=='),s=>s.charCodeAt(0));
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,enc.encode('uskoci-dev-semantic-v1|'+b.case+'|'+c.op+'|'+EXPIRES)))return res(403,{code:'AUTH'});
 }catch{return res(403,{code:'AUTH'});}
 const service=readSupabaseServiceKey(env),key=env('GEMINI_API_KEY'),model=env('GEMINI_MODEL');
 if(!service||!key||!model||env('AI_PROVIDER')!=='gemini'||!/^[a-z0-9.-]{1,80}$/.test(model))return res(503,{code:'PROVIDER_CONFIG'});
 const signal=AbortSignal.timeout(35000);
 const rpc=async(name:string,args:unknown)=>{
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',signal,headers:supabaseServiceHeaders(service,{'Content-Type':'application/json'}),body:JSON.stringify(args)});
  if(!r.ok)throw Error('RPC_FAILED');
  return {ok:true,data:await r.json()};
 };
 try{
  const catalog=await loadFullCatalogTree(rpc,signal);
  if(!catalog?.verifiedComplete)return res(503,{code:'CATALOG'});
  const worker=String(c.purpose)==='WORKER_CAPABILITY';
  const props=worker?{assistantMessage:{type:'STRING'},serviceChanges:workerServiceChangesSchema,serviceModeChangesJson:{type:'STRING'}}:{assistantMessage:{type:'STRING'},category:{type:'STRING'},mode:{type:'STRING',enum:['ON_SITE','REMOTE','UNKNOWN']}};
  const schema=withSinglePassTaxonomySchema({type:'OBJECT',properties:props,required:Object.keys(props)});
  const role=worker?'You are the USKOČI JA MOGU interview. The user offers their own concrete services; initial candidate.skills is empty. Address them with Vi/Vam/Vas. '+workerServiceChangesInstruction()+' '+workerServiceModeInstruction({savedServices:[],draftServices:[],unresolvedServices:[]},true,false):'You are the USKOČI MENI TREBA interview. The user asks someone else to do one concrete task. category is the effective need.category, a natural service label. Address them with Vi/Vam/Vas.';
  const system=role+' '+singlePassTaxonomyInstruction(catalog,c.purpose);
  const body=geminiRequestBody(JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:c.text}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:AI_TEST_LIMITS.llmMaxOutputTokens,thinkingConfig:{thinkingBudget:0},temperature:worker?0.2:0.7}}));
  if(enc.encode(body).byteLength>AI_TEST_LIMITS.llmRequestBytes)return res(413,{code:'REQUEST_LIMIT'});
  const budget=await reserveAiTestBudget({supabaseUrl:url,serviceRoleKey:service,accountId:ACCOUNT,operationId:c.op,kind:'LLM',signal});
  if(!budget.admitted||budget.replay)return res(409,{code:budget.code});
  const start=performance.now();
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},body});
  const latencyMs=Math.round(performance.now()-start);
  if(!response.ok){let diagnostic;try{diagnostic=geminiFailureDiagnostic(await response.json());}catch{/* no raw provider message */}return res(502,{code:'PROVIDER_HTTP',status:response.status,latencyMs,diagnostic});}
  const output=await response.json(),usage=geminiUsage(output.usageMetadata);
  const tokens={prompt:usage?.promptTokens,output:usage?.outputTokens,total:usage?.totalTokens};
  let accounting=false;
  if(Object.values(tokens).every(x=>Number.isSafeInteger(x)&&x>=0)){
   try{await rpc('rpc_ai_test_record_usage_service',{p_operation_id:c.op,p_model:model,p_prompt_tokens:tokens.prompt,p_output_tokens:tokens.output,p_total_tokens:tokens.total});accounting=true;}catch{/* retain reservation */}
  }
  const candidate=output.candidates?.[0];
  let parsed:any;
  try{parsed=JSON.parse((candidate?.content?.parts??[]).map((p:any)=>p.text??'').join(''));}catch{return res(502,{code:'PROVIDER_OUTPUT_INVALID',finishReason:candidate?.finishReason,model,latencyMs,tokens,accounting});}
  return res(200,{case:b.case,model,catalogVersion:catalog.catalogVersion,latencyMs,tokens,accounting,finishReason:candidate?.finishReason,output:parsed});
 }catch{return res(503,{code:'PROBE_UNCONFIRMED'});}
});
