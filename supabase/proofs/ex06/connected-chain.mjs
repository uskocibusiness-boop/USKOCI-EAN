// Extend the already proven current99 chat/AI predecessor with exact lifecycle packages. Disposable only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertChainFacts, CHAIN_FACTS_SQL} from '../ex05_s01/lib/harness.mjs';
assert.equal(process.env.CONNECTED_JOURNEY_DISPOSABLE, 'FOUR_ACTORS_V1');
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL, process.env.DB_URL);
for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert.ok(!process.env[key], 'PG_OVERRIDE');
const rt = await import('../pre_v3/closure_runtime.mjs');
const {sql, q} = rt, out = process.env.CONNECTED_JOURNEY_ARTIFACT_DIR;
assert.ok(out?.startsWith('/tmp/'));
fs.mkdirSync(out, {recursive: true});
const report = {unit: 'CONNECTED_CHAIN', sourceSha: process.env.GITHUB_SHA, result: 'RUNNING', stages: [],
  liveAccess: false, fullDev235Replay: false};
const write = () => fs.writeFileSync(path.join(out, 'connected-chain-report.json'), JSON.stringify(report, null, 2) + '\n');
const receipt = JSON.parse(fs.readFileSync('supabase/operations/dev-alpha/ledger/20261002_ai_location_01_application.receipt.json', 'utf8'));
const protectedNames = receipt.functions.map(f => f.function_name);
assert.equal(protectedNames.length, 17);
const capture = () => sql(`select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.oid)::text,'')) from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=any(array[${protectedNames.map(q)}])
  or (n.nspname in('public','private') and (p.proname like '%group%v5' or p.proname like '%agreement%message%' or p.proname like '%voice%'))`);
const psql = file => ['psql', [process.env.DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file]];
const steps = [
  ['ex04d', ...psql('supabase/candidates/ex04d_candidates_page.sql')],
  ['ex06a', ...psql('supabase/candidates/ex06a_flexible_window.sql')],
  ['ex06b', ...psql('supabase/candidates/ex06b_alias_registry.sql')],
  ['wpp-predecessors', 'node', ['supabase/candidates/worker-personal-profile-20261003/prepare-chain.mjs']],
  ['wpp', ...psql('supabase/candidates/worker-personal-profile-20261003/candidate.sql')],
  ['r2-alignment', 'node', ['supabase/proofs/ex06/r2/align.mjs']],
  ['r3-build', 'node', ['supabase/proofs/ex06/r3/build.mjs']],
  ['r3-apply', ...psql(path.join(process.env.EX06E_R3_DIR, 'candidate.sql'))],
];
try {
  const predecessor = JSON.parse(fs.readFileSync(path.join(rt.out, 'single-target-current99-promotion.json'), 'utf8'));
  assert.equal(predecessor.result, 'PASS'); assert.equal(predecessor.sourceSha, process.env.GITHUB_SHA);
  assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)));
  const before = capture();
  for (const [name, command, args] of steps) {
    if (name === 'r3-apply') {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(process.env.EX06E_R3_DIR, 'candidate.sql'))).digest('hex');
      assert.equal(hash, 'bd8c823c67c55967f0e62a8e893320897832a6f8f2248c762f9e1c3c15bf87da');
      report.r3CandidateSha256 = hash;
    }
    const fd = fs.openSync(path.join(rt.out, 'connected-' + name + '.log'), 'w', 0o600), started = Date.now();
    let status = 0;
    try { execFileSync(command, args, {stdio: ['ignore', fd, fd], env: process.env, timeout: 180000}); }
    catch (error) { status = error.status ?? 1; }
    finally { fs.closeSync(fd); }
    report.stages.push({name, status, elapsedMs: Date.now() - started}); write();
    if (status !== 0) {
      report.stageFailureTail = fs.readFileSync(path.join(rt.out, 'connected-' + name + '.log'), 'utf8')
        .split('\n').slice(-12).join('\n').replace(/eyJ[A-Za-z0-9._-]+/g, '<jwt>').slice(-1500);
    }
    assert.equal(status, 0, 'CONNECTED_STAGE:' + name);
  }
  assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)));
  assert.equal(capture(), before, 'AI_CHAT_VOICE_FUNCTIONS_OR_METADATA_CHANGED');
  report.aiChatVoiceUnchanged = true;
  sql("notify pgrst,'reload schema'");
  await new Promise(resolve => setTimeout(resolve, 1500));
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.failure = String(error?.message ?? error).slice(0, 1000); process.exitCode = 1;
} finally { write(); console.log(report.result + ' CONNECTED_CHAIN'); }
