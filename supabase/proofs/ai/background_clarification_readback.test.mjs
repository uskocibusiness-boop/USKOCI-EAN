// Offline RPC-contract tests. A matching read proves current hint content, not
// ownership of a provider attempt or permission to retry a paid classification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeClarificationHint, fetchUnconsumedClarificationHint,
  getUnconsumedClarificationHint, persistClarificationHint, persistConsumeClarificationHint, storeClarificationHint }
  from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const storeRpc = 'rpc_taxonomy_store_classification_turn_hint_service';
const readRpc = 'rpc_taxonomy_get_unconsumed_turn_hint_service';
const hint = id => ({ conversationId: id, draftRevision: 4, service: 'Krečenje', mode: 'ON_SITE',
  ambiguityPrompt: 'Koju prostoriju treba okrečiti?', reason: 'Preciziranje obima posla.' });
const transport = (value, wrapped) => wrapped ? { ok: true, data: value } : value;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

for (const wrapped of [false, true]) {
  for (const [label, outcome] of [
    ['null', () => null], ['empty', () => ({})], ['wrong revision', () => ({ stored: true, draftRevision: 5 })],
    ['HTTP error', () => ({ ok: false, status: 503, data: null })],
    ['thrown transport', () => { throw new Error('SYNTHETIC_LOST_ACK'); }],
  ]) {
    test(`lost ${label} store ACK recovers only exact ${wrapped ? 'wrapped' : 'raw'} current readback`, async () => {
      const value = hint(`recovered-${label}-${wrapped}`), calls = [];
      const result = await persistClarificationHint(async (name, args) => {
        calls.push({ name, args });
        if (name === storeRpc) return outcome();
        assert.equal(name, readRpc);
        return transport(value, wrapped);
      }, value);
      assert.equal(result, true);
      assert.deepEqual(calls.map(call => call.name), [storeRpc, readRpc]);
      assert.deepEqual(calls[1].args, { p_conversation_id: value.conversationId, p_draft_revision: 4 });
      assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.ambiguityPrompt, value.ambiguityPrompt);
    });
  }
  test(`valid ${wrapped ? 'wrapped' : 'raw'} store ACK does not add a readback`, async () => {
    const value = hint(`valid-ack-${wrapped}`), calls = [];
    assert.equal(await persistClarificationHint(async name => {
      calls.push(name); return transport({ stored: true, draftRevision: 4 }, wrapped);
    }, value), true);
    assert.deepEqual(calls, [storeRpc]);
  });
  test(`explicit ${wrapped ? 'wrapped' : 'raw'} store rejection cannot recover from an older matching hint`, async () => {
    const value = hint(`rejected-${wrapped}`), calls = [];
    assert.equal(await persistClarificationHint(async name => {
      calls.push(name);
      return name === storeRpc ? transport({ stored: false, draftRevision: 4 }, wrapped) : transport(value, wrapped);
    }, value), false);
    assert.deepEqual(calls, [storeRpc]);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
  });
}

test('readback compares PostgreSQL-space normalization, nullable mode/reason and Unicode codepoint bounds', async () => {
  const value = { ...hint('normalized-readback'), service: '  Krečenje  ', ambiguityPrompt: '  Koju prostoriju treba okrečiti?  ',
    mode: undefined, reason: '  ' + '🧑'.repeat(301) + '  ' };
  let stored;
  assert.equal(await persistClarificationHint(async (name, args) => {
    if (name === storeRpc) { stored = args; return null; }
    return { ...value, service: 'Krečenje', ambiguityPrompt: 'Koju prostoriju treba okrečiti?', mode: null, reason: '🧑'.repeat(300) };
  }, value), true);
  const cached = getUnconsumedClarificationHint(value.conversationId, 4);
  assert.equal(cached.service, 'Krečenje');
  assert.equal(cached.mode, null);
  assert.equal(cached.reason, stored.p_reason);
  assert.equal(Array.from(cached.reason).length, 300);
  assert.equal(value.service, '  Krečenje  ', 'must not mutate caller input');
});

for (const [label, mutate] of [
  ['conversation', value => ({ ...value, conversationId: 'another-conversation' })],
  ['revision', value => ({ ...value, draftRevision: 5 })],
  ['service', value => ({ ...value, service: 'Popravka' })],
  ['mode', value => ({ ...value, mode: 'REMOTE' })],
  ['prompt', value => ({ ...value, ambiguityPrompt: 'Koji drugi posao je potreban?' })],
  ['reason', value => ({ ...value, reason: 'Drugo obrazloženje.' })],
  ['absent', () => null],
  ['error envelope', value => ({ ok: false, data: value })],
]) {
  test(`lost store ACK with ${label} readback remains unresolved and never replays STORE`, async () => {
    const value = hint(`mismatch-${label}`), calls = [];
    assert.equal(await persistClarificationHint(async name => {
      calls.push(name); return name === storeRpc ? null : mutate(value);
    }, value), false);
    assert.deepEqual(calls, [storeRpc, readRpc]);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
  });
}

test('readback transport rejection is nonfatal, bounded to one read, and cannot warm memory', async () => {
  const value = hint('readback-throws'), calls = [];
  assert.equal(await persistClarificationHint(async name => {
    calls.push(name); throw new Error('SYNTHETIC_TRANSPORT_FAILURE');
  }, value), false);
  assert.deepEqual(calls, [storeRpc, readRpc]);
  assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
});

test('lost ACK cannot be recovered from memory instead of an authoritative read', async () => {
  const value = hint('memory-not-authority'), calls = [];
  storeClarificationHint(value.conversationId, 4, value);
  assert.equal(await persistClarificationHint(async name => { calls.push(name); return null; }, value), false);
  assert.deepEqual(calls, [storeRpc, readRpc]);
});

for (const action of ['newer hint', 'consumed hint']) {
  test(`a delayed matching receipt cannot overwrite a ${action} in the same memory slot`, async () => {
    const value = hint(`late-${action}`), started = deferred(), read = deferred();
    storeClarificationHint(value.conversationId, 4, value);
    const result = persistClarificationHint(async name => {
      if (name === storeRpc) return null;
      started.resolve(); return read.promise;
    }, value);
    await Promise.race([started.promise, result.then(() => assert.fail('readback must start before settling'))]);
    if (action === 'newer hint') storeClarificationHint(value.conversationId, 4, { ...value, service: 'Noviji posao' });
    else consumeClarificationHint(value.conversationId, 4, value.service);
    read.resolve(value);
    assert.equal(await result, true, 'only the matching observed content is confirmed');
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.service ?? null,
      action === 'newer hint' ? 'Noviji posao' : null);
  });
}

test('a confirmed consume fences an older GET even when its memory slot was initially empty', async () => {
  const value = hint('empty-slot-consume-race'), read = deferred();
  const pending = fetchUnconsumedClarificationHint(() => read.promise, value.conversationId, 4);
  assert.equal(await persistConsumeClarificationHint(async () => ({ consumed: 1, draftRevision: 4 }),
    value.conversationId, 4, value.service), true);
  read.resolve(value);
  assert.equal(await pending, null);
  assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
});

for (const operation of ['STORE', 'GET']) {
  test(`a fresh confirmed ${operation} can replace a hint consumed before that operation began`, async () => {
    const value = hint(`fresh-after-consume-${operation}`), replacement = { ...value, service: 'Noviji posao' };
    storeClarificationHint(value.conversationId, 4, value);
    assert.equal(await persistConsumeClarificationHint(async () => ({ consumed: 1, draftRevision: 4 }),
      value.conversationId, 4, value.service), true);
    if (operation === 'STORE') assert.equal(await persistClarificationHint(async () => ({ stored: true, draftRevision: 4 }), replacement), true);
    else assert.deepEqual(await fetchUnconsumedClarificationHint(async () => replacement, value.conversationId, 4), replacement);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.service, replacement.service);
  });
}

for (const [label, mutate] of [
  ['wrong conversation', value => ({ ...value, conversationId: 'wrong' })],
  ['wrong revision', value => ({ ...value, draftRevision: 5 })],
  ['string revision', value => ({ ...value, draftRevision: '4' })],
  ['missing service', value => ({ ...value, service: undefined })],
  ['blank service', value => ({ ...value, service: ' ' })],
  ['oversized service', value => ({ ...value, service: '😀'.repeat(201) })],
  ['missing mode', value => ({ ...value, mode: undefined })],
  ['invalid mode', value => ({ ...value, mode: 'OTHER' })],
  ['short prompt', value => ({ ...value, ambiguityPrompt: '😀'.repeat(7) })],
  ['oversized prompt', value => ({ ...value, ambiguityPrompt: '😀'.repeat(601) })],
  ['missing reason', value => ({ ...value, reason: undefined })],
  ['invalid reason', value => ({ ...value, reason: 1 })],
  ['oversized reason', value => ({ ...value, reason: '😀'.repeat(301) })],
  ['error envelope', value => ({ ...value, ok: false })],
]) {
  test(`authoritative hint fetch rejects ${label} without poisoning the requested memory slot`, async () => {
    const value = hint(`invalid-fetch-${label}`);
    assert.equal(await fetchUnconsumedClarificationHint(async () => mutate(value), value.conversationId, 4), null);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
  });
}

for (const wrapped of [false, true]) {
  test(`authoritative ${wrapped ? 'wrapped' : 'raw'} hint fetch accepts the full nullable canonical schema`, async () => {
    const value = { ...hint(`valid-fetch-${wrapped}`), mode: null, reason: null };
    assert.deepEqual(await fetchUnconsumedClarificationHint(async () => transport(value, wrapped), value.conversationId, 4), value);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.ambiguityPrompt, value.ambiguityPrompt);
  });
}
