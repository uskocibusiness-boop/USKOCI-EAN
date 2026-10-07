// DISCOVERY-GRAD: bring the disposable chain to the DEV state of the Discovery reader, loopback only.
// supabase/proofs/match-v1/chain.mjs + fidelity.mjs replay the chain to the DEV state BEFORE ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE
// (23 relevant bodies equal to DEV). This script applies those three packages with their exact candidate files in canonical DEV
// order (ledger 228 / 231 / 232; CANCEL-INFO 229 and PROFILE-TRUST 230 add functions Discovery never calls and are not replayed),
// then admits ONLY the exact DEV bodies DISCOVERY-GRAD replaces or relies on (md5 read read-only on canonical DEV 2026-10-08).
// Bounded relevant-body fidelity, never global DEV equivalence. Never connects to DEV.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assert, sql, rows, q, env} from '../pre_v3/closure_runtime.mjs';

const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const out = env.DISCOVERY_GRAD_ARTIFACT_DIR;
assert.ok(out);
fs.mkdirSync(out, {recursive: true});
const sha256 = text => createHash('sha256').update(text).digest('hex');
const G = JSON.parse(fs.readFileSync('supabase/candidates/discovery-grad-20261008/manifest.json', 'utf8'));
// The DEV application receipts (supabase/operations/dev-alpha/ledger/20261007_*_application.receipt.json on integration/spoj-20261006) record
// these package files: the revert.sql and postflight.readonly.sql sha256 of each receipt equal the files below.
const PACKAGES = [
  ['zone-perf', 'supabase/candidates/zone-perf-20261007/', '98288b1d377722d761b20c091f6dbfa850a40114a9b087b36c7c48f8515efab2'],
  ['match-v1', 'supabase/candidates/match-v1-20261007/', 'e850897851f7609f1283f56e36ff6f11263a7f4c697c84c150a5018cf2dbb4e0'],
  ['discovery-zamene', 'supabase/candidates/discovery-zamene-20261007/', '554faa74f2149d8624e0f867464e19e9be55bd4778ff1169f7909f969f7fbbb1'],
];
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  private.retention_ai_source_ready() as ready`)[0];
const md5Of = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
const before = closure();
assert.equal(before.ready, true);
const applied = [];
for (const [name, dir, expected] of PACKAGES) {
  const text = fs.readFileSync(dir + 'candidate.sql', 'utf8');
  const actual = sha256(text);
  // the whole-file sha256 is the identity of what DEV received (the manifest of each package records it too)
  if (actual !== expected) throw new Error('PREDECESSOR_FILE_DRIFT ' + name + ' ' + actual);
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', dir + 'candidate.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  applied.push({name, sha256: actual});
  console.log('PASS predecessor ' + name + ' applied');
}
const pins = [
  {signature: G.functions[0].signature, devMd5: G.functions[0].before_md5, role: 'REPLACED (the DISCOVERY-ZAMENE postimage = DEV)'},
  ...G.dependencyPins.map(p => ({signature: p.signature, devMd5: p.body_md5, role: 'CALLED BY THE NEW BODY'})),
];
const mismatched = pins.map(p => ({...p, chainMd5: md5Of(p.signature)})).filter(p => p.chainMd5 !== p.devMd5);
// Informational: the other helpers the reader calls unchanged (DEV values of 2026-10-08), named so a difference is visible, never admitted silently.
const observed = Object.fromEntries([
  ['public.p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone)', 'e1c81ce573875504d60e025c07573ee6'],
  ['public.p6_discovery_civil(text)', 'cee687f43419dfb2fa9cc9233e8bea34'],
  ['public.covered_slots(public.needs)', 'ac09f84c85ff8ae237c8db463a43d547'],
  ['private.worker_need_match_v1(uuid,uuid)', 'ef94ef7de07a347824ace68789f08c41'],
].map(([signature, devMd5]) => [signature, {devMd5, chainMd5: md5Of(signature), equal: md5Of(signature) === devMd5}]));
const after = closure();
const report = {result: mismatched.length ? 'FAIL' : 'PASS', applied, pins: pins.length, mismatched, observed,
  certificateUnchanged: JSON.stringify(after) === JSON.stringify(before), certificate: after,
  scope: 'ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE applied with their DEV files on the chain whose 23 relevant bodies equal DEV (fidelity.mjs); '
    + 'then the reader and the 6 bodies DISCOVERY-GRAD calls equal the DEV md5. Not global DEV equivalence.'};
fs.writeFileSync(path.join(out, 'predecessor-fidelity.json'), JSON.stringify(report, null, 2) + '\n');
assert.equal(report.certificateUnchanged, true);
if (mismatched.length) { console.error('FAIL DISCOVERY_GRAD_PREDECESSOR_FIDELITY ' + JSON.stringify(mismatched)); process.exit(1); }
console.log(`PASS DISCOVERY_GRAD_PREDECESSOR_FIDELITY reader + ${pins.length - 1} dependencies equal DEV; observed ${JSON.stringify(Object.fromEntries(Object.entries(observed).map(([k, v]) => [k, v.equal])))}`);
