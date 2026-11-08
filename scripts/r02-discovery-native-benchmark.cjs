'use strict';
// Uses the existing disposable loopback PostgreSQL/PostGIS launcher. No hosted
// connection strings, provider traffic, permanent fixture data or new service.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { startFixture, stopFixture } = require('./p0-discovery-native-benchmark.cjs');
const sql = name => fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8');
const preimage = JSON.parse(sql('r02_discovery_schedule_20261108.preimage.json'));
const forward = sql('r02_discovery_schedule_20261108.sql');
const source = fs.readFileSync(path.join(__dirname, 'r05-discovery-contract.test.cjs'), 'utf8');
const tree = ts.createSourceFile('fixture.cjs', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const first = tree.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)
  && n.expression.expression.getText(tree) === 'test');
const { filter, page, clean, N, B } = new Function('require', '__dirname', source.slice(0, first.getStart(tree))
  + '\nreturn { filter, page, clean, N, B };')(require, __dirname);
const percentile = (a, p) => a[Math.min(a.length - 1, Math.ceil(a.length * p) - 1)];
const ticksPerSecond = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
const proc = pid => {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
  return { cpuSeconds: (Number(stat[11]) + Number(stat[12])) / ticksPerSecond,
    rssKiB: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0),
    peakRssKiB: Number(status.match(/^VmHWM:\s+(\d+)/m)?.[1] ?? 0) };
};
async function main() {
  const f = await startFixture(), { db, value, raw, decode, actor } = f;
  await db.exec(preimage.definition);
  const pid = await value('select pg_backend_pid() as value');
  const columns = JSON.parse(sql('r05_discovery_contract_20261107.preimage.json')).needsState.columns
    .map(c => c.name).filter(n => n !== 'approx_geog');
  const template = await value('select to_jsonb(n) as value from public.needs n where id=$1', [N]);
  const results = { capturedAt: new Date().toISOString(), postgres: await value('select version() as value'),
    postgis: await value('select extensions.postgis_full_version() as value'),
    sourcePreimageMd5: preimage.body_md5, concurrentClients: 1, runs: [],
    limitations: ['Native local synthetic database. Real RPC, RLS/ACL, time helpers, client decoder, PostGIS. Account lineage and canonical eligibility are inherited bounded seams.',
      'No real network, phone, Realtime, hosted performance or 300000-user capacity claim.',
      'Nearest-rank quantiles: p99 is the maximum for these sample counts, with low statistical power.',
      'Backend RSS includes mapped/shared memory; these are not private-memory or Android RAM measurements. CPU is this backend only.',
      'backendPeakRssKiB is the cumulative VmHWM of the same backend process, not a separately reset peak for each variant.',
      'The observed calendar-call reduction depends on finding an early known schedule. EXISTS may inspect more or all candidates when no known schedule exists.'] };
  let previous = 0;
  for (const total of [100, 1000, 5001, 10000, 30000]) {
    await db.exec('reset role');
    await db.query(`insert into public.needs(${columns.join(',')}) select ${columns.map(n => 'x.' + n).join(',')}
      from generate_series($2::int,$3::int) g(i) cross join lateral jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object(
      'id',md5('r02-native-scale-'||g.i)::uuid,'title','R02 native capacity '||g.i,
      'execution_location_mode',case when g.i%2=0 then 'STATIONARY' else 'REMOTE' end,
      'schedule_kind','FIXED_WINDOW','starts_at','2099-01-01T10:00:00Z','ends_at','2099-01-01T12:00:00Z')) x`, [template, previous + 1, total]);
    previous = total;
    await db.exec('analyze public.needs;analyze public.app_profiles;analyze public.need_selections;');
    const scenarios = [['unfiltered PAGE', page({}, { limit: 50 })]];
    if (total === 30000) scenarios.push(['selective PAGE', page({ where: 'onsite' }, { limit: 50 })],
      ['time-filter PAGE', page({ when: 'today' }, { limit: 50 })],
      ['MAP', { mode: 'MAP', filter: filter(), anchor: null, bounds: [19, 45, 20, 46], grid: 24 }]);
    for (const [name, request] of scenarios) {
      const run = { syntheticAdded: total, name, samplesPerVariant: total === 30000 ? 25 : 7 };
      let reference;
      for (const optimized of [false, true]) {
        await db.exec('reset role'); await db.exec(preimage.definition); if (optimized) await db.exec(forward);
        await actor(B);
        const first = await raw({ ...request, anchor: reference?.anchor ?? null }); decode(first);
        if (!optimized) reference = first; else assert.deepEqual(clean(first), clean(reference));
        const anchored = { ...request, anchor: reference.anchor };
        await raw(anchored); await raw(anchored);
        const resourceBefore = proc(pid), samples = [];
        let successes = 0;
        for (let i = 0; i < run.samplesPerVariant; i++) {
          const start = process.hrtime.bigint(); const answer = await raw(anchored);
          samples.push(Number(process.hrtime.bigint() - start) / 1e6);
          assert.deepEqual(clean(answer), clean(reference)); successes++;
        }
        const resourceAfter = proc(pid); samples.sort((a, b) => a - b);
        run[optimized ? 'after' : 'before'] = { success: successes, errors: 0, p50Ms: percentile(samples, .5),
          p95Ms: percentile(samples, .95), p99Ms: percentile(samples, .99), samplesMs: samples,
          backendCpuSeconds: resourceAfter.cpuSeconds - resourceBefore.cpuSeconds,
          backendRssKiB: resourceAfter.rssKiB, backendPeakRssKiB: resourceAfter.peakRssKiB,
          responseBytes: Buffer.byteLength(JSON.stringify(first)), rpcCallsPerPage: 1,
          pageRows: first.items?.length ?? null,
          wrapperExplain: (await db.query('explain (analyze,buffers,format json) select public.rpc_discovery_v1($1)', [anchored])).rows[0]['QUERY PLAN'] };
      }
      run.fullResponseEqual = true; run.counts = clean(reference.counts);
      results.runs.push(run);
      process.stdout.write(JSON.stringify({ total, name, beforeMs: run.before.p50Ms, afterMs: run.after.p50Ms, fullResponseEqual: true }) + '\n');
    }
  }
  await db.exec('reset role');
  results.totalRows = Number(await value('select count(*) as value from public.needs'));
  results.lockWaitersAtEnd = Number(await value('select count(*) as value from pg_locks where not granted'));
  const output = process.argv[2]; assert.ok(output, 'Explicit evidence path required');
  fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(stopFixture);
