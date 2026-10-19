import test from 'node:test';
import assert from 'node:assert/strict';
import {measureAiPhase} from '../../functions/_shared/aiPhaseTiming.mjs';

test('phase telemetry preserves results/errors and cannot emit user content',async()=>{
 const original=console.info, logs=[];console.info=(...args)=>logs.push(args);
 try {
  const result={private:'PRIVATE_RESPONSE'}, failure=new Error('PRIVATE_ERROR');
  let calls=0;
  assert.equal(await measureAiPhase('PROVIDER',async()=>{calls++;return result;}),result);
  await assert.rejects(measureAiPhase('PRIVATE_PROMPT',async()=>{calls++;throw failure;}),error=>error===failure);
  assert.equal(calls,2);assert.equal(logs.length,2);
  assert.deepEqual(logs.map(x=>[x[0],x[1],x[3]]),[
   ['AI_PHASE_MS','PROVIDER','SUCCEEDED'],['AI_PHASE_MS','UNKNOWN','FAILED']]);
  assert.ok(logs.every(x=>Number.isFinite(x[2])&&x[2]>=0));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  console.info=()=>{throw Error('LOGGER_DOWN');};
  assert.equal(await measureAiPhase('ACCOUNTING',async()=>result),result);
  await assert.rejects(measureAiPhase('ACCOUNTING',async()=>{throw failure;}),error=>error===failure);
 } finally {console.info=original;}
});
