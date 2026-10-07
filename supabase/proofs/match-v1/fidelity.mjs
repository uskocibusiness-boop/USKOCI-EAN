// Disposable only: every body MATCH-V1 and DISCOVERY-ZAMENE replace or rely on must equal the captured DEV body.
// The only admitted repair is the exact B24 conversion of a deterministic conflict literal ('40001' -> 'PT409') that
// canonical DEV carries and the historical replay does not (same rule as WPP01 prepare-chain.mjs). Anything else fails
// and is listed. Never connects to DEV. Bounded relevant-body fidelity, not global DEV equivalence.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assert, sql, rows, q, env} from '../pre_v3/closure_runtime.mjs';

const md5 = s => createHash('md5').update(s).digest('hex');
const live = new Map();
for (const dir of ['supabase/candidates/match-v1-20261007/', 'supabase/candidates/discovery-zamene-20261007/']) {
  for (const row of JSON.parse(fs.readFileSync(dir + 'live-functions.json', 'utf8'))) {
    assert.equal(md5(row.body), row.body_md5);
    live.set(row.signature, row.body);
  }
}
const closure = () => rows("select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,private.retention_ai_source_ready() as ready")[0];
const before = closure();
assert.equal(before.ready, true);
const converted = [], mismatched = [], exact = [];
for (const [signature, expected] of live) {
  const row = rows(`select prosrc,pg_get_functiondef(oid) as definition,to_jsonb(p)-'prosrc' as metadata from pg_proc p where oid=to_regprocedure(${q(signature)})`)[0];
  if (!row) { mismatched.push({signature, reason: 'MISSING'}); continue; }
  if (md5(row.prosrc) === md5(expected)) { exact.push(signature); continue; }
  const preimage = expected.replaceAll("'PT409'", "'40001'");
  if (preimage === expected || row.prosrc !== preimage) {
    mismatched.push({signature, reason: 'BODY_DRIFT', chainMd5: md5(row.prosrc), devMd5: md5(expected)});
    continue;
  }
  sql(row.definition.replaceAll("'40001'", "'PT409'"));
  const now = rows(`select prosrc,to_jsonb(p)-'prosrc' as metadata from pg_proc p where oid=to_regprocedure(${q(signature)})`)[0];
  assert.equal(now.prosrc, expected);
  assert.deepEqual(now.metadata, row.metadata);
  converted.push(signature);
}
const report = {result: mismatched.length ? 'FAIL' : 'PASS', relevantLiveBodyPins: live.size, exact: exact.length, converted, mismatched,
  certificateUnchanged: JSON.stringify(closure()) === JSON.stringify(before),
  scope: 'Exact relevant DEV bodies (MATCH-V1 5 changed + 17 dependencies, DISCOVERY-ZAMENE 1) on the disposable chain. Not global DEV equivalence.'};
fs.writeFileSync(path.join(env.MATCH_V1_ARTIFACT_DIR, 'chain-fidelity.json'), JSON.stringify(report, null, 2) + '\n');
assert.equal(report.certificateUnchanged, true);
if (mismatched.length) { console.error('FAIL MATCH_V1_RELEVANT_BODY_FIDELITY ' + JSON.stringify(mismatched)); process.exit(1); }
console.log(`PASS MATCH_V1_RELEVANT_BODY_FIDELITY ${live.size} pins (${converted.length} exact B24 conversions)`);
