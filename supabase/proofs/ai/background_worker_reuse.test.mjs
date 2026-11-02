// Actual builder, authoritative-context-shaped fixtures, synthetic transport only.
// Saved continuity is not a new approval, worker capability or provider cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticBackgroundBudget } from './background_budget_fixture.mjs';
import { buildWorkerFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const known = 'Servis klima', fresh = 'Popravka roletni';
const handoff = { required: true, shippingCountries: ['RS'] };
const node = (n, label, extra = {}) => ({ categoryId: id(n), label, parentId: null,
  isLeaf: true, path: [label], aliases: [], modes: ['ON_SITE', 'REMOTE'], ...extra });
const saved = (mode = 'ON_SITE', extra = {}) => ({ service: known, mode, categoryId: id(1), ...extra });
const change = (service = fresh, modes = ['ON_SITE'], extra = {}) => ({ service, modes,
  evidence: 'SYNTHETIC USER explicitly offers ' + service + ' ' + modes.join(' and '), ...extra });
const decision = (service = fresh, extra = {}) => ({ service, mode: 'ON_SITE', action: 'CREATE_CHILD',
  parentId: id(2), reason: 'Nova konkretna usluga u odgovarajućoj grani.', ...extra });
function fixture(t, options = {}) {
  const requests = [], calls = [];
  const categories = options.categories ?? [node(1, known), node(2, 'Kućne popravke', { isLeaf: false })];
  const changes = options.changes ?? [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push(JSON.parse(init.body));
    assert.match(String(url), /:generateContent$/);
    if (options.provider) return options.provider(requests.at(-1));
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: {
      parts: [{ text: JSON.stringify({ items: options.decisions ?? [decision()] }) }],
    } }] }));
  });
  const args = { rpc: async name => {
    calls.push(name); assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
    return { catalogVersion: 98001, catalogFingerprint: 'a'.repeat(32), count: categories.length, categories };
  }, providerBudget: syntheticBackgroundBudget, geminiKey: options.key ?? 'SYNTHETIC', geminiModel: 'synthetic',
  skills: options.skills ?? [known], messages: changes.map(entry => ({ role: 'USER', body: entry.evidence })),
  serviceModeContext: { savedServices: options.saved ?? [saved()], draftServices: options.draft ?? [] },
  serviceModeChangesJson: options.rawChanges ?? JSON.stringify(changes),
  hasWorkAreas: true, conversationId: id(8), draftRevision: 7 };
  return { requests, calls, args, run: () => buildWorkerFullTreeTaxonomyProposals(args),
    sent: () => JSON.parse(requests[0].contents[0].parts[0].text) };
}

for (const modes of [['ON_SITE'], ['REMOTE'], ['ON_SITE', 'REMOTE']]) {
  test(`unchanged saved ${modes.join('+')} uses fresh catalog without a provider call`, async t => {
    const entries = modes.map(mode => saved(mode, mode === 'REMOTE' ? { handoff } : {}));
    const f = fixture(t, { saved: entries });
    const result = await f.run();
    assert.equal(f.calls.length, 1, 'fresh catalog revalidation still required');
    assert.equal(f.requests.length, 0, 'no paid reclassification of saved identity');
    assert.deepEqual(result.proposals.map(p => [p.categoryId, p.mode, p.handoff]),
      entries.map(p => [p.categoryId, p.mode, p.handoff]));
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.clarifications, []);
    assert.deepEqual(result.unresolvedServices, []);
  });
}
test('saved known REMOTE with unknown handoff stays unknown without model inference', async t => {
  const f = fixture(t, { saved: [saved('REMOTE')] });
  const result = await f.run();
  assert.equal(f.requests.length, 0);
  assert.equal(result.proposals.length, 1);
  assert.ok(!Object.hasOwn(result.proposals[0], 'handoff'));
});
test('missing provider credentials do not mark fully validated saved continuity as failed', async t => {
  const f = fixture(t, { key: '' });
  const result = await f.run();
  assert.equal(f.requests.length, 0);
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(result.failures, []);
});
test('mixed edit sends only new work to model, retains complete known BOTH and physical handoff', async t => {
  const f = fixture(t, { skills: [known, fresh], saved: [saved(), saved('REMOTE', { handoff })],
    changes: [change()], decisions: [decision(), decision(known, { action: 'NEEDS_CLARIFICATION',
      ambiguityPrompt: 'Koju vrstu stare usluge zapravo nudite?' })] });
  const result = await f.run();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.sent().skills, [fresh]);
  assert.equal(result.proposals.length, 3, 'full review still contains old and new services');
  assert.deepEqual(result.proposals.filter(p => p.service === known).map(p => [p.mode, p.handoff]),
    [['ON_SITE', undefined], ['REMOTE', handoff]]);
  assert.deepEqual(result.clarifications, [], 'unsolicited provider opinion cannot reopen saved work');
  assert.deepEqual(result.unresolvedServices, []);
});
test('failed new-work inference still preserves unchanged validated saved work', async t => {
  const f = fixture(t, { skills: [known, fresh], changes: [change()], provider: () => new Response('{}', { status: 503 }) });
  const result = await f.run();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.sent().skills, [fresh]);
  assert.deepEqual(result.proposals.map(p => p.service), [known]);
  assert.deepEqual(result.unresolvedServices, [fresh]);
  assert.ok(result.failures.some(p => p.code === 'PROVIDER_HTTP_503'));
});
for (const [name, options] of [
  ['different category ID', { saved: [saved('ON_SITE', { categoryId: id(99) })] }],
  ['conflicting saved IDs', { saved: [saved(), saved('REMOTE', { categoryId: id(99) })] }],
  ['catalog no longer has saved mode', { categories: [node(1, known, { modes: ['REMOTE'] })] }],
  ['ambiguous label', { categories: [node(1, known), node(2, known)] }],
  ['draft only', { saved: [], draft: [saved()] }],
  ['unknown saved mode', { saved: [saved('UNKNOWN')] }],
  ['invalid saved handoff', { saved: [saved('REMOTE', { handoff: { required: 'yes' } })] }],
  ['onsite has handoff', { saved: [saved('ON_SITE', { handoff })] }],
  ['new unresolved service', { saved: [], skills: [fresh] }],
]) {
  test(`${name} cannot take known-saved fast path`, async t => {
    const f = fixture(t, options);
    const result = await f.run();
    assert.equal(f.requests.length, 1);
    assert.deepEqual(result.proposals, [], 'no capability or mode inferred from invalid continuity');
    assert.ok(result.unresolvedServices.length > 0 || result.failures.length > 0);
  });
}
for (const [name, changes] of [
  ['mode replacement', [change(known, ['REMOTE'])]],
  ['same modes with new handoff', [change(known, ['ON_SITE', 'REMOTE'], { handoff })]],
]) {
  test(`explicit ${name} still needs a new provider decision`, async t => {
    const f = fixture(t, { saved: [saved(), saved('REMOTE')], changes,
      provider: () => new Response('{}', { status: 503 }) });
    const result = await f.run();
    assert.equal(f.requests.length, 1);
    assert.deepEqual(f.sent().skills, [known]);
    assert.deepEqual(result.proposals, [], 'failed change never silently restores saved choice');
    assert.deepEqual(result.unresolvedServices, [known]);
  });
}
for (const rawChanges of ['{', '{}', JSON.stringify([change(known), change(known)]),
  JSON.stringify([change(known, ['ON_SITE'], { evidence: 'invented quote not in owned messages' })])]) {
  test(`rejected fresh declaration cannot restore old saved choice: ${rawChanges}`, async t => {
    const f = fixture(t, { rawChanges });
    const result = await f.run();
    assert.deepEqual(result.proposals, []);
    assert.ok(result.failures.some(p => p.code === 'WORKER_MODE_REQUEST_INVALID'));
    assert.equal(f.requests.length, 0, 'a rejected declaration needs no paid classification');
  });
}

test('classifier receives each quoted execution choice even after its message leaves the recent window', async t => {
  const services = ['Lektura tekstova', 'Krečenje stanova', 'Časovi engleskog'];
  const changes = [change(services[0], ['REMOTE'], { handoff: { required: false } }),
    change(services[1]), change(services[2], ['REMOTE', 'ON_SITE'], { handoff: { required: false } })];
  const categories = services.map((service, i) => node(i + 1, service));
  let sent;
  const f = fixture(t, { skills: services, saved: [], changes, categories,
    provider: request => {
      sent = JSON.parse(request.contents[0].parts[0].text);
      // Request-aware synthetic provider: classification can cover only choices
      // actually supplied by the caller. This is not a live model quality test.
      const items = (sent.requestedChanges ?? []).flatMap(entry => entry.modes.map(mode => ({
        service: entry.service, mode, action: 'REUSE_EXISTING', parentId: '',
        categoryId: categories.find(category => category.label === entry.service).categoryId,
        reason: 'Ista konkretna usluga u potpunom katalogu.',
      })));
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: {
        parts: [{ text: JSON.stringify({ items }) }],
      } }] }));
    } });
  f.args.messages.push(...Array.from({ length: 11 }, (_, i) => ({ role: 'USER', body: 'Nezavisna dopuna ' + i })));
  const result = await f.run();
  assert.equal(f.requests.length, 1, 'all services share one classifier call');
  assert.deepEqual(sent.requestedChanges, changes, 'exact owned quotes remain tied to their own services');
  assert.equal(sent.recentUserMessages.length, 10, 'do not resend the entire history');
  assert.ok(changes.every(entry => !sent.recentUserMessages.includes(entry.evidence)));
  assert.deepEqual(result.proposals.map(p => [p.service, p.mode, p.categoryId, p.handoff]), [
    [services[0], 'REMOTE', id(1), { required: false }],
    [services[1], 'ON_SITE', id(2), undefined],
    [services[2], 'REMOTE', id(3), { required: false }],
    [services[2], 'ON_SITE', id(3), undefined],
  ]);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.unresolvedServices, []);
});

test('invalid change is withheld while an independent valid service still gets classified', async t => {
  const valid = change();
  const invalid = change(known, ['REMOTE'], { evidence: 'No USER ever said this exact invented quote' });
  const f = fixture(t, { skills: [known, fresh], changes: [valid],
    rawChanges: JSON.stringify([invalid, valid]), decisions: [decision()] });
  const result = await f.run();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.sent().skills, [fresh]);
  assert.deepEqual(f.sent().requestedChanges, [valid]);
  assert.deepEqual(result.proposals.map(p => p.service), [fresh]);
  assert.deepEqual(result.unresolvedServices, [known]);
  assert.ok(result.failures.some(p => p.code === 'WORKER_MODE_REQUEST_INVALID' && p.service === known));
});

test('draft modes and assistant quotes do not become requested classifier choices', async t => {
  const f = fixture(t, { skills: [fresh], saved: [], draft: [saved('REMOTE', { service: fresh })] });
  f.args.messages.push({ role: 'ASSISTANT', body: 'This service is offered online and on site' });
  const result = await f.run();
  assert.deepEqual(f.sent().requestedChanges, []);
  assert.deepEqual(result.proposals, []);
  assert.ok(result.unresolvedServices.includes(fresh));
});
