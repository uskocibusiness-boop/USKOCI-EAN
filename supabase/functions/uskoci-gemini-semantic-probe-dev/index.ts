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
const PROJECT = 'leqcwgzvjsxugfgzdmth';
const ACCOUNT = '579cdbb8-d10b-4131-b452-6e3aa197f5ba'; // enrolled test budget only
const EXPIRES = 1795884628;
const KEY = {kty:'EC',crv:'P-256',x:'Xwa6PVtVs0jaugvTmZtNXzsMpfbE_e2lyKnM1BwyRKI',y:'0zVvpzBufamVR7cmmB2UGzPH4nIBcpRPpnUAk6XMfxA',ext:true};
const CASES = {
 N01:{op:'2ce903ee-c3c0-4aaf-876c-de9795b57313',purpose:'NEED_SERVICE',text:'Treba mi neko za onlajn časove kineskog od nule.'},
 W01:{op:'cf56be24-bc80-46cf-b7a7-230a7a6c768e',purpose:'WORKER_CAPABILITY',text:'Držim časove engleskog i francuskog, i uživo i preko interneta.'},
 N03:{op:'72ed8308-b07a-4329-8fae-c7a25937dbfb',purpose:'NEED_SERVICE',text:'Treba mi da se okreči soba od 15 kvadrata u Novom Sadu.'},
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
  const worker=c.purpose==='WORKER_CAPABILITY';
  const props=worker?{assistantMessage:{type:'STRING'},serviceChanges:workerServiceChangesSchema,serviceModeChangesJson:{type:'STRING'}}:{assistantMessage:{type:'STRING'},category:{type:'STRING'},mode:{type:'STRING',enum:['ON_SITE','REMOTE','UNKNOWN']}};
  const schema=withSinglePassTaxonomySchema({type:'OBJECT',properties:props,required:Object.keys(props)});
  const role=worker?'You are the USKOČI JA MOGU interview. The user offers their own concrete services; initial candidate.skills is empty. Address them with Vi/Vam/Vas. '+workerServiceChangesInstruction()+' '+workerServiceModeInstruction({savedServices:[],draftServices:[],unresolvedServices:[]},true,false):'You are the USKOČI MENI TREBA interview. The user asks someone else to do one concrete task. category is the effective need.category, a natural service label. Address them with Vi/Vam/Vas.';
  const system=role+' '+singlePassTaxonomyInstruction(catalog,c.purpose);
  const body=JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:c.text}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:AI_TEST_LIMITS.llmMaxOutputTokens,thinkingConfig:{thinkingBudget:0}}});
  if(enc.encode(body).byteLength>AI_TEST_LIMITS.llmRequestBytes)return res(413,{code:'REQUEST_LIMIT'});
  const budget=await reserveAiTestBudget({supabaseUrl:url,serviceRoleKey:service,accountId:ACCOUNT,operationId:c.op,kind:'LLM',signal});
  if(!budget.admitted||budget.replay)return res(409,{code:budget.code});
  const start=performance.now();
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},body});
  const latencyMs=Math.round(performance.now()-start);
  if(!response.ok)return res(502,{code:'PROVIDER_HTTP',status:response.status,latencyMs});
  const output=await response.json(),usage=output.usageMetadata??{};
  const tokens={prompt:usage.promptTokenCount,output:usage.candidatesTokenCount,total:usage.totalTokenCount};
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
