// Synthetic provider/catalog transports only. No live Gemini or database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const categoryId = '11111111-1111-4111-8111-111111111111';
let version = 800000;
function fixture(t, provider, modes = ['ON_SITE']) {
  const catalogVersion = ++version;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return provider();
  });
  const rpc = async name => {
    assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
    return { ok: true, data: { catalogVersion, catalogFingerprint: String(catalogVersion), count: 1, categories: [
      { categoryId, label: 'Servis klima', aliases: [], modes, path: ['Servis klima'] },
    ] } };
  };
  return { calls, args: { rpc, geminiKey: 'synthetic', geminiModel: 'synthetic', conversationId: 'synthetic-conversation', draftRevision: 4 } };
}
const response = (value, extra = {}) => new Response(JSON.stringify({ candidates: [
  { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] }, ...extra },
] }));
const worker = (args, extra = {}) => buildWorkerFullTreeTaxonomyProposals({
  ...args, skills: ['Popravka klima'], messages: [], hasWorkAreas: true,
  serviceModeContext: { savedServices: [], draftServices: [] }, ...extra,
});
const need = args => buildFullTreeTaxonomyProposals({ ...args, items: [{ service: 'Popravka klima', mode: 'ON_SITE' }] });
const failureCases = [
  ['rate limit', () => new Response('{}', { status: 429 }), 'RETRYABLE_PROVIDER'],
  ['unavailable', () => new Response('{}', { status: 503 }), 'RETRYABLE_PROVIDER'],
  ['invalid credentials', () => new Response('{}', { status: 401 }), 'PROVIDER_PERMANENT_FAILURE'],
  ['abort', () => { throw new DOMException('Synthetic cancellation', 'AbortError'); }, 'RETRYABLE_PROVIDER'],
  ['invalid JSON', () => new Response('{'), 'RETRYABLE_PROVIDER'],
  ['invalid model JSON', () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{' }] } }] })), 'RETRYABLE_PROVIDER'],
  ['truncated', () => response({ decisions: [], items: [] }, { finishReason: 'MAX_TOKENS' }), 'RETRYABLE_PROVIDER'],
  ['refused', () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })), 'PROVIDER_PERMANENT_FAILURE'],
  ['missing decisions', () => response({}), 'RETRYABLE_PROVIDER'],
  ['empty decisions', () => response({ decisions: [], items: [] }), 'RETRYABLE_PROVIDER'],
];
for (const [label, provider, expected] of failureCases) {
  for (const [purpose, build] of [['need', need], ['worker', worker]]) {
    test(`${purpose}: ${label} is technical failure, never invented user ambiguity`, async t => {
      const f = fixture(t, provider);
      const result = await build(f.args);
      assert.deepEqual(result.proposals, []);
      assert.deepEqual(result.clarifications, []);
      assert.equal(result.clarificationHint, null);
      assert.ok(result.failures.some(failure => failure.status === expected));
      assert.equal(f.calls.length, 1, 'no automatic paid retry');
    });
  }
}
test('missing credentials do not call a provider or invent a question', async t => {
  const f = fixture(t, () => { throw new Error('must not call'); });
  for (const build of [need, worker]) {
    const result = await build({ ...f.args, geminiKey: '' });
    assert.deepEqual(result.clarifications, []);
    assert.deepEqual(result.proposals, []);
    assert.equal(result.failures[0].status, 'PROVIDER_PERMANENT_FAILURE');
  }
  assert.equal(f.calls.length, 0);
});
test('catalog mode and work area never establish a worker execution choice', async t => {
  const f = fixture(t, () => response({ items: [] }));
  const result = await worker({ ...f.args, geminiKey: '' }, { skills: ['Servis klima'] });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
for (const mode of [undefined, 'UNKNOWN', 'BOTH', 'REMOTE']) {
  test(`unconfirmed worker mode ${mode} cannot broaden a service`, async t => {
    const f = fixture(t, () => response({ items: [{ service: 'Servis klima', mode,
      action: 'CREATE_CHILD', parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Synthetic response.' }] }));
    const result = await worker(f.args, { skills: ['Servis klima'] });
    assert.deepEqual(result.proposals, []);
  });
}
test('provider failure preserves saved mode and physical handoff exactly, never draft modes', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }));
  const handoff = { required: true, shippingCountries: ['RS'] };
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId, handoff }],
    draftServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }],
  } });
  // This catalog does not yet offer REMOTE: retain only a validated existing mode,
  // never use provider failure to create a new extension or authorize ON_SITE.
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
test('confirmed saved REMOTE continuity preserves its handoff through provider failure', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }), ['REMOTE', 'ON_SITE']);
  const handoff = { required: true, localExchange: { countryCode: 'RS', city: 'Novi Sad' } };
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId, handoff }],
    draftServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }],
  } });
  assert.deepEqual(result.proposals.map(p => [p.mode, p.handoff, p.action]), [['REMOTE', handoff, 'REUSE_EXISTING']]);
  assert.deepEqual(result.clarifications, []);
  assert.equal(result.failures[0].status, 'RETRYABLE_PROVIDER');
});
test('saved missing handoff stays unknown even if the provider proposes worldwide digital work', async t => {
  const f = fixture(t, () => response({ items: [{ service: 'Servis klima', mode: 'REMOTE', action: 'CREATE_CHILD',
    parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Synthetic provider suggestion.' }] }), ['REMOTE']);
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId }], draftServices: [],
  } });
  assert.equal(result.proposals.length, 1);
  assert.ok(!Object.hasOwn(result.proposals[0], 'handoff'));
});
test('explicit USER-quoted fresh mode can classify a new service without catalog-derived consent', async t => {
  const f = fixture(t, () => response({ items: [{ service: 'Popravka klima', mode: 'ON_SITE', action: 'CREATE_CHILD',
    parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Jasna popravka pod odgovarajućom granom.' }] }));
  const evidence = 'Popravke klima nudim kod klijenta.';
  const result = await worker(f.args, { messages: [{ role: 'USER', body: evidence }],
    serviceModeChangesJson: JSON.stringify([{ service: 'Popravka klima', modes: ['ON_SITE'], evidence }]) });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].action, 'CREATE_CHILD');
  assert.equal(result.proposals[0].mode, 'ON_SITE');
  assert.deepEqual(result.clarifications, []);
});
test('an unresolved explicit fresh change never silently returns the old saved mode', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }));
  const evidence = 'Od sada servis klima nudim samo na daljinu.';
  const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
    serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
    serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
  });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
for (const modes of [['ON_SITE'], ['ON_SITE', 'REMOTE']]) {
  test(`provider outage cannot authorize a fresh mode even when catalog supports it: ${modes}`, async t => {
    const f = fixture(t, () => new Response('{}', { status: 503 }), modes);
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
      serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
      serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
  });
}
for (const decision of [
  { service: 'Druga usluga', mode: 'REMOTE', action: 'CREATE_CHILD', parentId: categoryId },
  { service: 'Servis klima', mode: 'REMOTE', action: 'UNKNOWN_ACTION', parentId: categoryId },
  { service: 'Servis klima', mode: 'REMOTE', parentId: categoryId },
]) {
  test(`incomplete/invalid provider decision cannot authorize requested extension: ${JSON.stringify(decision)}`, async t => {
    const f = fixture(t, () => response({ items: [{ ...decision, reason: 'Synthetic provider description.' }] }));
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
      serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
    assert.ok(result.failures.some(f => f.code === 'PROVIDER_INVALID_DECISION'));
  });
}
test('conflicting saved IDs cannot select one identity or mode by accident', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }), ['REMOTE', 'ON_SITE']);
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: { savedServices: [
    { service: 'Servis klima', mode: 'ON_SITE', categoryId },
    { service: 'Servis klima', mode: 'REMOTE', categoryId: '22222222-2222-4222-8222-222222222222' },
  ], draftServices: [] } });
  assert.deepEqual(result.proposals, []);
});
for (const kind of ['duplicate', 'invented-quote', 'malformed']) {
  test(`invalid fresh ${kind} mode request cannot quietly restore a saved mode`, async t => {
    const f = fixture(t, () => new Response('{}', { status: 503 }));
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const change = { service: 'Servis klima', modes: ['REMOTE'], evidence };
    const result = await worker(f.args, { skills: ['Servis klima'],
      messages: [{ role: 'USER', body: kind === 'invented-quote' ? 'Dopuni biografiju.' : evidence }],
      serviceModeChangesJson: kind === 'malformed' ? '{' : JSON.stringify(kind === 'duplicate' ? [change, change] : [change]),
      serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
    assert.ok(result.failures.some(f => f.code === 'WORKER_MODE_REQUEST_INVALID'));
  });
}
test('provider diagnostics never log returned private prose or exception details', async t => {
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const f = fixture(t, () => { throw new Error('PRIVATE ADDRESS AND TOKEN'); });
  await need(f.args);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE|ADDRESS|TOKEN/);
  assert.match(JSON.stringify(logs), /PROVIDER_TRANSPORT_FAILURE/);
});
test('invalid category IDs and unsupported semantic reuse do not become user questions', async t => {
  const f = fixture(t, () => response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
    action: 'REUSE_EXISTING', categoryId, parentId: '', reason: 'Same semantic service.' }] }));
  const result = await need(f.args);
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
  assert.ok(result.failures.length > 0, 'semantic SQL admission remains explicitly unresolved');
});
test('an explicit semantic clarification stays a single question', async t => {
  const f = fixture(t, () => response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
    action: 'NEEDS_CLARIFICATION', parentId: '', ambiguityPrompt: 'Da li treba popravka ili samo čišćenje?',
    reason: 'Tražena vrsta rada nije jasna.' }] }));
  const result = await need(f.args);
  assert.deepEqual(result.proposals, []);
  assert.equal(result.clarifications.length, 1);
  assert.equal(result.clarificationHint.ambiguityPrompt, 'Da li treba popravka ili samo čišćenje?');
});
