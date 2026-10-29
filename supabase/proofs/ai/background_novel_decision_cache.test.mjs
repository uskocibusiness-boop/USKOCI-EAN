import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = '11111111-1111-4111-8111-111111111111';
const LEAF = '22222222-2222-4222-8222-222222222222';
const MODULE = new URL('../../functions/_shared/backgroundTaxonomyArchitect.mjs', import.meta.url);
let instance = 0;

async function fixture(t, reply) {
  // A fresh Edge-instance equivalent keeps each runtime test independent.
  const { buildFullTreeTaxonomyProposals: build } = await import(`${MODULE.href}?decision-cache=${++instance}`);
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(console, 'warn', () => {});
  const catalog = { catalogVersion: 777001, catalogFingerprint: 'complete-public-catalog', count: 2,
    categories: [
      { categoryId: ROOT, parentId: null, isLeaf: false, label: 'Ručni rad', path: ['Ručni rad'],
        pathIds: [ROOT], aliases: [], modes: ['ON_SITE', 'REMOTE'] },
      { categoryId: LEAF, parentId: ROOT, isLeaf: true, label: 'Poznata usluga', path: ['Ručni rad', 'Poznata usluga'],
        pathIds: [ROOT, LEAF], aliases: [], modes: ['ON_SITE', 'REMOTE'] },
    ] };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.contents[0].parts[0].text);
    calls.push({ url, body: init.body, input, signal: init.signal });
    const decisions = input.servicesToClassify.map(item => ({ ...item, action: 'CREATE_CHILD',
      categoryId: '', parentId: ROOT, reason: `Potvrđen predlog grane, pokušaj ${calls.length}.` }));
    const result = reply ? await reply({ calls, input, decisions, init }) : decisions;
    if (result instanceof Response) return result;
    return Response.json({ candidates: [{ finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify({ decisions: result }) }] } }] });
  });
  const request = overrides => build({
    rpc: async name => {
      assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1', 'no business writer is used');
      return { ok: true, data: structuredClone(catalog) };
    },
    geminiKey: 'synthetic-secret-do-not-retain', geminiModel: 'synthetic-model-a',
    items: [{ service: 'Izrada drvenog ukrasa', mode: 'ON_SITE' }],
    scopeSummary: 'Ukras po već potvrđenom opisu.', ...overrides,
  });
  return { request, calls, catalog, setTime: value => { now = value; } };
}

test('unchanged complete request reuses only a CREATE_CHILD hint, never authority', async t => {
  const f = await fixture(t);
  const first = await f.request();
  const second = await f.request({ conversationId: 'different-owned-turn', draftRevision: 7 });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(second.proposals, first.proposals);
  assert.equal(second.proposals[0].action, 'CREATE_CHILD');
  assert.equal(second.proposals[0].categoryId, '');
  assert.deepEqual(second.clarifications, []);
  assert.equal(Object.hasOwn(second, 'classificationAuthority'), false);
  assert.equal(Object.hasOwn(second, 'classificationState'), false);
});

for (const [label, change] of [
  ['catalog fingerprint at the same version', f => { f.catalog.catalogFingerprint = 'new-fingerprint'; }],
  ['catalog version', f => { f.catalog.catalogVersion++; }],
  ['display label at the same version/fingerprint', f => { f.catalog.categories[0].label = 'Promenjena javna grana'; }],
  ['alias label at the same version/fingerprint', f => { f.catalog.categories[1].aliases = ['Drugi poznati naziv']; }],
  ['supported modes at the same version/fingerprint', f => { f.catalog.categories[1].modes = ['REMOTE']; }],
  ['parent relationship at the same version/fingerprint', f => { f.catalog.categories[1].parentId = null; }],
]) {
  test(`a changed ${label} cannot replay the previous proposal`, async t => {
    const f = await fixture(t);
    await f.request();
    change(f);
    const fresh = await f.request();
    assert.equal(f.calls.length, 2);
    assert.match(fresh.proposals[0].reason, /pokušaj 2/);
  });
}

for (const [label, overrides] of [
  ['exact model/configuration', { geminiModel: 'synthetic-2.5-model-b' }],
  ['original service text despite the same normalized identity', { items: [{ service: 'IZRADA DRVENOG UKRASA', mode: 'ON_SITE' }] }],
  ['public scope', { scopeSummary: 'Drugi potvrđeni obim posla.' }],
  ['execution mode', { items: [{ service: 'Izrada drvenog ukrasa', mode: 'REMOTE' }] }],
]) {
  test(`a changed ${label} requires a fresh bounded provider decision`, async t => {
    const f = await fixture(t);
    await f.request();
    const fresh = await f.request(overrides);
    assert.equal(f.calls.length, 2);
    assert.match(fresh.proposals[0].reason, /pokušaj 2/);
    await f.request(overrides);
    assert.equal(f.calls.length, 2, 'the unchanged new identity still benefits from caching');
  });
}

test('REMOTE handoff changes do not reuse a decision across different consent', async t => {
  const f = await fixture(t);
  const request = handoff => f.request({ items: [{ service: 'Izrada drvenog ukrasa', mode: 'REMOTE', handoff }] });
  const unknown = await request(undefined);
  const digital = await request({ required: false });
  const physical = await request({ required: true, shippingCountries: ['RS'] });
  assert.equal(f.calls.length, 3);
  assert.equal(Object.hasOwn(unknown.proposals[0], 'handoff'), false);
  assert.deepEqual(digital.proposals[0].handoff, { required: false });
  assert.deepEqual(physical.proposals[0].handoff, { required: true, shippingCountries: ['RS'] });
});

test('cache identity hashes the exact prompt/schema/request bytes but no provider credential', async t => {
  const f = await fixture(t);
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const inputs = [];
  t.mock.method(crypto.subtle, 'digest', async (algorithm, bytes) => {
    inputs.push(new TextDecoder().decode(bytes));
    return digest(algorithm, bytes);
  });
  await f.request();
  assert.ok(inputs.some(input => input.includes(JSON.stringify(f.calls[0].body))),
    'cache identity must contain the exact serialized provider body, including prompt/schema/configuration/tree');
  assert.ok(inputs.some(input => input.includes(f.calls[0].url)), 'the model/API endpoint belongs to the identity');
  assert.ok(inputs.every(input => !input.includes('synthetic-secret-do-not-retain')));
});

test('five-minute maximum age expires at its boundary and hits never renew it', async t => {
  const f = await fixture(t);
  await f.request();
  f.setTime(1299999);
  await f.request();
  assert.equal(f.calls.length, 1);
  f.setTime(1300000);
  await f.request();
  assert.equal(f.calls.length, 2);
});

test('clock rollback cannot extend the life of an existing decision', async t => {
  const f = await fixture(t);
  await f.request();
  f.setTime(999999);
  await f.request();
  assert.equal(f.calls.length, 2);
});

test('128-entry bound evicts the least recently used entry without extending age', async t => {
  const f = await fixture(t);
  const request = index => f.request({ items: [{ service: `Nepoznata usluga ${index}`, mode: 'ON_SITE' }] });
  for (let i = 0; i < 128; i++) await request(i);
  await request(0);
  assert.equal(f.calls.length, 128);
  await request(128);
  await request(0);
  assert.equal(f.calls.length, 129, 'the recently used entry remains present');
  await request(1);
  assert.equal(f.calls.length, 130, 'the oldest unused entry was evicted');
});

test('multi-service provider context is not reduced to reusable independent item decisions', async t => {
  const f = await fixture(t);
  const items = [{ service: 'Izrada drvenog ukrasa', mode: 'ON_SITE' },
    { service: 'Izrada drvenog kalupa', mode: 'ON_SITE' }];
  const first = await f.request({ items });
  const second = await f.request({ items });
  assert.equal(first.proposals.length, 2);
  assert.equal(second.proposals.length, 2);
  assert.equal(f.calls.length, 2, 'batch context is intentionally not cached per item');
  await f.request();
  assert.equal(f.calls.length, 3, 'a batch result cannot poison the later single-service request');
});

test('existing 120-character service bound rejects oversized input before provider/cache use', async t => {
  const f = await fixture(t);
  const items = [{ service: 'x'.repeat(121), mode: 'ON_SITE' }];
  assert.deepEqual((await f.request({ items })).proposals, []);
  assert.deepEqual((await f.request({ items })).proposals, []);
  assert.equal(f.calls.length, 0);
});

for (const action of ['NEEDS_CLARIFICATION', 'REUSE_EXISTING', 'INVALID']) {
  test(`${action} is not promoted into a cached CREATE_CHILD hint`, async t => {
    const f = await fixture(t, ({ decisions }) => decisions.map(item => ({ ...item, action,
      parentId: '', categoryId: action === 'REUSE_EXISTING' ? LEAF : '',
      ambiguityPrompt: 'Kakav konkretan ukras treba izraditi?' })));
    const first = await f.request();
    const second = await f.request();
    assert.equal(f.calls.length, 2);
    assert.ok([...first.proposals, ...second.proposals].every(item => item.action !== 'CREATE_CHILD'));
    if (action === 'REUSE_EXISTING') assert.equal(second.proposals[0].action, 'REUSE_EXISTING');
    if (action === 'NEEDS_CLARIFICATION') assert.equal(second.clarifications.length, 1);
  });
}

test('failed provider attempt is not cached and does not automatically retry', async t => {
  const f = await fixture(t, ({ calls, decisions }) => calls.length === 1
    ? new Response('synthetic rejected response', { status: 429 }) : decisions);
  const failed = await f.request();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(failed.proposals, []);
  assert.equal(failed.failures[0].code, 'PROVIDER_HTTP_429');
  await f.request();
  await f.request();
  assert.equal(f.calls.length, 2);
});

test('an already aborted turn cannot consume a warm cache or dispatch a provider request', async t => {
  const f = await fixture(t);
  await f.request();
  const abort = new AbortController();
  abort.abort();
  const stopped = await f.request({ signal: abort.signal });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(stopped.proposals, []);
  assert.equal(stopped.failures[0].code, 'PROVIDER_ABORTED');
});

test('abort during asynchronous identity hashing cannot consume the warm cache', async t => {
  const f = await fixture(t);
  await f.request();
  const abort = new AbortController();
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    const result = await digest(...args);
    abort.abort();
    return result;
  });
  const stopped = await f.request({ signal: abort.signal });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(stopped.proposals, []);
  assert.equal(stopped.failures[0].code, 'PROVIDER_ABORTED');
});

test('an aborted provider result cannot populate the decision cache', async t => {
  const abort = new AbortController();
  const f = await fixture(t, ({ calls, decisions }) => {
    if (calls.length === 1) abort.abort();
    return decisions;
  });
  const stopped = await f.request({ signal: abort.signal });
  assert.deepEqual(stopped.proposals, []);
  assert.equal(stopped.failures[0].code, 'PROVIDER_ABORTED');
  const fresh = await f.request();
  assert.match(fresh.proposals[0].reason, /pokušaj 2/);
  await f.request();
  assert.equal(f.calls.length, 2);
});

test('a cached hint does not bypass the current provider configuration gate', async t => {
  const f = await fixture(t);
  await f.request();
  const unconfigured = await f.request({ geminiKey: '' });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(unconfigured.proposals, []);
  assert.equal(unconfigured.failures[0].code, 'PROVIDER_NOT_CONFIGURED');
});

test('exact catalog identity still bypasses the provider independently of the decision cache', async t => {
  const f = await fixture(t);
  const result = await f.request({ items: [{ service: 'Poznata usluga', mode: 'ON_SITE' }] });
  assert.equal(f.calls.length, 0);
  assert.equal(result.proposals[0].action, 'REUSE_EXISTING');
  assert.equal(result.proposals[0].categoryId, LEAF);
});
