// One-shot synthetic DEV interview probe. Fixed cases, short-lived signatures,
// standard Supabase Auth sessions for two verified QA-only accounts, fixed owned
// request IDs, existing interview budget fences. No Save, Publish, profile
// activation, user-token export or privileged writes to the business tables.
import { readSupabaseServiceKey, readSupabasePublishableKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
const PROJECT='leqcwgzvjsxugfgzdmth';
const EXPIRES=1795885200;
const KEY={kty:'EC',crv:'P-256',x:'55m6V_SDnR78KIU-o5xsB6BlXD-F85HMb3dPUmqFC6M',y:'Afj272u_xM8wPD0lF5NT7MQvRQSYkf-AR7M8xorUATA',ext:true};
const CASES={
 WORKER:{account:'0bed012b-6a52-4ae9-a836-ceb6944d6088',email:'qa-fulltree-45f4e5c04f224769b7fdc28c213fe6bc@uskoci.invalid',open:'b0e62769-cc6d-4c19-a390-258c21236325',turn:'874990ec-4f7a-4713-997e-ad1c4ddd56b6',rpc:'rpc_open_worker_ai',edge:'uskoci-worker-interview',text:'Držim časove engleskog i francuskog jezika, oba uživo i onlajn. Uživo radim na teritoriji Novog Sada, u radijusu od 10 km.'},
 NEED:{account:'abec5840-1918-4269-8a2f-26d7de1d233a',email:'qa-tools-cf0da28abdb5416c9570441d69e2c437@uskoci.invalid',open:'554b9161-b3a2-4b4b-9ef5-1642c5c7c9d3',turn:'ada90f7d-ba4a-4c2b-84f7-8c20d42d763e',rpc:'rpc_ai_open_need_conversation_owned_v2',edge:'uskoci-ai-interview',text:'Potreban mi je jedan nastavnik za onlajn čas kineskog jezika za početnike, sutra 29. novembra od 18 do 19 časova. Tražim ponude.'}
} as const;
const res=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const env=(n:string)=>Deno.env.get(n);
Deno.serve(async(req)=>{
 if(req.method!=='POST'||Math.floor(Date.now()/1000)>=EXPIRES)return res(410,{code:'CLOSED'});
 const url=env('SUPABASE_URL');
 if(url!=='https://'+PROJECT+'.supabase.co')return res(403,{code:'DEV_ONLY'});
 let b:any;
 try{const raw=await req.text();if(raw.length>512)return res(400,{code:'BODY'});b=JSON.parse(raw);}catch{return res(400,{code:'BODY'});}
 if(!b||Object.keys(b).sort().join(',')!=='case,expires,open,signature,turn'||!Object.hasOwn(CASES,b.case))return res(403,{code:'AUTH'});
 const c=CASES[b.case as keyof typeof CASES];
 if(b.expires!==EXPIRES||b.open!==c.open||b.turn!==c.turn||typeof b.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(b.signature))return res(403,{code:'AUTH'});
 try{const key=await crypto.subtle.importKey('jwk',KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);const sig=Uint8Array.from(atob(b.signature.replaceAll('-','+').replaceAll('_','/')+'=='),s=>s.charCodeAt(0));if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,new TextEncoder().encode('uskoci-dev-e2e-v1|'+b.case+'|'+c.open+'|'+c.turn+'|'+EXPIRES)))return res(403,{code:'AUTH'});}catch{return res(403,{code:'AUTH'});}
 const service=readSupabaseServiceKey(env),anon=readSupabasePublishableKey(env);
 if(!service||!anon)return res(503,{code:'KEY_CONFIG'});
 const admin=supabaseServiceHeaders(service,{'Content-Type':'application/json'});
 const signal=AbortSignal.timeout(48000);
 let stage='ACCOUNT',token:string|undefined;
 let userHeaders:Record<string,string>|undefined;
 let cid:string|undefined;
 try{
  const u=await fetch(url+'/auth/v1/admin/users/'+c.account,{headers:admin,signal,redirect:'error'});
  if(!u.ok)return res(502,{code:'QA_ACCOUNT_READ',http:u.status});
  const a=await u.json();
  const account=a.user??a;
  if(account.id!==c.account||account.email!==c.email||!account.email_confirmed_at||account.deleted_at||account.banned_until)return res(403,{code:'QA_ACCOUNT_MISMATCH'});
  stage='AUTH_LINK';
  const l=await fetch(url+'/auth/v1/admin/generate_link',{method:'POST',headers:admin,signal,redirect:'error',body:JSON.stringify({type:'magiclink',email:c.email})});
  if(!l.ok)return res(502,{code:stage,http:l.status});
  const link=await l.json(),hash=link.hashed_token??link.properties?.hashed_token;
  if(typeof hash!=='string'||(link.user?.id??link.id)!==c.account)return res(502,{code:'QA_LINK_MISMATCH'});
  stage='AUTH_VERIFY';
  const v=await fetch(url+'/auth/v1/verify',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},signal,redirect:'error',body:JSON.stringify({type:'email',token_hash:hash})});
  if(!v.ok)return res(502,{code:stage,http:v.status});
  const session=await v.json();
  if(session.user?.id!==c.account||typeof session.access_token!=='string')return res(403,{code:'QA_SESSION_MISMATCH'});
  token=session.access_token;userHeaders={apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  stage='OPEN';
  const o=await fetch(url+'/rest/v1/rpc/'+c.rpc,{method:'POST',headers:userHeaders,signal,redirect:'error',body:JSON.stringify({p_client_request_id:c.open})});
  if(!o.ok)return res(502,{code:stage,http:o.status});
  const doc=await o.json();cid=doc.conversationId;
  if(typeof cid!=='string'||!/^[0-9a-f-]{36}$/.test(cid))return res(502,{code:'OPEN_UNCONFIRMED'});
  if(b.case==='WORKER'&&(doc.accountId!==c.account||doc.turn!==null||doc.status!=='OPEN'))return res(409,{code:'NOT_FRESH_WORKER_DRAFT',conversationId:cid});
  if(b.case==='NEED'&&doc.idempotentReplay)return res(409,{code:'REPLAY',conversationId:cid});
  stage='INTERVIEW';
  const t=performance.now();
  const reply=await fetch(url+'/functions/v1/'+c.edge,{method:'POST',headers:{...userHeaders,Accept:'text/event-stream'},signal,redirect:'error',body:JSON.stringify({conversationId:cid,clientRequestId:c.turn,text:c.text})});
  const stream=await reply.text();
  if(stream.length>262144)return res(502,{code:'RESPONSE_LIMIT',conversationId:cid,http:reply.status});
  // Do not return raw edge output or auth material; the owned DB receipts
  // are checked separately with read-only SQL.
  return res(200,{case:b.case,conversationId:cid,clientRequestId:c.turn,interviewHttp:reply.status,replyBytes:new TextEncoder().encode(stream).length,elapsedMs:Math.round(performance.now()-t)});
 }catch{return res(502,{code:'PROBE_UNCONFIRMED',stage,conversationId:cid});}
 finally{if(token&&userHeaders){try{await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers:userHeaders,signal:AbortSignal.timeout(3000),redirect:'error'});}catch{/* no session token is returned */}}}
});
