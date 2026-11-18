'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, candidate, input } = require('./r06-pre-provider-input-fixture.cjs');

const migration = fs.readFileSync(path.join(__dirname, 'sql/r06_gemini_cache_input_20261118.install.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql/r06_gemini_cache_input_20261118.rollback.sql'), 'utf8');

function cachedInput(purpose) {
  const data = input(purpose);
  const original = data.providerRequest;
  data.catalog = { catalogVersion: 17, catalogFingerprint: 'a'.repeat(32), categories: [] };
  data.providerRequest = {
    cachedContent: purpose === 'NEED_SERVICE' ? 'cachedContents/r06-test-need' : 'cachedContents/r06-test-worker',
    contents: original.contents,
    generationConfig: original.generationConfig,
  };
  return data;
}

test('R06 accepts only exact server cache references and preserves them through prepared dispatch', async t => {
  const f = await fixture();
  try {
    await f.db.exec(candidate);
    await f.db.exec(migration);

    for (const purpose of ['NEED_SERVICE', 'WORKER_CAPABILITY']) {
      await t.test(purpose + ': cached request is immutable and dispatches once', async () => {
        await f.seed(purpose);
        const data = cachedInput(purpose);
        const prepared = await f.prepare(purpose, data);
        assert.equal(prepared.state, 'PREPARED');
        assert.equal(prepared.replay, false);
        const read = await f.read(purpose);
        assert.equal(read.state, 'PREPARED');
        assert.deepEqual(read.snapshot.input.providerRequest, data.providerRequest);
        assert.equal(
          read.snapshot.instructionSha256,
          crypto.createHash('sha256').update(data.providerRequest.cachedContent).digest('hex'),
        );
        const dispatched = await f.dispatchPrepared(purpose, prepared.inputSha256);
        assert.equal(dispatched.state, 'DISPATCHED');
        assert.equal(dispatched.dispatched, true);
        assert.deepEqual(dispatched.snapshot.input.providerRequest, data.providerRequest);
        assert.deepEqual(
          await f.dispatchPrepared(purpose, prepared.inputSha256),
          { state: 'READ_ONLY', dispatched: false },
        );
      });
    }

    await t.test('mixed inline/cache and missing catalog are rejected before reservation', async () => {
      await f.seed('NEED_SERVICE');
      const mixed = cachedInput('NEED_SERVICE');
      mixed.providerRequest.systemInstruction = { parts: [{ text: 'must not coexist with cachedContent' }] };
      await assert.rejects(f.prepare('NEED_SERVICE', mixed), /R06_TEXT_REQUEST_INVALID/);
      assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);

      await f.seed('NEED_SERVICE');
      const noCatalog = cachedInput('NEED_SERVICE');
      noCatalog.catalog = null;
      await assert.rejects(f.prepare('NEED_SERVICE', noCatalog), /R06_TEXT_REQUEST_INVALID/);
      assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);

      await f.seed('NEED_SERVICE');
      const badReference = cachedInput('NEED_SERVICE');
      badReference.providerRequest.cachedContent = 'https://example.invalid/cache';
      await assert.rejects(f.prepare('NEED_SERVICE', badReference), /R06_TEXT_REQUEST_INVALID/);
      assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);
    });

    await f.db.exec(rollback);
    await t.test('guarded rollback restores the original inline-only request contract', async () => {
      await f.seed('NEED_SERVICE');
      await assert.rejects(f.prepare('NEED_SERVICE', cachedInput('NEED_SERVICE')), /R06_TEXT_REQUEST_INVALID/);
      const inline = await f.prepare('NEED_SERVICE', input('NEED_SERVICE'));
      assert.equal(inline.state, 'PREPARED');
    });
  } finally {
    await f.db.close();
  }
});
