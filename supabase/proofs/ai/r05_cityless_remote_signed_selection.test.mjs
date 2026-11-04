import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source/guard proof for the candidate; live behavior is verified separately
// by transactional DEV synthetic requester→worker→agreement readback.
const sql=readFileSync(new URL('../../migrations/20261104190000_r05_cityless_remote_signed_selection.sql',import.meta.url),'utf8');
const cases=sql.match(/CREATE OR REPLACE FUNCTION private\.need_candidate_states_v5\(/g)??[];
test('both existing candidate selection overloads retain strict hash-protected replacement',()=>{
  assert.equal(cases.length,2);
  assert.match(sql,/f87f872758b5caa618ab96864fe96ade/);
  assert.match(sql,/2c8b6e1d1344991a9d696a39f60e8d3a/);
  assert.match(sql,/R05_CITYLESS_REMOTE_PREIMAGE_DRIFT/);
});
test('a cityless worker can be selectable only for a signed REMOTE-only capability',()=>{
  const condition=/char_length\(btrim\(coalesce\(c\.city,''\)\)\)<2\s+and not \(n\.execution_location_mode='REMOTE'\s+and private\.worker_remote_only_activation_ready_v1\(c\.worker_account_id,c\.skills\) IS TRUE\)/g;
  assert.equal((sql.match(condition)??[]).length,2);
  assert.equal((sql.match(/and c\.profile_status is distinct from 'ACTIVE'/g)??[]).length,0);
  assert.equal((sql.match(/c\.profile_status is distinct from 'ACTIVE'/g)??[]).length,2);
  assert.equal((sql.match(/c\.profile_account is distinct from c\.worker_account_id/g)??[]).length,2);
  assert.equal((sql.match(/private\.match_detail_for_calendar_interval/g)??[]).length,2);
  assert.equal((sql.match(/private\.assert_application_price_v5/g)??[]).length,2);
});
test('candidate parity does not introduce grants, ignored owner, implicit activation or side effects',()=>{
  for(const forbidden of [/\bGRANT\b/i,/\bDISABLE TRIGGER\b/i,/\bALTER TABLE\b/i,/\bDELETE FROM\b/i,/\bDROP TABLE\b/i,/\bnet\.http_post\b/i]){
    assert.doesNotMatch(sql,forbidden);
  }
  assert.equal((sql.match(/STABLE SECURITY DEFINER/g)??[]).length,2);
  assert.equal((sql.match(/SET search_path TO 'pg_catalog'/g)??[]).length,2);
});
