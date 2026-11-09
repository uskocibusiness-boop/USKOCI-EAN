'use strict';
// Optional same-suite PostgreSQL17 execution. The existing launcher starts a
// new disposable loopback cluster and verifies its exact data_directory.
const { after } = require('node:test');
const { startFixture, stopFixture } = require('./p0-discovery-native-benchmark.cjs');
async function main() {
  const f = await startFixture(async NativeFixture => ({ db: new NativeFixture() }));
  const runtime = (await f.db.query('select version() as version')).rows[0].version;
  console.log('Isolated probe cleanup runtime: ' + runtime);
  after(stopFixture);
  require('./r13-probe-cleanup.test.cjs').registerProbeCleanupTests(async () => {
    // These schemas and roles belong only to this freshly launched fixture.
    await f.db.exec(`drop schema if exists private cascade;drop schema if exists cron cascade;
      drop schema public cascade;create schema public;
      drop role if exists anon;drop role if exists authenticated;drop role if exists service_role;`);
    return { query: (...args) => f.db.query(...args), exec: (...args) => f.db.exec(...args), close: async () => {} };
  });
}
main().catch(async error => { console.error(error.message); process.exitCode=1; await stopFixture(); });
