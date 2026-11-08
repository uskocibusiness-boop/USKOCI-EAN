'use strict';
// Actual media client, receipt owner and binary transport with a deterministic
// clock and inert fetch/Auth. No network calls, real sleeps or native claims.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHarness,deferred}=require('./ux-component-harness.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function clock(){
 let now=0,next=0;const jobs=new Map();
 const module=name=>({setTimeout:(fn,ms)=>{const token=++next;jobs.set(token,{name,fn,at:now+ms});return token;},clearTimeout:token=>jobs.delete(token)});
 return{module,jobs,advance:async ms=>{
  const until=now+ms;
  for(;;){const due=[...jobs].filter(([,job])=>job.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;
   now=due[1].at;jobs.delete(due[0]);due[1].fn();await flush();}
  now=until;await flush();
 }};
}
function fixture({holdAuth=false,direct=false}={}){
 const time=clock(),response=deferred(),body=deferred(),auth=deferred(),calls=[];
 const session={user:{id:id(1)},accountRevision:1},token={data:{session:{user:{id:id(1)},access_token:'fixture-token'}},error:null};
 const nativeFetch=global.fetch,url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
 process.env.EXPO_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='fixture-publishable-key';
 global.fetch=async(url,options)=>{assert.equal(url,'https://fixture.invalid/functions/v1/uskoci-media');calls.push(options);return response.promise;};
 const h=createHarness({'src/store/sesija.ts':{sesijaSada:()=>session},'src/data/supabaseClient.ts':{supabaseKlijent:()=>({auth:{getSession:()=>holdAuth?auth.promise:Promise.resolve(token)}})}},
  {'src/data/serverReceipt.ts':time.module('owner'),'src/data/mediaBinaryRead.ts':time.module('binary')});
 const data=new Uint8Array([255,216,255,217]).buffer;
 let settled=false,answer;
 const request=context=>{
  const promise=direct?h.load('src/data/mediaBinaryRead.ts').readMediaBinary({account:{accountId:id(1),accountRevision:1},body:{assetId:id(3),agreementId:id(2)},operation:'agreement-read',signal:context.signal})
   :h.load('src/data/mediaClientService.ts').mediaClientService.readMedia(id(3),context.context??{agreementId:id(2),messageId:id(4)},{signal:context.signal});
  promise.then(result=>{settled=true;answer=result;});return promise;
 };
 return{time,calls,session,request,get settled(){return settled;},get answer(){return answer;},
  authorize:async()=>{auth.resolve(token);await flush();},
  headers:async()=>{const r=new Response(data,{headers:{'Content-Type':'image/jpeg','Content-Length':'4'}});r.arrayBuffer=()=>body.promise;response.resolve(r);await flush();},
  bytes:async()=>{body.resolve(data);await flush();},
  close(){global.fetch=nativeFetch;if(url===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=url;if(key===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=key;},
 };
}
for(const ms of [16000,25000,29000])test(`authorized photo can finish after ${ms/1000}s within its 30s owner budget`,async()=>{
 const f=fixture();try{
  const pending=f.request({});await flush();await f.headers();await f.time.advance(ms);
  assert.equal(f.settled,false,'binary transport must not expire at the old 15s deadline');assert.equal(f.calls[0].signal.aborted,false);
  await f.bytes();const result=await pending;assert.equal(result.ok,true);assert.equal(result.podatak.bytes.byteLength,4);assert.equal(f.calls.length,1);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('one deadline includes Auth, fetch headers and body, without resetting at each stage',async()=>{
 const f=fixture({holdAuth:true});try{
  const pending=f.request({});await f.time.advance(5000);assert.equal(f.calls.length,0);await f.authorize();assert.equal(f.calls.length,1);
  await f.time.advance(11000);assert.equal(f.settled,false);await f.headers();await f.time.advance(13000);assert.equal(f.settled,false);
  await f.bytes();assert.equal((await pending).ok,true);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('at 30s an unfinished image body aborts transport and a late success cannot replace failure',async()=>{
 const f=fixture();try{
  const pending=f.request({});await flush();await f.headers();await f.time.advance(29999);assert.equal(f.settled,false);
  await f.time.advance(1);const result=await pending;assert.equal(result.ok,false);assert.equal(result.kod,'MEDIA_UNAVAILABLE');assert.equal(f.calls[0].signal.aborted,true);
  await f.bytes();assert.equal(f.answer,result);assert.equal(f.calls.length,1);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('Auth shares the 30s bound and cannot dispatch fetch after the owner times out',async()=>{
 const f=fixture({holdAuth:true});try{
  const pending=f.request({});await f.time.advance(29999);assert.equal(f.settled,false);await f.time.advance(1);
  assert.equal((await pending).ok,false);await f.authorize();assert.equal(f.calls.length,0);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('standalone binary boundary also allows 29s and bounds a stalled body at 30s',async()=>{
 const f=fixture({direct:true});try{
  const pending=f.request({});await flush();await f.headers();await f.time.advance(29000);assert.equal(f.settled,false);
  await f.time.advance(1000);const result=await pending;assert.equal(result.data,null);assert.equal(result.error.message,'MEDIA_UNAVAILABLE');assert.equal(f.calls[0].signal.aborted,true);
  await f.bytes();assert.equal(f.answer,result);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('external cancellation still aborts both boundaries immediately, without replay',async()=>{
 const f=fixture(),abort=new AbortController();try{
  const pending=f.request({signal:abort.signal});await flush();await f.headers();await f.time.advance(1);abort.abort();
  assert.equal((await pending).ok,false);assert.equal(f.calls[0].signal.aborted,true);await f.bytes();assert.equal(f.calls.length,1);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
test('a late A-to-B-to-A session response cannot publish the original private photo',async()=>{
 const f=fixture();try{
  const pending=f.request({});await flush();await f.headers();await f.time.advance(25000);assert.equal(f.settled,false);
  f.session.accountRevision=3;await f.bytes();const result=await pending;
  assert.equal(result.ok,false);assert.equal(result.kod,'AUTH_ACCOUNT_CHANGED');assert.equal(f.calls.length,1);assert.equal(f.time.jobs.size,0);
 }finally{f.close();}
});
