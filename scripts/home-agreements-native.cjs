'use strict';
// Opt-in exact same tests on the existing disposable loopback PostgreSQL17
// runtime (port 55434). No hosted connection, provider or phone.
const { after } = require('node:test');
const Module = require('node:module');
const { startFixture, stopFixture } = require('./p0-discovery-native-benchmark.cjs');

async function main() {
  const f = await startFixture(async NativeFixture => {
    const original = Module._load;
    Module._load = function(name, parent, isMain) {
      if (name === '@electric-sql/pglite') return { PGlite: NativeFixture };
      if (name === '@electric-sql/pglite/contrib/pgcrypto') return { pgcrypto: null };
      return original.call(this, name, parent, isMain);
    };
    try { return await require('./r08-blind-reviews-fixture.cjs').createReviewFixture(); }
    finally { Module._load = original; }
  });
  // Both the test and launcher clean up; make the one connection close once.
  const close = f.db.close.bind(f.db); let closed = false;
  f.db.close = async () => { if (!closed) { closed = true; await close(); } };
  f.homeProofRuntime = 'Isolated native PostgreSQL 17';
  after(stopFixture);
  require('./home-agreements-contract.test.cjs').registerHomeAgreementTests(async () => f);
}
main().catch(async error => { console.error(error); process.exitCode = 1; await stopFixture(); });
