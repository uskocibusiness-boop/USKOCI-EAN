// Offline, fresh-isolate tests of the real clarification helper. No provider,
// database or new retry is used; the RPC fixture is the current GET authority.
import test from 'node:test';
import assert from 'node:assert/strict';

const MODULE = new URL('../../functions/_shared/backgroundTaxonomyArchitect.mjs', import.meta.url);
const GET = 'rpc_taxonomy_get_unconsumed_turn_hint_service';
const STORE = 'rpc_taxonomy_store_classification_turn_hint_service';
const TTL = 5 * 60 * 1000;
let instance = 0;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(t) {
  const api = await import(`${MODULE.href}?clarification-lifecycle=${++instance}`);
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const hint = (conversationId = 'owned-conversation', draftRevision = 4) => ({
    conversationId, draftRevision, service: 'Krečenje', mode: 'ON_SITE',
    ambiguityPrompt: 'Koju prostoriju treba okrečiti?', reason: 'Preciziranje obima posla.',
  });
  const put = value => api.storeClarificationHint(value.conversationId, value.draftRevision, value);
  const get = value => api.getUnconsumedClarificationHint(value.conversationId, value.draftRevision);
  const fetch = (value, rpc) => api.fetchUnconsumedClarificationHint(rpc, value.conversationId, value.draftRevision);
  return { ...api, hint, put, get, fetch, advance: ms => { now += ms; } };
}

for (const [label, response] of [
  ['consumed elsewhere', () => null], ['closed conversation', () => null],
  ['changed revision', () => null], ['expired server row', () => null],
  ['RPC rejection', () => { throw new Error('SYNTHETIC_TRANSPORT'); }],
  ['HTTP error', () => ({ ok: false, data: null })],
  ['mismatched identity', value => ({ ...value, conversationId: 'foreign-conversation' })],
]) {
  test(`warm memory cannot override authoritative ${label}`, async t => {
    const f = await fixture(t), value = f.hint(), calls = [];
    f.put(value);
    const result = await f.fetch(value, async (name, args) => {
      calls.push({ name, args }); return response(value);
    });
    assert.equal(result, null);
    assert.deepEqual(calls, [{ name: GET, args: { p_conversation_id: value.conversationId, p_draft_revision: 4 } }]);
    assert.equal(f.get(value), null, 'the invalidated private hint must not remain a local fallback');
  });
}

for (const wrapped of [false, true]) {
  test(`warm fetch reads the current ${wrapped ? 'wrapped' : 'raw'} replacement exactly once`, async t => {
    const f = await fixture(t), value = f.hint(), replacement = { ...value, service: 'Popravka' }, calls = [];
    f.put(value);
    const result = await f.fetch(value, async name => {
      calls.push(name); return wrapped ? { ok: true, data: replacement } : replacement;
    });
    assert.deepEqual(result, replacement);
    assert.deepEqual(calls, [GET], 'no STORE, consume, provider or paid retry');
    assert.equal(f.get(value)?.service, replacement.service);
  });
}

test('local-only callers retain the unexpired fallback without gaining server authority', async t => {
  const f = await fixture(t), value = f.hint();
  f.put(value);
  assert.equal((await f.fetch(value, undefined))?.service, value.service);
});

test('fixed five-minute age expires at the boundary and hits never extend it', async t => {
  const f = await fixture(t), value = f.hint();
  f.put(value);
  f.advance(TTL - 1);
  assert.equal(f.get(value)?.service, value.service);
  f.advance(1);
  assert.equal(f.get(value), null);
  assert.equal(await f.fetch(value, undefined), null);
});

test('clock rollback invalidates rather than extending private hint lifetime', async t => {
  const f = await fixture(t), value = f.hint();
  f.put(value);
  f.advance(-1);
  assert.equal(f.get(value), null);
});

for (const shape of ['same conversation revisions', 'different conversations']) {
  test(`capacity is 128 total slots across ${shape}, with nonrenewing LRU reads`, async t => {
    const f = await fixture(t);
    const values = Array.from({ length: 129 }, (_, i) => shape === 'same conversation revisions'
      ? f.hint('many-revisions', i) : f.hint(`conversation-${i}`, 4));
    values.slice(0, 128).forEach(f.put);
    assert.equal(f.get(values[0])?.service, values[0].service);
    f.put(values[128]);
    assert.equal(f.get(values[1]), null, 'least recently accessed slot is evicted');
    assert.equal(f.get(values[0])?.service, values[0].service);
    assert.equal(f.get(values[128])?.service, values[128].service);
    f.advance(TTL);
    assert.equal(f.get(values[0]), null, 'LRU access cannot renew TTL');
  });
}

for (const operation of ['GET', 'STORE']) {
  for (const invalidation of ['expiry', 'capacity', 'clock rollback']) {
    test(`pending ${operation} cannot repopulate a slot after ${invalidation}`, async t => {
      const f = await fixture(t), value = f.hint(), response = deferred(), calls = [];
      const rpc = async name => { calls.push(name); return response.promise; };
      const pending = operation === 'GET' ? f.fetch(value, rpc) : f.persistClarificationHint(rpc, value);
      if (invalidation === 'expiry') f.advance(TTL);
      if (invalidation === 'clock rollback') f.advance(-1);
      if (invalidation === 'capacity') for (let i = 0; i < 128; i++) f.put(f.hint(`pressure-${i}`));
      response.resolve(operation === 'GET' ? value : { stored: true, draftRevision: 4 });
      assert.equal(await pending, operation === 'GET' ? null : true,
        'a matching STORE receipt still confirms its observed outcome, not cache admission');
      assert.deepEqual(calls, [operation === 'GET' ? GET : STORE]);
      assert.equal(f.get(value), null);
    });
  }
}

for (const operation of ['GET', 'lost STORE ACK']) {
  for (const invalidation of ['expiry', 'capacity']) {
    test(`consume followed by ${invalidation} cannot make a pending ${operation} resurrect an empty slot`, async t => {
      const f = await fixture(t), value = f.hint(), response = deferred(), started = deferred(), calls = [];
      const rpc = async name => {
        calls.push(name);
        if (name === STORE) return null;
        started.resolve(); return response.promise;
      };
      const pending = operation === 'GET' ? f.fetch(value, rpc) : f.persistClarificationHint(rpc, value);
      await started.promise;
      f.consumeClarificationHint(value.conversationId, 4, value.service);
      if (invalidation === 'expiry') f.advance(TTL);
      else for (let i = 0; i < 128; i++) f.put(f.hint(`consume-pressure-${i}`));
      response.resolve(value);
      assert.equal(await pending, operation === 'GET' ? null : true);
      assert.deepEqual(calls, operation === 'GET' ? [GET] : [STORE, GET]);
      assert.equal(f.get(value), null);
    });
  }
}

for (const outcome of ['old hint', 'null', 'throw']) {
  test(`conflicting GET ${outcome} never returns a newer local replacement as database readback`, async t => {
    const f = await fixture(t), value = f.hint(), response = deferred();
    const pending = f.fetch(value, async () => {
      const data = await response.promise;
      if (outcome === 'throw') throw new Error('SYNTHETIC_READ_FAILURE');
      return data;
    });
    const newer = { ...value, service: 'Noviji posao' };
    assert.equal(await f.persistClarificationHint(async () => ({ stored: true, draftRevision: 4 }), newer), true);
    response.resolve(outcome === 'old hint' ? value : null);
    assert.equal(await pending, null, 'even an earlier confirmed STORE is not proof of a current GET');
    assert.equal(f.get(value)?.service, newer.service, 'the delayed read cannot erase a newer local receipt');
  });
}

test('expired or evicted memory permits a fresh authoritative GET and confirmed replacement', async t => {
  const f = await fixture(t), value = f.hint();
  f.put(value);
  f.consumeClarificationHint(value.conversationId, 4, value.service);
  f.advance(TTL);
  const replacement = { ...value, service: 'Novi potvrđeni posao' };
  assert.deepEqual(await f.fetch(value, async () => replacement), replacement);
  assert.equal(f.get(value)?.service, replacement.service);
});
