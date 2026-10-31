// Explicitly invoked, read-only HTTP diagnostic. Never logs, reads credentials
// from disk/env, signs in, creates fixtures, changes ACLs, or admits R01.
// A caller must separately approve/bind an existing dedicated synthetic user.
// GET can still create ordinary server access logs; it is not a transaction rollback.
export const DEV_PROJECT_REF='leqcwgzvjsxugfgzdmth';
export const DEV_ORIGIN=`https://${DEV_PROJECT_REF}.supabase.co`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES=32768;
// R01's 38-column public allowlist excludes these four fields. category_id
// is internal rather than a personal identifier, but is not a direct public
// Data API projection; the bound test guards drift with the SQL candidate.
const PRIVATE_COLUMNS=['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason','category_id'];
const MAX_GET_REQUESTS=20;
const EXPECTED_PRIVATE_PROBES=17;
class ProbeError extends Error {
  constructor(code){super(code);this.code=code;}
}
const fail=code=>{throw new ProbeError(code);};

function jwtPayload(token){
  if(typeof token!=='string'||token.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null;
  try{
    const value=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
    return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  }catch{return null;}
}
function validateInput(input){
  if(!input||input.origin!==DEV_ORIGIN||!UUID.test(input.expectedUserId??''))fail('INPUT_REFUSED');
  const claims=jwtPayload(input.accessToken);
  const audience=claims?.aud;
  if(!claims||claims.role!=='authenticated'||claims.sub!==input.expectedUserId||
      claims.iss!==DEV_ORIGIN+'/auth/v1'||!UUID.test(claims.session_id??'')||claims.is_anonymous===true||
      !(audience==='authenticated'||Array.isArray(audience)&&audience.includes('authenticated'))||
      !Number.isSafeInteger(claims.exp)||claims.exp*1000<=Date.now())fail('END_USER_TOKEN_REFUSED');
  // Local payload inspection is only a safety fence, never JWT authentication.
  // /auth/v1/user below must independently verify the token and exact subject.
  const key=input.publicApiKey;
  const keyClaims=jwtPayload(key);
  if(typeof key!=='string'||key.length>16384||
      !(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||keyClaims?.role==='anon'))fail('PUBLIC_API_KEY_REQUIRED');
  const requestTimeoutMs=input.requestTimeoutMs??5000;
  const totalTimeoutMs=input.totalTimeoutMs??30000;
  if(!Number.isInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>5000||
      !Number.isInteger(totalTimeoutMs)||totalTimeoutMs<1||totalTimeoutMs>30000)fail('TIME_BOUND_REFUSED');
  if(input.fetch!==undefined&&typeof input.fetch!=='function')fail('INPUT_REFUSED');
  if(input.signal!==undefined&&!(input.signal instanceof AbortSignal))fail('INPUT_REFUSED');
  return {requestTimeoutMs,totalTimeoutMs};
}

function raceAbort(promise,signal){
  if(signal.aborted)return Promise.reject(new ProbeError(signal.reason));
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new ProbeError(signal.reason));
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

async function readJson(response,signal){
  if(response.redirected||response.status>=300&&response.status<400)fail('REDIRECT_REFUSED');
  if(response.url&&new URL(response.url).origin!==DEV_ORIGIN)fail('REDIRECT_REFUSED');
  const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(type!=='application/json')fail('INVALID_RESPONSE');
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES))fail('BODY_LIMIT');
  if(!response.body||typeof response.body.getReader!=='function')fail('INVALID_RESPONSE');
  const reader=response.body.getReader(),chunks=[];let size=0,finished=false;
  try{
    while(true){
      const chunk=await raceAbort(reader.read(),signal);
      if(chunk.done){finished=true;break;}
      if(!(chunk.value instanceof Uint8Array))fail('INVALID_RESPONSE');
      size+=chunk.value.byteLength;if(size>MAX_BODY_BYTES)fail('BODY_LIMIT');
      chunks.push(chunk.value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
    catch{fail('INVALID_RESPONSE');}
  }finally{
    if(!finished){try{void Promise.resolve(reader.cancel()).catch(()=>{});}catch{/* bounded cancellation */}}
    try{reader.releaseLock();}catch{/* no diagnostic payload */}
  }
}

function privateProbes(){
  const result=[];
  for(const column of PRIVATE_COLUMNS){
    result.push({column,form:'select',query:{select:column}},
      {column,form:'alias',query:{select:`probe_value:${column}`}},
      {column,form:'filter',query:{select:'id',[column]:'is.null'}},
      {column,form:'order',query:{select:'id',order:`${column}.asc`}});
  }
  result.push({column:'*',form:'wildcard',query:{select:'*'}});
  return result;
}

/** No automatic execution on import; all secrets remain in the caller's memory. */
export async function runDevColumnProbe(input){
  const report={unit:'R01_DEV_ZERO_ROW_COLUMN_PROBE',project_ref:DEV_PROJECT_REF,
    result:'REFUSED',reason:null,actual_user_verified:false,r01_accepted:false,
    public_controls:{before:false,after:false},private_results:[],
    private_projection_outcome:'NOT_VERIFIED',request_count:0,
    expected_private_probes:EXPECTED_PRIVATE_PROBES,limits:{max_body_bytes:MAX_BODY_BYTES,max_get_requests:MAX_GET_REQUESTS},
    limitations:['Zero-row projection/permission diagnostic only; no business rows or fixture writes.',
      'No RLS/world/owner/participant positive-row, candidate, closure, native-client or disposable parity acceptance.',
      'Matching HTTP denial requires exact permission error plus successful public controls; other failures are inconclusive.',
      'Four current non-public columns are covered; future schema changes need a new admission review.',
      'The caller must separately bind an approved synthetic account; this probe does not discover or create one.']};
  let limits;
  try{limits=validateInput(input);}catch(error){report.reason=error instanceof ProbeError?error.code:'INPUT_REFUSED';return report;}
  report.limits={...report.limits,...limits};
  const overall=new AbortController();
  const onCallerAbort=()=>overall.abort('CALLER_ABORTED');
  if(input.signal?.aborted)onCallerAbort();
  else input.signal?.addEventListener('abort',onCallerAbort,{once:true});
  const totalTimer=setTimeout(()=>overall.abort('TOTAL_TIMEOUT'),limits.totalTimeoutMs);
  const fetchImpl=input.fetch??globalThis.fetch;
  const request=async(path,query)=>{
    if(overall.signal.aborted)fail(overall.signal.reason);
    if(path!=='/auth/v1/user'&&path!=='/rest/v1/needs')fail('HTTP_TARGET_REFUSED');
    const url=new URL(path,DEV_ORIGIN);
    if(path==='/rest/v1/needs'){
      for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
      url.searchParams.set('limit','0');
    }
    const controller=new AbortController();
    const onOverallAbort=()=>controller.abort(overall.signal.reason);
    overall.signal.addEventListener('abort',onOverallAbort,{once:true});
    const timer=setTimeout(()=>controller.abort('REQUEST_TIMEOUT'),limits.requestTimeoutMs);
    try{
      if(report.request_count>=MAX_GET_REQUESTS)fail('REQUEST_LIMIT_REFUSED');
      report.request_count++;
      const response=await raceAbort(fetchImpl(url.href,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{Accept:'application/json',apikey:input.publicApiKey,Authorization:`Bearer ${input.accessToken}`},
        signal:controller.signal}),controller.signal);
      return {status:response.status,value:await readJson(response,controller.signal)};
    }catch(error){
      if(error instanceof ProbeError)throw error;
      if(controller.signal.aborted)fail(controller.signal.reason);
      fail('NETWORK_OR_RESPONSE_FAILURE');
    }finally{
      // Also stop unread transport bodies after header/redirect rejection.
      controller.abort('REQUEST_FINISHED');
      clearTimeout(timer);overall.signal.removeEventListener('abort',onOverallAbort);
    }
  };
  const tableRead=async query=>{
    const response=await request('/rest/v1/needs',query);
    if(Array.isArray(response.value)&&response.value.length>0)fail('UNEXPECTED_ROWS');
    if(response.status>=200&&response.status<300&&!Array.isArray(response.value))fail('INVALID_TABLE_RESPONSE');
    return response;
  };
  const isEmptySuccess=response=>response.status===200&&Array.isArray(response.value)&&response.value.length===0;
  const inconclusive=()=>{
    for(const row of report.private_results)row.classification='inconclusive';
  };
  try{
    const auth=await request('/auth/v1/user');
    if(auth.status!==200||!auth.value||Array.isArray(auth.value)||auth.value.id!==input.expectedUserId)
      fail('AUTH_IDENTITY_MISMATCH');
    report.actual_user_verified=true;
    report.public_controls.before=isEmptySuccess(await tableRead({select:'id'}));
    if(!report.public_controls.before){report.result='INCONCLUSIVE';report.reason='PUBLIC_CONTROL_FAILED';return report;}
    for(const probe of privateProbes()){
      const response=await tableRead(probe.query);
      const permissionDenied=response.status===403&&response.value?.code==='42501'&&
        response.value?.message==='permission denied for table needs';
      const classification=isEmptySuccess(response)?'accepted_private_projection':
        permissionDenied?'denied_private_projection':'inconclusive';
      report.private_results.push({column:probe.column,form:probe.form,status:response.status,classification});
      if(classification==='inconclusive')break;
    }
    report.public_controls.after=isEmptySuccess(await tableRead({select:'id'}));
    if(!report.public_controls.after){report.result='INCONCLUSIVE';report.reason='PUBLIC_CONTROL_FAILED';inconclusive();}
    else if(report.private_results.length!==EXPECTED_PRIVATE_PROBES||report.private_results.some(row=>row.classification==='inconclusive')){
      report.result='INCONCLUSIVE';report.reason='UNCLASSIFIED_PRIVATE_RESPONSE';inconclusive();
    }else {
      report.result='COMPLETED';
      // Completion means the zero-row diagnostic finished, not that privacy
      // passed. Even one accepted private projection is a blocking finding.
      report.private_projection_outcome=report.private_results.some(
        row=>row.classification==='accepted_private_projection'
      )?'AT_LEAST_ONE_PRIVATE_PROJECTION_ACCEPTED':'ALL_PRIVATE_PROJECTIONS_DENIED_ZERO_ROWS_ONLY';
    }
  }catch(error){
    report.result='ABORTED';report.reason=error instanceof ProbeError?error.code:'INTERNAL_PROBE_FAILURE';inconclusive();
  }finally{
    clearTimeout(totalTimer);input.signal?.removeEventListener('abort',onCallerAbort);
  }
  return report;
}
