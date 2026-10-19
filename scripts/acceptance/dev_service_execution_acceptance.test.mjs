import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,run,MILOS} from './dev_taxonomy_fulltree_acceptance.mjs';

const env={USKOCI_QA_CASES:'need-pickup-execution,need-shipping-execution,need-digital-execution,need-impossible-execution,need-rare-execution,worker-shipping-execution',USKOCI_QA_MAX_ATTEMPTS:'6'};
test('execution QA is dry by default and accounts for every possible tool round',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>assert.fail('DRY_RUN_NETWORK');
 try{const result=await run(env,[]);assert.equal(result.result,'DRY_RUN_NO_IO');
  assert.equal(result.maxLogicalRequests,6);assert.equal(result.maxProviderAttempts,24);
  assert.equal(result.maxReservationMicrousd,6_000_000);assert.equal(result.cases.length,6);
 }finally{globalThis.fetch=previous;}
});
test('execution QA rejects an unbounded run, mixed fixtures and the real owner',()=>{
 assert.throws(()=>configuration({...env,USKOCI_QA_MAX_ATTEMPTS:'9'},[]),/EXECUTION_MAX_8/);
 assert.throws(()=>configuration({...env,USKOCI_QA_CASES:'need-pickup-execution,need-existing'},[]),/EXECUTION_MAX_8/);
 assert.throws(()=>configuration({...env,USKOCI_QA_EXPECTED_ACCOUNT_ID:MILOS},['--execute']),/ISOLATED_EXPECTED_ACCOUNT/);
});
