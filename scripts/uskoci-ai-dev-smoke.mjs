// Authenticated DEV-only smoke runner for real Gemini + real Supabase.
// Never publishes tasks, saves/activates worker profiles, dispatches jobs or sends push.
// Deliberately requires a dedicated test account and an explicit paid-call opt-in.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const DEV_URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 524288;
const inputs = Object.freeze({
  NEED: 'Potrebno mi je krecenje sobe u Novom Sadu sledece nedelje. Soba ima oko 20 kvadrata, boju imam, nudim 10000 dinara za ceo posao.',
  WORKER: 'Radim krecenje i gletovanje u Novom Sadu i do 30 kilometara oko grada. Dostupan sam vikendom. Grad mog profila je Novi Sad.',
});

export function validateSmokeEnvironment(env) {
  if (env.USKOCI_DEV_SMOKE_ACK !== 'DEV_TEST_PAID_ONE_TURN_NO_PUBLISH') throw Error('SMOKE_EXPLICIT_OPT_IN_REQUIRED');
  if (env.USKOCI_DEV_URL !== DEV_URL) throw Error('SMOKE_DEV_ONLY');
  const kind = env.USKOCI_DEV_SMOKE_KIND;
  if (!['NEED','WORKER'].includes(kind)) throw Error('SMOKE_KIND_REQUIRED');
  const email = String(env.USKOCI_DEV_SMOKE_EMAIL ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.split('@')[0].includes('uskoci-test')) throw Error('SMOKE_DEDICATED_TEST_ACCOUNT_REQUIRED');
  if (!env.USKOCI_DEV_SMOKE_PASSWORD || !env.USKOCI_DEV_ANON_KEY) throw Error('SMOKE_CREDENTIALS_MISSING');
  const expectedId = String(env.USKOCI_DEV_SMOKE_ACCOUNT_ID ?? '').toLowerCase();
  if (!UUID.test(expectedId)) throw Error('SMOKE_EXPECTED_ACCOUNT_REQUIRED');
  return Object.freeze({kind,email,password:env.USKOCI_DEV_SMOKE_PASSWORD,
    anonKey:env.USKOCI_DEV_ANON_KEY,expectedId,origin:DEV_URL});
}

export function decodeSseEvents(payload) {
  if (typeof payload !== 'string' || Buffer.byteLength(payload,'utf8') > MAX_BODY_BYTES) throw Error('SMOKE_RESPONSE_OVERSIZE');
  const chunks = payload.split(/\r?\n\r?\n/);
  const events = [];
  for (const chunk of chunks) {
    const data = chunk.split(/\r?\n/).filter(line=>line.startsWith('data: ')).map(line=>line.slice(6));
    if (!data.length) continue;
    let event;
    try { event = JSON.parse(data.join('\n')); } catch { throw Error('SMOKE_INVALID_EVENT_JSON'); }
    if (!event || typeof event!=='object' || Array.isArray(event)) throw Error('SMOKE_INVALID_EVENT');
    events.push(event);
    if (events.length > 128) throw Error('SMOKE_TOO_MANY_EVENTS');
  }
  return events;
}

async function readLimited(response) {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw Error('SMOKE_RESPONSE_OVERSIZE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BODY_BYTES) throw Error('SMOKE_RESPONSE_OVERSIZE');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}

async function postJson(url,body,headers,timeoutMs=25000) {
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
    headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const text=await readLimited(response);
  if (!response.ok) throw Error('SMOKE_HTTP_'+response.status);
  try { return JSON.parse(text); } catch { throw Error('SMOKE_INVALID_RPC_JSON'); }
}

export async function runDevSmoke(rawEnvironment=process.env) {
  const cfg=validateSmokeEnvironment(rawEnvironment);
  const auth=await postJson(cfg.origin+'/auth/v1/token?grant_type=password',
    {email:cfg.email,password:cfg.password},{apikey:cfg.anonKey},25000);
  const accountId=String(auth?.user?.id ?? '').toLowerCase();
  if (!UUID.test(accountId) || accountId!==cfg.expectedId || !auth?.access_token)
    throw Error('SMOKE_ACCOUNT_ID_MISMATCH');
  const headers={apikey:cfg.anonKey,Authorization:'Bearer '+auth.access_token};
  const rpc=(name,body)=>postJson(cfg.origin+'/rest/v1/rpc/'+name,body,headers,25000);
  const requestId=randomUUID();
  const opened=cfg.kind==='NEED'
    ? await rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:requestId})
    : await rpc('rpc_open_worker_ai',{p_client_request_id:requestId});
  const cid=opened?.conversationId;
  if (!UUID.test(cid)) throw Error('SMOKE_OPEN_RECEIPT_INVALID');
  const turnRequestId=randomUUID();
  const endpoint=cfg.kind==='NEED'?'uskoci-ai-interview':'uskoci-worker-interview';
  const started=Date.now();
  const response=await fetch(cfg.origin+'/functions/v1/'+endpoint,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(70000),
    headers:{'Content-Type':'application/json',...headers},
    body:JSON.stringify({conversationId:cid,clientRequestId:turnRequestId,text:inputs[cfg.kind]}),
  });
  const raw=await readLimited(response);
  if (!response.ok) throw Error('SMOKE_EDGE_HTTP_'+response.status);
  const events=decodeSseEvents(raw);
  const finalEvents=events.filter(e=>e.kind==='final');
  if (finalEvents.length!==1 || finalEvents[0].turn?.state!=='SUCCEEDED' ||
    finalEvents[0].conversationId!==cid || finalEvents[0].clientRequestId!==turnRequestId)
    throw Error('SMOKE_FINAL_RECEIPT_MISSING');
  const persisted=cfg.kind==='NEED'
    ? await rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:cid,p_client_request_id:turnRequestId})
    : await rpc('rpc_read_worker_ai_taxonomy',{p_conversation_id:cid});
  if (!persisted || typeof persisted!=='object') throw Error('SMOKE_READBACK_MISSING');
  if (cfg.kind==='NEED' && (persisted.state!=='SUCCEEDED' || persisted.conversationId!==cid))
    throw Error('SMOKE_NEED_RECEIPT_MISMATCH');
  if (cfg.kind==='WORKER' && (persisted.conversationId!==cid || !persisted.candidate))
    throw Error('SMOKE_WORKER_RECEIPT_MISMATCH');
  const safeSummary={kind:cfg.kind,environment:'DEV',completed:true,elapsedMs:Date.now()-started,
    sseEvents:events.length,hasFinalReceipt:true,readbackValidated:true,
    reviewIsNotPublication:true};
  if (cfg.kind==='WORKER') {
    safeSummary.typedSkills=Array.isArray(persisted.candidate.skills)?persisted.candidate.skills.length:null;
    safeSummary.typedAreas=Array.isArray(persisted.candidate.workAreas)?persisted.candidate.workAreas.length:null;
    safeSummary.profileWasNotActivated=true;
  }
  // Intentionally no Save, no publish, no match dispatch, no push, no full response text,
  // no secret/token/request headers in output and no automatic retry of paid requests.
  return safeSummary;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const summary=await runDevSmoke();
    console.log(JSON.stringify(summary));
  } catch (error) {
    const code=error instanceof Error && /^SMOKE_[A-Z0-9_]+$/.test(error.message)
      ? error.message : 'SMOKE_UNAVAILABLE';
    console.error(code);
    process.exitCode=1;
  }
}
