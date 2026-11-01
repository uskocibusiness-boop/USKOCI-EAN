// Explicitly invoked, fixed-DEV, rejected-access probes only. No valid token,
// account creation, SQL, provider call or mutable endpoint parameter is accepted.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export const project='leqcwgzvjsxugfgzdmth';
const invalidToken='Bearer uskoci-intentionally-invalid-token';
const body=JSON.stringify({conversationId:'00000000-0000-4000-8000-000000000001',
 clientRequestId:'00000000-0000-4000-8000-000000000002',text:'Provera autentikacije'});
const slugs=['uskoci-ai-interview','uskoci-worker-interview'];

async function bounded(fetchImpl,url,init,timeoutMs){
 const abort=new AbortController();let reader;let timer;
 const cancelled=new Promise((_,reject)=>{abort.signal.addEventListener('abort',()=>reject(Error('PROBE_TIMEOUT')),{once:true});
  timer=setTimeout(()=>abort.abort(),timeoutMs);});
 const operation=(async()=>{
  const response=await fetchImpl(url,{...init,signal:abort.signal,redirect:'error'});
  if(abort.signal.aborted){try{void response.body?.cancel().catch(()=>{});}catch{}throw Error('PROBE_TIMEOUT');}
  if(response.redirected)throw Error('PROBE_REDIRECT_REFUSED');
  let content='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  if(response.body){reader=response.body.getReader();for(;;){
   const chunk=await Promise.race([reader.read(),cancelled]);if(chunk.done)break;
   bytes+=chunk.value.byteLength;if(bytes>4096)throw Error('PROBE_RESPONSE_TOO_LARGE');
   content+=decoder.decode(chunk.value,{stream:true});
  }content+=decoder.decode();}
  let code=null;try{const parsed=JSON.parse(content);if(typeof parsed?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(parsed.code))code=parsed.code;}catch{}
  return {status:response.status,code,response_bytes:bytes};
 })();
 try{return await Promise.race([operation,cancelled]);}
 finally{clearTimeout(timer);abort.abort();try{void reader?.cancel().catch(()=>{});}catch{}}
}

export async function runRejectedAccessProbes(fetchImpl=fetch,{timeoutMs=10000}={}){
 assert.equal(typeof fetchImpl,'function');assert.ok(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000);
 const results=[];
 for(const slug of slugs){
  const cases=[{name:'OPTIONS',init:{method:'OPTIONS'},expected:slug==='uskoci-ai-interview'?200:204},
   {name:'MISSING_AUTHORIZATION',init:{method:'POST',headers:{'Content-Type':'application/json'},body},expected:401},
   {name:'INVALID_TOKEN_AUTH_REJECTION',init:{method:'POST',headers:{'Content-Type':'application/json',Authorization:invalidToken},body},expected:401}];
  for(const item of cases){
   const observed=await bounded(fetchImpl,'https://'+project+'.supabase.co/functions/v1/'+slug,item.init,timeoutMs);
   const passed=observed.status===item.expected&&(item.name==='OPTIONS'||observed.code==='AUTH_REQUIRED');
   results.push({slug,probe:item.name,...observed,passed});
  }
 }
 return {project_id:project,observed_at:new Date().toISOString(),status:results.every(r=>r.passed)?'REJECTED_ACCESS_PROBES_PASS':'REJECTED_ACCESS_PROBES_FAIL',
  results,real_auth_flow_proven:false,provider_invoked:false,sql_write_requested:false,functional_acceptance_proven:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3||process.argv[2]!=='--run-rejected-access')throw Error('Use --run-rejected-access for six fixed-DEV probes. No token or target overrides are accepted.');
 try{const result=await runRejectedAccessProbes();console.log(JSON.stringify(result,null,2));
  if(result.status!=='REJECTED_ACCESS_PROBES_PASS')process.exitCode=1;
 }catch(error){console.error(error instanceof Error&&/^PROBE_/.test(error.message)?error.message:'PROBE_TRANSPORT_FAILED');process.exitCode=1;}
}
