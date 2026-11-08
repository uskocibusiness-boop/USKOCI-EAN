'use strict';
// Opt-in concurrency proof, only against the disposable loopback server.
// 100 actual SQL requests overlap; this is not a 100-user hosted load claim.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { startFixture, stopFixture, connectFixtureClient } = require('./p0-discovery-native-benchmark.cjs');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/p0_last_slot_concurrency_20261108.source.json'), 'utf8'));
const clients = [];
const clock = () => Number(process.hrtime.bigint()) / 1e6;
const ticks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
const usage = pids => pids.reduce((sum, pid) => {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
  sum.cpuSeconds += (Number(stat[11]) + Number(stat[12])) / ticks;
  sum.rssKiB += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
  return sum;
}, { cpuSeconds: 0, rssKiB: 0 });
async function priceFixture(NativeFixture) {
  const mod = { exports: {} };
  const injected = name => name === '@electric-sql/pglite' ? { PGlite: NativeFixture } : require(name);
  new Function('require', '__dirname', 'module', 'exports', fs.readFileSync(path.join(__dirname, 'r07-price-fixture.cjs'), 'utf8'))(injected, __dirname, mod, mod.exports);
  return mod.exports.createPriceFixture();
}
async function main() {
  const f = await startFixture(priceFixture, { maxConnections: 110 }), { db, value, rows } = f;
  await db.exec(f.candidate);
  await db.exec('drop function public.fn_need_covered_slots(uuid)');
  await db.exec(source.counter.definition);
  const hashes = await rows(`select p.oid::regprocedure::text as signature,md5(prosrc) as body_md5
    from pg_proc p where oid=any($1::regprocedure[]) order by 1`, [[source.writer.signature, 'public.fn_need_covered_slots(uuid)']]);
  assert.equal(hashes.find(x => x.signature.startsWith('rpc_select_response')).body_md5, source.writer.body_md5);
  assert.equal(hashes.find(x => x.signature.startsWith('fn_need_covered_slots')).body_md5, source.counter.body_md5);
  const workers = [];
  for (let i = 0; i < 100; i++) {
    const worker = { account: randomUUID(), profile: randomUUID() };
    await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
      values($1,$2,'WORKER','Sintetički radnik','Novi Sad',array['Selidbe'],'ACTIVE')`, [worker.profile, worker.account]);
    workers.push(worker);
  }
  await Promise.all(Array.from({ length: 100 }, async (_, i) => {
    const client = await connectFixtureClient(); clients.push(client);
    await client.query("select set_config('application_name',$1,false),set_config('request.jwt.claim.sub',$2,false)", [`uskoci-100-${i}`, f.REQUESTER]);
    await client.query("set role authenticated;set statement_timeout='15s';set lock_timeout='10s'");
  }));
  const pids = await Promise.all(clients.map(async c => Number((await c.query('select pg_backend_pid() as pid')).rows[0].pid)));
  assert.equal(new Set(pids).size, 100);
  const gatePid = Number(await value('select pg_backend_pid() as value'));
  assert.ok(!pids.includes(gatePid));
  const result = { capturedAt: new Date().toISOString(), postgres: await value('select version() as value'),
    writerSource: hashes, simultaneousWriterConnections: 100, controlConnections: 1, scenarios: [],
    limitations: ['Local isolated SQL only. Existing identity/world, eligibility/calendar, notification/audit and dispatch fixture seams remain substitutes.',
      'Exact current selection writer and slot counter, locks and business writes are exercised. Hosted JWT/PostgREST, real eligibility and Android E2E are not.',
      'Elapsed time includes an intentional row-lock barrier and is not product latency. p99 from 100 samples is descriptive only.',
      'Summed RSS includes shared mappings multiple times and is not a measure of private memory or phone RAM.',
      'CPU accounting is per-backend in10ms ticks; zero observed delta is below measurement resolution, not zero CPU work.',
      'The isolated max_connections=110 is a fixture setting. Hosted DEV stays unchanged at60. No provider traffic.'] };
  const snapshot = need => value(`select jsonb_build_object(
    'coveredSlots',public.fn_need_covered_slots($1),
    'selectedRows',(select count(*) from public.need_selections where need_id=$1 and status='SELECTED'),
    'agreements',(select count(*) from public.agreements where need_id=$1),
    'commands',(select count(*) from private.selection_commands where need_id=$1),
    'activations',(select count(*) from private.connection_activations where need_id=$1),
    'agreementVersions',(select count(*) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.need_id=$1)
  ) as value`, [need]);
  for (const sameIntent of [false, true]) {
    const need = await f.need('HOURLY', 1200, 1), argumentsByWorker = [];
    for (const worker of workers) {
      await f.actor(worker.account);
      const receipt = await f.submit(need, 1200, 1, 1, randomUUID(), worker.profile);
      argumentsByWorker.push([need, receipt.needRevision, receipt.responseId, receipt.version, receipt.contentHash, randomUUID()]);
    }
    await db.exec('begin');
    let gateOpen = true;
    try {
      await db.query('select id from public.needs where id=$1 for update', [need]);
      const resourceBefore = usage(pids), started = clock();
      let finished = 0;
      const requests = clients.map((client, i) => client.query('select public.rpc_select_response($1,$2,$3,$4,$5,$6) as value',
        argumentsByWorker[sameIntent ? 0 : i]).then(answer => ({ ok: true, id: answer.rows[0].value }),
        error => ({ ok: false, code: error.code, message: error.message })).then(answer => { finished++; return { ...answer, elapsedMs: clock() - started }; }));
      let overlap = 0;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        await db.query('select pg_stat_clear_snapshot()');
        overlap = Number(await value(`select count(*) as value from pg_stat_activity where pid=any($1::int[])
          and state='active' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0`, [pids]));
        if (overlap === 100) break;
        assert.equal(finished, 0, 'All100 requests must overlap before release');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(overlap, 100, 'Observed genuine100-connection lock overlap');
      const barrierMs = clock() - started;
      await db.exec('commit'); gateOpen = false;
      const outcomes = await Promise.all(requests), resourceAfter = usage(pids);
      const successful = outcomes.filter(x => x.ok), failures = outcomes.filter(x => !x.ok);
      assert.equal(successful.length, sameIntent ? 100 : 1);
      assert.equal(new Set(successful.map(x => x.id)).size, 1);
      for (const error of failures) { assert.equal(error.code, 'P0001'); assert.equal(error.message, 'NEED_NOT_OPEN'); }
      const facts = await snapshot(need);
      assert.deepEqual(facts, { coveredSlots: 1, selectedRows: 1, agreements: 1, commands: 1, activations: 1, agreementVersions: 1 });
      const samples = outcomes.map(x => x.elapsedMs).sort((a, b) => a - b);
      const record = { name: sameIntent ? '100 concurrent identical command replays' : '100 different workers compete for one place',
        observedOverlappingRequests: overlap, successfulRequests: successful.length, expectedBusinessRejections: failures.length,
        unexpectedErrors: 0, facts, barrierMs, totalElapsedMs: samples[99], p50Ms: samples[49], p95Ms: samples[94], p99Ms: samples[98],
        writerCpuSeconds: resourceAfter.cpuSeconds - resourceBefore.cpuSeconds, summedWriterRssKiB: resourceAfter.rssKiB,
        capturedOutcomeBytes: Buffer.byteLength(JSON.stringify(outcomes)), rpcCalls: 100, frontendSqlCommands: 100,
        internalSqlStatements: 'NOT_COUNTED', cpuTickSeconds: 1 / ticks,
        retryProviderCalls: 0 };
      result.scenarios.push(record); process.stdout.write(JSON.stringify(record) + '\n');
    } finally { if (gateOpen) await db.exec('rollback'); }
  }
  result.lockWaitersAtEnd = Number(await value('select count(*) as value from pg_locks where not granted'));
  assert.equal(result.lockWaitersAtEnd, 0);
  const output = process.argv[2]; assert.ok(output, 'Pass an evidence path');
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.allSettled(clients.map(client => client.end())); await stopFixture();
});
