import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { runTools, toolsConfiguration } from './dev_taxonomy_tools_acceptance.mjs';
import { confirmedAssistantEvidence, expectedProviderOperations, MILOS } from './dev_taxonomy_fulltree_acceptance.mjs';

test('tools acceptance defaults to two single-turn conversations and reserves up to four model attempts per turn without I/O', async () => {
  const before=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('DRY_RUN_MUST_NOT_AUTHENTICATE_OR_CALL_PROVIDER');
  try {
    const result=await runTools({},[]);
    assert.equal(result.result,'DRY_RUN_NO_IO');assert.equal(result.phase,'conversation');
    assert.deepEqual(result.names,['need-existing-tools','worker-existing-tools']);
    assert.ok(result.cases.every(c=>c.messages.length===1));
    assert.equal(result.providerAttemptsPerRequest,4);assert.equal(result.maxAttempts,3);
    assert.equal(result.maxReservationMicrousd,3_000_000);
  } finally {globalThis.fetch=before;}
});

test('tools entry rejects Save, more than three logical requests and the excluded active owner before I/O', () => {
  assert.throws(()=>toolsConfiguration({},['--execute','--phase=save-fixture']),/NO_SAVE/);
  assert.throws(()=>toolsConfiguration({USKOCI_QA_SAVE_CASES:'need-existing-tools'},[]),/NO_SAVE/);
  assert.throws(()=>toolsConfiguration({USKOCI_QA_MAX_ATTEMPTS:'4'},[]),/MAX_3/);
  assert.throws(()=>toolsConfiguration({USKOCI_QA_CASES:'need-existing,worker-existing'},[]),/TOOLS_CASES/);
  assert.throws(()=>toolsConfiguration({USKOCI_QA_EXPECTED_ACCOUNT_ID:MILOS},['--execute']),/ISOLATED_EXPECTED_ACCOUNT/);
});

test('one rare-service observation is capped at one logical turn/four attempts and does not require invented novelty', async () => {
  const result=await runTools({USKOCI_QA_CASES:'need-rare-tools',USKOCI_QA_MAX_ATTEMPTS:'1'},[]);
  assert.equal(result.cases.length,1);assert.equal(result.cases[0].messages.length,1);
  assert.equal(result.cases[0].expectation,'SEMANTIC_REVIEW_NO_FORCED_NOVELTY');
  assert.match(result.cases[0].messages[0],/restauracija stare mehaničke muzičke kutije/);
  assert.equal(result.maxLogicalRequests,1);assert.equal(result.maxProviderAttempts,4);
  assert.equal(result.maxReservationMicrousd,1_000_000);
});

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const identity={accountId:id(1),conversationId:id(2),clientRequestId:id(3)};
const confirmed={conversationId:id(2),clientRequestId:id(3),turnId:id(4),state:'SUCCEEDED',
  receipt:{assistantMessageId:id(5),authoritative:true}};

test('successful owned JSON reply records text directly when the response supplies it', () => {
  const value={...confirmed,assistantMessage:'Predlog je u nacrtu.'};
  const evidence=confirmedAssistantEvidence({value,raw:JSON.stringify(value)},identity,confirmed);
  assert.equal(evidence.assistantText,value.assistantMessage);assert.equal(evidence.assistantTextSource,'JSON_CONFIRMED');
  assert.equal(evidence.responseFormat,'JSON');assert.deepEqual(evidence.eventKinds,[]);
});

test('receipt-only V2 JSON reads the exact owned assistant message and rejects unrelated account/conversation/message', () => {
  const response={value:confirmed,raw:JSON.stringify(confirmed)};
  assert.equal(confirmedAssistantEvidence(response,identity,confirmed).assistantTextSource,'UNAVAILABLE');
  const row={id:id(5),account_id:id(1),conversation_id:id(2),role:'ASSISTANT',body:'Potvrđeni odgovor iz razgovora.'};
  const evidence=confirmedAssistantEvidence(response,identity,confirmed,[row]);
  assert.equal(evidence.assistantText,row.body);assert.equal(evidence.assistantTextSource,'OWNED_MESSAGE_READBACK');
  for(const patch of [{id:id(9)},{account_id:id(9)},{conversation_id:id(9)},{role:'USER'}])
    assert.throws(()=>confirmedAssistantEvidence(response,identity,confirmed,[{...row,...patch}]),/OWNER_MISMATCH/);
  assert.throws(()=>confirmedAssistantEvidence({value:{...confirmed,clientRequestId:id(9)},raw:'{}'},identity,confirmed,[row]),/JSON_TURN_IDENTITY/);
});

test('SSE keeps owned IDs, sequence, final confirmation and assistant text checks', () => {
  const events=['accepted','text_delta','final'].map((kind,index)=>({...identity,turnId:id(4),attemptId:id(6),sequence:index+1,kind,
    ...(kind==='text_delta'?{text:'Odgovor kroz stream.'}:{}),...(kind==='final'?{turn:confirmed}:{})}));
  const response=list=>({value:null,raw:list.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')});
  const evidence=confirmedAssistantEvidence(response(events),identity,confirmed);
  assert.equal(evidence.assistantText,'Odgovor kroz stream.');assert.equal(evidence.assistantTextSource,'SSE_CONFIRMED');
  assert.equal(evidence.responseFormat,'SSE');assert.deepEqual(evidence.eventKinds,['accepted','text_delta','final']);
  assert.throws(()=>confirmedAssistantEvidence(response(events.map((event,index)=>index===1?{...event,conversationId:id(9)}:event)),identity,confirmed),/SSE_IDENTITY/);
  assert.equal(confirmedAssistantEvidence(response(events.slice(0,2)),identity,confirmed).assistantTextSource,'UNAVAILABLE',
    'a partial visible prefix cannot masquerade as the confirmed complete answer');
});

test('observer operation IDs exactly match production deterministic round identities and change with owner/conversation', async () => {
  const source=ts.transpileModule(readFileSync(new URL('../../supabase/functions/_shared/taxonomyProviderBudget.ts',import.meta.url),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  });
  const context=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout});
  const require=name=>{assert.equal(name,'./aiTestBudget.ts');return {reserveAiTestBudget:()=>assert.fail('NO_RESERVATION_IN_ID_TEST')};};
  const api=new vm.Script(`(function(exports,require){${source.outputText};return exports;})`).runInContext(context)({},require);
  const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
  const operations=expectedProviderOperations(id(1),id(2),id(3));
  for(const item of operations)assert.equal(item.operationId,await api.taxonomyRoundOperationId(id(1),id(2),id(3),item.attempt));
  assert.equal(operations[0].operationId,id(3));assert.equal(new Set(operations.map(item=>item.operationId)).size,4);
  assert.notEqual(operations[1].operationId,expectedProviderOperations(id(9),id(2),id(3))[1].operationId);
  assert.notEqual(operations[1].operationId,expectedProviderOperations(id(1),id(9),id(3))[1].operationId);
});
