// Exact Edge handler + real pinned WASM sanitizer. Synthetic Auth/SQL/Storage
// only; asserts protocol boundaries, not a deployed Supabase Storage service.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {webcrypto,createHash} from 'node:crypto';import ts from 'typescript';
import * as m from '@imagemagick/magick-wasm';import * as sanitizer from '../../functions/_shared/mediaImageSanitizer.mjs';import * as voice from '../../functions/_shared/voiceM4a.mjs';import * as admission from '../../functions/_shared/mediaUploadAdmission.mjs';
const require=createRequire(import.meta.url);await m.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,account=id(1),cid=id(2),key=id(3),aid=id(4),attempt=id(5),need=id(6),profile=id(7);
const input=m.ImageMagick.read(m.MagickColors.Blue,160,80,i=>{i.setAttribute('comment','PRIVATE_EXIF');return i.write(m.MagickFormat.Png,b=>new Uint8Array(b));});
const sanitized=sanitizer.sanitizeImage(input,'image/png',m),sha=createHash('sha256').update(sanitized.bytes).digest('hex'),ref=`${account}/v5/${aid}/${sha}.jpg`;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const asset=(state='READY',patch={})=>({assetId:aid,accountId:account,scope:'TASK',conversationId:cid,profileId:null,clientRequestId:key,state,selected:true,
 ref:state==='READY'?ref:null,sha256:state==='READY'?sha:null,width:state==='READY'?160:null,height:state==='READY'?80:null,
 byteSize:state==='READY'?sanitized.bytes.length:null,contentType:'image/jpeg',authoritative:true,...patch});
function fixture(options={}){
 let handler;const calls=[],environment={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'ANON',SUPABASE_SERVICE_ROLE_KEY:'SERVICE'};
 const fetch=async(url,init={})=>{
  const path=new URL(url).pathname,call={path,init,body:typeof init.body==='string'?JSON.parse(init.body):init.body};calls.push(call);
  if(options.transport){const overridden=await options.transport(call);if(overridden)return overridden;}
  if(path==='/auth/v1/user')return json({id:options.user??account});
  if(path.endsWith('/rpc_claim_media_upload_service'))return json(options.claim??{acquired:true,attemptId:attempt,asset:asset('PROCESSING'),staged:null});
  if(path.endsWith('/rpc_stage_media_upload_service'))return json({path:ref,sha256:sha,byteSize:sanitized.bytes.length});
  if(path.endsWith('/rpc_dispatch_media_upload_service'))return json(true);
  if(path.endsWith('/rpc_settle_media_upload_service'))return json(true);
  if(path.endsWith('/rpc_complete_media_upload_service'))return json(asset());
  if(path.endsWith('/rpc_fail_media_upload_service'))return json(asset('FAILED',{selected:false}));
  if(path.endsWith('/rpc_read_media_asset_service'))return json(asset());
  if(path.endsWith('/rpc_read_need_media_assets_service'))return json([asset()]);
  if(path==='/rest/v1/needs')return json(options.visible??[{id:need,revision:3,public_photo_paths:[ref]}]);
  if(path.startsWith('/storage/v1/object/profile-media/')){
   if(init.method==='POST'){assert.equal(init.headers['x-upsert'],'false');assert.equal(createHash('sha256').update(new Uint8Array(init.body)).digest('hex'),sha);return json({Key:'PRIVATE_STORAGE_KEY'});}
   return new Response(sanitized.bytes,{headers:{'Content-Type':'image/jpeg'}});
  }
  assert.fail('Unexpected transport '+path);
 };
 const runtime={...m,initializeImageMagick:async()=>undefined};
 const source=readFileSync('supabase/functions/uskoci-media/index.ts','utf8').replace("import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm')","'file:///synthetic-wasm-runtime-already-initialized'");
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const context=vm.createContext({exports:{},require:name=>{if(name.startsWith('npm:'))return runtime;if(name==='../_shared/voiceM4a.mjs')return voice;if(name==='../_shared/mediaUploadAdmission.mjs')return admission;assert.equal(name,'../_shared/mediaImageSanitizer.mjs');return sanitizer;},Request,Response,Headers,URL,TextEncoder,TextDecoder,
  Uint8Array,ArrayBuffer,DataView,AbortController,crypto:webcrypto,setTimeout,clearTimeout,fetch,atob,
  Deno:{env:{get:n=>environment[n]},readFile:async()=>new Uint8Array(),serve:fn=>handler=fn}});
 new vm.Script(compiled).runInContext(context);
 const invoke=(body=input,headers={})=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC','Content-Type':'image/png',
  'x-media-operation':'upload','x-media-scope':'TASK','x-media-target':cid,'x-media-request-id':key,...headers},body}));
 return{calls,invoke,read:(id=aid)=>invoke(JSON.stringify({assetId:id,needId:need}),{'x-media-operation':'read','Content-Type':'application/json'}),
  list:()=>invoke(JSON.stringify({needId:need}),{'x-media-operation':'list-need','Content-Type':'application/json'})};
}
const paths=f=>f.calls.map(c=>c.path);
test('trusted real sanitation precedes immutable staged upload and exact hash readback',async()=>{
 const f=fixture(),r=await f.invoke();assert.equal(r.status,200);assert.deepEqual(await r.json(),asset());
 const p=paths(f);assert.ok(p.indexOf('/rest/v1/rpc/rpc_stage_media_upload_service')<p.indexOf('/rest/v1/rpc/rpc_dispatch_media_upload_service'));
 assert.equal(p.filter(x=>x.startsWith('/storage/v1/')).length,2);assert.equal(p.at(-1),'/rest/v1/rpc/rpc_complete_media_upload_service');
 assert.ok(!p.some(x=>/publish|evaluation|gemini|openai/.test(x)));assert.equal(r.headers.get('cache-control'),'no-store');
});
test('READY command replay and unresolved PROCESSING never post again',async()=>{
 for(const state of ['READY','PROCESSING','FAILED']){const f=fixture({claim:{acquired:false,attemptId:null,asset:asset(state),staged:null}});
  assert.equal((await f.invoke()).status,200);assert.ok(!paths(f).some(x=>/storage|stage_media|complete_media/.test(x)));}
});
test('unknown staged Storage command recovers exact immutable bytes without another POST',async()=>{
 const f=fixture({claim:{acquired:false,attemptId:null,asset:asset('STAGED'),staged:{path:ref,sha256:sha,byteSize:sanitized.bytes.length,dispatchState:'DISPATCHING',dispatchOutcome:null}}});
 assert.equal((await f.invoke()).status,200);assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')&&c.init.method==='POST').length,0);
 assert.ok(paths(f).includes('/rest/v1/rpc/rpc_settle_media_upload_service'));
});
test('timeout and Storage500 remain unresolved; no false quiescence or automatic retry',async()=>{
 for(const thrown of [false,true]){const f=fixture({transport:c=>{if(c.path.startsWith('/storage/')&&c.init.method==='POST'){if(thrown)throw new Error('PRIVATE_NETWORK_ERROR');return json({},500);}}});
  const r=await f.invoke();assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'MEDIA_UNCONFIRMED'});
  assert.ok(!paths(f).some(x=>/settle_media|complete_media|fail_media/.test(x)));}
});
test('definitive rejected Storage write settles REJECTED without attaching',async()=>{
 const f=fixture({transport:c=>c.path.startsWith('/storage/')&&c.init.method==='POST'?json({},403):null});assert.equal((await f.invoke()).status,503);
 assert.equal(f.calls.find(c=>c.path.endsWith('/rpc_settle_media_upload_service')).body.p_outcome,'REJECTED');assert.ok(!paths(f).some(x=>/complete_media/.test(x)));
});
test('missing recovery object and altered bytes never settle or complete',async()=>{
 for(const status of [404,200]){const f=fixture({claim:{acquired:false,attemptId:null,asset:asset('STAGED'),staged:{path:ref,sha256:sha,byteSize:sanitized.bytes.length,dispatchState:'DISPATCHING',dispatchOutcome:null}},
  transport:c=>c.path.startsWith('/storage/')?new Response('WRONG_CONTENT',{status}):null});assert.equal((await f.invoke()).status,503);assert.ok(!paths(f).some(x=>/settle_media|complete_media/.test(x)));}
});
test('invalid image fails producer before Storage dispatch',async()=>{
 const f=fixture();assert.equal((await f.invoke(new TextEncoder().encode('not an image at all'))).status,400);
 assert.ok(paths(f).some(x=>x.endsWith('/rpc_fail_media_upload_service')));assert.ok(!paths(f).some(x=>/storage|dispatch_media/.test(x)));
});
test('foreign draft is denied before reading bytes; current Need visibility grants exact public image',async()=>{
 const denied=fixture({user:id(99),visible:[]});assert.equal((await denied.read()).status,403);assert.ok(!paths(denied).some(x=>x.startsWith('/storage/')));
 const allowed=fixture({user:id(99)}),r=await allowed.read();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');
 assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),sha);
});
test('public detail list contains only asset ID/dimensions, never owner or storage path',async()=>{
 const f=fixture({user:id(99)}),r=await f.list();assert.equal(r.status,200);const body=await r.json();
 assert.deepEqual(body,{needId:need,photos:[{assetId:aid,width:160,height:80,contentType:'image/jpeg'}],authoritative:true});assert.ok(!JSON.stringify(body).includes(account));assert.ok(!paths(f).some(x=>x.startsWith('/storage/')));
});
test('DRAFT avatar fallback uses caller JWT and admits only the owned profile',async()=>{
 const invoke=f=>f.invoke(JSON.stringify({profileId:profile}),{'x-media-operation':'list-profile','Content-Type':'application/json'});
 for(const owner of [account,id(99)]){
  const f=fixture({transport:c=>{
   if(c.path.endsWith('/rpc_get_public_profile'))return json(null);
   if(c.path.endsWith('/rpc_read_profile_avatar')){assert.equal(c.init.headers.Authorization,'Bearer SYNTHETIC');assert.equal(c.init.headers.apikey,'ANON');
    return json({profileId:profile,accountId:owner,avatarPath:ref,authoritative:true});}
   if(c.path.endsWith('/rpc_read_media_asset_service'))return json(asset('READY',{scope:'AVATAR',profileId:profile,conversationId:null}));
  }});
  const r=await invoke(f);assert.equal(r.status,owner===account?200:403);
  if(owner===account)assert.deepEqual(await r.json(),{profileId:profile,photo:{assetId:aid,width:160,height:80,contentType:'image/jpeg'},authoritative:true});
  else assert.ok(!paths(f).some(x=>/read_media_asset_service|storage/.test(x)));
 }
});
test('active public avatar projection does not invoke the private fallback',async()=>{
 const f=fixture({user:id(99),transport:c=>{
  if(c.path.endsWith('/rpc_get_public_profile'))return json({profileId:profile,avatarPath:ref});
  if(c.path.endsWith('/rpc_read_media_asset_service'))return json(asset('READY',{scope:'AVATAR',profileId:profile,conversationId:null}));
 }});
 const r=await f.invoke(JSON.stringify({profileId:profile}),{'x-media-operation':'list-profile','Content-Type':'application/json'});
 assert.equal(r.status,200);assert.ok(!paths(f).some(x=>x.endsWith('/rpc_read_profile_avatar')));
});
test('definitively rejected and deselected staged upload cannot retry Storage or attach',async()=>{
 const retired=asset('STAGED',{selected:false}),f=fixture({claim:{acquired:false,attemptId:null,asset:retired,
  staged:{path:ref,sha256:sha,byteSize:sanitized.bytes.length,dispatchState:'SETTLED',dispatchOutcome:'REJECTED'}}});
 const r=await f.invoke();assert.equal(r.status,200);assert.deepEqual(await r.json(),retired);
 assert.ok(!paths(f).some(x=>/storage|dispatch_media|settle_media|complete_media/.test(x)));
});

const supportCase=id(20),supportSession=id(21),human=id(99);
const humanToken=(patch={})=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:human,role:'authenticated',session_id:supportSession,iss:'https://db.invalid/auth/v1',exp:Math.floor(Date.now()/1000)+3600,...patch})).toString('base64url'),'SYNTHETIC_SIGNATURE'].join('.');
const supportReceipt=(patch={})=>({assetId:aid,caseId:supportCase,bucket:'profile-media',path:ref,sha256:sha,contentType:'image/jpeg',byteSize:sanitized.bytes.length,authoritative:true,...patch});
const readCase=(f,input={assetId:aid,caseId:supportCase},token=humanToken())=>f.invoke(JSON.stringify(input),{'x-media-operation':'read','Content-Type':'application/json',Authorization:'Bearer '+token});
test('case bytes use original verified human JWT session and exact private RPC both before and after Storage',async()=>{
 const token=humanToken(),f=fixture({user:human,transport:c=>{
  if(c.path==='/auth/v1/user'){assert.equal(c.init.headers.Authorization,'Bearer '+token);return json({id:human});}
  if(c.path.endsWith('/rpc_support_media_service_v5')){assert.equal(c.init.headers.Authorization,'Bearer SERVICE');assert.deepEqual(c.body,{p_account_id:human,p_session_id:supportSession,p_case_id:supportCase,p_asset_id:aid});return json(supportReceipt());}
 }}),r=await readCase(f,undefined,token);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),sha);
 assert.deepEqual(paths(f),['/auth/v1/user','/rest/v1/rpc/rpc_support_media_service_v5','/storage/v1/object/profile-media/'+ref,'/rest/v1/rpc/rpc_support_media_service_v5']);
 assert.ok(![...r.headers].some(([,v])=>v.includes(account)||v.includes(supportCase)||v.includes(ref)));
});
test('case context never inherits asset-owner access and accepts no client account/session or mixed context override',async()=>{
 const denied=fixture({user:account,transport:c=>c.path.endsWith('/rpc_support_media_service_v5')?json({message:'SUPPORT_REFERENCE_NOT_AVAILABLE'},403):null});
 assert.equal((await readCase(denied,undefined,humanToken({sub:account}))).status,403);assert.ok(!paths(denied).some(x=>x.startsWith('/storage/')||x.endsWith('/rpc_read_media_asset_service')));
 for(const bad of [{assetId:aid,caseId:supportCase,needId:need},{assetId:aid,caseId:supportCase,profileId:profile},{assetId:aid,caseId:supportCase,sessionId:supportSession},{assetId:aid,caseId:supportCase,accountId:account},{assetId:aid,caseId:null},{assetId:aid,caseId:supportCase,extra:'PRIVATE'}]){
  const f=fixture({user:human});assert.equal((await readCase(f,bad)).status,400);assert.deepEqual(paths(f),['/auth/v1/user']);
 }
});
test('case read rejects missing/mismatched/expired/non-human signed claim bindings before service access',async()=>{
 for(const patch of [{session_id:null},{sub:account},{role:'service_role'},{iss:'https://other.invalid/auth/v1'},{exp:0},{exp:'99999999999'}]){
  const f=fixture({user:human});assert.equal((await readCase(f,undefined,humanToken(patch))).status,401);assert.deepEqual(paths(f),['/auth/v1/user']);
 }
 const f=fixture({user:human});assert.equal((await readCase(f,undefined,'MALFORMED')).status,401);assert.deepEqual(paths(f),['/auth/v1/user']);
});
test('every case media response field and exact hash-path binding is checked before private Storage fetch',async()=>{
 const patches=[{assetId:id(77)},{caseId:id(78)},{bucket:'public'},{path:'https://host.invalid/private.jpg'},{path:ref+'/../other'},{path:ref+'?x=1'},{path:ref.replace(aid,id(7))},{path:ref.replace(sha,'a'.repeat(64))},{sha256:'bad'},{byteSize:0},{byteSize:5242881},{byteSize:'12'},{contentType:'text/html'},{authoritative:false},{hiddenOwner:account}];
 for(const patch of patches){const f=fixture({user:human,transport:c=>c.path.endsWith('/rpc_support_media_service_v5')?json(supportReceipt(patch)):null});
  const r=await readCase(f);assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'MEDIA_UNCONFIRMED'});assert.ok(!paths(f).some(x=>x.startsWith('/storage/')));
 }
});
test('operator/session revocation or unknown changed authority during async Storage withholds all image bytes',async()=>{
 for(const second of [json({message:'SUPPORT_REFERENCE_NOT_AVAILABLE'},403),json({message:'AUTH_REQUIRED'},403),json({message:'PRIVATE_FAILURE'},500),json(supportReceipt({byteSize:sanitized.bytes.length+1})),json(supportReceipt({path:ref.replace(account,id(88))}))]){
  let count=0;const f=fixture({user:human,transport:c=>c.path.endsWith('/rpc_support_media_service_v5')?(++count===1?json(supportReceipt()):second):null});const r=await readCase(f);
  assert.ok([401,403,503].includes(r.status));assert.equal(count,2);assert.equal(r.headers.get('content-type'),'application/json');assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE_FAILURE'));
 }
});
test('case Storage MIME/truncation/hash mismatch or network failure never returns an image or grants a public URL',async()=>{
 for(const response of [()=>new Response(sanitized.bytes,{headers:{'content-type':'text/html'}}),()=>new Response('wrong',{headers:{'content-type':'image/jpeg'}}),()=>new Response(sanitized.bytes,{headers:{'content-type':'image/jpeg','content-length':String(sanitized.bytes.length+1)}}),()=>{throw new Error('PRIVATE_STORAGE_FAILURE');}]){
  const f=fixture({user:human,transport:c=>c.path.endsWith('/rpc_support_media_service_v5')?json(supportReceipt()):c.path.startsWith('/storage/')?response():null}),r=await readCase(f);
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'MEDIA_UNCONFIRMED'});assert.equal(paths(f).filter(x=>x.endsWith('/rpc_support_media_service_v5')).length,1);
 }
});
