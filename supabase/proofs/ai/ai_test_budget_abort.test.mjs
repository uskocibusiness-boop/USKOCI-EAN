// Real R06 budget module; all transports are synthetic and never touch Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveAiTestBudget } from '../../functions/_shared/aiTestBudget.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const options = (signal) => ({supabaseUrl:'https://budget.invalid',
  serviceRoleKey:'SYNTHETIC_SERVICE_ROLE',accountId:id,operationId:requestId,kind:'LLM',signal});
const receipt = {admitted:true,reservationId:'33333333-3333-4333-8333-333333333333',
  replay:false,code:'AI_TEST_RESERVED'};

test('R06 already-aborted caller refuses a reservation before any HTTP request',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('unexpected network');});
  const controller=new AbortController();controller.abort();
  await assert.rejects(reserveAiTestBudget(options(controller.signal)),/AI_TEST_BUDGET_UNAVAILABLE/);
  assert.equal(calls,0);
});

test('R06 caller abort interrupts a noncooperative reservation fetch (no retry)',{timeout:1500},async t=>{
  let calls=0,signal;
  t.mock.method(globalThis,'fetch',async (_url,init)=>{
    calls++;signal=init.signal;
    return new Promise(()=>{}); // deliberately ignores passed AbortSignal
  });
  const controller=new AbortController();
  const task=reserveAiTestBudget(options(controller.signal));
  const timer=setTimeout(()=>controller.abort(),10);
  try{await assert.rejects(task,/AI_TEST_BUDGET_UNAVAILABLE/);}
  finally{clearTimeout(timer);}
  assert.equal(calls,1);
  assert.equal(signal.aborted,true);
});

test('R06 caller abort interrupts a stalled response body that ignores cancellation',{timeout:1500},async t=>{
  let calls=0,cancelled=false;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    calls++;
    assert.equal(init.method,'POST');
    return new Response(new ReadableStream({
      pull:()=>new Promise(()=>{}),
      cancel(){cancelled=true;},
    }),{headers:{'content-type':'application/json'}});
  });
  const controller=new AbortController();
  const task=reserveAiTestBudget(options(controller.signal));
  const timer=setTimeout(()=>controller.abort(),10);
  try{await assert.rejects(task,/AI_TEST_BUDGET_UNAVAILABLE/);}
  finally{clearTimeout(timer);}
  assert.equal(calls,1);
  assert.equal(cancelled,true,'unread body is also cancelled best-effort');
});

test('R06 complete valid budget receipt still admits exactly one reservation',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    calls++;
    assert.match(url,/\/rpc_ai_test_budget_reserve_service$/);
    assert.equal(init.method,'POST');
    assert.equal(init.redirect,'error');
    assert.equal(JSON.parse(init.body).p_kind,'LLM');
    return new Response(JSON.stringify(receipt),{headers:{'content-type':'application/json'}});
  });
  const controller=new AbortController();
  const result=await reserveAiTestBudget(options(controller.signal));
  assert.deepEqual(result,receipt);
  assert.equal(calls,1);
});

