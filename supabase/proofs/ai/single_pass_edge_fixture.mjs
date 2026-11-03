// Exact current handlers; synthetic HTTP/provider receipts. SQL execution lives
// in r06_first_plan_completion and r04_single_pass_readers, not in this fixture.
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';
import {withDialogue} from './dialogue_fixture.mjs';
export const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5),category=id(6);
export const service='Lektura teksta',user='Radim lekturu teksta samo online, bez fizičke predaje.';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
export const decision=(mode='REMOTE')=>({service,mode,action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],ambiguityPrompt:'',reason:'Isti posao lekture koji je opisan u razgovoru.'});
export function singlePassFixture(kind,options={}){
 const worker=kind==='WORKER',calls=[],waits=[],logs=[],abort=new AbortController();let writes=0;
 const env={SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
  AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_PROVIDER',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
  USKOCI_TAXONOMY_DUAL_GEMINI:'true',USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'leqcwgzvjsxugfgzdmth'};
 const turn=(state='SUCCEEDED',body={})=>worker?{conversationId:conversation,clientRequestId:key,turnId,attemptId,state,retryAllowed:false,authoritative:true}:
  {conversationId:conversation,clientRequestId:key,turnId,state,retryAllowed:false,receipt:state==='SUCCEEDED'?{
   userMessageId:id(7),assistantMessageId:id(8),proposedCount:body.p_proposals?.length??1,safety:options.safety??'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true}:null};
 const output=worker?{assistantMessage:'Razumeo sam opis posla.',safety:options.safety??'ALLOW',patch:{skills:[service]},availabilityChange:{kind:'NONE',evidence:''},
  serviceModeChangesJson:JSON.stringify([{service,modes:options.modes??['REMOTE'],evidence:options.evidence??user,handoff:{required:false}}])}:
  withDialogue({assistantMessage:'Razumeo sam opis posla.',safety:options.safety??'ALLOW',facts:[{key:'need.category',valueJson:JSON.stringify(service),displayValue:service,evidence:user,confidence:1}]});
 Object.assign(output,options.output??{});
 output.taxonomyDecisions=options.decisions??[decision()];
 let completed;
 const fetch=async(raw,init={})=>{
  const url=String(raw),name=new URL(url).pathname.split('/').at(-1),body=init.body?JSON.parse(init.body):null;
  calls.push({name,url,body,signal:init.signal});
  const override=await options.rpc?.(name,body,init);if(override!==undefined)return override;
  if(url.endsWith('/auth/v1/user'))return json({id:account});
  if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
  if(name==='rpc_ai_claim_need_turn_v2_service')return json({turn:turn('PROCESSING'),claim:{attemptId,leaseExpiresAt:'2099-11-03T12:00:00Z',
   context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[{fact_key:'need.task_geography',fact_value:{mode:'REMOTE'},value_type:'JSON',
    display_value:'Na daljinu',fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'EXPLICIT_USER_ANSWER',created_at:'2026-11-03T00:00:00Z'}]}}});
  if(name==='rpc_claim_worker_ai_turn_service')return json({acquired:true,turn:turn('PROCESSING')});
  if(name==='rpc_read_worker_ai_context_service')return json({schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
   serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:0,savedServices:[],draftServices:[],unresolvedServices:[]},
   candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:user}]});
  if(name==='rpc_taxonomy_fetch_snapshot_v1')return options.catalogUnavailable?json(null,503):json({catalogVersion:7,catalogFingerprint:'a'.repeat(32),count:1,categories:[
   {categoryId:category,parentId:null,label:service,aliases:[],path:[service],isLeaf:true,modes:['REMOTE','ON_SITE']} ]});
  if(name==='rpc_taxonomy_get_unconsumed_turn_hint_service')return json(null);
  if(name==='rpc_ai_test_budget_reserve_service')return json({admitted:true,reservationId:id(9),replay:false,code:'AI_TEST_RESERVED'});
  if(name==='rpc_ai_dispatch_need_turn_v2_service')return json(true);
  if(name==='rpc_dispatch_worker_ai_turn_service')return json({dispatched:true,turn:turn('PROCESSING')});
  if(name==='rpc_ai_test_record_usage_service')return json({recorded:true,authoritative:true,operationId:body.p_operation_id,
   promptTokens:body.p_prompt_tokens,outputTokens:body.p_output_tokens,totalTokens:body.p_total_tokens});
  if(name==='rpc_ai_read_first_plan_completion_service')return json(completed?{state:'COMPLETED',envelope:completed}:{state:options.readState??'PENDING'});
  if(/^(rpc_ai_complete_need_turn_with_first_plan_service|rpc_complete_worker_ai_turn_with_first_plan_service)$/.test(name)){
   writes++;
   if(options.refused)return json({code:'42501'},403);
   if(options.pendingFirst&&writes===1)throw new Error('SYNTHETIC transport before commit');
   completed={completion:turn('SUCCEEDED',body),firstPlan:{state:'RESOLVED',authority:'CATALOG_ONLY',applicability:'NOT_EVALUATED'}};
   if(options.malformed)return json({wrong:true});
   if(options.abortAfterCommit)abort.abort();
   if(options.lostAck)throw new Error('SYNTHETIC transport after commit');
   return json(completed);
  }
  if(/^(rpc_ai_complete_need_turn_v2_service|rpc_complete_worker_ai_turn_service)$/.test(name))return json(turn('SUCCEEDED',body));
  if(/^(rpc_ai_fail_need_turn_v2_service|rpc_fail_worker_ai_turn_service)$/.test(name))return json(turn('FAILED'));
  if(url.startsWith('https://generativelanguage.googleapis.com/')){
   assert.match(url,/:streamGenerateContent/,'one conversational call, no background provider');
   if(options.provider)return options.provider({url,body,init,output});
   const data='data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],
    usageMetadata:options.usage??{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5,totalTokenCount:125}})+'\n\n';
   return new Response(data,{headers:{'Content-Type':'text/event-stream'}});
  }
  throw new Error('UNEXPECTED_ROUTE:'+name);
 };
 const loaded=(worker?loadWorkerRecoveryHandler:loadOwnedIntakeHandler)({fetch,env:key=>env[key],log:args=>logs.push(args),setTimeout:options.setTimeout,EdgeRuntime:{waitUntil:p=>waits.push(p)}});
 const start=()=>loaded.handler(new Request('https://edge.invalid',{method:'POST',signal:abort.signal,
  headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:user})}));
 const drain=()=>Promise.all(waits);
 return {calls,logs,abort,start,drain,async invoke({waitBackground=true}={}){
  const response=await start();assert.equal(response.status,200);
  const events=(await response.text()).trim().split('\n\n').filter(Boolean).map(line=>JSON.parse(line.slice(6)));
  if(waitBackground)await drain();return events;}};
}
export {category};
