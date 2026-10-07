// MATCH-V1 / DISCOVERY-ZAMENE: replay the established disposable chain in canonical DEV order, loopback only.
// live79 -> source147 -> PKG027..PKG042 -> PKG042a..PKG050a -> Discovery P0 -> PKG045b (P0) -> P6 rollout v3 -> EX04d
// -> EX06a -> EX06b -> WPP01 (exact relevant predecessors, then its applied candidate) -> EX06e R2 alignment -> EX06e R3.
// Packages applied on DEV that touch none of the pinned bodies (D12, EX05, AI location, messages inbox, voice, EX04a/b/c,
// PKG051a, chat) are not replayed: this is bounded relevant-body fidelity (fidelity.mjs), never global DEV equivalence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const DB = process.env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL, DB);
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
const privateDir = process.env.PRE_V3_ARTIFACT_DIR, out = process.env.MATCH_V1_ARTIFACT_DIR;
assert.ok(privateDir && out);
fs.mkdirSync(privateDir, {recursive: true});
fs.mkdirSync(out, {recursive: true});
const r3Dir = process.env.EX06E_R3_DIR;
assert.ok(r3Dir && process.env.EX06E_R2_DIR && process.env.WPP01_ARTIFACT_DIR);
const sha256 = text => createHash('sha256').update(text).digest('hex');
const psqlFile = file => ['psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file]];
// The DEV-applied EX06e R3 composition (supabase/operations/dev-alpha/ledger/20261005_ex06e_r3_lifecycle_recovery_application.receipt.json).
const R3_DEV_CANDIDATE_SHA256 = 'bd8c823c67c55967f0e62a8e893320897832a6f8f2248c762f9e1c3c15bf87da';

const stages = [
  ['00-source147', 'python3', ['supabase/proofs/pkg023j/replay_source147.py']],
  ...['027', '028', '029', '030', '031', '032', '033', '034', '035', '037', '038', '039', '040', '042']
    .map((n, i) => [String(i + 1).padStart(2, '0') + '-pkg' + n, 'node', [`supabase/proofs/pkg${n}/pkg${n}_proof.mjs`, 'replay']]),
  ['15-pkg042a-to-pkg050a', 'node', ['supabase/proofs/pkg050/pkg050_proof.mjs']],
  ['16-discovery-p0', ...psqlFile('supabase/candidates/discovery_p0_exact_public_landing.sql')],
  ['17-pkg045b-p0', ...psqlFile('supabase/candidates/pkg045b_task_column_privileges_p0.sql')],
  ['18-p6-rollout-v3', ...psqlFile('supabase/candidates/p6_discovery_rollout_v3.sql')],
  ['19-ex04d', ...psqlFile('supabase/candidates/ex04d_candidates_page.sql')],
  ['20-ex06a', ...psqlFile('supabase/candidates/ex06a_flexible_window.sql')],
  ['21-ex06b', ...psqlFile('supabase/candidates/ex06b_alias_registry.sql')],
  ['22-wpp01-exact-predecessors', 'node', ['supabase/candidates/worker-personal-profile-20261003/prepare-chain.mjs']],
  ['23-wpp01', ...psqlFile('supabase/candidates/worker-personal-profile-20261003/candidate.sql')],
  ['24-ex06e-r2-alignment', 'node', ['supabase/proofs/ex06/r2/align.mjs']],
  ['25-ex06e-r3-build', 'node', ['supabase/proofs/ex06/r3/build.mjs']],
  ['26-ex06e-r3', ...psqlFile(path.join(r3Dir, 'candidate.sql'))],
];
const log = path.join(out, 'chain-stages.txt');
fs.writeFileSync(log, '');
for (const [name, exe, args] of stages) {
  if (name === '26-ex06e-r3') {
    const built = sha256(fs.readFileSync(path.join(r3Dir, 'candidate.sql')));
    // Recorded, not admitted on its own: fidelity.mjs pins every R3 body this proof relies on (wave, tick, time helper).
    fs.appendFileSync(log, `25-ex06e-r3-build candidate sha256=${built} devReceipt=${R3_DEV_CANDIDATE_SHA256} equal=${built === R3_DEV_CANDIDATE_SHA256}\n`);
  }
  const fd = fs.openSync(path.join(privateDir, `chain-${name}.log`), 'w', 0o600);
  const started = Date.now();
  let status = 0;
  try { execFileSync(exe, args, {stdio: ['ignore', fd, fd], timeout: 1800000, env: process.env}); }
  catch (error) { status = error.status ?? 1; }
  finally { fs.closeSync(fd); }
  fs.appendFileSync(log, `${name} exit=${status} seconds=${Math.round((Date.now() - started) / 1000)}\n`);
  console.log(`${status === 0 ? 'PASS' : 'FAIL'} chain ${name}`);
  if (status !== 0) {
    const tail = fs.readFileSync(path.join(privateDir, `chain-${name}.log`), 'utf8').split('\n').slice(-25).join('\n');
    // Bounded diagnostic: the last lines of a FAILED disposable stage only (no DEV data exists on this stack).
    fs.writeFileSync(path.join(out, `chain-failure-${name}.txt`), tail.replace(/eyJ[A-Za-z0-9._-]+/g, '<jwt>'));
    process.exit(1);
  }
}
console.log('PASS MATCH_V1_CHAIN_REPLAYED');
