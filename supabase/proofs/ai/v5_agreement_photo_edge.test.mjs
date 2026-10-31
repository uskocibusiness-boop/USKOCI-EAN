// Exact current Edge with real pinned WASM; synthetic transport is explicitly
// unit-only. Actual SQL/Storage authorization is tested by the144 disposable proof.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {webcrypto,createHash} from 'node:crypto';import ts from 'typescript';
import * as magick from '@imagemagick/magick-wasm';import * as sanitizer from '../../functions/_shared/mediaImageSanitizer.mjs';import * as voice from '../../functions/_shared/voiceM4a.mjs';import * as admission from '../../functions/_shared/mediaUploadAdmission.mjs';
const require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,account=id(1),agreement=id(2),key=id(3),asset=id(4),attempt=id(5),session=id(6),message=id(7);
const original=magick.ImageMagick.read(magick.MagickColors.Blue,80,40,i=>{i.setAttribute('comment','PRIVATE_METADATA');return i.write(magick.MagickFormat.Png,b=>new Uint8Array(b));});
const clean=sanitizer.sanitizeImage(original,'image/png',magick),sha=createHash('sha256').update(clean.bytes).digest('hex'),path=`${account}/agreement-v5/${asset}/${sha}.jpg`;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const token=(patch={})=>['SYNTHETIC_HEADER',Buffer.from(JSON.stringify({sub:account,role:'authenticated',session_id:session,iss:'https://db.invalid/auth/v1',exp:Math.floor(Date.now()/1000)+3600,...patch})).toString('base64url'),'SYNTHETIC_SIGNATURE'].join('.');
const receipt=(state='READY',patch={})=>({accountId:account,agreementId:agreement,agreementVersion:1,clientRequestId:key,assetId:state==='ABSENT'?null:asset,state,attachedMessageId:null,
 photo:state==='READY'?{assetId:asset,width:80,height:40,byteSize:clean.bytes.length,contentType:'image/jpeg'}:null,authoritative:true,...patch});
const transfer=(state='PROCESSING',dispatchState='NOT_DISPATCHED',acquired=false,patch={})=>({receipt:receipt(state),attemptId:attempt,path:['STAGED','READY'].includes(state)?path:null,
 sha256:['STAGED','READY'].includes(state)?sha:null,byteSize:['STAGED','READY'].includes(state)?clean.bytes.length:null,dispatchState,dispatchOutcome:dispatchState==='SETTLED'?'STORED':null,acquired,...patch});
const readReceipt=()=>({assetId:asset,agreementId:agreement,messageId:message,bucket:'profile-media',path,sha256:sha,contentType:'image/jpeg',byteSize:clean.bytes.length,authoritative:true});
function fixture(options={}){
 const calls=[];let handler;const environment={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'ANON',SUPABASE_SERVICE_ROLE_KEY:'SERVICE'};
 const fetch=async(url,init={})=>{const p=new URL(url).pathname,c={path:p,init,body:typeof init.body==='string'?JSON.parse(init.body):init.body};calls.push(c);
  const overridden=await options.transport?.(c);if(overridden)return overridden;
  if(p==='/auth/v1/user')return json({id:account});
  if(p.endsWith('/rpc_agreement_photo_read_service_v5'))return json(readReceipt());
  if(p.endsWith('/rpc_agreement_photo_upload_service_v5')){
   assert.equal(c.body.p_account_id,account);assert.equal(c.body.p_session_id,session);assert.equal(c.body.p_agreement_id,agreement);
   switch(c.body.p_operation){
    case 'CLAIM':return json(options.claim??transfer('PROCESSING','NOT_DISPATCHED',true));
    case 'STAGE':assert.equal(c.body.p_input.sha256,sha);return json(transfer('STAGED'));
    case 'DISPATCH':return json(transfer('STAGED','DISPATCHING',true));
    case 'SETTLE':return json(transfer(c.body.p_input.outcome==='STORED'?'READY':'FAILED','SETTLED',false,{dispatchOutcome:c.body.p_input.outcome}));
    case 'FAIL':return json(transfer('FAILED'));
    case 'READ':return json(options.read??{receipt:receipt('ABSENT')});
    case 'CANCEL':return json(options.cancel??transfer('CANCELLED'));
    case 'LIST':return json({accountId:account,agreementId:agreement,uploads:[receipt()],authoritative:true});
    default:assert.fail('UNEXPECTED_RPC_OPERATION');
   }
  }
  if(p==='/storage/v1/object/profile-media/'+path){if(init.method==='POST'){assert.equal(init.headers['x-upsert'],'false');assert.equal(createHash('sha256').update(init.body).digest('hex'),sha);return json({});}
   return new Response(new Uint8Array(clean.bytes),{headers:{'Content-Type':'image/jpeg'}});}
  assert.fail('UNEXPECTED_TRANSPORT');
 };
 const source=readFileSync('supabase/functions/uskoci-media/index.ts','utf8').replace("import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm')","'file:///unit-pinned-wasm'");
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const runtime={...magick,initializeImageMagick:async()=>undefined};
 new vm.Script(compiled).runInContext(vm.createContext({exports:{},require:name=>{if(name==='npm:@imagemagick/magick-wasm@0.0.43')return runtime;if(name==='../_shared/voiceM4a.mjs')return voice;if(name==='../_shared/mediaUploadAdmission.mjs')return admission;assert.equal(name,'../_shared/mediaImageSanitizer.mjs');return sanitizer;},
 Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,AbortController,crypto:webcrypto,setTimeout,clearTimeout,fetch,atob,
 Deno:{env:{get:n=>environment[n]},readFile:async()=>new Uint8Array(),serve:fn=>handler=fn}}));
 const invoke=(op='agreement-upload',body=new Uint8Array(original),headers={})=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer '+token(),'Content-Type':'image/png',
  'x-media-operation':op,'x-media-target':agreement,'x-media-version':'1','x-media-request-id':key,...headers},body}));
 const control=(op,body={agreementId:agreement,agreementVersion:1,clientRequestId:key})=>invoke(op,JSON.stringify(body),{'Content-Type':'application/json'});
 return{calls,invoke,control,read:()=>control('agreement-read',{agreementId:agreement,assetId:asset,messageId:message})};
}
const operations=f=>f.calls.filter(x=>x.path.endsWith('/rpc_agreement_photo_upload_service_v5')).map(x=>x.body.p_operation);
const posts=f=>f.calls.filter(x=>x.path.startsWith('/storage/')&&x.init.method==='POST');
test('one real sanitized private upload and exact readback, receipt contains no path or raw metadata',async()=>{
 const f=fixture(),r=await f.invoke();assert.equal(r.status,200);assert.deepEqual(await r.json(),receipt());assert.deepEqual(operations(f),['CLAIM','STAGE','DISPATCH','SETTLE']);assert.equal(posts(f).length,1);
 assert.ok(!Buffer.from(clean.bytes).includes(Buffer.from('PRIVATE_METADATA')));assert.equal(r.headers.get('cache-control'),'no-store');
});
test('known READY, PROCESSING and CANCELLED replay never reads original again or repeats Storage POST',async()=>{
 for(const state of ['READY','PROCESSING','CANCELLED']){const f=fixture({claim:transfer(state,state==='READY'?'SETTLED':'NOT_DISPATCHED')});assert.equal((await f.invoke()).status,200);assert.deepEqual(operations(f),['CLAIM']);assert.equal(posts(f).length,0);}
});
test('unknown staged recovery only verifies existing bytes and settles, never re-uploads',async()=>{
 const f=fixture({claim:transfer('STAGED','DISPATCHING')});assert.equal((await f.invoke()).status,200);assert.deepEqual(operations(f),['CLAIM','SETTLE']);assert.equal(posts(f).length,0);
});
test('restart exact-key read settles only positive original dispatch bytes without original image or upload retry',async()=>{
 const f=fixture({read:transfer('STAGED','DISPATCHING')});const r=await f.control('agreement-upload-read');assert.equal(r.status,200);assert.deepEqual(await r.json(),receipt());assert.deepEqual(operations(f),['READ','SETTLE']);assert.equal(posts(f).length,0);
 const missing=fixture({read:transfer('STAGED','DISPATCHING'),transport:c=>c.path.startsWith('/storage/')?json({},404):null});
 assert.deepEqual(await(await missing.control('agreement-upload-read')).json(),receipt('STAGED'));assert.deepEqual(operations(missing),['READ']);assert.equal(posts(missing).length,0);
});
test('ambiguous Storage write stays unknown without false settlement, refund or retry',async()=>{
 for(const throws of [true,false]){const f=fixture({transport:c=>{if(c.path.startsWith('/storage/')&&c.init.method==='POST'){if(throws)throw new Error('PRIVATE_TRANSPORT');return json({},500);}}});
  assert.equal((await f.invoke()).status,503);assert.equal(posts(f).length,1);assert.ok(!operations(f).includes('SETTLE'));}
});
test('cancel wins before dispatch or after actual store and the authoritative cancelled receipt survives',async()=>{
 const before=fixture({transport:c=>c.body?.p_operation==='STAGE'?json(transfer('CANCELLED')):null});assert.deepEqual(await(await before.invoke()).json(),receipt('CANCELLED'));assert.equal(posts(before).length,0);
 const after=fixture({transport:c=>c.body?.p_operation==='SETTLE'?json(transfer('CANCELLED','SETTLED',false,{path,sha256:sha,byteSize:clean.bytes.length})):null});
 assert.deepEqual(await(await after.invoke()).json(),receipt('CANCELLED'));assert.equal(posts(after).length,1);
});
test('explicit absence/cancel/list never sends an upload or message, and attached cancellation reports actual receipt',async()=>{
 const f=fixture();assert.deepEqual(await(await f.control('agreement-upload-read')).json(),receipt('ABSENT'));assert.deepEqual(await(await f.control('agreement-upload-cancel')).json(),receipt('CANCELLED'));
 assert.equal((await f.control('agreement-upload-list',{agreementId:agreement})).status,200);assert.equal(posts(f).length,0);assert.deepEqual(operations(f),['READ','CANCEL','LIST']);
 const a=fixture({cancel:transfer('READY','SETTLED',false,{receipt:receipt('READY',{attachedMessageId:message})})});assert.equal((await(await a.control('agreement-upload-cancel')).json()).attachedMessageId,message);
});
test('foreign receipt, mixed identity, extra property and unsafe path fail before any Storage IO',async()=>{
 for(const patch of [{receipt:receipt('READY',{accountId:id(99)})},{receipt:receipt('READY',{agreementVersion:2})},{receipt:{...receipt('READY'),secret:'PRIVATE'}},{path:'https://evil.invalid/image'}, {path:`${account}/v5/${asset}/${sha}.jpg`}]){
  const f=fixture({claim:transfer('READY','SETTLED',false,patch)});assert.equal((await f.invoke()).status,503);assert.ok(!f.calls.some(x=>x.path.startsWith('/storage/')));
 }
});
test('byte response reauthorizes exact historical message and withholds data after session or visibility revocation',async()=>{
 const good=fixture(),r=await good.read();assert.equal(r.status,200);assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),sha);
 assert.equal(good.calls.filter(x=>x.path.endsWith('/rpc_agreement_photo_read_service_v5')).length,2);
 let reads=0;const bad=fixture({transport:c=>c.path.endsWith('/rpc_agreement_photo_read_service_v5')&&++reads===2?json({message:'MEDIA_NOT_FOUND'},403):null});
 const denied=await bad.read();assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{code:'MEDIA_NOT_FOUND'});
});
test('wrong MIME/hash and extra read context cannot return pixels',async()=>{
 const mime=fixture({transport:c=>c.path.startsWith('/storage/')?new Response(new Uint8Array(clean.bytes),{headers:{'Content-Type':'image/png'}}):null});assert.equal((await mime.read()).status,503);
 const extra=fixture();assert.equal((await extra.control('agreement-read',{agreementId:agreement,assetId:asset,messageId:message,accountId:account})).status,400);assert.equal(extra.calls.length,1);
 const f=fixture();assert.equal((await f.invoke('agreement-upload',new Uint8Array(original),{Authorization:'Bearer '+token({session_id:null})})).status,401);assert.equal(f.calls.length,1);
});
test('actual decoder failure records FAILED before any stage, and server safety rate denial creates no Storage cost',async()=>{
 const f=fixture();assert.equal((await f.invoke('agreement-upload',new TextEncoder().encode('not an image'))).status,400);assert.deepEqual(operations(f),['CLAIM','FAIL']);assert.equal(posts(f).length,0);
 const rate=fixture({transport:c=>c.body?.p_operation==='CLAIM'?json({message:'MEDIA_RATE_LIMITED'},429):null});assert.equal((await rate.invoke()).status,429);assert.equal(posts(rate).length,0);
});
