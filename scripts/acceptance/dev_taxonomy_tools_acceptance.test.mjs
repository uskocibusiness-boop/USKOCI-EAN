import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { runTools, toolsConfiguration } from './dev_taxonomy_tools_acceptance.mjs';
import { expectedProviderOperations, MILOS } from './dev_taxonomy_fulltree_acceptance.mjs';

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
