// Current single-response transport through both real handlers. Historical second
// provider JSON/content-length tests are retained as text in fixtures/retired-*.
// SSE completion, bounded bytes, cancellation and no paid retry remain active.
import test from 'node:test';
import assert from 'node:assert/strict';
import {singlePassFixture as fixture} from './single_pass_edge_fixture.mjs';
const encoder=new TextEncoder(),headers={'Content-Type':'text/event-stream'};
const providers=f=>f.calls.filter(c=>c.url.includes('generativelanguage.googleapis.com'));
const atomic=f=>f.calls.filter(c=>c.name.includes('with_first_plan_service'));
const wire=(output,finish='STOP')=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:finish}]})+'\n\n';
const chunks=bytes=>new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=4093)c.enqueue(bytes.slice(i,i+4093));c.close();}});
for(const kind of ['NEED','WORKER']){
 test(kind+' complete split UTF8 and multiple text parts ignore private thoughts',async()=>{
  const f=fixture(kind,{provider:({output})=>{
   output.assistantMessage='Čujem Vas 💡.';const text=JSON.stringify(output),middle=Math.floor(text.length/2);
   const data='data: '+JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:text.slice(0,middle)},
    {thought:true,text:'PRIVATE_THOUGHT'},{text:text.slice(middle)}]}}]})+'\n\n';
   const bytes=encoder.encode(data);let i=0;
   return new Response(new ReadableStream({pull(c){if(i===bytes.length)c.close();else c.enqueue(bytes.slice(i,++i));}}),{headers});
  }});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,1);
  assert.equal(providers(f).length,1);assert.ok(!JSON.stringify(events).includes('PRIVATE_THOUGHT'));
 });
 for(const extra of [0,1])test(kind+' decoded SSE byte boundary '+extra,async()=>{
  const f=fixture(kind,{provider:({output})=>{
   const last=encoder.encode(wire(output)),n=524288+extra-last.length;
   // One comment plus a valid event: the bound concerns bytes, not JSON size.
   const bytes=encoder.encode(':'+ 'x'.repeat(n-3)+'\n\n'+new TextDecoder().decode(last));
   assert.equal(bytes.length,524288+extra);
   // Keep comment frames bounded as in a real event stream.
   for(let i=8192;i<n-3;i+=8192){bytes[i]=10;bytes[i+1]=10;bytes[i+2]=58;}
   return new Response(chunks(bytes),{headers});
  }});
  const events=await f.invoke();assert.equal(atomic(f).length,extra?0:1);
  assert.equal(events.at(-1).kind,extra?'safe_error':'final');assert.equal(providers(f).length,1);
 });
 for(const [label,make] of [
  ['missing STOP',output=>new Response(wire(output,undefined).replace(',"finishReason":"STOP"',''),{headers})],
  ['empty STOP',output=>new Response(wire(output,''),{headers})],
  ['MAX_TOKENS',output=>new Response(wire(output,'MAX_TOKENS'),{headers})],
  ['invalid UTF8',()=>new Response(Uint8Array.from([100,97,116,97,58,32,255,10,10]),{headers})],
  ['truncated event JSON',output=>new Response(wire(output).slice(0,-5),{headers})],
  ['broken body',()=>new Response(new ReadableStream({start(c){c.error(new Error('PRIVATE_BODY_ERROR'));}}),{headers})],
  ['wrong media type',output=>new Response(wire(output),{headers:{'Content-Type':'application/json'}})],
  ['HTTP 429',()=>new Response('PRIVATE_PROVIDER_ERROR',{status:429})],
  ['HTTP 403',()=>new Response('PRIVATE_PROVIDER_ERROR',{status:403})],
 ])test(kind+' '+label+' cannot complete or trigger another paid request',async()=>{
  const f=fixture(kind,{provider:({output})=>make(output)}),events=await f.invoke();
  assert.equal(events.at(-1).kind,'safe_error');assert.equal(atomic(f).length,0);assert.equal(providers(f).length,1);
  assert.ok(!events.some(e=>e.kind==='text_delta'||e.kind==='final'));
  assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_'));
 });
 test(kind+' provider refusal cannot create catalog authority',async()=>{
  const f=fixture(kind,{provider:({output})=>new Response(wire(output,'SAFETY'),{headers})});
  await f.invoke();assert.equal(atomic(f).length,0);assert.equal(providers(f).length,1);
 });
}
