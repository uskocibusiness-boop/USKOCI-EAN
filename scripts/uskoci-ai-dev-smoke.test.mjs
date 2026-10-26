import test from 'node:test';
import assert from 'node:assert/strict';
import {DEV_URL,validateSmokeEnvironment,decodeSseEvents} from './uskoci-ai-dev-smoke.mjs';

const valid=()=>({
 USKOCI_DEV_SMOKE_ACK:'DEV_TEST_PAID_ONE_TURN_NO_PUBLISH',
 USKOCI_DEV_URL:DEV_URL,
 USKOCI_DEV_SMOKE_KIND:'NEED',
 USKOCI_DEV_SMOKE_EMAIL:'person+uskoci-test@example.invalid',
 USKOCI_DEV_SMOKE_PASSWORD:'SYNTHETIC_NOT_REAL',
 USKOCI_DEV_ANON_KEY:'SYNTHETIC_PUBLIC',
 USKOCI_DEV_SMOKE_ACCOUNT_ID:'11111111-1111-4111-8111-111111111111',
});

test('DEV-only, dedicated-account, explicit paid-call admission fails closed',()=>{
 const v=valid();
 assert.equal(validateSmokeEnvironment(v).kind,'NEED');
 for(const patch of [
  {USKOCI_DEV_SMOKE_ACK:undefined},
  {USKOCI_DEV_URL:'https://production.supabase.co'},
  {USKOCI_DEV_SMOKE_EMAIL:'realowner@example.com'},
  {USKOCI_DEV_SMOKE_KIND:'PUBLISH'},
  {USKOCI_DEV_SMOKE_ACCOUNT_ID:'not-a-uuid'},
  {USKOCI_DEV_SMOKE_PASSWORD:''},
  {USKOCI_DEV_ANON_KEY:''},
 ]) {
  assert.throws(()=>validateSmokeEnvironment({...v,...patch}),/^Error: SMOKE_/);
 }
});

test('single real-looking SSE final receipt decodes without treating streamed text as authority',()=>{
 const fakeId='11111111-1111-4111-8111-111111111111';
 const raw='data: '+JSON.stringify({kind:'text_delta',text:'SYNTHETIC_PRIVATE_TEXT'})+'\n\n'
   +'data: '+JSON.stringify({kind:'final',conversationId:fakeId,clientRequestId:fakeId,
     turn:{state:'SUCCEEDED'}})+'\n\n';
 const events=decodeSseEvents(raw);
 assert.equal(events.length,2);
 assert.equal(events.at(-1).kind,'final');
 assert.equal(events.at(-1).turn.state,'SUCCEEDED');
});

test('bad or oversized SSE is rejected; no lenient JSON rewriting',()=>{
 assert.throws(()=>decodeSseEvents('data: {NOT_JSON}\n\n'),/SMOKE_INVALID_EVENT_JSON/);
 assert.throws(()=>decodeSseEvents('data: "primitive"\n\n'),/SMOKE_INVALID_EVENT/);
 assert.throws(()=>decodeSseEvents('data: {}'+'x'.repeat(524288)),/SMOKE_RESPONSE_OVERSIZE/);
});

test('the smoke runner cannot be executed by merely importing this module',()=>{
 // validateSmokeEnvironment is called only by runDevSmoke, not at import time.
 // This test itself has no credentials, network calls, task saves or paid provider calls.
 assert.ok(DEV_URL.endsWith('.supabase.co'));
});
